import asyncHandler from 'express-async-handler';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import crypto from 'crypto';

dotenv.config();

const SALESFORCE_CLIENT_ID = process.env.SF_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SF_CLIENT_SECRET;
// const SALESFORCE_AUTH_REDIRECT = process.env.SF_REDIRECT_AUTH_URI;
const SALESFORCE_TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token';


// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};


// Generate a random code_verifier
const generateCodeVerifier = () => {
  return crypto.randomBytes(32).toString('base64url');
};

// Generate a code_challenge from the code_verifier
const generateCodeChallenge = (codeVerifier) => {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
};

const salesforceoAuth = async (req, res) => {
    try {
        const SF_CLIENT_ID = process.env.SF_CLIENT_ID;
        
        if (!SF_CLIENT_ID) {
            throw new Error('Salesforce Client ID is not configured.');
        }

        // Get platform from query params
        const platform = req.query.platform;
        console.log('Initiating OAuth flow for platform:', platform);

        // Generate PKCE code_verifier and code_challenge
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);

        // Store the code_verifier in the session
        req.session.codeVerifier = codeVerifier;

        const redirectUri = 'https://huscribe-backend-112929028022.us-central1.run.app/api/auth/salesforce/oauth/callback';
        
        // Build authorization URL
        let authUrl = `https://login.salesforce.com/services/oauth2/authorize?` +
            `response_type=code` +
            `&client_id=${SF_CLIENT_ID}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=api%20refresh_token%20offline_access` +
            `&prompt=consent` +
            `&code_challenge=${codeChallenge}` +
            `&code_challenge_method=S256`;

        // Add platform as state if provided
        if (platform) {
            authUrl += `&state=${platform}`;
        }

        console.log('Redirecting to auth URL with platform:', platform);
        res.redirect(authUrl);
    } catch (error) {
        console.error('Error in salesforceoAuth:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to initiate Salesforce OAuth',
            details: error.message,
        });
    }
};

const oauthCallback = async (req, res) => {
    try {
        const { code, error, error_description, state } = req.query;
        const platform = state; // Get platform from state parameter
        console.log('OAuth callback received with platform:', platform);

        // Check for Salesforce errors
        if (error) {
            throw new Error(`Salesforce OAuth error: ${error_description || error}`);
        }

        // Check for missing authorization code
        if (!code) {
            throw new Error('Authorization code is missing.');
        }

        const SF_CLIENT_ID = process.env.SF_CLIENT_ID;
        const SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET;

        if (!SF_CLIENT_ID || !SF_CLIENT_SECRET) {
            throw new Error('Salesforce Client ID or Client Secret is not configured.');
        }

        // Retrieve the code_verifier from the session
        const codeVerifier = req.session.codeVerifier;

        if (!codeVerifier) {
            throw new Error('Code verifier is missing.');
        }

        const redirectUri = 'https://huscribe-backend-112929028022.us-central1.run.app/api/auth/salesforce/oauth/callback';
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', SF_CLIENT_ID);
        params.append('client_secret', SF_CLIENT_SECRET);
        params.append('redirect_uri', redirectUri);
        params.append('code', code);
        params.append('code_verifier', codeVerifier);

        const response = await axios.post('https://login.salesforce.com/services/oauth2/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        // Calculate token expiration (2 hours from now)
        const expiresAt = Date.now() + (2 * 60 * 60 * 1000);

        // Store tokens and other data in session
        req.session.salesforce = {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            instanceUrl: response.data.instance_url,
            expiresAt: expiresAt,
            id: response.data.id,
            issuedAt: Date.now()
        };

        // Save session explicitly
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log('Session data stored, platform:', platform);
// Fetch user info from identity URL
const userInfoRes = await axios.get(response.data.id, {
    headers: {
        Authorization: `Bearer ${response.data.access_token}`
    }
});

const userInfo = userInfoRes.data;
        // Return JSON response for Android
        if (platform === 'android') {
            console.log('Returning JSON response for Android');
            return res.json({
                success: true,
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                instance_url: response.data.instance_url,
                id: response.data.id,
                token_type: response.data.token_type,
                issued_at: Date.now(),
                expires_at: expiresAt,
                email: userInfo.email,
                username: userInfo.username,
                 fullName: `${userInfo.first_name} ${userInfo.last_name}`
            });
        }

        // Redirect to frontend for web platform
        console.log('Redirecting to frontend URL for web platform');
        const frontendUrl = `${process.env.FRONTEND_URL}/auth/salesforce?access_token=${response.data.access_token}&refresh_token=${response.data.refresh_token}&expires_at=${expiresAt}&instance_url=${encodeURIComponent(response.data.instance_url)}&email=${userInfo.email}&username=${userInfo.username}&fullName=${userInfo.first_name} ${userInfo.last_name}`;
        return res.redirect(frontendUrl);

    } catch (error) {
        console.error('Error in oauthCallback:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to authenticate with Salesforce',
            details: error.message,
        });
    }
};

