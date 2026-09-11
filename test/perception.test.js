const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const PlayerPerception = require('../src/perception/PlayerPerception');
const InventoryPerception = require('../src/perception/InventoryPerception');
const EnvironmentPerception = require('../src/perception/EnvironmentPerception');
const EntityClassifier = require('../src/perception/EntityClassifier');
const EntityPerception = require('../src/perception/EntityPerception');
const ThreatDetector = require('../src/perception/ThreatDetector');
const BlockClassifier = require('../src/perception/BlockClassifier');
const BlockScanner = require('../src/perception/BlockScanner');
const WorldState = require('../src/perception/WorldState');
const PerceptionManager = require('../src/perception/PerceptionManager');
const EventBus = require('../src/brain/EventBus');
const AgentBrain = require('../src/brain/AgentBrain');
const createWorldRouter = require('../src/api/worldApi');

describe('World Perception & Situational Awareness Tests (Phase 2)', () => {

  // 1. PlayerPerception
  describe('PlayerPerception', () => {
    test('handles null bot gracefully with default safe values', () => {
      const player = PlayerPerception.observe(null);
      assert.equal(player.connected, false);
      assert.equal(player.spawned, false);
      assert.equal(player.survival.health, 20);
      assert.equal(player.survival.food, 20);
      assert.equal(player.position, null);
    });

    test('extracts and normalizes player and survival state from mock bot', () => {
      const mockBot = {
        _client: {},
        entity: {
          position: { x: 10.49, y: 64.01, z: -25.88 },
          velocity: { x: 0, y: -0.078, z: 0 },
          yaw: 1.57,
          pitch: 0.12,
          onGround: true
        },
        health: 14.5,
        food: 17,
        foodSaturation: 4.2,
        oxygenLevel: 18,
        game: {
          gameMode: 'survival',
          hardcore: false
        }
      };

      const player = PlayerPerception.observe(mockBot);
      assert.equal(player.connected, true);
      assert.equal(player.spawned, true);
      assert.equal(player.survival.health, 14.5);
      assert.equal(player.survival.food, 17);
      assert.equal(player.survival.foodSaturation, 4.2);
      assert.equal(player.survival.oxygen, 18);
      assert.equal(player.position.x, 10.5);
      assert.equal(player.position.y, 64.0);
      assert.equal(player.position.z, -25.9);
      assert.equal(player.gameMode, 'survival');
      assert.equal(player.onGround, true);
    });
  });

  // 2. InventoryPerception
  describe('InventoryPerception', () => {
    test('handles empty or missing inventory', () => {
      const inv = InventoryPerception.observe(null);
      assert.equal(inv.items.length, 0);
      assert.equal(inv.summary.totalCount, 0);
      assert.equal(inv.summary.usedSlotsCount, 0);
      assert.equal(inv.summary.emptySlotsCount, 36);
      assert.equal(inv.equipment.mainHand, null);
    });

    test('normalizes inventory items, equipment, and capacity accurately', () => {
      const mockBot = {
        inventory: {
          items: () => [
            { type: 260, name: 'apple', displayName: 'Apple', count: 5, slot: 36 },
            { type: 276, name: 'diamond_sword', displayName: 'Diamond Sword', count: 1, slot: 37 }
          ],
          slots: new Array(45).fill(null)
        },
        heldItem: { name: 'diamond_sword', displayName: 'Diamond Sword', count: 1 }
      };
      // Populate 2 slots
      mockBot.inventory.slots[36] = mockBot.inventory.items()[0];
      mockBot.inventory.slots[37] = mockBot.inventory.items()[1];

      const inv = InventoryPerception.observe(mockBot);
      assert.equal(inv.items.length, 2);
      assert.equal(inv.summary.totalCount, 6);
      assert.equal(inv.summary.uniqueItemTypes, 2);
      assert.equal(inv.summary.usedSlotsCount, 2);
      assert.equal(inv.summary.emptySlotsCount, 34);
      assert.equal(inv.equipment.mainHand.name, 'diamond_sword');
    });
  });

  // 3. EnvironmentPerception
  describe('EnvironmentPerception', () => {
    test('handles missing world data gracefully', () => {
      const env = EnvironmentPerception.extract(null);
      assert.equal(env.dimension, 'overworld');
      assert.equal(env.weather, 'clear');
      assert.equal(env.isNight, false);
      assert.equal(env.formattedTime, '06:00 (Sunrise)');
    });

    test('accurately calculates day/night and weather state', () => {
      const mockBot = {
        game: {
          dimension: 'minecraft:the_nether',
          difficulty: 'hard'
        },
        time: {
          timeOfDay: 14000,
          time: 14000,
          age: 50000
        },
        isRaining: true,
        thunderState: 1
      };

      const env = EnvironmentPerception.extract(mockBot);
      assert.equal(env.dimension, 'the_nether');
      assert.equal(env.difficulty, 'hard');
      assert.equal(env.timeOfDay, 14000);
      assert.equal(env.isNight, true);
      assert.equal(env.weather, 'thunder');
      assert.equal(env.isRaining, true);
      assert.equal(env.isThundering, true);
    });
  });

  // 4. EntityClassifier
  describe('EntityClassifier', () => {
    test('classifies entities correctly according to Minecraft types', () => {
      assert.equal(EntityClassifier.classify('zombie', 'mob'), EntityClassifier.CATEGORIES.HOSTILE);
      assert.equal(EntityClassifier.classify('skeleton', 'mob'), EntityClassifier.CATEGORIES.HOSTILE);
      assert.equal(EntityClassifier.classify('creeper', 'mob'), EntityClassifier.CATEGORIES.HOSTILE);
      assert.equal(EntityClassifier.classify('cow', 'mob'), EntityClassifier.CATEGORIES.PASSIVE);
      assert.equal(EntityClassifier.classify('sheep', 'mob'), EntityClassifier.CATEGORIES.PASSIVE);
      assert.equal(EntityClassifier.classify('iron_golem', 'mob'), EntityClassifier.CATEGORIES.NEUTRAL);
      assert.equal(EntityClassifier.classify('steve', 'player'), EntityClassifier.CATEGORIES.PLAYER);
      assert.equal(EntityClassifier.classify('bat', 'mob'), EntityClassifier.CATEGORIES.AMBIENT);
      assert.equal(EntityClassifier.classify('something_weird', 'unknown'), EntityClassifier.CATEGORIES.UNKNOWN);
    });

    test('isHostile method returns boolean accurately', () => {
      assert.equal(EntityClassifier.isHostile('zombie'), true);
      assert.equal(EntityClassifier.isHostile('cow'), false);
    });
  });

  // 5. EntityPerception
  describe('EntityPerception', () => {
    test('filters and orders nearby entities by distance with relative bearing', () => {
      const mockBot = {
        username: 'BotUser',
        entity: {
          id: 1,
          position: { x: 0, y: 64, z: 0 },
          yaw: 0
        },
        entities: {
          1: { id: 1, name: 'BotUser', type: 'player', position: { x: 0, y: 64, z: 0 } },
          2: { id: 2, name: 'zombie', type: 'mob', position: { x: 0, y: 64, z: 10 } },
          3: { id: 3, name: 'cow', type: 'mob', position: { x: 5, y: 64, z: 0 } },
          4: { id: 4, username: 'FriendlyPlayer', type: 'player', position: { x: 2, y: 64, z: 2 } }
        }
      };

      const result = EntityPerception.extract(mockBot, { maxDistance: 32 });
      const entities = result.entities;
      // Should exclude self (id 1)
      assert.equal(entities.length, 3);
      // Sorted by distance ascending: FriendlyPlayer (~2.83m), cow (5m), zombie (10m)
      assert.equal(entities[0].name, 'FriendlyPlayer');
      assert.equal(entities[1].name, 'cow');
      assert.equal(entities[2].name, 'zombie');
      assert.equal(entities[2].category, 'HOSTILE');
      assert.ok(entities[2].bearing !== undefined);
    });
  });

  // 6. ThreatDetector
  describe('ThreatDetector', () => {
    test('assesses CRITICAL threat when health is critically low (< 6)', () => {
      const threat = ThreatDetector.evaluate({
        player: { survival: { health: 4, food: 10 } },
        entities: []
      });
      assert.equal(threat.level, ThreatDetector.LEVELS.CRITICAL);
      assert.ok(threat.reasons.some(r => r.includes('Critical health')));
    });

    test('assesses HIGH threat when hostile mob is closer than 8 blocks', () => {
      const threat = ThreatDetector.evaluate({
        player: { survival: { health: 20, food: 20 } },
        entities: [
          { name: 'creeper', classification: 'HOSTILE', distance: 5.2 }
        ]
      });
      assert.equal(threat.level, ThreatDetector.LEVELS.HIGH);
      assert.equal(threat.hostilesCount, 1);
      assert.equal(threat.closestHostile.name, 'creeper');
    });

    test('assesses NONE threat when healthy with no nearby hostiles', () => {
      const threat = ThreatDetector.evaluate({
        player: { survival: { health: 20, food: 20 } },
        entities: [
          { name: 'pig', classification: 'PASSIVE', distance: 4.0 }
        ]
      });
      assert.equal(threat.level, ThreatDetector.LEVELS.NONE);
      assert.equal(threat.hostilesCount, 0);
    });
  });

  // 7. BlockClassifier
  describe('BlockClassifier', () => {
    test('categorizes blocks into danger, resource, and utility', () => {
      assert.equal(BlockClassifier.classify('lava'), BlockClassifier.CATEGORIES.DANGER);
      assert.equal(BlockClassifier.classify('fire'), BlockClassifier.CATEGORIES.DANGER);
      assert.equal(BlockClassifier.classify('diamond_ore'), BlockClassifier.CATEGORIES.RESOURCE);
      assert.equal(BlockClassifier.classify('crafting_table'), BlockClassifier.CATEGORIES.UTILITY);
      assert.equal(BlockClassifier.classify('chest'), BlockClassifier.CATEGORIES.CONTAINER);
      assert.equal(BlockClassifier.isDanger('lava'), true);
      assert.equal(BlockClassifier.isDanger('stone'), false);
    });
  });

  // 8. BlockScanner
  describe('BlockScanner', () => {
    test('performs bounded spatial sampling and enforces safety cap', () => {
      const scannedCoords = [];
      const mockBot = {
        entity: { position: { x: 100, y: 64, z: 100 } },
        blockAt: (pos) => {
          scannedCoords.push(pos);
          if (pos.x === 102 && pos.y === 64 && pos.z === 100) {
            return { name: 'iron_ore', position: pos };
          }
          return { name: 'stone', position: pos };
        }
      };

      const result = BlockScanner.scan(mockBot, {
        horizontalRadius: 6,
        verticalRadius: 2,
        sampleStep: 2,
        maxSamples: 100
      });

      assert.ok(result.sampledCount <= 100);
      assert.ok(result.totalInterestingFound >= 1);
      assert.ok(result.sampled.some(b => b.name === 'iron_ore'));
    });

    test('handles null bot or missing blockAt safely', () => {
      const result = BlockScanner.scan(null);
      assert.equal(result.totalInterestingFound, 0);
      assert.equal(result.sampled.length, 0);
    });
  });

  // 9. WorldState history buffer
  describe('WorldState', () => {
    test('records snapshot and enforces bounded history ring buffer', () => {
      const ws = new WorldState({ maxHistory: 5 });
      assert.equal(ws.getHistory().length, 0);

      for (let i = 0; i < 10; i++) {
        ws.recordSnapshot({
          timestamp: Date.now() + i,
          player: { position: { x: i, y: 64, z: 0 } },
          survival: { health: 20, food: 20 },
          threats: { level: 'NONE', hostilesCount: 0 },
          environment: { formattedTime: 'Day', dimension: 'overworld' },
          entities: []
        });
      }

      const history = ws.getHistory();
      assert.equal(history.length, 5);
      // Ring buffer retains latest 5
      assert.equal(history[history.length - 1].position, '9, 64, 0');
    });

    test('getSummary returns compact representation', () => {
      const ws = new WorldState();
      ws.update('player', { position: { x: 120, y: 64, z: -230 }, survival: { health: 20, food: 18 } });
      ws.update('threats', { level: 'MEDIUM', hostilesCount: 2 });
      ws.update('environment', { isNight: true, dimension: 'overworld' });
      ws.update('entities', [{}, {}, {}, {}, {}]);

      const summary = ws.getSummary();
      assert.equal(summary.position, '120, 64, -230');
      assert.equal(summary.health, 20);
      assert.equal(summary.food, 18);
      assert.equal(summary.time, 'night');
      assert.equal(summary.dimension, 'overworld');
      assert.equal(summary.entities, 5);
      assert.equal(summary.hostiles, 2);
      assert.equal(summary.threat, 'MEDIUM');
    });
  });

  // 10. PerceptionManager Lifecycle & Event Emission
  describe('PerceptionManager', () => {
    test('initializes, starts, emits granular events, and stops cleanly', async () => {
      const bus = new EventBus();
      const ws = new WorldState();
      const pm = new PerceptionManager({
        worldState: ws,
        fastPollMs: 50,
        mediumPollMs: 100,
        slowPollMs: 150
      });

      let playerEventCount = 0;
      let worldEventCount = 0;

      bus.on(EventBus.EVENTS.PLAYER_UPDATED, () => { playerEventCount++; });
      bus.on(EventBus.EVENTS.WORLD_UPDATED, () => { worldEventCount++; });

      const mockBot = {
        entity: { position: { x: 0, y: 64, z: 0 } },
        health: 20,
        food: 20,
        entities: {}
      };

      pm.initialize(mockBot, bus);
      assert.equal(pm._initialized, true);

      pm.start();
      assert.equal(pm._isRunning, true);

      // Allow a poll cycle to run
      await new Promise(resolve => setTimeout(resolve, 120));

      assert.ok(playerEventCount >= 1, 'Expected at least 1 player:updated event');
      assert.ok(worldEventCount >= 1, 'Expected at least 1 world:updated event');

      pm.stop();
      assert.equal(pm._isRunning, false);
      pm.destroy();
      bus.destroy();
    });
  });

  // 11. REST API Endpoints Verification
  describe('World API Endpoints', () => {
    let app, server, port, brain;

    beforeEach(async () => {
      brain = new AgentBrain({ tickIntervalMs: 200 });
      brain.initialize();
      // Populate mock world state
      brain.worldState.update('player', {
        connected: true,
        spawned: true,
        position: { x: 50, y: 64, z: -100 },
        survival: { health: 18, food: 19 }
      });
      brain.worldState.update('threats', {
        level: 'LOW',
        hostilesCount: 1,
        closestHostile: { name: 'spider', distance: 18.5 },
        reasons: ['1 hostile mob in perception range (18.5m)']
      });
      brain.worldState.update('entities', [
        { id: 10, name: 'spider', type: 'mob', classification: 'HOSTILE', distance: 18.5 }
      ]);
      brain.worldState.update('players', [
        { id: 2, username: 'FriendlyPlayer', distance: 12.0 }
      ]);

      app = express();
      app.use(express.json());
      app.use('/api/world', createWorldRouter(brain));

      await new Promise(resolve => {
        server = app.listen(0, '127.0.0.1', () => {
          port = server.address().port;
          resolve();
        });
      });
    });

    afterEach(async () => {
      await brain.destroy();
      await new Promise(resolve => server.close(resolve));
    });

    const request = (path) => {
      return new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}${path}`, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(data) });
            } catch (e) {
              resolve({ status: res.statusCode, raw: data });
            }
          });
        }).on('error', reject);
      });
    };

    test('GET /api/world/state returns expected schema', async () => {
      const res = await request('/api/world/state');
      assert.equal(res.status, 200);
      assert.equal(res.body.survival.health, 18);
      assert.equal(res.body.threats.level, 'LOW');
      assert.equal(res.body.entities.length, 1);
    });

    test('GET /api/world/summary returns dashboard summary schema', async () => {
      const res = await request('/api/world/summary');
      assert.equal(res.status, 200);
      assert.equal(res.body.position, '50, 64, -100');
      assert.equal(res.body.health, 18);
      assert.equal(res.body.food, 19);
      assert.equal(res.body.threat, 'LOW');
      assert.equal(res.body.hostiles, 1);
    });

    test('GET /api/world/entities returns observable entities and counts', async () => {
      const res = await request('/api/world/entities');
      assert.equal(res.status, 200);
      assert.equal(res.body.total, 1);
      assert.equal(res.body.hostilesCount, 1);
      assert.equal(res.body.entities[0].name, 'spider');
    });

    test('GET /api/world/players returns nearby players list', async () => {
      const res = await request('/api/world/players');
      assert.equal(res.status, 200);
      assert.equal(res.body.total, 1);
      assert.equal(res.body.players[0].username, 'FriendlyPlayer');
    });

    test('GET /api/world/threats returns threat assessment', async () => {
      const res = await request('/api/world/threats');
      assert.equal(res.status, 200);
      assert.equal(res.body.level, 'LOW');
      assert.equal(res.body.hostilesCount, 1);
    });

    test('GET /api/world/history returns snapshots history array', async () => {
      const res = await request('/api/world/history');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.history));
    });
  });

});
