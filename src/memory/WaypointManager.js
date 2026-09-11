const crypto = require('crypto');

class WaypointManager {
  constructor(options = {}) {
    this.waypoints = new Map();
    this.maxWaypoints = options.maxWaypoints || 100;
  }

  createWaypoint(name, x, y, z, dimension = 'overworld', type = 'CUSTOM') {
    // Check duplicates within 5 blocks
    for (const wp of this.waypoints.values()) {
      if (wp.dimension === dimension && wp.name === name) {
        const dist = Math.sqrt((wp.x-x)**2 + (wp.y-y)**2 + (wp.z-z)**2);
        if (dist < 5) return wp; // Already exists
      }
    }

    if (this.waypoints.size >= this.maxWaypoints) {
      this._prune();
    }

    const id = `wp_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const waypoint = {
      id, name, x, y, z, dimension, type,
      createdAt: Date.now(),
      visits: 0,
      lastVisited: null
    };
    
    this.waypoints.set(id, waypoint);
    return waypoint;
  }

  getWaypoint(id) {
    return this.waypoints.get(id) || null;
  }

  getAllWaypoints() {
    return Array.from(this.waypoints.values());
  }

  findNearestWaypoint(x, y, z, dimension = 'overworld', type = null) {
    let nearest = null;
    let minDist = Infinity;
    for (const wp of this.waypoints.values()) {
      if (wp.dimension !== dimension) continue;
      if (type && wp.type !== type) continue;
      
      const dist = Math.sqrt((wp.x-x)**2 + (wp.y-y)**2 + (wp.z-z)**2);
      if (dist < minDist) {
        minDist = dist;
        nearest = wp;
      }
    }
    return nearest;
  }

  markVisited(id) {
    const wp = this.waypoints.get(id);
    if (wp) {
      wp.visits += 1;
      wp.lastVisited = Date.now();
    }
  }

  removeWaypoint(id) {
    return this.waypoints.delete(id);
  }

  _prune() {
    // Remove least visited and oldest custom waypoints first
    const entries = Array.from(this.waypoints.entries());
    entries.sort((a, b) => {
      if (a[1].type === 'HOME' || a[1].type === 'SAFE') return 1;
      if (b[1].type === 'HOME' || b[1].type === 'SAFE') return -1;
      return a[1].lastVisited - b[1].lastVisited;
    });
    if (entries.length > 0) {
      this.waypoints.delete(entries[0][0]);
    }
  }

  serialize() {
    return Array.from(this.waypoints.values());
  }

  deserialize(data) {
    if (!Array.isArray(data)) return;
    for (const wp of data) {
      this.waypoints.set(wp.id, wp);
    }
  }
}

module.exports = WaypointManager;