///=====web======////

const salesforceoAuthWeb = async (req, res) => {
  try {
  const  SF_CLIENT_ID = process.env.SF_CLIENT_ID;
    if (!SF_CLIENT_ID) {
      throw new Error('Salesforce Client ID is not configured.');
    }

  // Generate PKCE code_verifier and code_challenge
    const codeVerifier = generateCodeVerifier();
    console.log(codeVerifier, "Here is the code verifier====")
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Store the code_verifier in the session or cookies for later use
     req.session.codeVerifier = codeVerifier;
    console.log('Stored code_verifier in session:', req.session.codeVerifier);

const redirectUri= 'https://huscribe-backend-112929028022.us-central1.run.app/api/auth/salesforce/oauth/callback/web'
    const authUrl = `https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=${SF_CLIENT_ID}&redirect_uri=${redirectUri}&scope=api&code_challenge=${codeChallenge}&code_challenge_method=S256`;

    console.log('Redirecting to:', authUrl); // Log the redirect URL for debugging
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error in salesforceoAuth:', error.message);
    res.status(500).json({
      error: 'Failed to initiate Salesforce OAuth',
      details: error.message,
    });
  }
};

// controllers/authController.js
const oauthCallbackWeb = async (req, res) => {
  try {
    const { code, error, error_description } = req.query;

    // Check for Salesforce errors
    if (error) {
      throw new Error(`Salesforce OAuth error: ${error_description || error}`);
    }

    // Check for missing authorization code
    if (!code) {
      throw new Error('Authorization code is missing. Ensure the user authorized the app and the callback URL is correct.');
    }

    // const { SF_CLIENT_ID, SF_CLIENT_SECRET } = process.env;
    const SF_CLIENT_ID = process.env.SF_CLIENT_ID;
    const SF_CLIENT_SECRET= process.env.SF_CLIENT_SECRET;

    if (!SF_CLIENT_ID || !SF_CLIENT_SECRET) {
      throw new Error('Salesforce Client ID or Client Secret is not configured.');
    }

    // Retrieve the code_verifier from the session
    const codeVerifier = req.session.codeVerifier;
    if (!codeVerifier) {
      throw new Error('Code verifier is missing. Ensure the authorization flow was initiated correctly.');
    }

    const redirectUri = 'https://huscribe-backend-112929028022.us-central1.run.app/api/auth/salesforce/oauth/callback';
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', SF_CLIENT_ID);
    params.append('client_secret', SF_CLIENT_SECRET);
    params.append('redirect_uri', redirectUri);
    params.append('code', code);
    params.append('code_verifier', codeVerifier); // Include the code_verifier

    const response = await axios.post('https://login.salesforce.com/services/oauth2/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    // Store the access token and instance URL in the session
    req.session.accessToken = response.data.access_token;
    req.session.instanceUrl = response.data.instance_url;

    res.json({
      access_token: response.data.access_token,
      instance_url: response.data.instance_url,
      id: response.data.id,
      token_type: response.data.token_type,
    });
    //  const frontendUrl = `http://localhost:3002/auth/salesforce?access_token=${response.data.access_token}&instance_url=${encodeURIComponent(response.data.instance_url)}`;
    // res.redirect(frontendUrl)
  } catch (error) {
    console.error('Error in oauthCallback:', error.message);
    res.status(500).json({
      error: 'Failed to authenticate with Salesforce',
      details: error.message,
    });
  }
};

// const SALESFORCE_TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token';

// Endpoint to handle Salesforce login
const salesForceUserLogin = async (req, res) => {
  const { username, password, securityToken } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', process.env.SF_CLIENT_ID);
    params.append('client_secret', process.env.SF_CLIENT_SECRET);
    params.append('username', username);
    params.append('password', securityToken ? `${password}${securityToken}` : password);

    const response = await axios.post(SALESFORCE_TOKEN_URL, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    res.json({
      access_token: response.data.access_token,
      instance_url: response.data.instance_url,
      id: response.data.id,
      token_type: response.data.token_type,
    });
  } catch (error) {
    console.error('Salesforce login error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to authenticate with Salesforce',
      details: error.response?.data || error.message,
    });
  }
};
// @desc    Handle Salesforce OAuth callback
// @route   POST /api/auth/salesforce/callback
// @access  Public
const handleSalesforceCallback = asyncHandler(async (req, res) => {
    const { code, redirect_uri, code_verifier, email } = req.body;
    console.log('Received callback with:', { code, redirect_uri, code_verifier, email });
    console.log('Using Salesforce config:', {
        client_id: SALESFORCE_CLIENT_ID,
        redirect_uri: redirect_uri,
        token_url: SALESFORCE_TOKEN_URL
    });

    if (!code || !redirect_uri || !code_verifier) {
        res.status(400);
        throw new Error('Missing required OAuth parameters');
    }

    try {
        console.log('Making token request to Salesforce with params:', {
            grant_type: 'authorization_code',
            client_id: SALESFORCE_CLIENT_ID,
            client_secret: SALESFORCE_CLIENT_SECRET.substring(0, 5) + '...',
            code: code,
            redirect_uri: redirect_uri,
            code_verifier: code_verifier
        });

        const tokenResponse = await axios.post(SALESFORCE_TOKEN_URL, null, {
            params: {
                grant_type: 'authorization_code',
                client_id: SALESFORCE_CLIENT_ID,
                client_secret: SALESFORCE_CLIENT_SECRET,
                code,
                redirect_uri,
                code_verifier
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log('Received token response:', tokenResponse.data);

        const {
            access_token,
            refresh_token,
            instance_url,
            id: userInfoUrl,
            issued_at
        } = tokenResponse.data;

        // Fetch user info from Salesforce
        const userInfoResponse = await axios.get(userInfoUrl, {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });

        const salesforceUser = userInfoResponse.data;
        console.log('Salesforce user info:', salesforceUser);

        // Find or create user using Salesforce email
        const userEmail = salesforceUser.email || email;
        const userName = salesforceUser.display_name || salesforceUser.name || userEmail.split('@')[0];

        let user = await User.findOne({ email: userEmail });
        if (!user) {
            // Create new user if doesn't exist
            user = await User.create({
                email: userEmail,
                name: userName,
                password: Math.random().toString(36).slice(-8), // Random password
                salesforce_user_id: salesforceUser.user_id,
                salesforce_info: {
                    organization_id: salesforceUser.organization_id,
                    username: salesforceUser.username,
                    display_name: salesforceUser.display_name,
                    email: salesforceUser.email,
                    first_name: salesforceUser.first_name,
                    last_name: salesforceUser.last_name,
                    locale: salesforceUser.locale,
                    language: salesforceUser.language,
                    timezone: salesforceUser.timezone,
                    instance_url: instance_url,
                    user_type: salesforceUser.user_type,
                    last_modified_date: salesforceUser.last_modified_date,
                    profile_id: salesforceUser.profile_id,
                    role_id: salesforceUser.role_id
                },
                isAdmin: false // Default to false for security
            });
        } else {
            // Update existing user with latest Salesforce info
            user = await User.findByIdAndUpdate(
                user._id,
                {
                    name: userName,
                    salesforce_user_id: salesforceUser.user_id,
                    salesforce_info: {
                        organization_id: salesforceUser.organization_id,
                        username: salesforceUser.username,
                        display_name: salesforceUser.display_name,
                        email: salesforceUser.email,
                        first_name: salesforceUser.first_name,
                        last_name: salesforceUser.last_name,
                        locale: salesforceUser.locale,
                        language: salesforceUser.language,
                        timezone: salesforceUser.timezone,
                        instance_url: instance_url,
                        user_type: salesforceUser.user_type,
                        last_modified_date: salesforceUser.last_modified_date,
                        profile_id: salesforceUser.profile_id,
                        role_id: salesforceUser.role_id
                    }
                },
                { new: true, runValidators: true }
            );
        }

        // Generate JWT token
        const token = generateToken(user._id);

        // Set cookies with appropriate settings for cross-origin
        res.cookie('sf_access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/'
        });

        res.cookie('sf_refresh_token', refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
            path: '/'
        });

        res.json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                isAdmin: user.isAdmin,
                salesforce_info: user.salesforce_info
            },
            salesforce: {
                access_token,
                refresh_token,
                instance_url,
                user_id: userInfoUrl,
                issued_at
            }
        });

    } catch (error) {
        console.error('Salesforce OAuth error:', error.response?.data || error.message);
        console.error('Full error:', error);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.error_description || 'Failed to authenticate with Salesforce',
            details: error.response?.data || error.message
        });
    }
});

