/**
 * Gemini HTTP API Bridge
 * HTTP client for Gemini API server with session management
 */

const axios = require('axios');

let GEMINI_API_URL = process.env.GEMINI_API_URL || 'http://localhost:4000';

/**
 * Set the Gemini API URL dynamically
 * @param {string} url - New API URL
 */
function setInferenceUrl(url) {
  if (url) {
    GEMINI_API_URL = url;
    console.log(`[GEMINI-BRIDGE] URL updated to: ${GEMINI_API_URL}`);
  }
}

/**
 * Query Gemini via HTTP API with session support
 * @param {string} prompt - The prompt/question to send to Gemini
 * @param {Object} options - Options including callId for session management
 * @param {string} options.callId - Call UUID for maintaining conversation context
 * @param {string} options.devicePrompt - Device-specific personality prompt
 * @param {number} options.timeout - Timeout in seconds (default: 30, AC27)
 * @returns {Promise<string>} Gemini's response
 */
async function query(prompt, options = {}) {
  const { callId, devicePrompt, timeout = 30 } = options; // AC27: Default 30s timeout
  const timestamp = new Date().toISOString();

  const N8N_URL = process.env.N8N_WEBHOOK_URL;
  const targetUrl = N8N_URL || `${GEMINI_API_URL}/ask`;

  // Determine if we are talking to n8n, Brain, or Hands
  const isN8n = !!N8N_URL;
  const isBrain = !isN8n && GEMINI_API_URL.includes(':4000');
  const targetLabel = isN8n ? 'N8N (Logic Engine)' : (isBrain ? 'BRAIN (Inference)' : 'HANDS (API Server)');

  try {
    console.log(`[${timestamp}] GEMINI Querying ${targetLabel} at ${targetUrl}...`);
    if (callId) {
      console.log(`[${timestamp}] GEMINI Session: ${callId}`);
    }
    if (devicePrompt) {
      console.log(`[${timestamp}] GEMINI Device prompt: ${devicePrompt.substring(0, 50)}...`);
    }

    const response = await axios.post(
      targetUrl,
      { prompt, callId, devicePrompt },
      {
        timeout: timeout * 1000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    // Flexible response parsing (n8n usually uses 'text', our server uses 'response')
    const result = response.data;
    const finalResponse = result.response || result.text || (typeof result === 'string' ? result : null);

    if (!finalResponse && result.success === false) {
      throw new Error(result.error || 'Gemini API returned failure');
    }

    if (!finalResponse) {
      throw new Error('No valid response text found in API response');
    }

    console.log(`[${timestamp}] GEMINI Response received (${result.duration_ms || 'unknown'}ms)`);
    if (result.sessionId) {
      console.log(`[${timestamp}] GEMINI Session ID: ${result.sessionId}`);
    }
    return finalResponse;

  } catch (error) {
    // AC26: API server unreachable during call - don't crash, return helpful message
    if (error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH' || error.code === 'ENETUNREACH') {
      console.warn(`[${timestamp}] GEMINI API server unreachable (${error.code})`);
      return "I'm having trouble connecting to my brain right now. The API server may be offline or unreachable. Please try again later.";
    }

    // AC27: Timeout with helpful error message
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      console.error(`[${timestamp}] GEMINI Timeout after ${timeout} seconds`);
      return "I'm sorry, that request took too long. This might mean the API server is slow or there's a network issue. Try asking something simpler, or check that gemini-phone api-server is running.";
    }

    console.error(`[${timestamp}] GEMINI Error:`, error.message);
    // AC26: Don't crash on unknown errors, return friendly message
    return "I encountered an unexpected error. Please check that the API server is running gemini-phone api-server and is on the same network.";
  }
}

/**
 * End a Gemini session when a call ends
 * @param {string} callId - The call UUID to end the session for
 */
async function endSession(callId) {
  if (!callId) return;

  const timestamp = new Date().toISOString();

  try {
    await axios.post(
      `${GEMINI_API_URL}/end-session`,
      { callId },
      {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    console.log(`[${timestamp}] GEMINI Session ended: ${callId}`);
  } catch (error) {
    // Non-critical, just log
    console.warn(`[${timestamp}] GEMINI Failed to end session: ${error.message}`);
  }
}

/**
 * Check if Gemini API is available
 * @returns {Promise<boolean>} True if API is reachable
 */
async function isAvailable() {
  try {
    await axios.get(`${GEMINI_API_URL}/health`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  query,
  endSession,
  isAvailable,
  setInferenceUrl
};
