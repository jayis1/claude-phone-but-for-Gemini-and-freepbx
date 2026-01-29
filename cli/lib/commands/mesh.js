
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ora from 'ora';
import {
    loadConfig as getConfig
} from '../config.js';
import {
    writeDockerConfig,
    startContainers,
    stopContainers,
    checkDocker,
    getContainerStatus,
    buildContainers
} from '../docker.js';
import { startServer, stopServer, isServerRunning } from '../process-manager.js';
import { logsCommand } from './logs.js';

export async function meshCommand(cmd, options) {
    const config = await getConfig();

    // Subcommands
    if (cmd === 'start') {
        await startMesh(config);
    } else if (cmd === 'stop') {
        await stopMesh();
    } else if (cmd === 'status') {
        await meshStatus();
    } else if (cmd === 'doctor') {
        // Handled by main cli, but if it fell through here:
        console.log(chalk.yellow('Use "gemini-phone mesh doctor" directly.'));
    } else if (cmd === 'logs') {
        await logsCommand('voice-app');
    } else {
        console.log(chalk.red('Invalid mesh command. Use: start, stop, status, logs'));
    }
}

async function startApiServer(config) {
    const spinner = ora('Starting Gemini API server...').start();
    try {
        if (await isServerRunning('gemini-api-server')) {
            spinner.warn('Gemini API server already running');
        } else {
            const geminiKey = process.env.GEMINI_API_KEY || config.api?.gemini?.apiKey;
            await startServer(config.paths.geminiApiServer, config.server.geminiApiPort, 'gemini-api-server', {
                GEMINI_API_KEY: geminiKey
            });
            spinner.succeed(`Gemini API server started on port ${config.server.geminiApiPort}`);
        }
    } catch (error) {
        spinner.fail(`Failed to start API server: ${error.message}`);
    }
}

async function startMissionControl(config) {
    let mcPath = path.join(process.cwd(), 'mission-control');
    if (!fs.existsSync(mcPath)) {
        const altPath = path.join(config.paths.voiceApp, '..', 'mission-control');
        if (fs.existsSync(altPath)) mcPath = altPath;
    }

    const spinner = ora('Starting Mission Control (The One)...').start();
    try {
        if (await isServerRunning('mission-control')) {
            spinner.warn('Mission Control already running');
        } else {
            const geminiKey = process.env.GEMINI_API_KEY || config.api?.gemini?.apiKey;
            await startServer(mcPath, 3030, 'mission-control', {
                GEMINI_API_KEY: geminiKey,
                VOICE_APP_URL: `http://localhost:${config.server.httpPort || 3000}`,
                API_SERVER_URL: `http://localhost:${config.server.geminiApiPort || 3333}`,
                PAI_DIR: path.join(os.homedir(), '.gemini')
            });
            spinner.succeed('Mission Control started on port 3030');
        }
    } catch (error) {
        spinner.fail(`Failed to start Mission Control: ${error.message}`);
    }
}

async function startMesh(config) {
    console.log(chalk.bold.blue('\n🕸️  Initializing The Mesh (3-Node Cluster)\n'));

    // 1. Docker Check
    const dockerCheck = await checkDocker();
    if (!dockerCheck.running) {
        console.log(chalk.red('❌ Docker is not running. Please start Docker first.'));
        return;
    }

    // 2. Start Host Services (The One + Brain)
    console.log(chalk.yellow('🧠 initializing Host Services...'));
    await startApiServer(config);
    await startMissionControl(config);

    // 3. Network Info
    const baseSipPort = 5060;

    // 4. Generate Configs for Stacks 1, 2, 3
    console.log(chalk.yellow('\n📝 Generating Configuration...'));

    for (let stackId = 1; stackId <= 3; stackId++) {
        const name = ['Morpheus', 'Neo', 'Trinity'][stackId - 1];
        process.stdout.write(`   - Configuring Node ${stackId} (${name})... `);
        try {
            await writeDockerConfig(config, stackId);
            console.log(chalk.green('✓'));
        } catch (e) {
            console.log(chalk.red('❌'));
            console.error(e);
            process.exit(1);
        }
    }

    // 5. Build Containers (CRITICAL FIX: Ensure code updates apply)
    console.log(chalk.yellow('\n🔨 Building Containers (Ensuring Fresh Code)...'));
    for (let stackId = 1; stackId <= 3; stackId++) {
        const name = ['Morpheus', 'Neo', 'Trinity'][stackId - 1];
        process.stdout.write(`   - Building Node ${stackId} (${name})... `);
        try {
            await buildContainers(stackId);
            console.log(chalk.green('✓'));
        } catch (e) {
            console.log(chalk.red('❌'));
            console.error(e.message);
            process.exit(1);
        }
    }

    // 6. Launch Stacks
    console.log(chalk.yellow('\n🚀 Launching Containers...'));

    for (let stackId = 1; stackId <= 3; stackId++) {
        const name = ['Morpheus', 'Neo', 'Trinity'][stackId - 1];
        process.stdout.write(`   - Booting Node ${stackId} (${name})... `);
        try {
            await startContainers(stackId);
            console.log(chalk.green('✓'));
        } catch (e) {
            console.log(chalk.red('❌'));
            console.log(chalk.gray(`     (Note: ${e.message.split('\n')[0]})`));
        }
    }

    // 7. Success
    console.log(chalk.green('\n✨ The Mesh is Online!'));
    console.log(chalk.gray('--------------------------------------------------'));
    console.log(`Node 1 (Morpheus): SIP ${baseSipPort}   | HTTP 3000`);
    console.log(`Node 2 (Neo):      SIP ${baseSipPort + 10} | HTTP 3002`);
    console.log(`Node 3 (Trinity):  SIP ${baseSipPort + 20} | HTTP 3004`);
    console.log(chalk.gray('--------------------------------------------------'));
    console.log(chalk.blue('Connect "The One" (Mission Control) at port 3030 to orchestrate.'));
}

async function stopMesh() {
    console.log(chalk.bold.blue('\n🛑 Stopping The Mesh...'));

    // Stop Docker Stacks
    await stopContainers();

    // Stop Host Services
    const spinner = ora('Stopping Host Services...').start();
    await stopServer('gemini-api-server');
    await stopServer('mission-control');
    spinner.succeed('Host services stopped');

    console.log(chalk.green('✓ All nodes halted.'));
}

async function meshStatus() {
    console.log(chalk.bold.blue('\n📊 Mesh Status\n'));

    // Check Host Services
    const mcRunning = await isServerRunning('mission-control');
    const apiRunning = await isServerRunning('gemini-api-server');

    console.log(chalk.bold('Host Services (The One):'));
    console.log(`  Mission Control: ${mcRunning ? chalk.green('ONLINE (3030)') : chalk.red('OFFLINE')}`);
    console.log(`  API Server:      ${apiRunning ? chalk.green('ONLINE (3333)') : chalk.red('OFFLINE')}`);
    console.log('');

    console.log(chalk.bold('Mesh Nodes (Docker):'));
    for (let stackId = 1; stackId <= 3; stackId++) {
        const name = ['Morpheus', 'Neo', 'Trinity'][stackId - 1];
        const containers = await getContainerStatus(stackId);

        if (containers.length > 0) {
            console.log(chalk.bold(`${name} (Stack ${stackId}): `) + chalk.green('ONLINE'));
            containers.forEach(c => {
                console.log(`  └─ ${c.name}: ${c.status}`);
            });
        } else {
            console.log(chalk.bold(`${name} (Stack ${stackId}): `) + chalk.gray('OFFLINE'));
        }
        console.log('');
    }
}
