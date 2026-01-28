import { spawn, execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  getDockerComposePath,
  getEnvPath,
  getConfigDir
} from './config.js';

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
 */
export function generateDockerCompose(config) {
  if (!config.secrets) {
    config.secrets = {
      drachtio: 'cymru',
      freeswitch: 'cymru'
    };
  }

  const drachtioPort = (config.sip && config.sip.port) ? config.sip.port : 5060;
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
    container_name: drachtio
    restart: unless-stopped
    network_mode: host
    command: >
      drachtio
      --contact "sip:*:${drachtioPort};transport=tcp,udp"
      --secret \${DRACHTIO_SECRET:-cymru}
      --port 9022
      --loglevel info

  freeswitch:
    image: ${freeswitchImage}${platformLine}
    container_name: freeswitch
    restart: unless-stopped
    network_mode: host
    command: >
      freeswitch
      --sip-port 5080
      --rtp-range-start 30000
      --rtp-range-end 30100
      --ext-rtp-ip \${EXTERNAL_IP:-127.0.0.1}
      --ext-sip-ip \${EXTERNAL_IP:-127.0.0.1}
      --advertise-external-ip
    volumes:
      - ${getConfigDir()}/recordings:/app/recordings
    environment:
      - EXTERNAL_IP=\${EXTERNAL_IP:-127.0.0.1}

  voice-app:
    build: ${config.paths.voiceApp}
    container_name: voice-app
    restart: unless-stopped
    network_mode: host
    env_file:
      - .env
    volumes:
      - ${config.paths.voiceApp}/audio:/app/audio
      - ${config.paths.voiceApp}/config:/app/config
      - ${getConfigDir()}/recordings:/app/recordings
    depends_on:
      - drachtio
      - freeswitch`);
  }

  // API & Mission Control
  if (installationType === 'api-server' || installationType === 'both') {
    const apiPath = config.paths.geminiApiServer;

    services.push(`  gemini-api-server:
    build: ${apiPath}
    container_name: gemini-api-server
    restart: unless-stopped
    network_mode: host
    volumes:
      - /root/.gemini:/root/.gemini
    env_file:
      - .env
    environment:
      - PORT=${config.server.geminiApiPort || 3333}
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
      - PAI_DIR=/root/.gemini

  mission-control:
    build: ${path.resolve(apiPath, '../mission-control')}
    container_name: mission-control
    restart: unless-stopped
    network_mode: host
    env_file:
      - .env
    volumes:
      - \${getConfigDir()}/mission-control/data:/app/data
      - .env:/app/.env
    environment:
      - PORT=3030
      - VOICE_APP_URL=http://localhost:3000
      - API_SERVER_URL=http://localhost:3333
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
      - MISSION_CONTROL_GEMINI_KEY=\${MISSION_CONTROL_GEMINI_KEY}
      - GOOGLE_API_KEY=\${GEMINI_API_KEY}`);
  }

  return `# CRITICAL: All containers must use network_mode: host
# Docker bridge networking causes FreeSWITCH to advertise internal IPs
# in SDP, making RTP unreachable from external callers.

services:
${services.join('\n\n')}
`;
}

/**
 * Generate .env file from config
 */
export function generateEnvFile(config) {
  if (!config.secrets) {
    config.secrets = {
      drachtio: generateSecret(),
      freeswitch: generateSecret()
    };
  }

  let geminiApiUrl;
  if (config.deployment && config.deployment.mode === 'pi-split' && config.deployment.pi && config.deployment.pi.macIp) {
    geminiApiUrl = `http://${config.deployment.pi.macIp}:${config.server.geminiApiPort}`;
  } else if (config.deployment && config.deployment.mode === 'voice-server' && config.deployment.apiServerIp) {
    geminiApiUrl = `http://${config.deployment.apiServerIp}:${config.server.geminiApiPort}`;
  } else {
    geminiApiUrl = `http://localhost:${config.server.geminiApiPort || 3333}`;
  }

  const lines = [
    '# ====================================',
    '# WARNING: DO NOT SHARE THIS FILE',
    '# Contains API keys and passwords',
    '# ====================================',
    '# Gemini Phone Configuration',
    '# Generated by gemini-phone CLI',
    '# ====================================',
    '',
    '# Network Configuration',
    `EXTERNAL_IP=${config.server.externalIp === 'auto' ? 'auto' : config.server.externalIp}`,
    '',
    '# Drachtio Configuration',
    'DRACHTIO_HOST=127.0.0.1',
    'DRACHTIO_PORT=9022',
    `DRACHTIO_SECRET=${config.secrets.drachtio}`,
    `DRACHTIO_SIP_PORT=${config.sip?.port || config.deployment?.pi?.drachtioPort || 5060}`,
    '',
    '# FreeSWITCH Configuration',
    'FREESWITCH_HOST=127.0.0.1',
    'FREESWITCH_PORT=8021',
    'FREESWITCH_SECRET=JambonzR0ck$',
    '',
    '# FreePBX / SIP Configuration',
    `SIP_DOMAIN=${config.sip.domain}`,
    `SIP_REGISTRAR=${config.sip.registrar}`,
    `SIP_REGISTRAR_PORT=${config.sip.registrar_port || 5060}`,
    '',
    '# Default extension (primary device)',
    `SIP_EXTENSION=${config.devices[0].extension}`,
    `SIP_AUTH_ID=${config.devices[0].authId}`,
    `SIP_PASSWORD=${config.devices[0].password}`,
    '',
    '# Gemini API Server',
    `GEMINI_API_URL=${geminiApiUrl}`,
    '',
    '# ElevenLabs TTS',
    `ELEVENLABS_API_KEY=${config.api.elevenlabs.apiKey}`,
    `ELEVENLABS_VOICE_ID=${config.devices[0].voiceId}`,
    '',
    '# OpenAI (Whisper STT)',
    `OPENAI_API_KEY=${config.api.openai.apiKey}`,
    '',
    '# Gemini API Key',
    `GEMINI_API_KEY=${config.api.gemini?.apiKey || ''}`,
    `MISSION_CONTROL_GEMINI_KEY=${config.api.gemini?.missionControlKey || ''}`,
    '',
    '# Application Settings',
    `HTTP_PORT=${config.server.httpPort || 3000}`,
    'WS_PORT=3001',
    'AUDIO_DIR=/app/audio',
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
    `FREEPBX_TRUNK_NAME=${config.pbx?.trunkName || 'RedSpot'}`,
    `GEMINI_APP_STACK_IP=${config.pbx?.appStackIp || ''}`,
    '',
    '# n8n Integration',
    `N8N_WEBHOOK_URL=${(config.n8n && config.n8n.webhookUrl) || ''}`,
    `N8N_API_KEY=${(config.n8n && config.n8n.apiKey) || ''}`,
    `N8N_BASE_URL=${(config.n8n && config.n8n.baseUrl) || ''}`,
    ''
  ];

  return lines.join('\n');
}

