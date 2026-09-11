/**
 * Action Base Class
 * Abstract interface for all foundational and future survival actions.
 */
class Action {
  constructor({ id, name, description = '', metadata = {} }) {
    if (!id || typeof id !== 'string') {
      throw new Error('Action id is required and must be a string');
    }
    if (!name || typeof name !== 'string') {
      throw new Error('Action name is required and must be a string');
    }

    this.id = id;
    this.name = name;
    this.description = description;
    this.metadata = metadata;
  }

  /**
   * Determine if action can execute in the current context
   * @param {object} context - { bot, state, worldState, task }
   * @returns {boolean|{ canExecute: boolean, reason: string }}
   */
  canExecute(context = {}) {
    return true;
  }

  /**
   * Execute action logic
   * @param {object} context - { bot, state, worldState, task, signal }
   * @returns {Promise<{ success: boolean, result?: any }>}
   */
  async execute(context = {}) {
    return { success: true };
  }

  /**
   * Cancel ongoing action
   * @param {string} reason 
   * @returns {Promise<void>}
   */
  async cancel(reason = '') {
    // Override in subclasses if active handles or intervals need explicit cleanup
  }
}

/**
 * IdleAction
 * Safe foundational action for standing by or passive observation.
 */
class IdleAction extends Action {
  constructor() {
    super({
      id: 'IDLE',
      name: 'Idle Action',
      description: 'Passive standby state with zero active movements'
    });
  }

  canExecute(context) {
    return true;
  }

  async execute(context = {}) {
    // Foundational idle: clear any lingering control states if bot exists
    if (context.bot && typeof context.bot.clearControlStates === 'function') {
      context.bot.clearControlStates();
    }
    return { success: true, reason: 'Idle completed normally' };
  }
}

/**
 * StopAction
 * Halts all bot movement, pathfinding, and active controls.
 */
class StopAction extends Action {
  constructor() {
    super({
      id: 'STOP',
      name: 'Stop Action',
      description: 'Stops all active movement, clears control states, and stops pathfinder'
    });
  }

  canExecute(context) {
    return true;
  }

  async execute(context = {}) {
    const { bot } = context;
    if (bot) {
      if (typeof bot.clearControlStates === 'function') {
        bot.clearControlStates();
      }
      if (bot.pathfinder && typeof bot.pathfinder.stop === 'function') {
        bot.pathfinder.stop();
      }
    }
    return { success: true, message: 'Bot controls stopped' };
  }
}

/**
 * PauseAction
 * Safe stationary pause.
 */
class PauseAction extends Action {
  constructor() {
    super({
      id: 'PAUSE',
      name: 'Pause Action',
      description: 'Suspends active operations while maintaining situational awareness'
    });
  }

  canExecute(context) {
    return true;
  }

  async execute(context = {}) {
    const { bot } = context;
    if (bot && typeof bot.clearControlStates === 'function') {
      bot.clearControlStates();
    }
    return { success: true, message: 'Paused' };
  }
}

module.exports = {
  Action,
  IdleAction,
  StopAction,
  PauseAction
};
