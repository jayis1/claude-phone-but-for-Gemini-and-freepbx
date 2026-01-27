/**
 * FreePBX API Bridge
 * Handles automated provisioning via GraphQL API (M2M)
 */

const axios = require('axios');

const FREEPBX_API_URL = process.env.FREEPBX_API_URL || '';
const CLIENT_ID = process.env.FREEPBX_CLIENT_ID || '';
const CLIENT_SECRET = process.env.FREEPBX_CLIENT_SECRET || '';
const DEFAULT_TRUNK = process.env.FREEPBX_TRUNK_NAME || 'RedSpot';

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get OAuth2 Access Token
 */
async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    if (!FREEPBX_API_URL || !CLIENT_ID || !CLIENT_SECRET) {
        throw new Error('FreePBX API configuration missing (URL, Client ID, or Secret)');
    }

    const tokenUrl = `${FREEPBX_API_URL}/admin/api/api/token`;

    try {
        const response = await axios.post(tokenUrl, {
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        if (response.data && response.data.access_token) {
            cachedToken = response.data.access_token;
            // Buffer expiry by 60 seconds
            tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
            return cachedToken;
        } else {
            throw new Error('Failed to retrieve access token from FreePBX');
        }
    } catch (error) {
        console.error('PBX-BRIDGE Token Error:', error.response?.data || error.message);
        throw new Error(`FreePBX Authentication failed: ${error.message}`);
    }
}

/**
 * Perform GraphQL Query/Mutation
 */
async function graphql(query, variables = {}) {
    const token = await getAccessToken();
    const gqlUrl = `${FREEPBX_API_URL}/admin/api/api/gql`;

    try {
        const response = await axios.post(gqlUrl, {
            query,
            variables
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        if (response.data.errors) {
            const errorMsg = response.data.errors.map(e => e.message).join(', ');
            throw new Error(`GraphQL Error: ${errorMsg}`);
        }

        return response.data.data;
    } catch (error) {
        console.error('PBX-BRIDGE GraphQL Error:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Provision PJSIP Extension 9000
 */
async function provisionExtension(extension = '9000', name = 'Gemini AI') {
    console.log(`[PBX-BRIDGE] Provisioning extension ${extension}...`);

    const mutation = `
    mutation ($extension: String!, $name: String!) {
      addExtension(input: {
        extension: $extension,
        name: $name,
        tech: "pjsip",
        um_enabled: "no"
      }) {
        status
        message
      }
    }
  `;

    return await graphql(mutation, { extension, name });
}

/**
 * Provision Outbound Route "Gemini-to-PSTN"
 * @param {string} trunkName - Optional trunk name to use
 */
async function provisionOutboundRoute(trunkName = DEFAULT_TRUNK) {
    console.log(`[PBX-BRIDGE] Provisioning outbound route Gemini-to-PSTN using trunk ${trunkName}...`);

    const mutation = `
    mutation {
      addOutboundRoute(input: {
        name: "Gemini-to-PSTN",
        trunks: ["${trunkName}"],
        patterns: [
          { match_pattern: "." }
        ]
      }) {
        status
        message
      }
    }
  `;

    return await graphql(mutation);
}

/**
 * Provision PJSIP Trunk "Gemini-App-Stack"
 * @param {string} hostIp - The IP of the Gemini App Stack
 */
async function provisionTrunk(hostIp) {
    console.log(`[PBX-BRIDGE] Provisioning SIP Trunk to Gemini App Stack (${hostIp})...`);

    const mutation = `
    mutation ($host: String!) {
      addTrunk(input: {
        name: "Gemini-App-Stack",
        tech: "pjsip",
        pjsip: {
          server_uri: $host,
          server_port: "5060",
          aor_contact: $host,
          authentication: "none",
          registration: "none",
          context: "from-internal"
        }
      }) {
        status
        message
      }
    }
  `;

    return await graphql(mutation, { host: hostIp });
}

/**
 * Run full provisioning sequence
 */
async function provisionAll() {
    const results = {
        extension: null,
        route: null,
        reload: null
    };

    try {
        results.extension = await provisionExtension();
        results.route = await provisionOutboundRoute();

        // Optional: Provision Trunk if App Stack IP is provided
        const appStackIp = process.env.GEMINI_APP_STACK_IP;
        if (appStackIp) {
            results.trunk = await provisionTrunk(appStackIp);
        }

        // Apply changes (Reload)
        console.log('[PBX-BRIDGE] Applying FreePBX configuration...');
        const reloadMutation = `mutation { reload { status message } }`;
        results.reload = await graphql(reloadMutation);

        return { success: true, results };
    } catch (error) {
        console.error('[PBX-BRIDGE] Provisioning sequence failed:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    getAccessToken,
    provisionExtension,
    provisionOutboundRoute,
    provisionTrunk,
    provisionAll
};
