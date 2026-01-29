import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import client from "prom-client";

const app = express();
app.use(bodyParser.json());

// Prometheus Metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const callCounter = new client.Counter({
    name: 'ai_phone_calls_total',
    help: 'Total count of AI phone calls',
    labelNames: ['stack', 'state', 'target'],
});

const errorCounter = new client.Counter({
    name: 'ai_phone_errors_total',
    help: 'Total count of AI phone errors',
    labelNames: ['stack', 'type'],
});

const activeCalls = new client.Gauge({
    name: 'ai_phone_active_calls',
    help: 'Number of active calls being handled by the AI mesh',
    labelNames: ['stack'],
});

register.registerMetric(callCounter);
register.registerMetric(errorCounter);
register.registerMetric(activeCalls);

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

app.post("/events", async (req, res) => {
    const event = req.body;
    const node = event.stack || 'unknown';
    const state = event.state || 'UNKNOWN';

    console.log(`[${node}] Event: ${state} | CallID: ${event.call_id}`);

    // Update Metrics
    callCounter.inc({ stack: node, state: state, target: event.target || 'none' });

    if (state === 'INIT' || state === 'MESH_IN') {
        activeCalls.inc({ stack: node });
    } else if (state === 'HANGUP' || state === 'FAILED') {
        activeCalls.dec({ stack: node });
    }

    try {
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...event,
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) {
            console.error("Failed to forward event to n8n:", await response.text());
            errorCounter.inc({ stack: node, type: 'n8n_delivery_failure' });
        }
    } catch (error) {
        console.error("Error forwarding event to n8n:", error.message);
        errorCounter.inc({ stack: node, type: 'n8n_network_error' });
    }

    res.sendStatus(200);
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Elite Webhook API + Metrics Exporter listening on port ${PORT}`);
});
