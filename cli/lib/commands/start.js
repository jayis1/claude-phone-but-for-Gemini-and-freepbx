import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { loadConfig, configExists, getInstallationType } from '../config.js';
import { checkDocker, writeDockerConfig, startContainers } from '../docker.js';
import { startServer, isServerRunning, startInferenceServer } from '../process-manager.js';
import { isGeminiInstalled, sleep } from '../utils.js';
import { checkGeminiApiServer } from '../network.js';

import { runPrereqChecks } from '../prereqs.js';

/**
 * Start command - Launch all services
 * @returns {Promise<void>}
 */
export async function startCommand() {
  console.log(chalk.bold.cyan('\n🚀 Starting Gemini Phone\n'));


  // Check if configured
  if (!configExists()) {
    console.log(chalk.red('✗ Configuration not found'));
    console.log(chalk.gray('  Run "gemini-phone setup" first\n'));
    process.exit(1);
  }

  // Load config and get installation type
  const config = await loadConfig();
  const installationType = getInstallationType(config);
  const isPiMode = config.deployment?.mode === 'pi-split';

  console.log(chalk.gray(`Installation type: ${installationType}\n`));

  // Run prerequisite checks for this installation type
  const prereqResult = await runPrereqChecks({ type: installationType });
  if (!prereqResult.success) {
    console.log(chalk.red('\n❌ Prerequisites not met. Please run "gemini-phone setup" to fix.\n'));
    process.exit(1);
  }

  if (isPiMode) {
    console.log(chalk.cyan('🥧 Pi Split-Mode detected\n'));
  }

  // Route to type-specific start function
  switch (installationType) {
    case 'api-server':
      await startApiServer(config);
      break;
    case 'voice-server':
      await startVoiceServer(config, isPiMode);
      break;
    case 'both':
    default:
      await startBoth(config, isPiMode);
      break;
  }
}

/**
 * Start API server only
 * @param {object} config - Configuration
 * @returns {Promise<void>}
 */
async function startApiServer(config) {
  // Check Gemini CLI
  if (!(await isGeminiInstalled())) {
    console.log(chalk.yellow('⚠️  Gemini CLI not found'));
    console.log(chalk.gray('  Install from: https://gemini.com/download\n'));
  }

  // Verify path exists
  if (!fs.existsSync(config.paths.geminiApiServer)) {
    console.log(chalk.red(`✗ G emini API server not found at: ${config.paths.geminiApiServer}`));
    console.log(chalk.gray('  Update paths in configuration\n'));
    process.exit(1);
  }

  // Check if dependencies are installed
  const nodeModulesPath = path.join(config.paths.geminiApiServer, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(chalk.red('✗ Dependencies not installed in gemini-api-server'));
    console.log(chalk.yellow('\nRun the following to install dependencies:'));
    console.log(chalk.cyan(`  cd ${config.paths.geminiApiServer} && npm install\n`));
    process.exit(1);
  }

  // Start gemini-api-server
  const spinner = ora('Starting Gemini API server...').start();
  try {
    if (await isServerRunning()) {
      spinner.warn('Gemini API server already running');
    } else {
      await startServer(config.paths.geminiApiServer, config.server.geminiApiPort);
      spinner.succeed(`Gemini API server started on port ${config.server.geminiApiPort}`);
    }
  } catch (error) {
    spinner.fail(`Failed to start server: ${error.message}`);
    throw error;
  }

  // Success
  console.log(chalk.bold.green('\n✓ API server running!\n'));
  console.log(chalk.gray('Service:'));
  console.log(chalk.gray(`  • Gemini API server: http://localhost:${config.server.geminiApiPort}\n`));
  console.log(chalk.gray('Voice servers can connect to this API server.\n'));
}

/**
 * Start voice server only
 * @param {object} config - Configuration
 * @param {boolean} isPiMode - Is Pi split-mode
 * @returns {Promise<void>}
 */
