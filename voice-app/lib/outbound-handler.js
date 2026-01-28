/**
 * Outbound Call Handler
 * Core logic for initiating outbound SIP calls via drachtio
 * v2: Added voiceId support for device-specific TTS
 *
 * Uses Early Offer pattern:
 * 1. Create FreeSWITCH endpoint first to get local SDP
 * 2. Send INVITE with our SDP
 * 3. On answer, connect the endpoint with remote SDP
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const ttsService = require('./tts-service');

/**
 * Initiate an outbound call
 *
 * @param {Object} srf - drachtio SRF instance
 * @param {Object} mediaServer - FreeSWITCH media server
 * @param {Object} options - Call options
 * @param {string} options.to - Phone number in E.164 format (+155512.5.37)
 * @param {string} options.message - Message to play when answered
 * @param {string} [options.callerId] - Caller ID (defaults to DEFAULT_CALLER_ID env var)
 * @param {number} [options.timeoutSeconds=30] - Ring timeout in seconds
 * @returns {Promise<Object>} { callId, dialog, endpoint }
 */
async function initiateOutboundCall(srf, mediaServer, options) {
  const {
    to,
    message,
    callerId,
    timeoutSeconds = 30,
    deviceConfig = null
  } = options;

  const callId = uuidv4();
  const startTime = Date.now();

  try {
    logger.info('Initiating outbound call', {
      callId,
      to,
      callerId,
      timeout: timeoutSeconds
    });

    // STEP 1: Create FreeSWITCH endpoint first (Early Offer pattern)
    logger.info('Creating FreeSWITCH endpoint', { callId });
    const endpoint = await mediaServer.createEndpoint();

    // Get local SDP from FreeSWITCH
    const localSdp = endpoint.local.sdp;

    // Format SIP URI for PBX
    // Use the phone number as provided, but strip the '+' for compatibility with most PBX systems.
    // For SIP URIs, using user=phone or just digits is safer than + prefix which many PBX reject in Request URI.
    const dialPrefix = process.env.DIAL_PREFIX || '';
    const cleanTo = to.replace(/^\+/, '');
    // If dialPrefix is '+', we intentionally DON'T add it to the SIP URI user part to avoid 503.
    // We only use dial prefix if it's NOT a +.
    const safePrefix = dialPrefix === '+' ? '' : dialPrefix;
    const phoneNumber = safePrefix + cleanTo;
    const sipTrunkHost = process.env.SIP_REGISTRAR || process.env.SIP_DOMAIN || '127.0.0.1';
    const externalIp = process.env.EXTERNAL_IP || '127.0.0.1';
    const headerDomain = sipTrunkHost;
    const extensionNumber = process.env.SIP_EXTENSION || '9000';
    const defaultCallerId = callerId || process.env.DEFAULT_CALLER_ID || extensionNumber;

    // SIP Authentication
    const sipAuthUsername = process.env.SIP_AUTH_ID || process.env.SIP_EXTENSION;
    const sipAuthPassword = process.env.SIP_PASSWORD;

    const sipUri = 'sip:' + phoneNumber + '@' + sipTrunkHost + ';transport=udp';

    logger.info('Dialing SIP URI', {
      callId,
      sipUri,
      from: defaultCallerId,
      hasAuth: !!(sipAuthUsername && sipAuthPassword)
    });

    // For authentication to succeed, the From user MUST match the extension we registered as.
    // We send the actual Caller ID via P-Asserted-Identity or Remote-Party-ID.
    const fromExtension = deviceConfig ? deviceConfig.extension : extensionNumber;
    const displayName = deviceConfig ? deviceConfig.name : (defaultCallerId !== extensionNumber ? defaultCallerId : null);
    const fromHeader = displayName
      ? '"' + displayName + '" <sip:' + fromExtension + '@' + headerDomain + '>'
      : '<sip:' + fromExtension + '@' + headerDomain + '>';

    // Prepare PAI and RPID identity (keep + if present)
    const identityPart = defaultCallerId.includes('+') ? defaultCallerId : `+${defaultCallerId.replace(/^\+/, '')}`;

    const uacOptions = {
      localSdp: localSdp,
      headers: {
        'From': fromHeader,
        'P-Asserted-Identity': `<sip:${identityPart}@${headerDomain}>`,
        'Remote-Party-ID': `<sip:${identityPart}@${headerDomain}>;party=calling;screen=yes;privacy=off`,
        'User-Agent': 'NetworkChuck-VoiceServer/1.0',
        'X-Call-ID': callId
      }
    };

    // Add SIP authentication - prefer device credentials, fall back to env vars
    const authUsername = deviceConfig ? deviceConfig.authId : sipAuthUsername;
    const authPassword = deviceConfig ? deviceConfig.password : sipAuthPassword;

    if (authUsername && authPassword) {
      uacOptions.auth = {
        username: authUsername,
        password: authPassword
      };
      logger.info('SIP authentication enabled', {
        callId,
        username: authUsername,
        device: deviceConfig ? deviceConfig.name : 'default'
      });
    }

    let isRinging = false;
    let callAnswered = false;

    // Create the outbound call (returns dialog directly, not { uas, uac })
    const uac = await srf.createUAC(sipUri, uacOptions, {
      cbRequest: function (err, req) {
        // Called when INVITE is sent
        if (err) {
          logger.error('INVITE send failed', { callId, error: err.message });
        } else {
          logger.info('INVITE sent successfully', { callId });
        }
      },
      cbProvisional: function (res) {
        // Called on provisional responses (180 Ringing, 183 Progress, etc.)
        logger.info('Provisional response received', {
          callId,
          status: res.status,
          reason: res.reason
        });

        if (res.status === 180) {
          isRinging = true;
          logger.info('Phone is ringing', { callId, to });
        }
      }
    });

    // STEP 3: Call was answered! Connect endpoint with remote SDP
    callAnswered = true;
    const latency = Date.now() - startTime;

    logger.info('Call answered', {
      callId,
      to,
      latency,
      isRinging
    });

    // Modify endpoint with remote SDP to complete media connection
    await endpoint.modify(uac.remote.sdp);

    logger.info('Media connection established', { callId });

    // Setup call cleanup on remote hangup
    uac.on('destroy', function () {
      logger.info('Remote party hung up', { callId });
      if (endpoint) {
        endpoint.destroy().catch(function (err) {
          logger.warn('Failed to destroy endpoint on hangup', {
            callId,
            error: err.message
          });
        });
      }
    });

    return {
      callId,
      dialog: uac,
      endpoint,
      isRinging,
      latency
    };

  } catch (error) {
    const latency = Date.now() - startTime;

    logger.error('Outbound call failed', {
      callId,
      to,
      error: error.message,
      latency
    });

    // Handle specific SIP error codes
    if (error.status) {
      const status = error.status;

      // Specifically check for Q.850 Cause 34 (No circuit/channel available)
      // This is almost always an Outbound Route issue in FreePBX
      if (error.message && error.message.includes('cause=34')) {
        logger.error('🚨 CRITICAL SIP ERROR: No path to destination (Cause 34)');
        logger.error('🔎 FREEPBX DIAGNOSIS: The link between the AI (Port 5070) and FreePBX (Port 5060) is HEALTHY.');
        logger.error('🔎 PROBLEM: FreePBX cannot find a matching "Outbound Route" for the dialed number.');
        logger.error(`🔎 ATTEMPTED: ${dialPrefix}${to.replace(/^\+/, '')}`);
        logger.error('🛠️ FIX: In FreePBX -> Outbound Routes, ensure you have a pattern like "00." or "00XXXXXXX" that matches your country.');
        throw new Error('no_route_to_destination');
      }

      if (status === 486) {
        throw new Error('busy');
      } else if (status === 480 || status === 408) {
        throw new Error('no_answer');
      } else if (status === 404) {
        throw new Error('not_found');
      } else if (status === 503) {
        logger.error('🚨 SIP 503: Service Unavailable');
        logger.error('🔎 FREEPBX DIAGNOSIS: FreePBX rejected the call. Check "Asterisk Logfiles" for the real reason.');
        throw new Error('service_unavailable');
      } else if (status === 401 || status === 407) {
        throw new Error('auth_failed');
      }
    }

    throw error;
  }
}

