/**
 * SIP Call Handler with Conversation Loop
 * v12: Device registry integration with proper method names
 */

const { setTimeout: sleep } = require('node:timers/promises');
const { initiateOutboundCall } = require('./outbound-handler');

// Audio cue URLs
const READY_BEEP_URL = 'http://127.0.0.1:3000/static/ready-beep.wav';
const GOTIT_BEEP_URL = 'http://127.0.0.1:3000/static/gotit-beep.wav';
const HOLD_MUSIC_URL = 'http://127.0.0.1:3000/static/hold-music.mp3';

// Default voice ID (Morpheus)
const DEFAULT_VOICE_ID = 'JAgnJveGGUh4qy4kh6dF';

// Gemini Code-style thinking phrases
const THINKING_PHRASES = [
  "Pondering...",
  "Elucidating...",
  "Cogitating...",
  "Ruminating...",
  "Contemplating...",
  "Consulting the oracle...",
  "Summoning knowledge...",
  "Engaging neural pathways...",
  "Accessing the mainframe...",
  "Querying the void...",
  "Let me think about that...",
  "Processing...",
  "Hmm, interesting question...",
  "One moment...",
  "Searching my brain...",
];

function getRandomThinkingPhrase() {
  return THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)];
}

function extractCallerId(req) {
  var from = req.get("From") || "";
  var match = from.match(/sip:([+\d]+)@/);
  if (match) return match[1];
  var numMatch = from.match(/<sip:(\d+)@/);
  if (numMatch) return numMatch[1];
  return "unknown";
}

/**
 * Extract dialed extension from SIP To header
 */
function extractDialedExtension(req) {
  var to = req.get("To") || "";
  var match = to.match(/sip:(\d+)@/);
  if (match) {
    return match[1];
  }
  return null;
}

function isGoodbye(transcript) {
  const lower = transcript.toLowerCase().trim();
  const goodbyePhrases = ['goodbye', 'good bye', 'bye', 'hang up', 'end call', "that's all", 'thats all'];
  return goodbyePhrases.some(function (phrase) {
    return lower === phrase || lower.includes(' ' + phrase) ||
      lower.startsWith(phrase + ' ') || lower.endsWith(' ' + phrase);
  });
}

/**
 * Extract voice-friendly line from Gemini's response
 * Priority: VOICE_RESPONSE > CUSTOM COMPLETED > COMPLETED > first sentence
 */
function extractVoiceLine(response) {
  // Priority 1: VOICE_RESPONSE (new format)
  var voiceMatch = response.match(/🗣️\s*VOICE_RESPONSE:\s*([^\n]+)/im);
  if (voiceMatch) {
    var text = voiceMatch[1].trim().replace(/\*+/g, '').replace(/\[.*?\]/g, '').trim();
    if (text && text.split(/\s+/).length <= 60) {
      return text;
    }
  }

  // Priority 2: CUSTOM COMPLETED
  var customMatch = response.match(/🗣️\s*CUSTOM\s+COMPLETED:\s*(.+?)(?:\n|$)/im);
  if (customMatch) {
    text = customMatch[1].trim().replace(/\*+/g, '').replace(/\[.*?\]/g, '').trim();
    if (text && text.split(/\s+/).length <= 50) {
      return text;
    }
  }

  // Priority 3: COMPLETED
  var completedMatch = response.match(/🎯\s*COMPLETED:\s*(.+?)(?:\n|$)/im);
  if (completedMatch) {
    return completedMatch[1].trim().replace(/\*+/g, '').replace(/\[.*?\]/g, '').trim();
  }

  // Priority 4: First sentence
  var firstSentence = response.split(/[.!?]/)[0];
  if (firstSentence && firstSentence.length < 500) {
    return firstSentence.trim();
  }

  return response.substring(0, 500).trim();
}

/**
 * Main conversation loop
 * @param {Object} deviceConfig - Device configuration (name, prompt, voiceId, etc.) or null for default
 */
