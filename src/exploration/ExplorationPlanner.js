const Task = require('../tasks/Task');

class ExplorationPlanner {
  constructor(worldMemory) {
    this.memory = worldMemory;
  }

  planExploration(worldState) {
    if (!worldState || !worldState.position) return null;

    // Very simple exploration target selector for now
    // Find an unexplored chunk in a 5 chunk radius
    const currentChunkX = Math.floor(worldState.position.x / 16);
    const currentChunkZ = Math.floor(worldState.position.z / 16);
    const dim = worldState.dimension || 'overworld';

    for (let r = 1; r <= 5; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          
          const cx = currentChunkX + dx;
          const cz = currentChunkZ + dz;
          
          if (!this.memory.chunks.getChunk(cx, cz, dim)) {
            // Unexplored chunk!
            const targetX = cx * 16 + 8;
            const targetZ = cz * 16 + 8;
            return new Task({
              name: 'Explore Unknown Area',
              metadata: { action: 'EXPLORE', target: { x: targetX, z: targetZ } },
              priority: 15
            });
          }
        }
      }
    }

    return null;
  }
}

module.exports = ExplorationPlanner;
