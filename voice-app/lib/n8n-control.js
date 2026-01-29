/**
 * n8n Control Module
 * 
 * Provides an Express router for n8n to control active calls.
 * Endpoints:
 * - POST /calls/:callId/command
 */

const express = require('express');
const router = express.Router();
const debug = require('debug')('voice-app:n8n-control');

/**
 * Create n8n control router
 * @param {Map} activeCalls - Map of callUuid -> session object
 * @returns {Router} Express router
 */
function createN8nRouter(activeCalls) {
  
  /**
   * POST /calls/:callId/command
   * Execute a command on an active call
   * Body: { type: 'speak'|'hangup', ...args }
   */
  router.post('/calls/:callId/command', async (req, res) => {
    const { callId } = req.params;
    const command = req.body;

    if (!activeCalls.has(callId)) {
      return res.status(404).json({ error: 'Call not found or not active' });
    }

    const session = activeCalls.get(callId);
    
    debug(`Received command for ${callId}:`, command);

    try {
      // Execute command on session
      if (session.processCommand) {
        await session.processCommand(command);
        res.json({ success: true, message: 'Command accepted' });
      } else {
        res.status(501).json({ error: 'Session does not support commands' });
      }
    } catch (error) {
      console.error(`Error executing n8n command for ${callId}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = {
  createN8nRouter
};
