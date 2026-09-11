const { Action } = require('./Action');

class EatAction extends Action {
  constructor() {
    super({ id: 'EAT', name: 'Eat', description: 'Consume food from inventory to restore hunger.' });
  }

  async execute(context = {}) {
    const { bot, worldState } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    
    // Find food in inventory
    const foodItems = bot.inventory.items().filter(item => 
      ['apple', 'bread', 'cooked_beef', 'cooked_porkchop', 'carrot', 'potato'].some(name => item.name.includes(name))
    );

    if (foodItems.length === 0) {
      return { success: false, error: 'No food in inventory' };
    }

    const food = foodItems[0];
    
    try {
      await bot.equip(food, 'hand');
      await bot.consume();
      return { success: true };
    } catch (e) {
      return { success: false, error: `Failed to eat: ${e.message}` };
    }
  }
}

class EscapeAction extends Action {
  constructor() {
    super({ id: 'ESCAPE', name: 'Escape', description: 'Run away from immediate threats.' });
  }

  async execute(context = {}) {
    const { bot, worldState } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    
    // Simplistic escape: try to run away from the closest hostile
    const threats = worldState?.threats;
    if (threats && threats.closestHostile && threats.closestHostile.position) {
      // Logic would be to pathfind away from threats.closestHostile
      // For now, we just simulate the goal setup
      // Phase 3 asks to "Use Pathfinder"
      try {
        const { goals } = require('mineflayer-pathfinder');
        const pos = threats.closestHostile.position;
        // Move opposite direction
        const dx = bot.entity.position.x - pos.x;
        const dz = bot.entity.position.z - pos.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist > 0) {
          const normX = dx / dist;
          const normZ = dz / dist;
          const targetX = bot.entity.position.x + normX * 10;
          const targetZ = bot.entity.position.z + normZ * 10;
          
          bot.pathfinder.setGoal(new goals.GoalNear(targetX, bot.entity.position.y, targetZ, 2));
        }
        return { success: true };
      } catch (e) {
        return { success: false, error: `Escape failed: ${e.message}` };
      }
    }

    return { success: false, error: 'No threat to escape from' };
  }
}

class FindSafeLocationAction extends Action {
  constructor() {
    super({ id: 'FIND_SAFE_LOCATION', name: 'Find Safe Location', description: 'Navigate to a safer area.' });
  }

  async execute(context = {}) {
    const { bot, worldState } = context;
    // Just stop for now or move slightly if unsafe
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    return { success: true };
  }
}

class RecoverAction extends Action {
  constructor() {
    super({ id: 'RECOVER', name: 'Recover', description: 'Wait and recover health/stamina.' });
  }

  async execute(context = {}) {
    const { bot, worldState } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    // Usually means just standing still securely
    bot.clearControlStates();
    return { success: true };
  }
}

class GatherWoodAction extends Action {
  constructor() {
    super({ id: 'GATHER_WOOD', name: 'Gather Wood', description: 'Find and break a nearby tree.' });
  }

  async execute(context = {}) {
    const { bot, worldState } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    return { success: false, error: 'Not implemented' }; // Will implement later
  }
}

class GatherStoneAction extends Action {
  constructor() {
    super({ id: 'GATHER_STONE', name: 'Gather Stone', description: 'Find and break stone.' });
  }

  async execute(context = {}) {
    const { bot, worldState } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    return { success: false, error: 'Not implemented' };
  }
}

class CraftAction extends Action {
  constructor() {
    super({ id: 'CRAFT', name: 'Craft', description: 'Craft basic items.' });
  }

  async execute(context = {}) {
    const { bot, worldState } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    return { success: false, error: 'Not implemented' };
  }
}

class FindFoodAction extends Action {
  constructor() {
    super({ id: 'FIND_FOOD', name: 'Find Food', description: 'Look for food in the environment.' });
  }

  async execute(context = {}) {
    const { bot, worldState } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    return { success: false, error: 'Not implemented' };
  }
}

module.exports = {
  EatAction,
  EscapeAction,
  FindSafeLocationAction,
  RecoverAction,
  GatherWoodAction,
  GatherStoneAction,
  CraftAction,
  FindFoodAction
};
