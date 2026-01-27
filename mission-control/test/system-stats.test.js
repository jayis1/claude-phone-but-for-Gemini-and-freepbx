const test = require('node:test');
const assert = require('node:assert');
const si = require('systeminformation');

test('systeminformation processes', async (t) => {
    console.log('Fetching processes...');
    const data = await si.processes();

    await t.test('should return a list of processes', () => {
        console.log('Process list length:', data.list.length);
        assert.ok(data.list.length > 0, 'Process list should not be empty');
    });

    await t.test('processes should have valid PID', () => {
        const firstProcess = data.list[0];
        console.log('First process item:', JSON.stringify(firstProcess, null, 2));

        // Check if PID exists and is a number
        assert.ok(firstProcess.pid !== undefined, 'PID should be defined');

        // Check specific node process
        const nodeProc = data.list.find(p => p.pid === process.pid);
        if (nodeProc) {
            console.log('This process info:', JSON.stringify(nodeProc, null, 2));
            assert.equal(nodeProc.pid, process.pid, 'Found current process with correct PID');
        }
    });
});
