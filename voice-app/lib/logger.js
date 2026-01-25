/**
 * Simple logger module
 * Provides consistent logging format with timestamps
 */

function formatMessage(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const dataStr = Object.keys(data).length > 0 ? ' ' + JSON.stringify(data) : '';
  return `[${timestamp}] ${level.toUpperCase()} ${message}${dataStr}`;
}


// Log forwarding to Mission Control
function forwardLog(level, message, data) {
  try {
    const payload = {
      level: level.toUpperCase(),
      message: message,
      service: 'VOICE-APP',
      timestamp: new Date().toISOString(),
      data: data
    };

    // Fire and forget - don't await
    fetch('https://127.0.0.1:3030/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(err => {
      // Ignore connection errors to avoid loop if Mission Control is down
    });
  } catch (e) {
    // Fail silently
  }
}

function info(message, data) {
  console.log(formatMessage('info', message, data));
  forwardLog('info', message, data);
}

function warn(message, data) {
  console.warn(formatMessage('warn', message, data));
  forwardLog('warn', message, data);
}

function error(message, data) {
  console.error(formatMessage('error', message, data));
  forwardLog('error', message, data);
}

function debug(message, data) {
  if (process.env.DEBUG) {
    console.log(formatMessage('debug', message, data));
    // Debug logs might be too noisy for Mission Control, uncomment if needed
    // forwardLog('debug', message, data);
  }
}

module.exports = {
  info,
  warn,
  error,
  debug
};
