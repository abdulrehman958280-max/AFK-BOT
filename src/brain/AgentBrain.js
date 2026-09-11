const EventBus = require('./EventBus');
const AgentState = require('./AgentState');
const GoalManager = require('./GoalManager');
const TaskManager = require('./TaskManager');
const DecisionEngine = require('./DecisionEngine');
const ActionRegistry = require('../actions/ActionRegistry');
const ActionExecutor = require('../actions/ActionExecutor');
const WorldState = require('../perception/WorldState');
const PerceptionManager = require('../perception/PerceptionManager');
const BrainLogger = require('../telemetry/BrainLogger');
const SurvivalEngine = require('../survival/SurvivalEngine');

/**
 * AgentBrain
 * Central coordinator orchestrating perception, state, goal/task management,
 * decision loop, action execution, and telemetry.
 */
class AgentBrain {
  constructor(options = {}) {
    this.options = {
      tickIntervalMs: options.tickIntervalMs || 1000,
      initialMode: options.initialMode || AgentState.MODES.AFK,
      maxTelemetryEvents: options.maxTelemetryEvents || 300,
      ...options
    };

    this.eventBus = new EventBus();
    this.state = new AgentState(this.eventBus, this.options.initialMode);
    this.goalManager = new GoalManager(this.eventBus);
    this.taskManager = new TaskManager(this.eventBus);
    this.decisionEngine = new DecisionEngine(this.eventBus);
    this.actionRegistry = new ActionRegistry();
    this.actionExecutor = new ActionExecutor(this.actionRegistry, this.eventBus);
    this.worldState = new WorldState({ maxHistory: this.options.maxHistory || 100 });
    this.perceptionManager = new PerceptionManager({
      worldState: this.worldState,
      maxHistory: this.options.maxHistory || 100,
      ...(this.options.perception || {})
    });
    this.survivalEngine = new SurvivalEngine(this.eventBus);
    this.logger = new BrainLogger({ maxEvents: this.options.maxTelemetryEvents });

    // Connect logger to event bus
    this.logger.attach(this.eventBus);

    this.bot = null;
    this._isRunning = false;
    this._isPaused = false;
    this._isTicking = false;
    this._tickTimer = null;
    this._destroyed = false;

    this.logger.log('system', { message: 'AgentBrain constructed' });
  }

  /**
   * Initialize brain with a Minecraft bot instance
   * @param {object|null} bot 
   */
  initialize(bot = null) {
    if (this._destroyed) {
      throw new Error('Cannot initialize destroyed AgentBrain');
    }

    this.attachBot(bot);
    this.state.transitionTo(AgentState.STATES.IDLE, 'Brain initialized');
    this.eventBus.emit(EventBus.EVENTS.BRAIN_INITIALIZED, {
      timestamp: Date.now(),
      mode: this.state.mode
    });

    this.logger.log('system', {
      message: `Brain initialized in ${this.state.mode} mode`,
      mode: this.state.mode
    });

    return this;
  }

  /**
   * Attach or replace active bot instance
   * @param {object|null} bot 
   */
  attachBot(bot) {
    this.bot = bot;
    if (bot) {
      this.perceptionManager.initialize(bot, this.eventBus);
      if (this._isRunning && !this._isPaused) {
        this.perceptionManager.start();
      }
    } else {
      this.detachBot();
    }
  }

  /**
   * Detach active bot instance (e.g. on disconnect)
   */
  detachBot() {
    this.bot = null;
    this.perceptionManager.stop();
    this.worldState.observe(null);
  }

  /**
   * Start the brain decision loop
   * Guarded against duplicate start
   */
  start() {
    if (this._destroyed) {
      throw new Error('Cannot start destroyed AgentBrain');
    }

    if (this._isRunning) {
      return false; // Already running
    }

    this._isRunning = true;
    this._isPaused = false;
    this.state.transitionTo(AgentState.STATES.OBSERVING, 'Brain started');

    if (this.bot) {
      this.perceptionManager.start();
    }

    this.eventBus.emit(EventBus.EVENTS.BRAIN_STARTED, { timestamp: Date.now() });
    this.logger.log('system', { message: 'Brain loop started' });

    this._scheduleNextTick();
    return true;
  }

  /**
   * Pause brain execution loop
   */
  pause() {
    if (!this._isRunning || this._isPaused) return false;
    this._isPaused = true;
    this.perceptionManager.stop();
    this.state.transitionTo(AgentState.STATES.PAUSED, 'Brain paused');
    this.eventBus.emit(EventBus.EVENTS.BRAIN_PAUSED, { timestamp: Date.now() });
    this.logger.log('system', { message: 'Brain loop paused' });
    return true;
  }

  /**
   * Resume brain execution loop
   */
  resume() {
    if (!this._isRunning || !this._isPaused) return false;
    this._isPaused = false;
    if (this.bot) {
      this.perceptionManager.start();
    }
    this.state.transitionTo(AgentState.STATES.OBSERVING, 'Brain resumed');
    this.eventBus.emit(EventBus.EVENTS.BRAIN_RESUMED, { timestamp: Date.now() });
    this.logger.log('system', { message: 'Brain loop resumed' });
    return true;
  }

