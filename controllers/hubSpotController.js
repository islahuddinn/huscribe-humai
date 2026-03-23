import axios from 'axios';
import crypto from 'crypto';
import 'dotenv/config';
import https from 'https';

// Dynamic HubSpot configuration
const HUBSPOT_CONFIG = {
    baseUrl: process.env.HUBSPOT_BASE_URL ,
    apiBaseUrl: process.env.HUBSPOT_API_BASE_URL,
    clientId: process.env.HUBSPOT_CLIENT_ID,
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
    redirectUri: process.env.HUBSPOT_OAUTH_REDIRECT_URI,
     hubspotAuthHost: 'app.hubspot.com',
  apiTimeout: 10000, // 10 seconds
  maxRetries: 2,
    //   authUrl: 'https://app.hubspot.com/oauth',
  tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    authBaseUrl: 'https://app.hubspot.com/oauth/authorize', // Critical fix
  apiBaseUrl: 'https://api.hubapi.com',

};

// Store for OAuth tokens - in production this should be a database
const oauthTokenStore = new Map();

/**
 * Get HubSpot OAuth Configuration
 */
export const getOAuthConfig = async (req, res) => {
    try {
        const config = {
            clientId: HUBSPOT_CONFIG.clientId,
            redirectUri: HUBSPOT_CONFIG.redirectUri,
            baseUrl: HUBSPOT_CONFIG.baseUrl,
            scopes: [
                'content',
                'crm.dealsplits.read_write',
                'crm.export',
                'crm.import',
                'crm.lists.read',
                'crm.lists.write',
                'crm.objects.appointments.read',
                'crm.objects.appointments.write',
                'crm.objects.companies.read',
                'crm.objects.companies.write',
                'crm.objects.contacts.read',
                'crm.objects.contacts.write',
                'crm.objects.custom.read',
                'crm.objects.custom.write',
                'crm.objects.deals.read',
                'crm.objects.deals.write',
                'crm.objects.goals.read',
                'crm.objects.goals.write',
                'crm.objects.invoices.read',
                'crm.objects.invoices.write',
                'crm.objects.leads.read',
                'crm.objects.leads.write',
                'crm.objects.line_items.read',
                'crm.objects.line_items.write',
                'crm.objects.listings.read',
                'crm.objects.listings.write',
                'crm.objects.marketing_events.read',
                'crm.objects.marketing_events.write',
                'crm.objects.orders.read',
                'crm.objects.orders.write',
                'crm.objects.owners.read',
                'crm.objects.partner-clients.read',
                'crm.objects.partner-clients.write',
                'crm.objects.partner-services.read',
                'crm.objects.partner-services.write',
                'crm.objects.products.read',
                'crm.objects.products.write',
                'crm.objects.quotes.read',
                'crm.objects.quotes.write',
                'crm.objects.services.read',
                'crm.objects.services.write',
                'crm.pipelines.orders.read',
                'crm.pipelines.orders.write',
                'crm.schemas.appointments.read',
                'crm.schemas.appointments.write',
                'crm.schemas.companies.read',
                'crm.schemas.companies.write',
                'crm.schemas.contacts.read',
                'crm.schemas.contacts.write',
                'crm.schemas.custom.read',
                'crm.schemas.deals.read',
                'crm.schemas.deals.write',
                'crm.schemas.invoices.read',
                'crm.schemas.invoices.write',
                'crm.schemas.line_items.read',
                'crm.schemas.listings.read',
                'crm.schemas.listings.write',
                'crm.schemas.orders.read',
                'crm.schemas.orders.write',
                'crm.schemas.quotes.read',
                'crm.schemas.services.read',
                'crm.schemas.services.write',
                'e-commerce',
                'marketing.campaigns.read',
                'marketing.campaigns.revenue.read',
                'marketing.campaigns.write',
                'oauth',
                'sales-email-read',
                'settings.users.read',
                'settings.users.write',
                'tickets',
                'timeline',
                'transactional-email'
            ]
        };

        if (!config.clientId || !config.redirectUri) {
            return res.status(500).json({
                error: 'Missing OAuth configuration',
                details: {
                    clientId: !!config.clientId,
                    redirectUri: !!config.redirectUri
                }
            });
        }

        res.json(config);
    } catch (error) {
        console.error('Error getting OAuth config:', error);
        res.status(500).json({ error: 'Failed to get OAuth configuration' });
    }
};

//=====oauth work flow
const stateStore = new Map();
// State storage (use Redis in production)
const stateCache = new Map();

export const initiateOAuth = async (req, res) => {
  try {
    // Generate cryptographically secure state
    const state = crypto.randomBytes(16).toString('hex');
    const stateWithPlatform = JSON.stringify({
      state,
      platform: 'frontend'
    });

    // Define all required scopes exactly as configured in HubSpot app
    const requiredScopes = [
      'content',
      'crm.dealsplits.read_write',
      'crm.export',
      'crm.import',
      'crm.lists.read',
      'crm.lists.write',
      'crm.objects.appointments.read',
      'crm.objects.appointments.write',
      'crm.objects.companies.read',
      'crm.objects.companies.write',
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.custom.read',
      'crm.objects.custom.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
      'crm.objects.goals.read',
      'crm.objects.goals.write',
      'crm.objects.invoices.read',
      'crm.objects.invoices.write',
      'crm.objects.leads.read',
      'crm.objects.leads.write',
      'crm.objects.line_items.read',
      'crm.objects.line_items.write',
      'crm.objects.listings.read',
      'crm.objects.listings.write',
      'crm.objects.marketing_events.read',
      'crm.objects.marketing_events.write',
      'crm.objects.orders.read',
      'crm.objects.orders.write',
      'crm.objects.owners.read',
      'crm.objects.partner-clients.read',
      'crm.objects.partner-clients.write',
      'crm.objects.partner-services.read',
      'crm.objects.partner-services.write',
      'crm.objects.products.read',
      'crm.objects.products.write',
      'crm.objects.quotes.read',
      'crm.objects.quotes.write',
      'crm.objects.services.read',
      'crm.objects.services.write',
      'crm.pipelines.orders.read',
      'crm.pipelines.orders.write',
      'crm.schemas.appointments.read',
      'crm.schemas.appointments.write',
      'crm.schemas.companies.read',
      'crm.schemas.companies.write',
      'crm.schemas.contacts.read',
      'crm.schemas.contacts.write',
      'crm.schemas.custom.read',
      'crm.schemas.deals.read',
      'crm.schemas.deals.write',
      'crm.schemas.invoices.read',
      'crm.schemas.invoices.write',
      'crm.schemas.line_items.read',
      'crm.schemas.listings.read',
      'crm.schemas.listings.write',
      'crm.schemas.orders.read',
      'crm.schemas.orders.write',
      'crm.schemas.quotes.read',
      'crm.schemas.services.read',
      'crm.schemas.services.write',
      'e-commerce',
      'marketing.campaigns.read',
      'marketing.campaigns.revenue.read',
      'marketing.campaigns.write',
      'oauth',
      'sales-email-read',
      'settings.users.read',
      'settings.users.write',
      'tickets',
      'timeline',
      'transactional-email'
    ];

    // Store state for validation in callback
    stateStore.set(state, { timestamp: Date.now() });

    // Construct authorization URL with all required scopes
    const authUrl = new URL(HUBSPOT_CONFIG.authBaseUrl);
    authUrl.searchParams.append('client_id', HUBSPOT_CONFIG.clientId);
    authUrl.searchParams.append('redirect_uri', HUBSPOT_CONFIG.redirectUri);
    authUrl.searchParams.append('scope', requiredScopes.join(' '));
    authUrl.searchParams.append('state', stateWithPlatform);

    // Redirect to HubSpot authorization page
    res.redirect(authUrl.toString());

  } catch (error) {
    console.error('Initiation Error:', error);
    res.status(500).json({
      success: false,
      error: 'initiation_failed',
      message: 'Could not start authentication process'
    });
  }
};

/////===== Helper functions


// function handleSuccess(res, platform, tokens) {
//     if (platform === 'android') {
//         return res.json({
//             success: true,
//             ...tokens
//         });
//     }

//     // For web - redirect with tokens in URL
//     const redirectUrl = new URL('http://localhost:3002/auth/hubspot');
//     redirectUrl.searchParams.append('access_token', tokens.access_token);
//     redirectUrl.searchParams.append('refresh_token', tokens.refresh_token);
//     redirectUrl.searchParams.append('expires_in', tokens.expires_in);
//     res.redirect(redirectUrl.toString());
// }

// function redirectWithError(res, state, error) {
//     const storedState = stateStore.get(state);
//     const isMobile = storedState?.platform === 'android';
    
//     if (isMobile) {
//         return res.status(400).json({
//             error: 'Authentication failed',
//             details: error
//         });
//     }

//     const frontendUrl = new URL('http://localhost:3002/auth/error');
//     frontendUrl.searchParams.append('error', encodeURIComponent(error));
//     res.redirect(frontendUrl.toString());
// }


// // Helper functions
// async function exchangeCodeForTokens(code) {
//     const { data } = await axios.post(`${HUBSPOT_CONFIG.apiBaseUrl}/oauth/v1/token`, null, {
//         params: {
//             grant_type: 'authorization_code',
//             client_id: HUBSPOT_CONFIG.clientId,
//             client_secret: HUBSPOT_CONFIG.clientSecret,
//             redirect_uri: HUBSPOT_CONFIG.redirectUri,
//             code
//         },
//         headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
//     });
//     return data;
// }

// async function getUserIdentity(accessToken) {
//     const { data } = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/oauth/v1/access-tokens/current`, {
//         headers: { Authorization: `Bearer ${accessToken}` }
//     });
//     return {
//         user_id: data.user_id,
//         hub_id: data.hub_id,
//         scopes: data.scopes
//     };
// }

// function handleOAuthError(res, error, state) {
//     const storedState = stateStore.get(state);
//     const errorUrl = new URL(storedState?.platform === 'android' ? 
//         'myapp://auth/error' : 
//         'http://localhost:3002/auth/error');
    
//     errorUrl.searchParams.append('error', error);
//     return res.redirect(errorUrl.toString());
// }
/**
 * Handle OAuth callback old approach
 */
export const oauthCallback = async (req, res) => {
    try {
        const { code, state, error: oauthError } = req.query;
        
        if (oauthError) {
            console.error('OAuth error:', oauthError);
            return res.status(400).json({
                error: 'OAuth authorization failed',
                details: oauthError
            });
        }

        if (!code) {
            return res.status(400).json({
                error: 'Missing authorization code',
                query: req.query
            });
        }

        // Parse state to get platform information
        let stateData;
        try {
            stateData = JSON.parse(state);
        } catch (e) {
            stateData = { state, platform: 'frontend' };
        }

        // Verify state if it was stored in session
        if (req.session && req.session.hubspotState && req.session.hubspotState !== state) {
            return res.status(400).json({ error: 'Invalid state parameter' });
        }

        const config = {
            ...HUBSPOT_CONFIG
        };

        // Exchange the authorization code for tokens
        // const tokenResponse = await axios.post(`${config.apiBaseUrl}/oauth/v1/token`, null, {
        //     params: {
        //         grant_type: 'authorization_code',
        //         client_id: config.clientId,
        //         client_secret: config.clientSecret,
        //         redirect_uri: config.redirectUri,
        //         code
        //     },
        //     headers: {
        //         'Content-Type': 'application/x-www-form-urlencoded'
        //     }
        // });

         const tokenResponse = await axios.post(HUBSPOT_CONFIG.tokenUrl, null, {
      params: {
        grant_type: 'authorization_code',
        client_id: HUBSPOT_CONFIG.clientId,
        client_secret: HUBSPOT_CONFIG.clientSecret,
        redirect_uri: HUBSPOT_CONFIG.redirectUri,
        code
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;
        // Fetch user (owner) info using the access token
const userInfoResponse = await axios.get(`${config.apiBaseUrl}/oauth/v1/access-tokens/${access_token}`, {
  headers: {
    Authorization: `Bearer ${access_token}`
  }
});
console.log('HubSpot user info response:', userInfoResponse.data);
const user = userInfoResponse.data; // contains user details like email, user_id, hub_id etc.
        try {
            // Get HubSpot account details
            const accountInfo = await axios.get(`${config.apiBaseUrl}/account-info/v3/details`, {
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const hubspotAccountId = accountInfo.data.portalId || accountInfo.data.id;
            
            // Store tokens with account info
            oauthTokenStore.set(hubspotAccountId.toString(), {
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: Date.now() + (expires_in * 1000),
                accountInfo: accountInfo.data
            });

            // Clear the state from session if it exists
            if (req.session && req.session.hubspotState) {
                delete req.session.hubspotState;
            }

            const tokens = {
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresIn: expires_in,
                accountInfo: accountInfo.data,
                email: user.user,
                fullName: user.hub_id,
                username: user.user_id,
            };

            // If platform is android, return JSON response
            if (stateData.platform === 'android') {
                return res.json({
                    success: true,
                    userId: hubspotAccountId,
                    ...tokens,
                    message: 'OAuth flow completed successfully'
                });
            }

            // For frontend, redirect to the frontend URL with tokens
            const frontendUrl = `http://localhost:3002/auth/hubspot?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}&expires_at=${tokens.expiresIn}&issued_at=${Date.now()}&email=${tokens.email}&fullName=${tokens.fullName}&username=${tokens.username}`;
            return res.redirect(frontendUrl);
        } catch (accountError) {
            console.error('Error fetching account info:', accountError);
            
            // If platform is android, return JSON response
            if (stateData.platform === 'android') {
                return res.json({
                    success: true,
                    accessToken: access_token,
                    refreshToken: refresh_token,
                    expiresIn: expires_in,
                    error: 'Account info fetch failed',
                    details: accountError.message
                });
            }

            // For frontend, redirect to the frontend URL with tokens
            const frontendUrl = `http://localhost:3002/auth/hubspot?access_token=${access_token}&refresh_token=${refresh_token}&expires_at=${expires_in}&issued_at=${Date.now()}}`;
            return res.redirect(frontendUrl);
        }
    } catch (error) {
        console.error('Error in OAuth callback:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to complete OAuth flow',
            details: error.response?.data || error.message
        });
    }
};


export const refreshToken = async (req, res) => {
    try {
        // Try to get refresh_token from query params first, then from body
        const refresh_token = req.query.refresh_token || req.body.refresh_token;

        if (!refresh_token) {
            return res.status(400).json({
                error: 'Missing refresh token',
                message: 'Please provide a refresh token in query parameters or request body'
            });
        }

        const config = {
            ...HUBSPOT_CONFIG
        };

        if (!config.clientId || !config.clientSecret) {
            return res.status(500).json({
                error: 'Missing OAuth configuration',
                details: {
                    clientId: !!config.clientId,
                    clientSecret: !!config.clientSecret
                }
            });
        }

        console.log('Attempting to refresh token with:', {
            clientId: config.clientId,
            refreshToken: refresh_token.substring(0, 10) + '...' // Log only part of the token for security
        });

        // Exchange refresh token for new access token
        const tokenResponse = await axios.post(`${config.apiBaseUrl}/oauth/v1/token`, null, {
            params: {
                grant_type: 'refresh_token',
                client_id: config.clientId,
                client_secret: config.clientSecret,
                refresh_token
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log('Token refresh response received');

        const { access_token, refresh_token: new_refresh_token, expires_in } = tokenResponse.data;

        try {
            // Get HubSpot account details to identify the user
            const accountInfo = await axios.get(`${config.apiBaseUrl}/account-info/v3/details`, {
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const hubspotAccountId = accountInfo.data.portalId || accountInfo.data.id;
            
            // Update tokens in store
            oauthTokenStore.set(hubspotAccountId.toString(), {
                accessToken: access_token,
                refreshToken: new_refresh_token,
                expiresAt: Date.now() + (expires_in * 1000),
                accountInfo: accountInfo.data
            });

            console.log('Token refresh successful for account:', hubspotAccountId);

            res.json({
                success: true,
                userId: hubspotAccountId,
                accessToken: access_token,
                refreshToken: new_refresh_token,
                expiresIn: expires_in,
                accountInfo: accountInfo.data,
                message: 'Token refreshed successfully'
            });
        } catch (accountError) {
            console.error('Error fetching account info:', accountError);
            res.json({
                success: true,
                accessToken: access_token,
                refreshToken: new_refresh_token,
                expiresIn: expires_in,
                error: 'Account info fetch failed',
                details: accountError.message
            });
        }
    } catch (error) {
        console.error('Error refreshing token:', error.response?.data || error.message);
        
        // Handle specific error cases
        if (error.response) {
            const { status, data } = error.response;
            
            // Handle invalid refresh token
            if (status === 400 && data?.error === 'invalid_grant') {
                return res.status(401).json({
                    error: 'Invalid refresh token',
                    message: 'The refresh token is invalid or has expired. Please re-authenticate.',
                    details: data
                });
            }
            
            // Handle rate limiting
            if (status === 429) {
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: 'Too many token refresh attempts. Please try again later.',
                    details: data
                });
            }
            
            return res.status(status).json({
                error: 'Failed to refresh token',
                details: data
            });
        }
        
        // Handle network errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'Could not connect to HubSpot servers. Please try again later.',
                details: error.message
            });
        }
        
        res.status(500).json({
            error: 'Failed to refresh token',
            details: error.message
        });
    }
};

export const ensureAuthenticated = async (req, res, next) => {
  if (req.session.tokens) {
    try {
      // Check if token needs refresh (5 minute buffer)
      if (Date.now() > req.session.tokens.expiresAt - 300000) {
        await refreshToken(req);
      }
      return next();
    } catch (error) {
      console.error('Authentication check failed:', error);
      return res.redirect('/login');
    }
  }
  res.redirect('/login');
};

export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.redirect('/');
  });
};

/**
 * Get OAuth token info
 */
export const getTokenInfo = async (req, res) => {
    try {
        const userId = req.query.userId || req.user?.id;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const tokenData = oauthTokenStore.get(userId);
        
        if (!tokenData) {
            return res.status(404).json({ error: 'No token found for this user. Please authenticate with HubSpot.' });
        }

        res.json({
            accessToken: tokenData.accessToken,
            expiresAt: tokenData.expiresAt,
            accountInfo: tokenData.accountInfo
        });
    } catch (error) {
        console.error('Error getting token info:', error.message);
        res.status(500).json({ error: 'Failed to get token info' });
    }
};

/**
 * Delete user's OAuth tokens
 */
export const deleteUserTokens = async (req, res) => {
    try {
        const userId = req.query.userId || req.user?.id;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        oauthTokenStore.delete(userId);
        
        res.json({ message: 'Successfully logged out from HubSpot' });
    } catch (error) {
        console.error('Error deleting tokens:', error.message);
        res.status(500).json({ error: 'Failed to delete tokens' });
    }
};

/**
 * Helper function to get access token
 */
export const getAccessToken = async (req) => {
    try {
        // First try to get token from authorization header
    const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            return token;
        }

        // Then try to get from query parameters
        const tokenFromQuery = req.query.access_token;
        if (tokenFromQuery) {
            return tokenFromQuery;
        }

        // Finally try to get from body
        const tokenFromBody = req.body.access_token;
        if (tokenFromBody) {
            return tokenFromBody;
        }

        // If no token found, try to get from oauthTokenStore using portal ID
        const portalId = req.query.portalId || req.body.portalId;
        if (portalId) {
            const tokenData = oauthTokenStore.get(portalId.toString());
            if (tokenData) {
                // Check if token needs refresh
                if (tokenData.expiresAt <= Date.now()) {
                    try {
                        const newTokens = await refreshOAuthToken(tokenData.refreshToken);
                        oauthTokenStore.set(portalId.toString(), {
                            ...tokenData,
                            accessToken: newTokens.access_token,
                            refreshToken: newTokens.refresh_token,
                            expiresAt: Date.now() + (newTokens.expires_in * 1000)
                        });
                        return newTokens.access_token;
                    } catch (error) {
                        console.error('Error refreshing token:', error);
                        throw { 
                            status: 401, 
                            message: 'Token expired and refresh failed. Please re-authenticate.' 
                        };
                    }
                }
                return tokenData.accessToken;
            }
        }

        // If no token found anywhere, throw error
        throw { 
            status: 401, 
            message: 'No access token found. Please authenticate with HubSpot first.' 
        };
    } catch (error) {
        console.error('Error in getAccessToken:', error.message);
        throw error;
    }
};

/**
 * Helper function to refresh OAuth token
 */
