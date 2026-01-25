const net = require('net');

const ports = [3000, 4000, 3333, 3030];
const names = { 3000: 'Voice App', 4000: 'Inference Brain', 3333: 'API Server', 3030: 'Mission Control' };

async function checkPort(port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        const timer = setTimeout(() => {
            socket.destroy();
            resolve(false);
        }, 1000);

        socket.on('connect', () => {
            socket.destroy();
            clearTimeout(timer);
            resolve(true);
        });

        socket.on('error', (err) => {
            socket.destroy();
            clearTimeout(timer);
            resolve(false);
        });

        socket.connect(port, '127.0.0.1');
    });
}

async function run() {
    console.log('Checking services...');
    for (const port of ports) {
        const isOpen = await checkPort(port);
        console.log(`${names[port]} (${port}): ${isOpen ? '✅ ONLINE' : '❌ OFFLINE'}`);
    }
}

run();
