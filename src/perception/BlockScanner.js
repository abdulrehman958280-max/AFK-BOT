const BlockClassifier = require('./BlockClassifier');

/**
 * BlockScanner
 * Performs bounded spatial sampling around the bot to identify notable blocks
 * (resources, utilities, hazards, structures).
 * Strictly guards against memory leaks and CPU spikes.
 */
class BlockScanner {
  /**
   * Scan blocks in a bounded cylinder/cube around the bot
   * @param {object|null} bot 
   * @param {object} options
   * @param {number} options.radius Horizontal radius (default 5, max 8)
   * @param {number} options.minY Vertical offset minimum (default -2)
   * @param {number} options.maxY Vertical offset maximum (default 3)
   * @param {number} options.maxInterestingBlocks Maximum notable blocks to return (default 40)
   * @returns {{ scannedCount: number, interestingBlocks: Array<object>, summary: object }}
   */
  static scan(bot, options = {}) {
    const radius = Math.min(8, Math.max(1, options.radius || options.horizontalRadius || 5));
    const minY = Math.max(-4, options.minY !== undefined ? options.minY : (options.verticalRadius ? -options.verticalRadius : -2));
    const maxY = Math.min(6, options.maxY !== undefined ? options.maxY : (options.verticalRadius ? options.verticalRadius : 3));
    const maxInteresting = options.maxInterestingBlocks || 40;
    const maxScansPerPass = Math.min(400, options.maxSamples || 400);
    const step = Math.max(1, options.sampleStep || 1);

    const emptyResult = {
      scannedCount: 0,
      sampledCount: 0,
      interestingBlocks: [],
      sampled: [],
      totalInterestingFound: 0,
      summary: {
        resources: 0,
        utilities: 0,
        dangers: 0,
        structures: 0
      }
    };

    if (!bot || !bot.entity || !bot.entity.position || typeof bot.blockAt !== 'function') {
      return emptyResult;
    }

    try {
      const origin = bot.entity.position;
      const ox = Math.floor(origin.x);
      const oy = Math.floor(origin.y);
      const oz = Math.floor(origin.z);

      const interestingBlocks = [];
      const summary = {
        resources: 0,
        utilities: 0,
        dangers: 0,
        structures: 0
      };

      let scannedCount = 0;

      // Vec3 helper (fallback if Vec3 constructor not globally imported)
      const getVec3 = (x, y, z) => ({ x, y, z });

      // Scan outwards in vertical slices
      for (let dy = minY; dy <= maxY; dy += step) {
        const y = oy + dy;
        for (let dx = -radius; dx <= radius; dx += step) {
          for (let dz = -radius; dz <= radius; dz += step) {
            // Spherical/cylindrical distance check
            const distSq = dx * dx + dz * dz;
            if (distSq > radius * radius) continue;

            scannedCount++;
            if (scannedCount > maxScansPerPass) break;

            const blockPos = getVec3(ox + dx, y, oz + dz);
            const block = bot.blockAt(blockPos);

            if (!block || !block.name || block.name === 'air' || block.name === 'cave_air') {
              continue;
            }

            const category = BlockClassifier.classify(block.name);

            // Only track non-terrain, notable blocks (resources, utilities, dangers, structures)
            if (category !== BlockClassifier.CATEGORIES.TERRAIN &&
                category !== BlockClassifier.CATEGORIES.OTHER) {

              const distance = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz) * 10) / 10;

              if (BlockClassifier.isResource(block.name)) summary.resources++;
              if (BlockClassifier.isUtility(block.name)) summary.utilities++;
              if (BlockClassifier.isDanger(block.name)) summary.dangers++;
              if (category === BlockClassifier.CATEGORIES.STRUCTURE) summary.structures++;

              interestingBlocks.push({
                name: block.name,
                displayName: block.displayName || block.name,
                category: category,
                position: { x: blockPos.x, y: blockPos.y, z: blockPos.z },
                distance
              });

              if (interestingBlocks.length >= maxInteresting * 2) {
                break;
              }
            }
          }
          if (scannedCount > maxScansPerPass) break;
        }
        if (scannedCount > maxScansPerPass) break;
      }

      // Sort interesting blocks by distance ascending
      interestingBlocks.sort((a, b) => a.distance - b.distance);

      return {
        scannedCount,
        sampledCount: scannedCount,
        interestingBlocks: interestingBlocks.slice(0, maxInteresting),
        sampled: interestingBlocks.slice(0, maxInteresting),
        totalInterestingFound: interestingBlocks.length,
        summary
      };
    } catch (err) {
      return emptyResult;
    }
  }
}

module.exports = BlockScanner;
