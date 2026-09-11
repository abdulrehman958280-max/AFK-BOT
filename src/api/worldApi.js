const express = require('express');

/**
 * createWorldRouter
 * Mounts secure, read-only REST endpoints for world perception and situational awareness.
 * @param {import('../brain/AgentBrain')} brain 
 * @returns {express.Router}
 */
function createWorldRouter(brain) {
  if (!brain) {
    throw new Error('AgentBrain instance is required to create world router');
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
   * GET /api/world/state
   * Returns complete normalized snapshot of the current WorldState.
   */
  router.get('/state', (req, res) => {
    try {
      const snapshot = brain.worldState.getSnapshot();
      res.json(snapshot);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve world state' });
    }
  });

  /**
   * GET /api/world/summary
   * Returns a compact, dashboard-friendly perception summary.
   */
  router.get('/summary', (req, res) => {
    try {
      const summary = brain.worldState.getSummary();
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve world summary' });
    }
  });

  /**
   * GET /api/world/entities
   * Returns nearby observable entities and hostile/passive counts.
   */
  router.get('/entities', (req, res) => {
    try {
      const snapshot = brain.worldState.getSnapshot();
      res.json({
        total: snapshot.entities.length,
        hostilesCount: snapshot.threats.hostilesCount,
        closestHostile: snapshot.threats.closestHostile,
        entities: snapshot.entities
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve nearby entities' });
    }
  });

  /**
   * GET /api/world/players
   * Returns nearby players safely without exposing credentials.
   */
  router.get('/players', (req, res) => {
    try {
      const snapshot = brain.worldState.getSnapshot();
      res.json({
        total: snapshot.players.length,
        players: snapshot.players
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve nearby players' });
    }
  });

  /**
   * GET /api/world/inventory
   * Returns normalized inventory items, equipment, and capacity summaries.
   */
  router.get('/inventory', (req, res) => {
    try {
      const snapshot = brain.worldState.getSnapshot();
      res.json({
        summary: snapshot.inventory.summary,
        equipment: snapshot.equipment,
        items: snapshot.inventory.items
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve inventory perception' });
    }
  });

  /**
   * GET /api/world/environment
   * Returns environment state (time, weather, biome, dimension, age, difficulty).
   */
  router.get('/environment', (req, res) => {
    try {
      const snapshot = brain.worldState.getSnapshot();
      res.json(snapshot.environment);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve environment perception' });
    }
  });

  /**
   * GET /api/world/threats
   * Returns situational threat evaluation.
   */
  router.get('/threats', (req, res) => {
    try {
      const snapshot = brain.worldState.getSnapshot();
      res.json(snapshot.threats);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve threat assessment' });
    }
  });

  /**
   * GET /api/world/history
   * Returns bounded history of recent world state summaries.
   */
  router.get('/history', (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      const history = brain.worldState.getHistory(limit);
      res.json({
        total: history.length,
        history
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve world history' });
    }
  });

  return router;
}

module.exports = createWorldRouter;
