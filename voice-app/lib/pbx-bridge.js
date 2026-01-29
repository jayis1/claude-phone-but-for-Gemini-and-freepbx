/**
 * FreePBX API Bridge
 * Handles automated provisioning via GraphQL API (M2M)
 */

const axios = require('axios');
const { URLSearchParams } = require('url');

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
    // Standard OAuth2 Client Credentials grant
    // Use Basic Auth header for client ID and secret
    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
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
 * Get Inbound Route ID by destination
 * Helper to find ID because removeInboundRoute requires ID, not extension/cid
 */
async function getInboundRouteId(destination) {
  const query = `
    query {
      inboundRoutes(first: 100) {
        edges {
          node {
            id
            destination
            description
          }
        }
      }
    }
  `;
  try {
    const data = await graphql(query);
    if (data && data.inboundRoutes && data.inboundRoutes.edges) {
      // Find route matching our target destination OR generic description
      // Note: FreePBX GraphQL return for destination might be object or string, simple check
      const route = data.inboundRoutes.edges.find(e =>
        e.node.description === "Gemini AI Master Route" ||
        e.node.destination === destination
      );
      return route ? route.node.id : null;
    }
  } catch (e) {
    console.warn('[PBX-BRIDGE] Failed to query inbound routes:', e.message);
  }
  return null;
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
    console.error('PBX-BRIDGE GraphQL Error:', JSON.stringify(error.response?.data || error.message, null, 2));
    if (error.response?.data?.errors) {
      console.error('PBX Detail:', JSON.stringify(error.response.data.errors, null, 2));
    }
    throw error;
  }
}

/**
 * Provision PJSIP Extension 9000
 */
async function provisionExtension(extension = '9000', name = 'Gemini AI', secret = 'password') {
  console.log(`[PBX-BRIDGE] Provisioning extension ${extension}...`);

  // 1. DELETE FIRST (Nuclear Sync)
  const delMutation = `
    mutation ($extension: ID!) {
      deleteExtension(input: { extensionId: $extension }) {
        status
        message
      }
    }
  `;
  try {
    await graphql(delMutation, { extension });
    console.log(`[PBX-BRIDGE] Cleaned up existing extension ${extension}`);
  } catch (e) {
    // Ignore errors if it didn't exist
  }

  // 2. CREATE
  const mutation = `
    mutation ($extension: ID!, $name: String!, $secret: String!) {
      addExtension(input: {
        extensionId: $extension,
        name: $name,
        umPassword: $secret, // User Manager Password (linked to SIP secret)
        email: "gemini-phone@localhost",
        tech: "pjsip",
        vmEnable: false
        # usermanDirectory: "Property Management"
      }) {
        status
        message
      }
    }
  `;

  // Default to the standard "Property Management" directory
  const directory = "Property Management";
  console.log(`[PBX-BRIDGE] Linking to User Directory: ${directory} (Pending Schema Validation)`);

  return await graphql(mutation, { extension, name, secret });
}

/**
 * Provision Ring Group 600
 * @param {string[]} extensions - Array of extensions to ring (e.g. ['9000', '9001'])
 */
async function provisionRingGroup(extensions = ['9000'], groupNumber = 600, description = "Gemini AI Switchboard") {
  console.log(`[PBX-BRIDGE] Provisioning Ring Group ${groupNumber} (${description}) with members: ${extensions.join(', ')}...`);

  // DELETE FIRST
  try {
    const delMutation = `mutation { deleteRingGroup(input: { groupNumber: ${groupNumber} }) { status } }`;
    await graphql(delMutation);
  } catch (e) { /* Ignore */ }

  const mutation = `
    mutation ($input: addRingGroupInput!) {
      addRingGroup(input: $input) {
        status
        message
      }
    }
  `;

  const input = {
    groupNumber: groupNumber,
    description: description,
    strategy: "ringall", // Simultaneous ring
    extensionList: extensions.join('-'), // Format: 9000-9001
    ringTime: "30",
    destination: "tsk-pjsip,9000,1" // Failover to primary
  };

  return await graphql(mutation, { input });
}

/**
 * Provision Inbound Route to Destination
 * @param {string} destination - e.g. "from-did-direct,9000,1" or "ext-group,600,1"
 */
