/**
 * EntityClassifier
 * Classifies Minecraft entities as hostile, passive, neutral, player, ambient, item, projectile, or vehicle.
 * Utilizes minecraft-data registry when available, backed by comprehensive canonical tables.
 */
class EntityClassifier {
  static CATEGORIES = Object.freeze({
    HOSTILE: 'HOSTILE',
    PASSIVE: 'PASSIVE',
    NEUTRAL: 'NEUTRAL',
    PLAYER: 'PLAYER',
    AMBIENT: 'AMBIENT',
    ITEM: 'ITEM',
    PROJECTILE: 'PROJECTILE',
    VEHICLE: 'VEHICLE',
    UNKNOWN: 'UNKNOWN',
    OTHER: 'OTHER'
  });

  static HOSTILE_NAMES = new Set([
    'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider', 'enderman',
    'witch', 'phantom', 'drowned', 'husk', 'stray', 'slime', 'magma_cube',
    'ghast', 'blaze', 'wither_skeleton', 'pillager', 'vindicator', 'ravager',
    'evoker', 'vex', 'warden', 'wither', 'ender_dragon', 'piglin_brute',
    'silverfish', 'endermite', 'shulker', 'guardian', 'elder_guardian',
    'hoglin', 'zoglin', 'illusioner', 'breeze', 'bogged'
  ]);

  static PASSIVE_NAMES = new Set([
    'cow', 'sheep', 'pig', 'chicken', 'horse', 'donkey', 'mule', 'llama',
    'trader_llama', 'villager', 'wandering_trader', 'cat', 'ocelot',
    'squid', 'glow_squid', 'dolphin', 'turtle', 'fox', 'panda', 'parrot',
    'mooshroom', 'strider', 'frog', 'tadpole', 'sniffer', 'camel', 'armadillo',
    'allay', 'axolotl', 'rabbit', 'snow_golem'
  ]);

  static AMBIENT_NAMES = new Set([
    'bat'
  ]);

  static NEUTRAL_NAMES = new Set([
    'bee', 'iron_golem', 'goat', 'polar_bear', 'wolf', 'zombified_piglin',
    'piglin', 'enderman'
  ]);

  static PROJECTILE_NAMES = new Set([
    'arrow', 'spectral_arrow', 'trident', 'fireball', 'small_fireball',
    'dragon_fireball', 'wither_skull', 'shulker_bullet', 'llama_spit',
    'snowball', 'egg', 'potion', 'experience_bottle', 'wind_charge'
  ]);

  static VEHICLE_NAMES = new Set([
    'boat', 'chest_boat', 'minecart', 'chest_minecart', 'furnace_minecart',
    'tnt_minecart', 'hopper_minecart', 'spawner_minecart'
  ]);

  /**
   * Helper to create a dual-purpose classification result
   * Supports both object access (.category, .isHostile) and string comparison (== 'HOSTILE')
   * @private
   */
  static _createResult(category, flags = {}) {
    const result = {
      category,
      isHostile: Boolean(flags.isHostile),
      isPassive: Boolean(flags.isPassive),
      isPlayer: Boolean(flags.isPlayer),
      isAmbient: Boolean(flags.isAmbient),
      isNeutral: Boolean(flags.isNeutral),
      isItem: Boolean(flags.isItem),
      isProjectile: Boolean(flags.isProjectile),
      isVehicle: Boolean(flags.isVehicle),
      [Symbol.toPrimitive](hint) {
        return category;
      },
      toString() {
        return category;
      },
      valueOf() {
        return category;
      }
    };
    return result;
  }

  /**
   * Classify an entity instance or name
   * @param {object|string} entity Raw Mineflayer or mocked entity, or entity name string
   * @param {object|string|null} registry Optional minecraft-data registry or type string
   * @returns {string} Category name
   */
  static classify(entity, registry = null) {
    if (!entity) {
      return EntityClassifier.CATEGORIES.UNKNOWN;
    }

    let name = '';
    let type = '';
    let username = null;
    let reg = null;

    if (typeof entity === 'string') {
      name = entity.toLowerCase().replace('minecraft:', '');
      type = typeof registry === 'string' ? registry : 'mob';
    } else {
      type = entity.type || '';
      name = String(entity.name || '').toLowerCase().replace('minecraft:', '');
      username = entity.username || null;
      if (registry && typeof registry === 'object') {
        reg = registry;
      }
    }

    // 1. Players
    if (type === 'player' || Boolean(username)) {
      return EntityClassifier.CATEGORIES.PLAYER;
    }

    // 2. Dropped items / objects
    if (name === 'item' || type === 'item' || type === 'object') {
      return EntityClassifier.CATEGORIES.ITEM;
    }

    // 3. Projectiles
    if (type === 'projectile' || EntityClassifier.PROJECTILE_NAMES.has(name)) {
      return EntityClassifier.CATEGORIES.PROJECTILE;
    }

    // 4. Vehicles
    if (EntityClassifier.VEHICLE_NAMES.has(name)) {
      return EntityClassifier.CATEGORIES.VEHICLE;
    }

    // 5. Check minecraft-data registry if provided
    if (reg && reg.entitiesByName && reg.entitiesByName[name]) {
      const regData = reg.entitiesByName[name];
      if (regData.type === 'hostile') {
        return EntityClassifier.CATEGORIES.HOSTILE;
      }
      if (regData.type === 'passive' || regData.type === 'animal') {
        return EntityClassifier.CATEGORIES.PASSIVE;
      }
    }

    // 6. Static sets fallback
    if (EntityClassifier.HOSTILE_NAMES.has(name)) {
      return EntityClassifier.CATEGORIES.HOSTILE;
    }

    if (EntityClassifier.PASSIVE_NAMES.has(name)) {
      return EntityClassifier.CATEGORIES.PASSIVE;
    }

    if (EntityClassifier.AMBIENT_NAMES.has(name)) {
      return EntityClassifier.CATEGORIES.AMBIENT;
    }

    if (EntityClassifier.NEUTRAL_NAMES.has(name)) {
      return EntityClassifier.CATEGORIES.NEUTRAL;
    }

    // Default unknown / other
    return EntityClassifier.CATEGORIES.UNKNOWN;
  }

  static isHostile(entity) {
    return this.classify(entity) === EntityClassifier.CATEGORIES.HOSTILE;
  }

  static isPassive(entity) {
    const cat = this.classify(entity);
    return cat === EntityClassifier.CATEGORIES.PASSIVE || cat === EntityClassifier.CATEGORIES.AMBIENT;
  }

  static isPlayer(entity) {
    return this.classify(entity) === EntityClassifier.CATEGORIES.PLAYER;
  }
}

module.exports = EntityClassifier;
