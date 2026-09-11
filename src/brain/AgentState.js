const EventBus = require('./EventBus');

/**
 * AgentState
 * Centralized, observable state for the autonomous agent.
 */
class AgentState {
  constructor(eventBus = null, initialMode = AgentState.MODES.AFK) {
    this.eventBus = eventBus;

    this.state = AgentState.STATES.STOPPED;
    this.mode = initialMode;
    this.currentGoal = null;
    this.currentTask = null;
    this.currentAction = null;
    this.previousAction = null;
    this.lastDecision = null;
    this.decisionReason = 'Agent initialized';
    this.processHealth = 'healthy';
    this.taskProgress = 0;
    this.lastError = null;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.lastStateChange = Date.now();
  }

  /**
   * Safe state transition with validation
   * @param {string} nextState 
   * @param {string} [reason] 
   * @returns {boolean}
   */
  transitionTo(nextState, reason = '') {
    if (!AgentState.VALID_STATES.has(nextState)) {
      throw new Error(`Invalid state transition to: "${nextState}"`);
    }

    if (this.state === nextState) {
      return false;
    }

    const prevState = this.state;
    this.state = nextState;
    this.lastStateChange = Date.now();
    this.lastActivity = Date.now();

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.STATE_CHANGED, {
        previousState: prevState,
        currentState: nextState,
        reason: reason || this.decisionReason,
        timestamp: this.lastStateChange
      });
    }

    return true;
  }

  /**
   * Set agent operational mode
   * @param {string} nextMode 
   * @returns {boolean}
   */
  setMode(nextMode) {
    if (!AgentState.VALID_MODES.has(nextMode)) {
      throw new Error(`Invalid mode: "${nextMode}". Allowed: ${Array.from(AgentState.VALID_MODES).join(', ')}`);
    }

    if (this.mode === nextMode) {
      return false;
    }

    const prevMode = this.mode;
    this.mode = nextMode;
    this.lastActivity = Date.now();

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.MODE_CHANGED, {
        previousMode: prevMode,
        currentMode: nextMode,
        timestamp: Date.now()
      });
    }

    return true;
  }

  /**
   * Set current goal
   * @param {object|null} goal 
   */
  setCurrentGoal(goal) {
    this.currentGoal = goal ? {
      id: goal.id,
      name: goal.name,
      status: goal.status,
      priority: goal.priority
    } : null;
    this.lastActivity = Date.now();
  }

  /**
   * Set current task
   * @param {object|null} task 
   */
  setCurrentTask(task) {
    this.currentTask = task ? {
      id: task.id,
      name: task.name,
      status: task.status,
      priority: task.priority,
      progress: task.progress || 0
    } : null;
    this.taskProgress = task ? (task.progress || 0) : 0;
    this.lastActivity = Date.now();
  }

  /**
   * Update task progress
   * @param {number} progress 
   */
  setTaskProgress(progress) {
    this.taskProgress = Math.max(0, Math.min(100, Math.round(progress)));
    if (this.currentTask) {
      this.currentTask.progress = this.taskProgress;
    }
    this.lastActivity = Date.now();
  }

  /**
   * Record action started
   * @param {object} action 
   */
  setCurrentAction(action) {
    if (this.currentAction) {
      this.previousAction = { ...this.currentAction };
    }
    this.currentAction = action ? {
      id: action.id,
      name: action.name,
      startedAt: Date.now()
    } : null;
    this.lastActivity = Date.now();
  }

  /**
   * Clear current action
   */
  clearCurrentAction() {
    if (this.currentAction) {
      this.previousAction = { ...this.currentAction, endedAt: Date.now() };
    }
    this.currentAction = null;
    this.lastActivity = Date.now();
  }

  /**
   * Record decision from DecisionEngine
   * @param {object} decision 
   */
  setDecision(decision) {
    this.lastDecision = decision;
    this.decisionReason = decision ? decision.reason : 'No decision recorded';
    this.lastActivity = Date.now();
  }

  /**
   * Record error safely
   * @param {string|Error} err 
   */
  recordError(err) {
    const errorMsg = typeof err === 'string' ? err : (err && err.message ? err.message : String(err));
    this.lastError = {
      message: errorMsg,
      timestamp: Date.now()
    };
    this.processHealth = 'degraded';
    this.lastActivity = Date.now();
  }

  /**
   * Clear error state
   */
  clearError() {
    this.lastError = null;
    this.processHealth = 'healthy';
  }

  /**
   * Export sanitized snapshot for API/UI
   */
  toJSON() {
    return {
      state: this.state,
      mode: this.mode,
      currentGoal: this.currentGoal,
      currentTask: this.currentTask,
      currentAction: this.currentAction,
      previousAction: this.previousAction,
      decision: this.lastDecision,
      decisionReason: this.decisionReason,
      processHealth: this.processHealth,
      taskProgress: this.taskProgress,
      lastError: this.lastError,
      lastActivity: this.lastActivity,
      lastStateChange: this.lastStateChange,
      uptime: Math.floor((Date.now() - this.createdAt) / 1000)
    };
  }
}

// Lifecycle States
AgentState.STATES = Object.freeze({
  IDLE: 'IDLE',
  OBSERVING: 'OBSERVING',
  PLANNING: 'PLANNING',
  EXECUTING: 'EXECUTING',
  PAUSED: 'PAUSED',
  RECOVERING: 'RECOVERING',
  ERROR: 'ERROR',
  STOPPED: 'STOPPED'
});

AgentState.VALID_STATES = new Set(Object.values(AgentState.STATES));

// Operational Modes
AgentState.MODES = Object.freeze({
  AFK: 'AFK',
  AUTONOMOUS: 'AUTONOMOUS',
  MANUAL: 'MANUAL'
});

AgentState.VALID_MODES = new Set(Object.values(AgentState.MODES));

module.exports = AgentState;
