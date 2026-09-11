const { Action } = require('./Action');
const NavigationPlanner = require('../navigation/NavigationPlanner');

class ExploreAction extends Action {
  constructor() {
    super({ id: 'EXPLORE', name: 'Explore', description: 'Navigate to an unexplored area.' });
  }

  async execute(context = {}) {
    const { bot, task } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    
    const target = task?.metadata?.target;
    if (!target) return { success: false, error: 'No target specified' };

    const nav = new NavigationPlanner(bot);
    return nav.navigateTo(target.x, null, target.z);
  }
}

class VisitWaypointAction extends Action {
  constructor() {
    super({ id: 'VISIT_WAYPOINT', name: 'Visit Waypoint', description: 'Navigate to a saved waypoint.' });
  }

  async execute(context = {}) {
    const { bot, task } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    
    const wp = task?.metadata?.waypoint;
    if (!wp) return { success: false, error: 'No waypoint specified' };

    const nav = new NavigationPlanner(bot);
    return nav.navigateTo(wp.x, wp.y, wp.z, 2);
  }
}

module.exports = {
  ExploreAction,
  VisitWaypointAction
};
