import axios from 'axios';
import dotenv from 'dotenv';
import config from '../config/freshsalesConfig.js';
import crypto from 'crypto'; 


dotenv.config();

// // OAuth2 configuration
// const FRESHSALES_AUTH_URL = 'https://app.freshsales.io/oauth/authorize';
// const FRESHSALES_TOKEN_URL = 'https://app.freshsales.io/oauth/token';
// const FRESHSALES_API_BASE_URL = 'https://api.freshsales.io/api';

// // Helper function to handle API errors with detailed logging
// const handleApiError = (error, context) => {
//     console.error(`[FreshSales Error] Context: ${context}`);
//     console.error('Error Details:', {
//         message: error.message,
//         status: error.response?.status,
//         statusText: error.response?.statusText,
//         data: error.response?.data,
//         headers: error.response?.headers
//     });

//     if (error.response) {
//         const errorMessage = error.response.data?.message || error.message;
//         throw new Error(`FreshSales API Error: ${errorMessage}`);
//     }
//     throw error;
// };

// // Helper function to create headers with authentication
// const getAuthHeaders = (accessToken) => ({
//     'Authorization': `Token token=${accessToken}`,
//     'Content-Type': 'application/json'
// });

// // OAuth Functions
// export const getAuthUrl = async (req, res) => {
//     try {
//         console.log('[FreshSales Auth] Generating authorization URL');
//         console.log('Environment Variables:', {
//             clientId: process.env.FRESHSALES_CLIENT_ID,
//             redirectUri: process.env.FRESHSALES_REDIRECT_URI
//         });

//         // Generate a secure random state
//         const state = Buffer.from(Math.random().toString()).toString('base64');
        
//         // Store state in session or database for validation
//         req.session.freshsalesState = state;

//         const authParams = new URLSearchParams({
//             client_id: process.env.FRESHSALES_CLIENT_ID,
//             redirect_uri: process.env.FRESHSALES_REDIRECT_URI,
//             response_type: 'code',
//             scope: 'contacts deals companies tasks appointments',
//             state: state
//         });

//         const authUrl = `${FRESHSALES_AUTH_URL}?${authParams.toString()}`;
        
//         console.log('[FreshSales Auth] Generated URL:', authUrl);
        
//         res.json({ authUrl });
//     } catch (error) {
//         console.error('[FreshSales Auth] Error generating auth URL:', error);
//         res.status(500).json({ 
//             error: error.message,
//             details: 'Failed to generate authorization URL',
//             context: 'getAuthUrl'
//         });
//     }
// };

// export const handleOAuthCallback = async (req, res) => {
//     try {
//         console.log('[FreshSales Auth] Handling OAuth callback');
//         console.log('Callback Query Parameters:', req.query);

//         const { code, state, error: oauthError } = req.query;

//         // Check for OAuth errors
//         if (oauthError) {
//             console.error('[FreshSales Auth] OAuth error received:', oauthError);
//             return res.status(400).json({
//                 error: 'OAuth Error',
//                 message: oauthError,
//                 details: 'Authorization was denied or failed'
//             });
//         }

//         // Validate state parameter
//         if (!state || state !== req.session.freshsalesState) {
//             console.error('[FreshSales Auth] State validation failed:', {
//                 received: state,
//                 expected: req.session.freshsalesState
//             });
//             return res.status(400).json({
//                 error: 'Invalid State',
//                 message: 'State parameter validation failed'
//             });
//         }

//         // Validate authorization code
//         if (!code) {
//             console.error('[FreshSales Auth] Missing authorization code');
//             return res.status(400).json({
//                 error: 'Authorization Error',
//                 message: 'Authorization code is missing'
//             });
//         }

//         console.log('[FreshSales Auth] Exchanging code for tokens');
        
//         const tokenResponse = await axios.post(FRESHSALES_TOKEN_URL, {
//             client_id: process.env.FRESHSALES_CLIENT_ID,
//             client_secret: process.env.FRESHSALES_CLIENT_SECRET,
//             redirect_uri: process.env.FRESHSALES_REDIRECT_URI,
//             grant_type: 'authorization_code',
//             code
//         }, {
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Accept': 'application/json'
//             }
//         });