async function refreshOAuthToken(refreshToken) {
    const { HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET } = process.env;

    const response = await axios.post(`${HUBSPOT_CONFIG.apiBaseUrl}/oauth/v1/token`, null, {
        params: {
            grant_type: 'refresh_token',
            client_id: HUBSPOT_CLIENT_ID,
            client_secret: HUBSPOT_CLIENT_SECRET,
            refresh_token: refreshToken
        },
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    return response.data;
}

////===Search in Hubspot====///

export const searchHubSpot = async (req, res) => {
  const { searchTerm } = req.query;

  if (!searchTerm) {
    return res.status(400).json({ success: false, message: 'Search term is required' });
  }

  try {
    const accessToken = await getAccessToken(req);

    if (!accessToken) {
      return res.status(401).json({ success: false, message: 'Missing or invalid access token' });
    }

    const objectTypes = ['contacts', 'companies', 'deals', 'tasks'];

    const searchResults = await Promise.all(
      objectTypes.map(async (objectType) => {
        try {
          const response = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/${objectType}/search`,
            {
              filterGroups: [],
              sorts: [],
              properties: ['id', 'createdate', 'lastmodifieddate'],
              limit: 10,
              after: 0,
              query: searchTerm,
            },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          return {
            objectType,
            results: response.data.results,
          };
        } catch (error) {
          console.error(`Error searching ${objectType}:`, error.response?.data || error.message);
          return {
            objectType,
            results: [],
            error: error.response?.data || error.message,
          };
        }
      })
    );
    res.status(200).json({
      success: true,
      searchTerm,
      results: searchResults,
    });
  } catch (error) {
    console.error('Error searching HubSpot:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to search HubSpot',
      error: error.response?.data || error.message,
    });
  }
};

////====Auth====////

export const retrievAccessToken = async (req, res) => {
    try {
        const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

        if (!accessToken) {
            return res.status(500).json({ error: 'Access token is missing or not configured.' });
        }

        res.status(200).json({ crmType: 'hubSpot', accessToken });
    } catch (error) {
        console.error('Error fetching access token:', error.message);
        res.status(500).json({ crmType: 'hubSpot', error: 'Internal Server Error' });
    }
};



export const refreshAccessToken = async (req, res) => {
    try {
        const { client_id, client_secret, } = process.env;
const refresh_token = req.query.refresh_token;
        if (!client_id || !client_secret || !refresh_token) {
            return res.status(500).json({ crmType: "hubSpot", error: "Missing HubSpot credentials in environment variables" });
        }

        const response = await axios.post(HUBSPOT_CONFIG.apiBaseUrl + '/oauth/v1/token', null, {
            params: {
                grant_type: 'refresh_token',
                client_id,
                client_secret,
                refresh_token
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, expires_in } = response.data;

        res.status(200).json({
            crmType: "hubSpot",
            accessToken: access_token,
            expiresIn: expires_in
        });

    } catch (error) {
        console.error('Error refreshing access token:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            crmType: "hubSpot",
            error: error.response?.data || 'Failed to refresh access token'
        });
    }
};


////===Contacts======/////

export const createContact = async (req, res) => {
    try {
        const { 
            email, 
            firstname, 
            lastname,
            phone,
            company,
            jobtitle,
            website,
            address,
            city,
            state,
            zip,
            country,
            access_token 
        } = req.body;

        // Validate required fields
        if (!email || !firstname || !lastname) {
            return res.status(400).json({ 
                crmType: "hubSpot",
                error: 'Validation error',
                message: 'Missing required fields',
                required: ['email', 'firstname', 'lastname'],
                received: { email, firstname, lastname }
            });
        }

        // Get access token
        let accessToken;
        try {
            accessToken = await getAccessToken(req);
        } catch (error) {
            return res.status(401).json({ 
                crmType: "hubSpot",
                error: 'Authentication failed', 
                message: error.message,
                action: 'Please authenticate with HubSpot first by calling /api/hubspot/oauth/init'
            });
        }

        // Format the contact data according to HubSpot's API requirements
        // Using only standard HubSpot properties
        const contactObj = {
            properties: {
                email,
                firstname,
                lastname,
                phone: phone || '',
                company: company || '',
                jobtitle: jobtitle || '',
                website: website || '',
                address: address || '',
                city: city || '',
                state: state || '',
                zip: zip || '',
                country: country || ''
            }
        };

        console.log('Creating contact with data:', JSON.stringify(contactObj, null, 2));

        const response = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/contacts`, 
            contactObj, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Contact created successfully:', response.data);

        res.status(201).json({ 
            crmType: "hubSpot", 
            data: response.data,
            message: 'Contact created successfully'
        });
    } catch (error) {
        console.error('Error creating contact:', error.response?.data || error.message);
        
        // Handle specific error cases
        if (error.response) {
            const { status, data } = error.response;
            
            // Handle authentication errors
            if (status === 401) {
                return res.status(401).json({ 
                    crmType: "hubSpot", 
                    error: 'Authentication failed',
                    message: data.message || 'Invalid or expired token',
                    action: 'Please authenticate with HubSpot first by calling /api/hubspot/oauth/init'
                });
            }
            
            // Handle validation errors
            if (status === 400) {
                return res.status(400).json({ 
                    crmType: "hubSpot", 
                    error: 'Validation error',
                    message: data.message || 'Invalid contact data',
                    details: data
                });
            }
            
            return res.status(status).json({ 
                crmType: "hubSpot", 
                error: data.message || 'Failed to create contact',
                details: data
            });
        }
        
        res.status(500).json({ 
            crmType: "hubSpot", 
            error: 'Internal server error',
            message: error.message
        });
    }
};

export const getContactById = async (req, res) => {
    try {
        const { id } = req.params;
        const accessToken = getAccessToken(req);

        console.log(accessToken,"hetre is the access token=======");

        const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/contacts/${id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
        });

        res.json({ crmType: "hubSpot", data: response.data });
    } catch (error) {
        console.error('Error fetching contact:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const getAllContacts = async (req, res) => {
    try {
    console.log('Starting to fetch all contacts...');
    const accessToken = await getAccessToken(req);
    console.log('Access token retrieved successfully');

    const {
      limit = 100,
      after,
      properties = [
        'firstname',
        'lastname',
        'email',
        'phone',
        'company',
        'lifecyclestage',
        'hs_lead_status',
        'createdate',
        'lastmodifieddate'
      ],
      sort = 'lastmodifieddate',
      sortDirection = 'DESCENDING'
    } = req.query;

    console.log('Request parameters:', {
      limit,
      after,
      properties,
      sort,
      sortDirection
    });

    const response = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/contacts`,
      {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
        params: {
          limit: parseInt(limit),
          after: after || undefined,
          properties,
          sorts: `${sort} ${sortDirection}`
        }
      }
    );

    console.log(`Successfully retrieved ${response.data.results.length} contacts`);
    return res.status(200).json({
            crmType: "hubSpot",
      total: response.data.total,
      contacts: response.data.results,
      paging: response.data.paging
    });
    } catch (error) {
    console.error('Error in getAllContacts:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
            crmType: "hubSpot",
      error: error.response?.data || 'Failed to fetch contacts'
        });
    }
};

export const updateContact = async (req, res) => {
    try {
        const { contactId } = req.params;
        const { email, firstname, lastname } = req.body;

        if (!contactId) {
            return res.status(400).json({ error: 'Missing required parameter: contactId' });
        }
        
        if (!email && !firstname && !lastname) {
            return res.status(400).json({ error: 'At least one field (email, firstname, lastname) must be provided for update' });
        }

        const accessToken = getAccessToken(req);

        const contactObj = {
            properties: {}
        };

        if (email) contactObj.properties.email = email;
        if (firstname) contactObj.properties.firstname = firstname;
        if (lastname) contactObj.properties.lastname = lastname;

        const response = await axios.patch(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/contacts/${contactId}`, 
            contactObj, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ crmType: "hubSpot", data: response.data });
    } catch (error) {
        console.error('Error updating contact:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const deleteContact = async (req, res) => {
        try {
            const { id } = req.params;
            const accessToken = getAccessToken(req);
    
            await axios.delete(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/contacts/${id}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
    
            res.json({ crmType: "hubSpot", message: 'Contact deleted successfully' });
        } catch (error) {
            console.error('Error deleting contact:', error.response?.data || error.message);
            res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
        }
    };


    /////====task=====////

export const createTask = async (req, res) => {
    try {
        const { 
            // Required
            subject,
            dueDate,
            
            // Optional
            description,
            status = "NOT_STARTED",
            priority = "MEDIUM",
            associated_object_type,
            associated_object_id,
            reminder_date,
            task_type,
            meeting_outcome,
            access_token 
        } = req.body;

        // Validate required fields
        if (!subject || !dueDate) {
            return res.status(400).json({ 
                crmType: "hubSpot", 
                error: 'Validation error',
                message: 'Missing required fields',
                required: ['subject', 'dueDate'],
                received: { subject, dueDate }
            });
        }

        // Get access token
        let accessToken;
        try {
            accessToken = await getAccessToken(req);
        } catch (error) {
            return res.status(401).json({ 
                crmType: "hubSpot",
                error: 'Authentication failed', 
                message: error.message,
                action: 'Please authenticate with HubSpot first by calling /api/hubspot/oauth/init'
            });
        }

        // Convert dueDate to timestamp
        const dueDateTimestamp = new Date(dueDate).getTime();

        // Validate status
        const allowedStatuses = ["COMPLETED", "DEFERRED", "IN_PROGRESS", "NOT_STARTED", "WAITING"];
        const validatedStatus = allowedStatuses.includes(status.toUpperCase()) ? status.toUpperCase() : "NOT_STARTED";

        // Validate priority
        const allowedPriorities = ["NONE", "LOW", "MEDIUM", "HIGH"];
        const validatedPriority = allowedPriorities.includes(priority.toUpperCase()) ? priority.toUpperCase() : "MEDIUM";

        // Format the task data according to HubSpot's API requirements
        const taskObj = {
            properties: {
                hs_task_subject: subject,
                hs_task_body: description || "",
                hs_task_status: validatedStatus,
                hs_task_priority: validatedPriority,
                hs_timestamp: dueDateTimestamp 
            }
        };

        console.log('Creating task with data:', JSON.stringify(taskObj, null, 2));

        const response = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/tasks`, 
            taskObj, 
            {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
            }
        );

        console.log('Task created successfully:', response.data);

        res.status(201).json({
            crmType: "hubSpot",
            data: response.data,
            message: 'Task created successfully'
        });
    } catch (error) {
        console.error('Error creating task:', error.response?.data || error.message);
        
        // Handle specific error cases
        if (error.response) {
            const { status, data } = error.response;
            
            // Handle authentication errors
            if (status === 401) {
                return res.status(401).json({ 
            crmType: "hubSpot",
                    error: 'Authentication failed',
                    message: data.message || 'Invalid or expired token',
                    action: 'Please authenticate with HubSpot first by calling /api/hubspot/oauth/init'
                });
            }
            
            // Handle validation errors
            if (status === 400) {
                return res.status(400).json({ 
                    crmType: "hubSpot", 
                    error: 'Validation error',
                    message: data.message || 'Invalid task data',
                    details: data
                });
            }
            
            return res.status(status).json({ 
                crmType: "hubSpot", 
                error: data.message || 'Failed to create task',
                details: data
            });
        }
        
        res.status(500).json({ 
            crmType: "hubSpot", 
            error: 'Internal server error',
            message: error.message
        });
    }
};



export const getTaskById = async (req, res) => {
    try {
        const { id } = req.params;
        const accessToken = getAccessToken(req);

        const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/tasks/${id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
        });

        res.json({ crmType: "hubSpot", data: response.data });
    } catch (error) {
        console.error('Error fetching task:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};


export const getAllTasks = async (req, res) => {
    try {
        // Get access token with await
        const accessToken = await getAccessToken(req);

        let { limit = 10, after } = req.query;
        limit = parseInt(limit, 10) || 10;

        if (after && typeof after !== 'string') {
            return res.status(400).json({ 
                crmType: "hubSpot", 
                error: 'Invalid "after" parameter' 
            });
        }

        const response = await axios.get(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/tasks`,
            {
            headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
            },
            params: {
                limit,
                after: after || undefined,
                    properties: [
                        'hs_task_subject',
                        'hs_timestamp',
                        'hs_task_status',
                        'hs_task_priority'
                    ]
                }
            }
        );

        const { results, paging, total } = response.data;

        res.status(200).json({
            crmType: "hubSpot",
            totalResults: total || results.length,
            tasks: results.map(task => ({
                id: task.id,
                subject: task.properties?.hs_task_subject || null,
                timestamp: task.properties?.hs_timestamp || null,
                status: task.properties?.hs_task_status || null,
                priority: task.properties?.hs_task_priority || null
            })),
            paging: paging || null
        });
    } catch (error) {
        console.error('Error fetching tasks:', error.response?.data || error.message);

        // Handle authentication errors specifically
        if (error.status === 401) {
            return res.status(401).json({
                crmType: "hubSpot",
                error: 'Authentication failed',
                message: error.message,
                action: 'Please authenticate with HubSpot first by calling /api/hubspot/oauth/init'
            });
        }

        res.status(error.response?.status || 500).json({
            crmType: "hubSpot",
            error: error.response?.data || 'Internal Server Error'
        });
    }
};



export const updateTask = async (req, res) => {
    const { taskId } = req.params;
    const { hs_task_subject, hs_timestamp, hs_task_status, hs_task_priority } = req.body;

    try {
        if (!taskId) {
            return res.status(400).json({ error: 'Missing required parameter: taskId' });
        }

        if (!hs_task_subject && !hs_timestamp && !hs_task_status && !hs_task_priority) {
            return res.status(400).json({ error: 'At least one field (hs_task_subject, hs_timestamp, hs_task_status, hs_task_priority) must be provided for update' });
        }

        const taskObj = {
            properties: {},
        };

        if (hs_task_subject) taskObj.properties.hs_task_subject = hs_task_subject;
        if (hs_timestamp) taskObj.properties.hs_timestamp = hs_timestamp;
        if (hs_task_status) taskObj.properties.hs_task_status = hs_task_status;
        if (hs_task_priority) taskObj.properties.hs_task_priority = hs_task_priority;

        const accessToken = getAccessToken(req);

        const response = await axios.patch(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/tasks/${taskId}`,
            taskObj,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        res.status(200).json({ crmType: 'hubSpot', data: response.data });
    } catch (error) {
        console.error('Error updating task:', error);

        if (error.response) {
            const { status, data } = error.response;
            return res.status(status).json({ crmType: 'hubSpot', error: data });
        }

        res.status(500).json({ crmType: 'hubSpot', error: 'Internal Server Error' });
    }
};

export const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const accessToken = getAccessToken(req);

        await axios.delete(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/tasks/${id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        res.json({ crmType: "hubSpot", message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};



/////====Deal===////

export const createDeal = async (req, res) => {
    try {
        const { 
            // Required
            dealname, 
            amount, 
            pipeline,
            dealstage,
            
            // Optional
            closedate,
            dealtype,
            description,
            hubspot_owner_id,
            probability,
            deal_currency_code,
            expected_revenue,
            discount,
            payment_terms,
            sales_activity_count,
            days_to_close,
            access_token 
        } = req.body;

        // Validate required fields
        if (!dealname || !amount || !pipeline || !dealstage) {
            return res.status(400).json({ 
                crmType: "hubSpot",
                error: 'Validation error',
                message: 'Missing required fields',
                required: ['dealname', 'amount', 'pipeline', 'dealstage'],
                received: { dealname, amount, pipeline, dealstage }
            });
        }

        // Get access token
        let accessToken;
        try {
            accessToken = await getAccessToken(req);
        } catch (error) {
            return res.status(401).json({ 
                crmType: "hubSpot",
                error: 'Authentication failed', 
                message: error.message,
                action: 'Please authenticate with HubSpot first by calling /api/hubspot/oauth/init'
            });
        }

        // Format the deal data according to HubSpot's API requirements
        const dealObj = {
            properties: {
                dealname,
                amount: amount.toString(),
                pipeline,
                // Use correct stage ID from HubSpot's pipeline
                dealstage: "presentationscheduled", // Instead of "presentation scheduled"
                closedate: closedate ? new Date(closedate).getTime() : null,
                dealtype: dealtype || 'newbusiness',
                description: description || '',
                hubspot_owner_id: hubspot_owner_id || '',
                hs_probability: probability || '', // Was "probability"
                deal_currency_code: deal_currency_code || 'USD',
                hs_expected_revenue: expected_revenue || '', // Was "expected_revenue"
                discount: discount || '',
                hs_terms: payment_terms || '', // Was "payment_terms"
                // Remove read-only properties: days_to_close, sales_activity_count
            }
        };

        console.log('Creating deal with data:', JSON.stringify(dealObj, null, 2));

        const response = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/deals`, 
            dealObj, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Deal created successfully:', response.data);

        res.status(201).json({ 
            crmType: "hubSpot", 
            data: response.data,
            message: 'Deal created successfully'
        });
    } catch (error) {
        console.error('Error creating deal:', error.response?.data || error.message);
        
        // Handle specific error cases
        if (error.response) {
            const { status, data } = error.response;
            
            // Handle authentication errors
            if (status === 401) {
                return res.status(401).json({ 
                    crmType: "hubSpot", 
                    error: 'Authentication failed',
                    message: data.message || 'Invalid or expired token',
                    action: 'Please authenticate with HubSpot first by calling /api/hubspot/oauth/init'
                });
            }
            
            // Handle validation errors
            if (status === 400) {
                return res.status(400).json({ 
                    crmType: "hubSpot", 
                    error: 'Validation error',
                    message: data.message || 'Invalid deal data',
                    details: data
                });
            }
            
            return res.status(status).json({ 
                crmType: "hubSpot", 
                error: data.message || 'Failed to create deal',
                details: data
            });
        }
        
        res.status(500).json({ 
            crmType: "hubSpot", 
            error: 'Internal server error',
            message: error.message
        });
    }
};


export const getDeal = async (req, res) => {
    try {
        const { dealId } = req.params;

        if (!dealId) {
            return res.status(400).json({ error: 'Missing required parameter: dealId' });
        }

        const accessToken = getAccessToken(req);

        const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/deals/${dealId}`, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ crmType: "hubSpot", data: response.data });
    } catch (error) {
        console.error('Error fetching deal:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};


export const getAllDeals = async (req, res) => {
    try {
        // Get access token with await
        const accessToken = await getAccessToken(req);

        let { limit = 10, after } = req.query;
        limit = parseInt(limit, 10) || 10;

        if (after && typeof after !== 'string') {
            return res.status(400).json({ 
                crmType: "hubSpot", 
                error: 'Invalid "after" parameter' 
            });
        }

        const response = await axios.get(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/deals`,
            {
            headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
            },
            params: {
                limit,
                after: after || undefined,
                    properties: [
                        'dealname',
                        'amount',
                        'pipeline',
                        'dealstage',
                        'closedate'
                    ]
                }
            }
        );

        const { results, paging, total } = response.data;

        res.status(200).json({
            crmType: "hubSpot",
            totalResults: total || results.length,
            deals: results.map(deal => ({
                id: deal.id,
                dealname: deal.properties?.dealname || null,
                amount: deal.properties?.amount || null,
                pipeline: deal.properties?.pipeline || null,
                dealstage: deal.properties?.dealstage || null,
                closedate: deal.properties?.closedate || null,
            })),
            paging: paging || null
        });
    } catch (error) {
        console.error('Error fetching deals:', error.response?.data || error.message);

        // Handle authentication errors specifically
        if (error.status === 401) {
            return res.status(401).json({
                crmType: "hubSpot",
                error: 'Authentication failed',
                message: error.message,
                action: 'Please authenticate with HubSpot first by calling /api/hubspot/oauth/init'
            });
        }

        // Handle other errors
        res.status(error.response?.status || 500).json({
            crmType: "hubSpot",
            error: error.response?.data || 'Internal Server Error'
        });
    }
};



export const updateDeal = async (req, res) => {
    try {
        const { dealId } = req.params;
        const { dealname, amount, pipeline, dealstage } = req.body;

        if (!dealId) {
            return res.status(400).json({ error: 'Missing required parameter: dealId' });
        }

        if (!dealname && !amount && !pipeline && !dealstage) {
            return res.status(400).json({ error: 'At least one field must be provided for update' });
        }

        const accessToken = getAccessToken(req);

        const dealObj = { properties: {} };
        if (dealname) dealObj.properties.dealname = dealname;
        if (amount) dealObj.properties.amount = amount;
        if (pipeline) dealObj.properties.pipeline = pipeline;
        if (dealstage) dealObj.properties.dealstage = dealstage;

        const response = await axios.patch(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/deals/${dealId}`, 
            dealObj, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ crmType: "hubSpot", data: response.data });
    } catch (error) {
        console.error('Error updating deal:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};


export const deleteDeal = async (req, res) => {
    try {
        const { dealId } = req.params;

        if (!dealId) {
            return res.status(400).json({ error: 'Missing required parameter: dealId' });
        }

        const accessToken = getAccessToken(req);

        await axios.delete(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/deals/${dealId}`, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(204).json({ crmType: "hubSpot", message: "Deal deleted successfully" });
    } catch (error) {
        console.error('Error deleting deal:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

// ... existing code ...

/////====Company====////

export const createCompany = async (req, res) => {
    try {
        // Required properties
        const { 
            name,          // Required - Company name
            domain         // Recommended - Company domain
        } = req.body;

        // Standard HubSpot properties
        const {
            phone,
            address,
            city,
            state,
            zip,
            country,
            description,
            website,
            industry,
            hubspot_owner_id,
            timezone,
            legal_entity
        } = req.body;

        // Validate required field
        if (!name) {
            return res.status(400).json({ 
                crmType: "hubSpot",
                error: 'Validation error',
                message: 'Missing required field: name',
                required: ['name'],
                received: { name }
            });
        }

        // Get access token
        let accessToken;
        try {
            accessToken = await getAccessToken(req);
        } catch (error) {
            return res.status(401).json({ 
                crmType: "hubSpot",
                error: 'Authentication failed', 
                message: error.message,
                action: 'Please authenticate with HubSpot first by calling /api/hubspot/oauth/init'
            });
        }

        // Build company object with valid HubSpot properties
        const companyObj = {
            properties: {
                // Required
                name,
                
                // Standard properties
                domain: domain || '',
                phone: phone || '',
                address: phone || '',
                city: city || '',
                state: state || '',
                zip: zip || '',
                country: country || '',
                description: description || '',
                website: website || '',
                industry: industry || '',
                hubspot_owner_id: hubspot_owner_id || '',
                timezone: timezone || '',
                legalentity: legal_entity || ''  // HubSpot's actual property name
            }
        };

        console.log('Creating company with data:', JSON.stringify(companyObj, null, 2));

        const response = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/companies`, 
            companyObj, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Company created successfully:', response.data);

        res.status(201).json({ 
            crmType: "hubSpot", 
            data: response.data,
            message: 'Company created successfully'
        });

    } catch (error) {
        console.error('Error creating company:', error.response?.data || error.message);
        
        // Enhanced error handling
        if (error.response) {
            const { status, data } = error.response;
            
            // Handle property validation errors
            if (status === 400 && data?.category === 'VALIDATION_ERROR') {
                const invalidProperties = data.errors
                    .filter(e => e.code === 'PROPERTY_DOESNT_EXIST')
                    .map(e => e.context.name);

                if (invalidProperties.length > 0) {
                    return res.status(400).json({ 
                        crmType: "hubSpot",
                        error: 'Invalid Properties',
                        message: 'Some properties do not exist in HubSpot',
                        invalid_properties: invalidProperties,
                        valid_properties: [
                            'name', 'domain', 'phone', 'address', 'city',
                            'state', 'zip', 'country', 'description', 'website',
                            'industry', 'hubspot_owner_id', 'timezone', 'legalentity'
                        ]
                    });
                }
            }
            
            return res.status(status).json({ 
                crmType: "hubSpot", 
                error: data.message || 'Failed to create company',
                details: data
            });
        }
        
        res.status(500).json({ 
            crmType: "hubSpot", 
            error: 'Internal server error',
            message: error.message
        });
    }
};

export const getCompany = async (req, res) => {
    try {
        const { companyId } = req.params;

        if (!companyId) {
            return res.status(400).json({ error: 'Missing required parameter: companyId' });
        }

        const accessToken = getAccessToken(req);

        const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/companies/${companyId}`, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ crmType: "hubSpot", data: response.data });
    } catch (error) {
        console.error('Error fetching company:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const getAllCompanies = async (req, res) => {
    try {
    const accessToken = await getAccessToken(req);
    
    const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/companies`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
      params: {
        limit: 100,
        properties: ['name', 'domain', 'industry', 'website', 'phone', 'address', 'city', 'state', 'zip', 'country']
      }
        });

        res.status(200).json({
            crmType: "hubSpot",
      companies: response.data.results || []
        });
    } catch (error) {
        console.error('Error fetching companies:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to retrieve companies'
    });
    }
};

export const updateCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { name, domain, industry, phone } = req.body;

        if (!companyId) {
            return res.status(400).json({ error: 'Missing required parameter: companyId' });
        }

        if (!name && !domain && !industry && !phone) {
            return res.status(400).json({ error: 'At least one field must be provided for update' });
        }

        const accessToken = getAccessToken(req);

        // Map common industry names to HubSpot's expected values
        const industryMapping = {
            'Technology': 'COMPUTER_SOFTWARE',
            'Software': 'COMPUTER_SOFTWARE',
            'IT': 'INFORMATION_TECHNOLOGY_AND_SERVICES',
            'Finance': 'FINANCIAL_SERVICES',
            'Healthcare': 'HOSPITAL_HEALTH_CARE',
            'Education': 'EDUCATION_MANAGEMENT',
            'Retail': 'RETAIL',
            'Manufacturing': 'MECHANICAL_OR_INDUSTRIAL_ENGINEERING',
            'Real Estate': 'REAL_ESTATE',
            'Marketing': 'MARKETING_AND_ADVERTISING',
            'Consulting': 'MANAGEMENT_CONSULTING',
            'Legal': 'LAW_PRACTICE',
            'Media': 'MEDIA_PRODUCTION',
            'Telecom': 'TELECOMMUNICATIONS',
            'Transportation': 'TRANSPORTATION_TRUCKING_RAILROAD',
            'Energy': 'OIL_ENERGY',
            'Construction': 'CONSTRUCTION',
            'Hospitality': 'HOSPITALITY',
            'Agriculture': 'AGRICULTURE',
            'Pharmaceutical': 'PHARMACEUTICALS',
            'Insurance': 'INSURANCE',
            'Banking': 'BANKING',
            'Automotive': 'AUTOMOTIVE',
            'Aerospace': 'AVIATION_AEROSPACE',
            'Biotech': 'BIOTECHNOLOGY',
            'Chemical': 'CHEMICALS',
            'Defense': 'DEFENSE_SPACE',
            'Electronics': 'ELECTRICAL_ELECTRONIC_MANUFACTURING',
            'Entertainment': 'ENTERTAINMENT',
            'Food': 'FOOD_PRODUCTION',
            'Government': 'GOVERNMENT_ADMINISTRATION',
            'Nonprofit': 'NON_PROFIT_ORGANIZATION_MANAGEMENT',
            'Sports': 'SPORTS',
            'Textiles': 'TEXTILES',
            'Utilities': 'UTILITIES'
        };

        const companyObj = { properties: {} };
        if (name) companyObj.properties.name = name;
        if (domain) companyObj.properties.domain = domain;
        if (industry) companyObj.properties.industry = industryMapping[industry] || industry;
        if (phone) companyObj.properties.phone = phone;

        const response = await axios.patch(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/companies/${companyId}`, 
            companyObj, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ crmType: "hubSpot", data: response.data });
    } catch (error) {
        console.error('Error updating company:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const deleteCompany = async (req, res) => {
    try {
        const { companyId } = req.params;

        if (!companyId) {
            return res.status(400).json({ error: 'Missing required parameter: companyId' });
        }

        const accessToken = getAccessToken(req);

        await axios.delete(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/companies/${companyId}`, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ 
            crmType: "hubSpot", 
            message: "Company deleted successfully",
            data: {
                id: companyId,
                deleted: true
            }
        });
    } catch (error) {
        console.error('Error deleting company:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

/////====Ticket====////

export const createTicket = async (req, res) => {
    try {
        const { 
            // Required
            subject,
            content,
            
            // Optional
            priority = "MEDIUM",
            state = "OPEN",
            pipelineStage = "1",
            source = "EMAIL",
            category,
            tags,
            associated_object_type,
            associated_object_id,
            access_token 
        } = req.body;

        // Validate required fields
        if (!subject || !content) {
            return res.status(400).json({ 
                crmType: "hubSpot", 
                error: 'Validation error',
                message: 'Missing required fields',
                required: ['subject', 'content'],
                received: { subject, content }
            });
        }

        // Get access token
        let accessToken;
        try {
            accessToken = await getAccessToken(req);
        } catch (error) {
            return res.status(401).json({ 
                crmType: "hubSpot",
                error: 'Authentication failed', 
                message: error.message,
                action: 'Please authenticate with HubSpot first by calling /api/hubspot/oauth/init'
            });
        }

        // Validate priority
        const allowedPriorities = ["LOW", "MEDIUM", "HIGH"];
        const validatedPriority = allowedPriorities.includes(priority.toUpperCase()) ? priority.toUpperCase() : "MEDIUM";

        // Validate state
        const allowedStates = ["OPEN", "IN_PROGRESS", "WAITING", "CLOSED"];
        const validatedState = allowedStates.includes(state.toUpperCase()) ? state.toUpperCase() : "OPEN";

        // Map state to pipeline stage
        const stateToPipelineStage = {
            "OPEN": "1",
            "IN_PROGRESS": "2",
            "WAITING": "3",
            "CLOSED": "4"
        };

        // Format the ticket data according to HubSpot's API requirements
        const ticketObj = {
            properties: {
                subject,
                content,
                hs_ticket_priority: validatedPriority,
                hs_pipeline_stage: stateToPipelineStage[validatedState] || pipelineStage
            }
        };

        console.log('Creating ticket with data:', JSON.stringify(ticketObj, null, 2));

        const response = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/tickets`, 
            ticketObj, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Ticket created successfully:', response.data);

        res.status(201).json({ 
            crmType: "hubSpot", 
            data: response.data,
            message: 'Ticket created successfully'
        });
    } catch (error) {
        console.error('Error creating ticket:', error.response?.data || error.message);
        
        // Handle specific error cases
        if (error.response) {
            const { status, data } = error.response;
            
            // Handle authentication errors
            if (status === 401) {
                return res.status(401).json({ 
                    crmType: "hubSpot", 
                    error: 'Authentication failed',
                    message: data.message || 'Invalid or expired token',
                    action: 'Please authenticate with HubSpot first by calling /api/hubspot/oauth/init'
                });
            }
            
            // Handle validation errors
            if (status === 400) {
                return res.status(400).json({ 
                    crmType: "hubSpot", 
                    error: 'Validation error',
                    message: data.message || 'Invalid ticket data',
                    details: data
                });
            }
            
            return res.status(status).json({ 
                crmType: "hubSpot", 
                error: data.message || 'Failed to create ticket',
                details: data
            });
        }
        
        res.status(500).json({ 
            crmType: "hubSpot", 
            error: 'Internal server error',
            message: error.message
        });
    }
};

export const getTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;

        if (!ticketId) {
            return res.status(400).json({ error: 'Missing required parameter: ticketId' });
        }

        const accessToken = getAccessToken(req);

        const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/tickets/${ticketId}`, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ crmType: "hubSpot", data: response.data });
    } catch (error) {
        console.error('Error fetching ticket:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const getAllTickets = async (req, res) => {
    try {
    console.log('Starting to fetch all tickets...');
    const accessToken = await getAccessToken(req);
    console.log('Access token retrieved successfully');

    const {
      limit = 100,
      after,
      properties = [
        'hs_pipeline',
        'hs_pipeline_stage',
        'hs_ticket_priority',
        'subject',
        'content',
        'hs_ticket_category',
        'createdate',
        'lastmodifieddate'
      ],
      sort = 'lastmodifieddate',
      sortDirection = 'DESCENDING',
      filterGroups = []
    } = req.query;

    console.log('Request parameters:', {
      limit,
      after,
      properties,
      sort,
      sortDirection,
      filterGroups
    });

    const response = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/tickets`,
      {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
        params: {
          limit: parseInt(limit),
          after: after || undefined,
          properties,
          sorts: `${sort} ${sortDirection}`,
          filterGroups: filterGroups.length > 0 ? JSON.stringify(filterGroups) : undefined
        }
      }
    );

    console.log(`Successfully retrieved ${response.data.results.length} tickets`);
    return res.status(200).json({
            crmType: "hubSpot",
      total: response.data.total,
      tickets: response.data.results,
      paging: response.data.paging
        });
    } catch (error) {
    console.error('Error in getAllTickets:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to fetch tickets'
    });
    }
};

export const updateTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { subject, content, priority, state, pipelineStage } = req.body;

        if (!ticketId) {
            return res.status(400).json({ error: 'Missing required parameter: ticketId' });
        }

        if (!subject && !content && !priority && !state && !pipelineStage) {
            return res.status(400).json({ error: 'At least one field must be provided for update' });
        }

        const accessToken = getAccessToken(req);

        const ticketObj = { properties: {} };
        if (subject) ticketObj.properties.subject = subject;
        if (content) ticketObj.properties.content = content;
        if (priority) {
            const allowedPriorities = ["LOW", "MEDIUM", "HIGH"];
            ticketObj.properties.hs_ticket_priority = allowedPriorities.includes(priority.toUpperCase()) ? priority.toUpperCase() : "MEDIUM";
        }
        if (state) {
            const allowedStates = ["OPEN", "IN_PROGRESS", "WAITING", "CLOSED"];
            const validatedState = allowedStates.includes(state.toUpperCase()) ? state.toUpperCase() : "OPEN";
            
            // Map state to pipeline stage
            const stateToPipelineStage = {
                "OPEN": "1",
                "IN_PROGRESS": "2",
                "WAITING": "3",
                "CLOSED": "4"
            };
            ticketObj.properties.hs_pipeline_stage = stateToPipelineStage[validatedState];
        }
        if (pipelineStage) {
            // Ensure pipeline stage is valid (1-4)
            const validStages = ["1", "2", "3", "4"];
            if (validStages.includes(pipelineStage)) {
                ticketObj.properties.hs_pipeline_stage = pipelineStage;
            }
        }

        const response = await axios.patch(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/tickets/${ticketId}`, 
            ticketObj, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ crmType: "hubSpot", data: response.data });
    } catch (error) {
        console.error('Error updating ticket:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const deleteTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;

        if (!ticketId) {
            return res.status(400).json({ error: 'Missing required parameter: ticketId' });
        }

        const accessToken = getAccessToken(req);

        await axios.delete(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/tickets/${ticketId}`, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ 
            crmType: "hubSpot", 
            message: "Ticket deleted successfully",
            data: {
                id: ticketId,
                deleted: true
            }
        });
    } catch (error) {
        console.error('Error deleting ticket:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

///////////////////////// 

/////====Calls====////

export const logCall = async (req, res) => {
    try {
        const { toObjectType, toObjectId, fromObjectType, fromObjectId, status, duration, body, recordingUrl } = req.body;

        if (!toObjectType || !toObjectId || !status) {
            return res.status(400).json({ error: 'Missing required fields: toObjectType, toObjectId, status' });
        }

        const accessToken = await getAccessToken(req);

        const callObj = {
            properties: {
                hs_call_direction: fromObjectType ? 'OUTBOUND' : 'INBOUND',
                hs_call_status: status.toUpperCase(),
                hs_call_duration: duration || 0,
                hs_call_body: body || '',
                hs_call_recording_url: recordingUrl || '',
                hs_timestamp: new Date().getTime()
            },
            associations: [
                {
                    to: { id: toObjectId },
                    types: [{ category: "CALL", typeId: toObjectType }]
                }
            ]
        };

        if (fromObjectId && fromObjectType) {
            callObj.associations.push({
                to: { id: fromObjectId },
                types: [{ category: "CALL", typeId: fromObjectType }]
            });
        }

        const response = await axios.post(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/calls`, 
            callObj, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(201).json({ crmType: "hubSpot", data: response.data });
    } catch (error) {
        console.error('Error logging call:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const getAllCalls = async (req, res) => {
    try {
        const accessToken = await getAccessToken(req);

        let { limit = 10, after, objectType, objectId } = req.query;
        limit = parseInt(limit, 10) || 10;

        if (after && typeof after !== 'string') {
            return res.status(400).json({ crmType: "hubSpot", error: 'Invalid "after" parameter' });
        }

        let url = `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/calls`;
        
        // If objectType and objectId are provided, get calls associated with that object
        if (objectType && objectId) {
            url = `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/${objectType}/${objectId}/associations/calls`;
        }

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            params: { 
                limit, 
                after: after || undefined,
                properties: ['hs_call_direction', 'hs_call_status', 'hs_call_duration', 'hs_call_body', 'hs_call_recording_url', 'hs_timestamp']
            }
        });

        const { results, paging, total } = response.data;

        res.status(200).json({
            crmType: "hubSpot",
            totalResults: total || results.length,
            calls: results.map(call => ({
                id: call.id,
                direction: call.properties?.hs_call_direction || null,
                status: call.properties?.hs_call_status || null,
                duration: call.properties?.hs_call_duration || null,
                body: call.properties?.hs_call_body || null,
                recordingUrl: call.properties?.hs_call_recording_url || null,
                timestamp: call.properties?.hs_timestamp || null
            })),
            paging: paging || null
        });
    } catch (error) {
        console.error('Error fetching calls:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

/**
 * Create a new call in HubSpot
 * POST /api/hubspot/calls/create
 */
export const createCall = async (req, res) => {
  try {
    console.log('Starting call creation process...');
    const accessToken = await getAccessToken(req);
    console.log('Access token retrieved successfully');

    const {
      // Required fields - using correct HubSpot property names
      hs_call_body,                     // Call notes/description (REQUIRED)
      hs_call_status,                   // Call status (REQUIRED)
      
      // Optional call details
      hs_call_direction,                // INBOUND, OUTBOUND
      hs_call_duration,                 // Duration in milliseconds
      hs_call_from_number,              // Caller's phone number
      hs_call_to_number,                // Recipient's phone number
      hs_call_recording_url,            // URL to call recording
      hs_call_source,                   // Source of the call
      hs_call_disposition,              // Call outcome/disposition
      
      // Timestamps
      hs_timestamp,                     // Call timestamp (defaults to now)
      
      // Associations
      contactIds = [],                  // Array of contact IDs to associate
      companyIds = [],                  // Array of company IDs to associate
      dealIds = [],                     // Array of deal IDs to associate
      ticketIds = [],                   // Array of ticket IDs to associate
      
      // Additional properties
      hubspot_owner_id,                 // Owner of the call
      
      // Custom properties
      ...customProperties
    } = req.body;

    console.log('Request body:', {
      hs_call_body,
      hs_call_status,
      hs_call_direction,
      hs_call_duration,
      contactIds: contactIds.length,
      companyIds: companyIds.length,
      dealIds: dealIds.length,
      ticketIds: ticketIds.length
    });

    // Validate required fields - HubSpot requires hs_call_body and hs_call_status
    if (!hs_call_body || !hs_call_status) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Missing required fields: hs_call_body and hs_call_status are required'
      });
    }

    // Validate call status
    const validStatuses = ['BUSY', 'CALLING_CRM_USER', 'CANCELED', 'COMPLETED', 'CONNECTING', 'FAILED', 'IN_PROGRESS', 'NO_ANSWER', 'QUEUED', 'RINGING'];
    if (!validStatuses.includes(hs_call_status.toUpperCase())) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: `Invalid call status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Validate call direction if provided
    if (hs_call_direction && !['INBOUND', 'OUTBOUND'].includes(hs_call_direction.toUpperCase())) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Invalid call direction. Must be INBOUND or OUTBOUND'
      });
    }

    // Prepare call data with only valid HubSpot properties
    const callData = {
      properties: {
        hs_call_body: hs_call_body,
        hs_call_status: hs_call_status.toUpperCase(),
        hs_call_direction: hs_call_direction ? hs_call_direction.toUpperCase() : 'OUTBOUND',
        hs_timestamp: hs_timestamp ? new Date(hs_timestamp).getTime() : new Date().getTime()
      }
    };

    // Add optional properties only if provided
    if (hs_call_duration !== undefined) callData.properties.hs_call_duration = parseInt(hs_call_duration);
    if (hs_call_from_number) callData.properties.hs_call_from_number = hs_call_from_number;
    if (hs_call_to_number) callData.properties.hs_call_to_number = hs_call_to_number;
    if (hs_call_recording_url) callData.properties.hs_call_recording_url = hs_call_recording_url;
    if (hs_call_source) callData.properties.hs_call_source = hs_call_source;
    if (hs_call_disposition) callData.properties.hs_call_disposition = hs_call_disposition;
    if (hubspot_owner_id) callData.properties.hubspot_owner_id = hubspot_owner_id;

    // Add custom properties
    Object.keys(customProperties).forEach(key => {
      if (customProperties[key] !== undefined && customProperties[key] !== null) {
        callData.properties[key] = customProperties[key];
      }
    });

    console.log('Creating call with data:', JSON.stringify(callData, null, 2));

    const response = await axios.post(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/calls`,
      callData,
      {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Call created successfully:', response.data);
    const callId = response.data.id;

    // Handle associations
    const associations = [];
    
    // Associate with contacts
    if (contactIds.length > 0) {
      for (const contactId of contactIds) {
        try {
          await axios.put(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/calls/${callId}/associations/contacts/${contactId}/call_to_contact`,
            {},
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          associations.push({ type: 'contact', id: contactId });
          console.log(`Call associated with contact ${contactId}`);
        } catch (assocError) {
          console.warn(`Failed to associate with contact ${contactId}:`, assocError.message);
        }
      }
    }

    // Associate with companies
    if (companyIds.length > 0) {
      for (const companyId of companyIds) {
        try {
          await axios.put(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/calls/${callId}/associations/companies/${companyId}/call_to_company`,
            {},
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          associations.push({ type: 'company', id: companyId });
          console.log(`Call associated with company ${companyId}`);
        } catch (assocError) {
          console.warn(`Failed to associate with company ${companyId}:`, assocError.message);
        }
      }
    }

    // Associate with deals
    if (dealIds.length > 0) {
      for (const dealId of dealIds) {
        try {
          await axios.put(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/calls/${callId}/associations/deals/${dealId}/call_to_deal`,
            {},
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          associations.push({ type: 'deal', id: dealId });
          console.log(`Call associated with deal ${dealId}`);
        } catch (assocError) {
          console.warn(`Failed to associate with deal ${dealId}:`, assocError.message);
        }
      }
    }

    // Associate with tickets
    if (ticketIds.length > 0) {
      for (const ticketId of ticketIds) {
        try {
          await axios.put(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/calls/${callId}/associations/tickets/${ticketId}/call_to_ticket`,
            {},
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          associations.push({ type: 'ticket', id: ticketId });
          console.log(`Call associated with ticket ${ticketId}`);
        } catch (assocError) {
          console.warn(`Failed to associate with ticket ${ticketId}:`, assocError.message);
        }
      }
    }

    console.log('Call creation process completed successfully');
    res.status(201).json({
      crmType: "hubSpot",
      success: true,
      data: response.data,
      associations: associations,
      message: 'Call created successfully'
    });
  } catch (error) {
    console.error('Error in createCall:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data?.message || error.message || 'Failed to create call',
      details: error.response?.data
    });
  }
};

/**
 * Get a specific call by ID
 * GET /api/hubspot/calls/:callId
 */
export const getCallById = async (req, res) => {
  try {
    console.log('Starting get call by ID process...');
    const accessToken = await getAccessToken(req);
    const { callId } = req.params;
    const { properties, associations } = req.query;

    console.log('Request params:', { callId, properties, associations });

    if (!callId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Call ID is required'
      });
    }

    // Default properties to fetch
    const defaultProperties = [
      'hs_call_title',
      'hs_call_body',
      'hs_call_status',
      'hs_call_direction',
      'hs_call_duration',
      'hs_call_from_number',
      'hs_call_to_number',
      'hs_call_recording_url',
      'hs_call_source',
      'hs_call_source_id',
      'hs_call_disposition',
      'hs_timestamp',
      'hs_call_start_time',
      'hs_call_end_time',
      'hubspot_owner_id',
      'hs_call_callee_object_id',
      'hs_call_callee_object_type',
      'hs_createdate',
      'hs_lastmodifieddate'
    ];

    const propertiesToFetch = properties ? properties.split(',') : defaultProperties;
    const associationsToFetch = associations ? associations.split(',') : ['contacts', 'companies', 'deals', 'tickets'];

    console.log('Fetching call with properties:', propertiesToFetch);
    console.log('Fetching associations:', associationsToFetch);

    const response = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/calls/${callId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          properties: propertiesToFetch.join(','),
          associations: associationsToFetch.join(',')
        }
      }
    );

    console.log('Call retrieved successfully');
    res.status(200).json({
      crmType: "hubSpot",
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Error in getCallById:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    if (error.response?.status === 404) {
      res.status(404).json({
        crmType: "hubSpot",
        error: 'Call not found'
      });
    } else {
      res.status(error.response?.status || 500).json({
        crmType: "hubSpot",
        error: error.response?.data?.message || error.message || 'Failed to retrieve call',
        details: error.response?.data
      });
    }
  }
};

/**
 * Update a call
 * PUT /api/hubspot/calls/:callId
 */
export const updateCall = async (req, res) => {
  try {
    console.log('Starting call update process...');
    const accessToken = await getAccessToken(req);
    const { callId } = req.params;

    console.log('Request params:', { callId });
    console.log('Request body:', req.body);

    if (!callId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Call ID is required'
      });
    }

    const {
      hs_call_title,
      hs_call_body,
      hs_call_status,
      hs_call_direction,
      hs_call_duration,
      hs_call_from_number,
      hs_call_to_number,
      hs_call_recording_url,
      hs_call_source,
      hs_call_source_id,
      hs_call_disposition,
      hs_call_start_time,
      hs_call_end_time,
      hubspot_owner_id,
      hs_call_callee_object_id,
      hs_call_callee_object_type,
      ...customProperties
    } = req.body;

    // Validate call status if provided
    if (hs_call_status) {
      const validStatuses = ['BUSY', 'CALLING_CRM_USER', 'CANCELED', 'COMPLETED', 'CONNECTING', 'FAILED', 'IN_PROGRESS', 'NO_ANSWER', 'QUEUED', 'RINGING'];
      if (!validStatuses.includes(hs_call_status.toUpperCase())) {
        return res.status(400).json({
          crmType: "hubSpot",
          error: `Invalid call status. Must be one of: ${validStatuses.join(', ')}`
        });
      }
    }

    // Validate call direction if provided
    if (hs_call_direction && !['INBOUND', 'OUTBOUND'].includes(hs_call_direction.toUpperCase())) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Invalid call direction. Must be INBOUND or OUTBOUND'
      });
    }

    // Prepare update data
    const updateData = {
      properties: {}
    };

    // Add properties that are provided
    if (hs_call_title !== undefined) updateData.properties.hs_call_title = hs_call_title;
    if (hs_call_body !== undefined) updateData.properties.hs_call_body = hs_call_body;
    if (hs_call_status !== undefined) updateData.properties.hs_call_status = hs_call_status.toUpperCase();
    if (hs_call_direction !== undefined) updateData.properties.hs_call_direction = hs_call_direction.toUpperCase();
    if (hs_call_duration !== undefined) updateData.properties.hs_call_duration = parseInt(hs_call_duration);
    if (hs_call_from_number !== undefined) updateData.properties.hs_call_from_number = hs_call_from_number;
    if (hs_call_to_number !== undefined) updateData.properties.hs_call_to_number = hs_call_to_number;
    if (hs_call_recording_url !== undefined) updateData.properties.hs_call_recording_url = hs_call_recording_url;
    if (hs_call_source !== undefined) updateData.properties.hs_call_source = hs_call_source;
    if (hs_call_source_id !== undefined) updateData.properties.hs_call_source_id = hs_call_source_id;
    if (hs_call_disposition !== undefined) updateData.properties.hs_call_disposition = hs_call_disposition;
    if (hs_call_start_time !== undefined) updateData.properties.hs_call_start_time = new Date(hs_call_start_time).getTime();
    if (hs_call_end_time !== undefined) updateData.properties.hs_call_end_time = new Date(hs_call_end_time).getTime();
    if (hubspot_owner_id !== undefined) updateData.properties.hubspot_owner_id = hubspot_owner_id;
    if (hs_call_callee_object_id !== undefined) updateData.properties.hs_call_callee_object_id = hs_call_callee_object_id;
    if (hs_call_callee_object_type !== undefined) updateData.properties.hs_call_callee_object_type = hs_call_callee_object_type;

    // Add custom properties
    Object.keys(customProperties).forEach(key => {
      updateData.properties[key] = customProperties[key];
    });

    console.log('Updating call with data:', JSON.stringify(updateData, null, 2));

    const response = await axios.patch(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/calls/${callId}`,
      updateData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Call updated successfully');
    res.status(200).json({
      crmType: "hubSpot",
      success: true,
      data: response.data,
      message: 'Call updated successfully'
    });
  } catch (error) {
    console.error('Error in updateCall:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    if (error.response?.status === 404) {
      res.status(404).json({
        crmType: "hubSpot",
        error: 'Call not found'
      });
    } else {
      res.status(error.response?.status || 500).json({
        crmType: "hubSpot",
        error: error.response?.data?.message || error.message || 'Failed to update call',
        details: error.response?.data
      });
    }
  }
};

/**
 * Delete a call
 * DELETE /api/hubspot/calls/:callId
 */
export const deleteCall = async (req, res) => {
  try {
    console.log('Starting call deletion process...');
    const accessToken = await getAccessToken(req);
    const { callId } = req.params;

    console.log('Request params:', { callId });

    if (!callId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Call ID is required'
      });
    }

    console.log(`Deleting call with ID: ${callId}`);

    await axios.delete(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/calls/${callId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Call deleted successfully');
    res.status(200).json({
      crmType: "hubSpot",
      success: true,
      message: 'Call deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteCall:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    if (error.response?.status === 404) {
      res.status(404).json({
        crmType: "hubSpot",
        error: 'Call not found'
      });
    } else {
      res.status(error.response?.status || 500).json({
        crmType: "hubSpot",
        error: error.response?.data?.message || error.message || 'Failed to delete call',
        details: error.response?.data
      });
    }
  }
};

/**
 * Search calls with filters
 * POST /api/hubspot/calls/search
 */
export const searchCalls = async (req, res) => {
  try {
    console.log('Starting call search process...');
    const accessToken = await getAccessToken(req);

    const {
      filters = [],
      sorts = [],
      query = '',
      properties = [],
      limit = 10,
      after = 0
    } = req.body;

    console.log('Search parameters:', {
      filters: filters.length,
      sorts: sorts.length,
      query,
      properties: properties.length,
      limit,
      after
    });

    // Default properties to fetch
    const defaultProperties = [
      'hs_call_title',
      'hs_call_body',
      'hs_call_status',
      'hs_call_direction',
      'hs_call_duration',
      'hs_call_from_number',
      'hs_call_to_number',
      'hs_call_recording_url',
      'hs_timestamp',
      'hubspot_owner_id',
      'hs_createdate',
      'hs_lastmodifieddate'
    ];

    const searchData = {
      filterGroups: filters.length > 0 ? [{ filters }] : [],
      sorts: sorts.length > 0 ? sorts : [{ propertyName: 'hs_createdate', direction: 'DESCENDING' }],
      properties: properties.length > 0 ? properties : defaultProperties,
      limit: Math.min(parseInt(limit) || 10, 100),
      after: parseInt(after) || 0
    };

    // Add query search if provided
    if (query) {
      searchData.query = query;
    }

    console.log('Searching calls with data:', JSON.stringify(searchData, null, 2));

    const response = await axios.post(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/calls/search`,
      searchData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`Found ${response.data.results?.length || 0} calls`);
    res.status(200).json({
      crmType: "hubSpot",
      success: true,
      data: response.data,
      totalResults: response.data.total || response.data.results?.length || 0
    });
  } catch (error) {
    console.error('Error in searchCalls:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data?.message || error.message || 'Failed to search calls',
      details: error.response?.data
    });
  }
};

/**
 * Get call properties
 * GET /api/hubspot/calls/properties
 */
export const getCallProperties = async (req, res) => {
  try {
    console.log('Starting get call properties process...');
    const accessToken = await getAccessToken(req);

    console.log('Fetching call properties...');

    const response = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/properties/calls`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`Retrieved ${response.data.results?.length || 0} call properties`);
    res.status(200).json({
      crmType: "hubSpot",
      success: true,
      data: response.data,
      totalResults: response.data.results?.length || 0
    });
  } catch (error) {
    console.error('Error in getCallProperties:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data?.message || error.message || 'Failed to retrieve call properties',
      details: error.response?.data
    });
  }
};

/**
 * Batch operations for calls
 * POST /api/hubspot/calls/batch
 */
export const batchCalls = async (req, res) => {
  try {
    console.log('Starting batch call operations...');
    const accessToken = await getAccessToken(req);

    const { operation, inputs } = req.body;

    if (!operation || !inputs || !Array.isArray(inputs)) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Operation and inputs array are required'
      });
    }

    const validOperations = ['create', 'read', 'update', 'delete'];
    if (!validOperations.includes(operation.toLowerCase())) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: `Invalid operation. Must be one of: ${validOperations.join(', ')}`
      });
    }

    console.log(`Performing batch ${operation} on ${inputs.length} calls`);

    const batchData = {
      inputs: inputs
    };

    const response = await axios.post(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/calls/batch/${operation.toLowerCase()}`,
      batchData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`Batch ${operation} completed successfully`);
    res.status(200).json({
      crmType: "hubSpot",
      success: true,
      data: response.data,
      operation: operation,
      processedCount: response.data.results?.length || 0
    });
  } catch (error) {
    console.error('Error in batchCalls:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data?.message || error.message || 'Failed to perform batch operation',
      details: error.response?.data
    });
  }
};

// ... existing code ...

/////====Email====////

export const logEmail = async (req, res) => {
    try {
        const { toObjectType, toObjectId, fromObjectType, fromObjectId, subject, body, status, html } = req.body;

        if (!toObjectType || !toObjectId || !subject || !status) {
            return res.status(400).json({ error: 'Missing required fields: toObjectType, toObjectId, subject, status' });
        }

        const accessToken = getAccessToken(req);

        const emailObj = {
            properties: {
                hs_email_direction: fromObjectType ? 'OUTBOUND' : 'INBOUND',
                hs_email_status: status.toUpperCase(),
                hs_email_subject: subject,
                hs_email_body: body || '',
                hs_email_html: html || '',
                hs_timestamp: new Date().getTime()
            },
            associations: [
                {
                    to: { id: toObjectId },
                    types: [{ category: "EMAIL", typeId: toObjectType }]
                }
            ]
        };

        if (fromObjectId && fromObjectType) {
            emailObj.associations.push({
                to: { id: fromObjectId },
                types: [{ category: "EMAIL", typeId: fromObjectType }]
            });
        }

        const response = await axios.post(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/emails`, 
            emailObj, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(201).json({ crmType: "hubSpot", data: response.data });
    } catch (error) {
        console.error('Error logging email:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const getAllEmails = async (req, res) => {
    try {
        const accessToken = getAccessToken(req);

        let { limit = 10, after, objectType, objectId } = req.query;
        limit = parseInt(limit, 10) || 10;

        if (after && typeof after !== 'string') {
            return res.status(400).json({ crmType: "hubSpot", error: 'Invalid "after" parameter' });
        }

        let url = `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/emails`;
        
        // If objectType and objectId are provided, get emails associated with that object
        if (objectType && objectId) {
            url = `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/${objectType}/${objectId}/associations/emails`;
        }

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            params: { 
                limit, 
                after: after || undefined,
                properties: ['hs_email_direction', 'hs_email_status', 'hs_email_subject', 'hs_email_body', 'hs_email_html', 'hs_timestamp']
            }
        });

        const { results, paging, total } = response.data;

        res.status(200).json({
            crmType: "hubSpot",
            totalResults: total || results.length,
            emails: results.map(email => ({
                id: email.id,
                direction: email.properties?.hs_email_direction || null,
                status: email.properties?.hs_email_status || null,
                subject: email.properties?.hs_email_subject || null,
                body: email.properties?.hs_email_body || null,
                html: email.properties?.hs_email_html || null,
                timestamp: email.properties?.hs_timestamp || null
            })),
            paging: paging || null
        });
    } catch (error) {
        console.error('Error fetching emails:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

/////====Notes====////

/**
 * Create a new note
 * @route POST /api/hubspot/notes/create
 * @body {Object} body - The note data
 * @body {string} body.body - Required: The content of the note
 * @body {string} body.associatedObjectType - Required: The type of object this note is associated with (e.g., 'contacts', 'companies', 'deals')
 * @body {string} body.associatedObjectId - Required: The ID of the object this note is associated with
 * @body {string} [body.subject] - Optional: The subject of the note
 * @body {string} [body.engagementType] - Optional: The type of engagement (e.g., 'EMAIL', 'CALL', 'MEETING')
 */
export const createNote = async (req, res) => {
    try {
        console.log('Starting note creation process...');
        const { body, associatedObjectType, associatedObjectId, subject, engagementType, parentObjectSearch } = req.body;
        
        console.log('Request body:', {
            body,
            associatedObjectType,
            associatedObjectId,
            subject,
            engagementType,
            parentObjectSearch
        });

        // Get access token with await
        const accessToken = await getAccessToken(req);
        console.log('Access token retrieved successfully');

        // If parentObjectSearch is provided, search for the parent object first
        let finalAssociatedObjectId = associatedObjectId;
        if (parentObjectSearch && !associatedObjectId) {
            console.log('Searching for parent object...');
            const searchResponse = await axios.post(
                `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/${associatedObjectType}/search`,
                {
                    filterGroups: [{
                        filters: Object.entries(parentObjectSearch).map(([key, value]) => ({
                            propertyName: key,
                            operator: 'CONTAINS',
                            value: value
                        }))
                    }],
                    limit: 1
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (searchResponse.data.results.length === 0) {
                console.log('No parent object found matching search criteria');
                return res.status(404).json({
                    crmType: "hubSpot",
                    success: false,
                    error: `No ${associatedObjectType} found matching the search criteria`
                });
            }

            finalAssociatedObjectId = searchResponse.data.results[0].id;
            console.log('Found parent object ID:', finalAssociatedObjectId);
        }

        // Validate required fields
        if (!body) {
            console.log('Validation failed: Missing body');
            return res.status(400).json({
                crmType: "hubSpot",
                success: false,
                error: 'Missing required field: body is required'
            });
        }

        // Create note object with only required properties
        const noteObj = {
            properties: {
                hs_note_body: body,
                hs_timestamp: new Date().getTime().toString()
            }
        };

        // Add optional properties if provided
        if (subject) {
            noteObj.properties.hs_note_subject = subject;
        }

        // Add associations if provided
        if (associatedObjectType && finalAssociatedObjectId) {
            noteObj.associations = [
                {
                    to: { id: finalAssociatedObjectId },
                    types: [{ 
                        associationCategory: "HUBSPOT_DEFINED",
                        associationTypeId: getAssociationTypeId(associatedObjectType)
                    }]
                }
            ];
        }

        console.log('Creating note with data:', JSON.stringify(noteObj, null, 2));

        const response = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/notes`,
            noteObj,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Note created successfully:', response.data);
        res.status(201).json({
            crmType: "hubSpot",
            success: true,
            data: response.data,
            message: 'Note created successfully'
        });
    } catch (error) {
        console.error('Error creating note:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        
        res.status(error.response?.status || 500).json({
            crmType: "hubSpot",
            success: false,
            error: 'Failed to create note',
            message: error.response?.data?.message || error.message,
            details: error.response?.data
        });
    }
};

// Helper function to get association type ID
function getAssociationTypeId(objectType) {
    const associationTypes = {
        'contacts': 202,
        'companies': 190,
        'deals': 214,
        'tickets': 216
    };
    return associationTypes[objectType] || 202; // Default to contact association
}

/**
 * Get all notes with optional filtering
 * @route GET /api/hubspot/notes
 * @query {number} [limit=10] - Number of notes to return
 * @query {string} [after] - Pagination token
 * @query {string} [objectType] - Filter notes by associated object type
 * @query {string} [objectId] - Filter notes by associated object ID
 */
export const getAllNotes = async (req, res) => {
    try {
        const accessToken = await getAccessToken(req);

        let { limit = 10, after, objectType, objectId } = req.query;
        limit = parseInt(limit, 10) || 10;

        if (after && typeof after !== 'string') {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid "after" parameter' 
            });
        }

        let url = `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/notes`;
        
        // If objectType and objectId are provided, get notes associated with that object
        if (objectType && objectId) {
            url = `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/${objectType}/${objectId}/associations/notes`;
        }

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            params: { 
                limit, 
                after: after || undefined,
                properties: ['hs_note_body', 'hs_timestamp', 'hs_note_subject', 'hs_engagement_type']
            }
        });

        const { results, paging, total } = response.data;

        res.status(200).json({
            success: true,
            totalResults: total || results.length,
            notes: results.map(note => ({
                id: note.id,
                body: note.properties?.hs_note_body || null,
                subject: note.properties?.hs_note_subject || null,
                engagementType: note.properties?.hs_engagement_type || null,
                timestamp: note.properties?.hs_timestamp || null,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt
            })),
            paging: paging || null
        });
    } catch (error) {
        console.error('Error fetching notes:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            success: false,
            error: error.response?.data || 'Internal Server Error' 
        });
    }
};

/**
 * Get a specific note by ID
 * @route GET /api/hubspot/notes/:noteId
 * @param {string} noteId - The ID of the note to retrieve
 */
export const getNoteById = async (req, res) => {
    try {
        const { noteId } = req.params;
        const accessToken = await getAccessToken(req);

        if (!noteId) {
            return res.status(400).json({
                success: false,
                error: 'Note ID is required'
            });
        }

        const response = await axios.get(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/notes/${noteId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    properties: ['hs_note_body', 'hs_timestamp', 'hs_note_subject', 'hs_engagement_type']
                }
            }
        );

        res.status(200).json({
            success: true,
            data: {
                id: response.data.id,
                body: response.data.properties?.hs_note_body || null,
                subject: response.data.properties?.hs_note_subject || null,
                engagementType: response.data.properties?.hs_engagement_type || null,
                timestamp: response.data.properties?.hs_timestamp || null,
                createdAt: response.data.createdAt,
                updatedAt: response.data.updatedAt
            }
        });
    } catch (error) {
        console.error('Error fetching note:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data || 'Internal Server Error'
        });
    }
};

/**
 * Update a note
 * @route PUT /api/hubspot/notes/:noteId
 * @param {string} noteId - The ID of the note to update
 * @body {Object} body - The note data to update
 * @body {string} [body.body] - The updated content of the note
 * @body {string} [body.subject] - The updated subject of the note
 * @body {string} [body.engagementType] - The updated engagement type
 */
export const updateNote = async (req, res) => {
    try {
        const { noteId } = req.params;
        const { body, subject, engagementType } = req.body;
        const accessToken = await getAccessToken(req);

        if (!noteId) {
            return res.status(400).json({
                success: false,
                error: 'Note ID is required'
            });
        }

        if (!body && !subject && !engagementType) {
            return res.status(400).json({
                success: false,
                error: 'At least one field to update is required'
            });
        }

        const updateData = {
            properties: {
                ...(body && { hs_note_body: body }),
                ...(subject && { hs_note_subject: subject }),
                ...(engagementType && { hs_engagement_type: engagementType })
            }
        };

        const response = await axios.patch(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/notes/${noteId}`,
            updateData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error updating note:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data || 'Internal Server Error'
        });
    }
};

/**
 * Delete a note
 * @route DELETE /api/hubspot/notes/:noteId
 * @param {string} noteId - The ID of the note to delete
 */
export const deleteNote = async (req, res) => {
    try {
        const { noteId } = req.params;
        const accessToken = await getAccessToken(req);

        if (!noteId) {
            return res.status(400).json({
                success: false,
                error: 'Note ID is required'
            });
        }

        await axios.delete(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/notes/${noteId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({
            success: true,
            message: 'Note deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting note:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data || 'Internal Server Error'
        });
    }
};

/////====Quotes====////

export const createQuote = async (req, res) => {
  try {
    console.log('Starting quote creation process...');
    const accessToken = await getAccessToken(req);
    console.log('Access token retrieved successfully');

    const {
      title,                   // Required: Quote title
      description,             // Optional: Quote description
      expirationDate,          // Optional: Quote expiration date (if not provided, defaults to 30 days from now)
      dealId,                  // Optional: Associated deal ID
      contactId,               // Optional: Associated contact ID
      companyId                // Optional: Associated company ID
    } = req.body;

    console.log('Request body:', {
      title,
      description,
      expirationDate,
      dealId,
      contactId,
      companyId
    });

    // Validate required fields
    if (!title) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Missing required field: title is required'
      });
    }

    // Extract expiration date from request body or set default (30 days from now)
    const defaultExpirationDate = new Date();
    defaultExpirationDate.setDate(defaultExpirationDate.getDate() + 30);
    const expirationTimestamp = expirationDate 
      ? new Date(expirationDate).getTime() 
      : defaultExpirationDate.getTime();

    // Create basic quote data with required properties only
    const quoteData = {
      properties: {
        hs_title: title,
        hs_expiration_date: expirationTimestamp.toString()
      }
    };

    console.log('Creating quote with data:', JSON.stringify(quoteData, null, 2));

    const quoteResponse = await axios.post(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes`,
      quoteData,
      {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Quote created successfully:', quoteResponse.data);

    // Handle associations if provided
    const associations = [];

    if (dealId) {
      try {
        await axios.put(
          `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes/${quoteResponse.data.id}/associations/deals/${dealId}/quote_to_deal`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        associations.push({ type: 'deal', id: dealId });
        console.log('Quote associated with deal successfully');
      } catch (assocError) {
        console.warn('Failed to associate with deal:', assocError.message);
      }
    }

    if (contactId) {
      try {
        await axios.put(
          `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes/${quoteResponse.data.id}/associations/contacts/${contactId}/quote_to_contact`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        associations.push({ type: 'contact', id: contactId });
        console.log('Quote associated with contact successfully');
      } catch (assocError) {
        console.warn('Failed to associate with contact:', assocError.message);
      }
    }

    if (companyId) {
      try {
        await axios.put(
          `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes/${quoteResponse.data.id}/associations/companies/${companyId}/quote_to_company`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        associations.push({ type: 'company', id: companyId });
        console.log('Quote associated with company successfully');
      } catch (assocError) {
        console.warn('Failed to associate with company:', assocError.message);
      }
    }

    console.log('Quote creation process completed successfully');
    return res.status(201).json({
      crmType: "hubSpot", 
      success: true,
      data: {
        quote: quoteResponse.data,
        associations: associations,
        message: 'Quote created successfully'
      }
    });
  } catch (error) {
    console.error('Error in createQuote:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      success: false,
      error: "Failed to create quote",
      message: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};

export const getAllQuotes = async (req, res) => {
    try {
        const accessToken = getAccessToken(req);

        let { limit = 10, after, dealId } = req.query;
        limit = parseInt(limit, 10) || 10;

        if (after && typeof after !== 'string') {
            return res.status(400).json({ crmType: "hubSpot", error: 'Invalid "after" parameter' });
        }

        let url = `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes`;
        
        // If dealId is provided, get quotes associated with that deal
        if (dealId) {
            url = `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/deals/${dealId}/associations/quotes`;
        }

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            params: { 
                limit, 
                after: after || undefined,
                properties: ['hs_quote_title', 'hs_quote_description', 'hs_quote_expiration_date', 'hs_quote_terms', 'hs_status']
            }
        });

        // Get line items for each quote
        const quotesWithLineItems = await Promise.all(response.data.results.map(async quote => {
            const lineItemsResponse = await axios.get(
                `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes/${quote.id}/associations/line_items`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                id: quote.id,
                title: quote.properties?.hs_quote_title || null,
                description: quote.properties?.hs_quote_description || null,
                expirationDate: quote.properties?.hs_quote_expiration_date || null,
                terms: quote.properties?.hs_quote_terms || null,
                status: quote.properties?.hs_status || null,
                lineItems: lineItemsResponse.data.results || []
            };
        }));

        res.status(200).json({
            crmType: "hubSpot",
            totalResults: response.data.total || quotesWithLineItems.length,
            quotes: quotesWithLineItems,
            paging: response.data.paging || null
        });
    } catch (error) {
        console.error('Error fetching quotes:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};


/////====Products====////

export const createProduct = async (req, res) => {
  try {
    console.log('Starting product creation process...');
    const accessToken = await getAccessToken(req);
    console.log('Access token retrieved successfully');

    const {
      name,                    // Required: Product name
      description,             // Optional: Product description
      price,                   // Required: Product price
      sku,                     // Optional: Stock keeping unit
      productType = 'service'  // Optional: Product type (defaults to "service")
    } = req.body;

    console.log('Request body:', {
      name,
      description,
      price,
      sku,
      productType
    });

    // Validate required fields
    if (!name || !price) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Missing required fields: name and price are required'
      });
    }

    // Validate price is a number
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Price must be a valid positive number'
      });
    }

    // Create basic product data with only guaranteed properties
    const productData = {
      properties: {
        name: name,
        description: description || '',
        price: numericPrice.toString()
      }
    };

    // Add SKU if provided
    if (sku) {
      productData.properties.hs_sku = sku;
    }

    console.log('Prepared product data:', JSON.stringify(productData, null, 2));

    const response = await axios.post(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/products`,
      productData,
      {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Product created successfully:', response.data);
    res.status(201).json({
      crmType: "hubSpot",
      product: response.data,
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('Error in createProduct:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to create product'
    });
  }
};

export const getProduct = async (req, res) => {
  try {
    console.log('Starting product retrieval process...');
    const accessToken = await getAccessToken(req);
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Product ID is required'
      });
    }

    console.log(`Fetching product with ID: ${productId}`);

    const response = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/products/${productId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          properties: [
            'name',
            'description',
            'price',
            'hs_sku',
            'hs_currency',
            'hs_recurring_billing_period',
            'hs_recurring_billing_frequency',
            'hs_product_type'
          ]
        }
      }
    );

    console.log('Product retrieved successfully');
    res.status(200).json({
      crmType: "hubSpot",
      product: response.data
    });
  } catch (error) {
    console.error('Error in getProduct:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to retrieve product'
    });
    }
};

export const getAllProducts = async (req, res) => {
  try {
    console.log('Starting products retrieval process...');
    const accessToken = await getAccessToken(req);
    const { limit = 100, after } = req.query;

    console.log('Query parameters:', { limit, after });

    const response = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/products`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          limit,
          after,
          properties: [
            'name',
            'description',
            'price',
            'hs_sku',
            'hs_currency',
            'hs_recurring_billing_period',
            'hs_recurring_billing_frequency',
            'hs_product_type'
          ]
        }
      }
    );

    console.log('Products retrieved successfully');
    res.status(200).json({
      crmType: "hubSpot",
      products: response.data.results || [],
      paging: response.data.paging
    });
  } catch (error) {
    console.error('Error in getAllProducts:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to retrieve products'
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    console.log('Starting product update process...');
    const accessToken = await getAccessToken(req);
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Product ID is required'
      });
    }

    const {
      name,
      description,
      price,
      currency,
      sku,
      hsRecurringBillingPeriod,
      hsRecurringBillingFrequency,
      hsProductType
    } = req.body;

    console.log('Update request body:', {
      name,
      description,
      price,
      currency,
      sku,
      hsRecurringBillingPeriod,
      hsRecurringBillingFrequency,
      hsProductType
    });

    const productData = {
      properties: {}
    };

    if (name) productData.properties.name = name;
    if (description) productData.properties.description = description;
    if (price) productData.properties.price = price.toString();
    if (currency) productData.properties.hs_currency = currency;
    if (sku) productData.properties.hs_sku = sku;
    if (hsRecurringBillingPeriod) productData.properties.hs_recurring_billing_period = hsRecurringBillingPeriod;
    if (hsRecurringBillingFrequency) productData.properties.hs_recurring_billing_frequency = hsRecurringBillingFrequency;
    if (hsProductType) productData.properties.hs_product_type = hsProductType;

    console.log('Prepared product update data:', JSON.stringify(productData, null, 2));

    const response = await axios.patch(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/products/${productId}`,
      productData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Product updated successfully');
    res.status(200).json({
      crmType: "hubSpot",
      product: response.data
    });
  } catch (error) {
    console.error('Error in updateProduct:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to update product'
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    console.log('Starting product deletion process...');
    const accessToken = await getAccessToken(req);
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Product ID is required'
      });
    }

    console.log(`Deleting product with ID: ${productId}`);

    await axios.delete(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/products/${productId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Product deleted successfully');
    res.status(200).json({
      crmType: "hubSpot",
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteProduct:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to delete product'
    });
  }
};

/////====Lists====////

export const createList = async (req, res) => {
  try {
    console.log('Starting list creation process...');
    const accessToken = await getAccessToken(req);
    console.log('Access token retrieved successfully');

    const {
      name,                    // Required: List name
      description,             // Optional: List description
      objectTypeId,            // Required: Object type ID (0-1 for contacts, 0-2 for companies, etc.)
      processingType,          // Required: Processing type (MANUAL, DYNAMIC)
      filters = []             // Optional: Filters for dynamic lists
    } = req.body;

    console.log('Request body:', {
      name,
      description,
      objectTypeId,
      processingType,
      filters
    });

    // Validate required fields - HubSpot requires name, objectTypeId, and processingType
    if (!name || !objectTypeId || !processingType) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Missing required fields: name, objectTypeId, and processingType are required'
      });
    }

    // Map object type names to IDs if string is provided
    const objectTypeMapping = {
      'CONTACT': '0-1',
      'COMPANY': '0-2', 
      'DEAL': '0-3',
      'TICKET': '0-5',
      'PRODUCT': '0-7',
      'LINE_ITEM': '0-8',
      'QUOTE': '0-14'
    };

    let finalObjectTypeId = objectTypeId;
    if (typeof objectTypeId === 'string' && objectTypeMapping[objectTypeId.toUpperCase()]) {
      finalObjectTypeId = objectTypeMapping[objectTypeId.toUpperCase()];
    }

    // Validate processing type
    const validProcessingTypes = ['MANUAL', 'DYNAMIC'];
    if (!validProcessingTypes.includes(processingType.toUpperCase())) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: `Invalid processing type. Must be one of: ${validProcessingTypes.join(', ')}`
      });
    }

    const listData = {
      name: name,
      objectTypeId: finalObjectTypeId,
      processingType: processingType.toUpperCase()
    };

    // Add optional description
    if (description) {
      listData.description = description;
    }

    // Add filters for dynamic lists
    if (processingType.toUpperCase() === 'DYNAMIC' && filters.length > 0) {
      listData.filterBranch = {
        filterBranchType: 'AND',
        filters: filters
      };
    }

    console.log('Prepared list data:', JSON.stringify(listData, null, 2));

    const response = await axios.post(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/lists`,
      listData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('List created successfully:', response.data);
    return res.status(201).json({
      crmType: "hubSpot",
      success: true,
      data: response.data,
      message: 'List created successfully'
    });
  } catch (error) {
    console.error('Error in createList:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data?.message || error.message || 'Failed to create list',
      details: error.response?.data
    });
  }
};

export const getAllLists = async (req, res) => {
    try {
        const accessToken = getAccessToken(req);

        let { limit = 10, offset = 0, listType } = req.query;
        limit = parseInt(limit, 10) || 10;
        offset = parseInt(offset, 10) || 0;

        const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/contacts/v1/lists`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            params: { 
                count: limit,
                offset,
                listType: listType || undefined
            }
        });

        const { lists, 'has-more': hasMore, offset: newOffset } = response.data;

        res.status(200).json({
            crmType: "hubSpot",
            totalResults: lists.length,
            lists: lists.map(list => ({
                id: list.listId,
                name: list.name,
                description: list.description,
                listType: list.listType,
                dynamic: list.dynamic,
                memberCount: list.memberCount,
                portalId: list.portalId,
                folderId: list.folderId
            })),
            pagination: {
                hasMore,
                offset: newOffset
            }
        });
    } catch (error) {
        console.error('Error fetching lists:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const getListById = async (req, res) => {
    try {
        const { listId } = req.params;

        if (!listId) {
            return res.status(400).json({ error: 'Missing required parameter: listId' });
        }

        const accessToken = getAccessToken(req);

        const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/contacts/v1/lists/${listId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        res.status(200).json({ 
            crmType: "hubSpot", 
            data: response.data
        });
    } catch (error) {
        console.error('Error fetching list:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const updateList = async (req, res) => {
    try {
        const { listId } = req.params;
        const { name, description, listType, dynamic, filters, folderId } = req.body;

        if (!listId) {
            return res.status(400).json({ error: 'Missing required parameter: listId' });
        }

        if (!name && !description && !listType && !dynamic && !filters && !folderId) {
            return res.status(400).json({ error: 'At least one field must be provided for update' });
        }

        const accessToken = getAccessToken(req);

        const listObj = {};
        if (name) listObj.name = name;
        if (description) listObj.description = description;
        if (listType) listObj.listType = listType.toUpperCase();
        if (dynamic !== undefined) listObj.dynamic = dynamic;
        if (filters) listObj.filters = filters;
        if (folderId) listObj.folderId = folderId;

        const response = await axios.put(
            `${HUBSPOT_CONFIG.apiBaseUrl}/contacts/v1/lists/${listId}`, 
            listObj, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ crmType: "hubSpot", data: response.data });
    } catch (error) {
        console.error('Error updating list:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const deleteList = async (req, res) => {
    try {
        const { listId } = req.params;

        if (!listId) {
            return res.status(400).json({ error: 'Missing required parameter: listId' });
        }

        const accessToken = getAccessToken(req);

        await axios.delete(`${HUBSPOT_CONFIG.apiBaseUrl}/contacts/v1/lists/${listId}`, {
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        res.status(200).json({ 
            crmType: "hubSpot", 
            message: "List deleted successfully",
            data: {
                id: listId,
                deleted: true
            }
        });
    } catch (error) {
        console.error('Error deleting list:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const addMembersToList = async (req, res) => {
    try {
        const { listId } = req.params;
        const { members } = req.body;

        if (!listId || !members || !Array.isArray(members)) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['listId', 'members (array)']
            });
        }

        const accessToken = getAccessToken(req);

        const response = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/contacts/v1/lists/${listId}/members`, 
            { members }, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ 
            crmType: "hubSpot", 
            data: response.data,
            message: 'Members added successfully'
        });
    } catch (error) {
        console.error('Error adding members to list:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const removeMembersFromList = async (req, res) => {
    try {
        const { listId } = req.params;
        const { members } = req.body;

        if (!listId || !members || !Array.isArray(members)) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['listId', 'members (array)']
            });
        }

        const accessToken = getAccessToken(req);

        const response = await axios.delete(
            `${HUBSPOT_CONFIG.apiBaseUrl}/contacts/v1/lists/${listId}/members`, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                data: { members }
            }
        );

        res.status(200).json({ 
            crmType: "hubSpot", 
            data: response.data,
            message: 'Members removed successfully'
        });
    } catch (error) {
        console.error('Error removing members from list:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

// Example Postman test data for Lists:
/*
{
    "name": "Test List", // Required
    "description": "This is a test list", // Optional
    "listType": "STATIC", // Optional, default: "STATIC"
    "dynamic": false, // Optional, default: false
    "filters": [], // Optional, required for dynamic lists
    "members": [ // Optional, required for static lists
        {
            "email": "test@example.com"
        }
    ],
    "folderId": "123" // Optional
}
*/

/////====Inbox====////

export const getInboxMessages = async (req, res) => {
    try {
        const accessToken = getAccessToken(req);
        let { limit = 10, offset = 0, status } = req.query;
        limit = parseInt(limit, 10) || 10;
        offset = parseInt(offset, 10) || 0;

        const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/conversations/v3/conversations`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            params: { 
                limit, 
                offset,
                status: status || undefined
            }
        });

        const { results, paging } = response.data;

        res.status(200).json({
            crmType: "hubSpot",
            totalResults: results.length,
            messages: results.map(message => ({
                id: message.id,
                subject: message.subject,
                status: message.status,
                createdAt: message.createdAt,
                updatedAt: message.updatedAt,
                sender: message.sender,
                recipient: message.recipient,
                threadId: message.threadId
            })),
            pagination: {
                next: paging?.next,
                prev: paging?.prev
            }
        });
    } catch (error) {
        console.error('Error fetching inbox messages:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const getMessageById = async (req, res) => {
    try {
        const { messageId } = req.params;

        if (!messageId) {
            return res.status(400).json({ error: 'Missing required parameter: messageId' });
        }

        const accessToken = getAccessToken(req);

        const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/conversations/v3/conversations/${messageId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        res.status(200).json({ 
            crmType: "hubSpot", 
            data: response.data
        });
    } catch (error) {
        console.error('Error fetching message:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const updateMessageStatus = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { status } = req.body;

        if (!messageId || !status) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['messageId', 'status']
            });
        }

        const accessToken = getAccessToken(req);

        const response = await axios.patch(
            `${HUBSPOT_CONFIG.apiBaseUrl}/conversations/v3/conversations/${messageId}`, 
            { status }, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ 
            crmType: "hubSpot", 
            data: response.data,
            message: 'Message status updated successfully'
        });
    } catch (error) {
        console.error('Error updating message status:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};


export const sendReply = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content, attachments } = req.body;

        if (!messageId || !content) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['messageId', 'content']
            });
        }

        const accessToken = getAccessToken(req);

        const response = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/conversations/v3/conversations/${messageId}/messages`, 
            { 
                content,
                attachments: attachments || []
            }, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(201).json({ 
            crmType: "hubSpot", 
            data: response.data,
            message: 'Reply sent successfully'
        });
    } catch (error) {
        console.error('Error sending reply:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};




// Example Postman test data for Inbox:
/*
// Update message status
{
    "status": "READ" // Required: READ, UNREAD, ARCHIVED
}

// Send reply
{
    "content": "This is a reply message", // Required
    "attachments": [ // Optional
        {
            "name": "attachment.pdf",
            "url": "https://example.com/attachment.pdf"
        }
    ]
}
*/

/////====Playbooks====////

export const createPlaybook = async (req, res) => {
    try {
        const { name, description, steps } = req.body;

        if (!name || !steps || !Array.isArray(steps)) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['name', 'steps']
            });
        }

        const accessToken = getAccessToken(req);

        const response = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/playbooks`, 
            { 
                name,
                description: description || '',
                steps
            }, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(201).json({ 
            crmType: "hubSpot", 
            data: response.data,
            message: 'Playbook created successfully'
        });
    } catch (error) {
        console.error('Error creating playbook:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const getAllPlaybooks = async (req, res) => {
    try {
        const accessToken = getAccessToken(req);
        let { limit = 10, offset = 0 } = req.query;
        limit = parseInt(limit, 10) || 10;
        offset = parseInt(offset, 10) || 0;

        const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/playbooks`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            params: {
                limit,
                offset
            }
        });

        const { results, paging } = response.data;

        res.status(200).json({
            crmType: "hubSpot",
            totalResults: results.length,
            playbooks: results.map(playbook => ({
                id: playbook.id,
                name: playbook.name,
                description: playbook.description,
                createdAt: playbook.createdAt,
                updatedAt: playbook.updatedAt,
                steps: playbook.steps
            })),
            pagination: {
                next: paging?.next,
                prev: paging?.prev
            }
        });
    } catch (error) {
        console.error('Error fetching playbooks:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const getPlaybookById = async (req, res) => {
    try {
        const { playbookId } = req.params;

        if (!playbookId) {
            return res.status(400).json({ error: 'Missing required parameter: playbookId' });
        }

        const accessToken = getAccessToken(req);

        const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/playbooks/${playbookId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        res.status(200).json({ 
            crmType: "hubSpot", 
            data: response.data
        });
    } catch (error) {
        console.error('Error fetching playbook:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const updatePlaybook = async (req, res) => {
    try {
        const { playbookId } = req.params;
        const { name, description, steps } = req.body;

        if (!playbookId || !name || !steps || !Array.isArray(steps)) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['playbookId', 'name', 'steps']
            });
        }

        const accessToken = getAccessToken(req);

        const response = await axios.patch(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/playbooks/${playbookId}`, 
            { 
                name,
                description: description || '',
                steps
            }, 
            {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ 
            crmType: "hubSpot", 
            data: response.data,
            message: 'Playbook updated successfully'
        });
    } catch (error) {
        console.error('Error updating playbook:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

export const deletePlaybook = async (req, res) => {
    try {
        const { playbookId } = req.params;

        if (!playbookId) {
            return res.status(400).json({ error: 'Missing required parameter: playbookId' });
        }

        const accessToken = getAccessToken(req);

        await axios.delete(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/playbooks/${playbookId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        res.status(200).json({ 
            crmType: "hubSpot", 
            message: 'Playbook deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting playbook:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ crmType: "hubSpot", error: error.response?.data || 'Internal Server Error' });
    }
};

// Example Postman test data for Playbooks:
/*
// Create/Update playbook
{
    "name": "Sales Follow-up Playbook", // Required
    "description": "Automated follow-up sequence for new leads", // Optional
    "steps": [ // Required
        {
            "name": "Initial Contact",
            "type": "EMAIL",
            "delay": 0,
            "content": {
                "subject": "Welcome to our service",
                "body": "Thank you for your interest..."
            }
        },
        {
            "name": "Follow-up Call",
            "type": "TASK",
            "delay": 2,
            "content": {
                "title": "Schedule follow-up call",
                "description": "Call the lead to discuss their needs"
            }
        }
    ]
}
*/

/////====Forms====////

export const getForms = async (req, res) => {
  try {
    const accessToken = await getAccessToken(req);
    
    const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/marketing/v3/forms`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    res.status(200).json({
      crmType: "hubSpot",
      forms: response.data.results,
      paging: response.data.paging || null
    });
  } catch (error) {
    console.error('Error fetching forms:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to retrieve forms'
    });
  }
};

export const getFormById = async (req, res) => {
  try {
    const { formId } = req.params;
    const accessToken = await getAccessToken(req);
    
    const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/marketing/v3/forms/${formId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    res.status(200).json({
      crmType: "hubSpot",
      form: response.data
    });
  } catch (error) {
    console.error('Error fetching form:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to retrieve form'
    });
  }
};

/////====Meetings====////

export const getMeetings = async (req, res) => {
  try {
    const accessToken = await getAccessToken(req);
    
    const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/meetings`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            params: { 
        limit: 100,
        properties: ['hs_timestamp', 'hs_meeting_title', 'hs_meeting_body', 'hs_meeting_start_time', 'hs_meeting_end_time', 'hs_meeting_location', 'hs_meeting_outcome']
      }
    });
    
    res.status(200).json({
      crmType: "hubSpot",
      meetings: response.data.results || []
    });
  } catch (error) {
    console.error('Error fetching meetings:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to retrieve meetings'
    });
  }
};

export const createMeeting = async (req, res) => {
  try {
    console.log('Starting meeting creation process...');
    const accessToken = await getAccessToken(req);
    console.log('Access token retrieved successfully');
    
    // Validate required fields
    const { 
      title,
      description,
      startTime,
      endTime,
      attendees,
      location
    } = req.body;

    console.log('Request body:', {
      title,
      description,
      startTime,
      endTime,
      attendees,
      location
    });

    if (!title || !startTime || !endTime) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Missing required fields: title, startTime, and endTime are required'
      });
    }

    // Format the meeting data according to HubSpot's API requirements
    const meetingData = {
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_meeting_title: title,
        hs_meeting_body: description || '',
        hs_meeting_start_time: new Date(startTime).toISOString(),
        hs_meeting_end_time: new Date(endTime).toISOString(),
        hs_meeting_location: location || '',
        hs_meeting_outcome: 'SCHEDULED'
      }
    };

    console.log('Prepared meeting data:', JSON.stringify(meetingData, null, 2));

    // Create the meeting using the CRM API
    console.log('Sending request to create meeting...');
    const response = await axios.post(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/meetings`,
      meetingData,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

    console.log('Meeting created successfully:', response.data);

    // If there are attendees, associate them with the meeting
    if (attendees && attendees.length > 0) {
      console.log('Processing attendees associations...');
      const meetingId = response.data.id;
      
      // Associate each attendee with the meeting
      for (const attendeeId of attendees) {
        console.log(`Associating attendee ${attendeeId} with meeting ${meetingId}`);
        try {
          await axios.put(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/meetings/${meetingId}/associations/contacts/${attendeeId}/meeting_event_to_contact`,
            {},
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log(`Successfully associated attendee ${attendeeId}`);
        } catch (associationError) {
          console.error(`Failed to associate attendee ${attendeeId}:`, associationError.response?.data || associationError.message);
          // Continue with other attendees even if one fails
        }
      }
    }

    console.log('Meeting creation process completed successfully');
    res.status(201).json({
      crmType: "hubSpot",
      meeting: response.data
    });
  } catch (error) {
    console.error('Error in createMeeting:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to create meeting'
    });
  }
};

