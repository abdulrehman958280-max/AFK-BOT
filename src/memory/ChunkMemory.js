class ChunkMemory {
  constructor(options = {}) {
    this.chunks = new Map();
    this.maxChunks = options.maxChunks || 2000;
  }

  getChunkKey(chunkX, chunkZ, dimension = 'overworld') {
    return `${dimension}:${chunkX}:${chunkZ}`;
  }

  recordVisit(chunkX, chunkZ, dimension = 'overworld', dangerScore = 0, resourceScore = 0) {
    const key = this.getChunkKey(chunkX, chunkZ, dimension);
    const now = Date.now();
    let chunk = this.chunks.get(key);

    if (!chunk) {
      chunk = {
        chunkX,
        chunkZ,
        dimension,
        firstSeen: now,
        lastSeen: now,
        visitCount: 1,
        explored: true,
        dangerScore,
        resourceScore,
        landmarks: []
      };
      this.chunks.set(key, chunk);
      this._prune();
    } else {
      chunk.lastSeen = now;
      chunk.visitCount += 1;
      // Exponential moving average for scores
      chunk.dangerScore = chunk.dangerScore * 0.7 + dangerScore * 0.3;
      chunk.resourceScore = chunk.resourceScore * 0.7 + resourceScore * 0.3;
    }
    return chunk;
  }

  getChunk(chunkX, chunkZ, dimension = 'overworld') {
    return this.chunks.get(this.getChunkKey(chunkX, chunkZ, dimension)) || null;
  }

  _prune() {
    if (this.chunks.size <= this.maxChunks) return;
    // Sort by lastSeen and remove oldest
    const entries = Array.from(this.chunks.entries());
    entries.sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    
    // Remove oldest 10%
    const toRemove = Math.ceil(this.maxChunks * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.chunks.delete(entries[i][0]);
    }
  }

  serialize() {
    return Array.from(this.chunks.values());
  }

  deserialize(data) {
    if (!Array.isArray(data)) return;
    for (const chunk of data) {
      const key = this.getChunkKey(chunk.chunkX, chunk.chunkZ, chunk.dimension);
      this.chunks.set(key, chunk);
    }
  }
}

module.exports = ChunkMemory;
