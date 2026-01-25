const si = require('systeminformation');

async function test() {
    console.log('--- CPU ---');
    console.log(JSON.stringify(await si.cpu(), null, 2));
    console.log(JSON.stringify(await si.currentLoad(), null, 2));

    console.log('--- MEMORY ---');
    console.log(JSON.stringify(await si.mem(), null, 2));

    console.log('--- GRAPHICS ---');
    console.log(JSON.stringify(await si.graphics(), null, 2));

    console.log('--- TEMP ---');
    console.log(JSON.stringify(await si.cpuTemperature(), null, 2));
}

test();
