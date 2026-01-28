import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import axios from 'axios';
import { loadConfig, configExists, getInstallationType, getConfigDir } from '../config.js';
import { checkDocker, getContainerStatus } from '../docker.js';
import { isServerRunning, getServerPid } from '../process-manager.js';
import { validateElevenLabsKey, validateOpenAIKey } from '../validators.js';
import { isReachable, checkGeminiApiServer as checkGeminiApiHealth, isSipReachable } from '../network.js';
import { checkPort } from '../port-check.js';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



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
 * Check FreePBX API connectivity (M2M)
 * @param {object} pbxConfig - PBX config
 * @returns {Promise<{connected: boolean, error?: string}>}
 */
async function checkPbxApi(pbxConfig) {
  if (!pbxConfig || !pbxConfig.apiUrl || !pbxConfig.clientId || !pbxConfig.clientSecret) {
    return { connected: false, error: 'Configuration missing (URL, Client ID, or Secret)' };
  }

  const tokenUrl = `${pbxConfig.apiUrl}/admin/api/api/token`;

  try {
    const auth = Buffer.from(`${pbxConfig.clientId}:${pbxConfig.clientSecret}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 5000
    });

    if (response.data && response.data.access_token) {
      return { connected: true };
    } else {
      return { connected: false, error: 'Failed to retrieve access token' };
    }
  } catch (error) {
    return { connected: false, error: error.response?.data?.message || error.message };
  }
}

/**
 * Check if gemini-api-server is running (Host or Docker)
 * @param {number} port - Port to check
 * @returns {Promise<{running: boolean, pid?: number, healthy?: boolean, error?: string}>}
 */
async function checkGeminiAPIServer(port, containerName = 'gemini-api-server') {
  // First, check if running as host process
  try {
    const response = await axios.get(`http://localhost:${port}/health`, {
      timeout: 2000
    });

    // If we get a response, it's running regardless of how (host or docker)
    return {
      running: true,
      healthy: response.status === 200
    };
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return {
        running: false,
        error: `Port ${port} not reachable`
      };
    }
    // Connected but error? It's running but unhealthy
    return {
      running: true,
      healthy: false,
      error: error.message
    };
  }
}

/**
 * Check Mission Control dashboard connectivity
 * @param {number} port - Mission Control port
 * @returns {Promise<{running: boolean, error?: string}>}
 */
async function checkMissionControl(port = 3030) {
  try {
    const response = await axios.get(`http://localhost:${port}`, { timeout: 2000 });
    return { running: response.status === 200 };
  } catch (error) {
    return { running: false, error: error.message };
  }
}

/**
 * Check n8n webhook connectivity
 * @param {string} url - n8n webhook URL
 * @returns {Promise<{reachable: boolean, error?: string}>}
 */
async function checkN8nWebhook(url) {
  if (!url) return { reachable: false, error: 'URL not set' };
  try {
    // Webhooks usually return 404 on GET or 401/405, but we check for reachability
    // A timeout or connect error means unreachable.
    await axios.get(url, { timeout: 3000 });
    return { reachable: true };
  } catch (error) {
    if (error.response) {
      // If we got a response (even 404/405), the server is reachable
      return { reachable: true };
    }
    return { reachable: false, error: error.message };
  }
}

/**
 * Check n8n REST API connectivity and workflow metadata
 * @param {string} baseUrl - n8n Base URL
 * @param {string} apiKey - n8n API Key
 * @returns {Promise<{reachable: boolean, error?: string, workerStatus?: string}>}
 */
async function checkN8nApi(baseUrl, apiKey) {
  if (!baseUrl || !apiKey) return { reachable: false, error: 'API not configured' };

  try {
    // Audit the workflows to verify API key works
    const response = await axios.get(`${baseUrl}/api/v1/workflows`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      params: { limit: 1 },
      timeout: 5000
    });

    if (response.status === 200) {
      return { reachable: true };
    }
    return { reachable: false, error: `Invalid status code: ${response.status}` };
  } catch (error) {
    if (error.response && error.response.status === 401) {
      return { reachable: false, error: 'Invalid API Key (401 Unauthorized)' };
    }
    return { reachable: false, error: error.message };
  }
}

