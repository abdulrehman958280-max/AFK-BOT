const minecraftData = require('minecraft-data');

class FoodManager {
  constructor(bot) {
    this.bot = bot;
    this.mcData = null;
  }

  _initMcData() {
    if (this.bot && this.bot.version && !this.mcData) {
      this.mcData = minecraftData(this.bot.version);
    }
  }

  hasFood() {
    return this.getAvailableFoodItems().length > 0;
  }

  getAvailableFoodItems() {
    if (!this.bot || !this.bot.inventory) return [];
    this._initMcData();
    if (!this.mcData) return [];
    
    return this.bot.inventory.items().filter(item => {
      const itemData = this.mcData.items[item.type];
      // Unfortunately, mineflayer/minecraft-data's "foods" can be identified via foodPoints or isFood?
      // Some versions have "foods" property, let's just check standard foods
      // Or we can rely on mcData.foodsArray
      if (this.mcData.foodsArray) {
        return this.mcData.foodsArray.some(f => f.id === item.type);
      }
      
      // Fallback manual list
      const foods = [
        'apple', 'bread', 'porkchop', 'cooked_porkchop', 'golden_apple', 'enchanted_golden_apple',
        'cod', 'salmon', 'tropical_fish', 'pufferfish', 'cooked_cod', 'cooked_salmon', 'cookie',
        'melon_slice', 'beef', 'cooked_beef', 'chicken', 'cooked_chicken', 'rotten_flesh',
        'spider_eye', 'carrot', 'potato', 'baked_potato', 'poisonous_potato', 'golden_carrot',
        'pumpkin_pie', 'rabbit', 'cooked_rabbit', 'rabbit_stew', 'mutton', 'cooked_mutton',
        'chorus_fruit', 'beetroot', 'beetroot_soup', 'sweet_berries', 'glow_berries'
      ];
      return foods.includes(item.name);
    });
  }

  getBestFood(missingFoodPoints) {
    const items = this.getAvailableFoodItems();
    if (items.length === 0) return null;

    // Ideally, we'd pick food that heals closest to missingFoodPoints to avoid waste
    // Let's sort by food point value or use a fallback logic
    
    this._initMcData();
    // sort logic
    items.sort((a, b) => {
       const fa = this._getFoodPoints(a.name);
       const fb = this._getFoodPoints(b.name);
       // if we need e.g. 5 points, and fa is 5 and fb is 8, prefer fa
       const wasteA = Math.max(0, fa - missingFoodPoints);
       const wasteB = Math.max(0, fb - missingFoodPoints);
       
       if (wasteA !== wasteB) {
         return wasteA - wasteB; // smaller waste first
       }
       return fb - fa; // otherwise bigger food first
    });
    
    return items[0];
  }

  _getFoodPoints(itemName) {
    // Basic approximation if mcData.foodsArray is unavailable
    if (this.mcData && this.mcData.foodsArray) {
      const food = this.mcData.foodsArray.find(f => f.name === itemName);
      if (food) return food.foodPoints;
    }
    const foodMap = {
      'apple': 4, 'bread': 5, 'porkchop': 3, 'cooked_porkchop': 8, 'golden_apple': 4, 
      'enchanted_golden_apple': 4, 'cod': 2, 'salmon': 2, 'tropical_fish': 1, 'pufferfish': 1, 
      'cooked_cod': 5, 'cooked_salmon': 6, 'cookie': 2, 'melon_slice': 2, 'beef': 3, 
      'cooked_beef': 8, 'chicken': 2, 'cooked_chicken': 6, 'rotten_flesh': 4, 'spider_eye': 2, 
      'carrot': 3, 'potato': 1, 'baked_potato': 5, 'poisonous_potato': 2, 'golden_carrot': 6, 
      'pumpkin_pie': 8, 'rabbit': 3, 'cooked_rabbit': 5, 'rabbit_stew': 10, 'mutton': 2, 
      'cooked_mutton': 6, 'chorus_fruit': 4, 'beetroot': 1, 'beetroot_soup': 6, 'sweet_berries': 2, 
      'glow_berries': 2
    };
    return foodMap[itemName] || 2;
  }

  shouldEat() {
    if (!this.bot || !this.bot.player) return false;
    const food = this.bot.food;
    // Food is on scale 0-20
    // Eat if food < 20 and we can avoid waste, or if food <= 16 (can sprint)
    return food <= 17; 
  }
}

module.exports = FoodManager;
