/**
 * Gemini HTTP API Server
 *
 * HTTP server that wraps Gemini CLI with session management
 * Runs on the API server to handle voice interface queries
 *
 * Usage:
 *   node server.js
 *
 * Endpoints:
 *   POST /ask - Send a prompt to Gemini (with optional callId for session)
 *   POST /end-session - Clean up session for a call
 *   GET /health - Health check
 */

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  buildQueryContext,
  buildStructuredPrompt,
  tryParseJsonFromText,
  validateRequiredFields,
  buildRepairPrompt,
} = require('./structured');

const app = express();
const PORT = process.env.PORT || 3333;

/**
 * Build the full environment that Gemini CLI expects
 * This mimics what happens when you run `gemini` in a terminal
 * with your zsh profile fully loaded.
 */
function buildGeminiEnvironment() {
  const HOME = process.env.HOME || '/Users/MadLAbs';
  const PAI_DIR = path.join(HOME, '.gemini');

  // Load ~/.gemini/.env (all API keys)
  const envPath = path.join(PAI_DIR, '.env');
  const paiEnv = {};
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          paiEnv[key] = valueParts.join('=');
        }
      }
    }
  }

  // Build PATH like zsh profile does
  const fullPath = [
    '/opt/homebrew/bin',
    '/opt/homebrew/opt/python@3.12/bin',
    '/opt/homebrew/opt/libpq/bin',
    path.join(HOME, '.bun/bin'),
    path.join(HOME, '.local/bin'),
    path.join(HOME, '.pyenv/bin'),
    path.join(HOME, '.pyenv/shims'),
    path.join(HOME, 'go/bin'),
    '/usr/local/go/bin',
    path.join(HOME, 'bin'),
    path.join(HOME, '.lmstudio/bin'),
    path.join(HOME, '.opencode/bin'),
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin'
  ].join(':');

  const env = {
    ...process.env,
    ...paiEnv,
    PATH: fullPath,
    HOME,
    PAI_DIR,
    PAI_HOME: HOME,
    DA: 'Morpheus',
    DA_COLOR: 'purple',
    GOROOT: '/usr/local/go',
    GOPATH: path.join(HOME, 'go'),
    PYENV_ROOT: path.join(HOME, '.pyenv'),
    BUN_INSTALL: path.join(HOME, '.bun'),
    // CRITICAL: These tell Gemini it's running in the proper environment
    GEMINI: '1',
    GEMINI_ENTRYPOINT: 'cli',
  };

  // CRITICAL: Remove GEMINI_API_KEY so Gemini CLI uses subscription auth
  // If GEMINI_API_KEY is set (even to placeholder), CLI tries API auth instead
  delete env.GEMINI_API_KEY;

  return env;
}

// Pre-build the environment once at startup
const geminiEnv = buildGeminiEnvironment();
console.log('[STARTUP] Loaded environment with', Object.keys(geminiEnv).length, 'variables');
console.log('[STARTUP] PATH includes:', geminiEnv.PATH.split(':').slice(0, 5).join(', '), '...');

// Log which API keys are available (without showing values)
const apiKeys = Object.keys(geminiEnv).filter(k =>
  k.includes('API_KEY') || k.includes('TOKEN') || k.includes('SECRET') || k === 'PAI_DIR'
);
console.log('[STARTUP] API keys loaded:', apiKeys.join(', '));

// Voice App URL (for outbound calls)
// Defaults to localhost:3000 (standard Docker networking)
const VOICE_APP_URL = process.env.VOICE_APP_URL || 'http://localhost:3000';
console.log(`[STARTUP] Voice App URL: ${VOICE_APP_URL}`);

// Session storage: callId -> claudeSessionId
const sessions = new Map();

// Model selection - Sonnet for balanced speed/quality
const GEMINI_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash'
];
let GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

function parseGeminiStdout(stdout) {
  // Claude Code CLI may output JSONL; when it does, extract the `result` message.
  // Otherwise, fall back to raw stdout.
  let response = '';
  let sessionId = null;

  try {
    const lines = String(stdout || '').trim().split('\n');
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'result' && parsed.result) {
          response = parsed.result;
          sessionId = parsed.session_id;
        }
      } catch {
        // Not JSONL; ignore.
      }
    }

    if (!response) response = String(stdout || '').trim();
  } catch {
    response = String(stdout || '').trim();
  }

  return { response, sessionId };
}

