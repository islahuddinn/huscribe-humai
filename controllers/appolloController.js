import axios from 'axios';
import asyncHandler from 'express-async-handler';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Apollo API configuration
const APOLLO_API_BASE_URL = 'https://api.apollo.io/v1';
const APOLLO_OAUTH_BASE_URL = 'https://app.apollo.io/oauth';
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const CLIENT_ID = process.env.APOLLO_CLIENT_ID;
const CLIENT_SECRET = process.env.APOLLO_CLIENT_SECRET;
const REDIRECT_URI = process.env.APOLLO_REDIRECT_URI;

// Request logger
const logRequest = (method, url, data) => {
    console.log('------------------------------------');
    console.log(`APOLLO API REQUEST: ${method} ${url}`);
    console.log('Request Data:', data || 'No data');
    console.log('------------------------------------');
};

// Response logger
const logResponse = (status, data) => {
    console.log('------------------------------------');
    console.log(`APOLLO API RESPONSE: Status ${status}`);
    console.log('Response Data:', data);
    console.log('------------------------------------');
};

// Error logger
const logError = (error) => {
    console.error('------------------------------------');
    console.error('APOLLO API ERROR:');
    console.error('Status:', error.response?.status || 'No status');
    console.error('Error Message:', error.message || 'No error message');
    console.error('Response Data:', error.response?.data || 'No response data');
    console.error('------------------------------------');
};

// Generate state parameter for CSRF protection
const generateState = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Store state and tokens (in production, use a proper database)
const tokenStore = new Map();

// Create Apollo API client with correct authentication
const apolloClient = axios.create({
    baseURL: APOLLO_API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': APOLLO_API_KEY
    }
});

