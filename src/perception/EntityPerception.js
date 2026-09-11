const EntityClassifier = require('./EntityClassifier');

/**
 * EntityPerception
 * Scans bot.entities to produce normalized nearby entity data and a dedicated nearby player layer.
 * Sorts by distance, bounds memory to avoid huge payloads, and isolates other players safely.
 */
class EntityPerception {
  /**
   * Calculate Euclidean distance between two 3D points
   * @param {{x:number, y:number, z:number}} p1 
   * @param {{x:number, y:number, z:number}} p2 
   * @returns {number} Distance rounded to 1 decimal
   */
  static getDistance(p1, p2) {
    if (!p1 || !p2) return Infinity;
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz) * 10) / 10;
  }

  /**
   * Extract normalized nearby entities and players
   * @param {object|null} bot 
   * @param {object} options
   * @param {number} options.maxDistance Max radius to consider (default 48)
   * @param {number} options.maxEntities Max entities to return (default 50)
   * @returns {{ entities: Array<object>, players: Array<object>, summary: object }}
   */
  static extract(bot, options = {}) {
    const maxDistance = options.maxDistance || 48;
    const maxEntities = options.maxEntities || 50;

    const emptyResult = {
      entities: [],
      players: [],
      summary: {
        totalNearby: 0,
        hostileCount: 0,
        passiveCount: 0,
        playerCount: 0,
        closestHostile: null
      }
    };

    if (!bot || !bot.entities || !bot.entity || !bot.entity.position) {
      return emptyResult;
    }

    try {
      const myPos = bot.entity.position;
      const myId = bot.entity.id;
      const myUsername = bot.username;
      const registry = bot.registry || null;

      const normalizedEntities = [];
      const normalizedPlayers = [];

      let hostileCount = 0;
      let passiveCount = 0;
      let closestHostile = null;

      for (const entityId in bot.entities) {
        const entity = bot.entities[entityId];
        if (!entity || !entity.position) continue;

        // Skip self
        if (entity.id === myId || (entity.username && entity.username === myUsername)) {
          continue;
        }

        const distance = EntityPerception.getDistance(myPos, entity.position);
        if (distance > maxDistance) {
          continue;
        }

        const category = EntityClassifier.classify(entity, registry);
        const isHostile = category === EntityClassifier.CATEGORIES.HOSTILE;
        const isPassive = category === EntityClassifier.CATEGORIES.PASSIVE || category === EntityClassifier.CATEGORIES.AMBIENT;
        const isPlayer = category === EntityClassifier.CATEGORIES.PLAYER;

        // Compute relative bearing (-180 to 180 degrees)
        let bearing = 0;
        if (bot.entity.yaw !== undefined) {
          const dx = entity.position.x - myPos.x;
          const dz = entity.position.z - myPos.z;
          const absoluteYaw = Math.atan2(-dx, -dz);
          const rawBearing = absoluteYaw - bot.entity.yaw;
          let normalizedBearing = (rawBearing + Math.PI) % (2 * Math.PI) - Math.PI;
          if (normalizedBearing < -Math.PI) normalizedBearing += 2 * Math.PI;
          bearing = Math.round(normalizedBearing * (180 / Math.PI));
        }

        const position = {
          x: Math.round(entity.position.x * 10) / 10,
          y: Math.round(entity.position.y * 10) / 10,
          z: Math.round(entity.position.z * 10) / 10
        };

        const normalized = {
          id: entity.id,
          type: entity.type || 'unknown',
          name: entity.name || (isPlayer ? entity.username : 'unknown'),
          username: isPlayer ? entity.username : null,
          position,
          distance,
          bearing,
          health: typeof entity.health === 'number' ? entity.health : null,
          category: category,
          hostile: isHostile,
          passive: isPassive,
          isPlayer: isPlayer
        };

        if (isHostile) {
          hostileCount++;
          if (!closestHostile || distance < closestHostile.distance) {
            closestHostile = {
              id: normalized.id,
              name: normalized.name,
              distance: normalized.distance,
              position: normalized.position,
              bearing: normalized.bearing
            };
          }
        } else if (isPassive) {
          passiveCount++;
        }

        if (isPlayer) {
          normalizedPlayers.push({
            id: entity.id,
            username: entity.username,
            uuid: entity.uuid || null,
            position,
            distance,
            bearing,
            health: typeof entity.health === 'number' ? entity.health : null,
            ping: typeof entity.ping === 'number' ? entity.ping : null
          });
        }

        normalizedEntities.push(normalized);
      }

      // Sort both by distance ascending
      normalizedEntities.sort((a, b) => a.distance - b.distance);
      normalizedPlayers.sort((a, b) => a.distance - b.distance);

      // Bounded output
      const boundedEntities = normalizedEntities.slice(0, maxEntities);

      return {
        entities: boundedEntities,
        players: normalizedPlayers,
        summary: {
          totalNearby: normalizedEntities.length,
          hostileCount,
          passiveCount,
          playerCount: normalizedPlayers.length,
          closestHostile
        }
      };
    } catch (err) {
      return emptyResult;
    }
  }
}

module.exports = EntityPerception;