function runGeminiOnce({ fullPrompt, callId, timestamp }) {
  const startTime = Date.now();

  const args = [
    '--dangerously-skip-permissions',
    '-p', fullPrompt,
    '--model', GEMINI_MODEL
  ];

  if (callId) {
    if (sessions.has(callId)) {
      args.push('--resume', callId);
      console.log(`[${timestamp}] Resuming session: ${callId}`);
    } else {
      args.push('--session-id', callId);
      sessions.set(callId, true);
      console.log(`[${timestamp}] Starting new session: ${callId}`);
    }
  }

  return new Promise((resolve, reject) => {
    const gemini = spawn('gemini', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      env: geminiEnv
    });

    let stdout = '';
    let stderr = '';

    gemini.stdin.end();
    gemini.stdout.on('data', (data) => { stdout += data.toString(); });
    gemini.stderr.on('data', (data) => { stderr += data.toString(); });

    gemini.on('error', (error) => {
      reject(error);
    });

    gemini.on('close', (code) => {
      const duration_ms = Date.now() - startTime;
      resolve({ code, stdout, stderr, duration_ms });
    });
  });
}

// Tool Definitions
const TOOLS = [
  {
    name: "make_outbound_call",
    description: "Initiate a phone call to a number or extension. Use this when the user asks you to call someone.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "The phone number or extension to call" },
        message: { type: "string", description: "The message to speak when they answer" },
        mode: { type: "string", enum: ["conversation", "announce"], description: "Default to 'conversation'" }
      },
      required: ["to", "message"]
    }
  }
];

const VOICE_CONTEXT = `[VOICE CALL CONTEXT]
This query comes via voice call.

You have access to the following tools:
${JSON.stringify(TOOLS, null, 2)}

To use a tool, output ONLY the JSON object for the tool call (no other text) in this format:
{"tool": "make_outbound_call", "parameters": {"to": "...", "message": "...", "mode": "conversation"}}

If NOT using a tool, you must include BOTH of these lines:
🗣️ VOICE_RESPONSE: [Your conversational answer in 40 words or less]
🎯 COMPLETED: [Status summary in 12 words or less]

IMPORTANT:
- The VOICE_RESPONSE line is what the caller HEARS.
- If you call a tool, do NOT output VOICE_RESPONSE yet. The system will handle it.
- Example query: "Call extension 100"
- Example tool output: {"tool": "make_outbound_call", "parameters": {"to": "100", "message": "Hello, connecting you now.", "mode": "conversation"}}
[END VOICE CONTEXT]

`;

// Middleware
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

/**
 * POST /ask
 *
 * Request body:
 *   {
 *     "prompt": "What Docker containers are running?",
 *     "callId": "optional-call-uuid",
 *     "devicePrompt": "optional device-specific prompt"
 *   }
 *
 * Response:
 *   { "success": true, "response": "...", "duration_ms": 1234, "sessionId": "..." }
 *
 * Session Management:
 *   - If callId is provided and we have a stored session, uses --resume
 *   - First query for a callId captures the session_id for future turns
 *   - This maintains conversation context across multiple turns in a phone call
 *
 * Device Prompts:
 *   - If devicePrompt is provided, it's prepended before VOICE_CONTEXT
 *   - This allows each device (NAS, Proxmox, etc.) to have its own identity and skills
 */
