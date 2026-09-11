const PlayerPerception = require('./PlayerPerception');
const InventoryPerception = require('./InventoryPerception');
const EnvironmentPerception = require('./EnvironmentPerception');
const EntityPerception = require('./EntityPerception');
const ThreatDetector = require('./ThreatDetector');
const BlockScanner = require('./BlockScanner');

/**
 * WorldState
 * Comprehensive, structured, and read-only situational representation of the Minecraft environment.
 * Maintains bounded history and produces sanitized, JSON-safe snapshots free of circular references.
 */
class WorldState {
  constructor(options = {}) {
    this.maxHistory = options.maxHistory || 100;

    this.connection = {
      connected: false,
      spawned: false,
      serverIp: null,
      serverPort: null
    };

    this.player = {
      username: null,
      uuid: null,
      position: null,
      rotation: { yaw: 0, pitch: 0 },
      onGround: false,
      velocity: { x: 0, y: 0, z: 0 },
      gameMode: 'survival',
      experience: { level: 0, points: 0, progress: 0 }
    };

    this.survival = {
      health: 20,
      maxHealth: 20,
      food: 20,
      foodSaturation: 5,
      oxygen: 20,
      isSleeping: false,
      statusEffects: []
    };

    this.environment = {
      dimension: 'overworld',
      biome: 'unknown',
      timeOfDay: 0,
      formattedTime: '06:00 (Sunrise)',
      phase: 'Sunrise',
      isDay: true,
      isNight: false,
      weather: 'clear',
      isRaining: false,
      isThundering: false,
      age: 0,
      difficulty: 'normal',
      hardcore: false
    };

    this.inventory = {
      items: [],
      equipment: {
        helmet: null,
        chestplate: null,
        leggings: null,
        boots: null,
        mainHand: null,
        offHand: null
      },
      summary: {
        totalCount: 0,
        uniqueCount: 0,
        slotsUsed: 0,
        emptySlots: 36
      }
    };

    this.equipment = {
      helmet: null,
      chestplate: null,
      leggings: null,
      boots: null,
      mainHand: null,
      offHand: null
    };

    this.entities = [];
    this.players = [];
    this.nearbyBlocks = [];

    this.threats = {
      level: ThreatDetector.LEVELS.NONE,
      score: 0,
      reasons: [],
      hostilesCount: 0,
      closestHostile: null,
      environmentalThreats: []
    };

    this.timestamp = Date.now();
    this.lastObserved = Date.now();

    // Bounded history ring-buffer
    this._history = [];

    // Legacy getters for backward compatibility with Phase 1 code
    this.connected = false;
    this.spawned = false;
    this.health = 20;
    this.food = 20;
    this.position = null;
    this.dimension = 'overworld';
    this.time = { timeOfDay: 0, isDay: true, isNight: false };
    this.nearbyEntitiesCount = 0;
    this.isSleeping = false;
    this.gameMode = 'survival';
  }

  /**
   * Observe bot state and update all sub-perceptions
   * @param {object|null} bot Mineflayer bot instance
   * @param {object} options Options to customize scan (e.g. skipBlocks)
   * @returns {WorldState}
   */
  observe(bot, options = {}) {
    this.timestamp = Date.now();
    this.lastObserved = this.timestamp;

    if (!bot) {
      this.connection.connected = false;
      this.connection.spawned = false;
      this.connected = false;
      this.spawned = false;
      this.position = null;
      this.player.position = null;
      return this;
    }

    try {
      // 1. Connection
      this.connection.connected = Boolean(bot._client && !bot._client.ended);
      this.connection.spawned = Boolean(bot.entity);
      if (bot._client && bot._client.socket) {
        this.connection.serverIp = bot._client.socket.remoteAddress || null;
        this.connection.serverPort = bot._client.socket.remotePort || null;
      }

      // 2. Player & Survival
      const playerData = PlayerPerception.extract(bot);
      this.player = playerData.player;
      this.survival = playerData.survival;

      // 3. Environment
      this.environment = EnvironmentPerception.extract(bot);

      // 4. Inventory & Equipment
      const invData = InventoryPerception.extract(bot);
      this.inventory = invData;
      this.equipment = invData.equipment;

      // 5. Entities & Players
      const entityData = EntityPerception.extract(bot);
      this.entities = entityData.entities;
      this.players = entityData.players;

      // 6. Blocks (only if requested or not skipped)
      if (!options.skipBlocks && typeof bot.blockAt === 'function' && bot.entity) {
        const blockData = BlockScanner.scan(bot, options.blockOptions || {});
        this.nearbyBlocks = blockData.interestingBlocks;
      }

      // 7. Threat Evaluation
      this.threats = ThreatDetector.evaluate({
        survival: this.survival,
        player: this.player,
        entities: this.entities,
        nearbyBlocks: this.nearbyBlocks
      });

      // Synchronize legacy fields for backward compatibility
      this.connected = this.connection.connected;
      this.spawned = this.connection.spawned;
      this.health = this.survival.health;
      this.food = this.survival.food;
      this.position = this.player.position ? { ...this.player.position } : null;
      this.dimension = this.environment.dimension;
      this.time = {
        timeOfDay: this.environment.timeOfDay,
        isDay: this.environment.isDay,
        isNight: this.environment.isNight
      };
      this.nearbyEntitiesCount = this.entities.length;
      this.isSleeping = this.survival.isSleeping;
      this.gameMode = this.player.gameMode;

      // Record snapshot into bounded history
      this.recordHistory();
    } catch (e) {
      this.connection.connected = false;
      this.connected = false;
    }

    return this;
  }

