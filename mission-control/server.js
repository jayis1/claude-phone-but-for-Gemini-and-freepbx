/**
 * Mission Control - Unified Dashboard
 * Displays all Gemini Phone services in a 2x2 grid
 * Port 8080
 */

require('dotenv').config();
const express = require('express');
const si = require('systeminformation');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.MISSION_CONTROL_PORT || 3030;

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
  const voiceAppUrl = process.env.VOICE_APP_URL || 'http://localhost:3000';
  const inferenceUrl = process.env.INFERENCE_URL || 'http://localhost:4000';
  const apiServerUrl = process.env.API_SERVER_URL || 'http://localhost:3333';

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Mission Control - Gemini Phone</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #f8fafc;
            overflow: hidden;
            height: 100vh;
          }
          .header {
            background: rgba(30, 41, 59, 0.8);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(139, 92, 246, 0.3);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .header h1 {
            font-size: 1.5rem;
            font-weight: 700;
            background: linear-gradient(to right, #c084fc, #6366f1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .header-stats {
            display: flex;
            gap: 2rem;
            font-size: 0.875rem;
          }
          .stat {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .stat-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 8px #10b981;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1.5fr;
            grid-template-rows: 1fr 1fr;
            gap: 1rem;
            padding: 1rem;
            height: calc(100vh - 80px);
          }
          .panel {
            background: rgba(30, 41, 59, 0.6);
            border-radius: 12px;
            border: 1px solid rgba(139, 92, 246, 0.2);
            overflow: hidden;
            position: relative;
          }
          .panel.has-header .panel-header {
            background: rgba(139, 92, 246, 0.1);
            padding: 0.75rem 1rem;
            border-bottom: 1px solid rgba(139, 92, 246, 0.2);
            font-weight: 600;
            font-size: 0.875rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .panel-icon {
            font-size: 1.2rem;
          }
          iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: white;
            zoom: 0.75;
          }
          .panel.has-header iframe {
            height: calc(100% - 45px);
          }
          .monitor-content {
            padding: 1rem;
            height: calc(100% - 45px);
            overflow-y: auto;
          }
          .stat-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
            margin-bottom: 1.5rem;
          }
          .stat-card {
            background: rgba(0, 0, 0, 0.3);
            padding: 0.75rem;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.05);
          }
          .stat-label {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #94a3b8;
            margin-bottom: 0.25rem;
          }
          .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #c084fc;
          }
          .logs-section {
            margin-top: 1rem;
          }
          .logs-header {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #94a3b8;
            margin-bottom: 0.5rem;
          }
          .log-entry {
            font-size: 0.75rem;
            padding: 0.5rem;
            margin-bottom: 0.25rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
            border-left: 3px solid #6366f1;
            font-family: monospace;
          }
          .log-time {
            color: #64748b;
            margin-right: 0.5rem;
          }
          .log-service {
            color: #c084fc;
            margin-right: 0.5rem;
          }
          .actions {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1rem;
          }
          .btn {
            flex: 1;
            background: linear-gradient(135deg, #c084fc, #6366f1);
            color: white;
            border: none;
            padding: 0.5rem;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 0.75rem;
          }
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(192, 132, 252, 0.4);
          }
          ::-webkit-scrollbar {
            width: 8px;
          }
          ::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.2);
          }
          ::-webkit-scrollbar-thumb {
            background: rgba(192, 132, 252, 0.3);
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(192, 132, 252, 0.5);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎯 Mission Control</h1>
          <div class="header-stats">
            <div class="stat">
              <div class="stat-dot"></div>
              <span>All Systems Operational</span>
            </div>
            <div class="stat">
              <span id="time">${new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        <div class="grid">
          <!-- Voice App -->
          <div class="panel">
            <iframe src="${voiceAppUrl}" title="Voice App"></iframe>
          </div>

          <!-- API Server -->
          <div class="panel">
            <iframe src="${apiServerUrl}" title="API Server"></iframe>
          </div>

          <!-- Inference Brain -->
          <div class="panel">
            <iframe src="${inferenceUrl}" title="Inference Brain"></iframe>
          </div>

          <!-- System Monitor -->
          <div class="panel has-header">
            <div class="panel-header">
              <span><span class="panel-icon">📊</span> System Monitor</span>
              <span>Live</span>
            </div>
            <div class="monitor-content">
              <div class="actions">
                <button class="btn" onclick="refreshStats()">Refresh</button>
                <button class="btn" onclick="clearLogs()">Clear Logs</button>
              </div>

              <div class="stat-grid">
                <div class="stat-card">
                  <div class="stat-label">CPU Usage</div>
                  <div class="stat-value" id="cpu">--</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Memory</div>
                  <div class="stat-value" id="memory">--</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Active Calls</div>
                  <div class="stat-value" id="calls">0</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Uptime</div>
                  <div class="stat-value" id="uptime">--</div>
                </div>
              </div>

              <div class="logs-section">
                <div class="logs-header">System Logs</div>
                <div id="logs"></div>
              </div>
            </div>
          </div>
        </div>

        <script>
          // Update time
          setInterval(() => {
            document.getElementById('time').textContent = new Date().toLocaleTimeString();
          }, 1000);

          // Fetch system stats
          async function fetchStats() {
            try {
              const res = await fetch('/api/system-stats');
              const data = await res.json();
              
              document.getElementById('cpu').textContent = data.cpu + '%';
              document.getElementById('memory').textContent = data.memory + '%';
              document.getElementById('uptime').textContent = data.uptime;
            } catch (err) {
              console.error('Failed to fetch stats:', err);
            }
          }

          // Fetch active calls
          async function fetchCalls() {
            try {
              const res = await fetch('/api/active-calls');
              const data = await res.json();
              document.getElementById('calls').textContent = data.count;
            } catch (err) {
              console.error('Failed to fetch calls:', err);
            }
          }

          // Fetch logs
          async function fetchLogs() {
            try {
              const res = await fetch('/api/logs');
              const data = await res.json();
              const logsDiv = document.getElementById('logs');
              
              logsDiv.innerHTML = data.logs.slice(0, 10).map(log => 
                '<div class="log-entry">' +
                '<span class="log-time">' + new Date(log.timestamp).toLocaleTimeString() + '</span>' +
                '<span class="log-service">[' + log.service + ']</span>' +
                log.message +
                '</div>'
              ).join('');
            } catch (err) {
              console.error('Failed to fetch logs:', err);
            }
          }

          function refreshStats() {
            fetchStats();
            fetchCalls();
            fetchLogs();
          }

          function clearLogs() {
            fetch('/api/logs', { method: 'DELETE' })
              .then(() => fetchLogs());
          }

          // Initial load and periodic updates
          refreshStats();
          setInterval(refreshStats, 5000);
        </script>
      </body>
    </html>
  `);
});

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

// Active calls API
app.get('/api/active-calls', (req, res) => {
  res.json({ count: activeCalls.length, calls: activeCalls });
});

// Logs API
app.get('/api/logs', (req, res) => {
  res.json({ logs: systemLogs });
});

app.delete('/api/logs', (req, res) => {
  systemLogs = [];
  res.json({ success: true });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Helper function
function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Start server
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Mission Control started on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Dashboard: http://localhost:${PORT}`);
  addLog('INFO', 'MISSION-CONTROL', 'Server started on port ' + PORT);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down Mission Control...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shutting down Mission Control...');
  process.exit(0);
});