app.post('/ask', async (req, res) => {
  const { prompt, callId, devicePrompt } = req.body;
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'Missing prompt in request body'
    });
  }

  // Check if we have an existing session for this call
  const existingSession = callId ? sessions.get(callId) : null;

  console.log(`[${timestamp}] QUERY: "${prompt.substring(0, 100)}..."`);
  console.log(`[${timestamp}] MODEL: ${GEMINI_MODEL}`);
  console.log(`[${timestamp}] SESSION: callId=${callId || 'none'}, existing=${existingSession || 'none'}`);
  console.log(`[${timestamp}] DEVICE PROMPT: ${devicePrompt ? 'Yes (' + devicePrompt.substring(0, 30) + '...)' : 'No'}`);

  try {
    /**
     * Prompt layering order:
     * 1. Device prompt (if provided) - identity and available skills
     * 2. VOICE_CONTEXT - general voice call instructions
     * 3. User's prompt - what they actually said
     */
    let fullPrompt = '';

    if (devicePrompt) {
      fullPrompt += `[DEVICE IDENTITY]\n${devicePrompt}\n[END DEVICE IDENTITY]\n\n`;
    }

    fullPrompt += VOICE_CONTEXT;
    fullPrompt += prompt;

    const { code, stdout, stderr, duration_ms } = await runGeminiOnce({ fullPrompt, callId, timestamp });

    if (code !== 0) {
      console.error(`[${new Date().toISOString()}] ERROR: Gemini CLI exited with code ${code}`);
      console.error(`STDERR: ${stderr}`);
      console.error(`STDOUT: ${stdout.substring(0, 500)}`);
      const errorMsg = stderr || stdout || `Exit code ${code}`;
      return res.json({ success: false, error: `Gemini CLI failed: ${errorMsg}`, duration_ms });
    }

    const { response, sessionId } = parseGeminiStdout(stdout);

    if (sessionId && callId) {
      sessions.set(callId, sessionId);
      console.log(`[${new Date().toISOString()}] SESSION STORED: ${callId} -> ${sessionId}`);
    }

    console.log(`[${new Date().toISOString()}] RESPONSE (${duration_ms}ms): "${response.substring(0, 100)}..."`);

    // Check for Tool Call
    try {
      const toolJson = JSON.parse(response);
      if (toolJson.tool === 'make_outbound_call' && toolJson.parameters) {
        console.log(`[${timestamp}] TOOL DETECTED: make_outbound_call to ${toolJson.parameters.to}`);

        // Execute the tool
        const callResult = await executeOutboundCall({
          to: toolJson.parameters.to,
          message: toolJson.parameters.message,
          mode: toolJson.parameters.mode,
          device: null
        });

        return res.json({
          success: true,
          response: `🗣️ VOICE_RESPONSE: Calling ${toolJson.parameters.to} now.\n🎯 COMPLETED: Outbound call initiated (Call ID: ${callResult.callId})`,
          sessionId,
          duration_ms,
          tool_executed: true,
          callId: callResult.callId
        });
      }
    } catch (e) {
      // Not a valid JSON tool call, proceed as normal text response
    }

    res.json({ success: true, response, sessionId, duration_ms });

  } catch (error) {
    const duration_ms = Date.now() - startTime;
    console.error(`[${timestamp}] ERROR:`, error.message);

    res.json({
      success: false,
      error: error.message,
      duration_ms
    });
  }
});

/**
 * POST /ask-structured
 *
 * Like /ask, but returns machine-validated JSON for n8n automations.
 *
 * Request body:
 *   {
 *     "prompt": "Check Ceph health",
 *     "callId": "optional-call-uuid",
 *     "devicePrompt": "optional device-specific prompt",
 *     "schema": {
 *        "queryType": "ceph_health",
 *        "requiredFields": ["cluster_status","ssd_usage_percent","recommendation"],
 *        "fieldGuidance": { "cluster_status": "Ceph overall health, e.g. HEALTH_OK/HEALTH_WARN/HEALTH_ERR" },
 *        "allowExtraFields": true,
 *        "example": { "cluster_status": "HEALTH_WARN", "ssd_usage_percent": 88, "recommendation": "alert" }
 *     },
 *     "includeVoiceContext": false,
 *     "maxRetries": 1
 *   }
 *
 * Response (success):
 *   { "success": true, "data": {...}, "raw_response": "...", "duration_ms": 1234 }
 */