async function startVoiceServer(config, isPiMode) {
  // Verify voice-app path exists
  if (!fs.existsSync(config.paths.voiceApp)) {
    console.log(chalk.red(`✗ Voice app not found at: ${config.paths.voiceApp}`));
    console.log(chalk.gray('  Update paths in configuration\n'));
    process.exit(1);
  }

  // In Pi mode or voice-server mode, check API server reachability
  const apiServerIp = isPiMode ? config.deployment.pi.macIp : config.deployment.apiServerIp;
  if (apiServerIp) {
    const apiServerUrl = `http://${apiServerIp}:${config.server.geminiApiPort}`;
    const apiSpinner = ora(`Checking API server at ${apiServerUrl}...`).start();
    const apiHealth = await checkGeminiApiServer(apiServerUrl);
    if (apiHealth.healthy) {
      apiSpinner.succeed(`API server is healthy at ${apiServerUrl}`);
    } else {
      apiSpinner.warn(`API server not responding at ${apiServerUrl}`);
      console.log(chalk.yellow('  ⚠️  Make sure "gemini-phone api-server" is running on your API server\n'));
    }
  }

  // Check Docker
  const spinner = ora('Checking Docker...').start();
  const dockerStatus = await checkDocker();

  if (!dockerStatus.installed || !dockerStatus.running) {
    spinner.fail(dockerStatus.error);
    process.exit(1);
  }
  spinner.succeed('Docker is ready');

  // Generate Docker config
  spinner.start('Generating Docker configuration...');
  try {
    await writeDockerConfig(config);

    // Also write devices.json to voice-app/config
    const devicesPath = path.join(config.paths.voiceApp, 'config', 'devices.json');
    const devicesConfig = {};
    for (const device of config.devices) {
      devicesConfig[device.extension] = device;
    }
    await fs.promises.writeFile(devicesPath, JSON.stringify(devicesConfig, null, 2), { mode: 0o644 });

    spinner.succeed('Docker configuration generated');
  } catch (error) {
    spinner.fail(`Failed to generate config: ${error.message}`);
    throw error;
  }

  // Start Docker containers
  spinner.start('Starting Docker containers...');
  try {
    await startContainers();
    spinner.succeed('Docker containers started');
  } catch (error) {
    spinner.fail(`Failed to start containers: ${error.message}`);

    if (error.message.includes('port') || error.message.includes('address already in use')) {
      console.log(chalk.yellow('\n⚠️  Port conflict detected\n'));
      console.log(chalk.gray('Possible causes:'));
      console.log(chalk.gray('  • 3CX SBC is running on the configured port'));
      console.log(chalk.gray('  • Another service is using the port'));
      console.log(chalk.gray('\nSuggested fixes:'));
      console.log(chalk.gray('  1. If 3CX SBC is on port 5060, run "gemini-phone setup" again'));
      console.log(chalk.gray('  2. Check running containers: docker ps'));
      console.log(chalk.gray('  3. Stop conflicting services: docker compose down\n'));
    }

    throw error;
  }

  // Wait a bit for containers to initialize
  spinner.start('Waiting for containers to initialize...');
  await sleep(3000);
  spinner.succeed('Containers initialized');

  // Success
  console.log(chalk.bold.green('\n✓ Voice server running!\n'));
  console.log(chalk.gray('Services:'));
  console.log(chalk.gray(`  • Docker containers: drachtio, freeswitch, voice-app`));
  if (apiServerIp) {
    console.log(chalk.gray(`  • API server: http://${apiServerIp}:${config.server.geminiApiPort}`));
  }
  console.log(chalk.gray(`  • Voice app API: http://localhost:${config.server.httpPort}\n`));
  console.log(chalk.gray('Ready to receive calls on:'));
  for (const device of config.devices) {
    console.log(chalk.gray(`  • ${device.name}: extension ${device.extension}`));
  }
  console.log();
}

/**
 * Start both API server and voice server
 * @param {object} config - Configuration
 * @param {boolean} isPiMode - Is Pi split-mode
 * @returns {Promise<void>}
 */
