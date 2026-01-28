import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { loadConfig, configExists, getConfigDir } from '../config.js';
import {
    writeDockerConfig,
    buildContainers,
    startContainers,
    stopContainers,
    getContainerStatus,

} from '../docker.js';
import ora from 'ora';

export async function stackCommand(args) {
    const subcommand = args[0];
    const stackId = parseInt(args[1], 10);

    if (!configExists()) {
        console.log(chalk.red('✗ Configuration not found. Run "gemini-phone setup" first.'));
        process.exit(1);
    }

    const config = await loadConfig();

    switch (subcommand) {
        case 'deploy':
            if (!stackId || isNaN(stackId)) {
                console.log(chalk.red('✗ Usage: gemini-phone stack deploy <id>'));
                process.exit(1);
            }
            await deployStack(config, stackId);
            break;

        case 'remove':
        case 'rm':
        case 'delete':
            if (!stackId || isNaN(stackId)) {
                console.log(chalk.red('✗ Usage: gemini-phone stack remove <id>'));
                process.exit(1);
            }
            await removeStack(stackId);
            break;

        case 'list':
        case 'ls':
        case 'status':
            await listStacks(config);
            break;

        default:
            console.log(chalk.red(`✗ Unknown stack command: ${subcommand}`));
            console.log('Available commands: deploy, remove, list');
            process.exit(1);
    }
}

async function deployStack(config, stackId) {
    console.log(chalk.bold.cyan(`\n🚀 Deploying Gemini Phone Stack #${stackId}\n`));

    const spinner = ora('Generating configuration...').start();
    try {
        await writeDockerConfig(config, stackId);
        spinner.succeed('Configuration generated');
    } catch (err) {
        spinner.fail(`Failed to generate config: ${err.message}`);
        process.exit(1);
    }

    spinner.start('Building containers...');
    try {
        await buildContainers(stackId);
        spinner.succeed('Containers built');
    } catch (err) {
        spinner.fail(`Build failed: ${err.message}`);
        process.exit(1);
    }

    spinner.start('Starting stack...');
    try {
        await startContainers(stackId);
        spinner.succeed('Stack started successfully');
    } catch (err) {
        spinner.fail(`Start failed: ${err.message}`);
        process.exit(1);
    }

    displayStackInfo(config, stackId);
}

async function removeStack(stackId) {
    console.log(chalk.bold.yellow(`\n🗑️  Removing Stack #${stackId}...\n`));
    const spinner = ora('Stopping containers...').start();

    try {
        await stopContainers(stackId);
        spinner.succeed('Stack stopped');
    } catch (err) {
        spinner.fail(`Failed to stop stack: ${err.message}`);
    }

    // Optional: Clean up config files?
    // For now we keep them safe.
}

async function listStacks(config) {
    console.log(chalk.bold.white('\n📋 Active Stacks\n'));

    // Scan for docker-compose-*.yml files
    const configDir = getConfigDir();
    const files = fs.readdirSync(configDir);
    const stacks = [];

    // Check Stack 1 (default)
    if (fs.existsSync(path.join(configDir, 'docker-compose.yml'))) {
        stacks.push(1);
    }

    // Check others
    files.forEach(f => {
        const match = f.match(/^docker-compose-(\d+)\.yml$/);
        if (match) {
            stacks.push(parseInt(match[1], 10));
        }
    });

    const uniqueStacks = [...new Set(stacks)].sort((a, b) => a - b);

    if (uniqueStacks.length === 0) {
        console.log(chalk.gray('No stacks found.'));
        return;
    }

    for (const id of uniqueStacks) {
        const status = await getContainerStatus(id);
        const isRunning = status.length > 0 && status.some(c => c.status.includes('Up') || c.status.includes('running'));
        const statusIcon = isRunning ? chalk.green('●') : chalk.red('○');

        console.log(`${statusIcon} Stack #${id}`);
        if (isRunning) {
            // Calculate ports using the helper (we don't export calculatePorts but it is simple math)
            // Re-using logic from docker.js
            const baseSipPort = (config.sip && config.sip.port) ? config.sip.port : 5060;
            const offset = id - 1;
            const sipPort = baseSipPort + (offset * 10);
            const voicePort = (config.server.httpPort || 3000) + (offset * 2);

            console.log(chalk.gray(`   SIP Port:   ${sipPort}`));
            console.log(chalk.gray(`   Voice App:  http://localhost:${voicePort}`));
            console.log(chalk.gray(`   Containers: ${status.length} running`));
        } else {
            console.log(chalk.gray(`   (Stopped)`));
        }
        console.log('');
    }
}

function displayStackInfo(config, stackId) {
    const offset = stackId - 1;
    const baseSipPort = (config.sip && config.sip.port) ? config.sip.port : 5060;
    const sipPort = baseSipPort + (offset * 10);
    const voicePort = (config.server.httpPort || 3000) + (offset * 2);

    console.log(chalk.green(`\n✓ Stack #${stackId} is ready!`));
    console.log(chalk.white(`  SIP Port:      ${sipPort}`));
    console.log(chalk.white(`  Voice App:     http://localhost:${voicePort}`));
    console.log(chalk.gray('\nTo manage this stack:'));
    console.log(chalk.white(`  gemini-phone stack remove ${stackId}`));
}
