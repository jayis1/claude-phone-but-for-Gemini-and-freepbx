import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

import os from 'os';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Get current CPU Usage (%)
 */
function getCpuUsage() {
    const loads = os.loadavg();
    const cpuCount = os.cpus().length;
    // loadavg is for 1 min, normalized by CPU count
    const usage = (loads[0] / cpuCount) * 100;
    return Math.min(Math.round(usage), 100);
}

/**
 * Get GPU Usage (%) via nvidia-smi
 */
function getGpuUsage() {
    return new Promise((resolve) => {
        exec('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits', (err, stdout) => {
            if (err || !stdout) return resolve(0);
            const usage = parseInt(stdout.trim(), 10);
            resolve(isNaN(usage) ? 0 : usage);
        });
    });
}

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 4000;
const EXECUTION_SERVER_URL = process.env.EXECUTION_SERVER_URL || 'http://localhost:3333';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY is missing via .env or process.env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Session Storage: callId -> ChatSession
const sessions = new Map();

// Tool Definitions (for Gemini SDK)
const tools = [
    {
        functionDeclarations: [
            {
                name: "make_outbound_call",
                description: "Initiate a phone call to a number or extension.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        to: { type: "STRING", description: "The phone number or extension to call" },
                        message: { type: "STRING", description: "The message to speak when they answer" },
                        mode: { type: "STRING", enum: ["conversation", "announce"], description: "mode: 'conversation' or 'announce'" }
                    },
                    required: ["to", "message"]
                }
            }
        ]
    }
];

// Mutable Model State
let currentModelName = "gemini-1.5-flash";
let modelWithTools;

// Initialize Model
function initModel(modelName) {
    console.log(`[Inference] Initializing model: ${modelName}`);
    currentModelName = modelName;
    modelWithTools = genAI.getGenerativeModel({
        model: modelName,
        tools: tools,
        systemInstruction: "You are a helpful AI assistant connected to a phone system. You can answer questions and perform actions using the available tools. Keep your responses concise (under 40 words) as they will be spoken out loud."
    });
}

// Initial boot
initModel(currentModelName);

app.post('/ask', async (req, res) => {
    const { prompt, callId, devicePrompt } = req.body;

    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    // console.log(`[Inference] Query: "${prompt}" (CallID: ${callId || 'none'})`);

    try {
        let chatSession;

        // 1. Get or Create Session
        if (callId && sessions.has(callId)) {
            chatSession = sessions.get(callId);
        } else {
            chatSession = modelWithTools.startChat({
                history: []
            });
            if (callId) sessions.set(callId, chatSession);
        }

        // 2. Send Message to Gemini
        let result = await chatSession.sendMessage(prompt);
        let response = result.response;

        // 3. Handle Tool Calls Loop
        const functionCalls = response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
            for (const call of functionCalls) {
                console.log(`[Inference] Tool Call Detected: ${call.name}`, call.args);

                if (call.name === 'make_outbound_call') {
                    // EXECUTE TOOL via Execution Server
                    const toolResult = await executeToolOnLegacyServer(call.args);

                    // Send result back to Gemini
                    result = await chatSession.sendMessage([
                        {
                            functionResponse: {
                                name: "make_outbound_call",
                                response: { result: toolResult }
                            }
                        }
                    ]);
                    response = result.response;
                }
            }
        }

        const text = response.text();
        console.log(`[Inference] Response: "${text}"`);

        res.json({
            success: true,
            response: text,
            sessionId: callId
        });

    } catch (error) {
        console.error("[Inference] Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

async function executeToolOnLegacyServer(args) {
    try {
        const res = await fetch(`${EXECUTION_SERVER_URL}/call`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(args)
        });
        return await res.json();
    } catch (err) {
        console.error("[Inference] Execution Server Error:", err);
        return { error: err.message };
    }
}

app.post('/end-session', (req, res) => {
    const { callId } = req.body;
    if (callId) sessions.delete(callId);
    res.json({ success: true });
});

/**
 * POST /config
 * Update server configuration (e.g. model)
 */
app.post('/config', (req, res) => {
    const { model } = req.body;
    if (model) {
        console.log(`[Inference] Switching model to ${model}`);
        initModel(model);
    }
    res.json({ success: true, model: currentModelName });
});

/**
 * GET /sessions
 * List active sessions
 */
/**
 * GET /stats
 * System resource usage stats
 */
app.get('/stats', async (req, res) => {
    res.json({
        success: true,
        cpu: getCpuUsage(),
        gpu: await getGpuUsage(),
        sessions: sessions.size,
        model: currentModelName
    });
});

/**
 * GET /
 * Home Page with Model Selector
 */
app.get('/', (req, res) => {
    const models = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-pro',
        'gemini-1.5-flash'
    ];

    const modelOptions = models.map(m =>
        `<option value="${m}" ${m === currentModelName ? 'selected' : ''}>${m}</option>`
    ).join('');

    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Inference Brain</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            :root {
              --bg: #0f172a;
              --card: #1e293b;
              --text: #f8fafc;
              --accent: #ec4899;
              --accent-hover: #db2777;
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
              background: linear-gradient(to right, #f472b6, #a78bfa);
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
            .endpoints {
              text-align: left;
              background: rgba(0,0,0,0.2);
              padding: 1rem;
              border-radius: 8px;
              margin-bottom: 1rem;
              font-size: 0.85rem;
              color: #cbd5e1;
            }
            .endpoints > div {
              padding: 0.25rem 0;
            }
            .model-select {
              background: #334155;
              color: white;
              border: 1px solid #475569;
              padding: 4px 8px;
              border-radius: 4px;
              font-family: monospace;
              width: 100%;
            }
            .footer {
              font-size: 0.875rem;
              color: #64748b;
              border-top: 1px solid var(--border);
              padding-top: 1rem;
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
                if (!data.success) {
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
          <h1>🧠 Inference Brain</h1>
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
                  ${modelOptions}
                </select>
              </div>
            </div>
          </div>

          <div class="endpoints">
            <div class="info-label" style="margin-bottom:0.5rem">Endpoints</div>
            <div>POST /ask</div>
            <div>POST /end-session</div>
            <div>POST /config</div>
            <div>GET /stats</div>
            <div>GET /sessions <span id="session-count" style="float:right; opacity:0.5">${sessions.size} active</span></div>
          </div>

          <div class="footer">
            Server Time: ${new Date().toLocaleTimeString()}
          </div>
        </div>
      </body>
    </html>
  `;
    res.send(html);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🧠 Inference Server running on port ${PORT}`);
});