/////====Pipelines====////

export const getPipelines = async (req, res) => {
  try {
    const { objectType = 'deals' } = req.params;
    const accessToken = await getAccessToken(req);
    
    const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/pipelines/${objectType}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    res.status(200).json({
      crmType: "hubSpot",
      pipelines: response.data.results || [],
      paging: response.data.paging || null
    });
            } catch (error) {
    console.error('Error fetching pipelines:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to retrieve pipelines'
    });
  }
};

export const createPipeline = async (req, res) => {
  try {
    const { objectType = 'deals' } = req.params;
    const { 
      name, 
      stages,
      active = true
    } = req.body;
    
    if (!name || !stages || !stages.length) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: "Missing required fields",
        required: ["name", "stages"]
      });
    }
    
    const accessToken = await getAccessToken(req);
    
    const formattedStages = stages.map((stage, index) => ({
      label: stage.label,
      displayOrder: stage.displayOrder || index,
      metadata: {
        probability: stage.probability || 0.5
            }
        }));
    
    const pipelineObj = {
      label: name,
      displayOrder: 0,
      active,
      stages: formattedStages
    };
    
    const response = await axios.post(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/pipelines/${objectType}`,
      pipelineObj,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.status(201).json({
      crmType: "hubSpot",
      data: response.data,
      message: 'Pipeline created successfully'
    });
  } catch (error) {
    console.error('Error creating pipeline:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to create pipeline'
    });
  }
};

/////====Properties====////

export const getProperties = async (req, res) => {
  try {
    const { objectType } = req.params;
    const accessToken = await getAccessToken(req);
    
    const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/properties/${objectType}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

        res.status(200).json({
            crmType: "hubSpot",
      properties: response.data.results || [],
      paging: response.data.paging || null
        });
    } catch (error) {
    console.error('Error fetching properties:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to retrieve properties'
    });
  }
};

export const createProperty = async (req, res) => {
  try {
    const { objectType } = req.params;
    const { 
      name,
      label,
      description,
      groupName,
      type = 'string',
      fieldType = 'text',
      options = []
    } = req.body;
    
    if (!name || !label || !groupName) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: "Missing required fields",
        required: ["name", "label", "groupName"]
      });
    }
    
    const accessToken = await getAccessToken(req);
    
    const propertyObj = {
      name,
      label,
      description: description || "",
      groupName,
      type,
      fieldType,
      options: options.map(option => ({
        label: option.label,
        value: option.value,
        description: option.description || ""
      }))
    };
    
    const response = await axios.post(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/properties/${objectType}`,
      propertyObj,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.status(201).json({
      crmType: "hubSpot",
      data: response.data,
      message: 'Property created successfully'
    });
  } catch (error) {
    console.error('Error creating property:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to create property'
    });
  }
};