// OAuth Functions
// Get OAuth authorization URL
const getAuthorizationUrl = asyncHandler(async (req, res) => {
    try {
        const state = generateState();
        const scope = 'contacts.read contacts.write organizations.read organizations.write people.read people.write emails.read emails.write sequences.read sequences.write';
        
        const authUrl = `${APOLLO_OAUTH_BASE_URL}/authorize?` +
            `client_id=${CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
            `response_type=code&` +
            `scope=${encodeURIComponent(scope)}&` +
            `state=${state}`;

        // Store state for verification
        tokenStore.set(state, {
            createdAt: Date.now(),
            used: false
        });

        logRequest('GET', '/authorize', { state, scope });

        return res.json({
            success: true,
            data: {
                authorizationUrl: authUrl,
                state
            }
        });
    } catch (error) {
        logError(error);
        return res.status(500).json({
            success: false,
            error: 'Failed to generate authorization URL',
            message: error.message
        });
    }
});

// Handle OAuth callback
const handleCallback = asyncHandler(async (req, res) => {
    try {
        const { code, state } = req.query;

        // Validate state parameter
        if (!state || !tokenStore.has(state)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid state parameter',
                message: 'State parameter is invalid or expired'
            });
        }

        const stateData = tokenStore.get(state);
        if (stateData.used) {
            return res.status(400).json({
                success: false,
                error: 'State parameter already used',
                message: 'This authorization request has already been processed'
            });
        }

        // Mark state as used
        stateData.used = true;
        tokenStore.set(state, stateData);

        // Exchange code for tokens
        const tokenResponse = await axios.post(`${APOLLO_OAUTH_BASE_URL}/token`, {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI
        });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        // Store tokens (in production, store in database)
        tokenStore.set(access_token, {
            refresh_token,
            expires_at: Date.now() + (expires_in * 1000),
            user_id: req.user?.id // If you have user authentication
        });

        logResponse(tokenResponse.status, {
            access_token: '***',
            refresh_token: '***',
            expires_in
        });

        return res.json({
            success: true,
            data: {
                access_token,
                refresh_token,
                expires_in
            }
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to exchange code for tokens',
            message: error.response?.data?.error || error.message
        });
    }
});

// Refresh access token
const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({
                success: false,
                error: 'Missing refresh token',
                message: 'Please provide a refresh token'
            });
        }

        const tokenResponse = await axios.post(`${APOLLO_OAUTH_BASE_URL}/token`, {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token,
            grant_type: 'refresh_token'
        });

        const { access_token, expires_in } = tokenResponse.data;

        // Update stored tokens
        tokenStore.set(access_token, {
            refresh_token,
            expires_at: Date.now() + (expires_in * 1000),
            user_id: req.user?.id // If you have user authentication
        });

        logResponse(tokenResponse.status, {
            access_token: '***',
            expires_in
        });

        return res.json({
            success: true,
            data: {
                access_token,
                expires_in
            }
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to refresh access token',
            message: error.response?.data?.error || error.message
        });
    }
});

// Revoke access token
const revokeAccessToken = asyncHandler(async (req, res) => {
    try {
        const { access_token } = req.body;

        if (!access_token) {
            return res.status(400).json({
                success: false,
                error: 'Missing access token',
                message: 'Please provide an access token'
            });
        }

        await axios.post(`${APOLLO_OAUTH_BASE_URL}/revoke`, {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            token: access_token
        });

        // Remove token from store
        tokenStore.delete(access_token);

        logRequest('POST', '/revoke', { access_token: '***' });

        return res.json({
            success: true,
            message: 'Access token revoked successfully'
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to revoke access token',
            message: error.response?.data?.error || error.message
        });
    }
});

// Middleware to validate access token
const validateAccessToken = asyncHandler(async (req, res, next) => {
    try {
        const access_token = req.headers.authorization?.split(' ')[1];

        if (!access_token) {
            return res.status(401).json({
                success: false,
                error: 'Missing access token',
                message: 'Please provide an access token'
            });
        }

        const tokenData = tokenStore.get(access_token);
        if (!tokenData) {
            return res.status(401).json({
                success: false,
                error: 'Invalid access token',
                message: 'Access token is invalid or expired'
            });
        }

        if (Date.now() >= tokenData.expires_at) {
            return res.status(401).json({
                success: false,
                error: 'Expired access token',
                message: 'Access token has expired'
            });
        }

        // Add token data to request
        req.apolloToken = tokenData;
        next();
    } catch (error) {
        logError(error);
        return res.status(500).json({
            success: false,
            error: 'Token validation failed',
            message: error.message
        });
    }
});

// Test API key
const testApiKey = asyncHandler(async (req, res) => {
    try {
        logRequest('GET', '/auth/health', null);
        const response = await apolloClient.get('/auth/health');
        logResponse(response.status, response.data);

        return res.json({
            success: true,
            message: 'Apollo API key is working',
            data: response.data
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'API test failed',
            message: error.response?.data?.error || error.message
        });
    }
});

// Search for organizations
const searchOrganizations = asyncHandler(async (req, res) => {
    try {
        const { domain, name, page = 1, per_page = 10 } = req.body;
        
        // Validate search parameters
        if (!domain && !name) {
            return res.status(400).json({
                success: false,
                error: 'Missing search parameters',
                message: 'Please provide either domain or organization name'
            });
        }
        
        // Build search payload
        const searchPayload = {
            page: parseInt(page),
            per_page: parseInt(per_page)
        };
        
        if (domain) searchPayload.domains = [domain];
        if (name) searchPayload.q_organization_name = name;
        
        logRequest('POST', '/organizations/search', searchPayload);
        
        const response = await apolloClient.post('/organizations/search', searchPayload);
        logResponse(response.status, response.data);
        
        return res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'Organization search failed',
            message: error.response?.data?.error || error.message
        });
    }
});

// Search for people
const searchPeople = asyncHandler(async (req, res) => {
    try {
        const searchQuery = req.body;
        console.log(searchQuery, "Here is the search query=============")
        
        // Validate search parameters
        if (!searchQuery || Object.keys(searchQuery).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing search parameters',
                message: 'Please provide search parameters'
            });
        }
        
        logRequest('POST', '/people/search', searchQuery);
        
        const response = await apolloClient.post('/people/search', searchQuery);
        logResponse(response.status, response.data);
        
        return res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'People search failed',
            message: error.response?.data?.error || error.message
        });
    }
});

// Enrich organization data
const enrichOrganization = asyncHandler(async (req, res) => {
    try {
        const { domain } = req.body;
        
        // Validate domain
        if (!domain || typeof domain !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Missing domain',
                message: 'Please provide a valid domain'
            });
        }
        
        logRequest('POST', '/organizations/enrich', { domain });
        
        const response = await apolloClient.post('/organizations/enrich', { domain });
        logResponse(response.status, response.data);
        
        return res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'Organization enrichment failed',
            message: error.response?.data?.error || error.message
        });
    }
});

// Verify email
const verifyEmail = asyncHandler(async (req, res) => {
    try {
        const { email } = req.body;
        
        // Validate email
        if (!email || typeof email !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Missing email',
                message: 'Please provide a valid email'
            });
        }
        
        logRequest('POST', '/emails/verify', { email });
        
        const response = await apolloClient.post('/emails/verify', { email });
        logResponse(response.status, response.data);
        
        return res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'Email verification failed',
            message: error.response?.data?.error || error.message
        });
    }
});

// Enrich person data by email or name
const enrichPerson = asyncHandler(async (req, res) => {
    try {
        const { email, first_name, last_name, organization_name } = req.body;
        
        // Validate input
        if (!email && !(first_name && last_name)) {
            return res.status(400).json({
                success: false,
                error: 'Missing person information',
                message: 'Please provide either email or first name and last name'
            });
        }
        
        // Build request data
        const requestData = {};
        if (email) requestData.email = email;
        if (first_name) requestData.first_name = first_name;
        if (last_name) requestData.last_name = last_name;
        if (organization_name) requestData.organization_name = organization_name;
        
        logRequest('POST', '/people/match', requestData);
        
        const response = await apolloClient.post('/people/match', requestData);
        logResponse(response.status, response.data);
        
        return res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'Person enrichment failed',
            message: error.response?.data?.error || error.message
        });
    }
});

// Get person by ID
const getPersonById = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Missing ID',
                message: 'Please provide a person ID'
            });
        }
        
        logRequest('GET', `/people/${id}`, null);
        
        const response = await apolloClient.get(`/people/${id}`);
        logResponse(response.status, response.data);
        
        return res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to get person',
            message: error.response?.data?.error || error.message
        });
    }
});

// Get contact information
const getContactInfo = asyncHandler(async (req, res) => {
    try {
        const { person_id } = req.params;
        
        if (!person_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing person ID',
                message: 'Please provide a person ID'
            });
        }
        
        logRequest('GET', `/people/${person_id}/contact_details`, null);
        
        const response = await apolloClient.get(`/people/${person_id}/contact_details`);
        logResponse(response.status, response.data);
        
        return res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to get contact information',
            message: error.response?.data?.error || error.message
        });
    }
});

// Get account information
const getAccountInfo = asyncHandler(async (req, res) => {
    try {
        logRequest('GET', '/account', null);
        
        const response = await apolloClient.get('/account');
        logResponse(response.status, response.data);
        
        return res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to get account information',
            message: error.response?.data?.error || error.message
        });
    }
});

// Add a sequence (for email outreach)
const createSequence = asyncHandler(async (req, res) => {
    try {
        const sequenceData = req.body;
        
        if (!sequenceData.name) {
            return res.status(400).json({
                success: false,
                error: 'Missing sequence name',
                message: 'Please provide a name for the sequence'
            });
        }
        
        logRequest('POST', '/sequences', sequenceData);
        
        const response = await apolloClient.post('/sequences', sequenceData);
        logResponse(response.status, response.data);
        
        return res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to create sequence',
            message: error.response?.data?.error || error.message
        });
    }
});

// Get sequence details
const getSequenceDetails = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Missing sequence ID',
                message: 'Please provide a sequence ID'
            });
        }
        
        logRequest('GET', `/sequences/${id}`, null);
        
        const response = await apolloClient.get(`/sequences/${id}`);
        logResponse(response.status, response.data);
        
        return res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to get sequence details',
            message: error.response?.data?.error || error.message
        });
    }
});

// Bulk enrich organizations
const bulkEnrichOrganizations = asyncHandler(async (req, res) => {
    try {
        const { domains } = req.body;
        
        if (!domains || !Array.isArray(domains) || domains.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing domains',
                message: 'Please provide an array of domains'
            });
        }
        
        logRequest('POST', '/organizations/bulk_enrich', { domains });
        
        const response = await apolloClient.post('/organizations/bulk_enrich', { domains });
        logResponse(response.status, response.data);
        
        return res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        logError(error);
        return res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to bulk enrich organizations',
            message: error.response?.data?.error || error.message
        });
    }
});

export {
    testApiKey,
    searchOrganizations,
    searchPeople,
    enrichOrganization,
    verifyEmail,
    enrichPerson,
    getPersonById,
    getContactInfo,
    getAccountInfo,
    createSequence,
    getSequenceDetails,
    bulkEnrichOrganizations,
    getAuthorizationUrl,
    handleCallback,
    refreshAccessToken,
    revokeAccessToken,
    validateAccessToken
};
