import { Command } from 'commander';
import chalk from 'chalk';
import { setupCommand } from '../lib/commands/setup.js';
import { startCommand } from '../lib/commands/start.js';
import { stopCommand } from '../lib/commands/stop.js';
import { statusCommand } from '../lib/commands/status.js';
import { doctorCommand } from '../lib/commands/doctor.js';
import { apiServerCommand } from '../lib/commands/api-server.js';
import { deviceAddCommand } from '../lib/commands/device/add.js';
import { deviceListCommand } from '../lib/commands/device/list.js';
import { deviceRemoveCommand } from '../lib/commands/device/remove.js';
import { logsCommand } from '../lib/commands/logs.js';
import { configShowCommand } from '../lib/commands/config/show.js';
import { configPathCommand } from '../lib/commands/config/path.js';
import { configResetCommand } from '../lib/commands/config/reset.js';
import { updateCommand } from '../lib/commands/update.js';
import { backupCommand } from '../lib/commands/backup.js';
import { restoreCommand } from '../lib/commands/restore.js';
import { uninstallCommand } from '../lib/commands/uninstall.js';
import { stackCommand } from '../lib/commands/stack.js';

const program = new Command();

program
  .name('gemini-phone')
  .description('Voice interface for Gemini Code via SIP - Call your AI, and your AI can call you')
  .version('1.0.0');

