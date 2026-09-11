const crypto = require('crypto');
const EventBus = require('./EventBus');

/**
 * GoalManager
 * Manages high-level agent goals, prioritization, and status lifecycle.
 */
class GoalManager {
  constructor(eventBus = null) {
    this.eventBus = eventBus;
    this.goals = new Map();
    this.activeGoalId = null;
  }

  /**
   * Create a new goal
   * @param {object} params
   * @param {string} params.name
   * @param {string} [params.description]
   * @param {number} [params.priority]
   * @param {object} [params.metadata]
   * @returns {object} The created goal
   */
  createGoal({ name, description = '', priority = 5, metadata = {} } = {}) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Goal name is required and must be a non-empty string');
    }

    const safePriority = Number.isFinite(priority) ? Math.max(1, Math.min(100, Math.round(priority))) : 5;
    const id = `goal_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const goal = {
      id,
      name: name.trim().slice(0, 100),
      description: typeof description === 'string' ? description.trim().slice(0, 250) : '',
      priority: safePriority,
      status: GoalManager.STATUSES.PENDING,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      metadata: typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata) ? { ...metadata } : {}
    };

    this.goals.set(id, goal);

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.GOAL_CHANGED, {
        action: 'created',
        goal: { ...goal }
      });
    }

    return { ...goal };
  }

  /**
   * Set active goal by ID
   * @param {string} id 
   * @returns {object}
   */
  setActiveGoal(id) {
    const goal = this.goals.get(id);
    if (!goal) {
      throw new Error(`Goal with ID "${id}" not found`);
    }

    if (goal.status === GoalManager.STATUSES.COMPLETED || goal.status === GoalManager.STATUSES.CANCELLED) {
      throw new Error(`Cannot activate goal in terminal state: ${goal.status}`);
    }

    // If another goal is active, set it to PAUSED
    if (this.activeGoalId && this.activeGoalId !== id) {
      const current = this.goals.get(this.activeGoalId);
      if (current && current.status === GoalManager.STATUSES.ACTIVE) {
        current.status = GoalManager.STATUSES.PAUSED;
      }
    }

    this.activeGoalId = id;
    goal.status = GoalManager.STATUSES.ACTIVE;
    if (!goal.startedAt) {
      goal.startedAt = Date.now();
    }

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.GOAL_CHANGED, {
        action: 'activated',
        goal: { ...goal }
      });
    }

    return { ...goal };
  }

  /**
   * Get the currently active goal
   * @returns {object|null}
   */
  getActiveGoal() {
    if (!this.activeGoalId) return null;
    const goal = this.goals.get(this.activeGoalId);
    return goal ? { ...goal } : null;
  }

  /**
   * Pause goal
   * @param {string} id 
   */
  pauseGoal(id) {
    const goal = this.goals.get(id);
    if (!goal) throw new Error(`Goal "${id}" not found`);
    if (goal.status !== GoalManager.STATUSES.ACTIVE) {
      throw new Error(`Cannot pause goal with status: ${goal.status}`);
    }

    goal.status = GoalManager.STATUSES.PAUSED;
    if (this.activeGoalId === id) {
      this.activeGoalId = null;
    }

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.GOAL_CHANGED, {
        action: 'paused',
        goal: { ...goal }
      });
    }
    return { ...goal };
  }

  /**
   * Resume goal
   * @param {string} id 
   */
  resumeGoal(id) {
    return this.setActiveGoal(id);
  }

  /**
   * Complete goal
   * @param {string} id 
   * @param {any} [result] 
   */
  completeGoal(id, result = null) {
    const goal = this.goals.get(id);
    if (!goal) throw new Error(`Goal "${id}" not found`);

    goal.status = GoalManager.STATUSES.COMPLETED;
    goal.completedAt = Date.now();
    if (result) goal.metadata.result = result;

    if (this.activeGoalId === id) {
      this.activeGoalId = null;
    }

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.GOAL_CHANGED, {
        action: 'completed',
        goal: { ...goal }
      });
    }
    return { ...goal };
  }

  /**
   * Fail goal
   * @param {string} id 
   * @param {string} error 
   */
  failGoal(id, error = 'Unknown failure') {
    const goal = this.goals.get(id);
    if (!goal) throw new Error(`Goal "${id}" not found`);

    goal.status = GoalManager.STATUSES.FAILED;
    goal.completedAt = Date.now();
    goal.metadata.error = error;

    if (this.activeGoalId === id) {
      this.activeGoalId = null;
    }

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.GOAL_CHANGED, {
        action: 'failed',
        goal: { ...goal }
      });
    }
    return { ...goal };
  }

  /**
   * Cancel goal
   * @param {string} id 
   * @param {string} [reason] 
   */
  cancelGoal(id, reason = 'User cancelled') {
    const goal = this.goals.get(id);
    if (!goal) throw new Error(`Goal "${id}" not found`);

    goal.status = GoalManager.STATUSES.CANCELLED;
    goal.completedAt = Date.now();
    goal.metadata.cancelReason = reason;

    if (this.activeGoalId === id) {
      this.activeGoalId = null;
    }

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.GOAL_CHANGED, {
        action: 'cancelled',
        goal: { ...goal }
      });
    }
    return { ...goal };
  }

  /**
   * Get goal by ID
   * @param {string} id 
   */
  getGoal(id) {
    const goal = this.goals.get(id);
    return goal ? { ...goal } : null;
  }

  /**
   * Get all goals sorted by priority (descending)
   */
  getAllGoals() {
    return Array.from(this.goals.values())
      .map(g => ({ ...g }))
      .sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
  }

  /**
   * Clear all goals
   */
  clear() {
    this.goals.clear();
    this.activeGoalId = null;
  }
}

GoalManager.STATUSES = Object.freeze({
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
});

module.exports = GoalManager;
