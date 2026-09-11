const express = require('express');
const SurvivalState = require('../survival/SurvivalState');

function createSurvivalRouter(brain) {
  const router = express.Router();

  router.get('/state', (req, res) => {
    if (!brain || !brain.worldState) {
      return res.status(503).json({ error: 'Brain or WorldState not initialized' });
    }
    const state = SurvivalState.evaluate(brain.worldState);
    res.json(state);
  });

  router.get('/status', (req, res) => {
    if (!brain || !brain.survivalEngine) {
      return res.status(503).json({ error: 'Survival engine not initialized' });
    }
    res.json({
      state: brain.survivalEngine.currentSurvivalState,
      highestPriority: brain.survivalEngine.highestPriority,
      activeSurvivalTask: brain.survivalEngine.activeSurvivalTask
    });
  });

  router.get('/priorities', (req, res) => {
    if (!brain || !brain.survivalEngine) {
      return res.status(503).json({ error: 'Survival engine not initialized' });
    }
    res.json({ priorities: brain.survivalEngine.currentPriorities || [] });
  });

  return router;
}

module.exports = createSurvivalRouter;
