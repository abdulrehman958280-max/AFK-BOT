class NightPreparationManager {
  constructor(bot) {
    this.bot = bot;
  }

  isPreparationNeeded(worldState) {
    // If it's night, or close to night
    const time = this.bot?.time?.timeOfDay;
    if (time !== undefined) {
      // 12000 is dusk, 24000 is dawn
      if (time > 11000 && time < 23000) {
        return true;
      }
    }
    return false;
  }
}

module.exports = NightPreparationManager;
