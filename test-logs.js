async function testLogs() {
    const services = [
        { name: 'Mission Control', url: 'http://localhost:3030/api/logs' },
        { name: 'Voice App', url: 'http://localhost:3434/api/logs' },
        { name: 'Inference Brain', url: 'http://localhost:4000/logs' },
        { name: 'API Server', url: 'http://localhost:3333/logs' }
    ];

    console.log('--- Testing Log Endpoints ---\n');

    for (const s of services) {
        try {
            console.log(`Testing ${s.name} (${s.url})...`);
            const res = await fetch(s.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.logs && Array.isArray(data.logs)) {
                console.log(`✅ Success! Found ${data.logs.length} logs.`);
                if (data.logs.length > 0) {
                    console.log(`   Sample: [${data.logs[0].level}] ${data.logs[0].message}`);
                }
            } else {
                console.log(`❌ Failed: Invalid format`, data);
            }
        } catch (e) {
            console.log(`❌ Error: ${e.message}`);
        }
        console.log('');
    }
}

testLogs();
