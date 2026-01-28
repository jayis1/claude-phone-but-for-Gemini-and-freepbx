import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getPidPath, getConfigDir } from './config.js';

/**
 * Get the server PID from the PID file
 * @param {string} [pidPath] - Optional PID file path (for testing)
 * @returns {number|null} PID or null if not found
 */
export function getServerPid(name = 'server') {
  const pidPath = getPidPath(name);

  if (!fs.existsSync(pidPath)) {
    return null;
  }

  try {
    const pidStr = fs.readFileSync(pidPath, 'utf8').trim();
    return parseInt(pidStr, 10);
  } catch (error) {
    return null;
  }
}

/**
 * Check if a process is running
 * @param {number} pid - Process ID
 * @returns {boolean} True if running
 */
function isProcessRunning(pid) {
  try {
    // Sending signal 0 checks if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if the server is running
 * @param {string} [pidPath] - Optional PID file path (for testing)
 * @returns {Promise<boolean>} True if running
 */
export async function isServerRunning(name = 'server') {
  const pid = getServerPid(name);

  if (!pid) {
    return false;
  }

  return isProcessRunning(pid);
}

/**
 * Start the gemini-api-server
 * @param {string} serverPath - Path to gemini-api-server directory
 * @param {number} port - Port to listen on
 * @param {string} [pidPath] - Optional PID file path (for testing)
 * @param {object} [extraEnv] - Optional extra environment variables
 * @returns {Promise<number>} Process PID
 */
export async function startServer(serverPath, port, name = 'server', extraEnv = {}) {
  const pidPath = getPidPath(name);

  // Check if already running
  if (await isServerRunning(name)) {
    const pid = getServerPid(name);
    throw new Error(`Service ${name} already running (PID: ${pid})`);
  }

  return new Promise((resolve, reject) => {
    // Spawn detached process
    const child = spawn('node', ['server.js'], {
      cwd: serverPath,
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        PORT: port,
        ...extraEnv
      }
    });

    // Don't wait for child process
    child.unref();

    // Write PID file
    try {
      fs.writeFileSync(pidPath, child.pid.toString(), { mode: 0o600 });
      resolve(child.pid);
    } catch (error) {
      // Kill the child if we can't write PID file
      try {
        process.kill(child.pid, 'SIGTERM');
      } catch (killError) {
        // Ignore kill errors
      }
      reject(new Error(`Failed to write PID file for ${name}: ${error.message}`));
    }
  });
}


/**
 * Stop the gemini-api-server
 * @param {string} [pidPath] - Optional PID file path (for testing)
 * @returns {Promise<void>}
 */
export async function stopServer(name = 'server') {
  const pidPath = getPidPath(name);
  const pid = getServerPid(name);

  if (!pid) {
    if (fs.existsSync(pidPath)) {
      fs.unlinkSync(pidPath);
    }
    // Fallback: Try to kill by name even if PID file is missing
    const processPattern = name === 'mission-control' ? 'mission-control/server.js' : 'gemini-api-server/server.js';
    await killProcessByPattern(processPattern);
    return;
  }

  if (!isProcessRunning(pid)) {
    // Process not running, remove PID file
    fs.unlinkSync(pidPath);
    return;
  }

  // Try graceful shutdown first
  try {
    process.kill(pid, 'SIGTERM');

    // Wait up to 5 seconds for graceful shutdown
    const startTime = Date.now();
    while (isProcessRunning(pid) && (Date.now() - startTime) < 5000) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Force kill if still running
    if (isProcessRunning(pid)) {
      process.kill(pid, 'SIGKILL');
      // Wait a bit more
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (error) {
    // Process might already be dead
  }

  // Remove PID file
  if (fs.existsSync(pidPath)) {
    fs.unlinkSync(pidPath);
  }
}


/**
 * Kill process by pattern (fallback if PID file missing)
 * @param {string} pattern - Regex/string to match process command line
 * @returns {Promise<void>}
 */
async function killProcessByPattern(pattern) {
  const { exec } = await import('child_process');

  return new Promise((resolve) => {
    // Try to find and kill the process
    exec(`pkill -f "${pattern}"`, (_error, _stdout, _stderr) => {
      // Ignore errors (process might not exist)
      resolve();
    });
  });
}

/**
 * Save a PID file for a named service
 * @param {string} name - Service name (e.g., 'gemini-api-server')
 * @param {number} pid - Process ID
 */
export function savePid(name, pid) {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }
  const pidFile = path.join(configDir, `${name}.pid`);
  fs.writeFileSync(pidFile, pid.toString(), { mode: 0o600 });
}

/**
 * Remove a PID file for a named service
 * @param {string} name - Service name (e.g., 'gemini-api-server')
 */
export function removePid(name) {
  const configDir = getConfigDir();
  const pidFile = path.join(configDir, `${name}.pid`);
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
}
