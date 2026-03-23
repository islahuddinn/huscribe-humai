import { refreshAccessToken, revokeAccessToken } from '../utils/zohoUtils.js';
import axios from 'axios';
import 'dotenv/config';

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REDIRECT_URI = process.env.ZOHO_REDIRECT_URI;
const ZOHO_ACCOUNTS_URL = process.env.ZOHO_ACCOUNTS_URL;
const FRONTEND_URL = process.env.ZOHO_FRONTEND_URL;

// Get Authorization URL
export const getAuthUrl = (req, res) => {
  try {
    const { platform } = req.query;
    
    // Store the complete redirect URI - important for later token exchange
    let redirectUri = ZOHO_REDIRECT_URI;
    
    // Don't add platform to the redirect URI - keep it consistent
    console.log('Using redirect URI:', redirectUri);
    console.log('ZOHO_CLIENT_ID:', ZOHO_CLIENT_ID);
    console.log('ZOHO_ACCOUNTS_URL:', ZOHO_ACCOUNTS_URL);

    // --- Update: Include all required scopes for CRM operations ---
    const scopes = [
      'ZohoCRM.modules.ALL',
      'ZohoCRM.settings.ALL',
      'ZohoCRM.users.ALL',
      'ZohoCRM.org.ALL',
      'ZohoCRM.bulk.ALL',
      'ZohoCRM.notifications.ALL',
      'ZohoCRM.files.CREATE',
      'ZohoCRM.files.READ',
      'ZohoCRM.coql.READ',
      'ZohoMail.accounts.READ',
      'ZohoMail.messages.ALL',
      
    ].join(',');
    const encodedScopes = encodeURIComponent(scopes);
    
    const authUrl = `${ZOHO_ACCOUNTS_URL}/oauth/v2/auth?response_type=code&client_id=${ZOHO_CLIENT_ID}&scope=${encodedScopes}&access_type=offline&redirect_uri=${encodeURIComponent(redirectUri)}&state=${platform || 'default'}`;
    
    console.log('Generated auth URL:', authUrl);
    
    // res.json({
    //   status: true,
    //   crmType: 'zoho',
    //   authUrl,
    //   requestedScopes: scopes.split(','),
    //   scopeCount: scopes.split(',').length
    // });
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error in getAuthUrl:', error.message);
    res.status(500).json({
      status: false,
      crmType: 'zoho',
      error: error.message
    });
  }
};