/**
 * Check storage write permissions
 * @returns {Promise<{checks: Array}>}
 */
async function checkStoragePermissions() {
  const result = [];
  const dirs = [
    { name: 'Recordings', path: './data/recordings' },
    { name: 'Mission Control Data', path: './data/mission-control' }
  ];

  for (const dir of dirs) {
    const absPath = path.resolve(getConfigDir(), dir.path.replace('./', ''));
    try {
      if (!fs.existsSync(absPath)) {
        result.push({ name: dir.name, passed: false, error: `Directory missing: ${absPath}` });
        continue;
      }
      fs.accessSync(absPath, fs.constants.W_OK);
      result.push({ name: dir.name, passed: true });
    } catch (error) {
      result.push({ name: dir.name, passed: false, error: `Not writable: ${error.message}` });
    }
  }
  return result;
}

/**
 * Check External IP configuration
 * @param {string} configIp - IP from config
 * @returns {Promise<{valid: boolean, localIps: string[], error?: string}>}
 */
async function checkNetworkConfig(configIp) {
  const interfaces = os.networkInterfaces();
  const localIps = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIps.push(iface.address);
      }
    }
  }

  if (!configIp || configIp === '127.0.0.1') {
    return { valid: false, localIps, error: 'EXTERNAL_IP is not set or is localhost' };
  }

  if (!localIps.includes(configIp)) {
    return { valid: false, localIps, error: `Configured IP (${configIp}) does not match any local interface` };
  }

  return { valid: true, localIps };
}


/**
 * Doctor command - Run health checks
 * @returns {Promise<void>}
 */
