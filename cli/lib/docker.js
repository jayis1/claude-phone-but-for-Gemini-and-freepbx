import { spawn, execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  getConfigDir
} from './config.js';
import {
  stopContainer
} from './process-manager.js';
import { generateMeshConfig } from './mesh.js';

/**
 * Detect which docker compose command to use
 */
function getComposeCommand() {
  try {
    execSync('docker compose version', { stdio: 'pipe' });
    return { cmd: 'docker', args: ['compose'] };
  } catch (e) {
    try {
      execSync('docker-compose --version', { stdio: 'pipe' });
      return { cmd: 'docker-compose', args: [] };
    } catch (e2) {
      return { cmd: 'docker', args: ['compose'] };
    }
  }
}

/**
 * Generate a random secret for Docker services
 */
function generateSecret() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Check if Docker is installed and running
 */
export async function checkDocker() {
  const installed = await new Promise((resolve) => {
    const check = spawn('docker', ['--version']);
    check.on('close', (code) => resolve(code === 0));
    check.on('error', () => resolve(false));
  });

  if (!installed) {
    return {
      installed: false,
      running: false,
      error: 'Docker not found. Please install Docker from https://docs.docker.com/engine/install/'
    };
  }

  const running = await new Promise((resolve) => {
    const check = spawn('docker', ['ps', '-q'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    check.on('close', (code) => resolve(code === 0));
    check.on('error', () => resolve(false));
  });

  if (!running) {
    return {
      installed: true,
      running: false,
      error: 'Docker is installed but not running. Please start Docker Desktop.'
    };
  }

  return {
    installed: true,
    running: true
  };
}

/**
 * Generate docker-compose.yml from config
 * @param {object} config
 * @param {number} stackId - 1-based stack identifier (default 1)
 */
export function generateDockerCompose(config, stackId = 1) {
  if (!config.secrets) {
    config.secrets = {
      drachtio: 'cymru',
      freeswitch: 'cymru'
    };
  }

  // PORT CALCULATION
  const idOffset = stackId - 1;

  // SIP Ports (Default 5060 -> 5060, 5061, 5062)
  const baseSipPort = (config.sip && config.sip.port) ? config.sip.port : 5060;
  const sipPort = baseSipPort + (idOffset * 10);

  // FreeSWITCH SIP Port (Default 5080 -> 5080, 5090, 5100)
  const fsSipPort = 5080 + (idOffset * 10);

  // RTP Range (Default 30000-30100 -> 30200-30300)
  const rtpStart = 30000 + (idOffset * 200);
  const rtpEnd = rtpStart + 100;

  // Drachtio Admin Port (Default 9022 -> 9022, 9023, 9024)
  const drachtioAdminPort = 9022 + idOffset;

  const isPiMode = config.deployment && config.deployment.mode === 'pi-split';
  const drachtioImage = isPiMode ? 'drachtio/drachtio-server:0.9.4' : 'drachtio/drachtio-server:latest';
  const freeswitchImage = 'drachtio/drachtio-freeswitch-mrf:latest';
  const platformLine = isPiMode ? '\n    platform: linux/arm64' : '';

  const installationType = config.installationType || 'both';
  const services = [];

  // Voice services (drachtio, freeswitch, voice-app)
  if (installationType === 'voice-server' || installationType === 'both') {
    services.push(`  drachtio:
    image: ${drachtioImage}${platformLine}
    container_name: drachtio-${stackId}
    restart: unless-stopped
    network_mode: host
    command: >
      drachtio
      --contact "sip:*:${sipPort};transport=tcp,udp"
      --secret \${DRACHTIO_SECRET:-cymru}
      --port ${drachtioAdminPort}
      --loglevel info

  freeswitch:
    image: ${freeswitchImage}${platformLine}
    container_name: freeswitch-${stackId}
    restart: unless-stopped
    network_mode: host
    command: >
      freeswitch
      --sip-port ${fsSipPort}
      --rtp-range-start ${rtpStart}
      --rtp-range-end ${rtpEnd}
      --ext-rtp-ip \${EXTERNAL_IP:-127.0.0.1}
      --ext-sip-ip \${EXTERNAL_IP:-127.0.0.1}
      --advertise-external-ip
    volumes:
      - ${getConfigDir()}/recordings:/app/recordings
    environment:
      - EXTERNAL_IP=\${EXTERNAL_IP}
      - MESH_PEERS='${generateMeshConfig(3, baseSipPort)}'
      - HTTP_PORT=${voicePort}
  voice-app:
    build: ${config.paths.voiceApp}
    container_name: voice-app-${stackId}
    restart: unless-stopped
    network_mode: host
    env_file:
      - .env${stackId === 1 ? '' : '-' + stackId}
    volumes:
      - ${config.paths.voiceApp}/audio:/app/audio
      - ${config.paths.voiceApp}/config:/app/config
      - ${getConfigDir()}/devices${stackId === 1 ? '' : '-' + stackId}.json:/app/config/devices.json
      - ${getConfigDir()}/recordings:/app/recordings
    depends_on:
      - drachtio
      - freeswitch`);
  }

  // API & Mission Control
  // NOTE: These are now run as native host processes by the CLI (start.js)
  // We do NOT add them to Docker to avoid port conflicts (3030, 3333)
  if (installationType === 'api-server' || installationType === 'both') {
    // Intentionally empty - run on host
  }

  return `# CRITICAL: All containers must use network_mode: host
# Stack ID: ${stackId}
# SIP Port: ${sipPort}
# RTP Range: ${rtpStart}-${rtpEnd}
# Generated by gemini-phone CLI

services:
${services.join('\n\n')}
`;
}

/**
 * Generate .env file from config
 * @param {object} config
 * @param {number} stackId - Default 1
 */
export function generateEnvFile(config, stackId = 1) {
  if (!config.secrets) {
    config.secrets = {
      drachtio: generateSecret(),
      freeswitch: generateSecret()
    };
  }

  // PORT CALCULATION
  const idOffset = stackId - 1;

  const sipPort = 5060 + (idOffset * 10);
  const registrarPort = 5060; // Upstream PBX always listens on 5060 (usually)

  // Drachtio Admin
  const drachtioAdminPort = 9022 + idOffset;

  // FreeSWITCH
  const fsPort = 8021 + idOffset; // Event Socket

  // Voice App
  const httpPort = (config.server.httpPort || 3000) + (idOffset * 2);
  const wsPort = 3001 + (idOffset * 2);

  let geminiApiUrl;
  if (config.deployment && config.deployment.mode === 'pi-split' && config.deployment.pi && config.deployment.pi.macIp) {
    geminiApiUrl = `http://${config.deployment.pi.macIp}:${config.server.geminiApiPort}`;
  } else if (config.deployment && config.deployment.mode === 'voice-server' && config.deployment.apiServerIp) {
    geminiApiUrl = `http://${config.deployment.apiServerIp}:${config.server.geminiApiPort}`;
  } else {
    geminiApiUrl = `http://localhost:${config.server.geminiApiPort || 3333}`;
  }

  // --- API KEY OVERRIDES (PER STACK) ---
  const globalApi = config.api || {};
  const stackApi = (config.stacks && config.stacks[stackId] && config.stacks[stackId].api)
    ? config.stacks[stackId].api
    : {};

  const elevenLabsKey = stackApi.elevenlabs?.apiKey || globalApi.elevenlabs?.apiKey || '';
  const openAiKey = stackApi.openai?.apiKey || globalApi.openai?.apiKey || '';
  const geminiKey = stackApi.gemini?.apiKey || globalApi.gemini?.apiKey || '';
  // -------------------------------------

  // Current Device (1:1 Mapping)
  const deviceIndex = stackId - 1;
  const configDevices = config.devices || [];
  const device = configDevices[deviceIndex] || {
    // Auto-generate unique extension for stacks 2+ if not configured
    extension: (9000 + deviceIndex).toString(),
    authId: (9000 + deviceIndex).toString(),
    password: 'password', // Default, user should configure this!
    voiceId: 'default'
  };


  const lines = [
    '# ====================================',
    '# WARNING: DO NOT SHARE THIS FILE',
    '# Contains API keys and passwords',
    '# ====================================',
    `# Gemini Phone Configuration - Stack ${stackId}`,
    '# Generated by gemini-phone CLI',
    '# ====================================',
    '',
    '# Network Configuration',
    `EXTERNAL_IP=${config.server.externalIp === 'auto' ? 'auto' : config.server.externalIp}`,
    '',
    '# Drachtio Configuration',
    'DRACHTIO_HOST=127.0.0.1',
    `DRACHTIO_PORT=${drachtioAdminPort}`,
    `DRACHTIO_SECRET=${config.secrets.drachtio}`,
    `DRACHTIO_SIP_PORT=${sipPort}`,
    '',
    '# FreeSWITCH Configuration',
    'FREESWITCH_HOST=127.0.0.1',
    `FREESWITCH_PORT=${fsPort}`,
    'FREESWITCH_SECRET=JambonzR0ck$',
    '',
    '# FreePBX / SIP Configuration',
    `SIP_DOMAIN=${config.sip.domain}`,
    `SIP_REGISTRAR=${config.sip.registrar}`,
    `SIP_REGISTRAR_PORT=${registrarPort}`,
    '',
    '# Default extension (primary device)',
    `SIP_EXTENSION=${device.extension}`,
    `SIP_AUTH_ID=${device.authId || device.extension}`,
    `SIP_PASSWORD=${device.password}`,
    '',
    '# Gemini API Server',
    `GEMINI_API_URL=${geminiApiUrl}`,
    '',
    '# ElevenLabs TTS',
    `ELEVENLABS_API_KEY=${elevenLabsKey}`,
    `ELEVENLABS_VOICE_ID=${device.voiceId}`,
    '',
    '# OpenAI (Whisper STT)',
    `OPENAI_API_KEY=${openAiKey}`,
    '',
    '# Gemini API Key',
    `GEMINI_API_KEY=${geminiKey}`,
    `MISSION_CONTROL_GEMINI_KEY=${globalApi.gemini?.missionControlKey || ''}`,
    '',
    '# Application Settings',
    `HTTP_PORT=${httpPort}`,
    `WS_PORT=${wsPort}`,
    'AUDIO_DIR=/app/audio',
    `STACK_ID=${stackId}`,
    '',
    '# Outbound Call Settings',
    `DEFAULT_CALLER_ID=${config.outbound?.callerId || ''}`,
    `DIAL_PREFIX=${config.outbound?.dialPrefix || ''}`,
    `MAX_CONVERSATION_TURNS=${config.outbound?.maxTurns || 10}`,
    `OUTBOUND_RING_TIMEOUT=${config.outbound?.ringTimeout || 30}`,
    `TEST_PHONE_NUMBER=${config.outbound?.testPhoneNumber || ''}`,
    '',
    '# FreePBX API (Automation)',
    `FREEPBX_API_URL=${config.pbx?.apiUrl || ''}`,
    `FREEPBX_CLIENT_ID=${config.pbx?.clientId || ''}`,
    `FREEPBX_CLIENT_SECRET=${config.pbx?.clientSecret || ''}`,
    `FREEPBX_TRUNK_NAME=${(config.pbx?.trunkName || 'RedSpot') + (stackId > 1 ? '-' + stackId : '')}`,
    `GEMINI_APP_STACK_IP=${config.pbx?.appStackIp || ''}`,
    '',
    '# n8n Integration (Single Server, Multi-Webhook)',
    // Logic: Webhook URL is per-stack (different workflows), but API Key/Base URL are usually global (same server)
    `N8N_WEBHOOK_URL=${stackApi.n8n?.webhookUrl || globalApi.n8n?.webhookUrl || ''}`,
    `N8N_API_KEY=${stackApi.n8n?.apiKey || globalApi.n8n?.apiKey || ''}`,
    `N8N_BASE_URL=${stackApi.n8n?.baseUrl || globalApi.n8n?.baseUrl || ''}`,
    ''
  ];

  return lines.join('\n');
}

/**
 * Write Docker configuration files
 * @param {object} config
 * @param {number} stackId - Default 1
 */
export async function writeDockerConfig(config, stackId = 1) {
  const configDir = getConfigDir();
  const suffix = stackId === 1 ? '' : `-${stackId}`;

  const dockerComposePath = path.join(configDir, `docker-compose${suffix}.yml`);
  const envPath = path.join(configDir, `.env${suffix}`);

  const dockerComposeContent = generateDockerCompose(config, stackId);
  const envContent = generateEnvFile(config, stackId);
  const deviceConfigContent = generateDeviceConfig(config, stackId);
  const fsConfigContent = generateFreeSwitchConfig(stackId);

  const fsConfigPath = path.join(configDir, `event_socket${suffix}.conf.xml`);

  await fs.promises.writeFile(dockerComposePath, dockerComposeContent, { mode: 0o644 });
  await fs.promises.writeFile(envPath, envContent, { mode: 0o600 });
  await fs.promises.writeFile(fsConfigPath, fsConfigContent, { mode: 0o644 });

  // Write devices.json for voice-app
  const devicesPath = path.join(configDir, `devices${suffix}.json`);
  await fs.promises.writeFile(devicesPath, deviceConfigContent, { mode: 0o644 });
}

/**
 * Generate devices.json content from CLI config
 * @param {object} config 
 * @param {number} stackId - 1-based stack ID
 */
/**
 * Generate FreeSWITCH event_socket.conf.xml
 * @param {number} stackId 
 */
export function generateFreeSwitchConfig(stackId = 1) {
  const idOffset = stackId - 1;
  const fsPort = 8021 + idOffset;

  return `<configuration name="event_socket.conf" description="Socket Client">
  <settings>
    <param name="nat-map" value="false"/>
    <param name="listen-ip" value="0.0.0.0"/>
    <param name="listen-port" value="${fsPort}"/>
    <param name="password" value="ClueCon"/>
    <param name="apply-inbound-acl" value="lan"/>
  </settings>
</configuration>`;
}

export function generateDeviceConfig(config, stackId = 1) {
  const devices = {};

  if (config.devices && Array.isArray(config.devices)) {
    // Strategy: Map Stack N to Device N (0-indexed array)
    // Stack 1 -> Device 0
    // Stack 2 -> Device 1
    const deviceIndex = stackId - 1;
    const device = config.devices[deviceIndex];

    if (device && device.extension) {
      devices[device.extension] = {
        name: device.name || 'Gemini',
        extension: device.extension,
        authId: device.authId || device.extension,
        password: device.password || '',
        voiceId: device.voiceId || config.api.elevenlabs.defaultVoiceId,
        prompt: device.prompt || 'You are a helpful AI assistant.'
      };
    }
  }

  return JSON.stringify(devices, null, 2);
}

/**
 * Build Docker containers
 * @param {number} stackId - Default 1
 */
export async function buildContainers(stackId = 1) {
  const configDir = getConfigDir();
  const suffix = stackId === 1 ? '' : `-${stackId}`;
  const dockerComposePath = path.join(configDir, `docker-compose${suffix}.yml`);
  const projectName = `gemini-phone-${stackId}`;

  if (!fs.existsSync(dockerComposePath)) {
    throw new Error(`Docker configuration not found for stack ${stackId}. Run "gemini-phone stack deploy ${stackId}" first.`);
  }

  const compose = getComposeCommand();
  const composeArgs = [...compose.args, '-p', projectName, '-f', dockerComposePath, 'build'];

  return new Promise((resolve, reject) => {
    const child = spawn(compose.cmd, composeArgs, {
      cwd: configDir,
      stdio: 'pipe',
      env: { ...process.env, DOCKER_BUILDKIT: '0', COMPOSE_DOCKER_CLI_BUILD: '0' }
    });

    let output = '';
    child.stdout.on('data', (data) => { output += data.toString(); });
    child.stderr.on('data', (data) => { output += data.toString(); });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Docker build failed (exit ${code}):\n${output}`));
    });
  });
}

/**
 * Start Docker containers
 * @param {number} stackId - Default 1
 */
export async function startContainers(stackId = 1) {
  const configDir = getConfigDir();
  const suffix = stackId === 1 ? '' : `-${stackId}`;
  const dockerComposePath = path.join(configDir, `docker-compose${suffix}.yml`);
  const projectName = `gemini-phone-${stackId}`;

  if (!fs.existsSync(dockerComposePath)) {
    throw new Error(`Docker configuration not found for stack ${stackId}. Run "gemini-phone stack deploy ${stackId}" first.`);
  }

  const compose = getComposeCommand();
  const composeArgs = [...compose.args, '-p', projectName, '-f', dockerComposePath, 'up', '-d', '--remove-orphans'];

  return new Promise((resolve, reject) => {
    const child = spawn(compose.cmd, composeArgs, {
      cwd: configDir,
      stdio: 'pipe'
    });

    let output = '';
    child.stdout.on('data', (data) => { output += data.toString(); });
    child.stderr.on('data', (data) => { output += data.toString(); });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Docker compose failed (exit ${code}): ${output}`));
    });
  });
}

