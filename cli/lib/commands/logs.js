import chalk from 'chalk';
import { spawn } from 'child_process';
import axios from 'axios';
import { loadConfig, configExists, getDockerComposePath, getPidPath } from '../config.js';
import fs from 'fs';

/**
 * Logs command - Tail service logs
 * @param {string} [service] - Optional service name (voice-app or api-server)
 * @returns {Promise<void>}
 */
export async function logsCommand(service = null) {
  if (!configExists()) {
    console.log(chalk.red('\n✗ Not configured'));
    console.log(chalk.gray('  Run "gemini-phone setup" first\n'));
    process.exit(1);
  }

  const config = await loadConfig();
  const dockerComposePath = getDockerComposePath();

  // Validate service argument
  const validServices = ['voice-app', 'api-server', 'mission-control'];
  if (service && !validServices.includes(service)) {
    console.log(chalk.red(`\n✗ Invalid service: ${service}`));
    console.log(chalk.gray('  Valid services: voice-app, api-server, mission-control'));
    console.log(chalk.gray('  Or omit service to tail all logs\n'));
    process.exit(1);
  }

  // Header
  if (service) {
    console.log(chalk.bold.cyan(`\n📋 Tailing logs for ${service}...\n`));
  } else {
    console.log(chalk.bold.cyan('\n📋 Tailing all service logs...\n'));
  }

  // Handle different service options
  if (!service || service === 'voice-app') {
    // Docker container logs
    if (!fs.existsSync(dockerComposePath)) {
      console.log(chalk.yellow('⚠ Docker containers not configured'));
      console.log(chalk.gray('  Run "gemini-phone start" first\n'));
      if (service === 'voice-app') {
        process.exit(1);
      }
    } else if (!service) {
      // Both services - interleave logs
      tailBothServices(dockerComposePath, config);
      return;
    } else {
      // Just voice-app
      tailDockerLogs(dockerComposePath);
      return;
    }
  }

  if (!service || service === 'api-server') {
    // API server logs
    const pidPath = getPidPath();
    if (!fs.existsSync(pidPath)) {
      console.log(chalk.yellow('⚠ Gemini API server not running'));
      console.log(chalk.gray('  Run "gemini-phone start" first\n'));
      if (service === 'api-server') {
        process.exit(1);
      }
    } else if (service === 'api-server') {
      tailAPIServerLogs(config);
      return;
    }
  }

  if (service === 'mission-control') {
    // Mission Control is now in Docker
    if (!fs.existsSync(dockerComposePath)) {
      console.log(chalk.yellow('⚠ Docker containers not configured'));
      process.exit(1);
    }
    tailDockerServiceLogs(dockerComposePath, 'mission-control');
    return;
  }
}

/**
 * Tail Docker container logs
 * @param {string} dockerComposePath - Path to docker-compose.yml
 */
function tailDockerLogs(dockerComposePath) {
  const child = spawn('docker', [
    'compose',
    '-f',
    dockerComposePath,
    'logs',
    '-f',
    '--tail=50'
  ], {
    stdio: 'inherit'
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    child.kill('SIGTERM');
    console.log(chalk.gray('\n\nStopped tailing logs.\n'));
    process.exit(0);
  });

  child.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(chalk.red(`\n✗ Docker logs failed with exit code ${code}\n`));
      process.exit(code);
    }
  });
}

/**
 * Tail API server logs
 * @param {object} config - Configuration object
 */
function tailAPIServerLogs(config) {
  console.log(chalk.gray('Watching Gemini API server output...\n'));
}

/**
 * Tail logs for a specific Docker service
 * @param {string} dockerComposePath - Path to docker-compose.yml
 * @param {string} serviceName - Name of the service
 */
function tailDockerServiceLogs(dockerComposePath, serviceName) {
  const child = spawn('docker', [
    'compose',
    '-f',
    dockerComposePath,
    'logs',
    '-f',
    '--tail=50',
    serviceName
  ], {
    stdio: 'inherit'
  });

  process.on('SIGINT', () => {
    child.kill('SIGTERM');
    console.log(chalk.gray('\n\nStopped tailing logs.\n'));
    process.exit(0);
  });

  child.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(chalk.red(`\n✗ Docker logs failed with exit code ${code}\n`));
      process.exit(code);
    }
  });
}

/**
 * Tail both services with interleaved output
 * @param {string} dockerComposePath - Path to docker-compose.yml
 * @param {object} _config - Configuration object (unused)
 */
function tailBothServices(dockerComposePath, _config) {
  console.log(chalk.gray('Showing Docker container logs (API server logs not available)\n'));

  const child = spawn('docker', [
    'compose',
    '-f',
    dockerComposePath,
    'logs',
    '-f',
    '--tail=50'
  ], {
    stdio: 'inherit'
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    child.kill('SIGTERM');
    console.log(chalk.gray('\n\nStopped tailing logs.\n'));
    process.exit(0);
  });

  child.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(chalk.red(`\n✗ Docker logs failed with exit code ${code}\n`));
      process.exit(code);
    }
  });
}
