/**
 * BlockClassifier
 * Categorizes Minecraft blocks into semantic classes:
 * RESOURCE, UTILITY, DANGER, STRUCTURE, TERRAIN, or OTHER.
 */
class BlockClassifier {
  static CATEGORIES = Object.freeze({
    RESOURCE: 'RESOURCE',
    UTILITY: 'UTILITY',
    CONTAINER: 'CONTAINER',
    DANGER: 'DANGER',
    STRUCTURE: 'STRUCTURE',
    TERRAIN: 'TERRAIN',
    OTHER: 'OTHER'
  });

  static CONTAINER_BLOCKS = new Set([
    'chest', 'trapped_chest', 'barrel', 'ender_chest', 'shulker_box'
  ]);

  static RESOURCE_BLOCKS = new Set([
    'coal_ore', 'deepslate_coal_ore',
    'iron_ore', 'deepslate_iron_ore', 'raw_iron_block',
    'copper_ore', 'deepslate_copper_ore', 'raw_copper_block',
    'gold_ore', 'deepslate_gold_ore', 'raw_gold_block', 'nether_gold_ore',
    'redstone_ore', 'deepslate_redstone_ore',
    'lapis_ore', 'deepslate_lapis_ore',
    'diamond_ore', 'deepslate_diamond_ore',
    'emerald_ore', 'deepslate_emerald_ore',
    'nether_quartz_ore', 'ancient_debris',
    // Logs
    'oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log',
    'dark_oak_log', 'mangrove_log', 'cherry_log', 'crimson_stem', 'warped_stem'
  ]);

  static UTILITY_BLOCKS = new Set([
    'crafting_table', 'furnace', 'blast_furnace', 'smoker',
    'chest', 'trapped_chest', 'barrel', 'ender_chest', 'shulker_box',
    'white_shulker_box', 'orange_shulker_box', 'magenta_shulker_box', 'light_blue_shulker_box',
    'yellow_shulker_box', 'lime_shulker_box', 'pink_shulker_box', 'gray_shulker_box',
    'bed', 'white_bed', 'orange_bed', 'magenta_bed', 'light_blue_bed', 'yellow_bed',
    'lime_bed', 'pink_bed', 'gray_bed', 'light_gray_bed', 'cyan_bed', 'purple_bed',
    'blue_bed', 'brown_bed', 'green_bed', 'red_bed', 'black_bed',
    'anvil', 'chipped_anvil', 'damaged_anvil',
    'enchanting_table', 'brewing_stand', 'beacon', 'respawn_anchor',
    'loom', 'cartography_table', 'fletching_table', 'smithing_table', 'grindstone', 'stonecutter',
    'hopper', 'dropper', 'dispenser'
  ]);

  static DANGER_BLOCKS = new Set([
    'lava', 'flowing_lava',
    'fire', 'soul_fire',
    'campfire', 'soul_campfire',
    'magma_block',
    'cactus',
    'sweet_berry_bush',
    'powder_snow',
    'wither_rose',
    'tnt',
    'sculk_shrieker'
  ]);

  static STRUCTURE_BLOCKS = new Set([
    'bookshelf', 'chiseled_bookshelf',
    'spawner', 'cobweb',
    'iron_bars', 'chain', 'bell', 'lantern', 'soul_lantern', 'torch', 'soul_torch',
    // Doors / Trapdoors
    'oak_door', 'iron_door', 'spruce_door', 'birch_door', 'jungle_door', 'acacia_door',
    'dark_oak_door', 'mangrove_door', 'cherry_door',
    'oak_trapdoor', 'iron_trapdoor',
    'cobblestone_wall', 'stone_brick_wall'
  ]);

  static TERRAIN_BLOCKS = new Set([
    'stone', 'deepslate', 'granite', 'diorite', 'andesite', 'calcite', 'tuff', 'dripstone_block',
    'dirt', 'grass_block', 'podzol', 'mycelium', 'rooted_dirt', 'coarse_dirt', 'mud',
    'sand', 'red_sand', 'gravel', 'clay',
    'sandstone', 'red_sandstone',
    'cobblestone', 'mossy_cobblestone', 'stone_bricks', 'mossy_stone_bricks',
    'netherrack', 'soul_sand', 'soul_soil', 'basalt', 'blackstone', 'end_stone',
    'water', 'flowing_water'
  ]);

  /**
   * Classify a block by name
   * @param {string} blockName 
   * @returns {string} Category name (DANGER, RESOURCE, UTILITY, CONTAINER, STRUCTURE, TERRAIN, OTHER)
   */
  static classify(blockName) {
    if (!blockName || typeof blockName !== 'string') {
      return BlockClassifier.CATEGORIES.OTHER;
    }

    const clean = blockName.toLowerCase().replace('minecraft:', '');

    if (BlockClassifier.RESOURCE_BLOCKS.has(clean)) {
      return BlockClassifier.CATEGORIES.RESOURCE;
    }

    if (BlockClassifier.CONTAINER_BLOCKS.has(clean) || clean.endsWith('_shulker_box')) {
      return BlockClassifier.CATEGORIES.CONTAINER;
    }

    if (BlockClassifier.UTILITY_BLOCKS.has(clean) || clean.endsWith('_bed')) {
      return BlockClassifier.CATEGORIES.UTILITY;
    }

    if (BlockClassifier.DANGER_BLOCKS.has(clean)) {
      return BlockClassifier.CATEGORIES.DANGER;
    }

    if (BlockClassifier.STRUCTURE_BLOCKS.has(clean) || clean.endsWith('_door') || clean.endsWith('_wall')) {
      return BlockClassifier.CATEGORIES.STRUCTURE;
    }

    if (BlockClassifier.TERRAIN_BLOCKS.has(clean)) {
      return BlockClassifier.CATEGORIES.TERRAIN;
    }

    return BlockClassifier.CATEGORIES.OTHER;
  }

  static isDanger(blockName) {
    return this.classify(blockName) === BlockClassifier.CATEGORIES.DANGER;
  }

  static isResource(blockName) {
    return this.classify(blockName) === BlockClassifier.CATEGORIES.RESOURCE;
  }

  static isUtility(blockName) {
    const c = this.classify(blockName);
    return c === BlockClassifier.CATEGORIES.UTILITY || c === BlockClassifier.CATEGORIES.CONTAINER;
  }

  static isContainer(blockName) {
    return this.classify(blockName) === BlockClassifier.CATEGORIES.CONTAINER;
  }
}

module.exports = BlockClassifier;
