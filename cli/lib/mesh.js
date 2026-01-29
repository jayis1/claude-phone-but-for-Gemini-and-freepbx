/**
 * Mesh Network Logic
 * Generates peer configuration for Inter-AI communication
 */

export function generateMeshConfig(totalStacks = 3, baseSipPort = 5060) {
    const peers = {};
    const externalIp = process.env.EXTERNAL_IP || 'host.docker.internal';

    // Generate peers for Morpheus (1), Trinity (2), Neo (3), etc.
    for (let i = 1; i <= totalStacks; i++) {
        const port = baseSipPort + ((i - 1) * 10);
        // We use the stack ID as the key
        peers[`stack${i}`] = {
            id: i,
            sip: `sip:stack${i}@${externalIp}:${port}`,
            name: i === 1 ? 'Morpheus' : i === 2 ? 'Neo' : i === 3 ? 'Trinity' : `Agent-${i}`
        };
    }
    return JSON.stringify(peers);
}