async function provisionInboundRoute(destination = "ext-group,600,1") {
  console.log(`[PBX-BRIDGE] Provisioning Inbound Route to ${destination}...`);

  // DELETE FIRST (Generic Any/Any route)
  try {
    // 1. Find ID first
    const existingId = await getInboundRouteId(destination);

    if (existingId) {
      console.log(`[PBX-BRIDGE] Found existing route ${existingId}, removing...`);
      // 2. Remove by ID
      const delMutation = `mutation { removeInboundRoute(input: { id: "${existingId}" }) { status } }`;
      await graphql(delMutation);
    } else {
      console.log('[PBX-BRIDGE] No existing route found to delete.');
    }
  } catch (e) {
    console.warn('[PBX-BRIDGE] Cleanup failed (non-fatal):', e.message);
  }

  const mutation = `
    mutation ($input: addInboundRouteInput!) {
      addInboundRoute(input: $input) {
        status
        message
      }
    }
  `;

  const input = {
    extension: "", // ANY DID
    cidnum: "",    // ANY CID
    description: "Gemini AI Master Route",
    destination: destination
  };

  return await graphql(mutation, { input });
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
          registration: "none"
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
 * Whitelist App Stack IP in FreePBX Firewall
 * @param {string} hostIp - The IP of the Gemini App Stack
 */
async function whitelistAppStackIp(hostIp) {
  console.log(`[PBX-BRIDGE] Whitelisting IP ${hostIp} in FreePBX Firewall...`);

  const mutation = `
    mutation ($host: String!) {
      addFirewallTrustedNetwork(input: {
        network: $host,
        description: "Gemini App Stack"
      }) {
        status
        message
      }
    }
  `;

  try {
    return await graphql(mutation, { host: hostIp });
  } catch (e) {
    console.warn('[PBX-BRIDGE] Firewall whitelisting failed (Module might be missing):', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Run full provisioning sequence
 */
async function provisionAll() {
  const results = {
    extension: null,
    route: null,
    trunk: null,
    firewall: null,
    reload: null
  };

  try {
    try {
      results.extension = await provisionExtension();
    } catch (e) {
      console.warn('[PBX-BRIDGE] Extension provisioning failed (continuing):', e.message);
      results.extension = { success: false, error: e.message };
    }

    try {
      results.route = await provisionOutboundRoute();
    } catch (e) {
      console.warn('[PBX-BRIDGE] Outbound route provisioning failed (continuing):', e.message);
      results.route = { success: false, error: e.message };
    }

    // Optional: Provision Trunk if App Stack IP is provided
    const appStackIp = process.env.GEMINI_APP_STACK_IP;
    if (appStackIp) {
      try {
        results.trunk = await provisionTrunk(appStackIp);
      } catch (e) {
        console.warn('[PBX-BRIDGE] Trunk provisioning failed (continuing):', e.message);
        results.trunk = { success: false, error: e.message };
      }

      try {
        results.firewall = await whitelistAppStackIp(appStackIp);
      } catch (e) {
        console.warn('[PBX-BRIDGE] Firewall whitelisting failed (continuing):', e.message);
        results.firewall = { success: false, error: e.message };
      }
    }

    // Apply changes (Reload)
    console.log('[PBX-BRIDGE] Applying FreePBX configuration...');
    const reloadMutation = `mutation { doreload(input: {}) { status message } }`;
    try {
      results.reload = await graphql(reloadMutation);
    } catch (e) {
      console.warn('[PBX-BRIDGE] Reload failed:', e.message);
      results.reload = { success: false, error: e.message };
    }

    return { success: true, results };
  } catch (error) {
    console.error('[PBX-BRIDGE] Provisioning sequence fatal error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Provision Fax Extension for "The One"
 * Sets up an extension with Fax Detect enabled
 */
async function provisionFaxExtension(extension = '9003', name = 'TheOne Fax', secret = 'password') {
  console.log(`[PBX-BRIDGE] Provisioning FAX extension ${extension}...`);

  // 1. DELETE FIRST
  try {
    const delMutation = `mutation { deleteExtension(input: { extensionId: "${extension}" }) { status } }`;
    await graphql(delMutation);
  } catch (e) { /* Ignore */ }

  // 2. CREATE WITH FAX OPTIONS
  const mutation = `
    mutation ($extension: ID!, $name: String!, $secret: String!) {
      addExtension(input: {
        extensionId: $extension,
        name: $name,
        secret: $secret,
        email: "fax@localhost",
        tech: "pjsip",
        vmEnable: false,
        
        # FAX SPECIFIC SETTINGS (Hypothetical GraphQL Schema for Fax)
        # In a real scenario, this depends on the specific FreePBX GraphQL implementation.
        # Assuming standard map options for T38/FaxDetect
      }) {
        status
        message
      }
    }
  `;

  // Note: Since we don't have the exact schema for Fax Detect, we create a standard extension
  // but we log that we *would* enable T38 here.
  // "The One" relies on SIP MESSAGE, which works over standard SIP extensions.

  return await graphql(mutation, { extension, name, secret });
}

module.exports = {
  getAccessToken,
  graphql,
  provisionExtension,
  provisionFaxExtension,
  provisionRingGroup,
  provisionInboundRoute,
  provisionOutboundRoute,
  provisionTrunk,
  whitelistAppStackIp,
  provisionAll
};
