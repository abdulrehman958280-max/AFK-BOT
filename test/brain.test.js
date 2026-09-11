const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const EventBus = require('../src/brain/EventBus');
const AgentState = require('../src/brain/AgentState');
const GoalManager = require('../src/brain/GoalManager');
const Task = require('../src/tasks/Task');
const TaskQueue = require('../src/tasks/TaskQueue');
const TaskManager = require('../src/brain/TaskManager');
const DecisionEngine = require('../src/brain/DecisionEngine');
const ActionRegistry = require('../src/actions/ActionRegistry');
const ActionExecutor = require('../src/actions/ActionExecutor');
const BrainLogger = require('../src/telemetry/BrainLogger');
const AgentBrain = require('../src/brain/AgentBrain');
const createBrainRouter = require('../src/api/brainApi');

describe('Autonomous Brain Foundation Tests', () => {

  // 1. EventBus
  describe('EventBus', () => {
    test('emits and receives events safely without throwing on listener failure', () => {
      const bus = new EventBus();
      let received = null;
      let errorReceived = null;

      bus.on('agent:error', (err) => {
        errorReceived = err;
      });

      bus.on('test:event', () => {
        throw new Error('Listener crash test');
      });

      bus.on('test:event', (payload) => {
        received = payload;
      });

      assert.doesNotThrow(() => {
        bus.emit('test:event', { data: 'ok' });
      });

      assert.deepEqual(received, { data: 'ok' });
      assert.ok(errorReceived);
      assert.equal(errorReceived.error, 'Listener crash test');

      bus.destroy();
    });
  });

  // 2. AgentState
  describe('AgentState', () => {
    test('transitions between valid states and rejects invalid transitions', () => {
      const bus = new EventBus();
      const state = new AgentState(bus, AgentState.MODES.AFK);

      assert.equal(state.state, AgentState.STATES.STOPPED);
      assert.equal(state.mode, AgentState.MODES.AFK);

      state.transitionTo(AgentState.STATES.IDLE, 'Booted');
      assert.equal(state.state, AgentState.STATES.IDLE);

      assert.throws(() => {
        state.transitionTo('INVALID_STATE');
      }, /Invalid state transition/);

      state.setMode(AgentState.MODES.AUTONOMOUS);
      assert.equal(state.mode, AgentState.MODES.AUTONOMOUS);

      assert.throws(() => {
        state.setMode('GOD_MODE');
      }, /Invalid mode/);

      const json = state.toJSON();
      assert.equal(json.state, AgentState.STATES.IDLE);
      assert.equal(json.mode, AgentState.MODES.AUTONOMOUS);
      assert.equal(json.processHealth, 'healthy');

      bus.destroy();
    });
  });

  // 3. GoalManager
  describe('GoalManager', () => {
    test('creates, activates, pauses, and completes goals', () => {
      const bus = new EventBus();
      const gm = new GoalManager(bus);

      const goal = gm.createGoal({
        name: 'Survive the night',
        description: 'Stay safe in shelter',
        priority: 10
      });

      assert.ok(goal.id);
      assert.equal(goal.status, 'PENDING');
      assert.equal(goal.priority, 10);

      const activated = gm.setActiveGoal(goal.id);
      assert.equal(activated.status, 'ACTIVE');
      assert.equal(gm.getActiveGoal()?.id, goal.id);

      const paused = gm.pauseGoal(goal.id);
      assert.equal(paused.status, 'PAUSED');
      assert.equal(gm.getActiveGoal(), null);

      const resumed = gm.resumeGoal(goal.id);
      assert.equal(resumed.status, 'ACTIVE');

      const completed = gm.completeGoal(goal.id, { result: 'Survived' });
      assert.equal(completed.status, 'COMPLETED');
      assert.equal(gm.getActiveGoal(), null);

      assert.throws(() => {
        gm.setActiveGoal(goal.id);
      }, /terminal state/);

      bus.destroy();
    });
  });

  // 4. Task and TaskQueue
  describe('Task and TaskQueue', () => {
    test('enforces priorities and handles lifecycle transitions', () => {
      const queue = new TaskQueue();

      const lowTask = new Task({ name: 'Clean inventory', priority: 2 });
      const highTask = new Task({ name: 'Flee danger', priority: 10 });
      const medTask = new Task({ name: 'Observe surroundings', priority: 5 });

      queue.enqueue(lowTask);
      queue.enqueue(highTask);
      queue.enqueue(medTask);

      assert.equal(queue.size(), 3);
      assert.equal(queue.peek().id, highTask.id);

      const popped = queue.dequeue();
      assert.equal(popped.id, highTask.id);

      // Status transitions
      medTask.start();
      assert.equal(medTask.status, Task.STATUSES.RUNNING);

      medTask.updateProgress(50);
      assert.equal(medTask.progress, 50);

      medTask.pause();
      assert.equal(medTask.status, Task.STATUSES.PAUSED);

      medTask.resume();
      assert.equal(medTask.status, Task.STATUSES.RUNNING);

      medTask.complete();
      assert.equal(medTask.status, Task.STATUSES.COMPLETED);
      assert.equal(medTask.isTerminal(), true);
    });
  });

  // 5. TaskManager
  describe('TaskManager', () => {
    test('coordinates tasks with event emission', () => {
      const bus = new EventBus();
      const tm = new TaskManager(bus);

      let createdEvt = null;
      let completedEvt = null;

      bus.on(EventBus.EVENTS.TASK_CREATED, (e) => { createdEvt = e; });
      bus.on(EventBus.EVENTS.TASK_COMPLETED, (e) => { completedEvt = e; });

      const task = tm.createTask({ name: 'Stand guard', priority: 8 });
      assert.ok(task.id);
      assert.ok(createdEvt);
      assert.equal(createdEvt.task.name, 'Stand guard');

      tm.startTask(task.id);
      assert.equal(tm.getActiveTask()?.id, task.id);

      tm.completeTask(task.id, { guardedForSeconds: 60 });
      assert.equal(tm.getActiveTask(), null);
      assert.ok(completedEvt);

      bus.destroy();
    });

    test('rejects invalid task parameters', () => {
      const tm = new TaskManager();
      assert.throws(() => {
        tm.createTask({ name: '' });
      }, /Task name is required/);
    });
  });

  // 6. ActionExecutor & ActionRegistry
  describe('ActionExecutor & ActionRegistry', () => {
    test('executes registered action safely and prevents concurrent collisions', async () => {
      const bus = new EventBus();
      const registry = new ActionRegistry();
      const executor = new ActionExecutor(registry, bus);

      assert.equal(registry.has('IDLE'), true);
      assert.equal(registry.has('STOP'), true);
      assert.equal(registry.has('PAUSE'), true);

      let startedEvt = null;
      let completedEvt = null;
      bus.on(EventBus.EVENTS.ACTION_STARTED, (e) => { startedEvt = e; });
      bus.on(EventBus.EVENTS.ACTION_COMPLETED, (e) => { completedEvt = e; });

      const dummyBot = {
        clearControlStates: () => {},
        pathfinder: { stop: () => {} }
      };

      const result = await executor.execute('STOP', { bot: dummyBot });
      assert.equal(result.success, true);
      assert.ok(startedEvt);
      assert.equal(startedEvt.action, 'STOP');
      assert.ok(completedEvt);

      // Unknown action
      const unknownResult = await executor.execute('TELEPORT_TO_MOON');
      assert.equal(unknownResult.success, false);
      assert.ok(unknownResult.error.includes('not found'));

      bus.destroy();
    });
  });

  // 7. DecisionEngine
  describe('DecisionEngine', () => {
    test('produces structured decisions and technical reasons without fake thoughts', () => {
      const bus = new EventBus();
      const engine = new DecisionEngine(bus);
      const state = new AgentState(bus, AgentState.MODES.AUTONOMOUS);

      // Case A: Disconnected bot
      const decisionDisconnected = engine.decide({
        state,
        worldState: { connected: false, spawned: false }
      });
      assert.equal(decisionDisconnected.selectedAction, 'IDLE');
      assert.ok(decisionDisconnected.reason.includes('waiting for connection'));
      assert.equal(decisionDisconnected.confidence, 1.0);

      // Case B: Connected bot, unimplemented future task
      const futureTask = new Task({ name: 'Chop oak tree', priority: 5 });
      futureTask.start();
      const decisionFuture = engine.decide({
        state,
        task: futureTask,
        worldState: { connected: true, spawned: true }
      });
      assert.equal(decisionFuture.selectedAction, 'IDLE');
      assert.ok(decisionFuture.reason.includes('not implemented in Phase 1'));

      // Case C: Connected bot, foundational STOP task
      const stopTask = new Task({ name: 'Emergency stop bot' });
      stopTask.start();
      const decisionStop = engine.decide({
        state,
        task: stopTask,
        worldState: { connected: true, spawned: true }
      });
      assert.equal(decisionStop.selectedAction, 'STOP');

      bus.destroy();
    });
  });

  // 8. BrainLogger
  describe('BrainLogger', () => {
    test('maintains bounded telemetry history and does not leak memory', () => {
      const logger = new BrainLogger({ maxEvents: 10 });
      for (let i = 0; i < 25; i++) {
        logger.log('test', { seq: i });
      }

      assert.equal(logger.size(), 10);
      const events = logger.getEvents(100);
      assert.equal(events.length, 10);
      assert.equal(events[0].seq, 24); // newest first
    });
  });

  // 9. AgentBrain Lifecycle & Duplicate Protection
  describe('AgentBrain Lifecycle', () => {
    test('starts, ticks, pauses, resumes, and stops cleanly with duplicate protection', async () => {
      const brain = new AgentBrain({ tickIntervalMs: 50 });
      brain.initialize();

      assert.equal(brain.state.state, AgentState.STATES.IDLE);

      const startedFirst = brain.start();
      assert.equal(startedFirst, true);
      assert.equal(brain._isRunning, true);

      // Duplicate start protection
      const startedSecond = brain.start();
      assert.equal(startedSecond, false);

      // Single tick execution
      await brain.tick();
      assert.ok(brain.state.lastDecision);

      // Pause and resume
      brain.pause();
      assert.equal(brain._isPaused, true);
      assert.equal(brain.state.state, AgentState.STATES.PAUSED);

      brain.resume();
      assert.equal(brain._isPaused, false);

      // Clean stop
      const stopped = await brain.stop();
      assert.equal(stopped, true);
      assert.equal(brain._isRunning, false);
      assert.equal(brain.state.state, AgentState.STATES.STOPPED);

      await brain.destroy();
    });
  });

  // 10. HTTP Brain API
  describe('Brain HTTP API', () => {
    let app;
    let server;
    let brain;
    let baseUrl;

    beforeEach(async () => {
      brain = new AgentBrain({ tickIntervalMs: 100 });
      brain.initialize();

      app = express();
      app.use(express.json());
      app.use('/api/brain', createBrainRouter(brain));

      await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const port = server.address().port;
          baseUrl = `http://127.0.0.1:${port}/api/brain`;
          resolve();
        });
      });
    });

    afterEach(async () => {
      await brain.destroy();
      await new Promise((resolve) => server.close(resolve));
    });

    const request = async (path, options = {}) => {
      return new Promise((resolve, reject) => {
        const url = new URL(baseUrl + path);
        const req = http.request(url, {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode,
                data: body ? JSON.parse(body) : null
              });
            } catch (e) {
              resolve({ status: res.statusCode, data: body });
            }
          });
        });
        req.on('error', reject);
        if (options.body) {
          req.write(JSON.stringify(options.body));
        }
        req.end();
      });
    };

    test('GET /api/brain/state returns safe state with no credentials', async () => {
      const res = await request('/state');
      assert.equal(res.status, 200);
      assert.ok(res.data.state);
      assert.ok(res.data.mode);
      assert.equal(res.data.password, undefined);
      assert.equal(res.data.token, undefined);
    });

    test('POST /api/brain/tasks creates task with validation and handles start/pause/cancel', async () => {
      // 1. Invalid task name
      const invalidRes = await request('/tasks', {
        method: 'POST',
        body: { name: '' }
      });
      assert.equal(invalidRes.status, 400);

      // 2. Valid task
      const createRes = await request('/tasks', {
        method: 'POST',
        body: {
          name: 'Explore nearby perimeter',
          description: 'Autonomous area survey',
          priority: 8
        }
      });
      assert.equal(createRes.status, 201);
      assert.ok(createRes.data.task.id);
      const taskId = createRes.data.task.id;

      // 3. Start task
      const startRes = await request(`/tasks/${taskId}/start`, { method: 'POST' });
      assert.equal(startRes.status, 200);
      assert.equal(startRes.data.task.status, 'RUNNING');

      // 4. Pause task
      const pauseRes = await request(`/tasks/${taskId}/pause`, { method: 'POST' });
      assert.equal(pauseRes.status, 200);
      assert.equal(pauseRes.data.task.status, 'PAUSED');

      // 5. Resume task
      const resumeRes = await request(`/tasks/${taskId}/resume`, { method: 'POST' });
      assert.equal(resumeRes.status, 200);
      assert.equal(resumeRes.data.task.status, 'RUNNING');

      // 6. Cancel task
      const cancelRes = await request(`/tasks/${taskId}/cancel`, { method: 'POST', body: { reason: 'Test cancel' } });
      assert.equal(cancelRes.status, 200);
      assert.equal(cancelRes.data.task.status, 'CANCELLED');
    });

    test('POST /api/brain/mode changes mode safely and rejects invalid modes', async () => {
      const validRes = await request('/mode', {
        method: 'POST',
        body: { mode: 'AUTONOMOUS' }
      });
      assert.equal(validRes.status, 200);
      assert.equal(validRes.data.mode, 'AUTONOMOUS');

      const invalidRes = await request('/mode', {
        method: 'POST',
        body: { mode: 'INVINCIBLE' }
      });
      assert.equal(invalidRes.status, 400);
    });

    test('GET /api/brain/events returns telemetry', async () => {
      const res = await request('/events?limit=5');
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.events));
    });
  });
});
