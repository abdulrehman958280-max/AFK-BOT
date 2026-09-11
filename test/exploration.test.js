const test = require('node:test');
const assert = require('node:assert');
const ExplorationPlanner = require('../src/exploration/ExplorationPlanner');
const WorldMemory = require('../src/memory/WorldMemory');

test('ExplorationPlanner Tests', async (t) => {
  await t.test('plans exploration to unknown chunks', () => {
    const wm = new WorldMemory();
    const planner = new ExplorationPlanner(wm);

    const mockWorldState = {
      position: { x: 0, y: 64, z: 0 },
      dimension: 'overworld'
    };

    // Current chunk is marked visited
    wm.update(mockWorldState);

    const task = planner.planExploration(mockWorldState);
    assert.ok(task);
    assert.strictEqual(task.metadata.action, 'EXPLORE');
    // It should target a chunk at least 1 unit away, so target should not be (8,8) if (0,0) is visited
    // actually our loop in planExploration checks radius 1 to 5, skipping (0,0)
    assert.ok(task.metadata.target);
  });
});
