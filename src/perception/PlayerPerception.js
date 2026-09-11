/**
 * PlayerPerception
 * Extracts normalized, read-only player and survival state from a Mineflayer bot.
 * Never mutates bot state, never exposes credentials.
 */
class PlayerPerception {
  /**
   * Extract player and survival data safely
   * @param {object|null} bot 
   * @returns {object} Normalized player and survival data
   */
  static extract(bot) {
    if (!bot) {
      return {
        player: {
          username: null,
          uuid: null,
          position: null,
          rotation: { yaw: 0, pitch: 0 },
          onGround: false,
          velocity: { x: 0, y: 0, z: 0 },
          gameMode: 'survival',
          experience: { level: 0, points: 0, progress: 0 }
        },
        survival: {
          health: 20,
          maxHealth: 20,
          food: 20,
          foodSaturation: 5,
          oxygen: 20,
          isSleeping: false,
          statusEffects: []
        }
      };
    }

    try {
      const entity = bot.entity;
      const playerObj = bot.player;

      // Position (rounded to 1 decimal place)
      let position = null;
      if (entity && entity.position) {
        position = {
          x: Math.round(entity.position.x * 10) / 10,
          y: Math.round(entity.position.y * 10) / 10,
          z: Math.round(entity.position.z * 10) / 10
        };
      }

      // Rotation (yaw, pitch in radians rounded to 2 decimals)
      const rotation = {
        yaw: entity && typeof entity.yaw === 'number' ? Math.round(entity.yaw * 100) / 100 : 0,
        pitch: entity && typeof entity.pitch === 'number' ? Math.round(entity.pitch * 100) / 100 : 0
      };

      // Velocity (rounded to 3 decimals)
      let velocity = { x: 0, y: 0, z: 0 };
      if (entity && entity.velocity) {
        velocity = {
          x: Math.round(entity.velocity.x * 1000) / 1000,
          y: Math.round(entity.velocity.y * 1000) / 1000,
          z: Math.round(entity.velocity.z * 1000) / 1000
        };
      }

      // Experience
      const exp = bot.experience || {};
      const experience = {
        level: typeof exp.level === 'number' ? exp.level : 0,
        points: typeof exp.points === 'number' ? exp.points : 0,
        progress: typeof exp.progress === 'number' ? Math.round(exp.progress * 100) / 100 : 0
      };

      // Active status effects
      const statusEffects = [];
      if (entity && entity.effects && typeof entity.effects === 'object') {
        for (const [id, effect] of Object.entries(entity.effects)) {
          if (effect) {
            statusEffects.push({
              id: Number(id) || effect.id || 0,
              name: effect.name || `effect_${id}`,
              amplifier: effect.amplifier || 0,
              duration: effect.duration || 0
            });
          }
        }
      }

      return {
        player: {
          username: bot.username || playerObj?.username || 'Player',
          uuid: playerObj?.uuid || null,
          position,
          rotation,
          onGround: Boolean(entity?.onGround),
          velocity,
          gameMode: bot.game?.gameMode || 'survival',
          experience
        },
        survival: {
          health: typeof bot.health === 'number' ? Math.max(0, Math.min(20, bot.health)) : 20,
          maxHealth: 20,
          food: typeof bot.food === 'number' ? Math.max(0, Math.min(20, bot.food)) : 20,
          foodSaturation: typeof bot.foodSaturation === 'number' ? bot.foodSaturation : 5,
          oxygen: typeof bot.oxygenLevel === 'number' ? bot.oxygenLevel : 20,
          isSleeping: Boolean(bot.isSleeping),
          statusEffects
        }
      };
    } catch (err) {
      return {
        player: {
          username: bot.username || 'Player',
          uuid: null,
          position: null,
          rotation: { yaw: 0, pitch: 0 },
          onGround: false,
          velocity: { x: 0, y: 0, z: 0 },
          gameMode: 'survival',
          experience: { level: 0, points: 0, progress: 0 }
        },
        survival: {
          health: 20,
          maxHealth: 20,
          food: 20,
          foodSaturation: 5,
          oxygen: 20,
          isSleeping: false,
          statusEffects: []
        }
      };
    }
  }

  /**
   * Observe alias for combined player and survival state
   * @param {object|null} bot
   * @returns {object}
   */
  static observe(bot) {
    const res = this.extract(bot);
    return {
      connected: Boolean(bot && bot._client && !bot._client.ended),
      spawned: Boolean(bot && bot.entity),
      ...res.player,
      survival: res.survival
    };
  }
}

module.exports = PlayerPerception;
