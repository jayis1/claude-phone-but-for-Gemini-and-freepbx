import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { loadConfig } from '../config.js';
import { FreePBXClient } from '../freepbx-api.js';

/**
 * Provision command - Sync identity to FreePBX
 * @param {object} options - Command options
 * @returns {Promise<void>}
 */
export async function provisionCommand() {
    console.log(chalk.bold.cyan('\n⚙️  FreePBX Self-Provisioning\n'));

    const config = await loadConfig();

    if (!config.api.freepbx || !config.api.freepbx.clientId) {
        console.log(chalk.red('❌ FreePBX API not configured. Run "gemini-phone setup" first.'));
        return;
    }

    // Step 1: Prompt for Route Info (DID)
    console.log(chalk.bold('📞 Route Configuration'));
    const { setupRoute, did } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'setupRoute',
            message: 'Configure an Inbound Route for Morpheus?',
            default: true
        },
        {
            type: 'input',
            name: 'did',
            message: 'DID Number (leave empty for "Any"):',
            when: (answers) => answers.setupRoute,
            default: ''
        }
    ]);

    const spinner = ora('Connecting to FreePBX...').start();

    try {
        const client = new FreePBXClient({
            clientId: config.api.freepbx.clientId,
            clientSecret: config.api.freepbx.clientSecret,
            apiUrl: config.api.freepbx.apiUrl
        });

        const pbxResult = await client.testConnection();
        if (!pbxResult.valid) {
            spinner.fail(chalk.red(`FreePBX API connection failed: ${pbxResult.error}`));
            return;
        }

        // Step 2: Sync Extension Identity
        spinner.text = 'Syncing identity for Morpheus...';

        const device = config.devices[0];
        if (!device) {
            spinner.fail(chalk.red('No devices configured.'));
            return;
        }

        const name = `${device.name} (AI)`;
        const cid = `"${device.name}" <${device.extension}>`;

        const updateResult = await client.updateExtension(
            device.extension,
            name,
            cid
        );

        if (!updateResult.updateExtension.status) {
            spinner.fail(chalk.red(`Extension Sync failed: ${updateResult.updateExtension.message}`));
            return;
        }

        // Step 3: Sync Inbound Route
        if (setupRoute) {
            spinner.text = `Configuring inbound route for DID: ${did || 'ANY'}...`;
            const routeResult = await client.addInboundRoute(
                device.extension,
                did,
                '' // CID (Any)
            );

            if (!routeResult.addInboundRoute.status) {
                spinner.warn(chalk.yellow(`Inbound Route sync failed: ${routeResult.addInboundRoute.message}`));
            }
        }

        // Step 4: Apply Config
        spinner.text = 'Applying configuration...';
        await client.applyConfig();

        spinner.succeed(chalk.green(`Successfully provisioned Morpheus to extension ${device.extension}!`));
        console.log(chalk.gray(`  Name: ${name}`));
        console.log(chalk.gray(`  CID:  ${cid}`));
        if (setupRoute) {
            console.log(chalk.gray(`  Route: ${did || 'ANY'} -> ${device.extension}`));
        }
        console.log('');

    } catch (error) {
        spinner.fail(chalk.red(`Provisioning Error: ${error.message}`));
    }
}
