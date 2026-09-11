const { Action } = require('./Action');
const { goals } = require('mineflayer-pathfinder');
const FoodManager = require('../survival/FoodManager');
const ResourcePlanner = require('../survival/ResourcePlanner');

class EatAction extends Action {
  constructor() {
    super({ id: 'EAT', name: 'Eat', description: 'Consume food from inventory to restore hunger.' });
  }

  async execute(context = {}) {
    const { bot } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    
    const fm = new FoodManager(bot);
    const missingFood = 20 - bot.food;
    const bestFood = fm.getBestFood(missingFood);

    if (!bestFood) {
      return { success: false, error: 'No food in inventory' };
    }
    
    try {
      await bot.equip(bestFood, 'hand');
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
    
    const EscapePlanner = require('../survival/EscapePlanner');
    const planner = new EscapePlanner(bot);
    const safePos = planner.generateEscapeRoute(worldState);

    if (safePos) {
      try {
        bot.pathfinder.setGoal(new goals.GoalNear(safePos.x, safePos.y, safePos.z, 2));
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
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    
    const SafeLocationManager = require('../survival/SafeLocationManager');
    const slm = new SafeLocationManager(bot);
    const safePos = slm.findSafeLocation(worldState);

    if (safePos) {
        bot.pathfinder.setGoal(new goals.GoalNear(safePos.x, safePos.y, safePos.z, 2));
        return { success: true };
    }
    
    return { success: true, warning: 'No specific safe location found' };
  }
}

class RecoverAction extends Action {
  constructor() {
    super({ id: 'RECOVER', name: 'Recover', description: 'Wait and recover health/stamina.' });
  }

  async execute(context = {}) {
    const { bot } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    bot.clearControlStates();
    // In actual implementation, we might wait until health is regenerated or timeout
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true });
      }, 5000);
    });
  }
}

class GatherWoodAction extends Action {
  constructor() {
    super({ id: 'GATHER_WOOD', name: 'Gather Wood', description: 'Find and break a nearby tree.' });
  }

  async execute(context = {}) {
    const { bot } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    
    const rp = new ResourcePlanner(bot);
    const candidate = rp.findResourceCandidate('WOOD');

    if (candidate && candidate.type === 'block') {
      try {
        const block = candidate.block;
        bot.pathfinder.setGoal(new goals.GoalLookAtBlock(block.position, bot.world));
        await bot.pathfinder.goto(new goals.GoalNear(block.position.x, block.position.y, block.position.z, 3));
        
        // Ensure we are using correct tool (not strictly required for wood, but good practice)
        await bot.dig(block);
        return { success: true };
      } catch (e) {
        return { success: false, error: `Failed to gather wood: ${e.message}` };
      }
    }

    return { success: false, error: 'No wood found nearby' };
  }
}

class GatherStoneAction extends Action {
  constructor() {
    super({ id: 'GATHER_STONE', name: 'Gather Stone', description: 'Find and break stone.' });
  }

  async execute(context = {}) {
    const { bot } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    
    const rp = new ResourcePlanner(bot);
    const candidate = rp.findResourceCandidate('STONE');

    if (candidate && candidate.type === 'block') {
      try {
        const block = candidate.block;
        await bot.pathfinder.goto(new goals.GoalNear(block.position.x, block.position.y, block.position.z, 3));
        
        // Requires pickaxe to drop stone/cobble
        const pickaxes = bot.inventory.items().filter(item => item.name.includes('pickaxe'));
        if (pickaxes.length > 0) {
            await bot.equip(pickaxes[0], 'hand');
        } else {
            return { success: false, error: 'No pickaxe to mine stone' };
        }
        
        await bot.dig(block);
        return { success: true };
      } catch (e) {
        return { success: false, error: `Failed to gather stone: ${e.message}` };
      }
    }

    return { success: false, error: 'No stone found nearby' };
  }
}

class CraftAction extends Action {
  constructor() {
    super({ id: 'CRAFT', name: 'Craft', description: 'Craft basic items.' });
  }

  async execute(context = {}) {
    const { bot, task } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    
    const recipeName = task?.metadata?.recipe;
    if (!recipeName) return { success: false, error: 'No recipe specified' };

    const CraftingManager = require('../survival/CraftingManager');
    const cm = new CraftingManager(bot);
    return await cm.craftRecipe(recipeName);
  }
}

class FindFoodAction extends Action {
  constructor() {
    super({ id: 'FIND_FOOD', name: 'Find Food', description: 'Look for food in the environment.' });
  }

  async execute(context = {}) {
    const { bot } = context;
    if (!bot || !bot.entity) return { success: false, error: 'Bot not spawned' };
    
    const rp = new ResourcePlanner(bot);
    const candidate = rp.findResourceCandidate('FOOD');

    if (candidate && candidate.type === 'entity') {
      try {
        const entity = candidate.entity;
        await bot.pathfinder.goto(new goals.GoalFollow(entity, 2));
        
        // Attack the entity
        bot.attack(entity);
        return { success: true };
      } catch (e) {
        return { success: false, error: `Failed to hunt food: ${e.message}` };
      }
    }

    return { success: false, error: 'No food sources found nearby' };
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
