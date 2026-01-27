/**
 * HTTP Server for TTS Audio Delivery
 *
 * Express server that:
 * 1. Serves generated TTS audio files to FreeSWITCH
 * 2. Provides health check endpoint
 * 3. Accepts audio uploads and returns playback URLs
 * 4. Automatically cleans up old temporary files
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const debug = require('debug')('voice-app:http-server');
const crypto = require('crypto');

// Cleanup interval: every 2 minutes
const CLEANUP_INTERVAL = 120000;
// File max age: 10 minutes
// File max age: 10 minutes
const FILE_MAX_AGE = 600000;

// Log storage
const logs = [];
const MAX_LOGS = 100;

function addLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  logs.unshift({ timestamp, level, message, service: 'VOICE-APP', meta });
  if (logs.length > MAX_LOGS) logs.pop();
  process.stdout.write(`[${timestamp}] [${level}] ${message}\n`);
}

// Override console
const originalLog = console.log;
const originalError = console.error;
console.log = (msg, ...args) => { addLog('INFO', msg, args); originalLog(msg, ...args); };
console.error = (msg, ...args) => { addLog('ERROR', msg, args); originalError(msg, ...args); };

/**
 * Create HTTP Server
 *
 * @param {string} audioDir - Directory to serve audio files from
 * @param {number} port - Port to listen on (default: 3000)
 * @returns {Object} { app, server, saveAudio, getAudioUrl, close, finalize }
 */
