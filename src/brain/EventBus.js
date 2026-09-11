const { EventEmitter } = require('events');

/**
 * EventBus
 * Centralized, reliable event emitter for decoupled brain components.
 * Catches listener exceptions to prevent one failing listener from crashing the process.
 */
class EventBus extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxListeners = options.maxListeners || 50;
    this.setMaxListeners(this.maxListeners);
    this._active = true;
  }

  /**
   * Safely emit an event, isolating listener errors
   * @param {string} eventName 
   * @param {...any} args 
   * @returns {boolean}
   */
  emit(eventName, ...args) {
    if (!this._active) return false;

    const listeners = this.rawListeners(eventName);
    if (listeners.length === 0) return false;

    for (const listener of listeners) {
      try {
        listener.apply(this, args);
      } catch (err) {
        // Prevent recursive agent:error loops
        if (eventName !== 'agent:error') {
          this.emit('agent:error', {
            source: 'EventBus',
            targetEvent: eventName,
            error: err.message,
            timestamp: Date.now()
          });
        }
      }
    }
    return true;
  }

  /**
   * Destroy the event bus and clear all listeners
   */
  destroy() {
    this._active = false;
    this.removeAllListeners();
  }
}

// Canonical event name constants
EventBus.EVENTS = Object.freeze({
  STATE_CHANGED: 'agent:stateChanged',
  MODE_CHANGED: 'agent:modeChanged',
  GOAL_CHANGED: 'agent:goalChanged',
  TASK_CREATED: 'agent:taskCreated',
  TASK_STARTED: 'agent:taskStarted',
  TASK_UPDATED: 'agent:taskUpdated',
  TASK_COMPLETED: 'agent:taskCompleted',
  TASK_FAILED: 'agent:taskFailed',
  TASK_CANCELLED: 'agent:taskCancelled',
  ACTION_STARTED: 'agent:actionStarted',
  ACTION_COMPLETED: 'agent:actionCompleted',
  ACTION_FAILED: 'agent:actionFailed',
  DECISION_MADE: 'agent:decisionMade',
  ERROR: 'agent:error',
  BRAIN_INITIALIZED: 'brain:initialized',
  BRAIN_STARTED: 'brain:started',
  BRAIN_PAUSED: 'brain:paused',
  BRAIN_RESUMED: 'brain:resumed',
  BRAIN_STOPPED: 'brain:stopped',
  WORLD_UPDATED: 'world:updated',
  PLAYER_UPDATED: 'player:updated',
  INVENTORY_UPDATED: 'inventory:updated',
  ENVIRONMENT_UPDATED: 'environment:updated',
  ENTITIES_UPDATED: 'entities:updated',
  THREATS_UPDATED: 'threats:updated',
  BLOCKS_UPDATED: 'blocks:updated',
  THREAT_LEVEL_CHANGED: 'threat:levelChanged'
});

module.exports = EventBus;
