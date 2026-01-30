const dns = require('dns');
const https = require('https');
const fs = require('fs');

const OPENAI_HOST = 'api.openai.com';

console.log('--- Network Debug Script ---');
console.log(`Node Version: ${process.version}`);

// 1. Check DNS
console.log(`\n1. Resolving ${OPENAI_HOST}...`);
dns.lookup(OPENAI_HOST, { all: true }, (err, addresses) => {
    if (err) {
        console.error('DNS Lookup failed:', err);
        return;
    }
    console.log('DNS Addresses:', addresses);

    // 2. Test Small GET (Models)
    console.log('\n2. Testing HTTPS GET (Small Payload)...');
    const options = {
        hostname: OPENAI_HOST,
        path: '/v1/models',
        method: 'GET',
        headers: {
            'Authorization': 'Bearer test',
            'User-Agent': 'DebugScript/1.0'
        },
        timeout: 10000
    };

    const req = https.request(options, (res) => {
        console.log(`GET Response Status: ${res.statusCode}`);
        res.on('data', () => { }); // Consume
        res.on('end', () => {
            console.log('GET Complete.');

            // 3. Test Large POST (Simulate Upload)
            testLargeUpload();
        });
    });

    req.on('error', (e) => {
        console.error('GET Request Error:', e);
    });

    req.on('timeout', () => {
        console.error('GET Request Timeout (10s)');
        req.destroy();
    });

    req.end();
});

function testLargeUpload() {
    console.log('\n3. Testing HTTPS POST (Large Payload ~100KB)...');
    // Create ~100KB buffer
    const largeData = Buffer.alloc(100 * 1024, 'a');

    const options = {
        hostname: OPENAI_HOST,
        path: '/v1/chat/completions', // Just hitting an endpoint to test connection stability
        method: 'POST',
        headers: {
            'Authorization': 'Bearer test',
            'Content-Type': 'application/json',
            'Content-Length': largeData.length
        },
        timeout: 20000 // 20s
    };

    const startTime = Date.now();
    const req = https.request(options, (res) => {
        console.log(`POST Response Status: ${res.statusCode}`);
        res.on('data', () => { });
        res.on('end', () => console.log(`POST Complete in ${Date.now() - startTime}ms`));
    });

    req.on('error', (e) => {
        console.error('POST Request Error:', e);
    });

    req.on('timeout', () => {
        console.error('POST Request Timeout (20s) - MTU Issue Likely');
        req.destroy();
    });

    // Write data in chunks
    req.write(largeData);
    req.end();
}
