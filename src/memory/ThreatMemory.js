class ThreatMemory {
  constructor(options = {}) {
    this.threats = [];
    this.maxThreats = options.maxThreats || 300;
    this.ttl = options.threatTTL || 1000 * 60 * 30; // 30 minutes
  }

  recordThreat(type, x, y, z, dimension = 'overworld', dangerScore = 1.0) {
    const now = Date.now();
    
    const existing = this.threats.find(t => 
      t.type === type && t.dimension === dimension &&
      Math.abs(t.x - x) < 5 && Math.abs(t.y - y) < 5 && Math.abs(t.z - z) < 5
    );

    if (existing) {
      existing.dangerScore = Math.max(existing.dangerScore, dangerScore);
      existing.lastSeen = now;
      return existing;
    }

    if (this.threats.length >= this.maxThreats) {
      this._prune();
    }

    const threat = {
      type, x, y, z, dimension, dangerScore,
      firstSeen: now,
      lastSeen: now
    };
    
    this.threats.push(threat);
    return threat;
  }

  getThreatsInRadius(x, y, z, radius, dimension = 'overworld') {
    this._prune();
    return this.threats.filter(t => {
      if (t.dimension !== dimension) return false;
      const dist = Math.sqrt((t.x-x)**2 + (t.y-y)**2 + (t.z-z)**2);
      return dist <= radius;
    });
  }

  _prune() {
    const now = Date.now();
    this.threats = this.threats.filter(t => (now - t.lastSeen) < this.ttl);
    if (this.threats.length > this.maxThreats) {
      this.threats.sort((a, b) => b.lastSeen - a.lastSeen);
      this.threats = this.threats.slice(0, this.maxThreats);
    }
  }

  serialize() {
    return this.threats;
  }

  deserialize(data) {
    if (!Array.isArray(data)) return;
    this.threats = data;
  }
}

module.exports = ThreatMemory;
