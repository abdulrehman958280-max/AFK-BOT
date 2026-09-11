/**
 * EnvironmentPerception
 * Extracts normalized environmental data: time, day/night cycle, weather,
 * biome, dimension, world age, and difficulty.
 */
class EnvironmentPerception {
  /**
   * Calculate human-readable time string from Minecraft time ticks (0 - 24000)
   * In Minecraft: 0 is 06:00 AM (Sunrise), 6000 is 12:00 PM (Noon),
   * 12000 is 06:00 PM (Sunset), 18000 is 12:00 AM (Midnight).
   * @param {number} timeOfDay
   * @returns {{ formattedTime: string, phase: string, isDay: boolean, isNight: boolean }}
   */
  static parseTime(timeOfDay = 0) {
    const safeTicks = Math.max(0, Math.floor(timeOfDay)) % 24000;

    // Convert to 24-hour clock: 0 ticks = 06:00
    const totalMinutes = Math.floor(((safeTicks + 6000) % 24000) / (24000 / 1440));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const pad = (n) => String(n).padStart(2, '0');
    const clockString = `${pad(hours)}:${pad(minutes)}`;

    let phase = 'Day';
    if (safeTicks >= 23000 || safeTicks < 1000) {
      phase = 'Sunrise';
    } else if (safeTicks >= 1000 && safeTicks < 12000) {
      phase = 'Day';
    } else if (safeTicks >= 12000 && safeTicks < 13500) {
      phase = 'Sunset';
    } else {
      phase = 'Night';
    }

    // Minecraft sleep condition is typically between 12541 and 23458
    const isNight = safeTicks >= 12500 && safeTicks <= 23500;
    const isDay = !isNight;

    return {
      formattedTime: `${clockString} (${phase})`,
      phase,
      isDay,
      isNight
    };
  }

  /**
   * Extract biome name at bot's location safely
   * @param {object|null} bot
   * @returns {string}
   */
  static extractBiome(bot) {
    if (!bot || !bot.entity || !bot.entity.position) {
      return 'unknown';
    }

    try {
      const pos = bot.entity.position;

      // Mineflayer helper via blockAt
      if (typeof bot.blockAt === 'function') {
        const block = bot.blockAt(pos);
        if (block && block.biome) {
          return block.biome.name || block.biome.displayName || String(block.biome);
        }
      }

      // Mineflayer world getBiome helper
      if (bot.world && typeof bot.world.getBiome === 'function') {
        const biomeId = bot.world.getBiome(pos);
        if (typeof biomeId === 'string') return biomeId;
        if (typeof biomeId === 'number' && bot.registry?.biomes?.[biomeId]) {
          return bot.registry.biomes[biomeId].name;
        }
      }
    } catch (e) {
      // Fallback
    }

    return 'plains';
  }

  /**
   * Extract complete environment state
   * @param {object|null} bot 
   * @returns {object}
   */
  static extract(bot) {
    if (!bot) {
      return {
        dimension: 'overworld',
        biome: 'unknown',
        timeOfDay: 0,
        formattedTime: '06:00 (Sunrise)',
        phase: 'Sunrise',
        isDay: true,
        isNight: false,
        age: 0,
        weather: 'clear',
        isRaining: false,
        isThundering: false,
        difficulty: 'normal',
        hardcore: false
      };
    }

    try {
      const timeOfDay = typeof bot.time?.timeOfDay === 'number' ? bot.time.timeOfDay : 0;
      const timeInfo = EnvironmentPerception.parseTime(timeOfDay);
      const age = typeof bot.time?.age === 'number' ? bot.time.age : 0;

      const isRaining = Boolean(bot.isRaining);
      const isThundering = Boolean(bot.isThundering || (typeof bot.thunderState === 'number' && bot.thunderState > 0));
      let weather = 'clear';
      if (isThundering) {
        weather = 'thunder';
      } else if (isRaining) {
        weather = 'rain';
      }

      const dimension = bot.game?.dimension || 'overworld';
      const difficulty = bot.game?.difficulty || 'normal';
      const hardcore = Boolean(bot.game?.hardcore);
      const biome = EnvironmentPerception.extractBiome(bot);

      return {
        dimension: String(dimension).replace('minecraft:', ''),
        biome,
        timeOfDay,
        formattedTime: timeInfo.formattedTime,
        phase: timeInfo.phase,
        isDay: timeInfo.isDay,
        isNight: timeInfo.isNight,
        age,
        weather,
        isRaining,
        isThundering,
        difficulty,
        hardcore
      };
    } catch (err) {
      return {
        dimension: 'overworld',
        biome: 'unknown',
        timeOfDay: 0,
        formattedTime: '06:00 (Sunrise)',
        phase: 'Sunrise',
        isDay: true,
        isNight: false,
        age: 0,
        weather: 'clear',
        isRaining: false,
        isThundering: false,
        difficulty: 'normal',
        hardcore: false
      };
    }
  }

  /**
   * Observe alias for extract
   * @param {object|null} bot
   * @returns {object}
   */
  static observe(bot) {
    return this.extract(bot);
  }
}

module.exports = EnvironmentPerception;
