const express = require('express');

/**
 * createBrainRouter
 * Mounts secure, validated REST endpoints for Brain telemetry and task management.
 * @param {import('../brain/AgentBrain')} brain 
 * @returns {express.Router}
 */
function createBrainRouter(brain) {
  if (!brain) {
    throw new Error('AgentBrain instance is required to create brain router');
  }

  const router = express.Router();

  // Middleware: Reject prototype pollution attempts
  router.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      if (Object.prototype.hasOwnProperty.call(req.body, '__proto__') ||
          Object.prototype.hasOwnProperty.call(req.body, 'constructor') ||
          Object.prototype.hasOwnProperty.call(req.body, 'prototype')) {
        return res.status(400).json({ error: 'Invalid request payload' });
      }
    }
    next();
  });

  /**
   * GET /api/brain/state
   * Comprehensive, safe snapshot of the agent brain.
   */
  router.get('/state', (req, res) => {
    try {
      const stateJson = brain.state.toJSON();
      const worldJson = brain.worldState.getSnapshot();

      // Ensure no sensitive credentials leak
      res.json({
        state: stateJson.state,
        mode: stateJson.mode,
        currentGoal: stateJson.currentGoal,
        currentTask: stateJson.currentTask,
        currentAction: stateJson.currentAction,
        previousAction: stateJson.previousAction,
        decision: stateJson.decision,
        decisionReason: stateJson.decisionReason,
        processHealth: stateJson.processHealth,
        taskProgress: stateJson.taskProgress,
        uptime: stateJson.uptime,
        lastActivity: stateJson.lastActivity,
        world: {
          connected: worldJson.connected,
          spawned: worldJson.spawned,
          health: worldJson.health,
          food: worldJson.food,
          position: worldJson.position,
          time: worldJson.time,
          dimension: worldJson.dimension
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve brain state' });
    }
  });

  /**
   * GET /api/brain/tasks
   * Returns all tasks in queue.
   */
  router.get('/tasks', (req, res) => {
    try {
      const tasks = brain.taskManager.getAllTasks().map(t => t.toJSON());
      const activeTask = brain.taskManager.getActiveTask();
      res.json({
        total: tasks.length,
        activeTaskId: activeTask ? activeTask.id : null,
        tasks
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve tasks' });
    }
  });

  /**
   * POST /api/brain/tasks
   * Create a new task.
   */
  router.post('/tasks', (req, res) => {
    try {
      const { name, description = '', priority = 5, metadata = {} } = req.body || {};

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Field "name" is required and must be a non-empty string' });
      }

      if (name.length > 100) {
        return res.status(400).json({ error: 'Field "name" must not exceed 100 characters' });
      }

      if (description && (typeof description !== 'string' || description.length > 500)) {
        return res.status(400).json({ error: 'Field "description" must be a string under 500 characters' });
      }

      let parsedPriority = 5;
      if (priority !== undefined) {
        const num = Number(priority);
        if (!Number.isInteger(num) || num < 1 || num > 100) {
          return res.status(400).json({ error: 'Field "priority" must be an integer between 1 and 100' });
        }
        parsedPriority = num;
      }

      const task = brain.taskManager.createTask({
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() : '',
        priority: parsedPriority,
        metadata: typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata) ? metadata : {}
      });

      res.status(201).json({
        message: 'Task created successfully',
        task: task.toJSON()
      });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Failed to create task' });
    }
  });

  /**
   * POST /api/brain/tasks/:id/start
   */
  router.post('/tasks/:id/start', (req, res) => {
    try {
      const task = brain.taskManager.startTask(req.params.id);
      res.json({ message: `Task "${task.name}" started`, task: task.toJSON() });
    } catch (err) {
      const status = err.message.includes('not found') ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  /**
   * POST /api/brain/tasks/:id/pause
   */
  router.post('/tasks/:id/pause', (req, res) => {
    try {
      const task = brain.taskManager.pauseTask(req.params.id);
      res.json({ message: `Task "${task.name}" paused`, task: task.toJSON() });
    } catch (err) {
      const status = err.message.includes('not found') ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  /**
   * POST /api/brain/tasks/:id/resume
   */
  router.post('/tasks/:id/resume', (req, res) => {
    try {
      const task = brain.taskManager.resumeTask(req.params.id);
      res.json({ message: `Task "${task.name}" resumed`, task: task.toJSON() });
    } catch (err) {
      const status = err.message.includes('not found') ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  /**
   * POST /api/brain/tasks/:id/cancel
   */
  router.post('/tasks/:id/cancel', (req, res) => {
    try {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'User requested cancellation';
      const task = brain.taskManager.cancelTask(req.params.id, reason);
      res.json({ message: `Task "${task.name}" cancelled`, task: task.toJSON() });
    } catch (err) {
      const status = err.message.includes('not found') ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  /**
   * POST /api/brain/mode
   * Switch agent mode: AFK, AUTONOMOUS, MANUAL
   */
  router.post('/mode', (req, res) => {
    try {
      const { mode } = req.body || {};
      if (!mode || typeof mode !== 'string') {
        return res.status(400).json({ error: 'Field "mode" is required' });
      }

      const upperMode = mode.trim().toUpperCase();
      brain.setMode(upperMode);
      res.json({
        message: `Mode successfully set to ${upperMode}`,
        mode: brain.state.mode
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * GET /api/brain/events
   * Returns recent bounded telemetry events.
   */
  router.get('/events', (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
      const type = typeof req.query.type === 'string' ? req.query.type : null;
      const events = brain.logger.getEvents(limit, type);
      res.json({
        total: events.length,
        events
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve events' });
    }
  });

  /**
   * GET /api/brain/goals
   */
  router.get('/goals', (req, res) => {
    try {
      const goals = brain.goalManager.getAllGoals();
      const activeGoal = brain.goalManager.getActiveGoal();
      res.json({
        total: goals.length,
        activeGoalId: activeGoal ? activeGoal.id : null,
        goals
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve goals' });
    }
  });

  /**
   * POST /api/brain/goals
   */
  router.post('/goals', (req, res) => {
    try {
      const { name, description = '', priority = 5, metadata = {} } = req.body || {};
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Field "name" is required' });
      }

      const goal = brain.goalManager.createGoal({
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() : '',
        priority: Number.isFinite(priority) ? Math.max(1, Math.min(100, Math.round(priority))) : 5,
        metadata
      });

      res.status(201).json({
        message: 'Goal created successfully',
        goal
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createBrainRouter;