// @desc    Refresh Salesforce access token
// @route   GET /api/auth/salesforce/refresh
// @access  Public
const refreshSalesforceToken = asyncHandler(async (req, res) => {
    try {
        const { refresh_token } = req.query;

    if (!refresh_token) {
            return res.status(400).json({
                success: false,
                error: 'refresh_token_required',
                error_description: 'Refresh token is required'
            });
    }

        const SF_CLIENT_ID = process.env.SF_CLIENT_ID;
        const SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET;

        // Create the request body as a string
        const requestBody = `grant_type=refresh_token&client_id=${SF_CLIENT_ID}&client_secret=${SF_CLIENT_SECRET}&refresh_token=${refresh_token}`;

        console.log('Attempting to refresh token with params:', {
                grant_type: 'refresh_token',
            client_id: SF_CLIENT_ID,
            refresh_token: refresh_token.substring(0, 10) + '...' // Log only first 10 chars for security
        });

        const response = await axios({
            method: 'post',
            url: 'https://login.salesforce.com/services/oauth2/token',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: requestBody
        });

        console.log('Received refresh response');

        // Get current timestamp and calculate expiration
        const currentTime = Date.now();
        const tokenLifespan = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
        const expiresAt = currentTime + tokenLifespan;

        // Store the new tokens in session
        const sessionData = {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token || refresh_token,
            instanceUrl: response.data.instance_url,
            expiresAt,
            id: response.data.id,
            issuedAt: currentTime,
            tokenLifespan
        };

        req.session.salesforce = sessionData;

        // Save session explicitly
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log('New session data stored:', {
            hasAccessToken: !!sessionData.accessToken,
            hasRefreshToken: !!sessionData.refreshToken,
            instanceUrl: sessionData.instanceUrl,
            expiresIn: Math.floor(tokenLifespan / 1000), // Convert to seconds
            issuedAt: new Date(currentTime).toISOString(),
            expiresAt: new Date(expiresAt).toISOString()
        });

        return res.json({
            success: true,
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token || refresh_token,
            instance_url: response.data.instance_url,
            id: response.data.id,
            token_type: 'Bearer',
            issued_at: currentTime,
            expires_at: expiresAt,
            expires_in: Math.floor(tokenLifespan / 1000) // Return expiration in seconds
        });

    } catch (error) {
        console.error('Token refresh error:', {
            status: error.response?.status,
            error: error.response?.data?.error,
            description: error.response?.data?.error_description,
            response: error.response?.data
        });

        // If token is invalid or expired, return specific error
        if (error.response?.data?.error === 'invalid_grant') {
            return res.status(401).json({
                success: false,
                error: 'invalid_grant',
                error_description: 'Refresh token is invalid or expired. Please re-authenticate.',
                requires_reauth: true
            });
        }

        // Handle other errors
        return res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.error || 'refresh_failed',
            error_description: error.response?.data?.error_description || 'Failed to refresh token',
            requires_reauth: true
        });
    }
});

