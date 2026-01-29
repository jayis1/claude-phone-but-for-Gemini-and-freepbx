/**
 * hack_cisco_phone.js
 * Specifically for provisioning extension 6784 and generating SEPB8A37701C895.cnf.xml
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const FREEPBX_API_URL = process.env.FREEPBX_API_URL;
const CLIENT_ID = process.env.FREEPBX_CLIENT_ID;
const CLIENT_SECRET = process.env.FREEPBX_CLIENT_SECRET;
const PBX_IP = '172.16.1.83'; // Change to your FreePBX IP if different
const EXTENSION = '6784';
const MAC = 'B8A37701C895';

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
    return response.data;
}

async function run() {
    console.log(`--- Cisco Phone Provisioning Extension ${EXTENSION} ---`);

    let token;
    try {
        token = await getAccessToken();
        console.log('✓ API Token acquired');
    } catch (e) {
        console.error('✗ Failed to acquire API token. Please ensure FREEPBX_API_URL, CLIENT_ID, and CLIENT_SECRET are set in your .env');
        console.error('  Error message:', e.message);
        process.exit(1);
    }

    let password = 'GeminiPhone123!'; // Default password

    // 1. Ensure Extension exists in FreePBX
    console.log(`Checking if extension ${EXTENSION} exists in FreePBX...`);
    const fetchQuery = `query ($ext: ID!) {
        fetchExtension(extensionId: $ext) {
            password
        }
    }`;
    const fetchRes = await graphql(token, fetchQuery, { ext: EXTENSION });

    if (fetchRes.data && fetchRes.data.fetchExtension && fetchRes.data.fetchExtension.password) {
        password = fetchRes.data.fetchExtension.password;
        console.log(`✓ Extension ${EXTENSION} found. Using existing password.`);
    } else {
        console.log(`Extension ${EXTENSION} not found. Provisioning now...`);
        const addMutation = `mutation ($ext: ID!, $name: String!, $pass: String!) {
            addExtension(input: {
                extensionId: $ext,
                name: $name,
                password: $pass,
                tech: "pjsip"
            }) { status message }
        }`;
        const addRes = await graphql(token, addMutation, {
            ext: EXTENSION,
            name: `Physical Cisco ${EXTENSION}`,
            pass: password
        });

        if (addRes.errors) {
            console.error('✗ Failed to provision extension:', JSON.stringify(addRes.errors));
        } else {
            console.log(`✓ Extension ${EXTENSION} provisioned with password: ${password}`);
        }
    }

    // 2. Generate the Cisco CNF XML
    console.log(`Generating SEP${MAC}.cnf.xml...`);
    const xml = `<device>
    <deviceProtocol>SIP</deviceProtocol>
    <sshUserId>admin</sshUserId>
    <sshPassword>cisco</sshPassword>
    <devicePool>
        <dateTimeSetting>
            <dateTemplate>D-M-Y</dateTemplate>
            <timeZone>Central Europe Standard/Daylight Time</timeZone>
        </dateTimeSetting>
        <callManagerGroup>
            <members>
                <member priority="0">
                    <callManager>
                        <processNodeName>${PBX_IP}</processNodeName>
                        <ports>
                            <ethernetPhonePort>2000</ethernetPhonePort>
                            <sipPort>5060</sipPort>
                        </ports>
                    </callManager>
                </member>
            </members>
        </callManagerGroup>
    </devicePool>
    <sipProfile>
        <sipProxies>
            <registerWithProxy>true</registerWithProxy>
        </sipProxies>
        <sipLines>
            <line button="1">
                <featureID>9</featureID>
                <proxy>USE_DEFAULT</proxy>
                <port>5060</port>
                <name>${EXTENSION}</name>
                <displayName>${EXTENSION}</displayName>
                <autoAnswer>
                    <autoAnswerCondition>None</autoAnswerCondition>
                </autoAnswer>
                <authName>${EXTENSION}</authName>
                <authPassword>${password}</authPassword>
                <contact>${EXTENSION}</contact>
            </line>
        </sipLines>
    </sipProfile>
</device>`;

    const fileName = `SEP${MAC}.cnf.xml`;
    const configDir = path.join(process.cwd(), 'docs', 'cisco-configs');
    const filePath = path.join(configDir, fileName);

    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(filePath, xml);
    console.log(`\n✓ SUCCESS: ${fileName} generated at ${filePath}`);
    console.log(`✓ Extension: ${EXTENSION}`);
    console.log(`✓ Password: ${password}`);

    // 3. Reload FreePBX configuration
    console.log('\nReloading FreePBX configuration...');
    const reloadMutation = 'mutation { doreload(input: {}) { status message } }';
    await graphql(token, reloadMutation);
    console.log('✓ FreePBX reloaded. Your phone can now register.');
}

run().catch(err => {
    console.error('FATAL ERROR:', err.message);
});