/////====Workflows====////

export const getWorkflows = async (req, res) => {
  try {
    const accessToken = await getAccessToken(req);
    
    const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/automation/v3/workflows`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    res.status(200).json({
      crmType: "hubSpot",
      workflows: response.data.workflows || [],
      paging: response.data.paging || null
    });
  } catch (error) {
    console.error('Error fetching workflows:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to retrieve workflows'
    });
  }
};

export const enrollInWorkflow = async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { email, contactId } = req.body;
    
    if (!workflowId || (!email && !contactId)) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: "Missing required fields",
        required: ["workflowId", "email or contactId"]
      });
    }
    
    const accessToken = await getAccessToken(req);
    
    const enrollmentObj = {
      emails: email ? [email] : [],
      ids: contactId ? [contactId] : []
    };
    
    const response = await axios.post(
      `${HUBSPOT_CONFIG.apiBaseUrl}/automation/v3/workflows/${workflowId}/enrollments`,
      enrollmentObj,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.status(200).json({
      crmType: "hubSpot",
      data: response.data,
      message: 'Successfully enrolled in workflow'
    });
  } catch (error) {
    console.error('Error enrolling in workflow:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to enroll in workflow'
    });
  }
};

/////====Analytics====////

export const getAnalytics = async (req, res) => {
  try {
    const { metric = 'visits' } = req.query;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: "Missing required date parameters",
        required: ["startDate", "endDate"]
      });
    }
    
    const accessToken = await getAccessToken(req);
    
    const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/analytics/v2/reports/${metric}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        start: startDate,
        end: endDate
      }
    });
    
    res.status(200).json({
      crmType: "hubSpot",
      analytics: response.data,
      metric
    });
  } catch (error) {
    console.error('Error fetching analytics:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to retrieve analytics'
    });
  }
};

/////====Custom Objects====////

export const getCustomObjects = async (req, res) => {
  try {
    const { objectType } = req.params;
    const accessToken = await getAccessToken(req);
    
    try {
      await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/schemas/${objectType}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      if (error.response?.status === 404) {
        return res.status(404).json({
          crmType: "hubSpot",
          error: `Custom object type "${objectType}" not found`,
          message: 'The custom object schema does not exist'
        });
      }
      throw error;
    }
    
    const response = await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/${objectType}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    res.status(200).json({
      crmType: "hubSpot",
      objects: response.data.results || [],
      paging: response.data.paging || null
    });
  } catch (error) {
    console.error('Error fetching custom objects:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to retrieve custom objects'
    });
  }
};

export const createCustomObject = async (req, res) => {
  try {
    const { objectType } = req.params;
    const { properties } = req.body;
    
    if (!properties || Object.keys(properties).length === 0) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: "Missing required fields",
        required: ["properties"]
      });
    }
    
    const accessToken = await getAccessToken(req);
    
    try {
      await axios.get(`${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/schemas/${objectType}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      if (error.response?.status === 404) {
        return res.status(404).json({
          crmType: "hubSpot",
          error: `Custom object type "${objectType}" not found`,
          message: 'The custom object schema does not exist'
        });
      }
      throw error;
    }
    
    const customObjectObj = {
      properties
    };
    
    const response = await axios.post(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/${objectType}`,
      customObjectObj,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.status(201).json({
      crmType: "hubSpot",
      data: response.data,
      message: 'Custom object created successfully'
    });
  } catch (error) {
    console.error('Error creating custom object:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to create custom object'
    });
    }
};


export const getQuote = async (req, res) => {
  try {
    console.log('Starting quote retrieval process...');
    const accessToken = await getAccessToken(req);
    const { quoteId } = req.params;

    if (!quoteId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Quote ID is required'
      });
    }

    console.log(`Fetching quote with ID: ${quoteId}`);

    // Get the quote details
    const quoteResponse = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes/${quoteId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          properties: [
            'hs_title',
            'hs_amount',
            'hs_currency',
            'hs_expiration_date',
            'hs_status',
            'hs_description'
          ]
        }
      }
    );

    // Get associated line items
    const lineItemsResponse = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes/${quoteId}/associations/line_items`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Get associated deal if any
    const dealResponse = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes/${quoteId}/associations/deals`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Get associated contact if any
    const contactResponse = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes/${quoteId}/associations/contacts`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const quote = {
      ...quoteResponse.data,
      lineItems: lineItemsResponse.data.results || [],
      deal: dealResponse.data.results?.[0] || null,
      contact: contactResponse.data.results?.[0] || null
    };

    console.log('Quote retrieved successfully');
    res.status(200).json({
      crmType: "hubSpot",
      quote
    });
  } catch (error) {
    console.error('Error in getQuote:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to retrieve quote'
    });
  }
};

