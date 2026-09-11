const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const config = require('./settings.json');
const express = require('express');
const http = require('http');

// Autonomous Brain Foundation
const AgentBrain = require('./src/brain/AgentBrain');
const createBrainRouter = require('./src/api/brainApi');
const createWorldRouter = require('./src/api/worldApi');
const createSurvivalRouter = require('./src/api/survivalApi');

// Initialize Autonomous Brain (defaults to AFK mode to preserve legacy behavior)
const brain = new AgentBrain({
  tickIntervalMs: 1000,
  initialMode: 'AFK',
  maxTelemetryEvents: 300
});
brain.initialize();
brain.start();

// ============================================================
// EXPRESS SERVER - Keep Render/Aternos alive & Brain Web UI
// ============================================================
const app = express();
const PORT = 3000;

app.use(express.json());
app.use('/api/brain', createBrainRouter(brain));
app.use('/api/world', createWorldRouter(brain));
app.use('/api/survival', createSurvivalRouter(brain));

// Bot state tracking
let botState = {
  connected: false,
  lastActivity: Date.now(),
  reconnectAttempts: 0,
  startTime: Date.now(),
  errors: []
};

// Health check endpoint for monitoring
app.get('/', (req, res) => {
  // "Blue Teal Shadow" Theme - Live Dashboard with Autonomous Brain Foundation
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} - Agent Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #0f172a; 
            color: #f8fafc; 
            margin: 0; 
            padding: 24px;
            min-height: 100vh;
            overflow-y: auto;
          }
          .dashboard-header {
            max-width: 1200px;
            margin: 0 auto 24px auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
            border-bottom: 1px solid #334155;
            padding-bottom: 16px;
          }
          .dashboard-header h1 {
            margin: 0;
            font-size: 22px;
            color: #ccfbf1;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .badge-phase {
            font-size: 11px;
            background: rgba(45, 212, 191, 0.15);
            color: #2dd4bf;
            padding: 4px 10px;
            border-radius: 9999px;
            border: 1px solid #2dd4bf;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
          }
          .grid-container {
            max-width: 1200px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
            gap: 24px;
          }
          .card {
            background: #1e293b;
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            border: 1px solid #334155;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .card-title {
            font-size: 16px;
            font-weight: 700;
            color: #ccfbf1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 0;
            padding-bottom: 8px;
            border-bottom: 1px solid #334155;
          }
          .stat-card {
            background: #0f172a;
            padding: 12px 16px;
            border-radius: 10px;
            border-left: 4px solid #2dd4bf;
          }
          .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; }
          .value { font-size: 16px; font-weight: 600; color: #2dd4bf; margin-top: 4px; word-break: break-all; }
          
          /* Status dot */
          .status-dot { 
            height: 10px; width: 10px; 
            border-radius: 50%; 
            display: inline-block; 
            margin-right: 6px;
            box-shadow: 0 0 8px currentColor;
            background-color: currentColor;
          }
          .pulse { animation: pulse 2s infinite; }
          @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(1.15); }
            100% { opacity: 1; transform: scale(1); }
          }

          /* Mode Switcher */
          .mode-buttons {
            display: flex;
            gap: 8px;
            background: #0f172a;
            padding: 4px;
            border-radius: 10px;
            border: 1px solid #334155;
          }
          .btn-mode {
            flex: 1;
            background: transparent;
            color: #94a3b8;
            border: none;
            padding: 8px 12px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .btn-mode:hover { color: #f8fafc; background: rgba(255, 255, 255, 0.05); }
          .btn-mode.active {
            background: #2dd4bf;
            color: #0f172a;
            box-shadow: 0 0 12px rgba(45, 212, 191, 0.4);
          }

          /* Buttons & Controls */
          .btn-action {
            padding: 5px 10px;
            font-size: 11px;
            font-weight: 600;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            transition: opacity 0.2s;
          }
          .btn-action:hover { opacity: 0.85; }
          .btn-start { background: #4ade80; color: #052e16; }
          .btn-pause { background: #facc15; color: #422006; }
          .btn-cancel { background: #f87171; color: #450a0a; }

          .btn-guide {
            display: block;
            text-align: center;
            padding: 10px 16px; 
            background: #2dd4bf;
            color: #0f172a;
            text-decoration: none; 
            border-radius: 8px;
            font-weight: 700; 
            font-size: 13px;
            box-shadow: 0 0 12px rgba(45, 212, 191, 0.3);
            transition: transform 0.2s;
          }
          .btn-guide:hover { transform: translateY(-1px); }

          /* Task Items & Queue */
          .task-form {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
          }
          .task-input {
            flex: 1;
            background: #0f172a;
            border: 1px solid #334155;
            padding: 8px 12px;
            border-radius: 8px;
            color: #f8fafc;
            font-size: 12px;
          }
          .task-input:focus { outline: 1px solid #2dd4bf; }
          .task-select {
            background: #0f172a;
            border: 1px solid #334155;
            color: #f8fafc;
            padding: 8px 10px;
            border-radius: 8px;
            font-size: 12px;
          }
          .btn-create-task {
            background: #2dd4bf;
            color: #0f172a;
            border: none;
            padding: 8px 14px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 12px;
            cursor: pointer;
            white-space: nowrap;
          }
          .task-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-height: 240px;
            overflow-y: auto;
            padding-right: 4px;
          }
          .task-item {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .task-item-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .task-name { font-size: 13px; font-weight: 600; color: #f8fafc; }
          .task-pill {
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 9999px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .pill-running { background: rgba(74, 222, 128, 0.2); color: #4ade80; border: 1px solid #4ade80; }
          .pill-pending { background: rgba(250, 204, 21, 0.2); color: #facc15; border: 1px solid #facc15; }
          .pill-paused { background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid #a855f7; }
          .pill-completed { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid #38bdf8; }
          .pill-failed { background: rgba(248, 113, 113, 0.2); color: #f87171; border: 1px solid #f87171; }
          .pill-cancelled { background: rgba(148, 163, 184, 0.2); color: #94a3b8; border: 1px solid #94a3b8; }
          
          .progress-bar-bg {
            height: 4px;
            background: #334155;
            border-radius: 2px;
            overflow: hidden;
          }
          .progress-bar-fill {
            height: 100%;
            background: #2dd4bf;
            transition: width 0.3s ease;
          }

          /* Activity Feed */
          .activity-log {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 12px;
            height: 240px;
            overflow-y: auto;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .log-entry {
            display: flex;
            gap: 8px;
            align-items: flex-start;
            line-height: 1.4;
          }
          .log-time { color: #64748b; white-space: nowrap; }
          .log-type {
            font-size: 9px;
            padding: 1px 5px;
            border-radius: 4px;
            text-transform: uppercase;
            font-weight: bold;
            white-space: nowrap;
          }
          .type-state { background: #3b82f6; color: #fff; }
          .type-task { background: #8b5cf6; color: #fff; }
          .type-action { background: #06b6d4; color: #fff; }
          .type-decision { background: #10b981; color: #fff; }
          .type-goal { background: #f59e0b; color: #fff; }
          .type-system { background: #475569; color: #fff; }
          .type-error { background: #ef4444; color: #fff; }
          .log-msg { color: #cbd5e1; word-break: break-word; }

          .connection-bar {
            height: 3px; background: #334155; width: 100%; border-radius: 2px; overflow: hidden;
          }
          .connection-fill {
            height: 100%; width: 100%; background: #2dd4bf;
            animation: loading 2s infinite linear;
            transform-origin: 0% 50%;
          }
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        </style>
      </head>
      <body>
        <div class="dashboard-header">
          <h1>
            <span id="live-indicator" class="status-dot pulse" style="color: #ef4444;"></span>
            ${config.name}
          </h1>
          <span class="badge-phase">Phase 2: World Perception & Situational Awareness</span>
        </div>

        <div class="grid-container">
          <!-- CARD 1: Bot Connection & Minecraft Status -->
          <div class="card" id="card-minecraft-presence">
            <h2 class="card-title">
              <span>Minecraft Presence</span>
              <span id="bot-status-badge" class="task-pill pill-pending">Connecting</span>
            </h2>

            <div class="stat-card">
              <div class="label">Bot Status</div>
              <div class="value" id="status-text">Connecting...</div>
            </div>

            <div class="stat-card">
              <div class="label">Server Connection</div>
              <div class="value">${config.server.ip}:${config.server.port}</div>
            </div>

            <div class="stat-card">
              <div class="label">World Position</div>
              <div class="value" id="coords-text">Waiting for spawn...</div>
            </div>

            <div class="stat-card">
              <div class="label">Uptime</div>
              <div class="value" id="uptime-text">0h 0m 0s</div>
            </div>

            <a href="/tutorial" class="btn-guide" id="link-setup-guide">View Setup & Deployment Guide</a>

            <div class="connection-bar">
              <div class="connection-fill"></div>
            </div>
          </div>

          <!-- CARD 2: Autonomous Brain Foundation Status -->
          <div class="card" id="card-autonomous-brain">
            <h2 class="card-title">
              <span>Autonomous Brain</span>
              <span id="brain-state-badge" class="task-pill pill-running">IDLE</span>
            </h2>

            <div>
              <div class="label" style="margin-bottom: 6px;">Operational Mode</div>
              <div class="mode-buttons">
                <button id="mode-btn-afk" class="btn-mode active" onclick="setAgentMode('AFK')">AFK Mode</button>
                <button id="mode-btn-autonomous" class="btn-mode" onclick="setAgentMode('AUTONOMOUS')">Autonomous</button>
                <button id="mode-btn-manual" class="btn-mode" onclick="setAgentMode('MANUAL')">Manual</button>
              </div>
            </div>

            <div class="stat-card">
              <div class="label">Current Decision & Situational Reason</div>
              <div class="value" id="decision-text" style="font-size: 13px; color: #e2e8f0; font-weight: normal; line-height: 1.5;">
                Evaluating state...
              </div>
            </div>

            <div class="stat-card">
              <div class="label">Active Goal</div>
              <div class="value" id="active-goal-text">None</div>
            </div>

            <div class="stat-card">
              <div class="label">Active Task / Action</div>
              <div class="value" id="active-task-text">None (Action: IDLE)</div>
            </div>
          </div>

          
          <!-- CARD 2.5: SURVIVAL ENGINE -->
          <div class="card" id="card-survival-engine">
            <h2 class="card-title">
              <span>Survival Status</span>
              <span id="survival-status-badge" class="task-pill pill-running">ACTIVE</span>
            </h2>

            <div class="stat-card">
              <div class="label">Current Survival Goal</div>
              <div class="value" id="survival-goal-text">None</div>
            </div>

            <div class="stat-card">
              <div class="label">Current Action</div>
              <div class="value" id="survival-action-text">None</div>
            </div>
            
            <div class="stat-card" style="border-left-color: #f59e0b;">
              <div class="label">Decision Rationale</div>
              <div class="value" id="survival-decision-text" style="font-size: 13px; color: #cbd5e1; font-weight: normal; margin-top: 4px;">
                Evaluating...
              </div>
            </div>

            <div class="label" style="margin-top: 8px;">Priorities</div>
            <div id="survival-priorities-container" style="display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto; background: #0f172a; padding: 8px; border-radius: 8px; border: 1px solid #334155;">
              <div style="color: #64748b; font-size: 12px; padding: 6px;">Loading priorities...</div>
            </div>
          </div>

          <!-- CARD 3: "What The Bot Sees" / Situational Awareness -->
          <div class="card" id="card-world-perception">
            <h2 class="card-title">
              <span>What The Bot Sees</span>
              <span id="world-threat-badge" class="task-pill pill-running" style="background: #10b981; color: #0f172a; font-weight: 700;">THREAT: NONE</span>
            </h2>

            <!-- Survival vitals -->
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                  <span class="label">Health</span>
                  <span id="world-health-val" style="color: #ef4444; font-weight: 600;">20 / 20</span>
                </div>
                <div style="background: #0f172a; height: 8px; border-radius: 4px; overflow: hidden; border: 1px solid #334155;">
                  <div id="world-health-bar" style="background: #ef4444; height: 100%; width: 100%; transition: width 0.3s ease;"></div>
                </div>
              </div>

              <div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                  <span class="label">Food / Hunger</span>
                  <span id="world-food-val" style="color: #f59e0b; font-weight: 600;">20 / 20</span>
                </div>
                <div style="background: #0f172a; height: 8px; border-radius: 4px; overflow: hidden; border: 1px solid #334155;">
                  <div id="world-food-bar" style="background: #f59e0b; height: 100%; width: 100%; transition: width 0.3s ease;"></div>
                </div>
              </div>
            </div>

            <!-- Environment Details -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div class="stat-card" style="padding: 8px 12px;">
                <div class="label">Time / Sky</div>
                <div class="value" id="world-time-text" style="font-size: 13px;">Day (06:00)</div>
              </div>
              <div class="stat-card" style="padding: 8px 12px;">
                <div class="label">Weather</div>
                <div class="value" id="world-weather-text" style="font-size: 13px;">Clear</div>
              </div>
              <div class="stat-card" style="padding: 8px 12px;">
                <div class="label">Biome</div>
                <div class="value" id="world-biome-text" style="font-size: 13px;">unknown</div>
              </div>
              <div class="stat-card" style="padding: 8px 12px;">
                <div class="label">Dimension</div>
                <div class="value" id="world-dimension-text" style="font-size: 13px;">overworld</div>
              </div>
            </div>

            <!-- Threat details -->
            <div class="stat-card" style="border-left-color: #f59e0b;">
              <div class="label">Threat Assessment</div>
              <div class="value" id="world-threat-reason" style="font-size: 12px; color: #cbd5e1; font-weight: normal; margin-top: 2px;">
                No immediate threats detected.
              </div>
            </div>
          </div>

          <!-- CARD 4: Nearby Entities & Threat Radar -->
          <div class="card" id="card-entities-radar">
            <h2 class="card-title">
              <span>Nearby Entities Radar</span>
              <span id="entities-count-badge" style="font-size: 12px; color: #94a3b8;">0 entities</span>
            </h2>

            <div style="display: flex; gap: 8px;">
              <div class="stat-card" style="flex: 1; padding: 8px 12px;">
                <div class="label">Hostile Mobs</div>
                <div class="value" id="hostiles-count-text" style="font-size: 15px; color: #ef4444;">0</div>
              </div>
              <div class="stat-card" style="flex: 1; padding: 8px 12px;">
                <div class="label">Nearby Players</div>
                <div class="value" id="players-count-text" style="font-size: 15px; color: #38bdf8;">0</div>
              </div>
            </div>

            <div class="label">Observable Entities & Players</div>
            <div id="entities-list-container" style="display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto; background: #0f172a; padding: 8px; border-radius: 8px; border: 1px solid #334155;">
              <div style="color: #64748b; font-size: 12px; text-align: center; padding: 12px;">No entities nearby within perception radius.</div>
            </div>
          </div>

          <!-- CARD 5: Inventory & Spatial Blocks -->
          <div class="card" id="card-inventory-blocks">
            <h2 class="card-title">
              <span>Inventory & Spatial Blocks</span>
              <span id="inventory-capacity-badge" style="font-size: 12px; color: #94a3b8;">0 / 36 slots</span>
            </h2>

            <!-- Equipment slots -->
            <div style="background: #0f172a; padding: 8px 12px; border-radius: 8px; border: 1px solid #334155;">
              <div class="label" style="margin-bottom: 4px;">Equipped Gear</div>
              <div id="equipment-container" style="display: flex; flex-wrap: wrap; gap: 6px; font-size: 11px;">
                <span class="task-pill pill-pending">Hand: Empty</span>
                <span class="task-pill pill-pending">Armor: None</span>
              </div>
            </div>

            <!-- Inventory items -->
            <div class="label">Inventory Items</div>
            <div id="inventory-items-container" style="display: flex; flex-wrap: wrap; gap: 4px; max-height: 110px; overflow-y: auto; background: #0f172a; padding: 8px; border-radius: 8px; border: 1px solid #334155;">
              <div style="color: #64748b; font-size: 12px; padding: 6px;">Inventory empty or not spawned.</div>
            </div>

            <!-- Interesting nearby blocks -->
            <div class="label">Nearby Blocks Sampled</div>
            <div id="blocks-summary-container" style="display: flex; flex-wrap: wrap; gap: 4px; font-size: 11px; background: #0f172a; padding: 8px; border-radius: 8px; border: 1px solid #334155;">
              <span style="color: #64748b; font-size: 12px;">Scanning radius around agent...</span>
            </div>
          </div>

          <!-- CARD 6: Task Queue & Management -->
          <div class="card" id="card-task-management">
            <h2 class="card-title">
              <span>Task Management</span>
              <span id="task-count-badge" style="font-size: 12px; color: #94a3b8;">0 tasks</span>
            </h2>

            <form class="task-form" onsubmit="handleCreateTask(event)">
              <input id="new-task-name" class="task-input" type="text" placeholder="Task name (e.g. Survey area, Patrol, Standby)" required maxlength="100" />
              <select id="new-task-priority" class="task-select">
                <option value="10">High (10)</option>
                <option value="8">Elevated (8)</option>
                <option value="5" selected>Normal (5)</option>
                <option value="2">Low (2)</option>
              </select>
              <button type="submit" class="btn-create-task" id="btn-submit-task">+ Create</button>
            </form>

            <div class="task-list" id="task-list-container">
              <div style="color: #64748b; font-size: 12px; text-align: center; padding: 20px;">
                No active or queued tasks. Use the form above to add a task.
              </div>
            </div>
          </div>

          <!-- CARD 7: Real-Time Brain Activity Feed -->
          <div class="card" id="card-activity-log" style="grid-column: 1 / -1;">
            <h2 class="card-title">
              <span>Brain Telemetry & Situational Logs</span>
              <span id="log-count-badge" style="font-size: 12px; color: #94a3b8;">Live feed</span>
            </h2>

            <div class="activity-log" id="activity-log-container" style="max-height: 220px;">
              <div style="color: #64748b; text-align: center; padding: 20px;">Connecting to telemetry stream...</div>
            </div>
          </div>
        </div>

        <script>
          const formatUptime = (seconds) => {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            return \`\${h}h \${m}m \${s}s\`;
          };

          const setAgentMode = async (mode) => {
            try {
              const res = await fetch('/api/brain/mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
              });
              if (res.ok) {
                updateBrainDashboard();
              }
            } catch (err) {
              console.error('Failed to set agent mode', err);
            }
          };

          const handleCreateTask = async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('new-task-name');
            const priorityInput = document.getElementById('new-task-priority');
            const name = nameInput.value.trim();
            const priority = parseInt(priorityInput.value, 10) || 5;

            if (!name) return;

            try {
              const res = await fetch('/api/brain/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, priority })
              });
              if (res.ok) {
                nameInput.value = '';
                updateBrainDashboard();
              }
            } catch (err) {
              console.error('Failed to create task', err);
            }
          };

          const handleTaskAction = async (taskId, action) => {
            try {
              const res = await fetch(\`/api/brain/tasks/\${taskId}/\${action}\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              if (res.ok) {
                updateBrainDashboard();
              }
            } catch (err) {
              console.error(\`Failed to \${action} task\`, err);
            }
          };

          const updateBrainDashboard = async () => {
            try {
              // 1. Fetch Minecraft server /health
              const healthRes = await fetch('/health');
              const healthData = await healthRes.json();
              
              const statusText = document.getElementById('status-text');
              const statusBadge = document.getElementById('bot-status-badge');
              const uptimeText = document.getElementById('uptime-text');
              const coordsText = document.getElementById('coords-text');
              const liveDot = document.getElementById('live-indicator');

              if (healthData.status === 'connected') {
                statusText.innerHTML = '<span class="status-dot" style="color: #4ade80;"></span> Online & Running';
                statusBadge.className = 'task-pill pill-running';
                statusBadge.innerText = 'Connected';
                liveDot.style.color = '#4ade80';
              } else {
                statusText.innerHTML = '<span class="status-dot" style="color: #f87171;"></span> Reconnecting...';
                statusBadge.className = 'task-pill pill-failed';
                statusBadge.innerText = 'Reconnecting';
                liveDot.style.color = '#f87171';
              }

              uptimeText.innerText = formatUptime(healthData.uptime);

              if (healthData.coords) {
                coordsText.innerText = \`X: \${Math.floor(healthData.coords.x)}, Y: \${Math.floor(healthData.coords.y)}, Z: \${Math.floor(healthData.coords.z)}\`;
              } else {
                coordsText.innerText = 'Waiting for spawn...';
              }

              // 2. Fetch Brain state
              const brainRes = await fetch('/api/brain/state');
              const brainData = await brainRes.json();

              // Mode buttons update
              ['afk', 'autonomous', 'manual'].forEach(m => {
                const btn = document.getElementById(\`mode-btn-\${m}\`);
                if (btn) {
                  btn.classList.toggle('active', brainData.mode?.toLowerCase() === m);
                }
              });

              // State pill
              const stateBadge = document.getElementById('brain-state-badge');
              if (stateBadge) {
                stateBadge.innerText = brainData.state || 'IDLE';
                stateBadge.className = brainData.state === 'EXECUTING' ? 'task-pill pill-running' :
                                       brainData.state === 'PAUSED' ? 'task-pill pill-paused' :
                                       brainData.state === 'ERROR' ? 'task-pill pill-failed' : 'task-pill pill-pending';
              }

              // Decision
              const decText = document.getElementById('decision-text');
              if (decText) {
                decText.innerText = brainData.decisionReason || 'Standing by.';
              }

              // Goal
              const goalText = document.getElementById('active-goal-text');
              if (goalText) {
                goalText.innerText = brainData.currentGoal ? \`\${brainData.currentGoal.name} (Priority \${brainData.currentGoal.priority})\` : 'None';
              }

              // Task / Action
              const taskText = document.getElementById('active-task-text');
              if (taskText) {
                const currentActionName = brainData.currentAction?.name || 'IDLE';
                const currentTaskName = brainData.currentTask?.name || 'None';
                taskText.innerText = \`\${currentTaskName} (Action: \${currentActionName})\`;
              }

              
              // 2.5 Fetch Survival Status
              try {
                const survRes = await fetch("/api/survival/status");
                if (survRes.ok) {
                  const survData = await survRes.json();
                  
                  if (survData.highestPriority) {
                    document.getElementById("survival-goal-text").innerText = survData.highestPriority.goal;
                    document.getElementById("survival-decision-text").innerText = survData.highestPriority.reason;
                  }
                  
                  if (survData.activeSurvivalTask) {
                    document.getElementById("survival-action-text").innerText = survData.activeSurvivalTask.metadata?.action || "Working...";
                  } else {
                    document.getElementById("survival-action-text").innerText = "None (Delegated to User Task)";
                  }
                }
                
                const priRes = await fetch("/api/survival/priorities");
                if (priRes.ok) {
                  const priData = await priRes.json();
                  const priContainer = document.getElementById("survival-priorities-container");
                  if (priData.priorities && priData.priorities.length > 0) {
                    priContainer.innerHTML = priData.priorities.map((p, i) => {
                      const isTop = i === 0;
                      return \`
                        <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 4px 6px; background: \${isTop ? 'rgba(45, 212, 191, 0.1)' : 'rgba(255,255,255,0.03)'}; border-radius: 4px; border-left: 2px solid \${isTop ? '#2dd4bf' : 'transparent'};">
                          <span style="color: \${isTop ? '#2dd4bf' : '#f8fafc'};">\${p.goal}</span>
                          <span style="color: #94a3b8; font-weight: bold;">\${p.priority}</span>
                        </div>
                      \`;
                    }).join("");
                  }
                }
              } catch(se) { console.warn("Survival state fetch error", se); }

              // 3. Fetch World Perception state from /api/world/state
              try {
                const worldRes = await fetch('/api/world/state');
                if (worldRes.ok) {
                  const world = await worldRes.json();
                  
                  // Vitals
                  const healthVal = typeof world.survival?.health === 'number' ? world.survival.health : 20;
                  const foodVal = typeof world.survival?.food === 'number' ? world.survival.food : 20;
                  document.getElementById('world-health-val').innerText = \`\${healthVal} / 20\`;
                  document.getElementById('world-health-bar').style.width = \`\${Math.min(100, Math.max(0, (healthVal / 20) * 100))}%\`;
                  
                  document.getElementById('world-food-val').innerText = \`\${foodVal} / 20\`;
                  document.getElementById('world-food-bar').style.width = \`\${Math.min(100, Math.max(0, (foodVal / 20) * 100))}%\`;

                  // Environment
                  document.getElementById('world-time-text').innerText = world.environment?.formattedTime || 'Day';
                  document.getElementById('world-weather-text').innerText = world.environment?.weather ? world.environment.weather.toUpperCase() : 'CLEAR';
                  document.getElementById('world-biome-text').innerText = world.environment?.biome || 'unknown';
                  document.getElementById('world-dimension-text').innerText = world.environment?.dimension || 'overworld';

                  // Threats
                  const threatLevel = world.threats?.level || 'NONE';
                  const threatBadge = document.getElementById('world-threat-badge');
                  threatBadge.innerText = \`THREAT: \${threatLevel}\`;
                  if (threatLevel === 'CRITICAL') {
                    threatBadge.style.background = '#ef4444';
                    threatBadge.style.color = '#fff';
                  } else if (threatLevel === 'HIGH') {
                    threatBadge.style.background = '#f97316';
                    threatBadge.style.color = '#fff';
                  } else if (threatLevel === 'MEDIUM') {
                    threatBadge.style.background = '#f59e0b';
                    threatBadge.style.color = '#0f172a';
                  } else if (threatLevel === 'LOW') {
                    threatBadge.style.background = '#06b6d4';
                    threatBadge.style.color = '#0f172a';
                  } else {
                    threatBadge.style.background = '#10b981';
                    threatBadge.style.color = '#0f172a';
                  }

                  const threatReasons = Array.isArray(world.threats?.reasons) && world.threats.reasons.length > 0
                    ? world.threats.reasons.join('; ')
                    : 'No immediate threats detected.';
                  document.getElementById('world-threat-reason').innerText = threatReasons;

                  // Hostiles & Players counts
                  document.getElementById('hostiles-count-text').innerText = world.threats?.hostilesCount || 0;
                  document.getElementById('players-count-text').innerText = world.players?.length || 0;
                  document.getElementById('entities-count-badge').innerText = \`\${world.entities?.length || 0} entities\`;

                  // Entities list
                  const entContainer = document.getElementById('entities-list-container');
                  if (Array.isArray(world.entities) && world.entities.length > 0) {
                    entContainer.innerHTML = world.entities.slice(0, 8).map(ent => {
                      const isHostile = ent.classification === 'HOSTILE';
                      const badgeColor = isHostile ? '#ef4444' : (ent.type === 'player' ? '#38bdf8' : '#2dd4bf');
                      return \`
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 4px 6px; background: rgba(255,255,255,0.03); border-radius: 4px;">
                          <span><strong style="color: \${badgeColor};">\${ent.name || ent.displayName || ent.type}</strong> \${ent.isSneaking ? '(Sneaking)' : ''}</span>
                          <span style="color: #94a3b8;">\${ent.distance}m (\${ent.bearing})</span>
                        </div>
                      \`;
                    }).join('');
                  } else {
                    entContainer.innerHTML = \`<div style="color: #64748b; font-size: 12px; text-align: center; padding: 12px;">No entities nearby within perception radius.</div>\`;
                  }

                  // Inventory & Equipment
                  const invSummary = world.inventory?.summary || {};
                  document.getElementById('inventory-capacity-badge').innerText = \`\${invSummary.totalCount || 0} items (\${invSummary.emptySlotsCount || 0} slots free)\`;

                  // Equipment
                  const eq = world.equipment || {};
                  const eqContainer = document.getElementById('equipment-container');
                  eqContainer.innerHTML = \`
                    <span class="task-pill pill-running">Main: \${eq.mainHand ? eq.mainHand.name : 'Empty'}</span>
                    <span class="task-pill pill-pending">Off: \${eq.offHand ? eq.offHand.name : 'Empty'}</span>
                    <span class="task-pill pill-pending">Helmet: \${eq.helmet ? eq.helmet.name : 'None'}</span>
                    <span class="task-pill pill-pending">Chest: \${eq.chestplate ? eq.chestplate.name : 'None'}</span>
                    <span class="task-pill pill-pending">Legs: \${eq.leggings ? eq.leggings.name : 'None'}</span>
                    <span class="task-pill pill-pending">Boots: \${eq.boots ? eq.boots.name : 'None'}</span>
                  \`;

                  // Inventory item chips
                  const itemsContainer = document.getElementById('inventory-items-container');
                  if (Array.isArray(world.inventory?.items) && world.inventory.items.length > 0) {
                    itemsContainer.innerHTML = world.inventory.items.slice(0, 16).map(it => \`
                      <span style="background: #1e293b; border: 1px solid #334155; padding: 2px 6px; border-radius: 4px; font-size: 11px; color: #2dd4bf;">
                        \${it.displayName || it.name} <strong style="color: #f8fafc;">x\${it.count}</strong>
                      </span>
                    \`).join('');
                  } else {
                    itemsContainer.innerHTML = \`<div style="color: #64748b; font-size: 12px; padding: 6px;">Inventory empty or not spawned.</div>\`;
                  }

                  // Sampled blocks
                  const blocksContainer = document.getElementById('blocks-summary-container');
                  const sampleBlocks = world.blocks?.sampled || [];
                  if (sampleBlocks.length > 0) {
                    blocksContainer.innerHTML = sampleBlocks.slice(0, 10).map(b => {
                      const color = b.category === 'DANGER' ? '#ef4444' : (b.category === 'RESOURCE' ? '#2dd4bf' : '#38bdf8');
                      return \`
                        <span style="background: #1e293b; border: 1px solid #334155; padding: 2px 6px; border-radius: 4px; color: \${color};">
                          \${b.name} (\${b.distance}m)
                        </span>
                      \`;
                    }).join('');
                  } else {
                    blocksContainer.innerHTML = \`<span style="color: #64748b; font-size: 12px;">No notable hazard/resource blocks in immediate radius.</span>\`;
                  }
                }
              } catch (wErr) {
                console.warn('World state fetch error', wErr);
              }

              // 4. Fetch Tasks
              const tasksRes = await fetch('/api/brain/tasks');
              const tasksData = await tasksRes.json();
              const taskContainer = document.getElementById('task-list-container');
              const taskCountBadge = document.getElementById('task-count-badge');

              if (taskCountBadge) {
                taskCountBadge.innerText = \`\${tasksData.tasks?.length || 0} tasks\`;
              }

              if (taskContainer && Array.isArray(tasksData.tasks)) {
                if (tasksData.tasks.length === 0) {
                  taskContainer.innerHTML = \`<div style="color: #64748b; font-size: 12px; text-align: center; padding: 20px;">No active or queued tasks. Use the form above to add a task.</div>\`;
                } else {
                  taskContainer.innerHTML = tasksData.tasks.map(t => {
                    const pillClass = t.status === 'RUNNING' ? 'pill-running' :
                                      t.status === 'PENDING' ? 'pill-pending' :
                                      t.status === 'PAUSED' ? 'pill-paused' :
                                      t.status === 'COMPLETED' ? 'pill-completed' :
                                      t.status === 'FAILED' ? 'pill-failed' : 'pill-cancelled';

                    let actionsHtml = '';
                    if (t.status === 'PENDING') {
                      actionsHtml = \`<button class="btn-action btn-start" onclick="handleTaskAction('\${t.id}', 'start')">Start</button>
                                     <button class="btn-action btn-cancel" onclick="handleTaskAction('\${t.id}', 'cancel')">Cancel</button>\`;
                    } else if (t.status === 'RUNNING') {
                      actionsHtml = \`<button class="btn-action btn-pause" onclick="handleTaskAction('\${t.id}', 'pause')">Pause</button>
                                     <button class="btn-action btn-cancel" onclick="handleTaskAction('\${t.id}', 'cancel')">Cancel</button>\`;
                    } else if (t.status === 'PAUSED') {
                      actionsHtml = \`<button class="btn-action btn-start" onclick="handleTaskAction('\${t.id}', 'resume')">Resume</button>
                                     <button class="btn-action btn-cancel" onclick="handleTaskAction('\${t.id}', 'cancel')">Cancel</button>\`;
                    }

                    return \`
                      <div class="task-item">
                        <div class="task-item-header">
                          <span class="task-name">\${t.name} <span style="font-size: 10px; color: #94a3b8;">(P\${t.priority})</span></span>
                          <span class="task-pill \${pillClass}">\${t.status}</span>
                        </div>
                        <div class="progress-bar-bg">
                          <div class="progress-bar-fill" style="width: \${t.progress || 0}%;"></div>
                        </div>
                        \${actionsHtml ? \`<div style="display: flex; gap: 6px; justify-content: flex-end; margin-top: 4px;">\${actionsHtml}</div>\` : ''}
                      </div>
                    \`;
                  }).join('');
                }
              }

              // 5. Fetch Events/Telemetry
              const eventsRes = await fetch('/api/brain/events?limit=30');
              const eventsData = await eventsRes.json();
              const logContainer = document.getElementById('activity-log-container');

              if (logContainer && Array.isArray(eventsData.events)) {
                if (eventsData.events.length === 0) {
                  logContainer.innerHTML = \`<div style="color: #64748b; text-align: center; padding: 20px;">No telemetry events recorded yet.</div>\`;
                } else {
                  logContainer.innerHTML = eventsData.events.map(ev => {
                    const time = new Date(ev.timestamp).toLocaleTimeString();
                    const typeClass = \`type-\${ev.type || 'system'}\`;
                    const msg = ev.message || JSON.stringify(ev);
                    return \`
                      <div class="log-entry">
                        <span class="log-time">[\${time}]</span>
                        <span class="log-type \${typeClass}">\${ev.type}</span>
                        <span class="log-msg">\${msg}</span>
                      </div>
                    \`;
                  }).join('');
                }
              }

            } catch (err) {
              console.error('Dashboard poll error:', err);
            }
          };

          // Poll every 1.5 seconds
          setInterval(updateBrainDashboard, 1500);
          updateBrainDashboard();
        </script>
      </body>
    </html>
  `);
});

app.get('/tutorial', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>${config.name} - Setup Guide</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #cbd5e1; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
          h1, h2 { color: #2dd4bf; }
          h1 { border-bottom: 2px solid #334155; padding-bottom: 10px; }
          .card { background: #1e293b; padding: 25px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #334155; }
          a { color: #38bdf8; text-decoration: none; }
          code { background: #334155; padding: 2px 6px; border-radius: 4px; color: #e2e8f0; font-family: monospace; }
          .btn-home { display: inline-block; margin-bottom: 20px; padding: 8px 16px; background: #334155; color: white; border-radius: 6px; text-decoration: none; }
        </style>
      </head>
      <body>
        <a href="/" class="btn-home">Back to Dashboard</a>
        <h1>Setup Guide (Under 15 Minutes)</h1>
        
        <div class="card">
          <h2>Step 1: Configure Aternos</h2>
          <ol>
            <li>Go to <strong>Aternos</strong>.</li>
            <li>Install <strong>Paper/Bukkit</strong> software.</li>
            <li>Enable <strong>Cracked</strong> mode (Green Switch).</li>
            <li>Install Plugins: <code>ViaVersion</code>, <code>ViaBackwards</code>, <code>ViaRewind</code>.</li>
          </ol>
        </div>

        <div class="card">
          <h2>Step 2: GitHub Setup</h2>
          <ol>
            <li>Download this code as ZIP and extract.</li>
            <li>Edit <code>settings.json</code> with your IP/Port.</li>
            <li>Upload all files to a new <strong>GitHub Repository</strong>.</li>
          </ol>
        </div>

        <div class="card">
          <h2>Step 3: Render (Free 24/7 Hosting)</h2>
          <ol>
            <li>Go to <a href="https://render.com" target="_blank">Render.com</a> and create a Web Service.</li>
            <li>Connect your GitHub.</li>
            <li>Build Command: <code>npm install</code></li>
            <li>Start Command: <code>npm start</code></li>
            <li><strong>Magic:</strong> The bot automatically pings itself to stay awake!</li>
          </ol>
        </div>
        
        <p style="text-align: center; margin-top: 40px; color: #64748b;">AFK Bot Dashboard</p>
      </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({
    status: botState.connected ? 'connected' : 'disconnected',
    uptime: Math.floor((Date.now() - botState.startTime) / 1000),
    coords: (bot && bot.entity) ? bot.entity.position : null,
    lastActivity: botState.lastActivity,
    reconnectAttempts: botState.reconnectAttempts,
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
  });
});

app.get('/ping', (req, res) => res.send('pong'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] HTTP server started on port ${PORT}`);
});

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

// ============================================================
// SELF-PING - Prevent Render from sleeping
// ============================================================
const SELF_PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

const https = require('https');

function startSelfPing() {
  setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(`${url}/ping`, (res) => {
      // console.log(`[KeepAlive] Self-ping: ${res.statusCode}`); // Optional: reduce spam
    }).on('error', (err) => {
      console.log(`[KeepAlive] Self-ping failed: ${err.message}`);
    });
  }, SELF_PING_INTERVAL);
  console.log('[KeepAlive] Self-ping system started (every 10 min)');
}

startSelfPing();

// ============================================================
// MEMORY MONITORING
// ============================================================
setInterval(() => {
  const mem = process.memoryUsage();
  const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(2);
  console.log(`[Memory] Heap: ${heapMB} MB`);
}, 5 * 60 * 1000); // Every 5 minutes

// ============================================================
// BOT CREATION WITH RECONNECTION LOGIC
// ============================================================
let bot = null;
let activeIntervals = [];
let reconnectTimeout = null;
let isReconnecting = false;

function clearAllIntervals() {
  console.log(`[Cleanup] Clearing ${activeIntervals.length} intervals`);
  activeIntervals.forEach(id => clearInterval(id));
  activeIntervals = [];
}

function addInterval(callback, delay) {
  const id = setInterval(callback, delay);
  activeIntervals.push(id);
  return id;
}

function getReconnectDelay() {
  // Aggressive reconnection: fast, flat delay or very subtle backoff
  const baseDelay = config.utils['auto-reconnect-delay'] || 2000;
  const maxDelay = config.utils['max-reconnect-delay'] || 15000;

  // Use a much gentler backoff or just a flat delay if user wants "lower"
  // Current logic: attempts * 1000 + base, capped at max
  const delay = Math.min(baseDelay + (botState.reconnectAttempts * 1000), maxDelay);

  return delay;
}

function createBot() {
  if (isReconnecting) {
    console.log('[Bot] Already reconnecting, skipping...');
    return;
  }

  // Cleanup previous bot
  if (bot) {
    clearAllIntervals();
    try {
      bot.removeAllListeners();
      bot.end();
    } catch (e) {
      console.log('[Cleanup] Error ending previous bot:', e.message);
    }
    bot = null;
  }

  console.log(`[Bot] Creating bot instance...`);
  console.log(`[Bot] Connecting to ${config.server.ip}:${config.server.port}`);

  try {
    bot = mineflayer.createBot({
      username: config['bot-account'].username,
      password: config['bot-account'].password || undefined,
      auth: config['bot-account'].type,
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
      hideErrors: false,
      checkTimeoutInterval: 120000 // 2 minutes - detects dead connections without false-positive disconnects
    });

    // Attach bot to autonomous brain perception
    brain.attachBot(bot);

    bot.loadPlugin(pathfinder);

    // Connection timeout - if no spawn in 60s, reconnect
    const connectionTimeout = setTimeout(() => {
      if (!botState.connected) {
        console.log('[Bot] Connection timeout - no spawn received');
        scheduleReconnect();
      }
    }, 60000);

    bot.once('spawn', () => {
      clearTimeout(connectionTimeout);
      botState.connected = true;
      botState.lastActivity = Date.now();
      botState.reconnectAttempts = 0;
      isReconnecting = false;

      // Update brain with spawned bot
      brain.attachBot(bot);

      console.log(`[Bot] [+] Successfully spawned on server!`);
      if (config.discord && config.discord.events.connect) {
        sendDiscordWebhook(`[+] **Connected** to \`${config.server.ip}\``, 0x4ade80); // Green
      }

      const mcData = require('minecraft-data')(config.server.version);
      const defaultMove = new Movements(bot, mcData);
      defaultMove.allowFreeMotion = false;
      defaultMove.canDig = false;
      defaultMove.liquidCost = 1000;
      defaultMove.fallDamageCost = 1000;

      // Start all modules
      initializeModules(bot, mcData, defaultMove);

      // Setup enhanced Leave/Rejoin logic
      setupLeaveRejoin(bot, createBot);

      setTimeout(() => {
        if (bot && botState.connected) {
          bot.chat('/gamerule sendCommandFeedback false');
        }
      }, 3000);

      // Attempt creative mode (only works if bot has OP)
      setTimeout(() => {
        if (bot && botState.connected) {
          bot.chat('/gamemode creative');
          console.log('[INFO] Attempted to set creative mode (requires OP)');
        }
      }, 3000);

      bot.on('messagestr', (message) => {
        if (
          message.includes('commands.gamemode.success.self') ||
          message.includes('Set own game mode to Creative Mode')
        ) {
          console.log('[INFO] Bot is now in Creative Mode.');
           
          bot.chat('/gamerule sendCommandFeedback false');
          
        }
      });
    });

    

    // Handle disconnection
    bot.on('end', (reason) => {
      const wasSpawned = botState.connected;
      console.log(`[Bot] Disconnected: ${reason || 'Unknown reason'}`);
      botState.connected = false;
      brain.detachBot();
      clearAllIntervals();

      if (config.discord && config.discord.events.disconnect && reason !== 'Periodic Rejoin') {
        sendDiscordWebhook(`[-] **Disconnected**: ${reason || 'Unknown'}`, 0xf87171); // Red
      }

      if (config.utils['auto-reconnect']) {
        scheduleReconnect();
      }
    });

    bot.on('kicked', (reason) => {
      const wasSpawned = botState.connected;
      console.log(`[Bot] Kicked: ${reason}`);
      botState.connected = false;
      brain.detachBot();
      botState.errors.push({ type: 'kicked', reason, time: Date.now() });
      clearAllIntervals();

      if (config.discord && config.discord.events.disconnect) {
        sendDiscordWebhook(`[!] **Kicked**: ${reason}`, 0xff0000); // Bright Red
      }

      if (config.utils['auto-reconnect']) {
        scheduleReconnect();
      }
    });

    bot.on('error', (err) => {
      console.log(`[Bot] Error: ${err.message}`);
      botState.errors.push({ type: 'error', message: err.message, time: Date.now() });
      // Don't immediately reconnect on error - let 'end' event handle it
    });

  } catch (err) {
    console.log(`[Bot] Failed to create bot: ${err.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  if (isReconnecting) {
    return;
  }

  isReconnecting = true;
  botState.reconnectAttempts++;

  const delay = getReconnectDelay();
  console.log(`[Bot] Reconnecting in ${delay / 1000}s (attempt #${botState.reconnectAttempts})`);

  reconnectTimeout = setTimeout(() => {
    isReconnecting = false;
    createBot();
  }, delay);
}

// ============================================================
// MODULE INITIALIZATION
// ============================================================
function initializeModules(bot, mcData, defaultMove) {
  console.log('[Modules] Initializing all modules...');

  // ---------- AUTO AUTH ----------
  if (config.utils['auto-auth'].enabled) {
    const password = config.utils['auto-auth'].password;
    setTimeout(() => {
      bot.chat(`/register ${password} ${password}`);
      bot.chat(`/login ${password}`);
      console.log('[Auth] Sent login commands');
    }, 1000);
  }

  // ---------- CHAT MESSAGES ----------
  if (config.utils['chat-messages'].enabled) {
    const messages = config.utils['chat-messages'].messages;
    if (config.utils['chat-messages'].repeat) {
      let i = 0;
      addInterval(() => {
        if (bot && botState.connected) {
          bot.chat(messages[i]);
          botState.lastActivity = Date.now();
          i = (i + 1) % messages.length;
        }
      }, config.utils['chat-messages']['repeat-delay'] * 1000);
    } else {
      messages.forEach((msg, idx) => {
        setTimeout(() => bot.chat(msg), idx * 1000);
      });
    }
  }

  // ---------- MOVE TO POSITION ----------
  if (config.position.enabled) {
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
  }

  // ---------- ANTI-AFK (Simple) ----------
  if (config.utils['anti-afk'].enabled) {
    addInterval(() => {
      if (bot && botState.connected && brain.state.mode === 'AFK') {
        bot.setControlState('jump', true);
        setTimeout(() => {
          if (bot) bot.setControlState('jump', false);
        }, 100);
        botState.lastActivity = Date.now();
      }
    }, 3000); // Jump every 30 seconds

    if (config.utils['anti-afk'].sneak) {
      bot.setControlState('sneak', true);
    }
  }

  // ---------- MOVEMENT MODULES ----------
  if (config.movement['circle-walk'].enabled) {
    startCircleWalk(bot, defaultMove);
  }
  if (config.movement['random-jump'].enabled) {
    startRandomJump(bot);
  }
  if (config.movement['look-around'].enabled) {
    startLookAround(bot);
  }

  // ---------- CUSTOM MODULES ----------
  if (config.modules.avoidMobs) avoidMobs(bot);
  if (config.modules.combat) combatModule(bot, mcData);
  if (config.modules.beds) bedModule(bot, mcData);
  if (config.modules.chat) chatModule(bot);

  // Periodic Rejoin
  if (config.utils['periodic-rejoin'] && config.utils['periodic-rejoin'].enabled) {
    periodicRejoin(bot);
  }

  console.log('[Modules] All modules initialized!');
}

// Periodic Rejoin Module
const setupLeaveRejoin = require('./leaveRejoin');

// Periodic Rejoin Module - Handled by leaveRejoin.js now
function periodicRejoin(bot) {
  // Deprecated in favor of leaveRejoin.js
  console.log('[Rejoin] Using new leaveRejoin system.');
}

// ============================================================
// MOVEMENT HELPERS
// ============================================================
function startCircleWalk(bot, defaultMove) {
  const radius = config.movement['circle-walk'].radius;
  let angle = 0;
  let lastPathTime = 0;

  addInterval(() => {
    if (!bot || !botState.connected || brain.state.mode !== 'AFK') return;

    // Rate limit pathfinding
    const now = Date.now();
    if (now - lastPathTime < 2000) return;
    lastPathTime = now;

    try {
      const x = bot.entity.position.x + Math.cos(angle) * radius;
      const z = bot.entity.position.z + Math.sin(angle) * radius;
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(Math.floor(x), Math.floor(bot.entity.position.y), Math.floor(z)));
      angle += Math.PI / 4;
      botState.lastActivity = Date.now();
    } catch (e) {
      console.log('[CircleWalk] Error:', e.message);
    }
  }, config.movement['circle-walk'].speed);
}

function startRandomJump(bot) {
  addInterval(() => {
    if (!bot || !botState.connected || brain.state.mode !== 'AFK') return;
    try {
      bot.setControlState('jump', true);
      setTimeout(() => {
        if (bot) bot.setControlState('jump', false);
      }, 300);
      botState.lastActivity = Date.now();
    } catch (e) {
      console.log('[RandomJump] Error:', e.message);
    }
  }, config.movement['random-jump'].interval);
}

function startLookAround(bot) {
  addInterval(() => {
    if (!bot || !botState.connected || brain.state.mode !== 'AFK') return;
    try {
      const yaw = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI / 4;
      bot.look(yaw, pitch, true);
      botState.lastActivity = Date.now();
    } catch (e) {
      console.log('[LookAround] Error:', e.message);
    }
  }, config.movement['look-around'].interval);
}

// ============================================================
// CUSTOM MODULES
// ============================================================

// Avoid mobs/players
function avoidMobs(bot) {
  const safeDistance = 5;
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      const entities = Object.values(bot.entities).filter(e =>
        e.type === 'mob' || (e.type === 'player' && e.username !== bot.username)
      );
      for (const e of entities) {
        if (!e.position) continue;
        const distance = bot.entity.position.distanceTo(e.position);
        if (distance < safeDistance) {
          bot.setControlState('back', true);
          setTimeout(() => {
            if (bot) bot.setControlState('back', false);
          }, 500);
          break;
        }
      }
    } catch (e) {
      console.log('[AvoidMobs] Error:', e.message);
    }
  }, 2000);
}

// Combat module
function combatModule(bot, mcData) {
  addInterval(() => {
    if (!bot || !botState.connected) return;
    try {
      if (config.combat['attack-mobs']) {
        const mobs = Object.values(bot.entities).filter(e =>
          e.type === 'mob' && e.position &&
          bot.entity.position.distanceTo(e.position) < 4
        );
        if (mobs.length > 0) {
          bot.attack(mobs[0]);
        }
      }
    } catch (e) {
      console.log('[Combat] Error:', e.message);
    }
  }, 1500);

  bot.on('health', () => {
    if (!config.combat['auto-eat']) return;
    try {
      if (bot.food < 14) {
        const food = bot.inventory.items().find(i => {
          const itemData = mcData.itemsByName[i.name];
          return itemData && itemData.food;
        });
        if (food) {
          bot.equip(food, 'hand')
            .then(() => bot.consume())
            .catch(e => console.log('[AutoEat] Error:', e.message));
        }
      }
    } catch (e) {
      console.log('[AutoEat] Error:', e.message);
    }
  });
}

// Bed module (FIXED - beds are blocks, not entities)
function bedModule(bot, mcData) {
  addInterval(async () => {
    if (!bot || !botState.connected) return;

    try {
      const isNight = bot.time.timeOfDay >= 12500 && bot.time.timeOfDay <= 23500;

      if (config.beds['place-night'] && isNight && !bot.isSleeping) {
        // Find nearby bed blocks
        const bedBlock = bot.findBlock({
          matching: block => block.name.includes('bed'),
          maxDistance: 8
        });

        if (bedBlock) {
          try {
            await bot.sleep(bedBlock);
            console.log('[Bed] Sleeping...');
          } catch (e) {
            // Can't sleep - maybe not night enough or monsters nearby
          }
        }
      }
    } catch (e) {
      console.log('[Bed] Error:', e.message);
    }
  }, 10000);
}

// Chat module
function chatModule(bot) {
  bot.on('chat', (username, message) => {
    if (!bot || username === bot.username) return;

    try {
      if (config.chat.respond) {
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
          bot.chat(`Hello, ${username}!`);
        }
        if (message.startsWith('!tp ') && config.chat.respond) {
          const target = message.split(' ')[1];
          if (target) bot.chat(`/tp ${target}`);
        }
      }
    } catch (e) {
      console.log('[Chat] Error:', e.message);
    }
  });
}

// ============================================================
// CONSOLE COMMANDS
// ============================================================
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  if (!bot || !botState.connected) {
    console.log('[Console] Bot not connected');
    return;
  }

  const trimmed = line.trim();
  if (trimmed.startsWith('say ')) {
    bot.chat(trimmed.slice(4));
  } else if (trimmed.startsWith('cmd ')) {
    bot.chat('/' + trimmed.slice(4));
  } else if (trimmed === 'status') {
    console.log(`Connected: ${botState.connected}, Uptime: ${formatUptime(Math.floor((Date.now() - botState.startTime) / 1000))}`);
  } else if (trimmed === 'reconnect') {
    console.log('[Console] Manual reconnect requested');
    bot.end();
  } else {
    bot.chat(trimmed);
  }
});

// ============================================================
// DISCORD WEBHOOK INTEGRATION
// ============================================================
function sendDiscordWebhook(content, color = 0x0099ff) {
  if (!config.discord || !config.discord.enabled || !config.discord.webhookUrl || config.discord.webhookUrl.includes('YOUR_DISCORD')) return;

  const protocol = config.discord.webhookUrl.startsWith('https') ? https : http;
  const urlParts = new URL(config.discord.webhookUrl);

  const payload = JSON.stringify({
    username: config.name,
    embeds: [{
      description: content,
      color: color,
      timestamp: new Date().toISOString(),
      footer: { text: 'Slobos AFK Bot' }
    }]
  });

  const options = {
    hostname: urlParts.hostname,
    port: 443,
    path: urlParts.pathname + urlParts.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length
    }
  };

  const req = protocol.request(options, (res) => {
    // console.log(`[Discord] Sent webhook: ${res.statusCode}`);
  });

  req.on('error', (e) => {
    console.log(`[Discord] Error sending webhook: ${e.message}`);
  });

  req.write(payload);
  req.end();
}

// ============================================================
// CRASH RECOVERY - IMMORTAL MODE
// ============================================================
process.on('uncaughtException', (err) => {
  console.log(`[FATAL] Uncaught Exception: ${err.message}`);
  // console.log(err.stack); // Optional: keep logs cleaner
  botState.errors.push({ type: 'uncaught', message: err.message, time: Date.now() });

  // CRITICAL: DO NOT EXIT.
  // The user wants the server to stay up "all the time no matter what".
  // We just clear intervals and try to restart the bot logic.
  if (config.utils['auto-reconnect']) {
    clearAllIntervals();
    // Wrap in a tiny timeout to prevent tight loops if the error is synchronous
    setTimeout(() => {
      scheduleReconnect();
    }, 1000);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.log(`[FATAL] Unhandled Rejection: ${reason}`);
  botState.errors.push({ type: 'rejection', message: String(reason), time: Date.now() });
  // Do not exit.
});

// Graceful shutdown from external signals (still allowed to exit if system demands it)
process.on('SIGTERM', () => {
  console.log('[System] SIGTERM received. Ignoring to stay alive? (Render might force kill)');
  // If we mistakenly exit here, the web server dies. 
  // User asked for "all the time on no matter what".
  // Note: Render will SIGKILL if we don't exit, but this keeps us up as long as possible.
  process.exit(0);
});

process.on('SIGINT', () => {
  // Local Ctrl+C
  console.log('[System] Manual stop requested. Exiting...');
  process.exit(0);
});

// ============================================================
// START THE BOT
// ============================================================
console.log('='.repeat(50));
console.log('  Minecraft AFK Bot v2.3 - Bug Fix Edition');
console.log('='.repeat(50));
console.log(`Server: ${config.server.ip}:${config.server.port}`);
console.log(`Version: ${config.server.version}`);
console.log(`Auto-Reconnect: ${config.utils['auto-reconnect'] ? 'Enabled' : 'Disabled'}`);
console.log('='.repeat(50));

createBot();
