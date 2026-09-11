/**
 * WorldState
 * Non-destructive perception layer observing bot body, environment, and server state.
 */
class WorldState {
  constructor() {
    this.connected = false;
    this.spawned = false;
    this.health = 20;
    this.food = 20;
    this.position = null;
    this.dimension = 'overworld';
    this.time = { timeOfDay: 0, isDay: true, isNight: false };
    this.nearbyEntitiesCount = 0;
    this.isSleeping = false;
    this.gameMode = 'survival';
    this.lastObserved = Date.now();
  }

  /**
   * Observe current bot state safely
   * @param {object|null} bot 
   * @returns {WorldState}
   */
  observe(bot) {
    this.lastObserved = Date.now();

    if (!bot) {
      this.connected = false;
      this.spawned = false;
      this.position = null;
      return this;
    }

    try {
      this.connected = Boolean(bot._client && !bot._client.ended);
      this.spawned = Boolean(bot.entity);

      if (bot.entity) {
        this.position = bot.entity.position ? {
          x: Math.round(bot.entity.position.x * 10) / 10,
          y: Math.round(bot.entity.position.y * 10) / 10,
          z: Math.round(bot.entity.position.z * 10) / 10
        } : null;
      } else {
        this.position = null;
      }

      this.health = typeof bot.health === 'number' ? bot.health : 20;
      this.food = typeof bot.food === 'number' ? bot.food : 20;
      this.isSleeping = Boolean(bot.isSleeping);
      this.gameMode = bot.game?.gameMode || 'survival';
      this.dimension = bot.game?.dimension || 'overworld';

      if (bot.time) {
        const tod = bot.time.timeOfDay || 0;
        this.time = {
          timeOfDay: tod,
          isDay: tod < 12500 || tod > 23500,
          isNight: tod >= 12500 && tod <= 23500
        };
      }

      if (bot.entities) {
        this.nearbyEntitiesCount = Object.keys(bot.entities).length;
      } else {
        this.nearbyEntitiesCount = 0;
      }
    } catch (e) {
      // Safe degradation on partial bot state
      this.connected = false;
    }

    return this;
  }

  /**
   * Export clean, sanitized snapshot
   */
  getSnapshot() {
    return {
      connected: this.connected,
      spawned: this.spawned,
      health: this.health,
      food: this.food,
      position: this.position ? { ...this.position } : null,
      dimension: this.dimension,
      time: { ...this.time },
      nearbyEntitiesCount: this.nearbyEntitiesCount,
      isSleeping: this.isSleeping,
      gameMode: this.gameMode,
      lastObserved: this.lastObserved
    };
  }
}

module.exports = WorldState;
