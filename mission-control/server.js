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
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3030;

// Service URLs - Default to standard ports
// Voice App: 3000 (Docker mapping)
// Brain: 4000
// API: 3333
const VOICE_APP_URL = process.env.VOICE_APP_URL || 'http://127.0.0.1:3000';
const INFERENCE_URL = process.env.INFERENCE_URL || process.env.INFERENCE_BRAIN_URL || 'http://127.0.0.1:4000';
const API_SERVER_URL = process.env.API_SERVER_URL || 'http://127.0.0.1:3333';


// Middleware
app.use(express.json());
app.use(cors());

// JSON Parse Error Handler - Prevents crash on bad logging data
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('[Mission Control] Bad JSON received:', err.message);
    return res.status(400).send({ status: 400, message: err.message });
  }
  next();
});

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
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg: #09090b;
            --panel: #18181b;
            --border: #27272a;
            --text: #e4e4e7;
            --text-dim: #a1a1aa;
            --accent: #8b5cf6;
            --success: #10b981;
            --error: #ef4444;
            --warning: #f59e0b;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', system-ui, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .header {
            height: 60px;
            background: var(--panel);
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 1.5rem;
            flex-shrink: 0;
          }
          .logo {
            font-size: 1.25rem;
            font-weight: 800;
            letter-spacing: -0.025em;
            background: linear-gradient(to right, #c084fc, #6366f1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }
          .status-dot {
            width: 8px;
            height: 8px;
            background: var(--success);
            border-radius: 50%;
            box-shadow: 0 0 12px var(--success);
          }
          .service-status {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.75rem;
            color: var(--text-dim);
          }
          .service-dots {
            display: flex;
            gap: 0.5rem;
          }
          .service-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            transition: all 0.3s ease;
          }
          .service-dot.online {
            background: var(--success);
            box-shadow: 0 0 8px var(--success);
          }
          .service-dot.offline {
            background: var(--error);
            box-shadow: 0 0 8px var(--error);
          }
          .grid {
            flex: 1;
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            gap: 1rem;
            padding: 1rem;
            height: calc(100vh - 60px);
          }
          .panel {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .panel-header {
            padding: 1rem;
            font-weight: 600;
            font-size: 0.9rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border);
            background: rgba(255,255,255,0.02);
          }
          .panel-content {
            padding: 1.25rem;
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
          }
          
          /* Stats Grid */
          .stat-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
            width: 100%;
          }
          .stat-card {
            background: rgba(0,0,0,0.3);
            padding: 1rem;
            border-radius: 8px;
            border: 1px solid var(--border);
            text-align: center;
          }
          .stat-label {
            font-size: 0.7rem;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.5rem;
          }
          .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            font-family: 'JetBrains Mono', monospace;
            color: white;
          }
          
          /* Controls */
          .control-group {
            margin-top: 1rem;
            padding: 1rem;
            background: rgba(255,255,255,0.03);
            border-radius: 8px;
            border: 1px solid var(--border);
          }
          .slider-container {
            display: flex;
            align-items: center;
            gap: 1rem;
          }
          input[type=range] {
            flex: 1;
            height: 6px;
            background: var(--border);
            border-radius: 3px;
            appearance: none;
          }
          input[type=range]::-webkit-slider-thumb {
            appearance: none;
            width: 16px;
            height: 16px;
            background: var(--accent);
            border-radius: 50%;
            cursor: pointer;
          }
          select {
            width: 100%;
            background: #09090b;
            color: white;
            border: 1px solid var(--border);
            padding: 0.5rem;
            border-radius: 6px;
            font-family: inherit;
          }

          /* Buttons */
          .btn-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
            margin-top: 1rem;
          }
          .btn {
            background: rgba(139, 92, 246, 0.1);
            border: 1px solid rgba(139, 92, 246, 0.2);
            color: var(--text);
            padding: 0.75rem;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 500;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
          }
          .btn:hover {
            background: var(--accent);
            color: white;
            border-color: var(--accent);
          }
          
          /* Monitors */
          .monitor-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
          }
          .progress-bar {
            flex: 1;
            height: 6px;
            background: var(--border);
            border-radius: 3px;
            margin: 0 1rem;
            overflow: hidden;
          }
          .progress-fill {
            height: 100%;
            background: var(--accent);
            width: 0%;
            transition: width 0.5s ease;
          }

          /* Modal Styles */
          .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 2000;
            display: none; justify-content: center; align-items: center;
            backdrop-filter: blur(4px);
          }
          .modal {
            background: var(--panel); border: 1px solid var(--border);
            padding: 2rem; border-radius: 12px; max-width: 450px; width: 90%;
            text-align: center; color: var(--text);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
            transform: translateY(0);
            transition: transform 0.2s;
          }
          .modal h3 { margin-bottom: 0.5rem; color: #fff; font-size: 1.25rem; }
          .modal p { margin-bottom: 1.5rem; color: var(--text-dim); line-height: 1.5; }
          .modal-buttons { display: flex; justify-content: center; gap: 1rem; margin-top: 1.5rem; }
          .btn-primary { background: var(--accent); color: white; padding: 0.6rem 1.2rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; font-size: 0.95rem; transition: filter 0.2s; }
          .btn-primary:hover { filter: brightness(1.1); }
          .btn-secondary { background: transparent; border: 1px solid var(--border); color: var(--text); padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 0.95rem; transition: background 0.2s; }
          .btn-secondary:hover { background: rgba(255,255,255,0.05); }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">
            <span class="status-dot"></span>
            MISSION CONTROL v2.1.24
          </div>
          <div style="display:flex; align-items:center; gap:10px; margin-right: 20px;">
             <button id="update-btn" onclick="checkForUpdates()" style="display:none; padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 5px;">
               <span>🔄</span> Check Updates
             </button>
          
             <span style="font-size:0.8rem; color:var(--text-dim)">Provider:</span>
             <select id="provider-select" style="background:#27272a; color:#fff; border:1px solid #3f3f46; padding:4px 8px; border-radius:4px;">
               <option value="3cx">3CX</option>
               <option value="freepbx">FreePBX</option>
             </select>
             <button onclick="switchProvider()" style="padding: 4px 8px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Apply</button>
          </div>
          <div class="service-status">
            <span>Services:</span>
            <div class="service-dots">
              <span class="service-dot offline" id="dot-3cx" title="3CX PBX"></span>
              <span class="service-dot offline" id="dot-drachtio" title="Drachtio (SIP)"></span>
              <span class="service-dot offline" id="dot-freeswitch" title="FreeSWITCH (Media)"></span>
              <span class="service-dot offline" id="dot-freepbx" title="FreePBX/Asterisk"></span>
              <span class="service-dot offline" id="dot-voice" title="Voice App (Node.js)"></span>
              <span class="service-dot offline" id="dot-brain" title="Inference Brain"></span>
              <span class="service-dot offline" id="dot-python" title="Python Brain (Snake)"></span>
              <span class="service-dot offline" id="dot-api" title="API Server"></span>
              <span class="service-dot offline" id="dot-system" title="System Monitor"></span>
            </div>
          </div>
          <div id="clock" style="font-family: 'JetBrains Mono', monospace; color: var(--text-dim);">--:--:--</div>
        </div>

        <div class="grid">
          <!-- VOICE APP PANEL -->
          <div class="panel">
            <div class="panel-header">
              <span>🎙️ VOICE APP</span>
              <span class="status-badge" id="voice-status" style="color: var(--warning)">Checking...</span>
            </div>
            <div class="panel-content">
              <div class="stat-grid" style="margin-bottom: 1rem;">
                <div class="stat-card">
                  <div class="stat-label">System</div>
                  <div class="stat-value" id="voice-system">Ready</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Active Calls</div>
                  <div class="stat-value" id="voice-calls">0</div>
                </div>
              </div>

              <div class="control-group">
                <div class="stat-label">Voice Speed</div>
                <div class="slider-container">
                  <span style="font-size: 0.8rem">0.5x</span>
                  <input type="range" id="voice-speed" min="0.5" max="2.0" step="0.1" value="1.0" onchange="updateSpeed(this.value)">
                  <span id="speed-val" style="font-family: monospace; width: 40px">1.0x</span>
                </div>
              </div>

              <div class="control-group">
                <div class="stat-label">Music Speed (YouTube DJ)</div>
                <div class="slider-container">
                  <span style="font-size: 0.8rem">0.5x</span>
                  <input type="range" id="music-speed" min="0.5" max="2.0" step="0.1" value="1.0" onchange="updateMusicSpeed(this.value)">
                  <span id="music-speed-val" style="font-family: monospace; width: 40px">1.0x</span>
                </div>
              </div>



              <!-- Terminal Moved to API Panel -->

              <div style="margin-top: 1rem;">
                <div class="stat-label">CLI Access & APIs</div>
                <div style="font-size: 0.75rem; line-height: 1.6;">
                  <div style="color: var(--success);">✓ Gemini Bridge (Conversation)</div>
                  <div style="color: var(--success);">✓ Outbound Calling API</div>
                  <div style="color: var(--success);">✓ Query API (Programmatic)</div>
                  <div style="color: var(--success);">✓ TTS/STT Services</div>
                  <div style="color: var(--success);">✓ Device Management</div>
                  <div style="color: var(--success);">✓ Multi-Extension Support</div>
                </div>
              </div>
            </div>
          </div>

          <!-- INFERENCE BRAIN PANEL -->
          <div class="panel">
            <div class="panel-header">
              <span>🧠 INFERENCE BRAIN</span>
              <span class="status-badge" id="inference-status" style="color: var(--warning)">Checking...</span>
            </div>
            <div class="panel-content">
              <div class="stat-grid" style="margin-bottom: 1rem;">
                <div class="stat-card">
                  <div class="stat-label">Sessions</div>
                  <div class="stat-value" id="ai-sessions">0</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Load</div>
                  <div class="stat-value" id="ai-load">--%</div>
                </div>
              </div>

              <div class="control-group">
                <div class="stat-label">Active Model</div>
                <div style="display: flex; gap: 8px;">
                  <select id="model-select" style="flex: 1; background:#27272a; color:#fff; border:1px solid #3f3f46; padding:4px 8px; border-radius:4px;">
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  </select>
                  <button onclick="updateModel()" style="padding: 4px 8px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Apply</button>
                </div>
              </div>

               <div style="flex: 1; margin-top: 1rem; display: flex; flex-direction: column; overflow: hidden;">
                <div class="stat-label">Activity Log</div>
                <div id="brain-log" class="log-container" style="background: rgba(0,0,0,0.3); border: none;">
                  <div class="log-entry"><span class="log-time">--:--</span> Waiting for thoughts...</div>
                </div>
              </div>
            </div>
          </div>

          <!-- GEMINI API SERVER (Quadrant 3) -->
          <div class="panel">
            <div class="panel-header">
              <span>⚡ GEMINI API SERVER & CLI</span>
              <span class="status-badge" id="api-status" style="color: var(--warning)">Checking...</span>
            </div>
            <div class="panel-content">
              <div class="stat-grid">
                <div class="stat-card">
                  <div class="stat-label">Status</div>
                  <div class="stat-value" style="color: var(--success); font-size: 1.2rem;">OPERATIONAL</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Connection</div>
                  <div class="stat-value">HTTPS/REST</div>
                </div>
              </div>

              <!-- Gemini CLI Terminal (Moved Here) -->
              <div style="margin-bottom: 1rem; margin-top: 1rem; flex: 1; display: flex; flex-direction: column;">
                <div class="stat-label">Gemini Bridge Terminal</div>
                
                <!-- Terminal Output -->
                <div id="gemini-terminal" style="background: #000; border-radius: 6px 6px 0 0; padding: 0.75rem; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; flex: 1; overflow-y: auto; border: 1px solid var(--border); min-height: 200px;">
                  <div style="color: var(--success);">$ gemini --help</div>
                  <div style="color: var(--text-dim); font-size: 0.7rem; margin-bottom: 0.5rem;">Type a command and press Enter</div>
                </div>
                
                <!-- Terminal Input -->
                <div style="display: flex; gap: 0; background: #000; border-radius: 0 0 6px 6px; border: 1px solid var(--border); border-top: none;">
                  <div style="margin-bottom: 0.5rem; padding: 0.25rem; border-left: 2px solid var(--accent); font-family: monospace;">$</div>
                  <input 
                    type="text" 
                    id="gemini-cli-input" 
                    placeholder="Ask Gemini or run command..." 
                    onkeypress="if(event.key==='Enter') executeGeminiCommand()"
                    style="flex: 1; background: transparent; border: none; color: var(--text); font-family: monospace; font-size: 0.85rem; outline: none; padding: 0.5rem 0.5rem 0.5rem 0;">
                  <button onclick="executeGeminiCommand()" style="padding: 0.5rem 1rem; background: var(--accent); color: white; border: none; cursor: pointer; font-weight: 600;">Run</button>
                </div>
              </div>

              <div class="btn-grid">
                <button class="btn" onclick="apiAction('ping')">📡 Ping</button>
                <button class="btn" onclick="apiAction('list-files')">📂 Files</button>
                <button class="btn" onclick="apiAction('weather')">☀️ Weather</button>
                <button class="btn" onclick="apiAction('joke')">😄 Joke</button>
                <button class="btn" onclick="apiAction('fortune')">🔮 Fortune</button>
                <button class="btn" onclick="apiAction('system-info')">ℹ️ Info</button>
              </div>

              <div id="api-result" style="display: none;"></div>
            </div>
          </div>

          <!-- SYSTEM MONITOR -->
          <div class="panel">
            <div class="panel-header">
              <span>📊 SYSTEM MONITOR</span>
              <div style="font-size: 0.75rem; color: var(--success);">LIVE</div>
            </div>
            <div class="panel-content">
              <!-- CPU -->
              <div class="monitor-row">
                <span style="width: 40px">CPU</span>
                <div class="progress-bar"><div class="progress-fill" id="bar-cpu"></div></div>
                <span id="val-cpu">--%</span>
              </div>
              
              <!-- GPU -->
              <div class="monitor-row">
                <span style="width: 40px">GPU</span>
                <div class="progress-bar"><div class="progress-fill" id="bar-gpu" style="background: #ec4899"></div></div>
                <span id="val-gpu">--%</span>
              </div>

              <!-- RAM -->
              <div class="monitor-row">
                <span style="width: 40px">RAM</span>
                <div class="progress-bar"><div class="progress-fill" id="bar-mem" style="background: #3b82f6"></div></div>
                <span id="val-mem">--%</span>
              </div>

              <!-- TEMP -->
              <div class="monitor-row">
                <span style="width: 40px">TMP</span>
                <div class="progress-bar"><div class="progress-fill" id="bar-temp" style="background: #f59e0b"></div></div>
                <span id="val-temp">--°C</span>
              </div>

              <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; margin-top: 1rem;">
                <div class="stat-label">Shared System Logs</div>
                <div id="sys-logs" class="log-container">
                  <!-- Logs -->
                </div>
              </div>
            </div>
          </div>
        </div>

        <script>
          // Clock
          setInterval(() => {
            document.getElementById('clock').innerText = new Date().toLocaleTimeString();
          }, 1000);

          // Update Helpers
          function setStatus(id, online) {
            const el = document.getElementById(id);
            if(online) {
              el.innerText = 'ONLINE';
              el.style.color = 'var(--success)';
            } else {
              el.innerText = 'OFFLINE';
              el.style.color = 'var(--error)';
            }
          }

          // Voice App
          async function updateVoice() {
            try {
              // Try health first
              const h = await fetch('/api/proxy/voice/health');
              if(h.ok) {
                setStatus('voice-status', true);
                document.getElementById('dot-voice').className = 'service-dot online';
              } else throw new Error('Unhealthy');

              // Get Config for speed
              const c = await fetch('/api/proxy/voice/api/config?device=default'); // Assuming default device exists
              const conf = await c.json();
              if(conf.success) {
                 const speed = conf.config.speed || 1.0;
                 document.getElementById('voice-speed').value = speed;
                 document.getElementById('speed-val').innerText = speed + 'x';
              }
            } catch(e) {
              setStatus('voice-status', false);
              document.getElementById('dot-voice').className = 'service-dot offline';
            }
          }

          async function updateSpeed(val) {
            document.getElementById('speed-val').innerText = val + 'x';
            try {
              // Get first device to update
              const d = await fetch('/api/proxy/voice/api/devices');
              const dd = await d.json();
              if(dd.devices && dd.devices.length > 0) {
                await fetch('/api/proxy/voice/api/config/speed', {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({ device: dd.devices[0].extension, speed: parseFloat(val) })
                });
              }
            } catch(e) { console.error(e); }
          }

          async function updateMusicSpeed(val) {
            document.getElementById('music-speed-val').innerText = val + 'x';
            try {
              // Send to Inference Server to control YouTube DJ playback speed
              await fetch('/api/proxy/inference/music-speed', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ speed: parseFloat(val) })
              });
            } catch(e) { console.error('Music speed update failed:', e); }
          }

          // Inference Brain
          async function updateInference() {
            try {
              const res = await fetch('/api/proxy/inference/stats');
              const data = await res.json();
              if(data.success) {
                setStatus('inference-status', true);
                document.getElementById('dot-brain').className = 'service-dot online';
                document.getElementById('ai-sessions').innerText = data.sessions;
                document.getElementById('model-select').value = data.model;
                
                // Mock load for now if not in stats
                document.getElementById('ai-load').innerText = (data.cpu || 0) + '%';
              }
            } catch(e) {
              setStatus('inference-status', false);
              document.getElementById('dot-brain').className = 'service-dot offline';
            }
          }

          async function updateModel() {
            const model = document.getElementById('model-select').value;
            try {
              await fetch('/api/proxy/inference/config', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ model })
              });
              alert('Model updated to ' + model);
            } catch(e) { alert('Failed to change model'); }
          }
