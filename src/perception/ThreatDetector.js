/**
 * ThreatDetector
 * Evaluates observable situational dangers without executing any actions.
 * Read-only risk assessment for bot survival metrics, nearby hostile mobs, and environment.
 */
class ThreatDetector {
  static LEVELS = Object.freeze({
    NONE: 'NONE',
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
  });

  /**
   * Assess threats based on normalized player, entities, and environment data
   * @param {object} params
   * @param {object} params.survival Survival data (health, food, etc.)
   * @param {object} params.player Player position, velocity, onGround
   * @param {Array<object>} params.entities Normalized nearby entities
   * @param {Array<object>} params.nearbyBlocks Nearby scanned blocks (if any)
   * @returns {{ level: string, score: number, reasons: Array<string>, hostilesCount: number, closestHostile: object|null, environmentalThreats: Array<string> }}
   */
  static evaluate(params = {}) {
    const {
      survival = params.player?.survival || { health: 20, food: 20, oxygen: 20 },
      player = {},
      entities = [],
      nearbyBlocks = []
    } = params;

    const reasons = [];
    const environmentalThreats = [];
    let score = 0; // 0 to 100

    const health = typeof survival.health === 'number' ? survival.health : 20;
    const food = typeof survival.food === 'number' ? survival.food : 20;
    const oxygen = typeof survival.oxygen === 'number' ? survival.oxygen : 20;

    // 1. Health risks
    if (health < 6) {
      reasons.push(`Critical health (${health} HP)`);
      score += 75;
    } else if (health <= 8) {
      reasons.push('Low health');
      score += 35;
    } else if (health <= 14) {
      reasons.push('Diminished health');
      score += 15;
    }

    // 2. Hunger risks
    if (food === 0) {
      reasons.push('Starvation');
      score += 25;
    } else if (food <= 6) {
      reasons.push('Low hunger');
      score += 10;
    }

    // 3. Oxygen / Drowning risk
    if (oxygen < 10) {
      reasons.push('Low oxygen');
      environmentalThreats.push('drowning');
      score += 30;
    }

    // 4. Hostile mob analysis
    let hostilesCount = 0;
    let closestHostile = null;

    if (Array.isArray(entities)) {
      for (const entity of entities) {
        const isHostile = Boolean(
          entity.hostile ||
          entity.classification === 'HOSTILE' ||
          entity.category === 'HOSTILE' ||
          entity.classification === 'hostile' ||
          entity.category === 'hostile'
        );
        if (!isHostile) continue;
        hostilesCount++;

        const dist = typeof entity.distance === 'number' ? entity.distance : 999;
        if (!closestHostile || dist < closestHostile.distance) {
          closestHostile = {
            id: entity.id,
            name: entity.name,
            distance: dist
          };
        }

        // Weight by proximity
        if (dist <= 3.5) {
          if (!reasons.includes('Hostile mob in melee range')) {
            reasons.push('Hostile mob in melee range');
          }
          score += 60;
        } else if (dist <= 8) {
          if (!reasons.includes('Hostile mob close')) {
            reasons.push('Hostile mob close');
          }
          score += 48; // Guarantees HIGH level
        } else if (dist <= 16) {
          if (!reasons.includes('Hostile mob nearby')) {
            reasons.push('Hostile mob nearby');
          }
          score += 25;
        } else if (dist <= 32) {
          score += 10;
        }
      }
    }

    // 5. Environmental block hazards (lava / fire within close range)
    if (Array.isArray(nearbyBlocks)) {
      for (const block of nearbyBlocks) {
        if (block.category === 'DANGER' || block.name === 'lava' || block.name === 'fire') {
          if (block.distance <= 2.5) {
            environmentalThreats.push(`immediate_hazard_${block.name}`);
            if (!reasons.includes('Lava or fire adjacent')) {
              reasons.push('Lava or fire adjacent');
            }
            score += 35;
          } else if (block.distance <= 5) {
            environmentalThreats.push(`nearby_hazard_${block.name}`);
            if (!reasons.includes('Hazardous block nearby')) {
              reasons.push('Hazardous block nearby');
            }
            score += 15;
          }
        }
      }
    }

    // 6. Free-fall / High velocity downward
    if (player.velocity && player.velocity.y < -0.6 && !player.onGround) {
      reasons.push('Falling at high velocity');
      environmentalThreats.push('high_fall_velocity');
      score += 25;
    }

    // Normalize score to 0 - 100
    const clampedScore = Math.min(100, Math.max(0, score));

    // Determine level
    let level = ThreatDetector.LEVELS.NONE;
    if (clampedScore >= 70 || reasons.some(r => r.includes('Critical health') || r.includes('melee range'))) {
      level = ThreatDetector.LEVELS.CRITICAL;
    } else if (clampedScore >= 45 || reasons.some(r => r.includes('Low health') || r.includes('Hostile mob close'))) {
      level = ThreatDetector.LEVELS.HIGH;
    } else if (clampedScore >= 25 || hostilesCount > 0 || reasons.some(r => r.includes('Diminished health') || r.includes('Hostile mob nearby'))) {
      level = ThreatDetector.LEVELS.MEDIUM;
    } else if (clampedScore >= 10 || hostilesCount > 0) {
      level = ThreatDetector.LEVELS.LOW;
    }

    return {
      level,
      score: clampedScore,
      reasons,
      hostilesCount,
      closestHostile,
      environmentalThreats
    };
  }
}

module.exports = ThreatDetector;