async function startBoth(config, isPiMode) {
  // Verify voice-app path exists
  if (!fs.existsSync(config.paths.voiceApp)) {
    console.log(chalk.red(`✗ Voice app not found at: ${config.paths.voiceApp}`));
    console.log(chalk.gray('  Update paths in configuration\n'));
    process.exit(1);
  }

  // Only check claude-api-server path in standard mode (not Pi mode)
  if (!isPiMode && !fs.existsSync(config.paths.geminiApiServer)) {
    console.log(chalk.red(`✗ Gemini API server not found at: ${config.paths.geminiApiServer}`));
    console.log(chalk.gray('  Update paths in configuration\n'));
    process.exit(1);
  }

  // Check if dependencies are installed (not in Pi mode)
  if (!isPiMode) {
    const nodeModulesPath = path.join(config.paths.geminiApiServer, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.log(chalk.red('✗ Dependencies not installed in gemini-api-server'));
      console.log(chalk.yellow('\nRun the following to install dependencies:'));
      console.log(chalk.cyan(`  cd ${config.paths.geminiApiServer} && npm install\n`));
      process.exit(1);
    }
  }

  // Check Gemini CLI only if NOT running in Docker (legacy mode or API server only)
  if (!isPiMode && !(await isGeminiInstalled())) {
    console.log(chalk.yellow('⚠️  Gemini CLI not found'));
    console.log(chalk.gray('  Install from: https://gemini.com/download\n'));
  }

  // In Pi mode, verify API server is reachable
  if (isPiMode) {
    const apiServerUrl = `http://${config.deployment.pi.macIp}:${config.server.geminiApiPort}`;
    const apiSpinner = ora(`Checking API server at ${apiServerUrl}...`).start();
    const apiHealth = await checkGeminiApiServer(apiServerUrl);
    if (apiHealth.healthy) {
      apiSpinner.succeed(`API server is healthy at ${apiServerUrl}`);
    } else {
      apiSpinner.warn(`API server not responding at ${apiServerUrl}`);
      console.log(chalk.yellow('  ⚠️  Make sure "gemini-phone api-server" is running on your API server\n'));
    }
  }

  // Check Docker
  const spinner = ora('Checking Docker...').start();
  const dockerStatus = await checkDocker();

  if (!dockerStatus.installed || !dockerStatus.running) {
    spinner.fail(dockerStatus.error);
    process.exit(1);
  }
  spinner.succeed('Docker is ready');

  // Generate Docker config
  spinner.start('Generating Docker configuration...');
  try {
    await writeDockerConfig(config);

    // Also write devices.json to voice-app/config
    const devicesPath = path.join(config.paths.voiceApp, 'config', 'devices.json');
    const devicesConfig = {};
    for (const device of config.devices) {
      devicesConfig[device.extension] = device;
    }
    await fs.promises.writeFile(devicesPath, JSON.stringify(devicesConfig, null, 2), { mode: 0o644 });

    spinner.succeed('Docker configuration generated');
  } catch (error) {
    spinner.fail(`Failed to generate config: ${error.message}`);
    throw error;
  }

  // Start Docker containers
  spinner.start('Starting Docker containers...');
  try {
    await startContainers();
    spinner.succeed('Docker containers started');
  } catch (error) {
    spinner.fail(`Failed to start containers: ${error.message}`);

    // AC25: Detect drachtio port conflict
    if (error.message.includes('port') || error.message.includes('address already in use')) {
      console.log(chalk.yellow('\n⚠️  Port conflict detected\n'));
      console.log(chalk.gray('Possible causes:'));
      console.log(chalk.gray('  • 3CX SBC is running on the configured port'));
      console.log(chalk.gray('  • Another service is using the port'));
      console.log(chalk.gray('\nSuggested fixes:'));
      console.log(chalk.gray('  1. If 3CX SBC is on port 5060, run "gemini-phone setup" again'));
      console.log(chalk.gray('  2. Check running containers: docker ps'));
      console.log(chalk.gray('  3. Stop conflicting services: docker compose down\n'));
    }

    throw error;
  }

  // Wait a bit for containers to initialize
  spinner.start('Waiting for containers to initialize...');
  await sleep(3000);
  spinner.succeed('Containers initialized');

  // Start Inference Server (Brain)
  if (!isPiMode) {
    const inferencePath = path.resolve(config.paths.geminiApiServer, '../inference-server');
    if (fs.existsSync(inferencePath)) {
      spinner.start('Starting Inference Server (Brain)...');
      try {
        // Point Brain to Hands (API Server on port 3333)
        const inferencePort = config.server.inferencePort || 4000;

        // Ensure GEMINI_API_KEY is available
        if (!process.env.GEMINI_API_KEY) {
          // Try to load from env file if available
          // But since we are here, we hope it's in process.env
        }

        await startInferenceServer(inferencePath, inferencePort, `http://localhost:${config.server.geminiApiPort}`, 'inference.pid', 'server.js', {
          GEMINI_API_KEY: process.env.GEMINI_API_KEY
        });
        spinner.succeed(`Inference Server (Brain) started on port ${inferencePort}`);
      } catch (error) {
        if (error.message.includes('already running')) {
          spinner.warn('Inference Server already running');
        } else {
          spinner.fail(`Failed to start Inference Server: ${error.message}`);
          // Don't exit, just warn? or exit? Better to warn for now.
        }
      }
    }
  }

  // Start Mission Control Dashboard
  if (!isPiMode) {
    const missionControlPath = path.resolve(config.paths.geminiApiServer, '../mission-control');
    if (fs.existsSync(missionControlPath)) {
      spinner.start('Starting Mission Control Dashboard...');
      try {
        const missionControlPort = config.server.missionControlPort || 3030;
        // Dockerized Voice App usually runs on port 3000 (standard httpPort in config)
        // NOT 3434, which was the old local port
        const voiceAppPort = config.server.httpPort || 3000;
        const inferencePort = config.server.inferencePort || 4000;

        await startInferenceServer(missionControlPath, missionControlPort, null, 'mission-control.pid', 'server.js', {
          VOICE_APP_URL: `http://127.0.0.1:${voiceAppPort}`,
          INFERENCE_URL: `http://127.0.0.1:${inferencePort}`,
          API_SERVER_URL: `http://127.0.0.1:${config.server.geminiApiPort}`
        });
        spinner.succeed(`Mission Control Dashboard started on port ${missionControlPort}`);
      } catch (error) {
        if (error.message.includes('already running')) {
          spinner.warn('Mission Control already running');
        } else {
          spinner.fail(`Failed to start Mission Control: ${error.message}`);
        }
      }
    }
  }

  // Start gemini-api-server
  if (!isPiMode) {
    spinner.start('Starting Gemini API server...');
    try {
      if (await isServerRunning()) {
        spinner.warn('Gemini API server already running');
      } else {
        await startServer(config.paths.geminiApiServer, config.server.geminiApiPort);
        spinner.succeed(`Gemini API server started on port ${config.server.geminiApiPort}`);
      }
    } catch (error) {
      spinner.fail(`Failed to start server: ${error.message}`);
      throw error;
    }
  }

  // Success
  console.log(chalk.bold.green('\n✓ All services running!\n'));
  console.log(chalk.gray('Services:'));
  console.log(chalk.gray(`  • Docker containers: drachtio, freeswitch`));
  if (isPiMode) {
    console.log(chalk.gray(`  • API server: http://${config.deployment.pi.macIp}:${config.server.geminiApiPort}`));
  } else {
    const voiceAppPort = config.server.httpPort || 3000;
    const inferencePort = config.server.inferencePort || 4000;
    console.log(chalk.gray(`  • Voice App:         http://127.0.0.1:${voiceAppPort} (Voice Controls)`));
    console.log(chalk.gray(`  • Inference Brain:   http://127.0.0.1:${inferencePort} (AI Reasoning)`));
    console.log(chalk.gray(`  • API Server:        http://127.0.0.1:${config.server.geminiApiPort} (Tool Execution)`));
    console.log();
  }
}
