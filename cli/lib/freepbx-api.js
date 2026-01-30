import axios from 'axios';
import { URLSearchParams } from 'url';

/**
 * FreePBX M2M API Client
 * Handles OAuth2 Client Credentials flow and GraphQL queries
 */
export class FreePBXClient {
    /**
     * @param {Object} options
     * @param {string} options.clientId - OAuth2 Client ID
     * @param {string} options.clientSecret - OAuth2 Client Secret
     * @param {string} options.apiUrl - GraphQL Endpoint (e.g. https://ip/admin/api/api/gql)
     */
    constructor(options) {
        this.clientId = options.clientId;
        this.clientSecret = options.clientSecret;
        this.apiUrl = options.apiUrl;

        // Improve URL resolution
        if (this.apiUrl) {
            // Clean up common copy-paste noise
            this.apiUrl = this.apiUrl.trim()
                .replace(/^[Ll]:\s*/, '') // Remove prompt label "L: "
                .replace(/^Graphql URL.*:\s*/i, '') // Remove label "Graphql URL (optional...): "
                .replace(/\s+/g, ''); // Remove all spaces

            // Bail if empty after cleaning
            if (!this.apiUrl) {
                this.apiUrl = null;
                this.tokenUrl = null;
            } else {
                // Basic protocol validation
                if (!this.apiUrl.startsWith('http://') && !this.apiUrl.startsWith('https://')) {
                    this.apiUrl = 'https://' + this.apiUrl;
                }

                // If user provides a bare domain/IP, append the standard GraphQL path
                if (!this.apiUrl.includes('/admin/api/') && !this.apiUrl.endsWith('.php')) {
                    this.apiUrl = this.apiUrl.replace(/\/$/, '') + '/admin/api/api/gql';
                }

                // Resolve Token URL from GraphQL URL
                this.tokenUrl = this.apiUrl.replace(/\/gql$/, '/token');
            }
        } else {
            this.tokenUrl = null;
        }

        this.accessToken = null;
        this.tokenExpiresAt = null;
    }

    /**
     * Get an access token using Client Credentials grant
     * @returns {Promise<string>} Access token
     */
    async getToken() {
        // Return cached token if still valid (with 30s buffer)
        if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt - 30000) {
            return this.accessToken;
        }

        if (!this.clientId || !this.clientSecret || !this.tokenUrl) {
            throw new Error('FreePBX API credentials or URL missing');
        }

        try {
            // FreePBX (League/OAuth2) often expects form-data for the token endpoint
            // and Basic Auth for client identification
            const params = new URLSearchParams();
            params.append('grant_type', 'client_credentials');

            const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

            const response = await axios.post(this.tokenUrl, params.toString(), {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${authHeader}`
                }
            });

            if (response.data && response.data.access_token) {
                this.accessToken = response.data.access_token;
                // Set expiry if provided, default to 1 hour
                const expiresIn = response.data.expires_in || 3600;
                this.tokenExpiresAt = Date.now() + (expiresIn * 1000);
                return this.accessToken;
            }

            throw new Error('Invalid response from token endpoint');
        } catch (error) {
            let msg = error.message;
            if (error.response?.data) {
                if (typeof error.response.data === 'string') {
                    msg = error.response.data;
                } else if (error.response.data.message) {
                    msg = error.response.data.message;
                } else if (error.response.data.error_description) {
                    msg = error.response.data.error_description;
                } else if (error.response.data.error) {
                    msg = error.response.data.error;
                }
            }

            // Helpful hint for the specific error encountered
            if (msg.includes('grant type is not supported')) {
                msg += ' (Ensure "Client Credentials" is enabled in FreePBX API Settings for this application)';
            }

            throw new Error(`FreePBX Auth Failed: ${msg}`);
        }
    }

    /**
     * Execute a GraphQL query or mutation
     * @param {string} query - GraphQL query string
     * @param {Object} variables - GraphQL variables
     * @returns {Promise<Object>} GraphQL response data
     */
    async query(query, variables = {}) {
        const token = await this.getToken();

        try {
            const response = await axios.post(this.apiUrl, {
                query,
                variables
            }, {
                timeout: 15000,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.errors) {
                const errorMsg = response.data.errors.map(e => e.message).join(', ');
                throw new Error(`GraphQL Error: ${errorMsg}`);
            }

            return response.data?.data;
        } catch (error) {
            if (error.response?.status === 401) {
                // Token might have expired unexpectedly, clear cache and retry once
                this.accessToken = null;
                return this.query(query, variables);
            }
            throw error;
        }
    }

    /**
     * Update an extension's name and caller ID
     * @param {string} extension - Extension number
     * @param {string} name - Display name
     * @param {string} outboundcid - Outbound Caller ID
     * @returns {Promise<Object>} Mutation result
     */
    async updateExtension(extension, name, outboundcid) {
        const mutation = `
            mutation ($extension: String!, $name: String!, $outboundcid: String!) {
                updateExtension(input: {
                    extension: $extension,
                    name: $name,
                    outboundcid: $outboundcid
                }) {
                    status
                    message
                }
            }
        `;
        return this.query(mutation, { extension, name, outboundcid });
    }

    /**
     * Create or update an inbound route pointing to an extension
     * @param {string} extension - Extension number
     * @param {string} did - DID number (optional)
     * @param {string} cid - CID number (optional)
     */
    async addInboundRoute(extension, did = '', cid = '') {
        const mutation = `
            mutation ($extension: String!, $did: String!, $cid: String!) {
                addInboundRoute(input: {
                    extension: $extension,
                    did: $did,
                    cid: $cid,
                    destination: "from-did-direct,${extension},1"
                }) {
                    status
                    message
                }
            }
        `;
        return this.query(mutation, { extension, did, cid });
    }

    /**
     * Apply configuration (reload Asterisk)
     * @returns {Promise<Object>} Mutation result
     */
    async applyConfig() {
        const mutation = `
            mutation {
                doreload(input: { clientMutationId: "gemini-phone" }) {
                    status
                    message
                }
            }
        `;
        return this.query(mutation);
    }

    /**
     * Test connectivity and credentials
     * @returns {Promise<{ valid: boolean, error?: string }>} True if connection is valid
     */
    async testConnection() {
        if (!this.apiUrl || this.apiUrl === 'https://') {
            return { valid: false, error: 'Incomplete or missing API URL' };
        }
        try {
            // 1. Universal health check (standard GraphQL)
            const q = `query { __typename }`;
            await this.query(q);
            return { valid: true };
        } catch (error) {
            // 2. Try fetching extensions as fallback
            try {
                const q2 = `query { fetchAllExtensions { extension { extension } } }`;
                await this.query(q2);
                return { valid: true };
            } catch (err2) {
                // Return the most informative error
                const finalError = err2.message.includes('Cannot query field') ? error.message : err2.message;
                return { valid: false, error: finalError };
            }
        }
    }
}
