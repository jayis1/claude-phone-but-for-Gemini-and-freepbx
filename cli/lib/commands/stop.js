import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, configExists, getInstallationType } from '../config.js';
import { stopContainers } from '../docker.js';
import { stopServer, isServerRunning, stopInferenceServer } from '../process-manager.js';

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
    if (await isServerRunning()) {
      await stopServer();
      spinner.succeed('Gemini API server stopped');
    } else {
      spinner.info('Gemini API server not running');
    }
  } catch (error) {
    spinner.fail(`Failed to stop server: ${error.message}`);
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
  const spinner = ora('Stopping Gemini API server...').start();
  try {
    if (await isServerRunning()) {
      await stopServer();
      spinner.succeed('Gemini API server stopped');
    } else {
      spinner.info('Gemini API server not running');
    }
  } catch (error) {
    spinner.fail(`Failed to stop server: ${error.message}`);
  }

  // Stop Docker containers
  spinner.start('Stopping Docker containers...');
  try {
    await stopContainers();
    spinner.succeed('Docker containers stopped');
  } catch (error) {
    spinner.fail(`Failed to stop containers: ${error.message}`);
  }

  // Stop Inference Server (Brain)
  const brainSpinner = ora('Stopping Inference Server...').start();
  try {
    await stopInferenceServer();
    brainSpinner.succeed('Inference Server stopped');
  } catch (error) {
    // Ignore if not running or failed
    // Ignore if not running or failed
    brainSpinner.info('Inference Server not running or already stopped');
  }

  // Stop Mission Control
  const mcSpinner = ora('Stopping Mission Control...').start();
  try {
    await stopInferenceServer('mission-control.pid');
    mcSpinner.succeed('Mission Control stopped');
  } catch (error) {
    mcSpinner.info('Mission Control not running or already stopped');
  }
}
