const EventBus = require('../brain/EventBus');

/**
 * BrainLogger
 * In-memory, bounded telemetry ring buffer for agent observability.
 * Exposes real-time event logs for the web UI and API without leaking memory.
 */
class BrainLogger {
  constructor(options = {}) {
    this.maxEvents = options.maxEvents || 300;
    this.events = [];
    this._eventBusListeners = [];
  }

  /**
   * Log a structured telemetry event
   * @param {string} type - 'decision' | 'action' | 'task' | 'goal' | 'state' | 'error' | 'system'
   * @param {object} data
   * @returns {object} The logged entry
   */
  log(type, data = {}) {
    const entry = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      type,
      ...data
    };

    this.events.push(entry);

    // Keep bounded within maxEvents
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }

    return entry;
  }

  /**
   * Connect automatically to an EventBus to mirror events
   * @param {EventBus} eventBus 
   */
  attach(eventBus) {
    if (!eventBus) return;
    this.detach(); // remove existing first

    const wire = (eventName, type, dataExtractor) => {
      const listener = (payload) => {
        const data = typeof dataExtractor === 'function' ? dataExtractor(payload) : (payload || {});
        this.log(type, data);
      };
      eventBus.on(eventName, listener);
      this._eventBusListeners.push({ eventBus, eventName, listener });
    };

    wire(EventBus.EVENTS.STATE_CHANGED, 'state', (p) => ({
      message: `State changed from ${p.previousState} to ${p.currentState}`,
      previousState: p.previousState,
      currentState: p.currentState,
      reason: p.reason
    }));

    wire(EventBus.EVENTS.MODE_CHANGED, 'mode', (p) => ({
      message: `Mode changed from ${p.previousMode} to ${p.currentMode}`,
      previousMode: p.previousMode,
      currentMode: p.currentMode
    }));

    wire(EventBus.EVENTS.GOAL_CHANGED, 'goal', (p) => ({
      message: `Goal ${p.action}: "${p.goal?.name || 'Unknown'}" [${p.goal?.status}]`,
      goal: p.goal,
      action: p.action
    }));

    wire(EventBus.EVENTS.TASK_CREATED, 'task', (p) => ({
      message: `Task created: "${p.task?.name}" (Priority ${p.task?.priority})`,
      task: p.task
    }));

    wire(EventBus.EVENTS.TASK_STARTED, 'task', (p) => ({
      message: `Task started: "${p.task?.name}"`,
      task: p.task
    }));

    wire(EventBus.EVENTS.TASK_UPDATED, 'task', (p) => ({
      message: `Task updated: "${p.task?.name}" (${p.action})`,
      task: p.task,
      action: p.action
    }));

    wire(EventBus.EVENTS.TASK_COMPLETED, 'task', (p) => ({
      message: `Task completed: "${p.task?.name}"`,
      task: p.task,
      result: p.result
    }));

    wire(EventBus.EVENTS.TASK_FAILED, 'task', (p) => ({
      message: `Task failed: "${p.task?.name}" - ${p.error}`,
      task: p.task,
      error: p.error
    }));

    wire(EventBus.EVENTS.TASK_CANCELLED, 'task', (p) => ({
      message: `Task cancelled: "${p.task?.name}" - ${p.reason}`,
      task: p.task,
      reason: p.reason
    }));

    wire(EventBus.EVENTS.ACTION_STARTED, 'action', (p) => ({
      message: `Action started: ${p.action}`,
      action: p.action
    }));

    wire(EventBus.EVENTS.ACTION_COMPLETED, 'action', (p) => ({
      message: `Action completed: ${p.action} (${p.duration}ms)`,
      action: p.action,
      duration: p.duration
    }));

    wire(EventBus.EVENTS.ACTION_FAILED, 'action', (p) => ({
      message: `Action failed: ${p.action} - ${p.error}`,
      action: p.action,
      error: p.error
    }));

    wire(EventBus.EVENTS.DECISION_MADE, 'decision', (p) => ({
      message: `Decision: ${p.selectedAction} - ${p.reason}`,
      decision: p
    }));

    wire(EventBus.EVENTS.ERROR, 'error', (p) => ({
      message: `Error: ${p.error || p.message}`,
      error: p
    }));
  }

  /**
   * Detach all listeners from eventBus
   */
  detach() {
    for (const { eventBus, eventName, listener } of this._eventBusListeners) {
      try {
        eventBus.removeListener(eventName, listener);
      } catch (e) {
        // ignore
      }
    }
    this._eventBusListeners = [];
  }

  /**
   * Get recent events (newest first)
   * @param {number} [limit=100] 
   * @param {string|null} [filterType] 
   * @returns {Array}
   */
  getEvents(limit = 100, filterType = null) {
    let list = this.events;
    if (filterType) {
      list = list.filter(e => e.type === filterType);
    }
    const safeLimit = Math.min(Math.max(1, limit), this.maxEvents);
    return list.slice(-safeLimit).reverse();
  }

  /**
   * Clear all stored events
   */
  clear() {
    this.events = [];
  }

  /**
   * Get total events count
   */
  size() {
    return this.events.length;
  }
}

module.exports = BrainLogger;
