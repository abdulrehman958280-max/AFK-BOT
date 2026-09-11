const express = require('express');

function createMemoryApi(agentBrain) {
  const router = express.Router();

  router.get('/summary', (req, res) => {
    if (!agentBrain || !agentBrain.memoryManager || !agentBrain.memoryManager.memory) {
      return res.status(503).json({ error: 'Memory system unavailable' });
    }
    
    const memory = agentBrain.memoryManager.memory;
    res.json({
      chunks: memory.chunks.chunks.size,
      waypoints: memory.waypoints.waypoints.size,
      resources: memory.resources.resources.length,
      threats: memory.threats.threats.length
    });
  });

  router.get('/waypoints', (req, res) => {
    if (!agentBrain || !agentBrain.memoryManager || !agentBrain.memoryManager.memory) {
      return res.status(503).json({ error: 'Memory system unavailable' });
    }
    res.json(agentBrain.memoryManager.memory.waypoints.getAllWaypoints());
  });

  return router;
}

module.exports = createMemoryApi;
