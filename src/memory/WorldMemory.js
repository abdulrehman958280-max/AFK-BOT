const ChunkMemory = require('./ChunkMemory');
const WaypointManager = require('./WaypointManager');
const ResourceMemory = require('./ResourceMemory');
const ThreatMemory = require('./ThreatMemory');

class WorldMemory {
  constructor(options = {}) {
    this.chunks = new ChunkMemory(options);
    this.waypoints = new WaypointManager(options);
    this.resources = new ResourceMemory(options);
    this.threats = new ThreatMemory(options);
  }

  update(worldState) {
    if (!worldState || !worldState.position) return;
    
    const pos = worldState.position;
    const dimension = worldState.dimension || 'overworld';
    
    // Update chunks
    const chunkX = Math.floor(pos.x / 16);
    const chunkZ = Math.floor(pos.z / 16);
    
    let danger = 0;
    if (worldState.threats && worldState.threats.level === 'HIGH') danger = 1.0;
    else if (worldState.threats && worldState.threats.level === 'MEDIUM') danger = 0.5;

    this.chunks.recordVisit(chunkX, chunkZ, dimension, danger, 0);

    // If there are threats, record them
    if (worldState.threats && worldState.threats.closestHostile && worldState.threats.closestHostile.position) {
      const hPos = worldState.threats.closestHostile.position;
      this.threats.recordThreat('hostile', hPos.x, hPos.y, hPos.z, dimension, 1.0);
    }
  }

  serialize() {
    return {
      chunks: this.chunks.serialize(),
      waypoints: this.waypoints.serialize(),
      resources: this.resources.serialize(),
      threats: this.threats.serialize()
    };
  }

  deserialize(data) {
    if (!data) return;
    if (data.chunks) this.chunks.deserialize(data.chunks);
    if (data.waypoints) this.waypoints.deserialize(data.waypoints);
    if (data.resources) this.resources.deserialize(data.resources);
    if (data.threats) this.threats.deserialize(data.threats);
  }
}

module.exports = WorldMemory;
