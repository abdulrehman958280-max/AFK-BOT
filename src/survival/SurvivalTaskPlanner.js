const Task = require('../tasks/Task');
const SurvivalPriorityEngine = require('./SurvivalPriorityEngine');

/**
 * SurvivalTaskPlanner
 * Converts high-level survival goals into executable tasks.
 */
class SurvivalTaskPlanner {
  /**
   * Generates a task based on the survival goal
   * @param {string} goal The survival goal from SurvivalPriorityEngine.GOALS
   * @param {object} survivalState Current survival state
   * @returns {Task|null} The generated task, or null if no task is needed
   */
  static plan(goal, survivalState) {
    switch (goal) {
      case SurvivalPriorityEngine.GOALS.ESCAPE_DANGER:
        return new Task({ name: 'Escape Danger', metadata: { action: 'ESCAPE' }, priority: 100 });
      case SurvivalPriorityEngine.GOALS.FIND_SAFETY:
        return new Task({ name: 'Find Safe Location', metadata: { action: 'FIND_SAFE_LOCATION' }, priority: 95 });
      case SurvivalPriorityEngine.GOALS.EAT:
        return new Task({ name: 'Eat Food', metadata: { action: 'EAT' }, priority: 85 });
      case SurvivalPriorityEngine.GOALS.RECOVER_HEALTH:
        // Wait/hide to recover health
        return new Task({ name: 'Recover Health', metadata: { action: 'RECOVER' }, priority: 90 });
      case SurvivalPriorityEngine.GOALS.FIND_FOOD:
        // Need to hunt or gather food
        return new Task({ name: 'Find Food', metadata: { action: 'FIND_FOOD' }, priority: 85 });
      case SurvivalPriorityEngine.GOALS.GATHER_WOOD:
        return new Task({ name: 'Gather Wood', metadata: { action: 'GATHER_WOOD' }, priority: 35 });
      case SurvivalPriorityEngine.GOALS.GATHER_STONE:
        return new Task({ name: 'Gather Stone', metadata: { action: 'GATHER_STONE' }, priority: 25 });
      case SurvivalPriorityEngine.GOALS.CRAFT_BASIC_TOOLS:
        return new Task({ name: 'Craft Basic Tools', metadata: { action: 'CRAFT', recipe: 'basic_tools' }, priority: 30 });
      case SurvivalPriorityEngine.GOALS.PREPARE_FOR_NIGHT:
        return new Task({ name: 'Prepare for Night', metadata: { action: 'FIND_SAFE_LOCATION' }, priority: 40 });
      case SurvivalPriorityEngine.GOALS.USER_TASK:
      default:
        return null;
    }
  }
}

module.exports = SurvivalTaskPlanner;
