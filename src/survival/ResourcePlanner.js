class ResourcePlanner {
  constructor(bot) {
    this.bot = bot;
  }

  getMissingBasicResources(inventoryState) {
    const missing = [];
    if (!inventoryState.hasWood) missing.push('WOOD');
    if (!inventoryState.hasStone) missing.push('STONE');
    // More can be added like FOOD, COAL, IRON
    return missing;
  }

  findResourceCandidate(resourceType) {
    if (!this.bot || !this.bot.entity) return null;
    
    // Bounded search
    const range = 32;
    
    let blockNames = [];
    if (resourceType === 'WOOD') {
      blockNames = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log'];
    } else if (resourceType === 'STONE') {
      blockNames = ['stone', 'cobblestone', 'diorite', 'andesite', 'granite'];
    } else if (resourceType === 'FOOD') {
      // Find animals or crops? For now let's just return animals
      const entity = this.bot.nearestEntity(e => 
        e.type === 'mob' && ['cow', 'pig', 'chicken', 'sheep', 'rabbit'].includes(e.name)
      );
      if (entity) {
        return { type: 'entity', entity };
      }
      return null;
    }

    if (blockNames.length > 0) {
      const block = this.bot.findBlock({
        matching: (b) => blockNames.includes(b.name),
        maxDistance: range
      });
      if (block) {
        return { type: 'block', block };
      }
    }
    return null;
  }
}

module.exports = ResourcePlanner;