async function conversationLoop(endpoint, dialog, callUuid, options, deviceConfig) {
  const { ttsService, whisperClient, geminiBridge, wsPort, audioForkServer, activeCalls, n8nConfig, srf, mediaServer, callerId } = options;

  let session = null;
  let forkRunning = false;
  let callbackTarget = null; // Track if we need to call someone back

  // Get device-specific settings
  const deviceName = deviceConfig ? deviceConfig.name : 'Morpheus';
  const devicePrompt = deviceConfig ? deviceConfig.prompt : null;
  const voiceId = (deviceConfig && deviceConfig.voiceId) ? deviceConfig.voiceId : DEFAULT_VOICE_ID;
  const greeting = deviceConfig && deviceConfig.name !== 'Morpheus'
    ? "Hello! I'm " + deviceConfig.name + ". How can I help you today?"
    : "Hello! I'm your server. How can I help you today?";

  // Add system instruction for callback capability
  const systemContext = `\n[SYSTEM] Current Caller ID: ${callerId}.\nYou have the ability to call people back. If the user asks you to call a number or return a call, reply with: "I'll call them right now. 🗣️ CALLBACK: <number>" (replace <number> with the actual number).`;

  try {
    console.log('[' + new Date().toISOString() + '] CONVERSATION Starting (session: ' + callUuid + ', device: ' + deviceName + ', voice: ' + voiceId + ')...');

    // Register session with activeCalls for n8n control
    if (activeCalls) {
      activeCalls.set(callUuid, {
        processCommand: async (cmd) => {
          console.log(`[${new Date().toISOString()}] COMMAND Received:`, cmd);
          if (cmd.type === 'speak' && cmd.text) {
            const url = await ttsService.generateSpeech(cmd.text, voiceId);
            await endpoint.play(url);
          } else if (cmd.type === 'hangup') {
            await endpoint.api('uuid_kill', callUuid);
          }
        }
      });
    }

    // Helper to send webhooks
    const sendWebhook = async (event, payload) => {
      if (!n8nConfig || !n8nConfig.webhook_url) return;
      try {
        const axios = require('axios');
        await axios.post(n8nConfig.webhook_url, {
          event,
          callId: callUuid,
          timestamp: new Date().toISOString(),
          ...payload
        });
      } catch (err) {
        console.error(`[Webhook] Failed to send ${event}:`, err.message);
      }
    };

    await sendWebhook('start', { from: 'unknown', to: 'unknown' }); // TODO: extract these if needed

    // Play device-specific greeting with device voice
    const greetingUrl = await ttsService.generateSpeech(greeting, voiceId);
    await endpoint.play(greetingUrl);

    // Start fork for entire call
    const wsUrl = 'ws://127.0.0.1:' + wsPort + '/' + encodeURIComponent(callUuid);
    const sessionPromise = audioForkServer.expectSession(callUuid, { timeoutMs: 10000 });

    await endpoint.forkAudioStart({
      wsUrl: wsUrl,
      mixType: 'mono',
      sampling: '16k'
    });
    forkRunning = true;

    session = await sessionPromise;
    console.log('[' + new Date().toISOString() + '] AUDIO Fork connected');

    // Main conversation loop
    let turnCount = 0;
    const MAX_TURNS = 20;

    while (turnCount < MAX_TURNS) {
      turnCount++;
      console.log('[' + new Date().toISOString() + '] CONVERSATION Turn ' + turnCount + '/' + MAX_TURNS);

      // READY BEEP
      try {
        await endpoint.play(READY_BEEP_URL);
      } catch (e) {
        console.log('[' + new Date().toISOString() + '] BEEP: Ready beep failed, continuing');
      }

      session.setCaptureEnabled(true);
      console.log('[' + new Date().toISOString() + '] LISTEN Waiting for speech...');

      let utterance = null;
      try {
        utterance = await session.waitForUtterance({ timeoutMs: 30000 });
        console.log('[' + new Date().toISOString() + '] LISTEN Got: ' + utterance.audio.length + ' bytes');
      } catch (err) {
        console.log('[' + new Date().toISOString() + '] LISTEN Timeout: ' + err.message);
      }

      session.setCaptureEnabled(false);

      if (!utterance) {
        const promptUrl = await ttsService.generateSpeech("I didn't hear anything. Are you still there?", voiceId);
        await endpoint.play(promptUrl);
        continue;
      }

      // GOT-IT BEEP
      try {
        await endpoint.play(GOTIT_BEEP_URL);
      } catch (e) {
        console.log('[' + new Date().toISOString() + '] BEEP: Got-it beep failed, continuing');
      }

      // Transcribe
      const transcript = await whisperClient.transcribe(utterance.audio, {
        format: 'pcm',
        sampleRate: 16000
      });

      console.log('[' + new Date().toISOString() + '] WHISPER: "' + transcript + '"');

      await sendWebhook('speech', { transcript });

      if (!transcript || transcript.trim().length < 2) {
        const clarifyUrl = await ttsService.generateSpeech("Sorry, I didn't catch that. Could you repeat?", voiceId);
        await endpoint.play(clarifyUrl);
        continue;
      }

      if (isGoodbye(transcript)) {
        const byeUrl = await ttsService.generateSpeech("Goodbye! Call again anytime.", voiceId);
        await endpoint.play(byeUrl);
        break;
      }

      // THINKING FEEDBACK
      const thinkingPhrase = getRandomThinkingPhrase();
      // ... thinking logic ...
      console.log('[' + new Date().toISOString() + '] THINKING: "' + thinkingPhrase + '"');
      const thinkingUrl = await ttsService.generateSpeech(thinkingPhrase, voiceId);
      await endpoint.play(thinkingUrl);

      // Hold music in background
      let musicPlaying = false;
      endpoint.play(HOLD_MUSIC_URL).catch(function (e) {
        console.log('[' + new Date().toISOString() + '] MUSIC: Hold music failed, continuing');
      });
      musicPlaying = true;

      // Query Gemini with device-specific prompt
      console.log('[' + new Date().toISOString() + '] GEMINI Querying (device: ' + deviceName + ')...');
      console.log('[' + new Date().toISOString() + '] GEMINI Querying (device: ' + deviceName + ')...');
      const geminiResponse = await geminiBridge.query(
        transcript + systemContext,
        { callId: callUuid, devicePrompt: devicePrompt }
      );

      // Stop hold music
      if (musicPlaying) {
        try {
          await endpoint.api('uuid_break', endpoint.uuid);
        } catch (e) { }
      }

      console.log('[' + new Date().toISOString() + '] G EMINI Response received');

      // Extract and play voice line with device voice
      const voiceLine = extractVoiceLine(geminiResponse);
      console.log('[' + new Date().toISOString() + '] VOICE: "' + voiceLine + '"');

      const responseUrl = await ttsService.generateSpeech(voiceLine, voiceId);
      await endpoint.play(responseUrl);

      // Check for CALLBACK command
      const callbackMatch = geminiResponse.match(/🗣️\s*CALLBACK:\s*([+\d]+)/im);
      if (callbackMatch) {
        callbackTarget = callbackMatch[1].trim();
        console.log('[' + new Date().toISOString() + '] CALLBACK Detected target: ' + callbackTarget);
        break; // End conversation loop to initiate callback
      }

      console.log('[' + new Date().toISOString() + '] CONVERSATION Turn ' + turnCount + ' complete');
    }

    if (turnCount >= MAX_TURNS) {
      const maxUrl = await ttsService.generateSpeech("We've been talking for a while. Goodbye!", voiceId);
      await endpoint.play(maxUrl);
    }

  } catch (error) {
    console.error('[' + new Date().toISOString() + '] CONVERSATION Error:', error.message);
    try {
      if (session) session.setCaptureEnabled(false);
      const errUrl = await ttsService.generateSpeech("Sorry, something went wrong.", voiceId);
      await endpoint.play(errUrl);
    } catch (e) { }
  } finally {
    console.log('[' + new Date().toISOString() + '] CONVERSATION Cleanup...');

    if (activeCalls) activeCalls.delete(callUuid);

    // We can't access sendWebhook here easily without redefining, or we can assume it was defined in scope.
    // Ideally we define sendWebhook outside/top of function or reuse. 
    // Re-instantiating axios for cleanup webhook if needed, or just skip for now to avoid complexity in this replace block.
    // But let's try to be clean.
    if (n8nConfig && n8nConfig.webhook_url) {
      try {
        const axios = require('axios');
        axios.post(n8nConfig.webhook_url, {
          event: 'end',
          callId: callUuid,
          timestamp: new Date().toISOString()
        }).catch(e => console.error('Webhook end fail', e.message));
      } catch (e) { }
    }

    try {
      await geminiBridge.endSession(callUuid);
    } catch (e) { }

    if (forkRunning) {
      try {
        await endpoint.forkAudioStop();
      } catch (e) { }
    }

    try { dialog.destroy(); } catch (e) { }

    // Execute Callback if requested
    if (callbackTarget && srf && mediaServer) {
      console.log('[' + new Date().toISOString() + '] CALLBACK Initiating call to ' + callbackTarget);
      // Wait a moment for previous call to fully teardown
      setTimeout(async () => {
        try {
          // Use "announce" mode or "conversation" mode?
          // The user probably wants Morpheus to talk to them.
          // We'll use "message" as context and start conversation.
          await initiateOutboundCall(srf, mediaServer, {
            to: callbackTarget,
            message: `Hello, this is ${deviceName} returning your call.`,
            callerId: deviceConfig ? deviceConfig.extension : '9000',
            deviceConfig: deviceConfig,
            timeoutSeconds: 45
          });
        } catch (err) {
          console.error('[' + new Date().toISOString() + '] CALLBACK Failed: ' + err.message);
        }
      }, 2000);
    }
  }
}

