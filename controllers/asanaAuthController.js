import axios from 'axios';
import crypto from 'crypto';
import { asanaClient } from '../config/asanaConfig.js';

// Constants
const ASANA_AUTH_URL = 'https://app.asana.com/-/oauth_authorize';
const ASANA_TOKEN_URL = 'https://app.asana.com/-/oauth_token';
const ASANA_API_BASE_URL = 'https://app.asana.com/api/1.0';

// Store for OAuth state and tokens (in production, use a proper database)
const oauthStateStore = new Map();
const oauthTokenStore = new Map();

/**
 * Generate a secure random state parameter for OAuth
 */
const generateState = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Get the authorization URL for Asana OAuth
 */
export const getAuthUrl = (req, res) => {
  try {
    const { platform = 'web' } = req.query;
    
    // Generate and store state
    const state = generateState();
    oauthStateStore.set(state, {
      platform,
      timestamp: Date.now()
    });

    // Configure OAuth parameters
    const params = new URLSearchParams({
      client_id: process.env.ASANA_CLIENT_ID,
      redirect_uri: process.env.ASANA_REDIRECT_URI,
      response_type: 'code',
      state,
      scope: 'default'
    });

    const authUrl = `${ASANA_AUTH_URL}?${params.toString()}`;

    res.json({
      status: true,
      authUrl,
      state
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({
      status: false,
      error: 'Failed to generate authorization URL',
      details: error.message
    });
  }
};

/**
 * Handle OAuth callback from Asana
 */
export const handleOAuthCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // Check for OAuth errors
    if (error) {
      throw new Error(`Asana OAuth error: ${error}`);
    }

    // Validate state
    const stateData = oauthStateStore.get(state);
    if (!stateData) {
      throw new Error('Invalid state parameter');
    }

    // Clean up state
    oauthStateStore.delete(state);

    // Exchange code for tokens
    const tokenResponse = await axios.post(ASANA_TOKEN_URL, null, {
      params: {
        grant_type: 'authorization_code',
        client_id: process.env.ASANA_CLIENT_ID,
        client_secret: process.env.ASANA_CLIENT_SECRET,
        redirect_uri: process.env.ASANA_REDIRECT_URI,
        code
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, refresh_token, expires_in, data } = tokenResponse.data;

    // Get user information
    const userResponse = await axios.get(`${ASANA_API_BASE_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const userId = userResponse.data.data.gid;

    // Store tokens securely
    oauthTokenStore.set(userId, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (expires_in * 1000),
      userData: userResponse.data.data
    });

    // Handle response based on platform
    if (stateData.platform === 'android') {
      return res.json({
        status: true,
        access_token,
        refresh_token,
        expires_in,
        user: userResponse.data.data
      });
    }

    // For web platform, redirect to frontend
    const frontendUrl = `${process.env.FRONTEND_URL}/auth/asana?access_token=${access_token}&refresh_token=${refresh_token}&expires_in=${expires_in}&user_id=${userId}`;
    return res.redirect(frontendUrl);

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      status: false,
      error: 'Authentication failed',
      details: error.message
    });
  }
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        status: false,
        error: 'Refresh token is required'
      });
    }

    const response = await axios.post(ASANA_TOKEN_URL, null, {
      params: {
        grant_type: 'refresh_token',
        client_id: process.env.ASANA_CLIENT_ID,
        client_secret: process.env.ASANA_CLIENT_SECRET,
        refresh_token
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, refresh_token: new_refresh_token, expires_in } = response.data;

    res.json({
      status: true,
      access_token,
      refresh_token: new_refresh_token,
      expires_in
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      status: false,
      error: 'Failed to refresh token',
      details: error.message
    });
  }
};

/**
 * Get token information
 */
export const getTokenInfo = async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.id;

    if (!userId) {
      return res.status(400).json({
        status: false,
        error: 'User ID is required'
      });
    }

    const tokenData = oauthTokenStore.get(userId);

    if (!tokenData) {
      return res.status(404).json({
        status: false,
        error: 'No token found for this user'
      });
    }

    res.json({
      status: true,
      data: {
        accessToken: tokenData.accessToken,
        expiresAt: tokenData.expiresAt,
        userData: tokenData.userData
      }
    });
  } catch (error) {
    console.error('Error getting token info:', error);
    res.status(500).json({
      status: false,
      error: 'Failed to get token information',
      details: error.message
    });
  }
};

/**
 * Revoke access token
 */
export const revokeAccess = async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.id;

    if (!userId) {
      return res.status(400).json({
        status: false,
        error: 'User ID is required'
      });
    }

    const tokenData = oauthTokenStore.get(userId);

    if (!tokenData) {
      return res.status(404).json({
        status: false,
        error: 'No token found for this user'
      });
    }

    // Revoke token with Asana
    await axios.post(`${ASANA_API_BASE_URL}/oauth/revoke`, null, {
      params: {
        token: tokenData.accessToken
      },
      headers: {
        'Authorization': `Bearer ${tokenData.accessToken}`
      }
    });

    // Remove token from store
    oauthTokenStore.delete(userId);

    res.json({
      status: true,
      message: 'Access revoked successfully'
    });
  } catch (error) {
    console.error('Error revoking access:', error);
    res.status(500).json({
      status: false,
      error: 'Failed to revoke access',
      details: error.message
    });
  }
}; 