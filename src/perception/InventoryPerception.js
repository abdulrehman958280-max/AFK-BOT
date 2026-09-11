/**
 * InventoryPerception
 * Normalizes Mineflayer inventory and equipment data.
 * Purely read-only; never mutates inventory slots or item instances.
 */
class InventoryPerception {
  /**
   * Normalize an individual Mineflayer item object safely
   * @param {object|null} item
   * @param {number} fallbackSlot
   * @returns {object|null}
   */
  static normalizeItem(item, fallbackSlot = null) {
    if (!item) return null;

    try {
      const slot = typeof item.slot === 'number' ? item.slot : fallbackSlot;
      const durabilityUsed = typeof item.durabilityUsed === 'number' ? item.durabilityUsed : null;
      const maxDurability = typeof item.maxDurability === 'number' ? item.maxDurability : null;

      let durabilityPercent = null;
      if (maxDurability && maxDurability > 0 && durabilityUsed !== null) {
        const remaining = Math.max(0, maxDurability - durabilityUsed);
        durabilityPercent = Math.round((remaining / maxDurability) * 100);
      }

      return {
        id: item.type || 0,
        name: item.name || 'unknown',
        displayName: item.displayName || item.name || 'Unknown Item',
        count: typeof item.count === 'number' ? item.count : 1,
        slot,
        durabilityUsed,
        maxDurability,
        durabilityPercent,
        customName: item.customName || null
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Extract normalized inventory list, equipment, and summaries
   * @param {object|null} bot 
   * @returns {object}
   */
  static extract(bot) {
    const emptyResult = {
      items: [],
      equipment: {
        helmet: null,
        chestplate: null,
        leggings: null,
        boots: null,
        mainHand: null,
        offHand: null
      },
      summary: {
        totalCount: 0,
        uniqueCount: 0,
        uniqueItemTypes: 0,
        slotsUsed: 0,
        usedSlotsCount: 0,
        emptySlots: 36,
        emptySlotsCount: 36
      }
    };

    if (!bot || !bot.inventory) {
      return emptyResult;
    }

    try {
      const rawItems = typeof bot.inventory.items === 'function' ? bot.inventory.items() : [];
      const normalizedItems = [];
      const itemCountsByName = new Map();
      let totalCount = 0;

      for (const item of rawItems) {
        const normalized = InventoryPerception.normalizeItem(item);
        if (normalized) {
          normalizedItems.push(normalized);
          totalCount += normalized.count;

          const currentCount = itemCountsByName.get(normalized.name) || 0;
          itemCountsByName.set(normalized.name, currentCount + normalized.count);
        }
      }

      // Equipment extraction
      // Standard Mineflayer inventory slot mapping:
      // 5: helmet, 6: chestplate, 7: leggings, 8: boots, 45: offhand
      const slots = bot.inventory.slots || [];
      const helmet = InventoryPerception.normalizeItem(slots[5], 5);
      const chestplate = InventoryPerception.normalizeItem(slots[6], 6);
      const leggings = InventoryPerception.normalizeItem(slots[7], 7);
      const boots = InventoryPerception.normalizeItem(slots[8], 8);
      const offHand = InventoryPerception.normalizeItem(slots[45], 45);

      // Main hand: bot.heldItem takes priority, fallback to quickbar slot
      let mainHand = null;
      if (bot.heldItem) {
        mainHand = InventoryPerception.normalizeItem(bot.heldItem);
      } else if (typeof bot.quickBarSlot === 'number') {
        const quickbarIndex = 36 + bot.quickBarSlot;
        mainHand = InventoryPerception.normalizeItem(slots[quickbarIndex], quickbarIndex);
      }

      const equipment = {
        helmet,
        chestplate,
        leggings,
        boots,
        mainHand,
        offHand
      };

      // Summary
      // Standard inventory has 36 storage slots (9-44)
      const slotsUsed = normalizedItems.length;
      const emptySlots = Math.max(0, 36 - slotsUsed);

      const summary = {
        totalCount,
        uniqueCount: itemCountsByName.size,
        uniqueItemTypes: itemCountsByName.size,
        slotsUsed,
        usedSlotsCount: slotsUsed,
        emptySlots,
        emptySlotsCount: emptySlots,
        itemCounts: Object.fromEntries(itemCountsByName)
      };

      return {
        items: normalizedItems,
        equipment,
        summary
      };
    } catch (err) {
      return emptyResult;
    }
  }

  /**
   * Observe alias for extract
   * @param {object|null} bot 
   * @returns {object}
   */
  static observe(bot) {
    return this.extract(bot);
  }

  /**
   * Helper: check if item is in inventory by name
   * @param {Array<object>} items 
   * @param {string} name 
   * @returns {boolean}
   */
  static hasItem(items, name) {
    if (!Array.isArray(items) || !name) return false;
    const search = String(name).toLowerCase();
    return items.some(i => i.name.toLowerCase() === search);
  }

  /**
   * Helper: count total quantity of an item by name
   * @param {Array<object>} items 
   * @param {string} name 
   * @returns {number}
   */
  static countItem(items, name) {
    if (!Array.isArray(items) || !name) return 0;
    const search = String(name).toLowerCase();
    return items
      .filter(i => i.name.toLowerCase() === search)
      .reduce((sum, item) => sum + (item.count || 0), 0);
  }

  /**
   * Helper: get first matching item by name
   * @param {Array<object>} items 
   * @param {string} name 
   * @returns {object|null}
   */
  static getItem(items, name) {
    if (!Array.isArray(items) || !name) return null;
    const search = String(name).toLowerCase();
    return items.find(i => i.name.toLowerCase() === search) || null;
  }
}

module.exports = InventoryPerception;
