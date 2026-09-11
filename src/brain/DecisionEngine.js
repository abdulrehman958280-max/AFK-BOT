const crypto = require('crypto');
const AgentState = require('./AgentState');
const Task = require('../tasks/Task');
const EventBus = require('./EventBus');

/**
 * DecisionEngine
 * Evaluates state, goals, tasks, and perception to determine the next agent action.
 * Exposes transparent, technical decision reasons without pseudo-sentient jargon.
 */
class DecisionEngine {
  constructor(eventBus = null) {
    this.eventBus = eventBus;
  }

  /**
   * Evaluate the current cycle and return a structured Decision
   * @param {object} context
   * @param {AgentState} context.state
   * @param {object|null} context.goal
   * @param {Task|null} context.task
   * @param {Task|null} context.nextRunnableTask
   * @param {object} context.worldState
   * @param {object} context.actionRegistry
   * @param {object|null} context.currentAction
   * @returns {object} Decision object
   */
  decide(context = {}) {
    const {
      state,
      goal = null,
      task = null,
      nextRunnableTask = null,
      worldState = {},
      actionRegistry = null,
      currentAction = null
    } = context;

    const mode = state?.mode || AgentState.MODES.AFK;
    const isBotConnected = Boolean(worldState?.connected && worldState?.spawned);

    let selectedAction = 'IDLE';
    let reason = 'Default idle state';
    let confidence = 1.0;
    const decisionContext = {
      mode,
      connected: isBotConnected,
      hasActiveGoal: Boolean(goal),
      hasActiveTask: Boolean(task),
      hasNextTask: Boolean(nextRunnableTask)
    };

    // Branch by operating mode
    if (mode === AgentState.MODES.AFK) {
      selectedAction = 'IDLE';
      reason = 'AFK mode active: external AFK routines maintain server presence.';
      confidence = 1.0;
    } else if (mode === AgentState.MODES.MANUAL) {
      if (task && task.status === Task.STATUSES.RUNNING) {
        // Manual mode with an assigned task
        const actionEvaluation = this._evaluateTask(task, actionRegistry);
        selectedAction = actionEvaluation.action;
        reason = `Manual task active: ${actionEvaluation.reason}`;
        confidence = actionEvaluation.confidence;
      } else {
        selectedAction = 'IDLE';
        reason = 'Manual mode active: standing by for operator instruction or task.';
        confidence = 1.0;
      }
    } else if (mode === AgentState.MODES.AUTONOMOUS) {
      if (!isBotConnected) {
        selectedAction = 'IDLE';
        reason = 'Bot is disconnected or not yet spawned in the Minecraft world; waiting for connection.';
        confidence = 1.0;
      } else if (task && task.status === Task.STATUSES.RUNNING) {
        const actionEvaluation = this._evaluateTask(task, actionRegistry);
        selectedAction = actionEvaluation.action;
        reason = actionEvaluation.reason;
        confidence = actionEvaluation.confidence;
      } else if (nextRunnableTask) {
        selectedAction = 'IDLE';
        reason = `Pending task "${nextRunnableTask.name}" ready in queue. Ready for execution.`;
        confidence = 0.95;
      } else if (goal && goal.status === 'ACTIVE') {
        selectedAction = 'IDLE';
        reason = `Active goal "${goal.name}" set, but no actionable tasks are currently queued.`;
        confidence = 0.9;
      } else {
        selectedAction = 'IDLE';
        reason = 'No active task in queue; standing by in autonomous standby.';
        confidence = 1.0;
      }
    }

    const decision = {
      id: `dec_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: Date.now(),
      goalId: goal?.id || null,
      taskId: task?.id || null,
      selectedAction,
      reason,
      confidence,
      context: decisionContext
    };

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.DECISION_MADE, decision);
    }

    return decision;
  }

  /**
   * Evaluate task against available actions
   * @private
   */
  _evaluateTask(task, actionRegistry) {
    const taskNameLower = (task.name || '').toLowerCase();
    const taskMeta = task.metadata || {};

    // Check if task explicitly requests an action that is registered
    const requestedAction = (taskMeta.action || '').toUpperCase();
    if (requestedAction && actionRegistry && actionRegistry.has(requestedAction)) {
      return {
        action: requestedAction,
        reason: `Task explicitly assigned registered action: ${requestedAction}`,
        confidence: 1.0
      };
    }

    // Check for safe foundational actions
    if (taskNameLower.includes('stop') || taskNameLower.includes('halt')) {
      return {
        action: 'STOP',
        reason: 'Task requests stopping bot movement and clearing controls.',
        confidence: 1.0
      };
    }

    if (taskNameLower.includes('pause') || taskNameLower.includes('wait') || taskNameLower.includes('standby')) {
      return {
        action: 'PAUSE',
        reason: 'Task requests pausing operations and holding position.',
        confidence: 1.0
      };
    }

    if (taskNameLower.includes('idle')) {
      return {
        action: 'IDLE',
        reason: 'Task specifies idle standby routine.',
        confidence: 1.0
      };
    }

    // For any future action (explore, mine, craft, combat, etc.)
    return {
      action: 'IDLE',
      reason: `Action required for task "${task.name}" is not implemented in Phase 1 (Autonomous Brain Foundation). Holding safely in idle.`,
      confidence: 1.0
    };
  }
}

module.exports = DecisionEngine;
