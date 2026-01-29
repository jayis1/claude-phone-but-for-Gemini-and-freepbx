/**
 * Fax Machine Protocol (Context Relay)
 * 
 * "The One" (Stack 4) operates as a Fax Machine.
 * It receives SIP MESSAGE payloads (Context) and relays them to:
 * - Neo (Node 2)
 * - FreePBX
 * - Trinity (Node 3)
 * - Morpheus (Node 1)
 */

const os = require('os');
const axios = require('axios');

const pbxBridge = require('./pbx-bridge');

class FaxRelay {
    constructor(srf, config) {
        this.srf = srf;
        this.config = config;
        this.name = 'TheOne (FaxMachine)';
    }

    async start() {
        console.log(`[FAX-MACHINE] 📠 Powering up Fax Protocol on port ${this.config.sip.registrar_port || 5091}...`);

        // Auto-Provision logic
        if (process.env.FREEPBX_API_URL) {
            try {
                // Extension 9003 for The One (Fax Machine)
                const faxExt = '9003';
                console.log(`[FAX-MACHINE] Auto-provisioning Extension ${faxExt} in FreePBX...`);
                await pbxBridge.provisionFaxExtension(faxExt, 'The One (Fax)', 'password');
                console.log(`[FAX-MACHINE] Provisioning complete. Applying config...`);
                await pbxBridge.graphql('mutation { doreload(input: {}) { status message } }');
            } catch (e) {
                console.error(`[FAX-MACHINE] Provisioning failed: ${e.message}`);
            }
        }

        console.log(`[FAX-MACHINE] Listening for incoming context transmissions...`);

        // Intercept SIP MESSAGE requests
        this.srf.use('message', this.handleMessage.bind(this));
    }

    async handleMessage(req, res, next) {
        if (req.method !== 'MESSAGE') return next();

        const from = req.get('From');
        const contentType = req.get('Content-Type') || 'text/plain';
        const body = req.body;

        // Acknowledge receipt immediately (Fax ACK)
        res.send(200);

        console.log(`\n[FAX-INCOMING] 📄 Transmission received from ${from}`);
        console.log(`[FAX-CONTENT] [${contentType}] ${body.substring(0, 100)}${body.length > 100 ? '...' : ''}`);

        // Parse "Fax" Header if present (custom header for routing)
        const targetNode = req.get('X-Fax-Target') || 'BROADCAST';

        // Process the "Fax"
        this.processFax(body, targetNode);
    }

    async processFax(data, target) {
        // Logic to "print" or "relay" the fax
        console.log(`[FAX-PROCESS] Routing to: ${target}`);

        // If this is a control signal, execute it
        if (data.includes('OP_CODE: SYNC_CONTEXT')) {
            this.broadcastContext(data);
        }
    }

    broadcastContext(contextData) {
        console.log(`[FAX-RELAY] 📡 Broadcasting context to Mesh Nodes...`);
        // Logic to send SIP MESSAGE to locally known peers
        // In a real implementation, we would iterate through config.mesh_peers
        // and send req.msg to them.
    }
}

module.exports = FaxRelay;
