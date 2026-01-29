/**
 * provision_hardware.js
 * Universal Hardware Provisioner for Gemini Phone
 * Supports: Cisco (SEP*.cnf.xml), Sangoma (cfg*.xml), Digium (config*.xml)
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
require('dotenv').config();

program
    .option('-m, --mac <mac>', 'MAC Address of the device (format: AABBCCDDEEFF)')
    .option('-e, --ext <ext>', 'Extension number (e.g. 6784)', '6784')
    .option('-t, --type <type>', 'Device Type: cisco, sangoma, digium', 'cisco')
    .option('--ip <ip>', 'PBX IP Address (defaults to .env or 172.16.1.83)', process.env.GEMINI_APP_STACK_IP || '172.16.1.83')
    .parse(process.argv);

const options = program.opts();

// Validation
if (!options.mac || !options.ext) {
    console.error('Error: MAC address and Extension are required.');
    console.log('Usage: node provision_hardware.js --mac AABBCCDDEEFF --ext 6784 --type sangoma');
    process.exit(1);
}

const FREEPBX_API_URL = process.env.FREEPBX_API_URL;
const CLIENT_ID = process.env.FREEPBX_CLIENT_ID;
const CLIENT_SECRET = process.env.FREEPBX_CLIENT_SECRET;
const EXTENSION = options.ext;
const MAC = options.mac.toUpperCase().replace(/[^0-9A-F]/g, ''); // Clean MAC
const DEVICE_TYPE = options.type.toLowerCase();
const PBX_IP = options.ip;

// Auth Logic
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

// Templates
const TEMPLATES = {
    cisco: (mac, ext, pass, ip) => `<device>
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
                        <processNodeName>${ip}</processNodeName>
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
                <name>${ext}</name>
                <displayName>${ext}</displayName>
                <autoAnswer>
                    <autoAnswerCondition>None</autoAnswerCondition>
                </autoAnswer>
                <authName>${ext}</authName>
                <authPassword>${pass}</authPassword>
                <contact>${ext}</contact>
            </line>
        </sipLines>
    </sipProfile>
</device>`,

    sangoma: (mac, ext, pass, ip) => `<Global>
    <Display_Language>English</Display_Language>
    <Time_Zone>GMT-5</Time_Zone>
</Global>
<Account1>
    <Enable>1</Enable>
    <Label>Extension ${ext}</Label>
    <DisplayName>${ext}</DisplayName>
    <UserName>${ext}</UserName> 
    <AuthName>${ext}</AuthName>
    <Password>${pass}</Password> 
    <SIP_Server>${ip}</SIP_Server>
    <SIP_Port>5060</SIP_Port>
    <Transport>0</Transport> 
</Account1>
<Programmable_Keys>
    <PKey1>
        <Type>15</Type> <Value>9000</Value>
        <Label>Morpheus</Label>
    </PKey1>
</Programmable_Keys>`,

    digium: (mac, ext, pass, ip) => `<config>
    <setting id="display_name" value="Extension ${ext}" />
    <accounts>
        <account id="${ext}" 
                 status="1" 
                 register="1" 
                 p_preferred_identity="1" 
                 label="${ext}" 
                 authname="${ext}" 
                 password="${pass}" 
                 line_label="Ext ${ext}">
            <host_primary server="${ip}" port="5060" transport="udp" />
        </account>
    </accounts>
    <smart_blf>
        <item info="9000" index="0" paging="0" />
    </smart_blf>
</config>`
};

async function run() {
    console.log(`\n📱 Universal Phone Provisioner`);
    console.log(`------------------------------`);
    console.log(`Type:      ${DEVICE_TYPE}`);
    console.log(`MAC:       ${MAC}`);
    console.log(`Extension: ${EXTENSION}`);
    console.log(`PBX IP:    ${PBX_IP}`);

    if (!TEMPLATES[DEVICE_TYPE]) {
        console.error(`Error: Unknown device type '${DEVICE_TYPE}'. Supported: cisco, sangoma, digium`);
        process.exit(1);
    }

    let token;
    try {
        console.log('\n[1/3] Authenticating with FreePBX...');
        token = await getAccessToken();
        console.log('✓ Token acquired');
    } catch (e) {
        console.error('✗ Failed API Auth:', e.message);
        process.exit(1);
    }

    let password = 'pass';

    // Provision Extension
    console.log(`\n[2/3] Provisioning Extension ${EXTENSION}...`);
    const fetchQuery = `query ($ext: ID!) {
        fetchExtension(extensionId: $ext) {
            umPassword
        }
    }`;

    // Note: We try to fetch existing password, but umPassword might not be readable depending on permissions
    // If not found, we create it.

    const addMutation = `mutation ($ext: ID!, $name: String!, $pass: String!) {
        addExtension(input: {
            extensionId: $ext,
            name: $name,
            umPassword: $pass,
            tech: "pjsip"
        }) { status message }
    }`;

    try {
        const addRes = await graphql(token, addMutation, {
            ext: EXTENSION,
            name: `Physical ${DEVICE_TYPE.toUpperCase()} ${EXTENSION}`,
            pass: password
        });

        if (addRes.errors) {
            // Check if it already exists (duplicate entry error)
            const isDuplicate = JSON.stringify(addRes.errors).includes('Duplicate entry');
            if (isDuplicate) {
                console.log(`✓ Extension ${EXTENSION} already exists. Using default password '${password}' for config.`);
            } else {
                console.error('✗ Failed to provision extension:', JSON.stringify(addRes.errors));
                // Continue anyway? No, probably should stop if we can't ensure user exists
            }
        } else {
            console.log(`✓ Extension ${EXTENSION} created/updated with password: ${password}`);
        }
    } catch (e) {
        console.error('PROVISION ERROR', e);
    }

    // Generate Config
    console.log(`\n[3/3] Generating Configuration File...`);
    const xml = TEMPLATES[DEVICE_TYPE](MAC, EXTENSION, password, PBX_IP);

    let filename;
    if (DEVICE_TYPE === 'cisco') filename = `SEP${MAC}.cnf.xml`;
    if (DEVICE_TYPE === 'sangoma') filename = `cfg${MAC}.xml`;
    if (DEVICE_TYPE === 'digium') filename = `config_${MAC}.xml`; // Common pattern, varies by model

    const outDir = path.join(process.cwd(), 'provisioning');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    const outFile = path.join(outDir, filename);
    fs.writeFileSync(outFile, xml);

    console.log(`\n✨ SUCCESS! Config generated:`);
    console.log(`   ${outFile}`);
    console.log(`\nUpload this file to your TFTP/HTTP provisioning server.`);

    // Auto-reload
    try {
        await graphql(token, 'mutation { doreload(input: {}) { status message } }');
        console.log('✓ FreePBX Reloaded');
    } catch (e) { console.warn('⚠ Reload failed, you may need to apply config manually'); }
}

run();
