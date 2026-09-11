const SurvivalState = require('./SurvivalState');
const SurvivalPriorityEngine = require('./SurvivalPriorityEngine');
const SurvivalTaskPlanner = require('./SurvivalTaskPlanner');
const SafetyManager = require('./SafetyManager');

/**
 * SurvivalEngine
 * Core entry point for the Phase 3 Survival Subsystem.
 */
class SurvivalEngine {
  constructor(eventBus = null) {
    this.eventBus = eventBus;
    this.currentSurvivalState = null;
    this.currentPriorities = [];
    this.highestPriority = null;
    this.activeSurvivalTask = null;
  }

  /**
   * Evaluate the survival state and determine the top priority goal/task.
   * @param {object} worldState The read-only world state snapshot
   * @param {object} currentTask The current active task (user task or otherwise)
   * @returns {object} The evaluation result { state, priorities, highestPriority, survivalTask }
   */
  evaluate(worldState, currentTask = null) {
    this.currentSurvivalState = SurvivalState.evaluate(worldState);
    this.currentPriorities = SurvivalPriorityEngine.getPriorities(this.currentSurvivalState, currentTask);
    this.highestPriority = SurvivalPriorityEngine.evaluate(this.currentSurvivalState, currentTask);

    // If the top priority is not USER_TASK, we need to generate/continue a survival task
    if (this.highestPriority.goal !== SurvivalPriorityEngine.GOALS.USER_TASK) {
      if (!this.activeSurvivalTask || this.activeSurvivalTask.metadata.goal !== this.highestPriority.goal) {
        this.activeSurvivalTask = SurvivalTaskPlanner.plan(this.highestPriority.goal, this.currentSurvivalState);
      }
    } else {
      this.activeSurvivalTask = null;
    }

    if (this.eventBus) {
      this.eventBus.emit('SURVIVAL_EVALUATED', {
        state: this.currentSurvivalState,
        highestPriority: this.highestPriority,
        activeSurvivalTask: this.activeSurvivalTask
      });
    }

    return {
      state: this.currentSurvivalState,
      priorities: this.currentPriorities,
      highestPriority: this.highestPriority,
      survivalTask: this.activeSurvivalTask
    };
  }
}

module.exports = SurvivalEngine;
