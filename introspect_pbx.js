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

        const introspectionQuery = `
            query IntrospectionQuery {
              __schema {
                mutationType {
                  fields {
                    name
                  }
                }
              }
            }
        `;

        const gqlRes = await axios.post(`${FREEPBX_API_URL}/admin/api/api/gql`, {
            query: introspectionQuery
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const mutations = gqlRes.data.data.__schema.mutationType.fields.map(f => f.name);
        console.log('Available Mutations:');
        console.log(mutations.join('\n'));

    } catch (e) {
        console.error('Error:', e.response?.data || e.message);
    }
}

introspect();
