/**
 * Voice Interface Application
 * Main entry point - v9 with Multi-Extension + Query API Support
 */

require("dotenv").config();
var Srf = require("drachtio-srf");
var Mrf = require("drachtio-fsmrf");

// Import application modules
var httpServerModule = require("./lib/http-server");
var createHttpServer = httpServerModule.createHttpServer;
var cleanupOldFiles = httpServerModule.cleanupOldFiles;
var AudioForkServer = require("./lib/audio-fork").AudioForkServer;
var sipHandler = require("./lib/sip-handler");
var handleInvite = sipHandler.handleInvite;
var whisperClient = require("./lib/whisper-client");
var geminiBridge = require("./lib/gemini-bridge");
var ttsService = require("./lib/tts-service");
var pbxBridge = require("./lib/pbx-bridge");

// Multi-extension support
var deviceRegistry = require("./lib/device-registry");
var MultiRegistrar = require("./lib/multi-registrar");

// Connection retry utility
var connectionRetry = require("./lib/connection-retry");
var connectWithRetry = connectionRetry.connectWithRetry;

// Import outbound calling routes
var outboundModule = require("./lib/outbound-routes");
var outboundRouter = outboundModule.router;
var setupOutboundRoutes = outboundModule.setupRoutes;

// Import query routes
var queryModule = require("./lib/query-routes");
var queryRouter = queryModule.router;
var setupQueryRoutes = queryModule.setupRoutes;

// Load device registry first
// deviceRegistry is a singleton, already instantiated

// Configuration
var config = {
  drachtio: {
    host: process.env.DRACHTIO_HOST || "drachtio",
    port: parseInt(process.env.DRACHTIO_PORT) || 9022,
    secret: process.env.DRACHTIO_SECRET || "cymru"
  },
  freeswitch: {
    host: process.env.FREESWITCH_HOST || "freeswitch",
    port: parseInt(process.env.FREESWITCH_PORT) || 8021,
    secret: process.env.FREESWITCH_SECRET || "JambonzR0ck$"
  },
  sip: {
    extension: process.env.SIP_EXTENSION || "9000",
    auth_id: process.env.SIP_AUTH_ID || "Au0XZPTpJY",
    password: process.env.SIP_AUTH_PASSWORD || "DGHwMW6v25",
    domain: process.env.SIP_DOMAIN || "hello.networkchuck.com",
    registrar: process.env.SIP_REGISTRAR || "hello.networkchuck.com",
    registrar_port: parseInt(process.env.SIP_REGISTRAR_PORT) || 5060,
    expiry: parseInt(process.env.SIP_EXPIRY) || 3600
  },
  external_ip: process.env.EXTERNAL_IP || "10.70.7.81",
  http_port: parseInt(process.env.HTTP_PORT) || 3000,
  ws_port: parseInt(process.env.WS_PORT) || 3001,
  audio_dir: process.env.AUDIO_DIR || "/tmp/voice-audio"
};

// Initialize drachtio SRF
var srf = new Srf();
var mediaServer = null;
var httpServer = null;
var audioForkServer = null;
var registrar = null;
var drachtioConnected = false;
var freeswitchConnected = false;
var isReady = false;

// Global Log Storage for "Shared System Log"
var globalLogs = [];
const MAX_LOGS = 100;

// Override console methods
const originalLog = console.log;
const originalError = console.error;

console.log = function (msg, ...args) {
  const timestamp = new Date().toISOString();
  // Store
  globalLogs.unshift({ timestamp, level: 'INFO', service: 'VOICE-APP', message: msg });
  if (globalLogs.length > MAX_LOGS) globalLogs.pop();
  // Print
  originalLog.apply(console, [msg, ...args]);
};

console.error = function (msg, ...args) {
  const timestamp = new Date().toISOString();
  // Store
  globalLogs.unshift({ timestamp, level: 'ERROR', service: 'VOICE-APP', message: msg });
  if (globalLogs.length > MAX_LOGS) globalLogs.pop();
  // Print
  originalError.apply(console, [msg, ...args]);
};

/**
 * Initialize HTTP server for and Google Speech/Gemini
 */