//         console.log('[FreshSales Auth] Token response received:', {
//             status: tokenResponse.status,
//             statusText: tokenResponse.statusText
//         });

//         const { access_token, refresh_token, expires_in, token_type } = tokenResponse.data;

//         // Store tokens securely (implement your storage solution)
//         // For example, store in database associated with user
//         console.log('[FreshSales Auth] Tokens received successfully');

//         // Clear the state from session
//         delete req.session.freshsalesState;

//         res.json({ 
//             message: 'Authentication successful',
//             access_token,
//             refresh_token,
//             expires_in,
//             token_type
//         });
//     } catch (error) {
//         console.error('[FreshSales Auth] Error in callback handler:', error);
//         handleApiError(error, 'handleOAuthCallback');
//         res.status(500).json({ 
//             error: error.message,
//             details: 'Failed to complete OAuth authentication',
//             context: 'handleOAuthCallback'
//         });
//     }
// };

/////====another configuration====/////

// freshsalesAuthController.js


// freshsalesAuthController.js


// Helper function for detailed logging
const logStep = (step, data = {}) => {
  console.log(`[FreshSales OAuth] ${step}`, {
    timestamp: new Date().toISOString(),
    ...data
  });
};

// Helper function for error logging
const logError = (step, error, context = {}) => {
  console.error(`[FreshSales OAuth] Error in ${step}:`, {
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    response: error.response?.data,
    status: error.response?.status,
    ...context
  });
};

const validateClientId = (clientId) => {
  if (!clientId) return false;
  return clientId.startsWith('fw_ext_');
};

export const getAuthUrl = async (req, res) => {
  try {
    logStep('Starting auth URL generation', { 
      query: req.query,
      headers: req.headers,
      session: req.session ? 'exists' : 'missing'
    });

    const { platform = 'web' } = req.query;

    if (!req.session) {
      logError('getAuthUrl', new Error('Session not available'));
      return res.status(500).json({
        status: false,
        message: 'Session support is required for OAuth',
        error: 'SESSION_REQUIRED'
      });
    }

    // Generate and store state
    const state = crypto.randomBytes(32).toString('hex');
    req.session.oauthState = state;
    logStep('Generated OAuth state', { state });

    const { clientId, redirectUri, authorizationUrl, scopes } = config.freshsales;

    // Validate client ID
    if (!validateClientId(clientId)) {
      logError('getAuthUrl', new Error('Invalid client ID format'));
      return res.status(400).json({
        status: false,
        message: 'Invalid client ID format. Should start with fw_ext_',
        error: 'INVALID_CLIENT_ID'
      });
    }

    // Log all configuration values
    logStep('OAuth Configuration', {
      clientId,
      redirectUri,
      authorizationUrl,
      scopes,
      platform
    });

    // Validate required configuration
    if (!clientId || !redirectUri || !authorizationUrl) {
      logError('getAuthUrl', new Error('Missing configuration'), {
        clientId: !!clientId,
        redirectUri: !!redirectUri,
        authorizationUrl: !!authorizationUrl
      });
      return res.status(500).json({
        status: false,
        message: 'OAuth configuration is incomplete',
        error: 'INVALID_CONFIG'
      });
    }

    // Construct authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      state: state
    });

    const authUrl = `${authorizationUrl}?${params.toString()}`;
    logStep('Generated auth URL', { 
      authUrl,
      params: Object.fromEntries(params)
    });

    if (platform === 'web') {
      logStep('Redirecting to auth URL');
      return res.redirect(authUrl);
    }

    return res.json({
      status: true,
      authUrl,
      state
    });

  } catch (error) {
    logError('getAuthUrl', error);
    return res.status(500).json({
      status: false,
      message: 'Failed to generate authorization URL',
      error: error.message
    });
  }
};