/**
 * Strip video tracks from SDP (FreeSWITCH doesn't support H.261 and rejects with 488)
 * Keeps only audio tracks to ensure codec negotiation succeeds
 */
function stripVideoFromSdp(sdp) {
  if (!sdp) return sdp;

  const lines = sdp.split('\r\n');
  const result = [];
  let inVideoSection = false;

  for (const line of lines) {
    // Check if we're entering a video media section
    if (line.startsWith('m=video')) {
      inVideoSection = true;
      continue; // Skip the m=video line
    }

    // Check if we're entering a new media section (audio, etc.)
    if (line.startsWith('m=') && !line.startsWith('m=video')) {
      inVideoSection = false;
    }

    // Skip all lines in the video section
    if (inVideoSection) {
      continue;
    }

    result.push(line);
  }

  return result.join('\r\n');
}

/**
 * Handle incoming SIP INVITE
 */
async function handleInvite(req, res, options) {
  const { mediaServer, deviceRegistry } = options;

  const callerId = extractCallerId(req);
  const dialedExt = extractDialedExtension(req);

  // Look up device config using deviceRegistry.get() (works with name OR extension)
  let deviceConfig = null;
  if (deviceRegistry && dialedExt) {
    deviceConfig = deviceRegistry.get(dialedExt);
    if (deviceConfig) {
      console.log('[' + new Date().toISOString() + '] CALL Device matched: ' + deviceConfig.name + ' (ext ' + dialedExt + ')');
    } else {
      console.log('[' + new Date().toISOString() + '] CALL Unknown extension ' + dialedExt + ', using default');
      deviceConfig = deviceRegistry.getDefault();
    }
  }

  console.log('[' + new Date().toISOString() + '] CALL Incoming from: ' + callerId + ' to ext: ' + (dialedExt || 'unknown'));

  try {
    // Strip video from SDP to avoid FreeSWITCH 488 error with unsupported video codecs
    const originalSdp = req.body;
    const audioOnlySdp = stripVideoFromSdp(originalSdp);
    if (originalSdp !== audioOnlySdp) {
      console.log('[' + new Date().toISOString() + '] CALL Stripped video track from SDP');
    }

    const result = await mediaServer.connectCaller(req, res, { remoteSdp: audioOnlySdp });
    const { endpoint, dialog } = result;
    const callUuid = endpoint.uuid;

    console.log('[' + new Date().toISOString() + '] CALL Connected: ' + callUuid);

    dialog.on('destroy', function () {
      console.log('[' + new Date().toISOString() + '] CALL Ended');
      if (endpoint) endpoint.destroy().catch(function () { });
    });

    // Pass activeCalls and n8nConfig (already in options)
    const loopOptions = { ...options, callerId };
    await conversationLoop(endpoint, dialog, callUuid, loopOptions, deviceConfig);
    return { endpoint: endpoint, dialog: dialog, callerId: callerId, callUuid: callUuid };

  } catch (error) {
    console.error('[' + new Date().toISOString() + '] CALL Error:', error.message);
    try { res.send(500); } catch (e) { }
    throw error;
  }
}

module.exports = {
  handleInvite: handleInvite,
  extractCallerId: extractCallerId,
  extractDialedExtension: extractDialedExtension
};
