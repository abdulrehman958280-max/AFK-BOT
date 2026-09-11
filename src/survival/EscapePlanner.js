class EscapePlanner {
  constructor(bot) {
    this.bot = bot;
  }

  generateEscapeRoute(worldState) {
    if (!this.bot || !this.bot.entity) return null;

    const threats = worldState.threats;
    if (threats && threats.closestHostile && threats.closestHostile.position) {
      const pos = threats.closestHostile.position;
      const botPos = this.bot.entity.position;
      
      const dx = botPos.x - pos.x;
      const dz = botPos.z - pos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      
      if (dist > 0) {
        const normX = dx / dist;
        const normZ = dz / dist;
        const targetX = botPos.x + normX * 16;
        const targetZ = botPos.z + normZ * 16;
        return { x: targetX, y: botPos.y, z: targetZ };
      }
    }
    
    return null;
  }
}

module.exports = EscapePlanner;