export const handleOAuthCallback = async (req, res) => {
  try {
    logStep('Starting OAuth callback handling', { 
      query: req.query,
      headers: req.headers,
      session: req.session ? 'exists' : 'missing'
    });

    const { code, state: receivedState, error: oauthError } = req.query;

    // Check for OAuth errors
    if (oauthError) {
      logError('handleOAuthCallback', new Error(oauthError), { oauthError });
      return res.status(400).json({
        status: false,
        message: `OAuth error: ${oauthError}`,
        error: oauthError
      });
    }

    // Validate session and state
    if (!req.session?.oauthState) {
      logError('handleOAuthCallback', new Error('Session state missing'));
      return res.status(400).json({
        status: false,
        message: 'Invalid session state',
        error: 'INVALID_SESSION'
      });
    }

    const expectedState = req.session.oauthState;
    delete req.session.oauthState;

    if (!receivedState || receivedState !== expectedState) {
      logError('handleOAuthCallback', new Error('State mismatch'), {
        received: receivedState,
        expected: expectedState
      });
      return res.status(400).json({
        status: false,
        message: 'Invalid state parameter',
        error: 'INVALID_STATE'
      });
    }

    // Validate authorization code
    if (!code) {
      logError('handleOAuthCallback', new Error('Missing authorization code'));
      return res.status(400).json({
        status: false,
        message: 'Authorization code is required',
        error: 'MISSING_CODE'
      });
    }

    const { clientId, clientSecret, redirectUri, tokenUrl } = config.freshsales;

    // Validate client ID
    if (!validateClientId(clientId)) {
      logError('handleOAuthCallback', new Error('Invalid client ID format'));
      return res.status(400).json({
        status: false,
        message: 'Invalid client ID format. Should start with fw_ext_',
        error: 'INVALID_CLIENT_ID'
      });
    }

    // Log token exchange configuration
    logStep('Token exchange configuration', {
      clientId,
      redirectUri,
      tokenUrl,
      hasClientSecret: !!clientSecret
    });

    // Validate token exchange configuration
    if (!clientId || !clientSecret || !redirectUri || !tokenUrl) {
      logError('handleOAuthCallback', new Error('Missing token exchange configuration'));
      return res.status(500).json({
        status: false,
        message: 'Token exchange configuration is incomplete',
        error: 'INVALID_CONFIG'
      });
    }

    logStep('Exchanging code for tokens', { 
      code,
      clientId,
      redirectUri,
      tokenUrl
    });

    // Exchange code for tokens
   // In handleOAuthCallback
const tokenParams = new URLSearchParams();
tokenParams.append('grant_type', 'authorization_code');
tokenParams.append('client_id', clientId);
tokenParams.append('client_secret', clientSecret);
tokenParams.append('code', code);
tokenParams.append('redirect_uri', redirectUri);

const tokenResponse = await axios.post(
  `${freshworksDomain}/oauth/token`, // Explicit URL
  tokenParams.toString(),
  {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    }
  }
);
    // Check for error response
    if (tokenResponse.data?.error) {
      logError('handleOAuthCallback', new Error(tokenResponse.data.error), {
        error: tokenResponse.data.error,
        description: tokenResponse.data.error_description,
        response: tokenResponse.data
      });

      if (tokenResponse.data.error === 'invalid_id') {
        return res.status(400).json({
          status: false,
          message: 'Invalid client ID. Please verify your FreshSales app configuration.',
          error: 'INVALID_CLIENT_ID',
          details: {
            clientId,
            redirectUri,
            error: tokenResponse.data.error,
            description: tokenResponse.data.error_description
          }
        });
      }

      return res.status(400).json({
        status: false,
        message: tokenResponse.data.error_description || 'Token exchange failed',
        error: tokenResponse.data.error,
        details: tokenResponse.data
      });
    }

    logStep('Token exchange successful', {
      status: tokenResponse.status,
      hasAccessToken: !!tokenResponse.data?.access_token
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Return tokens based on platform
    if (req.query.platform === 'web') {
      const { frontendUrl } = config;
      const redirectParams = new URLSearchParams({
        access_token,
        refresh_token,
        expires_in,
        token_type: 'Bearer',
        status: 'success'
      });

      const redirectUrl = `${frontendUrl}?${redirectParams.toString()}`;
      logStep('Redirecting to frontend', { 
        redirectUrl,
        frontendUrl,
        params: Object.fromEntries(redirectParams)
      });
      return res.redirect(redirectUrl);
    }

    return res.json({
      status: true,
      data: {
        access_token,
        refresh_token,
        expires_in,
        token_type: 'Bearer'
      }
    });

  } catch (error) {
    logError('handleOAuthCallback', error);
    
    // Handle specific error cases
    if (error.response?.data?.error === 'invalid_id' || error.response?.data?.error === 'client does not exist') {
      return res.status(400).json({
        status: false,
        message: 'Invalid client ID or client does not exist. Please verify your FreshSales app configuration.',
        error: 'INVALID_CLIENT',
        details: error.response.data
      });
    }

    return res.status(500).json({
      status: false,
      message: 'Failed to complete OAuth process',
      error: error.message
    });
  }
};

export const refreshToken = async (req, res) => {
  try {
    logStep('Starting token refresh', { body: req.body });

    const { refresh_token } = req.body;

    if (!refresh_token) {
      logError('refreshToken', new Error('Missing refresh token'));
      return res.status(400).json({
        status: false,
        message: 'Refresh token is required',
        error: 'MISSING_REFRESH_TOKEN'
      });
    }

    const { clientId, clientSecret, tokenUrl } = config.freshsales;

    logStep('Requesting new tokens', { clientId });

    const response = await axios.post(tokenUrl, {
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    logStep('Token refresh successful', {
      status: response.status,
      hasAccessToken: !!response.data?.access_token
    });

    return res.json({
      status: true,
      data: response.data
    });

  } catch (error) {
    logError('refreshToken', error);
    return res.status(500).json({
      status: false,
      message: 'Failed to refresh token',
      error: error.message
    });
  }
};

// Contact Functions
export const createContact = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const response = await axios.post(
            `${FRESHSALES_API_BASE_URL}/contacts`,
            req.body,
            { headers: getAuthHeaders(accessToken) }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'createContact');
    }
};

export const getContacts = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { page = 1, per_page = 20 } = req.query;
        
        const response = await axios.get(
            `${FRESHSALES_API_BASE_URL}/contacts`,
            {
                headers: getAuthHeaders(accessToken),
                params: { page, per_page }
            }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'getContacts');
    }
};

