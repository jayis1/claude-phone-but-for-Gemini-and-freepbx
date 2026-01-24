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
const FILE_MAX_AGE = 600000;

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

  // Root route - Status page
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gemini Phone</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            :root {
              --bg: #0f172a;
              --card: #1e293b;
              --text: #f8fafc;
              --accent: #8b5cf6;
              --accent-hover: #7c3aed;
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
              max-width: 450px;
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
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Gemini Voice</h1>
            <div class="status-badge">System Operational</div>
            
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Port</div>
                <div class="info-value">${port}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Audio Dir</div>
                <div class="info-value">/app/audio</div>
              </div>
            </div>

            <div class="footer">
              Server Time: ${new Date().toLocaleTimeString()}
            </div>
          </div>
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
    finalize
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
