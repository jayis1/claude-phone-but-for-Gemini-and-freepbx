/**
 * Mission Control - Unified Dashboard
 * Displays all Gemini Phone services in a 2x2 grid
 * Port 3030 (default) or 5002 (Docker)
 */

require('dotenv').config();
const express = require('express');
const si = require('systeminformation');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3030;

// Service URLs
const VOICE_APP_URL = process.env.VOICE_APP_URL || 'http://localhost:3434';
const INFERENCE_URL = process.env.INFERENCE_URL || process.env.INFERENCE_BRAIN_URL || 'http://localhost:4000';
const API_SERVER_URL = process.env.API_SERVER_URL || 'http://localhost:3333';

// Middleware
app.use(express.json());

// Store for active calls and logs
let activeCalls = [];
let systemLogs = [];
const MAX_LOGS = 100;

// Add log entry
function addLog(level, service, message) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message
  };
  systemLogs.unshift(entry);
  if (systemLogs.length > MAX_LOGS) {
    systemLogs = systemLogs.slice(0, MAX_LOGS);
  }
}

// Main dashboard route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Mission Control - Gemini Phone</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          :root {
            --bg: #0f172a;
            --panel: rgba(30, 41, 59, 0.7);
            --border: rgba(139, 92, 246, 0.2);
            --text: #f8fafc;
            --text-dim: #94a3b8;
            --accent: #c084fc;
            --success: #10b981;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', system-ui, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #020617 100%);
            color: var(--text);
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .header {
            height: 50px;
            background: rgba(15, 23, 42, 0.9);
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 1.5rem;
            flex-shrink: 0;
          }
          .logo {
            font-size: 1.1rem;
            font-weight: 700;
            background: linear-gradient(to right, #c084fc, #6366f1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .status-dot {
            width: 8px;
            height: 8px;
            background: var(--success);
            border-radius: 50%;
            box-shadow: 0 0 8px var(--success);
          }
          .grid {
            flex: 1;
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            gap: 0.5rem;
            padding: 0.5rem;
            height: calc(100vh - 50px);
          }
          .panel {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
            height: 100%;
            width: 100%;
          }
          .panel-header {
            background: rgba(139, 92, 246, 0.05);
            padding: 0.5rem 1rem;
            font-weight: 600;
            font-size: 0.85rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border);
            flex-shrink: 0;
          }
          .panel-content {
            padding: 1rem;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center; /* Center content vertically */
            overflow-y: auto;
          }
          
          /* Specific overrides for scrolling content panels */
          .panel-content.scrollable {
            justify-content: flex-start;
          }

          /* Stats Grid */
          .stat-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
            width: 100%;
          }
          .stat-card {
            background: rgba(0,0,0,0.2);
            padding: 1rem;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.05);
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
            height: 100%;
          }
          .stat-label {
            font-size: 0.75rem;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.25rem;
          }
          .stat-value {
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--accent);
            font-family: monospace;
          }

          /* Interactive Buttons */
          .btn-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
            margin-top: 1rem;
            width: 100%;
          }
          .btn {
            background: rgba(139, 92, 246, 0.15);
            border: 1px solid var(--border);
            color: var(--text);
            padding: 0.75rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
            transition: all 0.2s;
            text-align: center;
          }
          .btn:hover {
            background: var(--accent);
            color: black;
            border-color: var(--accent);
            font-weight: 600;
          }

          /* Logs & Lists */
          .log-entry {
            font-family: monospace;
            font-size: 0.7rem;
            padding: 0.3rem 0;
            border-bottom: 1px solid rgba(255,255,255,0.03);
            display: flex;
            gap: 0.5rem;
            line-height: 1.4;
          }
          .device-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255,255,255,0.03);
            padding: 0.75rem;
            border-radius: 6px;
            margin-bottom: 0.5rem;
            border-left: 3px solid var(--success);
          }
          
          /* Status Badges */
          .status-badge {
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 4px;
            background: rgba(16, 185, 129, 0.15);
            color: var(--success);
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">
            <span class="status-dot"></span>
            MISSION CONTROL
          </div>
          <div>
            <span id="clock" style="font-family: monospace; color: var(--accent); font-size: 0.9rem;">--:--:--</span>
          </div>
        </div>

        <div class="grid">
          <!-- PANEL 1: VOICE APP -->
          <div class="panel">
            <div class="panel-header">
              <span>📞 VOICE APP</span>
              <span class="status-badge" id="voice-status"> Checking...</span>
            </div>
            <div class="panel-content scrollable" id="voice-content">
              <div style="flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-dim);">
                Connecting...
              </div>
            </div>
          </div>

          <!-- PANEL 2: INFERENCE BRAIN -->
          <div class="panel">
            <div class="panel-header">
              <span>🧠 INFERENCE BRAIN</span>
              <span class="status-badge" id="inference-status">Checking...</span>
            </div>
            <div class="panel-content">
              <div class="stat-grid" style="height: 50%;">
                <div class="stat-card">
                  <div class="stat-label">Active Model</div>
                  <div class="stat-value" id="ai-model" style="font-size: 1.1rem;">--</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Total Sessions</div>
                  <div class="stat-value" id="ai-sessions">0</div>
                </div>
              </div>
              <div style="margin-top: 1rem; flex: 1; display: flex; flex-direction: column;">
                <div style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Recent Activity</div>
                <div id="ai-thoughts" style="background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 6px; flex: 1; font-family: monospace; font-size: 0.8rem; overflow-y: auto; color: #a5b4fc;">
                  Waiting for activity...
                </div>
              </div>
            </div>
          </div>

          <!-- PANEL 3: GEMINI API -->
          <div class="panel">
            <div class="panel-header">
              <span>⚡ GEMINI API</span>
              <span class="status-badge" id="api-status">Checking...</span>
            </div>
            <div class="panel-content">
              <div class="stat-grid">
                <div class="stat-card">
                  <div class="stat-label">Connection</div>
                  <div class="stat-value">HTTP</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">System Status</div>
                  <div class="stat-value" style="color: var(--success); font-size: 1.2rem;">OPERATIONAL</div>
                </div>
              </div>
              
              <div class="btn-grid">
                <button class="btn" onclick="apiAction('ping')">📡 Ping Service</button>
                <button class="btn" onclick="apiAction('system-info')">ℹ️ System Info</button>
                <button class="btn" onclick="apiAction('joke')">😄 Tell Joke</button>
                <button class="btn" onclick="apiAction('fortune')">🔮 Fortune</button>
              </div>

              <div id="api-result" style="margin-top: 1rem; padding: 0.75rem; background: rgba(0,0,0,0.2); border-radius: 6px; font-family: monospace; font-size: 0.8rem; min-height: 40px; text-align: center; color: #a5b4fc; display: flex; align-items: center; justify-content: center;">
                Ready for commands...
              </div>
            </div>
          </div>

          <!-- PANEL 4: SYSTEM MONITOR -->
          <div class="panel">
            <div class="panel-header">
              <span>📊 SYSTEM MONITOR</span>
              <div style="font-size: 0.75rem; color: var(--text-dim);">Live Metrics</div>
            </div>
            <div class="panel-content" style="display: flex; flex-direction: column; height: 100%;">
              <div class="stat-grid" style="margin-bottom: 1rem;">
                <div class="stat-card">
                  <div class="stat-label">CPU Load</div>
                  <div class="stat-value" id="sys-cpu">--%</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Memory</div>
                  <div class="stat-value" id="sys-mem">--%</div>
                </div>
              </div>
              <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                <div style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.5rem; text-transform: uppercase;">Shared System Logs</div>
                <div id="sys-logs" style="flex: 1; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 6px; padding: 0.5rem;"></div>
              </div>
            </div>
          </div>
        </div>

        <script>
          // Clock
          setInterval(() => {
            document.getElementById('clock').innerText = new Date().toLocaleTimeString();
          }, 1000);

          // Voice App Data
          async function updateVoice() {
            try {
              const res = await fetch('/api/proxy/voice/devices');
              const data = await res.json();
              
              if (data.devices) {
                document.getElementById('voice-status').innerText = 'Online';
                const html = data.devices.map(d => \`
                  <div class="device-item">
                    <div class="device-info">
                      <span class="device-ext">\${d.extension}</span>
                      <span>\${d.name}</span>
                    </div>
                    \${d.hasVoice ? '🎤' : '⚪'}
                  </div>
                \`).join('');
                document.getElementById('voice-content').innerHTML = html || '<div class="loading">No devices found</div>';
              }
            } catch (e) {
              document.getElementById('voice-status').innerText = 'Offline';
              document.getElementById('voice-status').style.color = '#ef4444';
            }
          }

          // Inference Data
          async function updateInference() {
            try {
              const res = await fetch('/api/proxy/inference/stats');
              const data = await res.json();
              if (data.success) {
                document.getElementById('inference-status').innerText = 'Online';
                document.getElementById('ai-model').innerText = data.model || 'Unknown';
                document.getElementById('ai-sessions').innerText = data.sessions || 0;
              }
            } catch (e) {
              document.getElementById('inference-status').innerText = 'Offline';
              document.getElementById('inference-status').style.color = '#ef4444';
            }
          }

          // API Actions
          async function apiAction(endpoint) {
            const apiResult = document.getElementById('api-result');
            apiResult.innerText = 'Requesting...';
            try {
              const res = await fetch('/api/proxy/api/' + endpoint);
              const data = await res.json();
              
              if (data.joke) apiResult.innerText = '😄 ' + data.joke;
              else if (data.fortune) apiResult.innerText = '🔮 ' + data.fortune;
              else apiResult.innerText = JSON.stringify(data, null, 2);
              
              document.getElementById('api-status').innerText = 'Active';
            } catch (e) {
              apiResult.innerText = 'Error: ' + e.message;
            }
          }

          // System Stats
          async function updateSystem() {
            try {
              const res = await fetch('/api/system-stats');
              const data = await res.json();
              document.getElementById('sys-cpu').innerText = data.cpu + '%';
              document.getElementById('sys-mem').innerText = data.memory + '%';
            } catch (e) {}
          }

          // Logs
          async function updateLogs() {
            try {
              const res = await fetch('/api/logs');
              const data = await res.json();
              const logsHtml = data.logs.slice(0, 50).map(l => \`
                <div class="log-entry">
                  <span class="log-time">\${new Date(l.timestamp).toLocaleTimeString()}</span>
                  <span class="log-srv">[\${l.service}]</span>
                  <span>\${l.message}</span>
                </div>
              \`).join('');
              document.getElementById('sys-logs').innerHTML = logsHtml;
            } catch (e) {}
          }

          // Init
          setInterval(updateVoice, 5000);
          setInterval(updateInference, 5000);
          setInterval(updateSystem, 2000);
          setInterval(updateLogs, 2000);
          
          updateVoice();
          updateInference();
          updateSystem();
          updateLogs();
        </script>
      </body>
    </html>
  `);
});

// ============================================
// PROXY ROUTES
// ============================================

// Helper for proxy requests
const proxyRequest = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error(`Proxy Error to ${url}:`, err.message);
    throw err;
  }
};

