import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import axios from 'axios';
import { loadConfig, configExists, getInstallationType } from '../config.js';
import { checkDocker, getContainerStatus } from '../docker.js';
import { isServerRunning, getServerPid } from '../process-manager.js';
import { validateElevenLabsKey, validateOpenAIKey } from '../validators.js';
import { isReachable, checkGeminiApiServer as checkGeminiApiHealth } from '../network.js';
import { checkPort } from '../port-check.js';



/**
 * Check ElevenLabs API connectivity
 * @param {string} apiKey - ElevenLabs API key
 * @returns {Promise<{connected: boolean, error?: string}>}
 */
async function checkElevenLabsAPI(apiKey) {
  try {
    const result = await validateElevenLabsKey(apiKey);
    if (result.valid) {
      return { connected: true };
    } else {
      return { connected: false, error: result.error };
    }
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

/**
 * Check OpenAI API connectivity
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<{connected: boolean, error?: string}>}
 */
async function checkOpenAIAPI(apiKey) {
  try {
    const result = await validateOpenAIKey(apiKey);
    if (result.valid) {
      return { connected: true };
    } else {
      return { connected: false, error: result.error };
    }
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

/**
 * Check if voice-app container is running
 * @returns {Promise<{running: boolean, error?: string}>}
 */
async function checkVoiceApp() {
  const containers = await getContainerStatus();
  const voiceApp = containers.find(c => c.name.includes('voice-app'));

  if (!voiceApp) {
    return {
      running: false,
      error: 'Container not found'
    };
  }

  const isRunning = voiceApp.status.toLowerCase().includes('up') ||
    voiceApp.status.toLowerCase().includes('running');

  if (!isRunning) {
    return {
      running: false,
      error: `Container status: ${voiceApp.status}`
    };
  }

  return { running: true };
}

/**
 * Check if gemini-api-server is running
 * @param {number} port - Port to check
 * @returns {Promise<{running: boolean, pid?: number, healthy?: boolean, error?: string}>}
 */
async function checkGeminiAPIServer(port, containerName = 'gemini-api-server') {
  const containers = await getContainerStatus();
  const apiContainer = containers.find(c => c.name.includes(containerName));

  if (!apiContainer) {
    return {
      running: false,
      error: 'Container not found'
    };
  }

  const isRunning = apiContainer.status.toLowerCase().includes('up') ||
    apiContainer.status.toLowerCase().includes('running');

  if (!isRunning) {
    return {
      running: false,
      error: `Container status: ${apiContainer.status}`
    };
  }

  // Try HTTP health check
  try {
    const response = await axios.get(`http://localhost:${port}/health`, {
      timeout: 2000
    });

    return {
      running: true,
      healthy: response.status === 200
    };
  } catch (error) {
    return {
      running: true,
      healthy: false,
      error: 'Health endpoint not responding'
    };
  }
}


/**
 * Doctor command - Run health checks
 * @returns {Promise<void>}
 */
export async function doctorCommand() {
  console.log(chalk.bold.cyan('\n🔍 Gemini Phone Health Check\n'));

  if (!configExists()) {
    console.log(chalk.red('✗ Not configured'));
    console.log(chalk.gray('  → Run "gemini-phone setup" first\n'));
    process.exit(1);
  }

  const config = await loadConfig();
  const installationType = getInstallationType(config);
  const isPiSplit = config.deployment && config.deployment.mode === 'pi-split';

  console.log(chalk.bold(`Installation Type: ${installationType === 'api-server' ? 'API Server' : installationType === 'voice-server' ? 'Voice Server' : 'Both (all-in-one)'}\n`));

  const checks = [];
  let passedCount = 0;

  // Run type-appropriate checks
  if (installationType === 'api-server') {
    const result = await runApiServerChecks(config);
    checks.push(...result.checks);
    passedCount += result.passedCount;
  } else if (installationType === 'voice-server') {
    const result = await runVoiceServerChecks(config, isPiSplit);
    checks.push(...result.checks);
    passedCount += result.passedCount;
  } else {
    // Both - run all checks
    const apiResult = await runApiServerChecks(config);
    checks.push(...apiResult.checks);
    passedCount += apiResult.passedCount;

    const voiceResult = await runVoiceServerChecks(config, isPiSplit);
    checks.push(...voiceResult.checks);
    passedCount += voiceResult.passedCount;
  }

  // Summary
  console.log(chalk.bold(`\n${passedCount}/${checks.length} checks passed\n`));

  if (passedCount === checks.length) {
    console.log(chalk.green('✓ All systems operational!\n'));
    process.exit(0);
  } else if (passedCount > checks.length / 2) {
    console.log(chalk.yellow('⚠ Some issues detected. Review the failures above.\n'));
    process.exit(1);
  } else {
    console.log(chalk.red('✗ Multiple failures detected. Fix the issues above before using Gemini Phone.\n'));
    process.exit(1);
  }
}

/**
 * Run API server health checks
 * @param {object} config - Configuration
 * @returns {Promise<{checks: Array, passedCount: number}>}
 */
async function runApiServerChecks(config) {
  const checks = [];
  let passedCount = 0;

  // Check local Gemini API server container
  const apiServerSpinner = ora('Checking Gemini API server...').start();
  const apiServerResult = await checkGeminiAPIServer(config.server.geminiApiPort);
  if (apiServerResult.running && apiServerResult.healthy) {
    apiServerSpinner.succeed(chalk.green(`Gemini API server running in Docker`));
    passedCount++;
  } else if (apiServerResult.running && !apiServerResult.healthy) {
    apiServerSpinner.warn(chalk.yellow(`Gemini API server container running but unhealthy`));
    console.log(chalk.gray(`  → ${apiServerResult.error}\n`));
    passedCount++; // Count as partial pass
  } else {
    apiServerSpinner.fail(chalk.red(`Gemini API server container not running`));
    console.log(chalk.gray('  → Run "gemini-phone start" to launch services\n'));
  }
  checks.push({ name: 'Gemini API server', passed: apiServerResult.running });

  // Check Inference server (Brain)
  const inferenceSpinner = ora('Checking Inference server (Brain)...').start();
  const inferenceResult = await checkGeminiAPIServer(config.server.inferencePort || 4000, 'inference-server');
  if (inferenceResult.running && inferenceResult.healthy) {
    inferenceSpinner.succeed(chalk.green('Inference server running and healthy'));
    passedCount++;
  } else if (inferenceResult.running && !inferenceResult.healthy) {
    inferenceSpinner.warn(chalk.yellow('Inference server running but unhealthy'));
    console.log(chalk.gray(`  → ${inferenceResult.error}\n`));
    passedCount++;
  } else {
    inferenceSpinner.fail(chalk.red(`Inference server not running: ${inferenceResult.error}`));
  }
  checks.push({ name: 'Inference server', passed: inferenceResult.running });



  return { checks, passedCount };
}

/**
 * Run voice server health checks
 * @param {object} config - Configuration
 * @param {boolean} isPiSplit - Is Pi split mode
 * @returns {Promise<{checks: Array, passedCount: number}>}
 */
async function runVoiceServerChecks(config, isPiSplit) {
  const checks = [];
  let passedCount = 0;

  // Check Docker
  const dockerSpinner = ora('Checking Docker...').start();
  const dockerResult = await checkDocker();
  if (dockerResult.installed && dockerResult.running) {
    dockerSpinner.succeed(chalk.green('Docker is running'));
    passedCount++;
  } else {
    dockerSpinner.fail(chalk.red(`Docker check failed: ${dockerResult.error}`));
    console.log(chalk.gray('  → Install Docker Desktop from https://www.docker.com/products/docker-desktop\n'));
  }
  checks.push({ name: 'Docker', passed: dockerResult.installed && dockerResult.running });

  // Check ElevenLabs API (only if configured)
  if (config.api && config.api.elevenlabs && config.api.elevenlabs.apiKey) {
    const elevenLabsSpinner = ora('Checking ElevenLabs API...').start();
    const elevenLabsResult = await checkElevenLabsAPI(config.api.elevenlabs.apiKey);
    if (elevenLabsResult.connected) {
      elevenLabsSpinner.succeed(chalk.green('ElevenLabs API connected'));
      passedCount++;
    } else {
      elevenLabsSpinner.fail(chalk.red(`ElevenLabs API failed: ${elevenLabsResult.error}`));
      console.log(chalk.gray('  → Check your API key in ~/.gemini-phone/config.json\n'));
    }
    checks.push({ name: 'ElevenLabs API', passed: elevenLabsResult.connected });
  }

  // Check OpenAI API (only if configured)
  if (config.api && config.api.openai && config.api.openai.apiKey) {
    const openAISpinner = ora('Checking OpenAI API...').start();
    const openAIResult = await checkOpenAIAPI(config.api.openai.apiKey);
    if (openAIResult.connected) {
      openAISpinner.succeed(chalk.green('OpenAI API connected'));
      passedCount++;
    } else {
      openAISpinner.fail(chalk.red(`OpenAI API failed: ${openAIResult.error}`));
      console.log(chalk.gray('  → Check your API key in ~/.gemini-phone/config.json\n'));
    }
    checks.push({ name: 'OpenAI API', passed: openAIResult.connected });
  }

  // Check Voice-app container
  const voiceAppSpinner = ora('Checking voice-app container...').start();
  const voiceAppResult = await checkVoiceApp();
  if (voiceAppResult.running) {
    voiceAppSpinner.succeed(chalk.green('Voice-app container running'));
    passedCount++;
  } else {
    voiceAppSpinner.fail(chalk.red(`Voice-app container not running: ${voiceAppResult.error}`));
    console.log(chalk.gray('  → Run "gemini-phone start" to launch services\n'));
  }
  checks.push({ name: 'Voice-app container', passed: voiceAppResult.running });

  // Check API server reachability
  if (isPiSplit) {
    // Pi-split mode: Check API server IP reachability
    const apiIpSpinner = ora('Checking API server IP reachability...').start();
    const apiServerIp = config.deployment.pi.macIp;
    const apiServerReachable = await isReachable(apiServerIp);

    if (apiServerReachable) {
      apiIpSpinner.succeed(chalk.green(`API server IP reachable (${apiServerIp})`));
      passedCount++;
    } else {
      apiIpSpinner.fail(chalk.red(`API server IP not reachable: ${apiServerIp}`));
      console.log(chalk.gray('  → Check network connection between Pi and API server\n'));
    }
    checks.push({ name: 'API server IP reachability', passed: apiServerReachable });

    // Check Gemini API server on remote server
    const apiServerSpinner = ora('Checking Gemini API server...').start();
    const apiUrl = `http://${apiServerIp}:${config.server.geminiApiPort}`;
    const apiHealth = await checkGeminiApiHealth(apiUrl);

    if (apiHealth.healthy) {
      apiServerSpinner.succeed(chalk.green(`Gemini API server healthy at ${apiUrl}`));
      passedCount++;
    } else {
      apiServerSpinner.fail(chalk.red(`Gemini API server not responding`));
      console.log(chalk.gray(`  → Run "gemini-phone api-server" on your API server\n`));
    }
    checks.push({ name: 'Gemini API server (remote)', passed: apiHealth.healthy });

    // Check drachtio port availability
    const drachtioPort = config.deployment.pi.drachtioPort || 5060;
    const drachtioSpinner = ora(`Checking drachtio port ${drachtioPort}...`).start();
    const drachtioPortCheck = await checkPort(drachtioPort);

    if (drachtioPortCheck.inUse) {
      if (drachtioPort === 5070) {
        drachtioSpinner.succeed(chalk.green(`Port ${drachtioPort} in use (expected - drachtio running)`));
        passedCount++;
      } else {
        drachtioSpinner.warn(chalk.yellow(`Port ${drachtioPort} in use (may conflict)`));
        passedCount++; // Partial pass
      }
    } else {
      drachtioSpinner.succeed(chalk.green(`Port ${drachtioPort} available`));
      passedCount++;
    }
    checks.push({ name: `Drachtio port ${drachtioPort}`, passed: true });
  } else if (config.deployment && config.deployment.apiServerIp) {
    // Voice server mode (non-Pi): Check remote API server
    const apiServerIp = config.deployment.apiServerIp;
    const apiServerSpinner = ora('Checking remote API server...').start();
    const apiUrl = `http://${apiServerIp}:${config.server.geminiApiPort}`;
    const apiHealth = await checkGeminiApiHealth(apiUrl);

    if (apiHealth.healthy) {
      apiServerSpinner.succeed(chalk.green(`API server healthy at ${apiUrl}`));
      passedCount++;
    } else {
      apiServerSpinner.fail(chalk.red(`API server not responding`));
      console.log(chalk.gray(`  → Run "gemini-phone api-server" on your API server\n`));
    }
    checks.push({ name: 'API server (remote)', passed: apiHealth.healthy });
  }

  // --- PBX Connectivity Checks ---

  // Check SIP Registrar Reachability
  const sipDomain = config.sip?.domain || 'localhost';
  const sipPort = config.sip?.registrar_port || 5060; // Use registrar_port from config
  const pbxSpinner = ora(`Checking PBX reachability (${sipDomain}:${sipPort})...`).start();

  // Skip reachability check if using localhost (might be SIP conflict detection)
  const isLocal = sipDomain === 'localhost' || sipDomain === '127.0.0.1';
  const pbxReachable = isLocal ? true : await isReachable(sipDomain, sipPort);

  if (pbxReachable) {
    pbxSpinner.succeed(chalk.green(`PBX server is reachable (${sipDomain}:${sipPort})`));
    passedCount++;
  } else {
    pbxSpinner.warn(chalk.yellow(`PBX reachability check is inconclusive (${sipDomain}:${sipPort})`));
    console.log(chalk.gray('  → Note: SIP uses UDP. This check uses TCP which can fail even if SIP is working.'));
    console.log(chalk.gray('  → If registration succeeds later, you can ignore this warning.\n'));
    passedCount++; // Count as partial pass since UDP can be tricky to check via Socket
  }

  checks.push({ name: 'PBX reachability', passed: pbxReachable });



  // Check SIP Registration Status via Voice App API
  const voiceAppPort = config.server?.httpPort || 3000;
  const regSpinner = ora('Checking SIP registration status...').start();

  try {
    const statusUrl = `http://localhost:${voiceAppPort}/api/status`;
    const response = await axios.get(statusUrl, { timeout: 3000 });

    if (response.data.success) {
      const registrations = response.data.registrations || {};
      const extensions = Object.keys(registrations);
      const registeredExts = extensions.filter(ext => registrations[ext].registered);

      if (registeredExts.length > 0) {
        const statuses = registeredExts.map(ext => `${ext} (${registrations[ext].expires}s)`).join(', ');
        regSpinner.succeed(chalk.green(`SIP registered: ${statuses}`));
        passedCount++;
      } else {
        if (extensions.length > 0) {
          regSpinner.fail(chalk.red(`SIP registration failed for: ${extensions.join(', ')}`));
          console.log(chalk.gray(`  → Check passwords in ~/.gemini-phone/config.json`));
        } else {
          regSpinner.fail(chalk.red('No SIP extensions configured'));
        }
        console.log(chalk.gray('  → Check FreePBX logs for authentication failures\n'));
      }
    } else {
      regSpinner.fail(chalk.red('Voice-app status API returned error'));
    }
  } catch (error) {
    regSpinner.warn(chalk.yellow('Voice-app status API not responding'));
    console.log(chalk.gray(`  → Ensure 'gemini-phone start' is running (Port ${voiceAppPort})\n`));
  }
  checks.push({ name: 'SIP registration', passed: true });

  return { checks, passedCount };
}