function createHttpServer(audioDir, port = 3000) {
  const app = express();

  // Parse JSON bodies
  app.use(express.json());

  // Parse binary bodies for audio upload
  app.use('/audio', express.raw({ type: 'audio/*', limit: '10mb' }));

  // Serve static audio files
  app.use('/audio-files', express.static(audioDir, {
    setHeaders: (res, filepath) => {
      // Set appropriate content type for audio files
      if (filepath.endsWith('.wav')) {
        res.setHeader('Content-Type', 'audio/wav');
      } else if (filepath.endsWith('.mp3')) {
        res.setHeader('Content-Type', 'audio/mpeg');
      }
    }
  }));

  // Serve RECORDINGS (Persistent)
  app.use('/recordings', express.static('/app/recordings', {
    setHeaders: (res, filepath) => {
      res.setHeader('Content-Type', 'audio/wav');
    }
  }));

  // Serve STATIC audio files (beeps, hold music) - NOT subject to cleanup
  app.use('/static', express.static(path.join(__dirname, '..', 'static'), {
    setHeaders: (res, filepath) => {
      if (filepath.endsWith('.wav')) {
        res.setHeader('Content-Type', 'audio/wav');
      } else if (filepath.endsWith('.mp3')) {
        res.setHeader('Content-Type', 'audio/mpeg');
      }
    }
  }));

  // Root route - Interactive Dashboard
  app.get('/', (req, res) => {
    const voices = [
      { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
      { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
      { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli' },
      { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh' },
      { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold' },
      { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
      { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam' },
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
      { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie' },
      { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' }
    ];

    const voiceOptions = voices.map(v =>
      `<option value="${v.id}">${v.name}</option>`
    ).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gemini Voice</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            :root {
              --bg: #0f172a;
              --card: #1e293b;
              --text: #f8fafc;
              --accent: #c084fc;
              --accent-hover: #a855f7;
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
              max-width: 500px;
              width: 90%;
              text-align: center;
            }
            h1 {
              font-size: 1.8rem;
              font-weight: 700;
              background: linear-gradient(to right, #c084fc, #6366f1);
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
            .control-section {
              margin-bottom: 2rem;
              padding: 1.5rem;
              background: rgba(192, 132, 252, 0.05);
              border-radius: 12px;
              border: 1px solid rgba(192, 132, 252, 0.2);
              text-align: left;
            }
            .control-label {
              font-size: 0.75rem;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #94a3b8;
              margin-bottom: 0.5rem;
              display: block;
            }
            .voice-select, .device-select {
              width: 100%;
              background: #334155;
              color: white;
              border: 1px solid #475569;
              padding: 0.5rem;
              border-radius: 8px;
              font-size: 0.9rem;
              margin-bottom: 1rem;
            }
            .slider-container {
              margin-bottom: 1.5rem;
            }
            .slider {
              width: 100%;
              height: 8px;
              border-radius: 4px;
              background: #334155;
              outline: none;
              -webkit-appearance: none;
            }
            .slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: linear-gradient(135deg, #c084fc, #6366f1);
              cursor: pointer;
              box-shadow: 0 2px 8px rgba(192, 132, 252, 0.4);
            }
            .slider::-moz-range-thumb {
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: linear-gradient(135deg, #c084fc, #6366f1);
              cursor: pointer;
              border: none;
              box-shadow: 0 2px 8px rgba(192, 132, 252, 0.4);
            }
            .slider-value {
              display: flex;
              justify-content: space-between;
              font-size: 0.85rem;
              color: #cbd5e1;
              margin-top: 0.5rem;
            }
            .btn {
              background: linear-gradient(135deg, #c084fc, #6366f1);
              color: white;
              border: none;
              padding: 0.75rem 1.5rem;
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
              font-size: 0.9rem;
              width: 100%;
              margin-top: 0.5rem;
            }
            .btn:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(192, 132, 252, 0.4);
            }
            .btn:active {
              transform: translateY(0);
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
            .footer {
              font-size: 0.875rem;
              color: #64748b;
              border-top: 1px solid var(--border);
              padding-top: 1rem;
            }
            .result-message {
              padding: 0.75rem;
              border-radius: 8px;
              margin-top: 1rem;
              font-size: 0.85rem;
              display: none;
            }
            .result-message.success {
              background: rgba(16, 185, 129, 0.1);
              color: #10b981;
              border: 1px solid rgba(16, 185, 129, 0.2);
            }
            .result-message.error {
              background: rgba(239, 68, 68, 0.1);
              color: #ef4444;
              border: 1px solid rgba(239, 68, 68, 0.2);
            }
            .endpoints-section {
              background: rgba(192, 132, 252, 0.05);
              border: 1px solid rgba(192, 132, 252, 0.2);
              border-radius: 12px;
              padding: 1.5rem;
              margin-bottom: 2rem;
            }
            .endpoints-header {
              font-size: 0.75rem;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #94a3b8;
              margin-bottom: 1rem;
            }
            .endpoint-item {
              background: rgba(0, 0, 0, 0.2);
              padding: 0.75rem;
              border-radius: 6px;
              margin-bottom: 0.5rem;
              font-size: 0.85rem;
              font-family: monospace;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .endpoint-method {
              color: #10b981;
              font-weight: 600;
              margin-right: 0.5rem;
            }
            .endpoint-path {
              color: #c084fc;
            }
            .endpoint-desc {
              color: #94a3b8;
              font-size: 0.75rem;
              font-family: sans-serif;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🎙️ Gemini Voice</h1>
            <div class="status-badge">System Operational</div>
            
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Port</div>
                <div class="info-value">${port}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Status</div>
                <div class="info-value">Ready</div>
              </div>
            </div>

            <div class="control-section">
              <label class="control-label">Device</label>
              <select id="device-select" class="device-select">
                <option value="">Select Device...</option>
              </select>

              <label class="control-label">Voice</label>
              <select id="voice-select" class="voice-select">
                ${voiceOptions}
              </select>

              <div class="slider-container">
                <label class="control-label">Speech Speed</label>
                <input type="range" id="speed-slider" class="slider" min="0.5" max="2.0" step="0.1" value="1.0">
                <div class="slider-value">
                  <span>0.5x</span>
                  <span id="speed-value">1.0x</span>
                  <span>2.0x</span>
                </div>
              </div>

              <button class="btn" onclick="saveSettings()">Save Settings</button>
              <div id="result-message" class="result-message"></div>
            </div>

            <div class="endpoints-section">
              <div class="endpoints-header">API Endpoints</div>
              <div class="endpoint-item">
                <div>
                  <span class="endpoint-method">POST</span>
                  <span class="endpoint-path">/api/config/voice</span>
                </div>
                <div class="endpoint-desc">Update voice</div>
              </div>
              <div class="endpoint-item">
                <div>
                  <span class="endpoint-method">POST</span>
                  <span class="endpoint-path">/api/config/speed</span>
                </div>
                <div class="endpoint-desc">Update speed</div>
              </div>
              <div class="endpoint-item">
                <div>
                  <span class="endpoint-method">GET</span>
                  <span class="endpoint-path">/api/devices</span>
                </div>
                <div class="endpoint-desc">List devices</div>
              </div>
              <div class="endpoint-item">
                <div>
                  <span class="endpoint-method">GET</span>
                  <span class="endpoint-path">/api/config</span>
                </div>
                <div class="endpoint-desc">Get config</div>
              </div>
              <div class="endpoint-item">
                <div>
                  <span class="endpoint-method">GET</span>
                  <span class="endpoint-path">/health</span>
                </div>
                <div class="endpoint-desc">Health check</div>
              </div>
            </div>

            <div class="footer">
              Server Time: ${new Date().toLocaleTimeString()}
            </div>
          </div>
          <script>
            var currentDevice = '';
            var deviceConfigs = {};

            // Load devices on page load
            async function loadDevices() {
              try {
                var res = await fetch('/api/devices');
                var data = await res.json();
                var select = document.getElementById('device-select');
                
                if (data.devices && data.devices.length > 0) {
                  data.devices.forEach(function(device) {
                    var option = document.createElement('option');
                    option.value = device.extension;
                    option.textContent = device.name + ' (ext ' + device.extension + ')';
                    select.appendChild(option);
                    deviceConfigs[device.extension] = device;
                  });
                  
                  // Select first device by default
                  select.value = data.devices[0].extension;
                  loadDeviceSettings(data.devices[0].extension);
                }
              } catch (err) {
                console.error('Failed to load devices:', err);
              }
            }

            // Load settings for selected device
            function loadDeviceSettings(extension) {
              currentDevice = extension;
              var config = deviceConfigs[extension];
              if (config) {
                document.getElementById('voice-select').value = config.voiceId || '21m00Tcm4TlvDq8ikWAM';
                document.getElementById('speed-slider').value = config.speed || 1.0;
                updateSpeedValue();
              }
            }

            // Update speed value display
            function updateSpeedValue() {
              var slider = document.getElementById('speed-slider');
              document.getElementById('speed-value').textContent = slider.value + 'x';
            }

            // Save settings
            async function saveSettings() {
              var device = document.getElementById('device-select').value;
              var voice = document.getElementById('voice-select').value;
              var speed = parseFloat(document.getElementById('speed-slider').value);
              var resultDiv = document.getElementById('result-message');

              if (!device) {
                showMessage('Please select a device', 'error');
                return;
              }

              try {
                // Save voice
                await fetch('/api/config/voice', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ device: device, voiceId: voice })
                });

                // Save speed
                await fetch('/api/config/speed', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ device: device, speed: speed })
                });

                showMessage('Settings saved successfully!', 'success');
              } catch (err) {
                showMessage('Failed to save settings: ' + err.message, 'error');
              }
            }

            function showMessage(text, type) {
              var div = document.getElementById('result-message');
              div.textContent = text;
              div.className = 'result-message ' + type;
              div.style.display = 'block';
              setTimeout(function() {
                div.style.display = 'none';
              }, 3000);
            }

            // Event listeners
            document.getElementById('device-select').addEventListener('change', function(e) {
              loadDeviceSettings(e.target.value);
            });

            document.getElementById('speed-slider').addEventListener('input', updateSpeedValue);

            // Load devices on page load
            loadDevices();
          </script>
        </body>
      </html>
    `);
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      audioDir,
      port
    });
  });

  // Configuration API endpoints (will be populated by addConfigRoutes)
  let deviceRegistry = null;

  /**
   * Add configuration routes
   * Call this after device registry is available
   */
  function addConfigRoutes(registry) {
    deviceRegistry = registry;

    // Get all devices
    app.get('/api/devices', (req, res) => {
      try {
        const devices = deviceRegistry ? deviceRegistry.getAll() : [];
        res.json({ success: true, devices });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get current configuration
    app.get('/api/config', (req, res) => {
      try {
        const device = req.query.device;
        if (!device || !deviceRegistry) {
          return res.status(400).json({ success: false, error: 'Device parameter required' });
        }

        const config = deviceRegistry.get(device);
        if (!config) {
          return res.status(404).json({ success: false, error: 'Device not found' });
        }

        res.json({
          success: true,
          config: {
            voiceId: config.voiceId,
            speed: config.speed || 1.0
          }
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Update voice configuration
    app.post('/api/config/voice', (req, res) => {
      try {
        const { device, voiceId } = req.body;

        if (!device || !voiceId) {
          return res.status(400).json({ success: false, error: 'Device and voiceId required' });
        }

        if (!deviceRegistry) {
          return res.status(500).json({ success: false, error: 'Device registry not available' });
        }

        const config = deviceRegistry.get(device);
        if (!config) {
          return res.status(404).json({ success: false, error: 'Device not found' });
        }

        // Update voice ID
        config.voiceId = voiceId;
        deviceRegistry.update(device, config);

        debug(`Updated voice for device ${device} to ${voiceId}`);
        res.json({ success: true, voiceId });
      } catch (error) {
        console.error('Error updating voice:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Update speed configuration
    app.post('/api/config/speed', (req, res) => {
      try {
        const { device, speed } = req.body;

        if (!device || speed === undefined) {
          return res.status(400).json({ success: false, error: 'Device and speed required' });
        }

        if (speed < 0.5 || speed > 2.0) {
          return res.status(400).json({ success: false, error: 'Speed must be between 0.5 and 2.0' });
        }

        if (!deviceRegistry) {
          return res.status(500).json({ success: false, error: 'Device registry not available' });
        }

        const config = deviceRegistry.get(device);
        if (!config) {
          return res.status(404).json({ success: false, error: 'Device not found' });
        }

        // Update speed
        config.speed = speed;
        deviceRegistry.update(device, config);

        debug(`Updated speed for device ${device} to ${speed}x`);
        res.json({ success: true, speed });
      } catch (error) {
        console.error('Error updating speed:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    debug('Configuration routes added');
  }

  // Logs Endpoint
  app.get('/api/logs', (req, res) => {
    res.json({ success: true, logs });
  });

  // Call History Storage
  const callHistory = [];
  const MAX_HISTORY = 10;

  /**
   * Add a call to history
   * @param {Object} call - Call object
   */
  function addCallToHistory(call) {
    const entry = {
      id: call.id || crypto.randomBytes(4).toString('hex'),
      timestamp: new Date().toISOString(),
      type: call.type || 'unknown', // 'inbound' or 'outbound'
      from: call.from || 'unknown',
      to: call.to || 'unknown',
      status: call.status || 'completed',
      duration: call.duration || 0
    };

    // Check for recording
    const recordingFile = path.join('/app/recordings', `call-${entry.id}.wav`);
    fs.access(recordingFile).then(() => {
      entry.recordingUrl = `/recordings/call-${entry.id}.wav`;
      debug('Recording found for call:', entry.id);
    }).catch(() => {
      // No recording
    }).finally(() => {
      callHistory.unshift(entry);
      if (callHistory.length > MAX_HISTORY) callHistory.pop();
      debug('Added call to history:', entry);
    });
  }

  // History Endpoint
  app.get('/api/history', (req, res) => {
    res.json({ success: true, history: callHistory });
  });

  // Audio upload endpoint
  app.post("/audio", async (req, res) => {
    try {
      const audioBuffer = req.body;

      if (!audioBuffer || audioBuffer.length === 0) {
        return res.status(400).json({
          error: 'No audio data provided'
        });
      }

      // Generate unique filename
      const filename = `audio_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.wav`;
      const filepath = path.join(audioDir, filename);

      debug(`Saving audio to ${filepath} (${audioBuffer.length} bytes)`);

      // Save to disk
      await fs.writeFile(filepath, audioBuffer);

      // Generate URL
      const url = `http://localhost:${port}/audio-files/${filename}`;

      debug(`Audio saved, URL: ${url}`);

      res.json({
        success: true,
        url,
        filename,
        size: audioBuffer.length
      });

    } catch (error) {
      console.error('Error saving audio:', error);
      res.status(500).json({
        error: 'Failed to save audio',
        message: error.message
      });
    }
  });

  // NOTE: 404 and error handlers are added in finalize() AFTER additional routes

  // Start server
  const server = app.listen(port, () => {
    debug(`HTTP server listening on port ${port}`);
    debug(`Serving audio files from ${audioDir}`);
  });

  // Cleanup old files periodically
  const cleanupTimer = setInterval(async () => {
    try {
      await cleanupOldFiles(audioDir, FILE_MAX_AGE);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }, CLEANUP_INTERVAL);

  // Cleanup on server close
  const originalClose = server.close.bind(server);
  server.close = (callback) => {
    debug('Stopping HTTP server');
    clearInterval(cleanupTimer);
    originalClose(callback);
  };

  /**
   * Save audio buffer to file and return URL
   * @param {Buffer} audioBuffer - Audio data
   * @param {string} format - File format (wav, mp3)
   * @returns {Promise<string>} URL to audio file
   */
  async function saveAudio(audioBuffer, format = 'wav') {
    const filename = `audio_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${format}`;
    const filepath = path.join(audioDir, filename);

    debug(`Saving ${format} audio to ${filepath} (${audioBuffer.length} bytes)`);

    await fs.writeFile(filepath, audioBuffer);

    const url = `http://localhost:${port}/audio-files/${filename}`;
    debug(`Audio saved, URL: ${url}`);

    return url;
  }

  /**
   * Get URL for a filename in audio directory
   * @param {string} filename - Name of audio file
   * @returns {string} Full URL
   */
  function getAudioUrl(filename) {
    return `http://localhost:${port}/audio-files/${filename}`;
  }

  /**
   * Finalize the Express app by adding 404 and error handlers
   * Call this AFTER adding any additional routes
   */
  function finalize() {
    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path
      });
    });

    // Error handler
    app.use((err, req, res, next) => {
      console.error('Server error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message
      });
    });

    debug('HTTP server finalized with 404/error handlers');
  }

  return {
    app,
    server,
    saveAudio,
    getAudioUrl,
    close: () => server.close(),
    finalize,
    addConfigRoutes,
    addCallToHistory
  };
}

/**
 * Cleanup files older than maxAge
 * @param {string} directory - Directory to clean
 * @param {number} maxAge - Max age in milliseconds
 */
async function cleanupOldFiles(directory, maxAge) {
  try {
    const files = await fs.readdir(directory);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      const filepath = path.join(directory, file);

      try {
        const stats = await fs.stat(filepath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          debug(`Deleting old file: ${file} (age: ${Math.round(age / 1000)}s)`);
          await fs.unlink(filepath);
          deletedCount++;
        }
      } catch (error) {
        // Skip files that can't be accessed
        debug(`Error checking file ${file}:`, error.message);
      }
    }

    if (deletedCount > 0) {
      debug(`Cleanup complete: deleted ${deletedCount} old files`);
    }

  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

module.exports = {
  createHttpServer,
  cleanupOldFiles
};