export const getContactById = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { id } = req.params;
        
        const response = await axios.get(
            `${FRESHSALES_API_BASE_URL}/contacts/${id}`,
            { headers: getAuthHeaders(accessToken) }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'getContactById');
    }
};

export const updateContact = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { id } = req.params;
        
        const response = await axios.put(
            `${FRESHSALES_API_BASE_URL}/contacts/${id}`,
            req.body,
            { headers: getAuthHeaders(accessToken) }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'updateContact');
    }
};

export const deleteContact = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { id } = req.params;
        
        await axios.delete(
            `${FRESHSALES_API_BASE_URL}/contacts/${id}`,
            { headers: getAuthHeaders(accessToken) }
        );
        res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
        handleApiError(error, 'deleteContact');
    }
};

// Deal Functions
export const createDeal = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const response = await axios.post(
            `${FRESHSALES_API_BASE_URL}/deals`,
            req.body,
            { headers: getAuthHeaders(accessToken) }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'createDeal');
    }
};

export const getDeals = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { page = 1, per_page = 20 } = req.query;
        
        const response = await axios.get(
            `${FRESHSALES_API_BASE_URL}/deals`,
            {
                headers: getAuthHeaders(accessToken),
                params: { page, per_page }
            }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'getDeals');
    }
};

export const getDealById = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { id } = req.params;
        
        const response = await axios.get(
            `${FRESHSALES_API_BASE_URL}/deals/${id}`,
            { headers: getAuthHeaders(accessToken) }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'getDealById');
    }
};

