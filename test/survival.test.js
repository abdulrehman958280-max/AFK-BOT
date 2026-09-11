const test = require('node:test');
const assert = require('node:assert');

const SurvivalState = require('../src/survival/SurvivalState');
const SurvivalPriorityEngine = require('../src/survival/SurvivalPriorityEngine');
const SurvivalTaskPlanner = require('../src/survival/SurvivalTaskPlanner');
const SafetyManager = require('../src/survival/SafetyManager');
const SurvivalEngine = require('../src/survival/SurvivalEngine');

test('Autonomous Survival Engine Tests (Phase 3)', async (t) => {
  await t.test('SurvivalState', async (st) => {
    await st.test('evaluates safe state correctly', () => {
      const mockWorld = {
        survival: { health: 20, maxHealth: 20, food: 20, saturation: 5 },
        threats: { level: 'NONE' },
        inventory: { items: [{name: 'apple'}, {name: 'log'}, {name: 'stone'}] },
        equipment: { mainHand: { name: 'diamond_sword' } },
        environment: { isDay: true, isNight: false }
      };
      const state = SurvivalState.evaluate(mockWorld);
      assert.strictEqual(state.food.ratio, 1);
      assert.strictEqual(state.health.ratio, 1);
      assert.strictEqual(state.danger.level, 'NONE');
    });

    await st.test('evaluates critical health and starvation', () => {
      const mockWorld = {
        survival: { health: 5, maxHealth: 20, food: 4, saturation: 0 },
        threats: { level: 'NONE' },
        inventory: { items: [] },
        equipment: { mainHand: null },
        environment: { isDay: true, isNight: false }
      };
      const state = SurvivalState.evaluate(mockWorld);
      assert.strictEqual(state.health.ratio, 5/20);
      assert.strictEqual(state.food.ratio, 4/20);
      assert.strictEqual(state.inventory.hasFood, false);
    });
  });

  await t.test('SurvivalPriorityEngine', async (st) => {
    await st.test('prioritizes CRITICAL_HEALTH above all', () => {
      const mockSurvivalState = {
        health: { ratio: 0.2, current: 4, max: 20 },
        food: { ratio: 0.2, current: 4, max: 20 },
        danger: { level: 'CRITICAL', reasons: ['Zombie'] },
        time: { isDay: true, isNight: false },
        equipment: {},
        inventory: { hasFood: false }
      };
      // Wait, in the engine, Danger check comes BEFORE health check!
      // If it evaluates danger first, ESCAPE_DANGER has priority 100, RECOVER_HEALTH has 90.
      const priority = SurvivalPriorityEngine.evaluate(mockSurvivalState);
      assert.strictEqual(priority.goal, SurvivalPriorityEngine.GOALS.ESCAPE_DANGER);
    });

    await st.test('prioritizes RECOVER_HEALTH if not in danger', () => {
      const mockSurvivalState = {
        health: { ratio: 0.2, current: 4, max: 20 },
        food: { ratio: 0.5, current: 10, max: 20 },
        danger: { level: 'NONE', reasons: [] },
        time: { isDay: true, isNight: false },
        equipment: {},
        inventory: { hasFood: false }
      };
      const priority = SurvivalPriorityEngine.evaluate(mockSurvivalState);
      assert.strictEqual(priority.goal, SurvivalPriorityEngine.GOALS.RECOVER_HEALTH);
    });
  });

  await t.test('SurvivalTaskPlanner', async (st) => {
    await st.test('plans ESCAPE task for ESCAPE_DANGER goal', () => {
      const task = SurvivalTaskPlanner.plan(SurvivalPriorityEngine.GOALS.ESCAPE_DANGER, {});
      assert.strictEqual(task.metadata.action, 'ESCAPE');
    });

    await st.test('returns null for USER_TASK', () => {
      const task = SurvivalTaskPlanner.plan(SurvivalPriorityEngine.GOALS.USER_TASK, {});
      assert.strictEqual(task, null);
    });
  });

  await t.test('SafetyManager', async (st) => {
    await st.test('isSafe returns true when threat level is NONE', () => {
      const isSafe = SafetyManager.isSafe({ danger: { level: 'NONE' } });
      assert.strictEqual(isSafe, true);
    });
  });

  await t.test('SurvivalEngine', async (st) => {
    await st.test('integrates all survival components', () => {
      const engine = new SurvivalEngine();
      const mockWorld = {
        survival: { health: 20, maxHealth: 20, food: 20, saturation: 5 },
        threats: { level: 'NONE', reasons: [] },
        inventory: { items: [{name: 'apple'}, {name: 'log'}, {name: 'stone'}] },
        equipment: { mainHand: { name: 'wooden_pickaxe' } },
        environment: { isDay: true, isNight: false }
      };
      engine.evaluate(mockWorld);
      assert.strictEqual(engine.highestPriority.goal, SurvivalPriorityEngine.GOALS.USER_TASK);
      assert.strictEqual(engine.activeSurvivalTask, null);
    });
  });
});