// Handle OAuth Callback
export const handleOAuthCallback = async (req, res) => {
  try {
    const { code, state } = req.query;  // Use state instead of platform
    const platform = state || 'default'; // Safely extract platform from state parameter

    if (!code) {
      throw new Error('Authorization code is required');
    }

    console.log('Received authorization code:', code);
    console.log('Platform:', platform);
    console.log('ZOHO_REDIRECT_URI:', ZOHO_REDIRECT_URI);
    console.log('FRONTEND_URL:', FRONTEND_URL);

    const tokenUrl = `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`;
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', ZOHO_CLIENT_ID);
    params.append('client_secret', ZOHO_CLIENT_SECRET);
    params.append('redirect_uri', ZOHO_REDIRECT_URI); // Use the exact same redirect URI as in auth request
    params.append('code', code);

    console.log('Making token request to:', tokenUrl);
    console.log('With params:', Object.fromEntries(params));

    try {
      const response = await axios.post(tokenUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      // Extract tokens from response
      const accessToken = response.data?.access_token;
      const refreshToken = response.data?.refresh_token;
      const expiresIn = response.data?.expires_in;
      
      console.log(accessToken, refreshToken, expiresIn, "Here are the tokens=============");
      // Fetch current user info from Zoho CRM
const userInfoResponse = await axios.get('https://www.zohoapis.com/crm/v2/users?type=CurrentUser', {
  headers: {
    Authorization: `Zoho-oauthtoken ${accessToken}`
  }
});

const currentUser = userInfoResponse.data?.users?.[0];

const userEmail = currentUser?.email || null;
const userFullName = currentUser?.full_name || `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim();
const userName = currentUser?.user_name || currentUser?.email;

console.log(currentUser, "Zoho=============");

      // If platform is web, redirect to frontend with tokens
      if (platform === 'web') {
        const frontendUrl = `${FRONTEND_URL}?access_token=${accessToken}&refresh_token=${refreshToken}&expires_in=${expiresIn}&issued_at=${Date.now()}&email=${userEmail}&fullName=${userFullName}&username=${userName}`;
        console.log(frontendUrl, "Here is the front end url=============");
        return res.redirect(frontendUrl);
      } else {
        return res.json({
          status: true,
          crmType: 'zoho',
          accessToken: accessToken,
          refreshToken: refreshToken,
          expiresIn: expiresIn,
          email: userEmail,
          fullName: userFullName,
          username: userName
        });
      }
    } catch (error) {
      console.error('Zoho API error:', error.message);
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in handleOAuthCallback:', error.message);
    
    // Return error as JSON for all platforms
    return res.status(500).json({
      status: false,
      crmType: 'zoho',
      error: error.response?.data?.error || error.message
    });
  }
};

// Generate Access Token
export const getAccessToken = async (req, res) => {
  try {
    // Verify environment variables
    if (!ZOHO_ACCOUNTS_URL) {
      console.error('ZOHO_ACCOUNTS_URL environment variable is not set');
      return res.status(500).json({
        status: false,
        crmType: "zoho",
        error: 'Server configuration error: Missing ZOHO_ACCOUNTS_URL'
      });
    }
    
    if (!ZOHO_CLIENT_ID) {
      console.error('ZOHO_CLIENT_ID environment variable is not set');
      return res.status(500).json({
        status: false,
        crmType: "zoho",
        error: 'Server configuration error: Missing ZOHO_CLIENT_ID'
      });
    }
    
    if (!ZOHO_CLIENT_SECRET) {
      return res.status(500).json({
        status: false,
        crmType: "zoho",
        error: 'Server configuration error: Missing ZOHO_CLIENT_SECRET'
      });
    }
    
    // Check for Content-Type and parse body if necessary
    if (req.method === 'POST' && req.headers['content-type'] === 'application/x-www-form-urlencoded' && !req.body) {
      console.warn('Request has form-urlencoded content type but no parsed body. Ensure body-parser middleware is configured.');
    }
    
    // Get refresh token from multiple possible sources
    const refreshToken = req.query.refreshToken || 
                         req.query.refresh_token || 
                         (req.body && (req.body.refreshToken || req.body.refresh_token)) || 
                         req.headers['x-refresh-token'];
    
    console.log('Extracted refresh token:', refreshToken ? `${refreshToken.substring(0, 5)}...` : 'Not found');
    
    if (!refreshToken) {
      return res.status(400).json({ 
        status: false, 
        crmType: "zoho", 
        error: 'Refresh token is required. Please provide it in query parameters, request body, or x-refresh-token header' 
      });
    }

    console.log('Refreshing access token using Zoho URL:', ZOHO_ACCOUNTS_URL);
    
    // Call utility function to refresh the token
    const tokenData = await refreshAccessToken(refreshToken);
    
    console.log('Token refresh successful');
    
    // Return the new access token
    res.json({ 
      status: true, 
      crmType: "zoho",
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in
    });
  } catch (error) {
    console.error('Error in getAccessToken:', error.message);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', JSON.stringify(error.response.data));
    }
    
    // Create a more user-friendly error message
    let errorMessage = error.message;
    let errorDetails = error.message;
    
    if (error.message.includes('invalid_client')) {
      errorMessage = 'Invalid client credentials. Please check your Zoho client ID and client secret.';
    } else if (error.message.includes('invalid_grant') || error.message.includes('invalid or expired')) {
      errorMessage = 'Invalid or expired refresh token. Please obtain a new refresh token.';
    } else if (error.message.includes('invalid_code')) {
      errorMessage = 'The refresh token is invalid or has expired. You need to get a new refresh token.';
      errorDetails = 'To get a new token, redirect the user to the authorization URL: GET /api/zoho/auth/url?platform=web';
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      errorMessage = 'Could not connect to Zoho servers. Please check your ZOHO_ACCOUNTS_URL configuration.';
    }
    
    res.status(400).json({ 
      status: false, 
      crmType: "zoho", 
      error: errorMessage,
      details: errorDetails,
      solution: 'To get a new refresh token, use the OAuth flow: GET /api/zoho/auth/url?platform=web'
    });
  }
};

// New dedicated endpoint for refreshing tokens - better for live servers
export const refreshToken = async (req, res) => {
  try {
    console.log('=== Starting token refresh process ===');
    
    // Enhanced validation
    const requiredEnvVars = {
      ZOHO_ACCOUNTS_URL,
      ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET
    };
    
    for (const [key, value] of Object.entries(requiredEnvVars)) {
      if (!value) {
        console.error(`${key} environment variable is not set`);
        return res.status(500).json({
          status: false,
          crmType: "zoho",
          error: `Server configuration error: Missing ${key}`,
          code: 'MISSING_ENV_VAR'
        });
      }
    }
    
    // Get refresh token from multiple sources with priority
    const refreshToken = req.body.refresh_token || 
                         req.body.refreshToken || 
                         req.query.refresh_token || 
                         req.query.refreshToken || 
                         req.headers['x-zoho-refresh-token'] ||
                         req.headers['x-refresh-token'];
    
    if (!refreshToken) {
      return res.status(400).json({ 
        status: false, 
        crmType: "zoho", 
        error: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN',
        acceptedFormats: [
          'Body: { "refresh_token": "token" }',
          'Body: { "refreshToken": "token" }',
          'Query: ?refresh_token=token',
          'Header: x-zoho-refresh-token: token'
        ]
      });
    }

    console.log('Refresh token found:', refreshToken.substring(0, 10) + '...');
    
    // Prepare token refresh request
    const tokenUrl = `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`;
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      refresh_token: refreshToken
    });

    console.log('Making token refresh request to:', tokenUrl);
    
    // Make the refresh request with enhanced error handling
    const response = await axios.post(tokenUrl, params, {
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'Huscribe-Backend/1.0'
      },
      timeout: 30000, // 30 second timeout
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });
    
    console.log('Token refresh response status:', response.status);
    
    // Handle different response scenarios
    if (response.status === 200 && response.data.access_token) {
      console.log('Token refresh successful');
      
      // Validate the new token by making a test API call
      try {
        const testResponse = await axios.get('https://www.zohoapis.com/crm/v2/settings/modules', {
          headers: {
            'Authorization': `Zoho-oauthtoken ${response.data.access_token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        console.log('Token validation successful');
        
        return res.json({ 
          status: true, 
          crmType: "zoho",
          access_token: response.data.access_token,
          token_type: response.data.token_type || 'Bearer',
          expires_in: response.data.expires_in,
          scope: response.data.scope,
          api_domain: response.data.api_domain,
          validated: true,
          timestamp: new Date().toISOString()
        });
        
      } catch (validationError) {
        console.warn('Token validation failed:', validationError.message);
        
        // Still return the token even if validation fails
        return res.json({ 
          status: true, 
          crmType: "zoho",
          access_token: response.data.access_token,
          token_type: response.data.token_type || 'Bearer',
          expires_in: response.data.expires_in,
          scope: response.data.scope,
          api_domain: response.data.api_domain,
          validated: false,
          validation_warning: 'Token received but validation failed',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Handle error responses
    if (response.data && response.data.error) {
      console.error('Zoho API error:', response.data);
      
      const errorMap = {
        'invalid_client': {
          message: 'Invalid client credentials. Check your ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET.',
          code: 'INVALID_CLIENT_CREDENTIALS',
          status: 401
        },
        'invalid_grant': {
          message: 'Invalid or expired refresh token. Please re-authenticate the user.',
          code: 'INVALID_REFRESH_TOKEN',
          status: 401
        },
        'invalid_request': {
          message: 'Invalid request format or missing parameters.',
          code: 'INVALID_REQUEST',
          status: 400
        },
        'unsupported_grant_type': {
          message: 'Unsupported grant type. Use "refresh_token".',
          code: 'UNSUPPORTED_GRANT_TYPE',
          status: 400
        }
      };
      
      const errorInfo = errorMap[response.data.error] || {
        message: `Zoho API error: ${response.data.error}`,
        code: 'UNKNOWN_ERROR',
        status: 400
      };
      
      return res.status(errorInfo.status).json({
        status: false,
        crmType: "zoho",
        error: errorInfo.message,
        code: errorInfo.code,
        zoho_error: response.data.error,
        error_description: response.data.error_description,
        solution: errorInfo.code === 'INVALID_REFRESH_TOKEN' 
          ? 'Re-authenticate the user: GET /api/zoho/auth/url?platform=web'
          : 'Check your Zoho API configuration'
      });
    }
    
    // Handle unexpected response format
    return res.status(500).json({
      status: false,
      crmType: "zoho",
      error: 'Unexpected response format from Zoho API',
      code: 'UNEXPECTED_RESPONSE',
      response_status: response.status,
      response_data: response.data
    });
    
  } catch (error) {
    console.error('Error in refreshToken:', error.message);
    
    // Enhanced error handling for different error types
    if (error.code === 'ENOTFOUND') {
      return res.status(500).json({
        status: false,
        crmType: "zoho",
        error: 'Cannot connect to Zoho servers. Check your ZOHO_ACCOUNTS_URL configuration.',
        code: 'CONNECTION_ERROR',
        details: error.message
      });
    }
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(500).json({
        status: false,
        crmType: "zoho",
        error: 'Connection refused by Zoho servers.',
        code: 'CONNECTION_REFUSED',
        details: error.message
      });
    }
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(500).json({
        status: false,
        crmType: "zoho",
        error: 'Request timeout. Zoho servers may be slow or unavailable.',
        code: 'TIMEOUT_ERROR',
        details: error.message
      });
    }
    
    if (error.response) {
      console.error('HTTP Error Response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
      
      return res.status(error.response.status).json({
        status: false,
        crmType: "zoho",
        error: 'HTTP error from Zoho API',
        code: 'HTTP_ERROR',
        http_status: error.response.status,
        details: error.response.data
      });
    }
    
    // Generic error fallback
    return res.status(500).json({
      status: false,
      crmType: "zoho",
      error: 'Unexpected error during token refresh',
      code: 'UNEXPECTED_ERROR',
      details: error.message
    });
  }
};

// Validate current access token
export const validateToken = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({
        status: false,
        crmType: "zoho",
        error: 'Access token is required in Authorization header',
        code: 'MISSING_ACCESS_TOKEN'
      });
    }
    
    const accessToken = authHeader.split(' ')[1];
    
    // Test the token by calling Zoho API
    const response = await axios.get('https://www.zohoapis.com/crm/v2/settings/modules', {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    return res.json({
      status: true,
      crmType: "zoho",
      valid: true,
      message: 'Token is valid',
      modules_count: response.data.modules?.length || 0,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Token validation error:', error.message);
    
    if (error.response?.status === 401) {
      return res.status(401).json({
        status: false,
        crmType: "zoho",
        valid: false,
        error: 'Token is invalid or expired',
        code: 'INVALID_TOKEN',
        solution: 'Use POST /api/zoho/auth/refresh to get a new token'
      });
    }
    
    return res.status(500).json({
      status: false,
      crmType: "zoho",
      valid: false,
      error: 'Token validation failed',
      code: 'VALIDATION_ERROR',
      details: error.message
    });
  }
};

// Revoke Access Token
export const revokeToken = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      throw new Error('Access token is required');
    }

    const response = await revokeAccessToken(accessToken);

    res.json({
      status: true,
      crmType: 'zoho',
      data: response,
    });
  } catch (error) {
    console.error('Error in revokeToken:', error.message);
    res.status(500).json({
      status: false,
      crmType: 'zoho',
      error: error.message,
    });
  }
};

// Diagnostic endpoint to troubleshoot authentication issues
export const diagnostics = async (req, res) => {
  try {
    console.log('=== Zoho Authentication Diagnostics ===');
    
    const diagnosticData = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        ZOHO_ACCOUNTS_URL: ZOHO_ACCOUNTS_URL ? 'Set' : 'Missing',
        ZOHO_CLIENT_ID: ZOHO_CLIENT_ID ? `${ZOHO_CLIENT_ID.substring(0, 5)}...` : 'Missing',
        ZOHO_CLIENT_SECRET: ZOHO_CLIENT_SECRET ? 'Set (hidden)' : 'Missing',
        ZOHO_REDIRECT_URI: ZOHO_REDIRECT_URI || 'Missing'
      },
      request_headers: {
        authorization: req.headers.authorization ? 'Present' : 'Missing',
        'x-zoho-refresh-token': req.headers['x-zoho-refresh-token'] ? 'Present' : 'Missing',
        'x-refresh-token': req.headers['x-refresh-token'] ? 'Present' : 'Missing',
        'content-type': req.headers['content-type'] || 'Not set',
        'user-agent': req.headers['user-agent'] || 'Not set'
      },
      tests: []
    };
    
    // Test 1: Environment Configuration
    let envTest = {
      name: 'Environment Configuration',
      status: 'pass',
      details: []
    };
    
    const requiredEnvVars = ['ZOHO_ACCOUNTS_URL', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        envTest.status = 'fail';
        envTest.details.push(`Missing ${envVar}`);
      } else {
        envTest.details.push(`${envVar} is set`);
      }
    }
    diagnosticData.tests.push(envTest);
    
    // Test 2: Zoho Connectivity
    let connectivityTest = {
      name: 'Zoho Server Connectivity',
      status: 'pass',
      details: []
    };
    
    try {
      const connectivityResponse = await axios.get(`${ZOHO_ACCOUNTS_URL}/oauth/v2/auth`, {
        timeout: 10000,
        validateStatus: () => true // Don't throw on any status
      });
      
      connectivityTest.details.push(`Connection successful (Status: ${connectivityResponse.status})`);
      
      if (connectivityResponse.status >= 400) {
        connectivityTest.details.push('Server responded with error status but connection is working');
      }
    } catch (connectError) {
      connectivityTest.status = 'fail';
      connectivityTest.details.push(`Connection failed: ${connectError.message}`);
      
      if (connectError.code === 'ENOTFOUND') {
        connectivityTest.details.push('DNS resolution failed - check ZOHO_ACCOUNTS_URL');
      } else if (connectError.code === 'ECONNREFUSED') {
        connectivityTest.details.push('Connection refused - Zoho servers may be down');
      } else if (connectError.code === 'ECONNABORTED') {
        connectivityTest.details.push('Connection timeout - network or server issues');
      }
    }
    diagnosticData.tests.push(connectivityTest);
    
    // Test 3: Access Token Validation (if provided)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.split(' ')[1];
      
      let tokenTest = {
        name: 'Access Token Validation',
        status: 'pass',
        details: []
      };
      
      try {
        const tokenResponse = await axios.get('https://www.zohoapis.com/crm/v2/settings/modules', {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        tokenTest.details.push('Access token is valid');
        tokenTest.details.push(`Available modules: ${tokenResponse.data.modules?.length || 0}`);
        
        // Check token scopes
        const moduleNames = tokenResponse.data.modules?.map(m => m.module_name) || [];
        const hasRequiredModules = ['Leads', 'Contacts', 'Accounts'].every(module => 
          moduleNames.includes(module)
        );
        
        if (hasRequiredModules) {
          tokenTest.details.push('Token has access to required modules');
        } else {
          tokenTest.status = 'warning';
          tokenTest.details.push('Token may have limited module access');
        }
        
      } catch (tokenError) {
        tokenTest.status = 'fail';
        
        if (tokenError.response?.status === 401) {
          tokenTest.details.push('Access token is invalid or expired');
          
          if (tokenError.response.data?.code === 'OAUTH_SCOPE_MISMATCH') {
            tokenTest.details.push('Token scope mismatch - insufficient permissions');
          }
        } else {
          tokenTest.details.push(`Token validation failed: ${tokenError.message}`);
        }
      }
      
      diagnosticData.tests.push(tokenTest);
    }
    
    // Test 4: Refresh Token Test (if provided)
    const refreshToken = req.headers['x-zoho-refresh-token'] || 
                        req.headers['x-refresh-token'] ||
                        req.body?.refresh_token ||
                        req.query?.refresh_token;
    
    if (refreshToken) {
      let refreshTest = {
        name: 'Refresh Token Test',
        status: 'pass',
        details: []
      };
      
      try {
        const refreshResponse = await axios.post(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, 
          new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: ZOHO_CLIENT_ID,
            client_secret: ZOHO_CLIENT_SECRET,
            refresh_token: refreshToken
          }), {
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json'
            },
            timeout: 30000,
            validateStatus: (status) => status < 500
          }
        );
        
        if (refreshResponse.status === 200 && refreshResponse.data.access_token) {
          refreshTest.details.push('Refresh token is valid');
          refreshTest.details.push(`New access token generated (expires in ${refreshResponse.data.expires_in}s)`);
        } else {
          refreshTest.status = 'fail';
          refreshTest.details.push(`Refresh failed: ${refreshResponse.data.error || 'Unknown error'}`);
          
          if (refreshResponse.data.error === 'invalid_grant') {
            refreshTest.details.push('Refresh token is invalid or expired - user needs to re-authenticate');
          } else if (refreshResponse.data.error === 'invalid_client') {
            refreshTest.details.push('Invalid client credentials - check ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET');
          }
        }
        
      } catch (refreshError) {
        refreshTest.status = 'fail';
        refreshTest.details.push(`Refresh token test failed: ${refreshError.message}`);
      }
      
      diagnosticData.tests.push(refreshTest);
    }
    
    // Overall status
    const failedTests = diagnosticData.tests.filter(test => test.status === 'fail');
    const warningTests = diagnosticData.tests.filter(test => test.status === 'warning');
    
    diagnosticData.overall_status = failedTests.length === 0 ? 
      (warningTests.length === 0 ? 'healthy' : 'warning') : 'error';
    
    // Recommendations
    diagnosticData.recommendations = [];
    
    if (failedTests.some(test => test.name === 'Environment Configuration')) {
      diagnosticData.recommendations.push('Set missing environment variables in your .env file');
    }
    
    if (failedTests.some(test => test.name === 'Zoho Server Connectivity')) {
      diagnosticData.recommendations.push('Check your internet connection and ZOHO_ACCOUNTS_URL configuration');
    }
    
    if (failedTests.some(test => test.name === 'Access Token Validation')) {
      diagnosticData.recommendations.push('Use POST /api/zoho/auth/refresh to get a new access token');
    }
    
    if (failedTests.some(test => test.name === 'Refresh Token Test')) {
      diagnosticData.recommendations.push('User needs to re-authenticate: GET /api/zoho/auth/url?platform=web');
    }
    
    if (diagnosticData.recommendations.length === 0) {
      diagnosticData.recommendations.push('All tests passed! Your Zoho integration is working correctly.');
    }
    
    return res.json({
      status: true,
      crmType: 'zoho',
      diagnostics: diagnosticData
    });
    
  } catch (error) {
    console.error('Diagnostics error:', error.message);
    return res.status(500).json({
      status: false,
      crmType: 'zoho',
      error: 'Diagnostics failed',
      details: error.message
    });
  }
};