// @desc    Revoke Salesforce tokens
// @route   POST /api/auth/salesforce/revoke
// @access  Private
const revokeSalesforceTokens = asyncHandler(async (req, res) => {
    const { access_token, refresh_token } = req.body;

    try {
        // Revoke access token
        if (access_token) {
            await axios.post('https://login.salesforce.com/services/oauth2/revoke', null, {
                params: {
                    token: access_token
                }
            });
        }

        // Revoke refresh token
        if (refresh_token) {
            await axios.post('https://login.salesforce.com/services/oauth2/revoke', null, {
                params: {
                    token: refresh_token
                }
            });
        }

        // Clear cookies with appropriate settings
        res.clearCookie('sf_access_token', {
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        });
        res.clearCookie('sf_refresh_token', {
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        });

        res.json({ success: true, message: 'Salesforce tokens revoked successfully' });

    } catch (error) {
        console.error('Salesforce token revocation error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to revoke Salesforce tokens',
            details: error.response?.data || error.message
        });
    }
});


///// login with username and password

const salesForceLogin=  async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', process.env.SF_CLIENT_ID);
    params.append('client_secret', process.env.SF_CLIENT_SECRET);
    params.append('username', username);
    params.append('password', password + process.env.SF_SECURITY_TOKEN);

    const response = await axios.post(SALESFORCE_TOKEN_URL, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    res.json({
      access_token: response.data.access_token,
      instance_url: response.data.instance_url,
      id: response.data.id,
      token_type: response.data.token_type,
    });
  } catch (error) {
    console.error('Salesforce login error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to authenticate with Salesforce',
      details: error.response?.data || error.message,
    });
  }
};

