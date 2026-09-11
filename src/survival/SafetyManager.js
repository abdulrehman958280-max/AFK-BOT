const SurvivalState = require('./SurvivalState');

class SafetyManager {
  static isSafe(survivalState) {
    if (!survivalState) return true;
    return survivalState.danger.level === 'NONE' || survivalState.danger.level === 'LOW';
  }

  static isDangerous(survivalState) {
    if (!survivalState) return false;
    return survivalState.danger.level === 'CRITICAL' || survivalState.danger.level === 'HIGH';
  }

  static getSafetyScore(survivalState) {
    if (!survivalState) return 100;
    return Math.max(0, 100 - survivalState.danger.score);
  }
}

module.exports = SafetyManager;
