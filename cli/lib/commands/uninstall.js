import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { getConfigDir, configExists } from '../config.js';
import { stopContainers } from '../docker.js';
import { stopServer, isServerRunning } from '../process-manager.js';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

/**
 * Get the CLI install directory path
 * @returns {string} Path to ~/.gemini-phone-cli
 */
function getCliInstallDir() {
  return path.join(os.homedir(), '.gemini-phone-cli');
}

/**
 * Find symlink location
 * @returns {Promise<string|null>} Symlink path or null if not found
 */
async function findSymlink() {
  const possiblePaths = [
    '/usr/local/bin/gemini-phone',
    path.join(os.homedir(), '.local/bin/gemini-phone')
  ];

  for (const symlinkPath of possiblePaths) {
    try {
      const stats = await fs.promises.lstat(symlinkPath);
      if (stats.isSymbolicLink()) {
        return symlinkPath;
      }
    } catch (error) {
      // Path doesn't exist, continue
    }
  }

  return null;
}

/**
 * Remove directory recursively
 * @param {string} dirPath - Directory path to remove
 * @returns {Promise<void>}
 */
async function removeDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    await fs.promises.rm(dirPath, { recursive: true, force: true });
  }
}

/**
 * Uninstall command - Complete removal of Gemini Phone
 * @returns {Promise<void>}
 */
export async function uninstallCommand() {
  console.log(chalk.bold.red('\n🗑️  Uninstall Gemini Phone\n'));

  const configDir = getConfigDir();
  const cliDir = getCliInstallDir();
  const hasConfig = configExists();
  const symlinkPath = await findSymlink();

  // Show what will be removed
  console.log(chalk.bold('The following will be removed:\n'));

  if (hasConfig || fs.existsSync(configDir)) {
    console.log(chalk.yellow('  • Configuration directory:'));
    console.log(chalk.gray(`    ${configDir}`));
    console.log(chalk.gray('    (includes config.json, backups, generated files)'));
  }

  if (fs.existsSync(cliDir)) {
    console.log(chalk.yellow('\n  • CLI installation:'));
    console.log(chalk.gray(`    ${cliDir}`));
  }

  if (symlinkPath) {
    console.log(chalk.yellow('\n  • Symlink:'));
    console.log(chalk.gray(`    ${symlinkPath}`));
  }

  console.log(chalk.yellow('\n  • Docker containers:'));
  console.log(chalk.gray('    voice-app, drachtio, freeswitch'));

  // First confirmation: Remove Gemini Phone?
  console.log(chalk.bold.red('\n⚠️  WARNING: This action cannot be undone!\n'));

  const { confirmUninstall } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmUninstall',
      message: 'Remove Gemini Phone?',
      default: false
    }
  ]);

  if (!confirmUninstall) {
    console.log(chalk.gray('\nUninstall cancelled.\n'));
    return;
  }

  // Second confirmation: Delete configuration and backups?
  if (hasConfig || fs.existsSync(configDir)) {
    const { confirmConfig } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmConfig',
        message: 'Delete configuration and backups? (This will remove API keys and all backups)',
        default: false
      }
    ]);

    if (!confirmConfig) {
      console.log(chalk.gray('\nUninstall cancelled. Configuration preserved.\n'));
      return;
    }
  }

  console.log(chalk.bold.cyan('\n🧹 Removing Gemini Phone...\n'));

  // Step 1: Stop services
  let spinner = ora('Stopping Gemini API server...').start();
  try {
    if (await isServerRunning()) {
      await stopServer();
      spinner.succeed('Gemini API server stopped');
    } else {
      spinner.info('Gemini API server not running');
    }
  } catch (error) {
    spinner.warn(`Could not stop server: ${error.message}`);
  }

  spinner = ora('Stopping Docker containers...').start();
  try {
    await stopContainers();
    spinner.succeed('Docker containers stopped');
  } catch (error) {
    spinner.warn(`Could not stop containers: ${error.message}`);
  }

  // Step 1.5: Stop Mission Control (Port 3030)
  spinner = ora('Stopping Mission Control...').start();
  try {
    // Try to find PID on port 3030
    const { stdout } = await execAsync('lsof -t -i:3030');
    if (stdout && stdout.trim()) {
      const pid = stdout.trim();
      process.kill(pid, 'SIGKILL');
      spinner.succeed('Mission Control stopped');
    } else {
      spinner.info('Mission Control not running');
    }
  } catch (error) {
    // lsof returns error code 1 if no process found, which is fine
    spinner.info('Mission Control not running or already stopped');
  }

  // Step 1.6: Stop Inference Brain (Port 4000)
  spinner = ora('Stopping Inference Brain...').start();
  try {
    const { stdout } = await execAsync('lsof -t -i:4000');
    if (stdout && stdout.trim()) {
      const pid = stdout.trim();
      process.kill(pid, 'SIGKILL');
      spinner.succeed('Inference Brain stopped');
    } else {
      spinner.info('Inference Brain not running');
    }
  } catch (error) {
    spinner.info('Inference Brain not running');
  }

  // Step 1.7: Ensure API Server is dead (Port 3333)
  try {
    const { stdout } = await execAsync('lsof -t -i:3333');
    if (stdout && stdout.trim()) {
      const pid = stdout.trim();
      process.kill(pid, 'SIGKILL');
    }
  } catch (error) {
    // Ignore
  }

  // Step 2: Remove configuration directory
  if (fs.existsSync(configDir)) {
    spinner = ora('Removing configuration directory...').start();
    try {
      await removeDirectory(configDir);
      spinner.succeed('Configuration directory removed');
    } catch (error) {
      spinner.fail(`Failed to remove config directory: ${error.message}`);
    }
  }

  // Step 3: Remove CLI installation
  if (fs.existsSync(cliDir)) {
    spinner = ora('Removing CLI installation...').start();
    try {
      await removeDirectory(cliDir);
      spinner.succeed('CLI installation removed');
    } catch (error) {
      spinner.fail(`Failed to remove CLI directory: ${error.message}`);
    }
  }

  // Step 4: Remove symlink
  if (symlinkPath) {
    spinner = ora('Removing symlink...').start();
    try {
      await fs.promises.unlink(symlinkPath);
      spinner.succeed('Symlink removed');
    } catch (error) {
      spinner.warn(`Could not remove symlink: ${error.message}`);
    }
  }

  console.log(chalk.bold.green('\n✓ Gemini Phone uninstalled\n'));
  console.log(chalk.gray('Thank you for using Gemini Phone! 👋\n'));
  console.log(chalk.gray('Note: Docker images were not removed. To clean them up, run:'));
  console.log(chalk.gray('  docker image rm drachtio/drachtio-server:latest'));
  console.log(chalk.gray('  docker image rm drachtio/drachtio-freeswitch-mrf:latest\n'));
}