// @desc    Clear all Salesforce tokens (Development only)
// @route   GET /api/auth/salesforce/clear-tokens
// @access  Public
const clearTokens = asyncHandler(async (req, res) => {
    try {
        if (req.session) {
            // Clear session data
            delete req.session.salesforce;
            delete req.session.accessToken;
            delete req.session.refreshToken;
            delete req.session.instanceUrl;
        }

        res.json({
            success: true,
            message: 'All tokens cleared successfully'
        });
    } catch (error) {
        console.error('Error clearing tokens:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear tokens'
        });
    }
});

// @desc    Check token status (Development only)
// @route   GET /api/auth/salesforce/token-status
// @access  Public
const checkTokenStatus = asyncHandler(async (req, res) => {
    try {
        console.log('Full session data:', req.session);
        
        const sessionData = req.session.salesforce || {};
        const currentTime = Date.now();

        const status = {
            hasAccessToken: !!sessionData.accessToken,
            hasRefreshToken: !!sessionData.refreshToken,
            hasInstanceUrl: !!sessionData.instanceUrl,
            tokenExpired: sessionData.expiresAt ? currentTime >= sessionData.expiresAt : true,
            timeUntilExpiry: sessionData.expiresAt ? sessionData.expiresAt - currentTime : 0,
            session: {
                accessToken: sessionData.accessToken ? `${sessionData.accessToken.substring(0, 10)}...` : null,
                refreshToken: sessionData.refreshToken ? `${sessionData.refreshToken.substring(0, 10)}...` : null,
                instanceUrl: sessionData.instanceUrl,
                expiresAt: sessionData.expiresAt ? new Date(sessionData.expiresAt).toISOString() : null,
                issuedAt: sessionData.issuedAt ? new Date(sessionData.issuedAt).toISOString() : null
            },
            rawSessionData: process.env.NODE_ENV === 'development' ? sessionData : undefined
        };

        res.json({
            success: true,
            status
        });
    } catch (error) {
        console.error('Error checking token status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check token status',
            details: error.message
        });
    }
});

export {
    handleSalesforceCallback,
    refreshSalesforceToken,
    revokeSalesforceTokens,
    salesForceLogin,
    salesForceUserLogin,
    salesforceoAuth,
    oauthCallback,
    clearTokens,
    checkTokenStatus
};