// ... (imports or other code if needed) ...
async function switchProvider() {
  const provider = document.getElementById('provider-select').value;
  // No confirm needed now, as we proceed to setup
  
  try {
    document.getElementById('provider-select').disabled = true;
    const res = await fetch('/api/config/provider', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ provider })
    });
    
    if(res.ok) {
      // Redirect to Setup Page
      window.location = '/setup';
    } else {
      alert('Failed to switch provider');
      document.getElementById('provider-select').disabled = false;
    }
  } catch(e) {
    alert('Error: ' + e.message);
    document.getElementById('provider-select').disabled = false;
  }
}

          const PROMPTS = {
            'docker-check': 'Check status of all docker containers and return a summary.',
            'git-status': 'Check git status and recent commits.',
            'list-files': 'List files in the current directory.',
            'weather': 'What is the weather like?',
            'network': 'Check network interfaces and IP addresses.',
            'disk': 'Check disk usage.',
            'ports': 'Check active listening ports.',
            'uptime': 'Check system uptime.'
          };

          async function apiAction(action) {
            const out = document.getElementById('api-result');
            out.innerText = 'Running...';
            
            try {
              let res;
              if(PROMPTS[action]) {
                // Send as prompt to Gemini
                res = await fetch('/api/proxy/api/ask', {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({ prompt: PROMPTS[action] })
                });
                const d = await res.json();
                out.innerText = d.response || d.error;
              } else {
                // Standard Endpoint
                res = await fetch('/api/proxy/api/' + action);
                const d = await res.json();
                out.innerText = JSON.stringify(d, null, 2);
              }
              setStatus('api-status', true);
              document.getElementById('dot-api').className = 'service-dot online';
            } catch(e) {
              out.innerText = 'Error: ' + e.message;
              setStatus('api-status', false);
              document.getElementById('dot-api').className = 'service-dot offline';
            }
          }

          // Check API status periodically
          async function updateApiStatus() {
            try {
              const res = await fetch('/api/proxy/api/health');
              if(res.ok) {
                setStatus('api-status', true);
                document.getElementById('dot-api').className = 'service-dot online';
              } else throw new Error('Unhealthy');
            } catch(e) {
              setStatus('api-status', false);
              document.getElementById('dot-api').className = 'service-dot offline';
            }
          }

          async function updateSystem() {
            try {
              const res = await fetch('/api/system-stats');
              const data = await res.json();
              
              // CPU
              document.getElementById('val-cpu').innerText = data.cpu + '%';
              document.getElementById('bar-cpu').style.width = data.cpu + '%';
              
              // RAM
              document.getElementById('val-mem').innerText = data.memory + '%';
              document.getElementById('bar-mem').style.width = data.memory + '%';
              
              // GPU
              document.getElementById('val-gpu').innerText = data.gpu + '%';
              document.getElementById('bar-gpu').style.width = data.gpu + '%';
              
              // Temp
              document.getElementById('val-temp').innerText = data.temp + '°C';
              document.getElementById('bar-temp').style.width = Math.min(data.temp, 100) + '%';
              
              document.getElementById('dot-system').className = 'service-dot online';
            } catch(e) {
              document.getElementById('dot-system').className = 'service-dot offline';
            }
          }

          async function updateLogs() {
            try {
               const res = await fetch('/api/logs');
               const data = await res.json();
                              // 1. Shared System Logs (All)
                const html = data.logs.slice(0, 50).map(l => 
                  \`<div class="log-entry">
    <span class="log-time">\${new Date(l.timestamp).toLocaleTimeString()}</span>
    <span class="log-service" style="color: \${l.level === 'ERROR' ? '#ef4444' : '#8b5cf6'}">[\${(l.service || 'SYS').replace('INFERENCE-BRAIN', 'BRAIN')}]</span>
    <span>\${l.message}</span>
  </div>\`
                ).join('');
                document.getElementById('sys-logs').innerHTML = html;

                // 2. Inference Brain Logs (Filtered)
                const brainLogs = data.logs.filter(l => l.service === 'INFERENCE-BRAIN' || l.service === 'INFERENCE');
                const brainHtml = brainLogs.slice(0, 20).map(l => 
                  \`<div class="log-entry">
    <span class="log-time">\${new Date(l.timestamp).toLocaleTimeString()}</span>
    <span style="color: #ec4899;">\${l.message}</span>
  </div>\`
                ).join('');
                
                const brainLogEl = document.getElementById('brain-log');
                if (brainLogEl) {
                  brainLogEl.innerHTML = brainHtml || '<div class="log-entry" style="color:#64748b">Waiting for thoughts...</div>';
                }

             } catch (e) { }
          }

          // Gemini CLI Terminal
let commandHistory = [];
let historyIndex = -1;

async function executeGeminiCommand() {
  const input = document.getElementById('gemini-cli-input');
  const terminal = document.getElementById('gemini-terminal');
  const command = input.value.trim();

  if (!command) return;

  // Add to history
  commandHistory.push(command);
  historyIndex = commandHistory.length;

  // Show command in terminal
  const cmdDiv = document.createElement('div');
  cmdDiv.style.color = 'var(--success)';
  cmdDiv.style.marginTop = '0.5rem';
            cmdDiv.textContent = \`$ gemini \${command}\`;
  terminal.appendChild(cmdDiv);

  // Show loading
  const loadingDiv = document.createElement('div');
  loadingDiv.style.color = 'var(--warning)';
  loadingDiv.textContent = 'Executing...';
  terminal.appendChild(loadingDiv);
  terminal.scrollTop = terminal.scrollHeight;

  try {
    const res = await fetch('/api/gemini-cli', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });

    const data = await res.json();
    terminal.removeChild(loadingDiv);

    // Show output
    const outputDiv = document.createElement('div');
    outputDiv.style.color = data.success ? 'var(--text)' : 'var(--error)';
    outputDiv.style.whiteSpace = 'pre-wrap';
    outputDiv.textContent = data.output;
    terminal.appendChild(outputDiv);

  } catch (error) {
    terminal.removeChild(loadingDiv);
    const errorDiv = document.createElement('div');
    errorDiv.style.color = 'var(--error)';
    errorDiv.textContent = \`Error: \${error.message}\`;
    terminal.appendChild(errorDiv);
  }

  terminal.scrollTop = terminal.scrollHeight;
  input.value = '';
}

// Command history navigation
setTimeout(() => {
  const input = document.getElementById('gemini-cli-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex > 0) {
          historyIndex--;
          e.target.value = commandHistory[historyIndex];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
          historyIndex++;
          e.target.value = commandHistory[historyIndex];
        } else {
          historyIndex = commandHistory.length;
          e.target.value = '';
        }
      }
    });
  }
}, 100);

// 3CX PBX connectivity check
async function update3CXStatus() {
  try {
    const res = await fetch('/api/proxy/voice/health');
    if (res.ok) {
      document.getElementById('dot-3cx').className = 'service-dot online';
    } else {
      throw new Error('Voice App unhealthy');
    }
  } catch (e) {
    document.getElementById('dot-3cx').className = 'service-dot offline';
  }
}

// Docker container health check
async function updateDockerStatus() {
  try {
    const res = await fetch('/api/docker-health');
    const data = await res.json();

    if (data.success) {
      document.getElementById('dot-drachtio').className = data.drachtio ? 'service-dot online' : 'service-dot offline';
      document.getElementById('dot-freeswitch').className = data.freeswitch ? 'service-dot online' : 'service-dot offline';
      // Assume FreePBX is online if Drachtio is connected (since it handles SIP)
      document.getElementById('dot-freepbx').className = data.drachtio ? 'service-dot online' : 'service-dot offline';
      console.log('Docker health OK:', data);
    }
  } catch (e) {
    console.error('Docker health failed:', e);
    document.getElementById('dot-drachtio').className = 'service-dot offline';
    document.getElementById('dot-freeswitch').className = 'service-dot offline';
    document.getElementById('dot-freepbx').className = 'service-dot offline';
  }
}

// Python Brain Check
async function updatePython() {
  try {
    // Send a minimal execution request
    const res = await fetch('/api/proxy/inference/run-python', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ script: 'mock_llm.py', prompt: 'ping' })
    });
    // We expect a valid JSON response
    const data = await res.json();
    if(res.ok && data.status === 'success') {
      document.getElementById('dot-python').className = 'service-dot online';
    } else {
       throw new Error('Python script failed');
    }
  } catch(e) {
    document.getElementById('dot-python').className = 'service-dot offline';
  }
}

setInterval(update3CXStatus, 5000);
setInterval(updateDockerStatus, 5000);

setInterval(updateVoice, 5000);
setInterval(updateInference, 5000);
setInterval(updatePython, 10000); // Check every 10s (heavier)
setInterval(updateApiStatus, 5000);
setInterval(updateSystem, 2000);
setInterval(updateLogs, 2000);

// Provider Switcher
async function updateProvider() {
  try {
    const res = await fetch('/api/config/provider');
    const data = await res.json();
    if (data.provider) {
       document.getElementById('provider-select').value = data.provider;
    }
  } catch(e) {}
}

// Provider Switcher defined above
async function updateProvider() {
  try {
    const res = await fetch('/api/config/provider');
    const data = await res.json();
    if (data.provider) {
       document.getElementById('provider-select').value = data.provider;
    }
  } catch(e) {}
}

// Update Checker (Silent Background)
async function silentUpdateCheck() {
  const btn = document.getElementById('update-btn');
  try {
    const res = await fetch('/api/update/check');
    const data = await res.json();
    
    if (data.updateAvailable) {
       // Update available: Show button
       btn.style.display = 'flex';
       btn.innerText = '🚀 Update v' + data.remoteVersion;
       btn.onclick = () => showUpdateModal(data.localVersion, data.remoteVersion);
    } else {
       // Up to date: Hide button to prevent accidental clicks
       btn.style.display = 'none';
    }
  } catch (e) {
    console.error('Update check failed:', e);
  }
}

function showUpdateModal(current, remote) {
  showModal(
     'Update Available 🚀', 
     \`A new version (\${remote}) is available! You are on \${current}.\n\nDo you want to update and restart now?\`, 
     true, 
     async () => {
       const btn = document.getElementById('update-btn');
       btn.innerText = 'Updating...';
       await fetch('/api/update/apply', { method: 'POST' });
       showModal('Updating...', 'Update started! The system is restarting. Please wait about 15 seconds and then reload the page.', false);
       setTimeout(() => location.reload(), 15000);
     }
  );
}

// Initial check and periodic poll
silentUpdateCheck();
setInterval(silentUpdateCheck, 60000); // Check every minute

update3CXStatus(); updateDockerStatus(); updateVoice(); updateInference(); updatePython(); updateApiStatus(); updateSystem(); updateLogs(); updateProvider();
        </script>
      </body>
    </html>
  `);
});