// Check token scopes and permissions
export const checkScopes = async (req, res) => {
  try {
    console.log('=== Checking Token Scopes ===');
    
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({
        status: false,
        crmType: "zoho",
        error: 'Access token is required in Authorization header',
        code: 'MISSING_ACCESS_TOKEN'
      });
    }
    
    const accessToken = authHeader.split(' ')[1];
    
    const scopeTests = [];
    
    // Test 1: Basic CRM access
    const basicTests = [
      { name: 'Settings Access', endpoint: 'https://www.zohoapis.com/crm/v2/settings/modules' },
      { name: 'Users Access', endpoint: 'https://www.zohoapis.com/crm/v2/users' },
      { name: 'Organization Access', endpoint: 'https://www.zohoapis.com/crm/v2/org' }
    ];
    
    for (const test of basicTests) {
      try {
        const response = await axios.get(test.endpoint, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        scopeTests.push({
          name: test.name,
          endpoint: test.endpoint,
          status: 'success',
          httpStatus: response.status,
          hasAccess: true
        });
      } catch (error) {
        scopeTests.push({
          name: test.name,
          endpoint: test.endpoint,
          status: 'failed',
          httpStatus: error.response?.status,
          hasAccess: false,
          error: error.response?.data?.code || error.message,
          details: error.response?.data
        });
      }
    }
    
    // Test 2: Module-specific access
    const moduleTests = [
      { name: 'Leads', module: 'Leads' },
      { name: 'Contacts', module: 'Contacts' },
      { name: 'Accounts', module: 'Accounts' },
      { name: 'Deals', module: 'Deals' },
      { name: 'Tasks', module: 'Tasks' },
      { name: 'Events', module: 'Events' },
      { name: 'Calls', module: 'Calls' },
      { name: 'Products', module: 'Products' },
      { name: 'Quotes', module: 'Quotes' },
      { name: 'Sales_Orders', module: 'Sales_Orders' },
      { name: 'Invoices', module: 'Invoices' },
      { name: 'Cases', module: 'Cases' },
      { name: 'Notes', module: 'Notes' },
      { name: 'Campaigns', module: 'Campaigns' }
    ];
    
    for (const test of moduleTests) {
      try {
        const response = await axios.get(`https://www.zohoapis.com/crm/v2/${test.module}`, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          },
          params: { per_page: 1 }, // Minimal request
          timeout: 10000
        });
        
        scopeTests.push({
          name: `${test.name} Module Access`,
          module: test.module,
          status: 'success',
          httpStatus: response.status,
          hasAccess: true,
          recordCount: response.data?.info?.count || 0
        });
      } catch (error) {
        scopeTests.push({
          name: `${test.name} Module Access`,
          module: test.module,
          status: 'failed',
          httpStatus: error.response?.status,
          hasAccess: false,
          error: error.response?.data?.code || error.message,
          details: error.response?.data
        });
      }
    }
    
    // Test 3: Write permissions (create a test record - we'll delete it)
    const writeTests = [
      { name: 'Create Lead Permission', module: 'Leads', testData: { Last_Name: 'Test Lead', Company: 'Test Company' } }
    ];
    
    for (const test of writeTests) {
      try {
        const createResponse = await axios.post(`https://www.zohoapis.com/crm/v2/${test.module}`, {
          data: [test.testData]
        }, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        // Try to delete the test record
        const recordId = createResponse.data?.data?.[0]?.details?.id;
        if (recordId) {
          try {
            await axios.delete(`https://www.zohoapis.com/crm/v2/${test.module}/${recordId}`, {
              headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
              },
              timeout: 10000
            });
          } catch (deleteError) {
            console.warn('Could not delete test record:', deleteError.message);
          }
        }
        
        scopeTests.push({
          name: test.name,
          module: test.module,
          status: 'success',
          httpStatus: createResponse.status,
          hasAccess: true,
          canCreate: true,
          testRecordId: recordId
        });
      } catch (error) {
        scopeTests.push({
          name: test.name,
          module: test.module,
          status: 'failed',
          httpStatus: error.response?.status,
          hasAccess: false,
          canCreate: false,
          error: error.response?.data?.code || error.message,
          details: error.response?.data
        });
      }
    }
    
    // Analyze results
    const successfulTests = scopeTests.filter(test => test.status === 'success');
    const failedTests = scopeTests.filter(test => test.status === 'failed');
    const scopeErrors = failedTests.filter(test => 
      test.error === 'OAUTH_SCOPE_MISMATCH' || 
      test.details?.code === 'OAUTH_SCOPE_MISMATCH'
    );
    
    // Generate recommendations
    const recommendations = [];
    
    if (scopeErrors.length > 0) {
      recommendations.push('Your token has scope limitations. You need to re-authenticate with broader scopes.');
      recommendations.push('Use GET /api/zoho/auth/url?platform=web to get a new authorization URL with all required scopes.');
    }
    
    if (failedTests.some(test => test.error === 'INVALID_TOKEN')) {
      recommendations.push('Your token appears to be invalid or expired. Use POST /api/zoho/auth/refresh to get a new token.');
    }
    
    if (successfulTests.length === 0) {
      recommendations.push('No API endpoints are accessible. Check your token validity and scopes.');
    } else if (successfulTests.length < scopeTests.length / 2) {
      recommendations.push('Limited API access detected. Consider re-authenticating with full scopes.');
    }
    
    const missingScopes = [];
    if (scopeErrors.some(test => test.module === 'Leads')) missingScopes.push('ZohoCRM.modules.leads.ALL');
    if (scopeErrors.some(test => test.module === 'Contacts')) missingScopes.push('ZohoCRM.modules.contacts.ALL');
    if (scopeErrors.some(test => test.module === 'Accounts')) missingScopes.push('ZohoCRM.modules.accounts.ALL');
    if (scopeErrors.some(test => test.module === 'Deals')) missingScopes.push('ZohoCRM.modules.deals.ALL');
    if (scopeErrors.some(test => test.module === 'Products')) missingScopes.push('ZohoCRM.modules.products.ALL');
    
    return res.json({
      status: true,
      crmType: 'zoho',
      scopeAnalysis: {
        totalTests: scopeTests.length,
        successfulTests: successfulTests.length,
        failedTests: failedTests.length,
        scopeErrors: scopeErrors.length,
        accessLevel: successfulTests.length / scopeTests.length,
        hasBasicAccess: successfulTests.some(test => test.name === 'Settings Access'),
        hasModuleAccess: successfulTests.some(test => test.name.includes('Module Access')),
        hasWriteAccess: successfulTests.some(test => test.canCreate === true)
      },
      tests: scopeTests,
      missingScopes,
      recommendations,
      nextSteps: scopeErrors.length > 0 ? [
        '1. Go to GET /api/zoho/auth/url?platform=web',
        '2. Complete the OAuth flow with the new comprehensive scopes',
        '3. Use the new tokens for API access'
      ] : [
        'Your token has good scope coverage for most operations!'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Scope check error:', error.message);
    return res.status(500).json({
      status: false,
      crmType: 'zoho',
      error: 'Scope check failed',
      details: error.message
    });
  }
};