export const updateDeal = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { id } = req.params;
        
        const response = await axios.put(
            `${FRESHSALES_API_BASE_URL}/deals/${id}`,
            req.body,
            { headers: getAuthHeaders(accessToken) }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'updateDeal');
    }
};

export const deleteDeal = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { id } = req.params;
        
        await axios.delete(
            `${FRESHSALES_API_BASE_URL}/deals/${id}`,
            { headers: getAuthHeaders(accessToken) }
        );
        res.json({ message: 'Deal deleted successfully' });
    } catch (error) {
        handleApiError(error, 'deleteDeal');
    }
};

// Company Functions
export const createCompany = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const response = await axios.post(
            `${FRESHSALES_API_BASE_URL}/companies`,
            req.body,
            { headers: getAuthHeaders(accessToken) }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'createCompany');
    }
};

export const getCompanies = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { page = 1, per_page = 20 } = req.query;
        
        const response = await axios.get(
            `${FRESHSALES_API_BASE_URL}/companies`,
            {
                headers: getAuthHeaders(accessToken),
                params: { page, per_page }
            }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'getCompanies');
    }
};

export const getCompanyById = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { id } = req.params;
        
        const response = await axios.get(
            `${FRESHSALES_API_BASE_URL}/companies/${id}`,
            { headers: getAuthHeaders(accessToken) }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'getCompanyById');
    }
};

export const updateCompany = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { id } = req.params;
        
        const response = await axios.put(
            `${FRESHSALES_API_BASE_URL}/companies/${id}`,
            req.body,
            { headers: getAuthHeaders(accessToken) }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'updateCompany');
    }
};

export const deleteCompany = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { id } = req.params;
        
        await axios.delete(
            `${FRESHSALES_API_BASE_URL}/companies/${id}`,
            { headers: getAuthHeaders(accessToken) }
        );
        res.json({ message: 'Company deleted successfully' });
    } catch (error) {
        handleApiError(error, 'deleteCompany');
    }
};

// Task Functions
export const createTask = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const response = await axios.post(
            `${FRESHSALES_API_BASE_URL}/tasks`,
            req.body,
            { headers: getAuthHeaders(accessToken) }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'createTask');
    }
};

export const getTasks = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { page = 1, per_page = 20 } = req.query;
        
        const response = await axios.get(
            `${FRESHSALES_API_BASE_URL}/tasks`,
            {
                headers: getAuthHeaders(accessToken),
                params: { page, per_page }
            }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'getTasks');
    }
};

// Appointment Functions
export const createAppointment = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const response = await axios.post(
            `${FRESHSALES_API_BASE_URL}/appointments`,
            req.body,
            { headers: getAuthHeaders(accessToken) }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'createAppointment');
    }
};

export const getAppointments = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { page = 1, per_page = 20 } = req.query;
        
        const response = await axios.get(
            `${FRESHSALES_API_BASE_URL}/appointments`,
            {
                headers: getAuthHeaders(accessToken),
                params: { page, per_page }
            }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'getAppointments');
    }
};

// Search Functions
export const searchContacts = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { query, page = 1, per_page = 20 } = req.query;
        
        const response = await axios.get(
            `${FRESHSALES_API_BASE_URL}/search/contacts`,
            {
                headers: getAuthHeaders(accessToken),
                params: { q: query, page, per_page }
            }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'searchContacts');
    }
};

export const searchDeals = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { query, page = 1, per_page = 20 } = req.query;
        
        const response = await axios.get(
            `${FRESHSALES_API_BASE_URL}/search/deals`,
            {
                headers: getAuthHeaders(accessToken),
                params: { q: query, page, per_page }
            }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'searchDeals');
    }
};

export const searchCompanies = async (req, res) => {
    try {
        const { accessToken } = req.user;
        const { query, page = 1, per_page = 20 } = req.query;
        
        const response = await axios.get(
            `${FRESHSALES_API_BASE_URL}/search/companies`,
            {
                headers: getAuthHeaders(accessToken),
                params: { q: query, page, per_page }
            }
        );
        res.json(response.data);
    } catch (error) {
        handleApiError(error, 'searchCompanies');
    }
};
