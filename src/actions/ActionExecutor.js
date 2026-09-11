const EventBus = require('../brain/EventBus');

/**
 * ActionExecutor
 * Executes actions, enforces single-action concurrency, handles timeouts & safe cancellation.
 */
class ActionExecutor {
  constructor(registry, eventBus = null, options = {}) {
    if (!registry) throw new Error('ActionRegistry is required for ActionExecutor');
    this.registry = registry;
    this.eventBus = eventBus;
    this.defaultTimeoutMs = options.defaultTimeoutMs || 30000;

    this.currentAction = null;
    this._activeExecution = null;
    this._abortController = null;
  }

  /**
   * Check if an action is currently executing
   * @returns {boolean}
   */
  isBusy() {
    return this.currentAction !== null;
  }

  /**
   * Execute an action by ID or Action instance
   * @param {string|Action} actionOrId 
   * @param {object} context 
   * @returns {Promise<{ success: boolean, result?: any, error?: string }>}
   */
  async execute(actionOrId, context = {}) {
    const action = typeof actionOrId === 'string' ? this.registry.get(actionOrId) : actionOrId;

    if (!action) {
      const errorMsg = `Action "${actionOrId}" not found in registry`;
      this._emitFailed(actionOrId, errorMsg, 0);
      return { success: false, error: errorMsg };
    }

    // Single-action concurrency: cancel currently executing action if conflicting
    if (this.currentAction && this.currentAction.id !== action.id) {
      await this.cancelCurrentAction(`Preempted by action: ${action.id}`);
    }

    // Validate execution prerequisites
    let canExec = true;
    let reason = '';
    try {
      const canExecResult = action.canExecute(context);
      if (typeof canExecResult === 'object' && canExecResult !== null) {
        canExec = Boolean(canExecResult.canExecute);
        reason = canExecResult.reason || '';
      } else {
        canExec = Boolean(canExecResult);
      }
    } catch (err) {
      canExec = false;
      reason = `Validation threw error: ${err.message}`;
    }

    if (!canExec) {
      const errorMsg = `Action "${action.id}" cannot execute: ${reason || 'Prerequisites not met'}`;
      this._emitFailed(action, errorMsg, 0);
      return { success: false, error: errorMsg };
    }

    const startTime = Date.now();
    this.currentAction = action;
    this._abortController = new AbortController();

    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.ACTION_STARTED, {
        action: action.id,
        name: action.name,
        timestamp: startTime
      });
    }

    try {
      // Execute with timeout race
      const timeoutPromise = new Promise((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Action "${action.id}" timed out after ${this.defaultTimeoutMs}ms`));
        }, this.defaultTimeoutMs);
        if (timer.unref) timer.unref();
      });

      const execPromise = action.execute({
        ...context,
        signal: this._abortController.signal
      });

      this._activeExecution = Promise.race([execPromise, timeoutPromise]);
      const result = await this._activeExecution;

      const duration = Date.now() - startTime;
      if (this.eventBus) {
        this.eventBus.emit(EventBus.EVENTS.ACTION_COMPLETED, {
          action: action.id,
          name: action.name,
          result: result?.result || result,
          duration,
          timestamp: Date.now()
        });
      }

      this.currentAction = null;
      this._activeExecution = null;
      this._abortController = null;

      return { success: true, result };
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMsg = err.message || 'Action execution failed';

      this._emitFailed(action, errorMsg, duration);

      this.currentAction = null;
      this._activeExecution = null;
      this._abortController = null;

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Cancel the currently executing action
   * @param {string} reason 
   */
  async cancelCurrentAction(reason = 'Cancelled by system') {
    if (!this.currentAction) return;

    const action = this.currentAction;
    if (this._abortController) {
      this._abortController.abort();
    }

    try {
      if (typeof action.cancel === 'function') {
        await action.cancel(reason);
      }
    } catch (err) {
      // Log or swallow cancellation errors safely
    }

    this.currentAction = null;
    this._activeExecution = null;
    this._abortController = null;
  }

  _emitFailed(action, errorMsg, duration) {
    if (this.eventBus) {
      this.eventBus.emit(EventBus.EVENTS.ACTION_FAILED, {
        action: typeof action === 'string' ? action : action.id,
        name: typeof action === 'string' ? action : action.name,
        error: errorMsg,
        duration,
        timestamp: Date.now()
      });
    }
  }
}

module.exports = ActionExecutor;