  /**
   * Produce a complete, JSON-safe snapshot
   * Guarantees no circular references, no functions, no credentials.
   * @returns {object}
   */
  getSnapshot() {
    return {
      timestamp: this.timestamp,
      connection: { ...this.connection },
      player: {
        username: this.player.username,
        uuid: this.player.uuid,
        position: this.player.position ? { ...this.player.position } : null,
        rotation: { ...this.player.rotation },
        onGround: this.player.onGround,
        velocity: { ...this.player.velocity },
        gameMode: this.player.gameMode,
        experience: { ...this.player.experience }
      },
      survival: {
        health: this.survival.health,
        maxHealth: this.survival.maxHealth,
        food: this.survival.food,
        foodSaturation: this.survival.foodSaturation,
        oxygen: this.survival.oxygen,
        isSleeping: this.survival.isSleeping,
        statusEffects: [...this.survival.statusEffects]
      },
      position: this.player.position ? { ...this.player.position } : null,
      environment: { ...this.environment },
      inventory: {
        items: this.inventory.items.map(i => ({ ...i })),
        equipment: {
          helmet: this.equipment.helmet ? { ...this.equipment.helmet } : null,
          chestplate: this.equipment.chestplate ? { ...this.equipment.chestplate } : null,
          leggings: this.equipment.leggings ? { ...this.equipment.leggings } : null,
          boots: this.equipment.boots ? { ...this.equipment.boots } : null,
          mainHand: this.equipment.mainHand ? { ...this.equipment.mainHand } : null,
          offHand: this.equipment.offHand ? { ...this.equipment.offHand } : null
        },
        summary: { ...this.inventory.summary }
      },
      equipment: {
        helmet: this.equipment.helmet ? { ...this.equipment.helmet } : null,
        chestplate: this.equipment.chestplate ? { ...this.equipment.chestplate } : null,
        leggings: this.equipment.leggings ? { ...this.equipment.leggings } : null,
        boots: this.equipment.boots ? { ...this.equipment.boots } : null,
        mainHand: this.equipment.mainHand ? { ...this.equipment.mainHand } : null,
        offHand: this.equipment.offHand ? { ...this.equipment.offHand } : null
      },
      entities: this.entities.map(e => ({ ...e })),
      players: this.players.map(p => ({ ...p })),
      nearbyBlocks: this.nearbyBlocks.map(b => ({ ...b })),
      threats: {
        level: this.threats.level,
        score: this.threats.score,
        reasons: [...this.threats.reasons],
        hostilesCount: this.threats.hostilesCount,
        closestHostile: this.threats.closestHostile ? { ...this.threats.closestHostile } : null,
        environmentalThreats: [...this.threats.environmentalThreats]
      }
    };
  }

  /**
   * Return a compact dashboard-friendly summary
   * @returns {object}
   */
  getSummary() {
    const pos = this.player.position;
    const posStr = pos ? `${pos.x}, ${pos.y}, ${pos.z}` : 'Unknown';

    let timeSummary = 'day';
    if (this.environment.isNight) {
      timeSummary = 'night';
    } else if (this.environment.isDay) {
      timeSummary = 'day';
    } else if (this.environment.phase) {
      timeSummary = this.environment.phase.toLowerCase();
    }

    return {
      timestamp: this.timestamp,
      position: posStr,
      coords: pos ? { ...pos } : null,
      health: this.survival.health,
      food: this.survival.food,
      time: timeSummary,
      timeFormatted: this.environment.formattedTime,
      dimension: this.environment.dimension,
      biome: this.environment.biome,
      weather: this.environment.weather,
      entities: this.entities.length,
      hostiles: this.threats.hostilesCount,
      playersCount: this.players.length,
      threat: this.threats.level,
      threatScore: this.threats.score,
      threatReasons: [...this.threats.reasons]
    };
  }

  /**
   * Update a specific category or property of the world state
   * @param {string} category 
   * @param {any} data 
   * @returns {WorldState}
   */
  update(category, data) {
    if (this[category] && typeof this[category] === 'object' && !Array.isArray(this[category]) && typeof data === 'object' && !Array.isArray(data)) {
      this[category] = { ...this[category], ...data };
    } else {
      this[category] = data;
    }

    // Propagate nested survival or player shortcuts
    if (data && typeof data === 'object') {
      if (data.survival) {
        this.survival = { ...this.survival, ...data.survival };
        if (data.survival.health !== undefined) this.health = data.survival.health;
        if (data.survival.food !== undefined) this.food = data.survival.food;
      }
      if (data.health !== undefined) {
        this.survival.health = data.health;
        this.health = data.health;
      }
      if (data.food !== undefined) {
        this.survival.food = data.food;
        this.food = data.food;
      }
    }

    this.timestamp = Date.now();
    return this;
  }

  /**
   * Record snapshot into bounded history ring buffer
   * @param {object|null} snapshot Optional explicit snapshot/summary
   */
  recordSnapshot(snapshot = null) {
    if (snapshot) {
      const snap = { ...snapshot };
      if (!snap.position && snap.player?.position) {
        const p = snap.player.position;
        snap.position = `${p.x}, ${p.y}, ${p.z}`;
      }
      this._history.push(snap);
      if (this._history.length > this.maxHistory) {
        this._history.shift();
      }
    } else {
      this.recordHistory();
    }
  }

  /**
   * Record current summary into bounded history ring buffer
   */
  recordHistory() {
    const summary = this.getSummary();
    this._history.push(summary);

    if (this._history.length > this.maxHistory) {
      this._history.shift();
    }
  }

  /**
   * Retrieve bounded history
   * @param {number} limit 
   * @returns {Array<object>}
   */
  getHistory(limit = 50) {
    const lim = Math.max(1, Math.min(this.maxHistory, limit));
    return this._history.slice(-lim);
  }

  /**
   * Clear recorded history
   */
  clearHistory() {
    this._history = [];
  }
}

module.exports = WorldState;
