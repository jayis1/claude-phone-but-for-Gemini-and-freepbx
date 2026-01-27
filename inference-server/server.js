import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import https from 'https';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Allow self-signed certs for local Mission Control logging
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 4000;
const API_SERVER_URL = process.env.API_SERVER_URL || 'http://localhost:3333';

// Log storage
const logs = [];
const MAX_LOGS = 100;

function addLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  // Include SERVICE field
  logs.unshift({ timestamp, level, message, service: 'INFERENCE-BRAIN', meta });
  if (logs.length > MAX_LOGS) logs.pop();

  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  process.stdout.write(`[${timestamp}] [${level}] ${message} ${metaStr}\n`);

  // Forward to Mission Control (HTTPS)
  // Use a custom agent to allow self-signed certs since we're localhost
  // Note: https is imported at the top level
  const agent = new https.Agent({ rejectUnauthorized: false });

  fetch('https://127.0.0.1:3030/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      level,
      message,
      service: 'INFERENCE-BRAIN',
      timestamp,
      data: meta
    }),
    agent
  }).catch(e => { /* Ignore connection errors */ });
}

// Override console methods
const originalLog = console.log;
const originalError = console.error;

console.log = (msg, ...args) => { addLog('INFO', msg, args); };
console.error = (msg, ...args) => { addLog('ERROR', msg, args); };

// System Stats Helpers
function getCpuUsage() {
  const loads = os.loadavg();
  const cpuCount = os.cpus().length;
  const usage = (loads[0] / cpuCount) * 100;
  return Math.min(Math.round(usage), 100);
}

function getGpuUsage() {
  return new Promise((resolve) => {
    exec('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits', (err, stdout) => {
      resolve((err || !stdout) ? 0 : (parseInt(stdout.trim(), 10) || 0));
    });
  });
}

// ==========================================
// PROXY ENDPOINTS (Forward to API Server)
// ==========================================

async function proxyToApi(endpoint, body) {
  const start = Date.now();
  try {
    console.log(`Forwarding ${endpoint} to API Server...`);
    const res = await fetch(`${API_SERVER_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    const duration = Date.now() - start;
    console.log(`Received response from ${endpoint} (${duration}ms)`);
    return data;
  } catch (err) {
    console.error(`Proxy error to ${endpoint}: ${err.message}`);
    throw err;
  }
}

app.post('/ask', async (req, res) => {
  try {
    const data = await proxyToApi('/ask', req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "Gemini API Server unreachable" });
  }
});

app.post('/ask-structured', async (req, res) => {
  try {
    const data = await proxyToApi('/ask-structured', req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "Gemini API Server unreachable" });
  }
});

app.post('/end-session', async (req, res) => {
  try {
    const data = await proxyToApi('/end-session', req.body);
    res.json(data);
  } catch (err) {
    res.status(200).json({ success: true, note: "API Server unreachable, session assumed ended" });
  }
});

app.post('/config', async (req, res) => {
  try {
    const data = await proxyToApi('/config', req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "Gemini API Server unreachable" });
  }
});

app.get('/stats', async (req, res) => {
  let apiStats = { sessions: 0, model: 'Unknown' };
  try {
    const sRes = await fetch(`${API_SERVER_URL}/sessions`);
    if (sRes.ok) {
      const sData = await sRes.json();
      apiStats.sessions = sData.count || 0;
    }
  } catch (e) { }

  res.json({
    success: true,
    cpu: getCpuUsage(),
    gpu: await getGpuUsage(),
    sessions: apiStats.sessions,
    model: apiStats.model || 'gemini-2.5-pro'
  });
});

// Python Execution Endpoint
import { spawn } from 'child_process';

app.post('/run-python', (req, res) => {
  const { script, args, prompt } = req.body;
  const scriptName = script || 'mock_llm.py';
  const scriptPath = path.join(__dirname, 'python', scriptName);

  // Security check: ensure script is inside python dir
  if (scriptName.includes('..') || scriptName.includes('/')) {
    return res.status(403).json({ error: "Access denied: Invalid script path" });
  }

  console.log(`Executing Python script: ${scriptName}`);

  const pyProcess = spawn('python3', [scriptPath]);
  let output = '';
  let errorOutput = '';

  // Send input to Python script via stdin
  const inputPayload = JSON.stringify({ prompt: prompt || args, ...req.body });
  pyProcess.stdin.write(inputPayload);
  pyProcess.stdin.end();

  pyProcess.stdout.on('data', (data) => {
    output += data.toString();
  });

  pyProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  pyProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Python script exited with code ${code}: ${errorOutput}`);
      return res.status(500).json({ success: false, error: errorOutput || 'Script execution failed' });
    }

    try {
      // Try to parse JSON output from Python
      const jsonResponse = JSON.parse(output);
      res.json(jsonResponse);
    } catch (e) {
      // Return raw output if not JSON
      res.json({ success: true, raw_output: output.trim() });
    }
  });
});

app.get('/logs', (req, res) => {
  res.json({ success: true, logs });
});

app.get('/health', (req, res) => {
  res.json({ success: true, service: 'inference-brain', timestamp: new Date().toISOString() });
});

// Home Page
app.get('/', (req, res) => {
  const models = ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
  const modelOptions = models.map(m => `<option value="${m}">${m}</option>`).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Inference Brain</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          :root { --bg: #0f172a; --text: #f8fafc; --accent: #ec4899; }
          body { font-family: sans-serif; background: var(--bg); color: var(--text); padding: 2rem; text-align: center; }
          .card { background: #1e293b; padding: 2rem; border-radius: 12px; display: inline-block; max-width: 500px; width: 100%; }
          select { padding: 8px; border-radius: 4px; background: #334155; color: white; width: 100%; margin-bottom: 1rem; }
          button { padding: 10px 20px; background: var(--accent); color: white; border: none; border-radius: 6px; cursor: pointer; }
        </style>
        <script>
          async function updateModel() {
            const model = document.getElementById('model').value;
            await fetch('/config', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({model}) });
            alert('Model updated!');
          }
        </script>
      </head>
      <body>
        <div class="card">
          <h1>🧠 Inference Brain Proxy</h1>
          <p>Connected to Gemini API Server at ${API_SERVER_URL}</p>
          <hr style="border-color: #334155; margin: 1rem 0;">
          <label>Active Model</label>
          <select id="model">${modelOptions}</select>
          <button onclick="updateModel()">Update Model</button>
        </div>
      </body>
    </html>
  `;
  res.send(html);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🧠 Inference Server (Proxy Mode) running on port ${PORT}`);
  console.log(`   Points to API Server: ${API_SERVER_URL}`);
});
