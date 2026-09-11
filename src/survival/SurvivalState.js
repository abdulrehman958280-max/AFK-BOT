/**
 * SurvivalState
 * Derives a clean survival-focused state from WorldState.
 * Used by the priority engine to make decisions.
 */
class SurvivalState {
  /**
   * @param {object} worldState The read-only WorldState snapshot
   * @returns {object} Calculated survival state
   */
  static evaluate(worldState) {
    if (!worldState) {
      return this._getDefaultState();
    }

    const health = worldState.survival?.health ?? 20;
    const maxHealth = worldState.survival?.maxHealth ?? 20;
    
    const food = worldState.survival?.food ?? 20;
    
    const threatLevel = worldState.threats?.level || 'NONE';
    const threatReasons = Array.isArray(worldState.threats?.reasons) 
      ? [...worldState.threats.reasons] 
      : [];
      
    const isDay = worldState.environment?.isDay ?? true;
    const isNight = worldState.environment?.isNight ?? false;

    return {
      health: {
        current: health,
        max: maxHealth,
        ratio: maxHealth > 0 ? (health / maxHealth) : 1
      },
      food: {
        current: food,
        max: 20,
        ratio: food / 20,
        saturation: worldState.survival?.foodSaturation ?? 5
      },
      danger: {
        level: threatLevel,
        score: worldState.threats?.score || 0,
        reasons: threatReasons,
        hostilesCount: worldState.threats?.hostilesCount || 0
      },
      time: {
        isDay,
        isNight
      },
      equipment: {
        hasWeapon: Boolean(worldState.equipment?.mainHand && worldState.equipment.mainHand.name.includes('sword')),
        hasPickaxe: Boolean(worldState.equipment?.mainHand && worldState.equipment.mainHand.name.includes('pickaxe')),
        hasAxe: Boolean(worldState.equipment?.mainHand && worldState.equipment.mainHand.name.includes('axe'))
      },
      inventory: {
        // Can be expanded by ResourcePlanner
        hasWood: worldState.inventory?.items?.some(i => i.name.includes('log') || i.name.includes('planks')) || false,
        hasStone: worldState.inventory?.items?.some(i => i.name.includes('cobblestone') || i.name.includes('stone')) || false,
        hasFood: worldState.inventory?.items?.some(i => ['apple', 'bread', 'cooked_beef', 'cooked_porkchop', 'carrot', 'potato'].some(food => i.name.includes(food))) || false
      }
    };
  }

  static _getDefaultState() {
    return {
      health: { current: 20, max: 20, ratio: 1.0 },
      food: { current: 20, max: 20, ratio: 1.0, saturation: 5 },
      danger: { level: 'NONE', score: 0, reasons: [], hostilesCount: 0 },
      time: { isDay: true, isNight: false },
      equipment: { hasWeapon: false, hasPickaxe: false, hasAxe: false },
      inventory: { hasWood: false, hasStone: false, hasFood: false }
    };
  }
}

module.exports = SurvivalState;