export const updateQuote = async (req, res) => {
  try {
    console.log('Starting quote update process...');
    const accessToken = await getAccessToken(req);
    const { quoteId } = req.params;

    if (!quoteId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Quote ID is required'
      });
    }

    const {
      title,
      amount,
      currency,
      expirationDate,
      status,
      lineItems
    } = req.body;

    console.log('Update request body:', {
      title,
      amount,
      currency,
      expirationDate,
      status,
      lineItems
    });

    // Update quote properties
    const quoteData = {
      properties: {}
    };

    if (title) quoteData.properties.hs_title = title;
    if (amount) quoteData.properties.hs_amount = amount.toString();
    if (currency) quoteData.properties.hs_currency = currency;
    if (expirationDate) quoteData.properties.hs_expiration_date = new Date(expirationDate).getTime().toString();
    if (status) quoteData.properties.hs_status = status;

    console.log('Prepared quote update data:', JSON.stringify(quoteData, null, 2));

    // Update the quote
    const response = await axios.patch(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes/${quoteId}`,
      quoteData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Update line items if provided
    if (lineItems && lineItems.length > 0) {
      console.log('Processing line items updates...');
      
      // First, get existing line items
      const existingLineItems = await axios.get(
        `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes/${quoteId}/associations/line_items`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Delete existing line items
      for (const item of existingLineItems.data.results || []) {
        try {
          await axios.delete(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/line_items/${item.id}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
        } catch (error) {
          console.error(`Failed to delete line item ${item.id}:`, error.response?.data || error.message);
        }
      }

      // Add new line items
      for (const item of lineItems) {
        try {
          const lineItemData = {
            properties: {
              name: item.name,
              quantity: item.quantity.toString(),
              price: item.price.toString(),
              hs_product_id: item.productId || null,
              hs_discount: item.discount ? item.discount.toString() : '0',
              hs_tax: item.tax ? item.tax.toString() : '0'
            }
          };

          await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes/${quoteId}/associations/line_items`,
            lineItemData,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log(`Successfully added line item: ${item.name}`);
        } catch (lineItemError) {
          console.error(`Failed to add line item ${item.name}:`, lineItemError.response?.data || lineItemError.message);
        }
      }
    }

    console.log('Quote update process completed successfully');
    res.status(200).json({
      crmType: "hubSpot",
      quote: response.data
    });
  } catch (error) {
    console.error('Error in updateQuote:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to update quote'
    });
  }
};

