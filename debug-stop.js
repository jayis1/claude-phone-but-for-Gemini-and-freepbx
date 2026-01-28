
import fs from 'fs';
import path from 'path';
import os from 'os';

function getConfigDir() {
    return path.join(os.homedir(), '.gemini-phone');
}

const configDir = getConfigDir();
console.log('Config Dir:', configDir);

if (!fs.existsSync(configDir)) {
    console.log('Config dir does not exist!');
} else {
    const files = fs.readdirSync(configDir);
    console.log('All files:', files);

    const targetFiles = files.filter(f => f.startsWith('docker-compose') && f.endsWith('.yml'));
    console.log('Target files:', targetFiles);
}