export async function doctorCommand() {
  let version = '3.3.4';
  try {
    const pkgPath = path.resolve(__dirname, '../../../package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      version = pkg.version || version;
    }
  } catch (e) { /* ignore */ }

  console.log(chalk.bold.cyan(`\n🔍 Gemini Phone Health Check v${version}\n`));

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

  // Check local Gemini API server (Host or Docker)
  const apiServerSpinner = ora('Checking Gemini API server...').start();
  const apiServerResult = await checkGeminiAPIServer(config.server.geminiApiPort);
  if (apiServerResult.running && apiServerResult.healthy) {
    apiServerSpinner.succeed(chalk.green(`Gemini API server running (Port ${config.server.geminiApiPort})`));
    passedCount++;
  } else if (apiServerResult.running && !apiServerResult.healthy) {
    apiServerSpinner.warn(chalk.yellow(`Gemini API server running but unhealthy`));
    console.log(chalk.gray(`  → ${apiServerResult.error}\n`));
    passedCount++; // Count as partial pass
  } else {
    apiServerSpinner.fail(chalk.red(`Gemini API server not running`));
    console.log(chalk.gray(`  → Run "gemini-phone start" to launch services\n`));
  }
  checks.push({ name: 'Gemini API server', passed: apiServerResult.running });




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
  // Skip reachability check if using localhost (might be SIP conflict detection)
  const isLocal = sipDomain === 'localhost' || sipDomain === '127.0.0.1';

  // Use UDP SIP OPTIONS check for accuracy
  const pbxReachable = isLocal ? true : await isSipReachable(sipDomain, sipPort);

  if (pbxReachable) {
    pbxSpinner.succeed(chalk.green(`PBX server is reachable (${sipDomain}:${sipPort})`));
    passedCount++;
  } else {
    pbxSpinner.fail(chalk.red(`PBX unreachable (${sipDomain}:${sipPort})`));
    console.log(chalk.gray('  → Check firewall, IP address, and that UDP/5060 is allowed\n'));
    // Do not increment passedCount
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

  // Check FreePBX API (if configured)
  const pbxApiSpinner = ora('Checking FreePBX M2M API...').start();
  const pbxApiResult = await checkPbxApi(config.pbx);
  if (pbxApiResult.connected) {
    pbxApiSpinner.succeed(chalk.green('FreePBX M2M API connected'));
    passedCount++;
  } else if (config.pbx?.apiUrl) {
    pbxApiSpinner.fail(chalk.red(`FreePBX M2M API failed: ${pbxApiResult.error}`));
    console.log(chalk.gray('  → Run "gemini-phone setup" to reconfigure PBX API\n'));
  } else {
    pbxApiSpinner.info(chalk.blue('FreePBX M2M API not configured (Optional)'));
  }
  checks.push({ name: 'FreePBX M2M API', passed: pbxApiResult.connected || !config.pbx?.apiUrl });

  // --- Doctor 2.0 Expansion ---

  // Check Mission Control Dashboard
  const mcPort = config.server?.missionControlPort || 3030;
  const mcSpinner = ora(`Checking Mission Control Dashboard (Port ${mcPort})...`).start();
  const mcResult = await checkMissionControl(mcPort);
  if (mcResult.running) {
    mcSpinner.succeed(chalk.green('Mission Control dashboard reachable'));
    passedCount++;
  } else {
    mcSpinner.warn(chalk.yellow(`Mission Control unreachable: ${mcResult.error || 'Port not responding'}`));
    console.log(chalk.gray(`  → Ensure 'gemini-phone start' is running\n`));
    passedCount++; // Optional part
  }
  checks.push({ name: 'Mission Control', passed: mcResult.running });

  // Check Storage Permissions
  const storageSpinner = ora('Checking storage permissions...').start();
  const storageResults = await checkStoragePermissions();
  const storageFailed = storageResults.filter(r => !r.passed);
  if (storageFailed.length === 0) {
    storageSpinner.succeed(chalk.green('Storage directories are writable'));
    passedCount++;
  } else {
    storageSpinner.fail(chalk.red('Storage permission issues detected'));
    for (const f of storageFailed) {
      console.log(chalk.gray(`  → ${f.name}: ${f.error}`));
    }
    console.log(chalk.gray(`  → Fix permissions with: sudo chown -R $USER:$USER ${getConfigDir()}/data/\n`));
  }
  checks.push({ name: 'Storage Permissions', passed: storageFailed.length === 0 });

  // Network Check (External IP)
  const networkSpinner = ora('Validating network configuration...').start();
  const extIp = process.env.EXTERNAL_IP || config.server?.externalIp || config.network?.externalIp;
  const networkResult = await checkNetworkConfig(extIp);
  if (networkResult.valid) {
    networkSpinner.succeed(chalk.green(`External IP configuration valid (${extIp})`));
    passedCount++;
  } else {
    networkSpinner.warn(chalk.yellow(`Network config issue: ${networkResult.error}`));
    console.log(chalk.gray(`  → Local IPs found: ${networkResult.localIps.join(', ')}`));
    console.log(chalk.gray('  → Ensure EXTERNAL_IP in .env matches one of these for audio to work\n'));
    passedCount++; // Warn but don't fail the whole check
  }
  checks.push({ name: 'Network Config', passed: networkResult.valid });

  // n8n Webhook Check (if configured)
  const n8nUrl = process.env.N8N_WEBHOOK_URL || config.n8n?.webhookUrl;
  const n8nApiKey = process.env.N8N_API_KEY || config.n8n?.apiKey;
  const n8nBaseUrl = process.env.N8N_BASE_URL || config.n8n?.baseUrl;

  if (n8nUrl) {
    const n8nSpinner = ora('Checking n8n logic engine...').start();
    const webhookResult = await checkN8nWebhook(n8nUrl);

    if (webhookResult.reachable) {
      if (n8nApiKey && n8nBaseUrl) {
        const apiResult = await checkN8nApi(n8nBaseUrl, n8nApiKey);
        if (apiResult.reachable) {
          n8nSpinner.succeed(chalk.green(`n8n Hybrid Logic connected (Webhook + API)`));
        } else {
          n8nSpinner.warn(chalk.yellow(`n8n Webhook OK, but API failed: ${apiResult.error}`));
        }
      } else {
        n8nSpinner.succeed(chalk.green(`n8n Logic Engine connected (${n8nUrl})`));
      }
      passedCount++;
    } else {
      n8nSpinner.warn(chalk.yellow(`n8n Logic Engine unreachable: ${webhookResult.error}`));
      console.log(chalk.gray('  → Check your N8N_WEBHOOK_URL in .env\n'));
      passedCount++;
    }
    checks.push({ name: 'n8n Logic Engine', passed: webhookResult.reachable });
  }

  return { checks, passedCount };
}