app.post('/ask-structured', async (req, res) => {
  const {
    prompt,
    callId,
    devicePrompt,
    schema = {},
    includeVoiceContext = false,
    maxRetries = 1,
  } = req.body || {};

  const timestamp = new Date().toISOString();

  if (!prompt) {
    return res.status(400).json({ success: false, error: 'Missing prompt in request body' });
  }

  const queryContext = buildQueryContext({
    queryType: schema.queryType,
    requiredFields: schema.requiredFields,
    fieldGuidance: schema.fieldGuidance,
    allowExtraFields: schema.allowExtraFields !== false,
    example: schema.example,
  });

  let fullPrompt = buildStructuredPrompt({
    devicePrompt,
    queryContext: (includeVoiceContext ? VOICE_CONTEXT : '') + queryContext,
    userPrompt: prompt,
  });

  console.log(`[${timestamp}] STRUCTURED QUERY: "${String(prompt).substring(0, 100)}..."`);
  console.log(`[${timestamp}] MODEL: ${GEMINI_MODEL}`);
  console.log(`[${timestamp}] SESSION: callId=${callId || 'none'}, existing=${callId ? (sessions.has(callId) ? 'yes' : 'no') : 'none'}`);

  try {
    let lastRaw = '';
    let lastError = 'Unknown error';
    let totalDuration = 0;
    const retries = Number.isFinite(Number(maxRetries)) ? Number(maxRetries) : 0;
    let attemptsMade = 0;

    for (let attempt = 0; attempt <= retries; attempt++) {
      attemptsMade = attempt + 1;
      const { code, stdout, stderr, duration_ms } = await runGeminiOnce({ fullPrompt, callId, timestamp });
      totalDuration += duration_ms;

      if (code !== 0) {
        lastError = `Gemini CLI failed: ${stderr}`;
        lastRaw = String(stdout || '').trim();
        return res.status(502).json({
          success: false,
          error: lastError,
          raw_response: lastRaw,
          duration_ms: totalDuration,
          attempts: attemptsMade,
        });
      }

      const { response, sessionId } = parseGeminiStdout(stdout);
      lastRaw = response;

      if (sessionId && callId) sessions.set(callId, sessionId);

      const parsed = tryParseJsonFromText(response);
      if (!parsed.ok) {
        lastError = parsed.error || 'Failed to parse JSON';
      } else {
        const validation = validateRequiredFields(parsed.data, schema.requiredFields);
        if (validation.ok) {
          return res.json({
            success: true,
            data: parsed.data,
            json_text: parsed.jsonText,
            raw_response: response,
            duration_ms: totalDuration,
            attempts: attemptsMade,
          });
        }
        lastError = validation.error || 'Validation failed';
      }

      if (attempt >= retries) break;

      // Retry once with a repair prompt that forces "JSON only" formatting.
      const repairPrompt = buildRepairPrompt({
        queryType: schema.queryType,
        requiredFields: schema.requiredFields,
        fieldGuidance: schema.fieldGuidance,
        allowExtraFields: schema.allowExtraFields !== false,
        originalUserPrompt: prompt,
        invalidAssistantOutput: lastRaw,
        example: schema.example,
      });

      fullPrompt = buildStructuredPrompt({
        devicePrompt,
        queryContext: includeVoiceContext ? VOICE_CONTEXT : '',
        userPrompt: repairPrompt,
      });
    }

    return res.status(422).json({
      success: false,
      error: lastError,
      raw_response: lastRaw,
      duration_ms: totalDuration,
      attempts: attemptsMade,
    });
  } catch (error) {
    console.error(`[${timestamp}] ERROR:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /end-session
 *
 * Clean up session when a call ends
 *
 * Request body:
 *   { "callId": "call-uuid" }
 */
app.post('/end-session', (req, res) => {
  const { callId } = req.body;
  const timestamp = new Date().toISOString();

  if (callId && sessions.has(callId)) {
    sessions.delete(callId);
    console.log(`[${timestamp}] SESSION ENDED: ${callId}`);
  }

  res.json({ success: true });
});

/**
 * POST /config
 * Update server configuration (e.g. model)
 */
app.post('/config', (req, res) => {
  const { model } = req.body;
  if (model) {
    GEMINI_MODEL = model;
    console.log(`[${new Date().toISOString()}] CONFIG UPDATED: Model set to ${GEMINI_MODEL}`);
  }
  res.json({ success: true, model: GEMINI_MODEL });
});

/**
 * GET /sessions
 * List active sessions
 */
app.get('/sessions', (req, res) => {
  res.json({
    success: true,
    count: sessions.size,
    sessions: Array.from(sessions.entries()).map(([callId, sessionId]) => ({ callId, sessionId }))
  });
});


/**
 * Helper: Execute Outbound Call
 */
async function executeOutboundCall({ to, message, mode, device }) {
  if (!to || !message) {
    throw new Error('Missing "to" or "message"');
  }

  const res = await fetch(`${VOICE_APP_URL}/api/outbound-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message, mode, device })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Voice App Error ${res.status}: ${text}`);
  }
  return await res.json();
}

/**
 * POST /call
 * Initiate an outbound call via 3CX/voice-app
 *
 * Request body matches voice-app/outbound-call:
 *   - to: Phone number/Extension
 *   - message: Initial status message
 *   - mode: 'announce' (default) or 'conversation'
 */
app.post('/call', async (req, res) => {
  const { to, message, mode, device } = req.body;
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] OUTBOUND CALL REQUEST: to=${to} mode=${mode || 'announce'}`);

  try {
    const data = await executeOutboundCall({ to, message, mode, device });
    console.log(`[${timestamp}] CALL QUEUED: ${data.callId}`);
    res.json(data);
  } catch (error) {
    console.error(`[${timestamp}] CALL ERROR: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /session/:callId
 * Explicitly kill a session
 */
app.delete('/session/:callId', (req, res) => {
  const { callId } = req.params;
  const deleted = sessions.delete(callId);
  res.json({ success: true, deleted });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'gemini-api-server',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /
 * Info endpoint
 */
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Gemini API</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            :root {
              --bg: #0f172a;
              --card: #1e293b;
              --text: #f8fafc;
              --accent: #8b5cf6;
              --accent-hover: #7c3aed;
              --success: #10b981;
              --border: #334155;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background-color: var(--bg);
              color: var(--text);
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              line-height: 1.6;
            }
            .card {
              background: var(--card);
              padding: 2.5rem;
              border-radius: 16px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
              border: 1px solid var(--border);
              max-width: 450px;
              width: 90%;
              text-align: center;
            }
            h1 {
              font-size: 1.8rem;
              font-weight: 700;
              background: linear-gradient(to right, #38bdf8, #818cf8);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              margin-bottom: 0.5rem;
              margin-top: 0;
            }
            .status-badge {
              display: inline-flex;
              align-items: center;
              background: rgba(16, 185, 129, 0.1);
              color: var(--success);
              padding: 0.25rem 0.75rem;
              border-radius: 9999px;
              font-weight: 500;
              font-size: 0.875rem;
              margin-bottom: 2rem;
              border: 1px solid rgba(16, 185, 129, 0.2);
            }
            .status-badge::before {
              content: "";
              display: inline-block;
              width: 8px;
              height: 8px;
              background-color: var(--success);
              border-radius: 50%;
              margin-right: 0.5rem;
              box-shadow: 0 0 8px var(--success);
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 1rem;
              text-align: left;
              margin-bottom: 2rem;
            }
            .info-item {
              background: rgba(255, 255, 255, 0.03);
              padding: 1rem;
              border-radius: 8px;
              border: 1px solid rgba(255, 255, 255, 0.05);
            }
            .info-label {
              font-size: 0.75rem;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #94a3b8;
              margin-bottom: 0.25rem;
            }
            .info-value {
              font-weight: 600;
              font-family: monospace;
            }
            .footer {
              font-size: 0.875rem;
              color: #64748b;
              border-top: 1px solid var(--border);
              padding-top: 1rem;
            }
            .endpoints {
              text-align: left;
              background: rgba(0,0,0,0.2);
              padding: 1rem;
              border-radius: 8px;
              margin-bottom: 1rem;
              font-size: 0.85rem;
              color: #cbd5e1;
            }
            .endpoints div { margin-bottom: 0.25rem; }
            .model-select {
              background: #334155;
              color: white;
              border: 1px solid #475569;
              padding: 4px 8px;
              border-radius: 4px;
              font-family: monospace;
              width: 100%;
            }
        </style>
        <script>
          document.addEventListener('DOMContentLoaded', () => {
            const select = document.getElementById('model-select');
            select.addEventListener('change', async (e) => {
              const model = e.target.value;
              try {
                const res = await fetch('/config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ model })
                });
                const data = await res.json();
                if (data.success) {
                  alert('Model updated to ' + model);
                } else {
                  alert('Failed to update: ' + data.error);
                }
              } catch (err) {
                alert('Error updating model: ' + err.message);
              }
            });
          });
        </script>
      </head>
      <body>
        <div class="card">
          <h1>Gemini API</h1>
          <div class="status-badge">System Operational</div>
          
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Port</div>
              <div class="info-value">${PORT}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Model</div>
              <div class="info-value">
                <select id="model-select" class="model-select">
                  ${GEMINI_MODELS.map(m => `<option value="${m}" ${m === GEMINI_MODEL ? 'selected' : ''}>${m}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>

          <div class="endpoints">
            <div>POST /ask</div>
            <div>POST /ask-structured</div>
            <div>POST /call</div>
            <div>POST /end-session</div>
            <div>POST /config</div>
            <div>GET /sessions</div>
            <div>DELETE /session/:callId</div>
            <div>GET /health</div>
            <div>POST /config</div>
            <div>GET /sessions</div>
            <div>DELETE /session/:callId</div>
            <div>GET /health</div>
          </div>

          <div class="footer">
            Server Time: ${new Date().toLocaleTimeString()}
          </div>
        </div>
      </body>
    </html>
  `);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(64));
  console.log('Gemini HTTP API Server');
  console.log('='.repeat(64));
  console.log(`\nListening on: http://0.0.0.0:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('\nReady to receive Gemini queries from voice interface.\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});
