const test = require('node:test');
const assert = require('node:assert');
const ChunkMemory = require('../src/memory/ChunkMemory');
const WaypointManager = require('../src/memory/WaypointManager');
const ResourceMemory = require('../src/memory/ResourceMemory');
const ThreatMemory = require('../src/memory/ThreatMemory');
const WorldMemory = require('../src/memory/WorldMemory');

test('Memory Subsystem Tests (Phase 4)', async (t) => {
  
  await t.test('ChunkMemory', async (st) => {
    await st.test('records chunk visits and prunes old chunks', () => {
      const cm = new ChunkMemory({ maxChunks: 2 });
      cm.recordVisit(0, 0, 'overworld', 0.5, 0.8);
      cm.recordVisit(1, 0, 'overworld', 0, 0.1);
      cm.recordVisit(2, 0, 'overworld', 0.9, 0); // Should trigger prune
      
      const chunks = cm.serialize();
      assert.strictEqual(chunks.length, 2);
      assert.strictEqual(cm.getChunk(2, 0, 'overworld').dangerScore, 0.9);
    });
  });

  await t.test('WaypointManager', async (st) => {
    await st.test('creates and retrieves waypoints without duplicates', () => {
      const wm = new WaypointManager();
      const wp1 = wm.createWaypoint('Home', 0, 64, 0, 'overworld', 'HOME');
      const wp2 = wm.createWaypoint('Home', 1, 64, 1, 'overworld', 'HOME'); // Duplicate within 5 blocks
      const wp3 = wm.createWaypoint('Mine', 100, 20, 100, 'overworld', 'CUSTOM');

      assert.strictEqual(wp1.id, wp2.id); // Same waypoint
      assert.strictEqual(wm.getAllWaypoints().length, 2);
    });
  });

  await t.test('ResourceMemory', async (st) => {
    await st.test('records resources and finds nearest', () => {
      const rm = new ResourceMemory();
      rm.recordResource('WOOD', 10, 64, 10);
      rm.recordResource('WOOD', 50, 64, 50);

      const nearest = rm.findNearest('WOOD', 0, 64, 0);
      assert.strictEqual(nearest.x, 10);
    });
  });

  await t.test('ThreatMemory', async (st) => {
    await st.test('records threats and retrieves by radius', () => {
      const tm = new ThreatMemory();
      tm.recordThreat('zombie', 5, 64, 5);
      
      const nearby = tm.getThreatsInRadius(0, 64, 0, 10);
      assert.strictEqual(nearby.length, 1);
      
      const far = tm.getThreatsInRadius(100, 64, 100, 10);
      assert.strictEqual(far.length, 0);
    });
  });

  await t.test('WorldMemory Integration', async (st) => {
    await st.test('updates multiple memory stores from WorldState', () => {
      const wm = new WorldMemory();
      const mockWorldState = {
        position: { x: 16, y: 64, z: 16 },
        dimension: 'overworld',
        threats: { level: 'HIGH', closestHostile: { position: { x: 20, y: 64, z: 20 } } }
      };

      wm.update(mockWorldState);

      assert.ok(wm.chunks.getChunk(1, 1, 'overworld'));
      assert.strictEqual(wm.threats.serialize().length, 1);
    });
  });

});