/**
 * Write Docker configuration files
 */
export async function writeDockerConfig(config) {
  const dockerComposePath = getDockerComposePath();
  const envPath = getEnvPath();

  const dockerComposeContent = generateDockerCompose(config);
  const envContent = generateEnvFile(config);

  await fs.promises.writeFile(dockerComposePath, dockerComposeContent, { mode: 0o644 });
  await fs.promises.writeFile(envPath, envContent, { mode: 0o600 });
}

/**
 * Build Docker containers
 */
export async function buildContainers() {
  const configDir = getConfigDir();
  const dockerComposePath = getDockerComposePath();

  if (!fs.existsSync(dockerComposePath)) {
    throw new Error('Docker configuration not found. Run "gemini-phone setup" first.');
  }

  const compose = getComposeCommand();
  const composeArgs = [...compose.args, '-f', dockerComposePath, 'build'];

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
 */
export async function startContainers() {
  const configDir = getConfigDir();
  const dockerComposePath = getDockerComposePath();

  if (!fs.existsSync(dockerComposePath)) {
    throw new Error('Docker configuration not found. Run "gemini-phone setup" first.');
  }

  const compose = getComposeCommand();
  const composeArgs = [...compose.args, '-f', dockerComposePath, 'up', '-d', '--remove-orphans'];

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
 */
export async function stopContainers() {
  const configDir = getConfigDir();
  const dockerComposePath = getDockerComposePath();

  if (!fs.existsSync(dockerComposePath)) return;

  const compose = getComposeCommand();
  const composeArgs = [...compose.args, '-f', dockerComposePath, 'down'];

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
      else reject(new Error(`Docker compose down failed (exit ${code}): ${output}`));
    });
  });
}

/**
 * Get status of Docker containers
 */
export async function getContainerStatus() {
  const configDir = getConfigDir();
  const dockerComposePath = getDockerComposePath();

  if (!fs.existsSync(dockerComposePath)) return [];

  const compose = getComposeCommand();
  const composeArgs = [...compose.args, '-f', dockerComposePath, 'ps', '--format', 'json'];

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
