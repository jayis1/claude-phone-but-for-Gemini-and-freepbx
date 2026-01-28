const axios = require('axios');
require('dotenv').config();

const FREEPBX_API_URL = process.env.FREEPBX_API_URL;
const CLIENT_ID = process.env.FREEPBX_CLIENT_ID;
const CLIENT_SECRET = process.env.FREEPBX_CLIENT_SECRET;

async function introspect() {
    console.log('Starting introspection...');
    try {
        const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');

        const tokenRes = await axios.post(`${FREEPBX_API_URL}/admin/api/api/token`, params, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const token = tokenRes.data.access_token;
        console.log('Token acquired.');

        // Minimal query to avoid timeout
        const inputTypeQuery = `
            query InputTypeQuery {
              addExtension: __type(name: "addExtensionInput") {
                inputFields {
                  name
                }
              }
            }
        `;

        const gqlRes = await axios.post(`${FREEPBX_API_URL}/admin/api/api/gql`, {
            query: inputTypeQuery
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('--- Extension Fields ---');
        gqlRes.data.data.addExtension.inputFields.forEach(f => {
            console.log(f.name);
        });

    } catch (e) {
        console.error('Error:', e.response?.data || e.message);
    }
}

introspect();