// ============================================
// PROXY ROUTES
// ============================================

const proxyRequest = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    // if (!response.ok) throw new Error(`HTTP ${ response.status } `); // Don't throw, let client handle
    return await response.json();
  } catch (err) {
    console.error(`Proxy Error to ${url}: `, err.message);
    throw err;
  }
};

// Voice App Proxies
app.use('/api/proxy/voice', async (req, res) => {
  const targetPath = req.path === '/' ? '' : req.path; // Strip leading slash issues
  const url = `${VOICE_APP_URL}${targetPath}`;
  try {
    const opts = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (req.method !== 'GET') opts.body = JSON.stringify(req.body);

    const data = await proxyRequest(url, opts);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Voice App Unreachable' });
  }
});

// Inference Proxies
app.use('/api/proxy/inference', async (req, res) => {
  const targetPath = req.path === '/' ? '' : req.path;
  const url = `${INFERENCE_URL}${targetPath} `;
  try {
    const opts = {
      method: req.method, // Forward POST/GET
      headers: { 'Content-Type': 'application/json' },
    };
    if (req.method !== 'GET') opts.body = JSON.stringify(req.body);

    const data = await proxyRequest(url, opts);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Inference Brain Unreachable' });
  }
});

// API Server Proxies
app.use('/api/proxy/api', async (req, res) => {
  const targetPath = req.path === '/' ? '' : req.path;
  const url = `${API_SERVER_URL}${targetPath} `;
  try {
    const opts = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (req.method !== 'GET') opts.body = JSON.stringify(req.body);

    const data = await proxyRequest(url, opts);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'API Server Unreachable' });
  }
});