  /**
   * Stop the brain execution loop and clear timers
   */
  async stop() {
    if (!this._isRunning) return false;

    this._isRunning = false;
    this._isPaused = false;

    this.perceptionManager.stop();

    if (this._tickTimer) {
      clearTimeout(this._tickTimer);
      this._tickTimer = null;
    }

    try {
      await this.actionExecutor.cancelCurrentAction('Brain stopped');
    } catch (e) {
      // Safe cancellation
    }

    this.state.transitionTo(AgentState.STATES.STOPPED, 'Brain stopped');
    this.eventBus.emit(EventBus.EVENTS.BRAIN_STOPPED, { timestamp: Date.now() });
    this.logger.log('system', { message: 'Brain loop stopped' });
    return true;
  }

  /**
   * Internal scheduler for controlled ticks (no overlapping ticks)
   * @private
   */
  _scheduleNextTick() {
    if (!this._isRunning || this._destroyed) return;

    this._tickTimer = setTimeout(async () => {
      if (!this._isRunning || this._destroyed) return;
      try {
        await this.tick();
      } catch (err) {
        this.state.recordError(err);
        this.eventBus.emit(EventBus.EVENTS.ERROR, {
          source: 'BrainTick',
          error: err.message,
          timestamp: Date.now()
        });
      } finally {
        this._scheduleNextTick();
      }
    }, this.options.tickIntervalMs);

    if (this._tickTimer.unref) {
      this._tickTimer.unref();
    }
  }

  /**
   * Single brain cycle tick
   */
  async tick() {
    if (this._destroyed || !this._isRunning || this._isPaused) {
      return;
    }

    if (this._isTicking) {
      return; // Skip if previous tick is still processing
    }

    this._isTicking = true;

    try {
      // 1. Observe world state
      this.worldState.observe(this.bot);

      // 2. Fetch active and queued objectives
      const activeGoal = this.goalManager.getActiveGoal();
      let activeTask = this.taskManager.getActiveTask();
      let nextRunnableTask = !activeTask ? this.taskManager.getNextRunnableTask() : null;

      // 3. Evaluate Survival override
      const survivalResult = this.survivalEngine.evaluate(this.worldState, activeTask || nextRunnableTask);
      let isSurvivalOverride = false;
      
      if (survivalResult.survivalTask) {
        // Survival task overrides current tasks
        activeTask = survivalResult.survivalTask;
        nextRunnableTask = null;
        isSurvivalOverride = true;
      }

      // Update state mirror
      this.state.setCurrentGoal(activeGoal);
      this.state.setCurrentTask(activeTask || nextRunnableTask);

      // 4. Ask DecisionEngine for decision
      const decision = this.decisionEngine.decide({
        state: this.state,
        goal: activeGoal,
        task: activeTask,
        nextRunnableTask,
        worldState: this.worldState,
        actionRegistry: this.actionRegistry,
        currentAction: this.actionExecutor.currentAction,
        isSurvivalOverride
      });

      this.state.setDecision(decision);

      // 4. If action required, execute safely via ActionExecutor
      if (decision.selectedAction && decision.selectedAction !== 'IDLE') {
        if (!this.actionExecutor.isBusy() || this.actionExecutor.currentAction?.id !== decision.selectedAction) {
          this.state.transitionTo(AgentState.STATES.EXECUTING, `Executing ${decision.selectedAction}`);
          this.state.setCurrentAction({ id: decision.selectedAction, name: decision.selectedAction });

          const execResult = await this.actionExecutor.execute(decision.selectedAction, {
            bot: this.bot,
            state: this.state,
            worldState: this.worldState,
            task: activeTask
          });

          if (!execResult.success) {
            this.state.recordError(execResult.error);
          }
          this.state.clearCurrentAction();
        }
      } else {
        // IDLE state
        if (this.state.state !== AgentState.STATES.IDLE && this.state.state !== AgentState.STATES.PAUSED) {
          this.state.transitionTo(AgentState.STATES.IDLE, decision.reason);
        }
      }
    } finally {
      this._isTicking = false;
    }
  }

  /**
   * Change agent operational mode safely
   * @param {string} nextMode 
   */
  setMode(nextMode) {
    const changed = this.state.setMode(nextMode);
    if (changed) {
      this.logger.log('mode', {
        message: `Mode switched to ${nextMode}`,
        mode: nextMode
      });
    }
    return changed;
  }

  /**
   * Completely destroy brain instance and cleanup all resources
   */
  async destroy() {
    this._destroyed = true;
    await this.stop();

    this.logger.detach();
    this.eventBus.destroy();
    this.goalManager.clear();
    this.taskManager.clear();
    this.perceptionManager.destroy();
    this.detachBot();
  }
}

module.exports = AgentBrain;