export const deleteQuote = async (req, res) => {
  try {
    console.log('Starting quote deletion process...');
    const accessToken = await getAccessToken(req);
    const { quoteId } = req.params;

    if (!quoteId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Quote ID is required'
      });
    }

    console.log(`Deleting quote with ID: ${quoteId}`);

    // First, get and delete all associated line items
    const lineItemsResponse = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes/${quoteId}/associations/line_items`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Delete each line item
    for (const item of lineItemsResponse.data.results || []) {
      try {
        await axios.delete(
          `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/line_items/${item.id}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log(`Deleted line item: ${item.id}`);
      } catch (error) {
        console.error(`Failed to delete line item ${item.id}:`, error.response?.data || error.message);
      }
    }

    // Delete the quote
    await axios.delete(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/quotes/${quoteId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Quote deletion process completed successfully');
    res.status(200).json({
      crmType: "hubSpot",
      message: 'Quote deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteQuote:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to delete quote'
    });
  }
};

/**
 * Get all email templates
 * @route GET /api/hubspot/templates
 */
export const getAllTemplates = async (req, res) => {
    try {
        const accessToken = await getAccessToken(req);
        
        const { limit = 20, offset = 0 } = req.query;

        const response = await axios.get(
            `${HUBSPOT_CONFIG.apiBaseUrl}/content/api/v2/templates`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            }
        );

        res.json({
            success: true,
            data: response.data.objects,
            pagination: {
                total: response.data.total_count,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        console.error('Error fetching templates:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to fetch templates',
            details: error.response?.data || error.message
        });
    }
};

/**
 * Get a specific template by ID
 * @route GET /api/hubspot/templates/:templateId
 */
export const getTemplateById = async (req, res) => {
    try {
        const { templateId } = req.params;

        if (!templateId) {
            return res.status(400).json({
                success: false,
                error: 'Missing template ID'
            });
        }

        const accessToken = await getAccessToken(req);

        const response = await axios.get(
            `${HUBSPOT_CONFIG.apiBaseUrl}/content/api/v2/templates/${templateId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error fetching template:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to fetch template',
            details: error.response?.data || error.message
        });
    }
};

/**
 * Update an existing template
 * @route PUT /api/hubspot/templates/:templateId
 */
export const updateTemplate = async (req, res) => {
    try {
        const { templateId } = req.params;
        const {
            name,
            htmlContent,
            folder,
            templateType,
            isAvailableForNewContent
        } = req.body;

        if (!templateId) {
            return res.status(400).json({
                success: false,
                error: 'Missing template ID'
            });
        }

        const accessToken = await getAccessToken(req);

        const templateData = {};
        if (name) {
            templateData.label = name;
            templateData.path = `custom/page/${folder || 'templates'}/${name.toLowerCase().replace(/\s+/g, '-')}.html`;
        }
        if (htmlContent) templateData.source = htmlContent;
        if (folder) templateData.folder = folder;
        if (templateType) templateData.template_type = templateType;
        if (isAvailableForNewContent !== undefined) templateData.is_available_for_new_content = isAvailableForNewContent;

        const response = await axios.put(
            `${HUBSPOT_CONFIG.apiBaseUrl}/content/api/v2/templates/${templateId}`,
            templateData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error updating template:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to update template',
            details: error.response?.data || error.message
        });
    }
};

/**
 * Delete a template
 * @route DELETE /api/hubspot/templates/:templateId
 */
export const deleteTemplate = async (req, res) => {
    try {
        const { templateId } = req.params;

        if (!templateId) {
            return res.status(400).json({
                success: false,
                error: 'Missing template ID'
            });
        }

        const accessToken = await getAccessToken(req);

        await axios.delete(
            `${HUBSPOT_CONFIG.apiBaseUrl}/content/api/v2/templates/${templateId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            message: 'Template deleted successfully',
            data: {
                id: templateId,
                deleted: true
            }
        });
    } catch (error) {
        console.error('Error deleting template:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to delete template',
            details: error.response?.data || error.message
        });
    }
};


/////====Snippet Operations====////

/**
 * Create a new snippet in HubSpot
 * @route POST /api/hubspot/snippets/create
 */
export const createSnippet = async (req, res) => {
    try {
        const {
            name,
            content,
            type = "SALES",
            folderId = 0,
            isEnabled = true
        } = req.body;

        if (!name || !content) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                details: 'Snippet name and content are required'
            });
        }

        const accessToken = await getAccessToken(req);

        const snippetData = {
            name,
            content,
            type,
            folderId,
            isEnabled
        };

        const response = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/sales/v1/snippets`,
            snippetData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error creating snippet:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to create snippet',
            details: error.response?.data || error.message
        });
    }
};

/**
 * Get all snippets
 * @route GET /api/hubspot/snippets
 */
export const getAllSnippets = async (req, res) => {
    try {
        const accessToken = await getAccessToken(req);
        
        const { count = 50, offset = 0, folderId } = req.query;

        const params = {
            count: parseInt(count),
            offset: parseInt(offset),
            folderId: folderId || undefined
        };

        const response = await axios.get(
            `${HUBSPOT_CONFIG.apiBaseUrl}/sales/v1/snippets`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                params
            }
        );

        res.json({
            success: true,
            data: response.data.objects,
            pagination: {
                hasMore: response.data.hasMore,
                offset: response.data.offset,
                total: response.data.total
            }
        });
    } catch (error) {
        console.error('Error fetching snippets:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to fetch snippets',
            details: error.response?.data || error.message
        });
    }
};

/**
 * Get a specific snippet by ID
 * @route GET /api/hubspot/snippets/:snippetId
 */
export const getSnippetById = async (req, res) => {
    try {
        const { snippetId } = req.params;

        if (!snippetId) {
            return res.status(400).json({
                success: false,
                error: 'Missing snippet ID'
            });
        }

        const accessToken = await getAccessToken(req);

        const response = await axios.get(
            `${HUBSPOT_CONFIG.apiBaseUrl}/sales/v1/snippets/${snippetId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error fetching snippet:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to fetch snippet',
            details: error.response?.data || error.message
        });
    }
};

/**
 * Update an existing snippet
 * @route PUT /api/hubspot/snippets/:snippetId
 */
export const updateSnippet = async (req, res) => {
    try {
        const { snippetId } = req.params;
        const {
            name,
            content,
            type,
            folderId,
            isEnabled
        } = req.body;

        if (!snippetId) {
            return res.status(400).json({
                success: false,
                error: 'Missing snippet ID'
            });
        }

        const accessToken = await getAccessToken(req);

        const updateData = {};
        if (name) updateData.name = name;
        if (content) updateData.content = content;
        if (type) updateData.type = type;
        if (folderId !== undefined) updateData.folderId = folderId;
        if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

        const response = await axios.put(
            `${HUBSPOT_CONFIG.apiBaseUrl}/sales/v1/snippets/${snippetId}`,
            updateData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error updating snippet:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to update snippet',
            details: error.response?.data || error.message
        });
    }
};

/**
 * Delete a snippet
 * @route DELETE /api/hubspot/snippets/:snippetId
 */
