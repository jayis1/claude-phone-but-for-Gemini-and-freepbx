/**
 * hack_pbx_setup.js
 * Automates FreePBX extension provisioning and generates phone configs for:
 * - Sangoma S-Series
 * - TheOne Fax Machine (Analog ATA)
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const FREEPBX_API_URL = process.env.FREEPBX_API_URL;
const CLIENT_ID = process.env.FREEPBX_CLIENT_ID;
const CLIENT_SECRET = process.env.FREEPBX_CLIENT_SECRET;
const PBX_IP = '172.16.1.83';

const STACKS = [
    { id: 1, name: 'Morpheus', extension: '9000', port: '5060' },
    { id: 2, name: 'Neo', extension: '9010', port: '5070' },
    { id: 3, name: 'Trinity', extension: '9020', port: '5080' },
    { id: 4, name: 'TheOne', extension: '9003', port: '5091', type: 'fax' }
];

async function getAccessToken() {
    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    const response = await axios.post(`${FREEPBX_API_URL}/admin/api/api/token`, params, {
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    return response.data.access_token;
}

async function graphql(token, query, variables = {}) {
    const response = await axios.post(`${FREEPBX_API_URL}/admin/api/api/gql`, {
        query,
        variables
    }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.data.errors) {
        throw new Error(JSON.stringify(response.data.errors));
    }
    return response.data.data;
}

function generateSangomaConfig(stack, password) {
    return `<!-- Sangoma config for ${stack.name} -->
<Global>
    <Display_Language>English</Display_Language>
    <Time_Zone>GMT-5</Time_Zone>
</Global>
<Account1>
    <Enable>1</Enable>
    <Label>${stack.name}</Label>
    <DisplayName>${stack.extension}</DisplayName>
    <UserName>${stack.extension}</UserName>
    <AuthName>${stack.extension}</AuthName>
    <Password>${password}</Password>
    <SIP_Server>${PBX_IP}</SIP_Server>
    <SIP_Port>${stack.port}</SIP_Port>
    <Transport>0</Transport>
</Account1>`;
}

async function run() {
    console.log('--- FreePBX AI Stack Setup (Sangoma + Fax focus) ---');

    let token;
    try {
        token = await getAccessToken();
        console.log('✓ API Token acquired');
    } catch (e) {
        console.warn('! API Token failed, using offline mode or skipping provisioning.');
    }

    for (const stack of STACKS) {
        console.log(`\nProcessing ${stack.name} (Ext ${stack.extension})...`);

        let password = 'GeminiPhone123!';

        if (token) {
            try {
                console.log(`  Linking extension ${stack.extension} in FreePBX...`);
                const mutation = `mutation ($ext: ID!, $name: String!, $pass: String!) {
                    addExtension(input: {
                        extensionId: $ext,
                        name: $name,
                        password: $pass,
                        tech: "pjsip"
                    }) { status message }
                }`;
                await graphql(token, mutation, {
                    ext: stack.extension,
                    name: `AI ${stack.name}`,
                    pass: password
                });
                console.log(`  ✓ Extension ${stack.extension} provisioned.`);

                if (stack.type === 'fax') {
                    console.log(`  Activating Fax parameters via API...`);
                    const faxMutation = `mutation ($ext: ID!) {
                        updateExtension(extensionId: $ext, parameters: [
                            { name: "faxenabled", value: "true" }
                        ]) { status }
                    }`;
                    await graphql(token, faxMutation, { ext: stack.extension });
                    console.log(`  ✓ Fax mode enabled for ${stack.extension}.`);
                }
            } catch (e) {
                console.warn(`  ! API Step failed for ${stack.extension} (might already exist).`);
            }
        }

        // Generate Config
        const sangoma = generateSangomaConfig(stack, password);
        const fileName = stack.name.toLowerCase().replace(' ', '_');
        fs.writeFileSync(`docs/sangoma-configs/${fileName}.xml`, sangoma);

        console.log(`  ✓ Sangoma configuration generated for ${stack.name}.`);
    }

    if (token) {
        console.log('\nReloading FreePBX...');
        try {
            await graphql(token, 'mutation { doreload(input: {}) { status message } }');
            console.log('✓ FreePBX reloaded.');
        } catch (e) { }
    }

    console.log('\n--- Setup Complete ---');
}

run();