// ============================================
// LOCAL API ROUTES

// Gemini CLI execution endpoint
app.post('/api/gemini-cli', async (req, res) => {
  const { command } = req.body;
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);

  try {
    const { stdout, stderr } = await execPromise(`gemini ${command} `, {
      timeout: 30000,
      maxBuffer: 1024 * 1024 // 1MB
    });

    res.json({
      success: true,
      output: stdout || stderr,
      command: `gemini ${command} `
    });
  } catch (error) {
    res.json({
      success: false,
      output: error.message,
      command: `gemini ${command} `
    });
  }
});
// ============================================

app.get('/api/system-stats', async (req, res) => {
  try {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const graphics = await si.graphics();
    const temp = await si.cpuTemperature();

    // Attempt to find GPU load - Iterate to find the weird NVIDIA/dedicated ones
    let gpuLoad = 0;
    if (graphics.controllers && graphics.controllers.length > 0) {
      // Try to find one with utilizationGpu
      const activeGpu = graphics.controllers.find(c => c.utilizationGpu > 0) || graphics.controllers[0];
      gpuLoad = activeGpu.utilizationGpu || 0;

      // Fallback: if 0, check if we have memory used on it
      if (gpuLoad === 0 && activeGpu.memoryTotal > 0) {
        // This is a rough proxy if load isn't available
        const vramPercent = (activeGpu.memoryUsed / activeGpu.memoryTotal) * 100;
        if (vramPercent > 0) gpuLoad = vramPercent;
      }
    }

    res.json({
      cpu: cpu.currentLoad.toFixed(1),
      memory: ((mem.used / mem.total) * 100).toFixed(1),
      gpu: typeof gpuLoad === 'number' ? gpuLoad.toFixed(1) : 0,
      temp: temp.main || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

// Docker health check endpoint
app.get('/api/docker-health', async (req, res) => {
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);

  try {
    const { stdout } = await execPromise('docker ps --format "{{.Names}},{{.Status}}" --filter "name=drachtio" --filter "name=freeswitch" --filter "name=voice-app"');
    const containers = {};

    stdout.trim().split('\n').forEach(line => {
      if (line) {
        // Simple check for 'Up' -> running
        const [name, status] = line.split(',');
        const isUp = status && status.startsWith('Up');
        if (name.includes('drachtio')) containers.drachtio = isUp;
        if (name.includes('freeswitch')) containers.freeswitch = isUp;
        if (name.includes('voice-app')) containers.voiceApp = isUp;
      }
    });

    res.json({
      success: true,
      drachtio: containers.drachtio || false,
      freeswitch: containers.freeswitch || false,
      voiceApp: containers.voiceApp || false
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ===================================
// Provider Switching (3CX <-> FreePBX)
// ===================================

const PROFILES_FILE = path.join(__dirname, 'profiles.json');
const ENV_FILE = path.join(__dirname, '../.env');

// Helper: Read .env into object
function parseEnv() {
  try {
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) env[match[1].trim()] = match[2].trim();
    });
    return env;
  } catch (e) { return {}; }
}

// Helper: Write object to .env
function writeEnv(env) {
  let content = fs.readFileSync(ENV_FILE, 'utf8');
  for (const [key, val] of Object.entries(env)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${val}`);
    } else {
      content += `\n${key}=${val}`;
    }
  }
  fs.writeFileSync(ENV_FILE, content);
}

// Get Current Provider info
app.get('/api/config/provider', (req, res) => {
  const env = parseEnv();
  // We determine provider based on simple heuristic or stored tag
  // Default to 3CX if unknown
  const provider = env.SIP_PROVIDER || (env.SIP_DOMAIN && env.SIP_DOMAIN.includes('3cx') ? '3cx' : 'freepbx');
  res.json({ provider });
});


// Switch Provider Endpoint
app.post('/api/config/set-provider', (req, res) => {
  const { provider } = req.body;
  if (!['3cx', 'freepbx'].includes(provider)) {
    return res.status(400).json({ success: false, error: 'Invalid provider' });
  }

  try {
    // 1. Load profiles
    let profiles = {};
    // Initialize profiles if needed (simplified for standalone)

    // 2. Update .env
    const currentEnv = parseEnv();
    const updates = { ...currentEnv, SIP_PROVIDER: provider };

    // Default logic for FreePBX
    if (provider === 'freepbx' && !updates.SIP_AUTH_ID && updates.SIP_EXTENSION) {
      updates.SIP_AUTH_ID = updates.SIP_EXTENSION;
    }

    writeEnv(updates);

    console.log(`[CONFIG] Switched provider to ${provider}`);

    // 3. Restart Voice App (Standalone Mode)
    // We use pkill to stop it; the supervisor (or manual loop) should restart it
    // If running via docker-compose, this might not restart it if restart_policy is no
    // but standard gemini-phone start uses docker compose which has restart policy.
    // For standalone (npm start), user might need to restart manually if no supervisor.

    const { exec } = require('child_process');
    exec('pkill -f "voice-app" || true', (err) => {
      // Optionally try to restart it if we are the supervisor (we are not)
    });

    res.json({ success: true, message: `Switched to ${provider}. Please wait for Voice App to restart.` });
  } catch (error) {
    console.error('Failed to set provider:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



// Save Full Configuration (From Setup Page)
app.post('/api/config/save', (req, res) => {
  const config = req.body; // { SIP_DOMAIN, SIP_EXTENSION, ... }

  // Update .env
  writeEnv(config);

  // Also update the Profile for the CURRENT provider
  let profiles = {};
  if (fs.existsSync(PROFILES_FILE)) {
    profiles = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
  }

  const env = parseEnv();
  const provider = env.SIP_PROVIDER || '3cx';

  profiles[provider] = {
    SIP_DOMAIN: config.SIP_DOMAIN,
    SIP_REGISTRAR: config.SIP_REGISTRAR || config.SIP_DOMAIN, // Default registrar to domain
    SIP_EXTENSION: config.SIP_EXTENSION,
    SIP_AUTH_ID: config.SIP_AUTH_ID,
    SIP_PASSWORD: config.SIP_PASSWORD,
    DRACHTIO_SIP_PORT: config.DRACHTIO_SIP_PORT
  };

  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));

  // Trigger Restart of Voice App
  const { exec } = require('child_process');
  console.log(`[CONFIG] Configuration saved for ${provider}. Restarting...`);

  exec('pkill -f "voice-app"', (err) => {
    setTimeout(() => {
      exec('cd ../voice-app && nohup npm start > ../voice-app.log 2>&1 &');
    }, 1000);
  });

  res.json({ success: true });
});

// Setup Page
app.get('/setup', (req, res) => {
  const env = parseEnv();
  const provider = env.SIP_PROVIDER || '3cx';
  const providerName = provider === '3cx' ? '3CX Phone System' : 'FreePBX / Asterisk';

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Configure ${providerName}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
      <style>
        :root { --bg: #09090b; --panel: #18181b; --text: #e4e4e7; --accent: #8b5cf6; --input-bg: #27272a; }
        body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); padding: 2rem; display: flex; justify-content: center; }
        .container { background: var(--panel); padding: 2rem; border-radius: 12px; width: 100%; max-width: 500px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        h1 { margin-bottom: 1.5rem; font-size: 1.5rem; color: white; display:flex; align-items:center; gap:10px; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: #a1a1aa; }
        input { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #3f3f46; background: var(--input-bg); color: white; box-sizing: border-box; }
        input:focus { outline: none; border-color: var(--accent); }
        .actions { margin-top: 2rem; display: flex; gap: 10px; }
        .btn { flex: 1; padding: 12px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
        .btn-primary { background: var(--accent); color: white; }
        .btn-secondary { background: #3f3f46; color: white; }
        .btn:hover { opacity: 0.9; }
        .provider-badge { font-size: 0.8rem; padding: 4px 8px; background: #3f3f46; border-radius: 4px; color: #a5b4fc; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>
           Configure PBX
           <span class="provider-badge">${provider.toUpperCase()}</span>
        </h1>
        <p style="color: #a1a1aa; margin-bottom: 2rem;">Enter the details for your ${providerName} extension.</p>
        
        <form id="configForm" onsubmit="saveConfig(event)">
          <div class="form-group">
            <label>SIP Domain / IP Address</label>
            <input type="text" name="SIP_DOMAIN" value="${env.SIP_DOMAIN || ''}" required placeholder="e.g. 192.168.1.50 or mypbx.3cx.us">
          </div>
          
          <div class="form-group">
            <label>Extension Number</label>
            <input type="text" name="SIP_EXTENSION" value="${env.SIP_EXTENSION || ''}" required placeholder="e.g. 1001">
          </div>
          
          <div class="form-group">
            <label>Authentication ID ${provider === 'freepbx' ? '(Same as Extension)' : ''}</label>
            <input type="text" name="SIP_AUTH_ID" value="${env.SIP_AUTH_ID || ''}" placeholder="Leave empty to use Extension">
          </div>
          
          <div class="form-group">
            <label>Secret / Password</label>
            <input type="password" name="SIP_PASSWORD" value="${env.SIP_PASSWORD || ''}" required>
          </div>
          
          <div class="form-group">
             <label>Registrar Server (Optional)</label>
             <input type="text" name="SIP_REGISTRAR" value="${env.SIP_REGISTRAR || ''}" placeholder="Defaults to Domain if empty">
          </div>

          <div class="actions">
            <button type="button" class="btn btn-secondary" onclick="window.location='/'">Cancel</button>
            <button type="submit" class="btn btn-primary">Save & Connect</button>
          </div>
        </form>
      </div>
      
      <script>
        async function saveConfig(e) {
          e.preventDefault();
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());
          
          // Defaults
          if(!data.SIP_AUTH_ID) data.SIP_AUTH_ID = data.SIP_EXTENSION;
          if(!data.SIP_REGISTRAR) data.SIP_REGISTRAR = data.SIP_DOMAIN;
          
          const btn = e.target.querySelector('.btn-primary');
          btn.innerText = 'Saving...';
          btn.disabled = true;
          
          try {
            await fetch('/api/config/save', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(data)
            });
            alert('Settings saved! Connecting to PBX...');
            window.location = '/';
          } catch(err) {
            alert('Error saving config');
            btn.innerText = 'Save & Connect';
            btn.disabled = false;
          }
        }
      </script>
    </body>
    </html>
  `);
});


// ===================================
// Auto-Update System
// ===================================

app.get('/api/update/check', async (req, res) => {
  try {
    // 1. Get Local Version
    const localPkg = require('./package.json');
    const localVersion = localPkg.version;

    // 2. Get Remote Version
    const fetch = (await import('node-fetch')).default || global.fetch;
    const remoteRes = await fetch('https://raw.githubusercontent.com/jayis1/networkschucks-phone-but-for-gemini/main/mission-control/package.json');
    if (!remoteRes.ok) throw new Error('Failed to check GitHub');

    const remotePkg = await remoteRes.json();
    const remoteVersion = remotePkg.version;

    // Simple semantic check (assume newer string != older string means update)
    const updateAvailable = localVersion !== remoteVersion;

    res.json({
      success: true,
      updateAvailable,
      localVersion,
      remoteVersion
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/update/apply', (req, res) => {
  const { exec } = require('child_process');

  // We execute git pull in the ROOT project directory
  // mission-control is in /subdir, so go up one level
  const projectRoot = path.join(__dirname, '..');

  console.log('[UPDATE] Starting update process...');

  exec('git pull origin main', { cwd: projectRoot }, (error, stdout, stderr) => {
    if (error) {
      console.error(`[UPDATE] Git pull failed: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log('[UPDATE] Git pull success:', stdout);

    // Restart logic: We need to restart the mission-control process itself.
    // In many setups (like npm start), killing it might trigger a restart if using nodemon or pm2.
    // If running via `node server.js` manually, it will just die.
    // But since the user asked for it, we'll try to restart via the start script or just exit 
    // and hope the outer supervisor handles it.

    // For this environment, we can re-execute the start command in background and exit.

    setTimeout(() => {
      // If we are running via npm start, we might just be able to exit?
      // Let's try to spawn a new one then exit.
      const subprocess = require('child_process').spawn('nohup', ['node', 'mission-control/server.js'], {
        cwd: projectRoot,
        detached: true,
        stdio: 'ignore'
      });
      subprocess.unref();
      process.exit(0);
    }, 1000);

    res.json({ success: true, message: 'Update applied. Restarting...' });
  });
});

// Logs API - Aggregated (Existing)
app.post('/api/logs', (req, res) => {
  const { level, service, message, data } = req.body;
  if (!message) return res.status(400).send({ error: 'Message required' });

  addLog(level || 'INFO', service || 'UNKNOWN', message, data);
  res.send({ success: true });
});

app.get('/api/logs', async (req, res) => {
  try {
    let combinedLogs = [...systemLogs];

    // Fetch Voice App Logs
    try {
      const vRes = await fetch(`${VOICE_APP_URL} /api/logs`);
      const vData = await vRes.json();
      if (vData.logs) combinedLogs = combinedLogs.concat(vData.logs);
    } catch (e) { }

    // Fetch Inference Logs
    try {
      const iRes = await fetch(`${INFERENCE_URL}/logs`);
      const iData = await iRes.json();
      if (iData.logs) combinedLogs = combinedLogs.concat(iData.logs);
    } catch (e) { }

    // Fetch API Server Logs
    try {
      const aRes = await fetch(`${API_SERVER_URL}/logs`);
      const aData = await aRes.json();
      if (aData.logs) combinedLogs = combinedLogs.concat(aData.logs);
    } catch (e) { }

    // Sort by timestamp desc
    combinedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit
    combinedLogs = combinedLogs.slice(0, 100);

    res.json({ logs: combinedLogs });
  } catch (e) {
    res.json({ logs: systemLogs });
  }
});

// HTTP Server (User requested no HTTPS)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mission Control started on port ${PORT} (HTTP)`);
  addLog('INFO', 'MISSION-CONTROL', `Server started on http://localhost:${PORT}`);
});