export const deleteSnippet = async (req, res) => {
    try {
        const { snippetId } = req.params;

        if (!snippetId) {
            return res.status(400).json({
                success: false,
                error: 'Missing snippet ID'
            });
        }

        const accessToken = await getAccessToken(req);

        await axios.delete(
            `${HUBSPOT_CONFIG.apiBaseUrl}/sales/v1/snippets/${snippetId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            message: 'Snippet deleted successfully',
            data: {
                id: snippetId,
                deleted: true
            }
        });
    } catch (error) {
        console.error('Error deleting snippet:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to delete snippet',
            details: error.response?.data || error.message
        });
    }
};

export const createTemplate = async (req, res) => {
  try {
    console.log('Starting template creation process...');
    const accessToken = await getAccessToken(req);
    console.log('Access token retrieved successfully');

    const {
      name,                    // Required: Template name
      content,                 // Required: Template content
      type = 'EMAIL',          // Optional: Template type (EMAIL, SMS, etc.)
      folderId,                // Optional: Folder ID to store the template
      description = '',        // Optional: Template description
      isPublic = false,        // Optional: Whether the template is public
      tags = []                // Optional: Array of tags
    } = req.body;

    console.log('Request body:', {
      name,
      content,
      type,
      folderId,
      description,
      isPublic,
      tags
    });

    // Validate required fields
    if (!name || !content) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Missing required fields: name and content are required'
      });
    }

    // Validate template type
    const validTypes = ['EMAIL', 'SMS', 'CHAT'];
    if (type && !validTypes.includes(type.toUpperCase())) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: `Invalid template type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const templateData = {
      name,
      content,
      type: type.toUpperCase(),
      description,
      isPublic,
      tags,
      folderId: folderId || undefined
    };

    console.log('Creating template with data:', JSON.stringify(templateData, null, 2));

    const response = await axios.post(
      `${HUBSPOT_CONFIG.apiBaseUrl}/content/api/v2/templates`,
      templateData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Template created successfully:', response.data);
    return res.status(201).json({
      crmType: "hubSpot",
      success: true,
      data: {
        template: response.data,
        message: 'Template created successfully'
      }
    });
  } catch (error) {
    console.error('Error in createTemplate:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      success: false,
      error: "Failed to create template",
      message: error.response?.data?.message || error.message,
      details: error.response?.data
    });
    }
};

/////====Email Management====////

/**
 * Create required email properties in HubSpot
 * @private
 */
const createEmailProperties = async (accessToken) => {
    console.log('Creating required email properties...');
    
    const properties = [
        {
            name: 'email_subject',
            label: 'Email Subject',
            type: 'string',
            fieldType: 'text',
            groupName: 'emailinformation'
        },
        {
            name: 'email_body',
            label: 'Email Body',
            type: 'string',
            fieldType: 'textarea',
            groupName: 'emailinformation'
        },
        {
            name: 'email_html',
            label: 'Email HTML',
            type: 'string',
            fieldType: 'textarea',
            groupName: 'emailinformation'
        },
        {
            name: 'email_from',
            label: 'Email From',
            type: 'string',
            fieldType: 'text',
            groupName: 'emailinformation'
        },
        {
            name: 'email_to',
            label: 'Email To',
            type: 'string',
            fieldType: 'text',
            groupName: 'emailinformation'
        },
        {
            name: 'email_cc',
            label: 'Email CC',
            type: 'string',
            fieldType: 'text',
            groupName: 'emailinformation'
        },
        {
            name: 'email_bcc',
            label: 'Email BCC',
            type: 'string',
            fieldType: 'text',
            groupName: 'emailinformation'
        }
    ];

    for (const property of properties) {
        try {
            await axios.post(
                `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/properties/emails`,
                property,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log(`Created property: ${property.name}`);
        } catch (error) {
            if (error.response?.status !== 409) { // 409 means property already exists
                console.error(`Error creating property ${property.name}:`, error.response?.data || error.message);
            }
        }
    }
};

/**
 * Create a new email in HubSpot
 * @route POST /api/hubspot/emails/create
 */
export const createEmail = async (req, res) => {
    try {
        console.log('Starting email creation process...');
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        const {
            hs_email_subject,             // Required: Email subject
            hs_email_text,                // Required: Email body text
            hs_email_html,                // Optional: Email HTML content
            hs_email_direction,           // Optional: Email direction
            hs_email_status,              // Optional: Email status
            
            // Associations
            contactIds = [],              // Array of contact IDs to associate
            companyIds = [],              // Array of company IDs to associate
            dealIds = [],                 // Array of deal IDs to associate
            ticketIds = [],               // Array of ticket IDs to associate
            
            // Additional properties
            hubspot_owner_id,             // Owner of the email
            
            // Custom properties
            ...customProperties
        } = req.body;

        // Validate required fields - HubSpot requires hs_email_subject and hs_email_text
        if (!hs_email_subject || !hs_email_text) {
            console.log('Validation failed: Missing required fields');
            return res.status(400).json({
                crmType: "hubSpot",
                error: 'Missing required fields: hs_email_subject and hs_email_text are required'
            });
        }

        // Validate status if provided
        if (hs_email_status) {
            const validStatuses = ['BOUNCED', 'FAILED', 'SCHEDULED', 'SENDING', 'SENT'];
            if (!validStatuses.includes(hs_email_status.toUpperCase())) {
                console.log('Validation failed: Invalid status');
                return res.status(400).json({
                    crmType: "hubSpot",
                    error: 'Invalid status',
                    message: `Status must be one of: ${validStatuses.join(', ')}`
                });
            }
        }

        // Validate direction if provided
        if (hs_email_direction) {
            const validDirections = ['FORWARDED_EMAIL', 'INCOMING_EMAIL', 'EMAIL'];
            if (!validDirections.includes(hs_email_direction.toUpperCase())) {
                console.log('Validation failed: Invalid direction');
                return res.status(400).json({
                    crmType: "hubSpot",
                    error: 'Invalid direction',
                    message: `Direction must be one of: ${validDirections.join(', ')}`
                });
            }
        }

        console.log('Getting access token...');
        const accessToken = await getAccessToken(req);
        console.log('Access token retrieved successfully');

        // Format email object with correct HubSpot properties
        const emailObj = {
            properties: {
                hs_timestamp: new Date().getTime(),
                hs_email_subject: hs_email_subject,
                hs_email_text: hs_email_text
            }
        };

        // Add optional properties only if provided
        if (hs_email_html) emailObj.properties.hs_email_html = hs_email_html;
        if (hs_email_direction) emailObj.properties.hs_email_direction = hs_email_direction.toUpperCase();
        if (hs_email_status) emailObj.properties.hs_email_status = hs_email_status.toUpperCase();
        if (hubspot_owner_id) emailObj.properties.hubspot_owner_id = hubspot_owner_id;

        // Add custom properties
        Object.keys(customProperties).forEach(key => {
            if (customProperties[key] !== undefined && customProperties[key] !== null) {
                emailObj.properties[key] = customProperties[key];
            }
        });

        console.log('Creating email with data:', JSON.stringify(emailObj, null, 2));

        const response = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/emails`,
            emailObj,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Email created successfully:', response.data);
        const emailId = response.data.id;

        // Handle associations
        const associations = [];
        
        // Associate with contacts
        if (contactIds.length > 0) {
            for (const contactId of contactIds) {
                try {
                    await axios.put(
                        `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/emails/${emailId}/associations/contacts/${contactId}/email_to_contact`,
                        {},
                        {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    associations.push({ type: 'contact', id: contactId });
                    console.log(`Email associated with contact ${contactId}`);
                } catch (assocError) {
                    console.warn(`Failed to associate with contact ${contactId}:`, assocError.message);
                }
            }
        }

        // Associate with companies
        if (companyIds.length > 0) {
            for (const companyId of companyIds) {
                try {
                    await axios.put(
                        `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/emails/${emailId}/associations/companies/${companyId}/email_to_company`,
                        {},
                        {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    associations.push({ type: 'company', id: companyId });
                    console.log(`Email associated with company ${companyId}`);
                } catch (assocError) {
                    console.warn(`Failed to associate with company ${companyId}:`, assocError.message);
                }
            }
        }

        // Associate with deals
        if (dealIds.length > 0) {
            for (const dealId of dealIds) {
                try {
                    await axios.put(
                        `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/emails/${emailId}/associations/deals/${dealId}/email_to_deal`,
                        {},
                        {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    associations.push({ type: 'deal', id: dealId });
                    console.log(`Email associated with deal ${dealId}`);
                } catch (assocError) {
                    console.warn(`Failed to associate with deal ${dealId}:`, assocError.message);
                }
            }
        }

        // Associate with tickets
        if (ticketIds.length > 0) {
            for (const ticketId of ticketIds) {
                try {
                    await axios.put(
                        `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/emails/${emailId}/associations/tickets/${ticketId}/email_to_ticket`,
                        {},
                        {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    associations.push({ type: 'ticket', id: ticketId });
                    console.log(`Email associated with ticket ${ticketId}`);
                } catch (assocError) {
                    console.warn(`Failed to associate with ticket ${ticketId}:`, assocError.message);
                }
            }
        }

        res.status(201).json({
            crmType: "hubSpot",
            success: true,
            data: response.data,
            associations: associations,
            message: 'Email created successfully'
        });
    } catch (error) {
        console.error('Error creating email:', error.response?.data || error.message);
        console.error('Error details:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });

        // Handle specific error cases
        if (error.response?.data?.category === 'VALIDATION_ERROR') {
            return res.status(400).json({
                crmType: "hubSpot",
                error: 'Validation Error',
                details: error.response.data
            });
        }

        res.status(error.response?.status || 500).json({
            crmType: "hubSpot",
            error: error.response?.data || 'Internal Server Error'
        });
    }
};

/**
 * Get a specific email by ID
 * @route GET /api/hubspot/emails/:emailId
 */
export const getEmailById = async (req, res) => {
    try {
        console.log('Fetching email by ID:', req.params.emailId);
        const { emailId } = req.params;
        const accessToken = await getAccessToken(req);

        const response = await axios.get(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/emails/${emailId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    properties: [
                        'hs_timestamp',
                        'hs_email_direction',
                        'hs_email_status',
                        'hs_email_subject',
                        'hs_email_body',
                        'hs_email_html',
                        'hs_email_from',
                        'hs_email_to',
                        'hs_email_cc',
                        'hs_email_bcc'
                    ]
                }
            }
        );

        console.log('Email fetched successfully:', response.data);

        res.status(200).json({
            crmType: "hubSpot",
            data: response.data
        });
    } catch (error) {
        console.error('Error fetching email:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            crmType: "hubSpot",
            error: error.response?.data || 'Internal Server Error'
        });
    }
};

/**
 * Update an existing email
 * @route PUT /api/hubspot/emails/:emailId
 */
export const updateEmail = async (req, res) => {
    try {
        console.log('Updating email:', req.params.emailId);
        console.log('Update data:', JSON.stringify(req.body, null, 2));

        const { emailId } = req.params;
        const {
            subject,
            body,
            html,
            status,
            direction,
            cc,
            bcc
        } = req.body;

        if (!subject && !body && !html && !status && !direction && !cc && !bcc) {
            console.log('Validation failed: No update fields provided');
            return res.status(400).json({
                crmType: "hubSpot",
                error: 'At least one field must be provided for update'
            });
        }

        const accessToken = await getAccessToken(req);

        const updateObj = {
            properties: {}
        };

        if (subject) updateObj.properties.hs_email_subject = subject;
        if (body) updateObj.properties.hs_email_body = body;
        if (html) updateObj.properties.hs_email_html = html;
        if (status) updateObj.properties.hs_email_status = status.toUpperCase();
        if (direction) updateObj.properties.hs_email_direction = direction.toUpperCase();
        if (cc) updateObj.properties.hs_email_cc = Array.isArray(cc) ? cc.join(';') : cc;
        if (bcc) updateObj.properties.hs_email_bcc = Array.isArray(bcc) ? bcc.join(';') : bcc;

        console.log('Update object:', JSON.stringify(updateObj, null, 2));

        const response = await axios.patch(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/emails/${emailId}`,
            updateObj,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Email updated successfully:', response.data);

        res.status(200).json({
            crmType: "hubSpot",
            data: response.data,
            message: 'Email updated successfully'
        });
    } catch (error) {
        console.error('Error updating email:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            crmType: "hubSpot",
            error: error.response?.data || 'Internal Server Error'
        });
    }
};

/**
 * Delete an email
 * @route DELETE /api/hubspot/emails/:emailId
 */
export const deleteEmail = async (req, res) => {
    try {
        console.log('Deleting email:', req.params.emailId);
        const { emailId } = req.params;
        const accessToken = await getAccessToken(req);

        await axios.delete(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/emails/${emailId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Email deleted successfully');

        res.status(200).json({
            crmType: "hubSpot",
            message: 'Email deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting email:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            crmType: "hubSpot",
            error: error.response?.data || 'Internal Server Error'
        });
    }
};

/**
 * Search emails with filters
 * @route GET /api/hubspot/emails/search
 */
export const searchEmails = async (req, res) => {
    try {
        const {
            query,
            status,
            direction,
            from,
            to,
            startDate,
            endDate,
            limit = 10,
            after
        } = req.query;

        const accessToken = await getAccessToken(req);

        const filterGroups = [];

        if (query) {
            filterGroups.push({
                filters: [{
                    propertyName: 'hs_email_subject',
                    operator: 'CONTAINS',
                    value: query
                }]
            });
        }

        if (status) {
            filterGroups.push({
                filters: [{
                    propertyName: 'hs_email_status',
                    operator: 'EQ',
                    value: status.toUpperCase()
                }]
            });
        }

        if (direction) {
            filterGroups.push({
                filters: [{
                    propertyName: 'hs_email_direction',
                    operator: 'EQ',
                    value: direction.toUpperCase()
                }]
            });
        }

        if (from) {
            filterGroups.push({
                filters: [{
                    propertyName: 'hs_email_from',
                    operator: 'CONTAINS',
                    value: from
                }]
            });
        }

        if (to) {
            filterGroups.push({
                filters: [{
                    propertyName: 'hs_email_to',
                    operator: 'CONTAINS',
                    value: to
                }]
            });
        }

        if (startDate || endDate) {
            const timestampFilter = {
                propertyName: 'hs_timestamp',
                operator: 'BETWEEN',
                value: `${startDate || 0},${endDate || Date.now()}`
            };
            filterGroups.push({ filters: [timestampFilter] });
        }

        const response = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/emails/search`,
            {
                filterGroups,
                sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }],
                properties: [
                    'hs_email_subject',
                    'hs_email_body',
                    'hs_email_html',
                    'hs_email_direction',
                    'hs_email_status',
                    'hs_email_from',
                    'hs_email_to',
                    'hs_email_cc',
                    'hs_email_bcc',
                    'hs_timestamp'
                ],
                limit: parseInt(limit),
                after: after || undefined
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({
            crmType: "hubSpot",
            data: response.data,
            pagination: {
                total: response.data.total,
                limit: parseInt(limit),
                after: response.data.paging?.next?.after
            }
        });
    } catch (error) {
        console.error('Error searching emails:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            crmType: "hubSpot",
            error: error.response?.data || 'Internal Server Error'
        });
    }
};

/**
 * Search for object IDs across different HubSpot objects
 * @route GET /api/hubspot/search/:objectType
 * @param {string} objectType - The type of object to search (contacts, companies, deals, products, etc.)
 * @query {string} [searchQuery] - The search query to filter objects
 * @returns {Object} List of objects with their IDs and relevant details
 */
export const searchObjectIds = async (req, res) => {
    try {
        const { searchQuery, module } = req.query;
        
        // Get access token using the existing function
        const accessToken = await getAccessToken(req);
        
        if (!accessToken) {
            return res.status(401).json({
                success: false,
                error: "Authentication required. Please ensure you have valid HubSpot credentials."
            });
        }

        // Define searchable properties for each module
        const searchableProperties = {
            contacts: ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle', 'mobilephone', 'address', 'city', 'state', 'zip', 'country'],
            companies: ['name', 'domain', 'industry', 'type', 'phone', 'address', 'city', 'state', 'zip', 'country', 'website', 'description'],
            deals: ['dealname', 'pipeline', 'dealstage', 'amount', 'closedate', 'createdate', 'description', 'expected_revenue', 'probability'],
            products: ['name', 'description', 'price', 'sku', 'hs_cost_of_goods_sold', 'hs_recurring_billing_period', 'hs_sku', 'hs_product_id'],
            tickets: ['subject', 'content', 'priority', 'status', 'hs_pipeline', 'hs_pipeline_stage', 'hs_ticket_category', 'hs_ticket_priority'],
            notes: ['subject', 'body', 'engagement_type', 'hs_timestamp', 'hs_attachment_ids'],
            tasks: ['subject', 'content', 'status', 'priority', 'hs_timestamp', 'hs_task_subject', 'hs_task_priority', 'hs_task_status'],
            quotes: ['title', 'description', 'status', 'hs_expiration_date', 'hs_quote_amount', 'hs_quote_number', 'hs_quote_probability'],
            lists: ['name', 'description', 'type', 'hs_list_type', 'hs_list_membership_count'],
            playbooks: ['name', 'description', 'type', 'hs_playbook_type', 'hs_playbook_status'],
            templates: ['name', 'subject', 'type', 'hs_template_type', 'hs_template_category'],
            snippets: ['name', 'content', 'type', 'hs_snippet_type', 'hs_snippet_category'],
            meetings: ['title', 'description', 'start_time', 'end_time', 'location', 'status', 'hs_meeting_body', 'hs_meeting_external_url'],
            campaigns: ['name', 'type', 'status', 'start_date', 'end_date', 'hs_campaign_type', 'hs_campaign_status'],
            leads: ['firstname', 'lastname', 'email', 'company', 'phone', 'hs_lead_status', 'hs_lead_source', 'hs_lead_score'],
            accounts: ['name', 'domain', 'industry', 'type', 'phone', 'address', 'city', 'state', 'zip', 'country', 'website', 'description'],
            opportunities: ['name', 'amount', 'stage', 'probability', 'close_date', 'type', 'hs_pipeline', 'hs_pipeline_stage']
        };

        // Map common module names to HubSpot object types
        const moduleMapping = {
            contacts: 'contacts',
            companies: 'companies',
            accounts: 'companies',
            deals: 'deals',
            opportunities: 'deals',
            products: 'products',
            tickets: 'tickets',
            notes: 'notes',
            tasks: 'tasks',
            quotes: 'quotes',
            lists: 'lists',
            playbooks: 'playbooks',
            templates: 'templates',
            snippets: 'snippets',
            meetings: 'meetings',
            campaigns: 'campaigns',
            leads: 'contacts'
        };

        // Validate module
        if (!module || !moduleMapping[module.toLowerCase()]) {
            return res.status(400).json({
                success: false,
                error: `Invalid module. Supported modules: ${Object.keys(moduleMapping).join(', ')}`
            });
        }

        const objectType = moduleMapping[module.toLowerCase()];
        const properties = searchableProperties[objectType];

        // Build search query
        let searchParams = {
            limit: 100,
            properties: properties
        };

        if (searchQuery) {
            // Create a filter group with OR conditions for each property
            searchParams.filterGroups = [{
                filters: properties.map(property => ({
                    propertyName: property,
                    operator: 'CONTAINS_TOKEN',  // Changed from CONTAINS to CONTAINS_TOKEN
                    value: searchQuery
                }))
            }];
        }

        // Make API call to HubSpot with proper authorization header
        const response = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/${objectType}/search`,
            searchParams,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Format response
        const formattedResults = response.data.results.map(result => {
            const formattedResult = {
                id: result.id,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt
            };

            // Add all properties to the result
            Object.entries(result.properties).forEach(([key, value]) => {
                formattedResult[key] = value;
            });

            return formattedResult;
        });

        res.status(200).json({
            success: true,
            totalResults: response.data.total,
            results: formattedResults,
            paging: response.data.paging
        });

    } catch (error) {
        console.error(`Error searching ${req.query.module}:`, error.response?.data || error.message);
        
        // Handle specific authentication errors
        if (error.response?.data?.category === 'INVALID_AUTHENTICATION') {
            return res.status(401).json({
                success: false,
                error: "Authentication failed. Please ensure you have valid HubSpot credentials and try again."
            });
        }

        // Handle validation errors
        if (error.response?.data?.category === 'VALIDATION_ERROR') {
            return res.status(400).json({
                success: false,
                error: "Invalid search parameters. Please check your search query and try again."
            });
        }

        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data || 'Internal Server Error'
        });
    }
};

// Function to get available product properties
export const getProductProperties = async (req, res) => {
  try {
    console.log('Fetching available product properties...');
    const accessToken = await getAccessToken(req);

    const response = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/properties/products`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Product properties retrieved successfully');
    
    // Extract property names and types for easier viewing
    const properties = response.data.results.map(prop => ({
      name: prop.name,
      label: prop.label,
      type: prop.type,
      fieldType: prop.fieldType,
      description: prop.description,
      options: prop.options || []
    }));

    res.status(200).json({
      crmType: "hubSpot",
      properties: properties,
      totalCount: properties.length
    });
  } catch (error) {
    console.error('Error in getProductProperties:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to retrieve product properties'
    });
  }
};

// Function to get available quote properties
export const getQuoteProperties = async (req, res) => {
  try {
    console.log('Fetching available quote properties...');
    const accessToken = await getAccessToken(req);

    const response = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/properties/quotes`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Quote properties retrieved successfully');
    
    // Extract property names and types for easier viewing
    const properties = response.data.results.map(prop => ({
      name: prop.name,
      label: prop.label,
      type: prop.type,
      fieldType: prop.fieldType,
      description: prop.description,
      options: prop.options || [],
      required: prop.required || false
    }));

    res.status(200).json({
      crmType: "hubSpot",
      properties: properties,
      totalCount: properties.length,
      requiredProperties: properties.filter(p => p.required)
    });
  } catch (error) {
    console.error('Error in getQuoteProperties:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      error: error.response?.data || 'Failed to retrieve quote properties'
    });
  }
};

/////====Campaign Alternative (Marketing Email)====////

/**
 * Create a marketing email campaign in HubSpot
 * Note: HubSpot doesn't have traditional "Campaign" objects like other CRMs.
 * Instead, we create marketing emails which serve a similar purpose.
 */
export const createCampaign = async (req, res) => {
  try {
    console.log('Starting campaign (marketing email) creation process...');
    const accessToken = await getAccessToken(req);
    console.log('Access token retrieved successfully');

    const {
      name,                    // Required: Campaign name
      subject,                 // Required: Email subject
      htmlContent,             // Optional: Email HTML content
      textContent,             // Optional: Plain text content
      fromName,                // Optional: From name
      fromEmail,               // Optional: From email
      replyTo,                 // Optional: Reply-to email
      listIds = [],            // Optional: List IDs to send to
      description = '',        // Optional: Campaign description
      type = 'REGULAR_EMAIL',  // Optional: Email type
      domain,                  // Optional: Domain for sending
      language = 'en'          // Optional: Language
    } = req.body;

    console.log('Request body:', {
      name,
      subject,
      htmlContent: htmlContent ? 'Provided' : 'Missing',
      textContent: textContent ? 'Provided' : 'Missing',
      fromName,
      fromEmail,
      replyTo,
      listIds,
      description,
      type,
      domain,
      language
    });

    // Validate required fields
    if (!name || !subject) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Missing required fields: name and subject are required'
      });
    }

    // Create marketing email data with proper structure
    const emailData = {
      name: name,
      subject: subject,
      type: type,
      language: language
    };

    // Add optional fields only if provided
    if (htmlContent) {
      emailData.htmlContent = htmlContent;
    }
    
    if (textContent) {
      emailData.textContent = textContent;
    }
    
    if (fromName) {
      emailData.fromName = fromName;
    }
    
    if (fromEmail) {
      emailData.fromEmail = fromEmail;
    }
    
    if (replyTo) {
      emailData.replyTo = replyTo;
    }
    
    if (description) {
      emailData.description = description;
    }
    
    if (domain) {
      emailData.domain = domain;
    }

    console.log('Creating marketing email with data:', JSON.stringify(emailData, null, 2));

    const response = await axios.post(
      `${HUBSPOT_CONFIG.apiBaseUrl}/marketing/v3/emails`,
      emailData,
      {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Marketing email created successfully:', response.data);
    
    // If list IDs are provided, associate the email with those lists
    let associationResults = [];
    if (listIds.length > 0) {
      console.log('Associating email with lists:', listIds);
      for (const listId of listIds) {
        try {
          // Note: This is a placeholder for list association
          // The actual implementation would depend on HubSpot's specific API for email-list associations
          associationResults.push({
            listId: listId,
            status: 'pending',
            note: 'List association requires additional HubSpot Marketing Hub configuration'
          });
        } catch (associationError) {
          console.error(`Failed to associate with list ${listId}:`, associationError.message);
          associationResults.push({
            listId: listId,
            status: 'failed',
            error: associationError.message
          });
        }
      }
    }

    res.status(201).json({
      crmType: "hubSpot",
      success: true,
      data: {
        campaign: response.data,
        listAssociations: associationResults,
        message: 'Campaign (marketing email) created successfully',
        note: 'HubSpot uses marketing emails for campaigns. List associations may require additional Marketing Hub configuration.'
      }
    });
  } catch (error) {
    console.error('Error in createCampaign:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to create campaign',
      details: error.response?.data,
      note: 'HubSpot uses marketing emails for campaigns. Ensure you have Marketing Hub access and proper permissions.'
    });
  }
};

