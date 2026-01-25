import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 4000;
const EXECUTION_SERVER_URL = process.env.EXECUTION_SERVER_URL || 'http://localhost:3333';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY is missing via .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "You are a helpful AI assistant connected to a phone system. You can answer questions and perform actions using the available tools. Keep your responses concise (under 40 words) as they will be spoken out loud."
});

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

const modelWithTools = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    tools: tools,
    systemInstruction: "You are a helpful AI assistant connected to a phone system. You can answer questions and perform actions using the available tools. Keep your responses concise (under 40 words) as they will be spoken out loud."
});

app.post('/ask', async (req, res) => {
    const { prompt, callId, devicePrompt } = req.body;

    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    console.log(`[Inference] Query: "${prompt}" (CallID: ${callId || 'none'})`);

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
        // We loop because a tool call might trigger *another* tool call, or text.
        // However, for simplicity here, we'll handle one turn of function calling.
        // The Google SDK usually handles the "function_call" part, but we need to execute it.

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
        // TODO: Implement dynamic model switching if required
    }
    res.json({ success: true, model: model || "gemini-1.5-flash" });
});

/**
 * GET /sessions
 * List active sessions
 */
app.get('/sessions', (req, res) => {
    res.json({
        success: true,
        count: sessions.size,
        sessions: Array.from(sessions.entries()).map(([callId]) => ({ callId }))
    });
});

app.listen(PORT, () => {
    console.log(`🧠 Inference Server running on port ${PORT}`);
});
