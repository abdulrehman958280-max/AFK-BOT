const fs = require('fs');
const path = require('path');
const WorldMemory = require('./WorldMemory');

class MemoryManager {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.persistPath = options.persistence || path.join(process.cwd(), 'data', 'world-memory.json');
    this.memory = new WorldMemory(options);
    this.eventBus = options.eventBus;
  }

  init() {
    if (!this.enabled) return;
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = fs.readFileSync(this.persistPath, 'utf8');
        this.memory.deserialize(JSON.parse(data));
      }
    } catch (e) {
      console.error(`Failed to load memory from ${this.persistPath}: ${e.message}`);
    }
  }

  save() {
    if (!this.enabled) return;
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const data = JSON.stringify(this.memory.serialize());
      // Atomic write using temp file
      const tempPath = this.persistPath + '.tmp';
      fs.writeFileSync(tempPath, data, 'utf8');
      fs.renameSync(tempPath, this.persistPath);
    } catch (e) {
      console.error(`Failed to save memory to ${this.persistPath}: ${e.message}`);
    }
  }

  update(worldState) {
    if (!this.enabled) return;
    this.memory.update(worldState);
    if (this.eventBus) {
      this.eventBus.emit('WORLD_MEMORY_UPDATED', { timestamp: Date.now() });
    }
  }
}

module.exports = MemoryManager;
