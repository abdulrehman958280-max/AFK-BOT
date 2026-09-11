const WorldState = require('./WorldState');
const PlayerPerception = require('./PlayerPerception');
const InventoryPerception = require('./InventoryPerception');
const EnvironmentPerception = require('./EnvironmentPerception');
const EntityPerception = require('./EntityPerception');
const ThreatDetector = require('./ThreatDetector');
const BlockScanner = require('./BlockScanner');

/**
 * PerceptionManager
 * Central coordinator of Minecraft world observation.
 * Orchestrates event-driven updates and bounded polling cycles.
 * Strictly read-only: never commands or controls the bot.
 */
class PerceptionManager {
  constructor(options = {}) {
    this.options = {
      playerIntervalMs: options.playerIntervalMs || options.fastPollMs || 500,
      entityIntervalMs: options.entityIntervalMs || options.mediumPollMs || 1000,
      blockIntervalMs: options.blockIntervalMs || options.slowPollMs || 3000,
      environmentIntervalMs: options.environmentIntervalMs || options.mediumPollMs || 2500,
      inventoryIntervalMs: options.inventoryIntervalMs || options.mediumPollMs || 2000,
      maxHistory: options.maxHistory || 100,
      ...options
    };

    this.bot = null;
    this.eventBus = null;
    this.worldState = options.worldState || new WorldState({ maxHistory: this.options.maxHistory });

    this._isRunning = false;
    this._initialized = false;
    this._destroyed = false;

    // Track intervals for clean teardown
    this._intervals = [];

    // Track bot event listeners for clean unbinding: [{ event, handler }]
    this._botListeners = [];

    // Internal state cache to avoid emitting redundant events
    this._lastEmittedThreatLevel = null;
    this._lastHealth = 20;
    this._lastFood = 20;
  }

  /**
   * Initialize perception manager with bot and optional event bus
   * @param {object|null} bot Mineflayer bot instance
   * @param {object|null} eventBus EventBus instance
   */
  initialize(bot = null, eventBus = null) {
    if (this._destroyed) {
      throw new Error('Cannot initialize destroyed PerceptionManager');
    }

    // Stop and unbind any existing bot before re-attaching
    this.stop();

    this.bot = bot;
    if (eventBus) {
      this.eventBus = eventBus;
    }

    if (this.bot) {
      this._bindBotEvents();
      this.worldState.observe(this.bot, { skipBlocks: true });
    }

    this._initialized = true;
    return this;
  }

  /**
   * Bind event listeners to Mineflayer bot safely
   * @private
   */
  _bindBotEvents() {
    if (!this.bot || typeof this.bot.on !== 'function') return;

    const addListener = (event, handler) => {
      this.bot.on(event, handler);
      this._botListeners.push({ event, handler });
    };

    // Health update
    addListener('health', () => {
      if (!this._isRunning) return;
      this._updatePlayerAndSurvival();
    });

    // Experience update
    addListener('experience', () => {
      if (!this._isRunning) return;
      this._updatePlayerAndSurvival();
    });

    // Time update
    addListener('time', () => {
      if (!this._isRunning) return;
      this._updateEnvironment();
    });

    // Rain / weather update
    addListener('rain', () => {
      if (!this._isRunning) return;
      this._updateEnvironment();
    });

    // Player collect / inventory change
    addListener('playerCollect', () => {
      if (!this._isRunning) return;
      this._updateInventory();
    });

    // Spawn event
    addListener('spawn', () => {
      if (!this._isRunning) return;
      this.refreshAll();
    });
  }

  /**
   * Unbind all registered listeners from the bot
   * @private
   */
  _unbindBotEvents() {
    if (this.bot && typeof this.bot.removeListener === 'function') {
      for (const { event, handler } of this._botListeners) {
        try {
          this.bot.removeListener(event, handler);
        } catch (e) {
          // Safe unbinding
        }
      }
    }
    this._botListeners = [];
  }

  /**
   * Start perception update loops
   * Guarded against duplicate start
   */
  start() {
    if (this._destroyed) {
      throw new Error('Cannot start destroyed PerceptionManager');
    }

    if (this._isRunning) {
      return false; // Already running
    }

    this._isRunning = true;

    // Initial full refresh
    this.refreshAll();

    // Setup periodic polling cycles with unref timers
    this._setupInterval(() => this._updatePlayerAndSurvival(), this.options.playerIntervalMs);
    this._setupInterval(() => this._updateEntitiesAndThreats(), this.options.entityIntervalMs);
    this._setupInterval(() => this._updateEnvironment(), this.options.environmentIntervalMs);
    this._setupInterval(() => this._updateInventory(), this.options.inventoryIntervalMs);
    this._setupInterval(() => this._scanBlocks(), this.options.blockIntervalMs);

    return true;
  }

  /**
   * Helper to set up an interval tracked for cleanup
   * @private
   */
  _setupInterval(fn, intervalMs) {
    const timer = setInterval(() => {
      if (!this._isRunning || this._destroyed) return;
      try {
        fn();
      } catch (err) {
        if (this.eventBus) {
          this.eventBus.emit('agent:error', {
            source: 'PerceptionManager',
            error: err.message,
            timestamp: Date.now()
          });
        }
      }
    }, intervalMs);

    if (timer.unref) {
      timer.unref();
    }

    this._intervals.push(timer);
  }

