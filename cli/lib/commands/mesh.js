
import chalk from 'chalk';
import {
    loadConfig as getConfig
} from '../config.js';
import {
    writeDockerConfig,
    startContainers,
    stopContainers,
    checkDocker,
    getContainerStatus
} from '../docker.js';

export async function meshCommand(cmd, _options) {
    const config = await getConfig();

    // Subcommands
    if (cmd === 'start') {
        await startMesh(config);
    } else if (cmd === 'stop') {
        await stopMesh();
    } else if (cmd === 'status') {
        await meshStatus();
    } else {
        console.log(chalk.red('Invalid mesh command. Use: start, stop, status'));
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

    // 2. Network Info
    const baseSipPort = 5060;

    // 3. Generate Configs for Stacks 1, 2, 3
    console.log(chalk.yellow('📝 Generating Configuration...'));

    // We need to inject the full mesh map into each stack
    // This is handled by docker.js using generateMeshConfig helper

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

    // 4. Launch Stacks
    console.log(chalk.yellow('\n🚀 Launching Containers...'));

    for (let stackId = 1; stackId <= 3; stackId++) {
        const name = ['Morpheus', 'Neo', 'Trinity'][stackId - 1];
        process.stdout.write(`   - Booting Node ${stackId} (${name})... `);
        try {
            await startContainers(stackId);
            console.log(chalk.green('✓'));
        } catch (e) {
            console.log(chalk.red('❌'));
            // If it fails, it might be already running, try to continue
            console.log(chalk.gray(`     (Note: ${e.message.split('\n')[0]})`));
        }
    }

    // 5. Success
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
    await stopContainers(); // Stops all stacks by default logic in docker.js
    console.log(chalk.green('✓ All nodes halted.'));
}

async function meshStatus() {
    console.log(chalk.bold.blue('\n📊 Mesh Status\n'));

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
