import { loadConfig } from './lib/config.js';
import { FreePBXClient } from './lib/freepbx-api.js';
import voicemailService from '../voice-app/lib/voicemail-service.js';
import path from 'path';
import fs from 'fs';

async function verify() {
    console.log('🕶️  Verifying Morpheus Configuration...\n');

    try {
        const config = await loadConfig();
        console.log('✅ Config loaded.');

        // 1. Verify Identity Sync
        if (config.api.freepbx && config.api.freepbx.clientId) {
            console.log('\n📞 Testing FreePBX Identity Sync...');
            const client = new FreePBXClient({
                clientId: config.api.freepbx.clientId,
                clientSecret: config.api.freepbx.clientSecret,
                apiUrl: config.api.freepbx.apiUrl
            });

            const conn = await client.testConnection();
            if (conn.valid) {
                console.log('  ✅ FreePBX API Reachable');

                const device = config.devices.find(d => d.name === 'Morpheus') || config.devices[0];
                const name = `${device.name} (AI)`;
                const cid = `"${device.name}" <${device.extension}>`;

                console.log(`  ℹ️  Syncing Extension ${device.extension}:`);
                console.log(`      Name: ${name}`);
                console.log(`      CID:  ${cid}`);

                try {
                    const result = await client.updateExtension(device.extension, name, cid);
                    if (result.updateExtension.status) {
                        console.log('  ✅ Identity Sync Successful!');
                    } else {
                        console.error('  ❌ Identity Sync Failed:', result.updateExtension.message);
                    }
                } catch (err) {
                    console.error('  ❌ Identity Sync Error:', err.message);
                }

            } else {
                console.error('  ❌ FreePBX API Connection Failed:', conn.error);
            }
        } else {
            console.log('\n⚠️  Skipping FreePBX check (credentials missing)');
        }

        // 2. Verify Voicemail Service
        console.log('\n📧 Testing Voicemail Service...');

        // Create a mock voicemail directory for testing if it doesn't exist
        const mockDir = '/tmp/voicemail_test/default/9000/INBOX';
        if (!fs.existsSync(mockDir)) {
            fs.mkdirSync(mockDir, { recursive: true });
            fs.writeFileSync(path.join(mockDir, 'msg0001.txt'),
                'callerid="Neo" <911>\norigtime=1706648000\nduration=5');
            fs.writeFileSync(path.join(mockDir, 'msg0001.wav'), 'mock audio');
            process.env.VOICEMAIL_DIR = '/tmp/voicemail_test/default';
            console.log('  ℹ️  Created mock voicemail environment');
        }

        const messages = await voicemailService.listVoicemails('9000');
        console.log(`  Found ${messages.length} voicemails.`);

        if (messages.length > 0 && messages[0].callerId.includes('Neo')) {
            console.log('  ✅ Voicemail Listing Works');
            console.log('  ✅ Metadata Parsing Works');
        } else {
            console.error('  ❌ Voicemail Verification Failed');
        }

        // Cleanup
        if (process.env.VOICEMAIL_DIR) {
            fs.rmSync('/tmp/voicemail_test', { recursive: true, force: true });
        }

        console.log('\n✅ Verification Complete');

    } catch (error) {
        console.error('\n❌ Verification Failed:', error);
        process.exit(1);
    }
}

verify();