/**
 * Stop Docker containers
 * @param {number} [targetStackId] - Optional: Stop only this stack ID
 */
export async function stopContainers(targetStackId) {
  const configDir = getConfigDir();
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  // Find all docker-compose files
  const files = fs.readdirSync(configDir)
    .filter(f => f.startsWith('docker-compose') && f.endsWith('.yml'));

  if (files.length === 0) {
    console.log('No Docker stacks found active.');
    return;
  }

  // Iterate and stop
  for (const file of files) {
    const stackIdMatch = file.match(/docker-compose-(\d+)\.yml/);
    const stackId = stackIdMatch ? parseInt(stackIdMatch[1], 10) : 1;

    // If targeting a specific stack, skip others
    if (targetStackId && stackId !== targetStackId) {
      continue;
    }

    const projectName = `gemini-phone-${stackId}`;
    const stackSuffix = stackIdMatch ? ` (Stack ${stackIdMatch[1]})` : ' (Main Stack)';

    console.log(`Stopping containers${stackSuffix}...`);

    const filePath = path.join(configDir, file);
    // Use down --remove-orphans to be clean
    const cmd = `docker compose -p "${projectName}" -f "${filePath}" down --remove-orphans`;

    try {
      await execAsync(cmd);
    } catch (e) {
      console.error(`Failed to stop stack ${file}: ${e.message}`);
      // Continue stopping others even if one fails
    }
  }
}

/**
 * Get status of Docker containers
 * @param {number} stackId - Default 1
 */
export async function getContainerStatus(stackId = 1) {
  const configDir = getConfigDir();
  const suffix = stackId === 1 ? '' : `-${stackId}`;
  const dockerComposePath = path.join(configDir, `docker-compose${suffix}.yml`);
  const projectName = `gemini-phone-${stackId}`;

  if (!fs.existsSync(dockerComposePath)) return [];

  const compose = getComposeCommand();
  const composeArgs = [...compose.args, '-p', projectName, '-f', dockerComposePath, 'ps', '--format', 'json'];

  return new Promise((resolve) => {
    const child = spawn(compose.cmd, composeArgs, {
      cwd: configDir,
      stdio: 'pipe'
    });

    let output = '';
    child.stdout.on('data', (data) => { output += data.toString(); });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const lines = output.trim().split('\n').filter(l => l);
          const containers = lines.map(line => {
            try {
              const data = JSON.parse(line);
              return {
                name: data.Name || data.Service,
                status: data.State || data.Status
              };
            } catch (e) { return null; }
          }).filter(c => c);
          resolve(containers);
        } catch (error) { resolve([]); }
      } else resolve([]);
    });
  });
}
