import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, configExists, getInstallationType } from '../config.js';
import { stopContainers } from '../docker.js';
import { stopServer, isServerRunning } from '../process-manager.js';

/**
 * Stop command - Shut down all services
 * @returns {Promise<void>}
 */
export async function stopCommand() {
  console.log(chalk.bold.cyan('\n⏹️  Stopping Gemini Phone\n'));

  // Check if configured
  if (!configExists()) {
    console.log(chalk.yellow('⚠️  Not configured. Nothing to stop.\n'));
    return;
  }

  // Load config and get installation type
  const config = await loadConfig();
  const installationType = getInstallationType(config);

  console.log(chalk.gray(`Installation type: ${installationType}\n`));

  // Route to type-specific stop function
  switch (installationType) {
    case 'api-server':
      await stopApiServer();
      break;
    case 'voice-server':
      await stopVoiceServer();
      break;
    case 'both':
    default:
      await stopBoth();
      break;
  }

  console.log(chalk.bold.green('\n✓ Services stopped\n'));
}

/**
 * Stop API server only
 * @returns {Promise<void>}
 */
async function stopApiServer() {
  const spinner = ora('Stopping Gemini API server...').start();
  try {
    if (await isServerRunning('gemini-api-server')) {
      await stopServer('gemini-api-server');
      spinner.succeed('Gemini API server stopped');
    } else {
      spinner.info('Gemini API server not running (host)');
    }
  } catch (error) {
    spinner.fail(`Failed to stop API server: ${error.message}`);
  }
}

/**
 * Stop voice server only
 * @returns {Promise<void>}
 */
async function stopVoiceServer() {
  const spinner = ora('Stopping Docker containers...').start();
  try {
    await stopContainers();
    spinner.succeed('Docker containers stopped');
  } catch (error) {
    spinner.fail(`Failed to stop containers: ${error.message}`);
  }
}

/**
 * Stop both API server and voice server
 * @returns {Promise<void>}
 */
async function stopBoth() {
  // Stop gemini-api-server
  let spinner = ora('Stopping Gemini API server...').start();
  try {
    if (await isServerRunning('gemini-api-server')) {
      await stopServer('gemini-api-server');
      spinner.succeed('Gemini API server stopped');
    } else {
      spinner.stop();
    }
  } catch (error) {
    spinner.fail(`Failed to stop API server: ${error.message}`);
  }

  // Stop Mission Control
  spinner = ora('Stopping Mission Control...').start();
  try {
    if (await isServerRunning('mission-control')) {
      await stopServer('mission-control');
      spinner.succeed('Mission Control stopped');
    } else {
      spinner.stop();
    }
  } catch (error) {
    spinner.fail(`Failed to stop Mission Control: ${error.message}`);
  }

  // Stop Docker containers
  spinner.start('Stopping Docker stack...');
  try {
    await stopContainers();
    spinner.succeed('Docker containers stopped');
  } catch (error) {
    spinner.fail(`Failed to stop Docker stack: ${error.message}`);
  }
}