// Voice App Proxy
app.get('/api/proxy/voice/devices', async (req, res) => {
  try {
    const data = await proxyRequest(`${VOICE_APP_URL}/api/devices`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Voice App Unreachable' });
  }
});

// Inference Brain Proxy
app.get('/api/proxy/inference/stats', async (req, res) => {
  try {
    const data = await proxyRequest(`${INFERENCE_URL}/stats`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Inference Brain Unreachable' });
  }
});

// Gemini API Proxy
app.get('/api/proxy/api/:endpoint', async (req, res) => {
  try {
    const endpoint = req.params.endpoint;
    const data = await proxyRequest(`${API_SERVER_URL}/${endpoint}`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'API Server Unreachable' });
  }
});


// ============================================
// LOCAL API ROUTES
// ============================================

// System stats API
app.get('/api/system-stats', async (req, res) => {
  try {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const time = await si.time();

    res.json({
      cpu: cpu.currentLoad.toFixed(1),
      memory: ((mem.used / mem.total) * 100).toFixed(1),
      uptime: formatUptime(time.uptime)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logs API
app.get('/api/logs', (req, res) => {
  res.json({ logs: systemLogs });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] Mission Control started on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Dashboard: http://localhost:${PORT}`);
  addLog('INFO', 'MISSION-CONTROL', 'Server started on port ' + PORT);
});