program
  .command('setup')
  .description('Interactive setup wizard for API keys, PBX config, and devices')
  .option('--skip-prereqs', 'Skip prerequisite checks (advanced users only)')
  .action(async (options) => {
    try {
      await setupCommand(options);
    } catch (error) {
      console.error(chalk.red(`\n✗ Setup failed: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Start all services (Docker containers + gemini-api-server)')
  .action(async () => {
    try {
      await startCommand();
    } catch (error) {
      console.error(chalk.red(`\n✗ Start failed: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop all services')
  .action(async () => {
    try {
      await stopCommand();
    } catch (error) {
      console.error(chalk.red(`\n✗ Stop failed: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('restart')
  .description('Restart all services')
  .action(async () => {
    try {
      console.log(chalk.yellow('\n🔄 Restarting Gemini Phone...\n'));
      await stopCommand();
      console.log(chalk.gray('--------------------------------------------------'));
      await startCommand();
    } catch (error) {
      console.error(chalk.red(`\n✗ Restart failed: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show status of all services')
  .action(async () => {
    try {
      await statusCommand();
    } catch (error) {
      console.error(chalk.red(`\n✗ Status check failed: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Run health checks on all dependencies and services')
  .action(async () => {
    try {
      await doctorCommand();
    } catch (error) {
      console.error(chalk.red(`\n✗ Health check failed: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('api-server')
  .description('Start Gemini API server for Pi remote connections')
  .option('-p, --port <port>', 'Port to listen on', '3333')
  .action(async (options) => {
    try {
      const port = parseInt(options.port, 10);
      if (isNaN(port) || port < 1024 || port > 65535) {
        console.error(chalk.red('\n✗ Port must be between 1024 and 65535\n'));
        process.exit(1);
      }
      await apiServerCommand({ port });
    } catch (error) {
      console.error(chalk.red(`\n✗ API server failed: ${error.message}\n`));
      process.exit(1);
    }
  });

// Device management subcommands
const device = program
  .command('device')
  .description('Manage SIP devices');

device
  .command('add')
  .description('Add a new device')
  .action(async () => {
    try {
      await deviceAddCommand();
    } catch (error) {
      console.error(chalk.red(`\n✗ Device add failed: ${error.message}\n`));
      process.exit(1);
    }
  });

device
  .command('list')
  .description('List all configured devices')
  .action(async () => {
    try {
      await deviceListCommand();
    } catch (error) {
      console.error(chalk.red(`\n✗ Device list failed: ${error.message}\n`));
      process.exit(1);
    }
  });

device
  .command('remove <name>')
  .description('Remove a device by name')
  .action(async (name) => {
    try {
      await deviceRemoveCommand(name);
    } catch (error) {
      console.error(chalk.red(`\n✗ Device remove failed: ${error.message}\n`));
      process.exit(1);
    }
  });


// Stack management subcommands
const stack = program
  .command('stack')
  .description('Manage multi-stack orchestration');

stack
  .command('deploy <id>')
  .description('Deploy or update a telephony stack')
  .action(async (id) => {
    try {
      await stackCommand(['deploy', id]);
    } catch (error) {
      console.error(chalk.red(`\n✗ Stack deploy failed: ${error.message}\n`));
      process.exit(1);
    }
  });

stack
  .command('remove <id>')
  .description('Remove a telephony stack')
  .action(async (id) => {
    try {
      await stackCommand(['remove', id]);
    } catch (error) {
      console.error(chalk.red(`\n✗ Stack remove failed: ${error.message}\n`));
      process.exit(1);
    }
  });

stack
  .command('list')
  .description('List active stacks')
  .action(async () => {
    try {
      await stackCommand(['list']);
    } catch (error) {
      console.error(chalk.red(`\n✗ Stack list failed: ${error.message}\n`));
      process.exit(1);
    }
  });

// Mesh management subcommands
import { meshCommand } from '../lib/commands/mesh.js';
const mesh = program
  .command('mesh')
  .description('Manage the 3-Node AI Mesh');

mesh
  .command('start')
  .description('Start the full 3-node mesh (Morpheus, Neo, Trinity)')
  .action(async () => {
    try {
      await meshCommand('start');
    } catch (error) {
      console.error(chalk.red(`\n✗ Mesh start failed: ${error.message}\n`));
      process.exit(1);
    }
  });

mesh
  .command('stop')
  .description('Stop the full mesh')
  .action(async () => {
    try {
      await meshCommand('stop');
    } catch (error) {
      console.error(chalk.red(`\n✗ Mesh stop failed: ${error.message}\n`));
      process.exit(1);
    }
  });

mesh
  .command('status')
  .description('Show mesh status')
  .action(async () => {
    try {
      await meshCommand('status');
    } catch (error) {
      console.error(chalk.red(`\n✗ Mesh status failed: ${error.message}\n`));
      process.exit(1);
    }
  });

mesh
  .command('doctor')
  .description('Run health checks on the Mesh')
  .action(async () => {
    try {
      await doctorCommand(); // Reuse the main doctor, which is now mesh-aware
    } catch (error) {
      console.error(chalk.red(`\n✗ Mesh doctor failed: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('logs [service]')
  .description('Tail service logs (voice-app, api-server, or all)')
  .action(async (service) => {
    try {
      await logsCommand(service);
    } catch (error) {
      console.error(chalk.red(`\n✗ Logs command failed: ${error.message}\n`));
      process.exit(1);
    }
  });

// Config management subcommands
const config = program
  .command('config')
  .description('Manage configuration');

config
  .command('show')
  .description('Display configuration with redacted secrets')
  .action(async () => {
    try {
      await configShowCommand();
    } catch (error) {
      console.error(chalk.red(`\n✗ Config show failed: ${error.message}\n`));
      process.exit(1);
    }
  });

config
  .command('path')
  .description('Show configuration file location')
  .action(async () => {
    try {
      await configPathCommand();
    } catch (error) {
      console.error(chalk.red(`\n✗ Config path failed: ${error.message}\n`));
      process.exit(1);
    }
  });

config
  .command('reset')
  .description('Reset configuration (creates backup)')
  .action(async () => {
    try {
      await configResetCommand();
    } catch (error) {
      console.error(chalk.red(`\n✗ Config reset failed: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('update')
  .description('Update Gemini Phone to latest version')
  .action(async () => {
    try {
      await updateCommand();
    } catch (error) {
      console.error(chalk.red(`\n✗ Update failed: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('backup')
  .description('Create timestamped backup of configuration')
  .action(async () => {
    try {
      await backupCommand();
    } catch (error) {
      console.error(chalk.red(`\n✗ Backup failed: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('restore')
  .description('Restore configuration from backup')
  .action(async () => {
    try {
      await restoreCommand();
    } catch (error) {
      console.error(chalk.red(`\n✗ Restore failed: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('uninstall')
  .description('Uninstall Gemini Phone completely')
  .action(async () => {
    try {
      await uninstallCommand();
    } catch (error) {
      console.error(chalk.red(`\n✗ Uninstall failed: ${error.message}\n`));
      process.exit(1);
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
