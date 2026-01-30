import axios from 'axios';

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
            // If user provides a bare domain, append the standard GraphQL path
            if (!this.apiUrl.includes('/admin/api/') && !this.apiUrl.endsWith('.php')) {
                this.apiUrl = this.apiUrl.replace(/\/$/, '') + '/admin/api/api/gql';
            }

            // Resolve Token URL from GraphQL URL
            this.tokenUrl = this.apiUrl.replace(/\/gql$/, '/token');
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
            const response = await axios.post(this.tokenUrl, {
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret
            }, {
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
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
            const msg = error.response?.data?.message || error.message;
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
     * Test connectivity and credentials
     * @returns {Promise<{ valid: boolean, error?: string }>} True if connection is valid
     */
    async testConnection() {
        try {
            // Use a simple query that should always work if authenticated
            const q = `query { fetchAllExtensions { extension } }`;
            await this.query(q);
            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
}
