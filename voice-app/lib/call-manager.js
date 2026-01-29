/**
 * Call Manager
 * Registry of active calls to enable external control (n8n, API)
 * 
 * Stores active session objects and provides EventEmitters for async command injection.
 */

const EventEmitter = require('events');

class CallManager extends EventEmitter {
    constructor() {
        super();
        this.calls = new Map();
    }

    /**
     * Register a new call
     * @param {string} callId 
     * @param {Object} context - Any initial context
     */
    register(callId, context = {}) {
        if (this.calls.has(callId)) return;

        console.log(`[CallManager] Registering call ${callId}`);
        this.calls.set(callId, {
            id: callId,
            startTime: Date.now(),
            events: new EventEmitter(),
            context: context,
            commandQueue: []
        });

        this.emit('call_started', callId);
    }

    /**
     * Unregister a call
     * @param {string} callId 
     */
    unregister(callId) {
        if (!this.calls.has(callId)) return;

        console.log(`[CallManager] Unregistering call ${callId}`);
        const call = this.calls.get(callId);
        call.events.removeAllListeners();
        this.calls.delete(callId);

        this.emit('call_ended', callId);
    }

    /**
     * Get a call object
     * @param {string} callId 
     */
    get(callId) {
        return this.calls.get(callId);
    }

    /**
     * Send a command to a specific call
     * @param {string} callId 
     * @param {Object} command - { type: 'speak', text: '...', ... }
     */
    sendCommand(callId, command) {
        const call = this.get(callId);
        if (!call) {
            throw new Error(`Call ${callId} not found`);
        }

        console.log(`[CallManager] Command for ${callId}: ${command.type}`);
        call.events.emit('command', command);
        return true;
    }

    /**
     * Wait for next command (Async Logic)
     * @param {string} callId 
     * @param {number} timeoutMs 
     */
    waitForCommand(callId, timeoutMs = 10000) {
        const call = this.get(callId);
        if (!call) return Promise.reject(new Error('Call not found'));

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                call.events.removeListener('command', handler);
                resolve(null); // Timeout (continue normal flow)
            }, timeoutMs);

            const handler = (cmd) => {
                clearTimeout(timer);
                resolve(cmd);
            };

            call.events.once('command', handler);
        });
    }
}

// Singleton instance
module.exports = new CallManager();
