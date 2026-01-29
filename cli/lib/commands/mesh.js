
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ora from 'ora';
import {
    loadConfig as getConfig
} from '../config.js';
import {
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
        // Pass through to main logs command, defaulting to 'all' or specific service if provided
        // Since logsCommand expects a service arg, we might need to handle it.
        // options is actually the second arg from commander if we were using it that way, 
        // but here we are parsing manually in cli-main.
        // Let's just point them to the right command roughly or Implement simple wrapper.
        await logsCommand('voice-app');
    } else {
        console.log(chalk.red('Invalid mesh command. Use: start, stop, status, logs'));
    }
}

// ... startApiServer and startMissionControl ...

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
            // We only need to build once really if they share the same image/context, 
            // but strictly speaking they are separate compose projects. 
            // However, voice-app image is the same. Building stack 1 might be enough if image tag is shared?
            // docker.js uses "voice-app-{stackId}" as container name, but "build: path". 
            // Compose usually tags image as "folder_service". 
            // Safest to build all 3 or just ensure the image is updated. 
            // Let's build all 3 to be safe and parallel-ready.
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


    // 6. Success
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