/**
 * Play a TTS message to an active call
 *
 * @param {Object} endpoint - FreeSWITCH endpoint
 * @param {string} message - Text to convert to speech and play
 * @param {Object} [options] - Playback options
 * @param {string} [options.voiceId] - ElevenLabs voice ID for device-specific voice
 * @returns {Promise<void>}
 */
async function playMessage(endpoint, message, options) {
  options = options || {};
  var voiceId = options.voiceId || null;
  var startTime = Date.now();

  try {
    logger.info('Generating TTS for outbound call', {
      textLength: message.length,
      voiceId: voiceId || 'default'
    });

    // Generate TTS audio file with optional device voice
    var audioUrl = await ttsService.generateSpeech(message, voiceId);

    logger.info('Playing TTS to caller', { audioUrl: audioUrl });

    // Play the audio file via FreeSWITCH
    await endpoint.play(audioUrl);

    var duration = Date.now() - startTime;

    logger.info('TTS playback completed', {
      duration: duration,
      audioUrl: audioUrl
    });

  } catch (error) {
    logger.error('Failed to play message', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Hangup an active outbound call
 *
 * @param {Object} dialog - drachtio dialog (UAC)
 * @param {Object} endpoint - FreeSWITCH endpoint
 * @param {string} callId - Call UUID for logging
 */
async function hangupCall(dialog, endpoint, callId) {
  logger.info('Hanging up outbound call', { callId: callId });

  try {
    // Destroy SIP dialog
    if (dialog && !dialog.destroyed) {
      await dialog.destroy();
      logger.info('Dialog destroyed', { callId: callId });
    }
  } catch (error) {
    logger.warn('Failed to destroy dialog', {
      callId: callId,
      error: error.message
    });
  }

  try {
    // Destroy FreeSWITCH endpoint
    if (endpoint) {
      await endpoint.destroy();
      logger.info('Endpoint destroyed', { callId: callId });
    }
  } catch (error) {
    logger.warn('Failed to destroy endpoint', {
      callId: callId,
      error: error.message
    });
  }
}

module.exports = {
  initiateOutboundCall: initiateOutboundCall,
  playMessage: playMessage,
  hangupCall: hangupCall
};