  /**
   * Perform a complete observation of all sensory domains
   */
  refreshAll() {
    if (!this.bot) {
      this.worldState.observe(null);
      return;
    }

    this.worldState.observe(this.bot);
    this._updatePlayerAndSurvival();
    this._emitWorldUpdated();
  }

  /**
   * Update player and survival state
   * @private
   */
  _updatePlayerAndSurvival() {
    if (!this.bot) return;

    const data = PlayerPerception.extract(this.bot);
    this.worldState.player = data.player;
    this.worldState.survival = data.survival;
    this.worldState.health = data.survival.health;
    this.worldState.food = data.survival.food;
    this.worldState.position = data.player.position ? { ...data.player.position } : null;

    if (this.eventBus) {
      this.eventBus.emit('player:updated', {
        player: this.worldState.player,
        survival: this.worldState.survival,
        timestamp: Date.now()
      });
    }

    // Re-evaluate threats if health changed
    if (this.worldState.survival.health !== this._lastHealth || this.worldState.survival.food !== this._lastFood) {
      this._lastHealth = this.worldState.survival.health;
      this._lastFood = this.worldState.survival.food;
      this._updateEntitiesAndThreats();
    }
  }

  /**
   * Update environment state
   * @private
   */
  _updateEnvironment() {
    if (!this.bot) return;

    this.worldState.environment = EnvironmentPerception.extract(this.bot);
    this.worldState.dimension = this.worldState.environment.dimension;
    this.worldState.time = {
      timeOfDay: this.worldState.environment.timeOfDay,
      isDay: this.worldState.environment.isDay,
      isNight: this.worldState.environment.isNight
    };

    if (this.eventBus) {
      this.eventBus.emit('environment:updated', {
        environment: this.worldState.environment,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Update inventory and equipment
   * @private
   */
  _updateInventory() {
    if (!this.bot) return;

    const inv = InventoryPerception.extract(this.bot);
    this.worldState.inventory = inv;
    this.worldState.equipment = inv.equipment;

    if (this.eventBus) {
      this.eventBus.emit('inventory:updated', {
        inventory: this.worldState.inventory,
        equipment: this.worldState.equipment,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Update entities and evaluate threats
   * @private
   */
  _updateEntitiesAndThreats() {
    if (!this.bot) return;

    const entityData = EntityPerception.extract(this.bot);
    this.worldState.entities = entityData.entities;
    this.worldState.players = entityData.players;
    this.worldState.nearbyEntitiesCount = entityData.entities.length;

    const threatAssessment = ThreatDetector.evaluate({
      survival: this.worldState.survival,
      player: this.worldState.player,
      entities: this.worldState.entities,
      nearbyBlocks: this.worldState.nearbyBlocks
    });

    this.worldState.threats = threatAssessment;

    if (this.eventBus) {
      this.eventBus.emit('entities:updated', {
        entities: this.worldState.entities,
        players: this.worldState.players,
        summary: entityData.summary,
        timestamp: Date.now()
      });

      // Emit threats updated
      this.eventBus.emit('threats:updated', {
        threats: this.worldState.threats,
        timestamp: Date.now()
      });

      // If threat level changed, emit specific event
      if (this._lastEmittedThreatLevel !== threatAssessment.level) {
        this._lastEmittedThreatLevel = threatAssessment.level;
        this.eventBus.emit('threat:levelChanged', {
          level: threatAssessment.level,
          reasons: threatAssessment.reasons,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Bounded nearby block scan
   * @private
   */
  _scanBlocks() {
    if (!this.bot || !this.bot.entity || typeof this.bot.blockAt !== 'function') return;

    const scanResult = BlockScanner.scan(this.bot);
    this.worldState.nearbyBlocks = scanResult.interestingBlocks;

    if (this.eventBus) {
      this.eventBus.emit('blocks:updated', {
        blocks: this.worldState.nearbyBlocks,
        summary: scanResult.summary,
        scannedCount: scanResult.scannedCount,
        timestamp: Date.now()
      });
    }

    this._emitWorldUpdated();
  }

  /**
   * Emit overall world updated event
   * @private
   */
  _emitWorldUpdated() {
    this.worldState.recordHistory();

    if (this.eventBus) {
      this.eventBus.emit('world:updated', {
        summary: this.worldState.getSummary(),
        timestamp: Date.now()
      });
    }
  }

  /**
   * Stop perception polling and unbind listeners cleanly
   */
  stop() {
    if (!this._isRunning) {
      this._unbindBotEvents();
      return false;
    }

    this._isRunning = false;

    // Clear all active intervals
    for (const interval of this._intervals) {
      clearInterval(interval);
    }
    this._intervals = [];

    // Unbind listeners from bot
    this._unbindBotEvents();

    return true;
  }

  /**
   * Destroy the perception manager completely
   */
  destroy() {
    this._destroyed = true;
    this.stop();
    this.bot = null;
    this.eventBus = null;
    this.worldState.clearHistory();
  }
}

module.exports = PerceptionManager;
