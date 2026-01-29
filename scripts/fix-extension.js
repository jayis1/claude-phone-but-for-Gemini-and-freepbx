
const fs = require('fs');
const path = require('path');
const os = require('os');

const dirs = [
    path.join(os.homedir(), '.gemini-phone'),
    '/root/.gemini-phone',
    '/home/jais/.gemini-phone'
];

let found = false;

dirs.forEach(dir => {
    const configPath = path.join(dir, 'config.json');
    if (fs.existsSync(configPath)) {
        console.log(`Found config at: ${configPath}`);
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            let modified = false;

            if (config.devices) {
                config.devices.forEach(d => {
                    if (d.extension === '8000') {
                        console.log(`Fixing device ${d.name}: 8000 -> 9000`);
                        d.extension = '9000';
                        d.sipExtension = '9000'; // Just in case
                        modified = true;
                    }
                });
            }

            // Also check top-level properties if they exist
            if (config.sip && config.sip.extension === '8000') {
                config.sip.extension = '9000';
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                console.log('✅ Config updated successfully.');
                found = true;
            } else {
                console.log('Config already correct (no 8000 found).');
                found = true;
            }
        } catch (e) {
            console.error(`Error reading/writing config: ${e.message}`);
        }
    }
});

if (!found) {
    console.log('❌ No config file found in standard locations.');
}
