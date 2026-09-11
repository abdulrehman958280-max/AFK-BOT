class ResourceMemory {
  constructor(options = {}) {
    this.resources = [];
    this.maxResources = options.maxResources || 500;
    this.ttl = options.resourceTTL || 1000 * 60 * 60 * 24; // 24 hours
  }

  recordResource(type, x, y, z, dimension = 'overworld', count = 1) {
    const now = Date.now();
    
    // De-duplicate nearby resources of same type
    const existing = this.resources.find(r => 
      r.type === type && r.dimension === dimension &&
      Math.abs(r.x - x) < 5 && Math.abs(r.y - y) < 5 && Math.abs(r.z - z) < 5
    );

    if (existing) {
      existing.count = Math.max(existing.count, count);
      existing.lastSeen = now;
      existing.confidence = 1.0;
      return existing;
    }

    if (this.resources.length >= this.maxResources) {
      this._prune();
    }

    const resource = {
      type, x, y, z, dimension, count,
      firstSeen: now,
      lastSeen: now,
      confidence: 1.0
    };
    
    this.resources.push(resource);
    return resource;
  }

  findNearest(type, x, y, z, dimension = 'overworld') {
    this._prune();
    let nearest = null;
    let minDist = Infinity;
    
    for (const r of this.resources) {
      if (r.type !== type || r.dimension !== dimension) continue;
      const dist = Math.sqrt((r.x-x)**2 + (r.y-y)**2 + (r.z-z)**2);
      if (dist < minDist) {
        minDist = dist;
        nearest = r;
      }
    }
    return nearest;
  }

  _prune() {
    const now = Date.now();
    this.resources = this.resources.filter(r => (now - r.lastSeen) < this.ttl);
    if (this.resources.length > this.maxResources) {
      this.resources.sort((a, b) => b.lastSeen - a.lastSeen);
      this.resources = this.resources.slice(0, this.maxResources);
    }
  }

  serialize() {
    return this.resources;
  }

  deserialize(data) {
    if (!Array.isArray(data)) return;
    this.resources = data;
  }
}

module.exports = ResourceMemory;