/////====Order Alternative (Deal with Line Items)====////

/**
 * Create an order in HubSpot using Deal + Line Items
 * Note: HubSpot doesn't have traditional "Order" objects like other CRMs.
 * Instead, we create a Deal with associated Line Items which serves the same purpose.
 */
export const createOrder = async (req, res) => {
  try {
    console.log('Starting order (deal + line items) creation process...');
    const accessToken = await getAccessToken(req);
    console.log('Access token retrieved successfully');

    const {
      // Deal properties
      dealname,                // Required: Order/Deal name
      amount,                  // Required: Total order amount
      closedate,               // Optional: Expected close/delivery date (YYYY-MM-DD or timestamp)
      pipeline,                // Optional: Sales pipeline ID
      dealstage,               // Optional: Deal stage ID
      
      // Order-specific properties
      orderNumber,             // Optional: Order number
      customerCompanyId,       // Optional: Customer company ID
      customerContactId,       // Optional: Customer contact ID
      
      // Line items
      lineItems = [],          // Optional: Array of line items
      
      // Additional properties
      description = '',        // Optional: Order description
      hubspot_owner_id,        // Optional: Owner ID
      dealtype,                // Optional: Deal type
      source                   // Optional: Deal source
    } = req.body;

    console.log('Request body:', {
      dealname,
      amount,
      closedate,
      pipeline,
      dealstage,
      orderNumber,
      customerCompanyId,
      customerContactId,
      lineItems: lineItems.length,
      description,
      hubspot_owner_id,
      dealtype,
      source
    });

    // Validate required fields
    if (!dealname || !amount) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Missing required fields: dealname and amount are required'
      });
    }

    // Validate amount is a number
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Amount must be a valid number'
      });
    }

    // Create deal data (representing the order)
    const dealProperties = {
      dealname: orderNumber ? `${dealname} (Order: ${orderNumber})` : dealname,
      amount: numericAmount.toString()
    };

    // Add optional properties only if provided
    if (pipeline) {
      dealProperties.pipeline = pipeline;
    }
    
    if (dealstage) {
      dealProperties.dealstage = dealstage;
    }
    
    if (closedate) {
      // Handle both date string and timestamp
      const closeDateTimestamp = typeof closedate === 'string' 
        ? new Date(closedate).getTime() 
        : parseInt(closedate);
      if (!isNaN(closeDateTimestamp)) {
        dealProperties.closedate = closeDateTimestamp.toString();
      }
    }
    
    if (description) {
      dealProperties.description = description;
    }
    
    if (hubspot_owner_id) {
      dealProperties.hubspot_owner_id = hubspot_owner_id.toString();
    }
    
    if (dealtype) {
      dealProperties.dealtype = dealtype;
    }
    
    if (source) {
      dealProperties.hs_deal_source_id = source;
    }
    
    if (orderNumber) {
      dealProperties.hs_order_number = orderNumber;
    }

    const dealData = {
      properties: dealProperties
    };

    console.log('Creating deal (order) with data:', JSON.stringify(dealData, null, 2));

    const dealResponse = await axios.post(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/deals`,
      dealData,
      {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Deal (order) created successfully:', dealResponse.data);
    const dealId = dealResponse.data.id;

    // Track association results
    const associationResults = {
      company: null,
      contact: null
    };

    // Associate with company if provided
    if (customerCompanyId) {
      try {
        await axios.post(
          `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v4/objects/deals/${dealId}/associations/companies/${customerCompanyId}`,
          [{
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId: 5 // Deal to Company association type
          }],
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('Deal associated with company successfully');
        associationResults.company = customerCompanyId;
      } catch (assocError) {
        console.warn('Failed to associate with company:', assocError.response?.data || assocError.message);
        associationResults.company = `Failed: ${assocError.message}`;
      }
    }

    // Associate with contact if provided
    if (customerContactId) {
      try {
        await axios.post(
          `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v4/objects/deals/${dealId}/associations/contacts/${customerContactId}`,
          [{
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId: 3 // Deal to Contact association type
          }],
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('Deal associated with contact successfully');
        associationResults.contact = customerContactId;
      } catch (assocError) {
        console.warn('Failed to associate with contact:', assocError.response?.data || assocError.message);
        associationResults.contact = `Failed: ${assocError.message}`;
      }
    }

    // Create line items if provided
    const createdLineItems = [];
    const lineItemErrors = [];
    
    if (lineItems.length > 0) {
      console.log('Creating line items...');
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        try {
          // Validate line item data
          if (!item.name && !item.hs_product_id) {
            throw new Error('Line item must have either name or hs_product_id');
          }

          const lineItemProperties = {};
          
          // Add properties conditionally
          if (item.name) {
            lineItemProperties.name = item.name;
          }
          
          if (item.quantity !== undefined) {
            const qty = parseFloat(item.quantity);
            if (!isNaN(qty)) {
              lineItemProperties.quantity = qty.toString();
            }
          }
          
          if (item.price !== undefined) {
            const price = parseFloat(item.price);
            if (!isNaN(price)) {
              lineItemProperties.price = price.toString();
            }
          }
          
          if (item.hs_product_id) {
            lineItemProperties.hs_product_id = item.hs_product_id.toString();
          }
          
          if (item.description) {
            lineItemProperties.description = item.description;
          }
          
          if (item.hs_sku) {
            lineItemProperties.hs_sku = item.hs_sku;
          }

          const lineItemData = {
            properties: lineItemProperties
          };

          console.log(`Creating line item ${i + 1}:`, JSON.stringify(lineItemData, null, 2));

          const lineItemResponse = await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/line_items`,
            lineItemData,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          // Associate line item with deal using v4 associations API
          await axios.post(
            `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v4/objects/deals/${dealId}/associations/line_items/${lineItemResponse.data.id}`,
            [{
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 20 // Deal to Line Item association type
            }],
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          createdLineItems.push({
            ...lineItemResponse.data,
            originalIndex: i,
            originalData: item
          });
          console.log(`Line item created and associated: ${item.name || item.hs_product_id}`);
        } catch (lineItemError) {
          console.error(`Failed to create line item ${i + 1} (${item.name || item.hs_product_id}):`, 
            lineItemError.response?.data?.message || lineItemError.message);
          lineItemErrors.push({
            index: i,
            item: item,
            error: lineItemError.response?.data?.message || lineItemError.message
          });
        }
      }
    }

    console.log('Order creation process completed successfully');
    
    const response = {
      crmType: "hubSpot",
      success: true,
      data: {
        order: dealResponse.data,
        lineItems: createdLineItems,
        associations: associationResults,
        summary: {
          dealId: dealId,
          totalLineItems: createdLineItems.length,
          failedLineItems: lineItemErrors.length,
          associatedCompany: !!associationResults.company && !associationResults.company.includes('Failed'),
          associatedContact: !!associationResults.contact && !associationResults.contact.includes('Failed')
        }
      },
      message: 'Order (deal + line items) created successfully'
    };

    // Add errors if any occurred
    if (lineItemErrors.length > 0) {
      response.warnings = {
        lineItemErrors: lineItemErrors,
        message: `${lineItemErrors.length} line items failed to create`
      };
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Error in createOrder:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to create order',
      details: error.response?.data,
      note: 'HubSpot uses deals with line items instead of traditional order objects'
    });
  }
};

/////====Campaign CRUD Operations====////

/**
 * Get all campaigns (marketing emails) from HubSpot
 */
export const getAllCampaigns = async (req, res) => {
  try {
    console.log('Starting get all campaigns process...');
    const accessToken = await getAccessToken(req);
    console.log('Access token retrieved successfully');

    const { limit = 100, after, properties } = req.query;

    const params = new URLSearchParams({
      limit: limit.toString()
    });

    if (after) {
      params.append('after', after);
    }

    if (properties) {
      params.append('properties', properties);
    }

    const response = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/marketing/v3/emails?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Campaigns retrieved successfully');
    res.status(200).json({
      crmType: "hubSpot",
      success: true,
      data: {
        campaigns: response.data.results || response.data,
        paging: response.data.paging || null,
        total: response.data.total || response.data.results?.length || 0
      },
      message: 'Campaigns retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getAllCampaigns:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to retrieve campaigns',
      details: error.response?.data
    });
  }
};

/**
 * Get a specific campaign (marketing email) by ID
 */
export const getCampaignById = async (req, res) => {
  try {
    console.log('Starting get campaign by ID process...');
    const accessToken = await getAccessToken(req);
    const { campaignId } = req.params;
    console.log('Access token retrieved successfully, Campaign ID:', campaignId);

    if (!campaignId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Campaign ID is required'
      });
    }

    const response = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/marketing/v3/emails/${campaignId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Campaign retrieved successfully');
    res.status(200).json({
      crmType: "hubSpot",
      success: true,
      data: response.data,
      message: 'Campaign retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getCampaignById:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to retrieve campaign',
      details: error.response?.data
    });
  }
};

/**
 * Update a campaign (marketing email)
 */
export const updateCampaign = async (req, res) => {
  try {
    console.log('Starting update campaign process...');
    const accessToken = await getAccessToken(req);
    const { campaignId } = req.params;
    console.log('Access token retrieved successfully, Campaign ID:', campaignId);

    if (!campaignId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Campaign ID is required'
      });
    }

    const {
      name,
      subject,
      htmlContent,
      textContent,
      fromName,
      fromEmail,
      replyTo,
      description,
      language
    } = req.body;

    // Build update data with only provided fields
    const updateData = {};
    
    if (name) updateData.name = name;
    if (subject) updateData.subject = subject;
    if (htmlContent) updateData.htmlContent = htmlContent;
    if (textContent) updateData.textContent = textContent;
    if (fromName) updateData.fromName = fromName;
    if (fromEmail) updateData.fromEmail = fromEmail;
    if (replyTo) updateData.replyTo = replyTo;
    if (description) updateData.description = description;
    if (language) updateData.language = language;

    console.log('Updating campaign with data:', JSON.stringify(updateData, null, 2));

    const response = await axios.patch(
      `${HUBSPOT_CONFIG.apiBaseUrl}/marketing/v3/emails/${campaignId}`,
      updateData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Campaign updated successfully');
    res.status(200).json({
      crmType: "hubSpot",
      success: true,
      data: response.data,
      message: 'Campaign updated successfully'
    });
  } catch (error) {
    console.error('Error in updateCampaign:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to update campaign',
      details: error.response?.data
    });
  }
};

/**
 * Delete a campaign (marketing email)
 */
export const deleteCampaign = async (req, res) => {
  try {
    console.log('Starting delete campaign process...');
    const accessToken = await getAccessToken(req);
    const { campaignId } = req.params;
    console.log('Access token retrieved successfully, Campaign ID:', campaignId);

    if (!campaignId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Campaign ID is required'
      });
    }

    await axios.delete(
      `${HUBSPOT_CONFIG.apiBaseUrl}/marketing/v3/emails/${campaignId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Campaign deleted successfully');
    res.status(200).json({
      crmType: "hubSpot",
      success: true,
      message: 'Campaign deleted successfully',
      data: {
        deletedCampaignId: campaignId
      }
    });
  } catch (error) {
    console.error('Error in deleteCampaign:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to delete campaign',
      details: error.response?.data
    });
  }
};

/////====Order CRUD Operations====////

/**
 * Get all orders (deals with line items) from HubSpot
 */
export const getAllOrders = async (req, res) => {
  try {
    console.log('Starting get all orders process...');
    const accessToken = await getAccessToken(req);
    console.log('Access token retrieved successfully');

    const { 
      limit = 100, 
      after, 
      properties = 'dealname,amount,closedate,dealstage,pipeline,hubspot_owner_id,description',
      associations = 'line_items,contacts,companies'
    } = req.query;

    const params = new URLSearchParams({
      limit: limit.toString(),
      properties: properties
    });

    if (after) {
      params.append('after', after);
    }

    if (associations) {
      params.append('associations', associations);
    }

    const response = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/deals?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Orders retrieved successfully');
    res.status(200).json({
      crmType: "hubSpot",
      success: true,
      data: {
        orders: response.data.results || response.data,
        paging: response.data.paging || null,
        total: response.data.total || response.data.results?.length || 0
      },
      message: 'Orders (deals) retrieved successfully',
      note: 'HubSpot uses deals with line items instead of traditional order objects'
    });
  } catch (error) {
    console.error('Error in getAllOrders:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to retrieve orders',
      details: error.response?.data
    });
  }
};

/**
 * Get a specific order (deal with line items) by ID
 */
export const getOrderById = async (req, res) => {
  try {
    console.log('Starting get order by ID process...');
    const accessToken = await getAccessToken(req);
    const { orderId } = req.params;
    console.log('Access token retrieved successfully, Order ID:', orderId);

    if (!orderId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Order ID is required'
      });
    }

    const { 
      properties = 'dealname,amount,closedate,dealstage,pipeline,hubspot_owner_id,description,hs_order_number',
      associations = 'line_items,contacts,companies'
    } = req.query;

    const params = new URLSearchParams({
      properties: properties
    });

    if (associations) {
      params.append('associations', associations);
    }

    const response = await axios.get(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/deals/${orderId}?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Order retrieved successfully');
    res.status(200).json({
      crmType: "hubSpot",
      success: true,
      data: response.data,
      message: 'Order (deal) retrieved successfully',
      note: 'HubSpot uses deals with line items instead of traditional order objects'
    });
  } catch (error) {
    console.error('Error in getOrderById:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to retrieve order',
      details: error.response?.data
    });
  }
};

/**
 * Update an order (deal)
 */
export const updateOrder = async (req, res) => {
  try {
    console.log('Starting update order process...');
    const accessToken = await getAccessToken(req);
    const { orderId } = req.params;
    console.log('Access token retrieved successfully, Order ID:', orderId);

    if (!orderId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Order ID is required'
      });
    }

    const {
      dealname,
      amount,
      closedate,
      pipeline,
      dealstage,
      description,
      hubspot_owner_id,
      dealtype,
      source,
      orderNumber
    } = req.body;

    // Build update properties with only provided fields
    const updateProperties = {};
    
    if (dealname) updateProperties.dealname = dealname;
    if (amount !== undefined) {
      const numericAmount = parseFloat(amount);
      if (!isNaN(numericAmount)) {
        updateProperties.amount = numericAmount.toString();
      }
    }
    if (closedate) {
      const closeDateTimestamp = typeof closedate === 'string' 
        ? new Date(closedate).getTime() 
        : parseInt(closedate);
      if (!isNaN(closeDateTimestamp)) {
        updateProperties.closedate = closeDateTimestamp.toString();
      }
    }
    if (pipeline) updateProperties.pipeline = pipeline;
    if (dealstage) updateProperties.dealstage = dealstage;
    if (description) updateProperties.description = description;
    if (hubspot_owner_id) updateProperties.hubspot_owner_id = hubspot_owner_id.toString();
    if (dealtype) updateProperties.dealtype = dealtype;
    if (source) updateProperties.hs_deal_source_id = source;
    if (orderNumber) updateProperties.hs_order_number = orderNumber;

    const updateData = {
      properties: updateProperties
    };

    console.log('Updating order with data:', JSON.stringify(updateData, null, 2));

    const response = await axios.patch(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/deals/${orderId}`,
      updateData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Order updated successfully');
    res.status(200).json({
      crmType: "hubSpot",
      success: true,
      data: response.data,
      message: 'Order (deal) updated successfully'
    });
  } catch (error) {
    console.error('Error in updateOrder:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to update order',
      details: error.response?.data
    });
  }
};

/**
 * Delete an order (deal)
 */
export const deleteOrder = async (req, res) => {
  try {
    console.log('Starting delete order process...');
    const accessToken = await getAccessToken(req);
    const { orderId } = req.params;
    console.log('Access token retrieved successfully, Order ID:', orderId);

    if (!orderId) {
      return res.status(400).json({
        crmType: "hubSpot",
        error: 'Order ID is required'
      });
    }

    await axios.delete(
      `${HUBSPOT_CONFIG.apiBaseUrl}/crm/v3/objects/deals/${orderId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Order deleted successfully');
    res.status(200).json({
      crmType: "hubSpot",
      success: true,
      message: 'Order (deal) deleted successfully',
      data: {
        deletedOrderId: orderId
      },
      note: 'Associated line items may also be deleted depending on HubSpot configuration'
    });
  } catch (error) {
    console.error('Error in deleteOrder:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(error.response?.status || 500).json({
      crmType: "hubSpot",
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to delete order',
      details: error.response?.data
    });
  }
};

export const createLead = async (req, res) => {
  try {
    const accessToken = await getAccessToken(req);
    console.log('🎯 Creating new lead in HubSpot...');

    const properties = {
      email: req.body.email,
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      phone: req.body.phone,
      company: req.body.company,
      website: req.body.website,
      lifecyclestage: 'lead',
      hs_lead_status: req.body.status || 'NEW'
    };

    // Remove undefined properties
    Object.keys(properties).forEach(key => 
      properties[key] === undefined && delete properties[key]
    );

    console.log('Creating lead with properties:', properties);

    const response = await axios.post(
      'https://api.hubapi.com/crm/v3/objects/contacts',
      { properties },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Lead created successfully:', response.data);

    res.status(201).json({
      status: 'success',
      message: 'Lead created successfully',
      data: {
        lead: response.data
      }
    });
  } catch (error) {
    console.error('❌ Error creating lead:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: 'Failed to create lead',
      error: error.response?.data || error.message
    });
  }
};

export const getAllLeads = async (req, res) => {
  try {
    const accessToken = await getAccessToken(req);
    console.log('🔍 Fetching all leads from HubSpot...');

    // Set up filter for leads
    const filter = {
      filterGroups: [{
        filters: [{
          propertyName: 'lifecyclestage',
          operator: 'EQ',
          value: 'lead'
        }]
      }]
    };

    // Add pagination parameters
    const limit = parseInt(req.query.limit) || 100;
    const after = req.query.after || undefined;

    const response = await axios.post(
      `https://api.hubapi.com/crm/v3/objects/contacts/search`,
      {
        ...filter,
        limit,
        after,
        properties: [
          'email',
          'firstname',
          'lastname',
          'phone',
          'company',
          'website',
          'hs_lead_status',
          'lifecyclestage',
          'hs_lifecyclestage_lead_date',
          'createdate',
          'lastmodifieddate',
          'hs_pipeline'
        ],
        sorts: [
          {
            propertyName: 'createdate',
            direction: 'DESCENDING'
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Successfully retrieved ${response.data.results.length} leads`);

    // Format response to match other endpoints
    res.status(200).json({
      status: 'success',
      message: 'Leads retrieved successfully',
      data: {
        leads: response.data.results,
        pagination: {
          next: response.data.paging?.next,
          prev: response.data.paging?.prev,
          total: response.data.total
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching leads:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: 'Failed to fetch leads',
      error: error.response?.data || error.message
    });
  }
};

export const getLeadById = async (req, res) => {
  try {
    const accessToken = await getAccessToken(req);
    const leadId = req.params.id;
    console.log(`🔍 Fetching lead with ID: ${leadId}`);

    // Use search endpoint instead of get endpoint
    const response = await axios.post(
      'https://api.hubapi.com/crm/v3/objects/contacts/search',
      {
        filterGroups: [{
          filters: [{
            propertyName: 'hs_object_id',
            operator: 'EQ',
            value: leadId
          }]
        }],
        properties: [
          'email',
          'firstname',
          'lastname',
          'phone',
          'company',
          'website',
          'hs_lead_status',
          'lifecyclestage',
          'hs_lifecyclestage_lead_date',
          'createdate',
          'lastmodifieddate',
          'hs_pipeline'
        ],
        limit: 1
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data.results || response.data.results.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Lead not found',
        data: {
          contactId: leadId
        }
      });
    }

    const contact = response.data.results[0];
    console.log('Contact properties:', contact.properties);
    
    // Check lifecycle stage
    const lifecycleStage = contact.properties.lifecyclestage;
    console.log('Lifecycle stage:', lifecycleStage);

    if (lifecycleStage !== 'lead') {
      return res.status(404).json({
        status: 'error',
        message: 'Contact exists but is not a lead',
        data: {
          currentLifecycleStage: lifecycleStage,
          contactId: leadId
        }
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Lead retrieved successfully',
      data: {
        lead: contact
      }
    });
  } catch (error) {
    console.error('❌ Error fetching lead:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: 'Failed to fetch lead',
      error: error.response?.data || error.message
    });
  }
};

export const updateLead = async (req, res) => {
  try {
    const accessToken = await getAccessToken(req);
    const leadId = req.params.id;
    console.log(`🔄 Updating lead with ID: ${leadId}`);

    const properties = {
      ...req.body,
      lifecyclestage: 'lead'
    };

    const response = await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${leadId}`,
      { properties },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      status: 'success',
      message: 'Lead updated successfully',
      data: {
        lead: response.data
      }
    });
  } catch (error) {
    console.error('❌ Error updating lead:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: 'Failed to update lead',
      error: error.response?.data || error.message
    });
  }
};

export const deleteLead = async (req, res) => {
  try {
    const accessToken = await getAccessToken(req);
    const leadId = req.params.id;
    console.log(`🗑️ Deleting lead with ID: ${leadId}`);

    await axios.delete(
      `https://api.hubapi.com/crm/v3/objects/contacts/${leadId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      status: 'success',
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting lead:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: 'Failed to delete lead',
      error: error.response?.data || error.message
    });
  }
};