async function initializeHttpServer() {
  // FIX: Pass audioDir as first argument
  httpServer = createHttpServer(config.audio_dir, config.http_port);

  // Audio fork server (WebSockets)
  audioForkServer = new AudioForkServer(config.ws_port);
  await audioForkServer.start();
  console.log("[" + new Date().toISOString() + "] WS Audio Fork Server running on port " + config.ws_port);

  // Gemini Bridge
  geminiBridge.setInferenceUrl(process.env.GEMINI_API_URL || "http://localhost:3333");
  console.log("[" + new Date().toISOString() + "] GEMINI Bridge pointing to " + (process.env.GEMINI_API_URL || "http://localhost:3333"));

  // Device Registry (Model/Voice mapping)
  deviceRegistry.on('change', (devices) => {
    console.log("[" + new Date().toISOString() + "] DEVICE Registry updated: " + devices.length + " devices");
  });

  // TTS service
  ttsService.setAudioDir(config.audio_dir);
  console.log("[" + new Date().toISOString() + "] TTS Service configured");

  // Status Endpoint (for gemini-phone doctor)
  // MOVED UP before queryRouter to ensure priority
  httpServer.app.get('/api/status', (req, res) => {
    const regState = {};
    if (registrar) {
      registrar.registrations.forEach((reg, ext) => {
        regState[ext] = {
          registered: true,
          expires: Math.round((reg.registeredAt + reg.expiry * 1000 - Date.now()) / 1000)
        };
      });
    }

    res.json({
      success: true,
      ready: isReady,
      drachtio: drachtioConnected,
      freeswitch: freeswitchConnected,
      registrations: regState
    });
  });

  // ========== QUERY API ROUTES ==========
  setupQueryRoutes({
    geminiBridge: geminiBridge
  });

  httpServer.app.use("/api", queryRouter);
  console.log("[" + new Date().toISOString() + "] QUERY API enabled (/api/query, /api/devices)");

  /**
   * PBX Provisioning Endpoint
   * Triggers automated extension and route creation
   */
  httpServer.app.post('/api/pbx/provision', async (req, res) => {
    try {
      console.log('[API] Starting PBX auto-provisioning...');
      const result = await pbxBridge.provisionAll();

      if (result.success) {
        console.log('[API] PBX Provisioning successful');
        res.json(result);
      } else {
        console.error('[API] PBX Provisioning failed:', result.error);
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('[API] PBX Provisioning exception:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * Provision single extension
   */
  httpServer.app.post('/api/pbx/provision-extension', async (req, res) => {
    const { extension, name } = req.body;
    if (!extension || !name) return res.status(400).json({ success: false, error: 'Extension and Name required' });

    try {
      console.log(`[API] Provisioning extension ${extension} (${name})...`);
      const result = await pbxBridge.provisionExtension(extension, name);

      // Auto-reload config
      await pbxBridge.graphql('mutation { doreload(input: {}) { status message } }');

      res.json({ success: true, result });
    } catch (error) {
      console.error('[API] Provisioning extension failed:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * Provision SIP Trunk and whitelist IP
   */
  httpServer.app.post('/api/pbx/provision-trunk', async (req, res) => {
    const appStackIp = process.env.GEMINI_APP_STACK_IP || config.external_ip;

    try {
      console.log(`[API] Provisioning SIP Trunk for ${appStackIp}...`);
      const trunkResult = await pbxBridge.provisionTrunk(appStackIp);
      await pbxBridge.whitelistAppStackIp(appStackIp);

      // Auto-reload config
      await pbxBridge.graphql('mutation { doreload(input: {}) { status message } }');

      res.json({ success: true, trunk: trunkResult });
    } catch (error) {
      console.error('[API] Provisioning trunk failed:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Log Endpoint
  httpServer.app.get('/api/logs', (req, res) => {
    res.json({ success: true, logs: globalLogs || [] });
  });

  // NOTE: We do NOT call finalize() yet, because we need to add outbound routes later.
  // We will call finalize() in checkReadyState() or enableOutboundCalling().
  // However, without finalize(), 404s might be raw. That's fine for startup.

  // Cleanup old files periodically
  setInterval(function () {
    cleanupOldFiles(config.audio_dir, 5 * 60 * 1000);
  }, 60 * 1000);
}

// ==========================================
// MAIN STARTUP SEQUENCE
// ==========================================

async function start() {
  try {
    console.log("[" + new Date().toISOString() + "] Starting Gemini Phone Voice App...");

    // 1. Initialize HTTP Server and Routes FIRST
    // This ensures all routes are registered before any 404 handlers
    await initializeHttpServer();

    // 2. Connect to PBX / SIP (Drachtio)
    console.log("[" + new Date().toISOString() + "] Connecting to Drachtio...");
    srf.connect({
      host: config.drachtio.host,
      port: config.drachtio.port,
      secret: config.drachtio.secret
    });

    // 3. Connect to Media Server (FreeSWITCH)
    // Connect with exponential backoff retry
    console.log("[" + new Date().toISOString() + "] Connecting to FreeSWITCH...");
    connectWithRetry(connectToFreeswitch, {
      maxRetries: 10,
      retryDelays: [1000, 2000, 3000, 5000, 5000, 5000, 10000, 10000, 1000, 10000, 10000],
      name: 'FREESWITCH'
    })
      .then(function (ms) {
        mediaServer = ms;
        freeswitchConnected = true;
        console.log("[" + new Date().toISOString() + "] FREESWITCH Ready for calls");
        checkReadyState();
      })
      .catch(function (err) {
        console.error("[" + new Date().toISOString() + "] FREESWITCH Connection failed permanently: " + err.message);
        // Don't exit, keep HTTP server alive for Dashboard
      });

  } catch (error) {
    console.error("FATAL: Failed to start voice-app:", error);
    process.exit(1);
  }
}

// Start the application
start();

// Connect to drachtio events
srf.on("connect", function (err, hostport) {
  console.log("[" + new Date().toISOString() + "] DRACHTIO Connected at " + hostport);
  drachtioConnected = true;

  var localAddress = config.external_ip;
  if (hostport && hostport.length > 0) {
    var match = hostport[0].match(/\/([^:]+)/);
    if (match) localAddress = match[1];
  }
  console.log("[DRACHTIO] Local SIP address: " + localAddress);

  // Start Multi-Registration for all devices
  if (!registrar) {
    registrar = new MultiRegistrar(srf, {
      domain: config.sip.domain,
      registrar: config.sip.registrar,
      registrar_port: config.sip.registrar_port,
      password: config.sip.password,
      expiry: config.sip.expiry,
      local_address: localAddress
    });
    // registerAll takes the device configurations (ext, authId, password)
    registrar.registerAll(deviceRegistry.getAll());
  }

  checkReadyState();
});

srf.on("error", function (err) {
  console.error("[" + new Date().toISOString() + "] DRACHTIO Error: " + err.message);
  drachtioConnected = false;
});

// Connect to FreeSWITCH helper
function connectToFreeswitch() {
  const mrf = new Mrf(srf);
  return mrf.connect({
    address: config.freeswitch.host,
    port: config.freeswitch.port,
    secret: config.freeswitch.secret
  });
}

function enableOutboundCalling() {
  console.log("[" + new Date().toISOString() + "] Enabling Outbound Calling...");

  // ========== OUTBOUND CALLING ROUTES ==========
  setupOutboundRoutes({
    srf: srf,
    mediaServer: mediaServer,
    deviceRegistry: deviceRegistry,
    audioForkServer: audioForkServer,
    whisperClient: whisperClient,
    geminiBridge: geminiBridge,
    ttsService: ttsService,
    wsPort: config.ws_port,
    addCallToHistory: httpServer.addCallToHistory
  });

  httpServer.app.use("/api", outboundRouter);
  console.log("[" + new Date().toISOString() + "] OUTBOUND Calling API enabled");

  // Now finalize HTTP (add 404/Error handlers)
  httpServer.finalize();
}

// Check ready state
function checkReadyState() {
  if (drachtioConnected && freeswitchConnected && !isReady) {
    isReady = true;
    console.log("\n[" + new Date().toISOString() + "] READY Voice interface is fully connected!");
    console.log("=".repeat(64) + "\n");

    enableOutboundCalling();

    // Register SIP OPTIONS handler (heartbeats)
    srf.options(function (req, res) {
      res.send(200);
    });

    // Register SIP INVITE handler
    srf.invite(function (req, res) {
      handleInvite(req, res, {
        srf: srf,
        audioForkServer: audioForkServer,
        mediaServer: mediaServer,
        deviceRegistry: deviceRegistry,
        config: config,
        whisperClient: whisperClient,
        geminiBridge: geminiBridge,
        ttsService: ttsService,
        wsPort: config.ws_port,
        externalIp: config.external_ip,
        addCallToHistory: httpServer.addCallToHistory
      }).catch(function (err) {
        console.error("[" + new Date().toISOString() + "] CALL Error: " + err.message);
      });
    });

    console.log("[" + new Date().toISOString() + "] SIP INVITE handler registered");
    console.log("[" + new Date().toISOString() + "] Multi-extension voice interface ready!");
  }
}

// Graceful shutdown
function shutdown(signal) {
  console.log("\n[" + new Date().toISOString() + "] Received " + signal + ", shutting down...");
  if (registrar) registrar.stop();
  if (httpServer) httpServer.close();
  if (audioForkServer) audioForkServer.stop();
  if (mediaServer) mediaServer.disconnect();
  srf.disconnect();
  setTimeout(function () { process.exit(0); }, 1000);
}

process.on("SIGTERM", function () { shutdown("SIGTERM"); });
process.on("SIGINT", function () { shutdown("SIGINT"); });
