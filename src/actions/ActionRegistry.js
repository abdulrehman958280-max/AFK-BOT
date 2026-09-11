const { Action, IdleAction, StopAction, PauseAction } = require('./Action');
const {
  EatAction,
  EscapeAction,
  FindSafeLocationAction,
  RecoverAction,
  GatherWoodAction,
  GatherStoneAction,
  CraftAction,
  FindFoodAction
} = require('./SurvivalActions');

/**
 * ActionRegistry
 * Central store for all actions available to the agent.
 */
class ActionRegistry {
  constructor() {
    this._actions = new Map();
    this._registerDefaults();
  }

  _registerDefaults() {
    this.register(new IdleAction());
    this.register(new StopAction());
    this.register(new PauseAction());
    
    // Survival Actions
    this.register(new EatAction());
    this.register(new EscapeAction());
    this.register(new FindSafeLocationAction());
    this.register(new RecoverAction());
    this.register(new GatherWoodAction());
    this.register(new GatherStoneAction());
    this.register(new CraftAction());
    this.register(new FindFoodAction());
  }

  /**
   * Register a new Action
   * @param {Action} action 
   */
  register(action) {
    if (!(action instanceof Action)) {
      throw new Error('Action must be an instance of Action class');
    }
    this._actions.set(action.id, action);
    return this;
  }

  /**
   * Unregister an action by ID
   * @param {string} id 
   * @returns {boolean}
   */
  unregister(id) {
    return this._actions.delete(id);
  }

  /**
   * Retrieve an action by ID
   * @param {string} id 
   * @returns {Action|null}
   */
  get(id) {
    return this._actions.get(id) || null;
  }

  /**
   * Check if action exists
   * @param {string} id 
   * @returns {boolean}
   */
  has(id) {
    return this._actions.has(id);
  }

  /**
   * List all registered actions
   * @returns {Array<{ id: string, name: string, description: string }>}
   */
  list() {
    return Array.from(this._actions.values()).map(a => ({
      id: a.id,
      name: a.name,
      description: a.description
    }));
  }

  /**
   * Clear registry and restore defaults
   */
  reset() {
    this._actions.clear();
    this._registerDefaults();
  }
}

module.exports = ActionRegistry;
