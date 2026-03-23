import axios from 'axios';
import crypto from 'crypto';
import asyncHandler from 'express-async-handler';

// OAuth Configuration
const CHILIPIPER_OAUTH_CONFIG = {
    authUrl: 'https://app.chilipiper.com/oauth/authorize',
    tokenUrl: 'https://app.chilipiper.com/oauth/token',
    clientId: process.env.CHILIPIPER_CLIENT_ID,
    clientSecret: process.env.CHILIPIPER_CLIENT_SECRET,
    redirectUri: process.env.CHILIPIPER_REDIRECT_URI,
    scope: 'meetings.read meetings.write webhooks.read webhooks.write'
};

// Token store (in production, use a proper database)
const tokenStore = new Map();

// Generate secure random state
const generateState = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Utility function to validate ChiliPiper webhook signatures
const validateWebhookSignature = (signature, payload, secret) => {
    const hmac = crypto.createHmac('sha256', secret);
    const calculatedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature));
};

// Authentication middleware
export const authenticateToken = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401);
        throw new Error('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const tokenData = tokenStore.get(token);

    if (!tokenData) {
        res.status(401);
        throw new Error('Invalid token');
    }

    if (Date.now() > tokenData.expiresAt) {
        // Token expired, try to refresh
        try {
            const newTokens = await refreshAccessToken(tokenData.refreshToken);
            req.accessToken = newTokens.access_token;
            next();
        } catch (error) {
            res.status(401);
            throw new Error('Token expired and refresh failed');
        }
    } else {
        req.accessToken = token;
        next();
    }
});

// Initialize OAuth flow
export const initiateOAuth = asyncHandler(async (req, res) => {
    const state = generateState();
    const platform = req.query.platform || 'web';

    // Store state with platform info
    tokenStore.set(state, {
        platform,
        createdAt: Date.now()
    });

    const authUrl = `${CHILIPIPER_OAUTH_CONFIG.authUrl}?` + new URLSearchParams({
        client_id: CHILIPIPER_OAUTH_CONFIG.clientId,
        redirect_uri: CHILIPIPER_OAUTH_CONFIG.redirectUri,
        response_type: 'code',
        scope: CHILIPIPER_OAUTH_CONFIG.scope,
        state
    });

    res.status(200).json({
        success: true,
        data: { authUrl }
    });
});

// Handle OAuth callback
export const handleOAuthCallback = asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        throw new Error(`OAuth error: ${error}`);
    }

    if (!code || !state) {
        throw new Error('Missing required OAuth parameters');
    }

    const stateData = tokenStore.get(state);
    if (!stateData) {
        throw new Error('Invalid state parameter');
    }

    // Clean up used state
    tokenStore.delete(state);

    try {
        const tokenResponse = await axios.post(CHILIPIPER_OAUTH_CONFIG.tokenUrl, null, {
            params: {
                grant_type: 'authorization_code',
                client_id: CHILIPIPER_OAUTH_CONFIG.clientId,
                client_secret: CHILIPIPER_OAUTH_CONFIG.clientSecret,
                redirect_uri: CHILIPIPER_OAUTH_CONFIG.redirectUri,
                code
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        // Store tokens
        tokenStore.set(access_token, {
            refreshToken: refresh_token,
            expiresAt: Date.now() + (expires_in * 1000),
            platform: stateData.platform
        });

        // Handle response based on platform
        if (stateData.platform === 'android') {
            return res.json({
                success: true,
                data: {
                    access_token,
                    refresh_token,
                    expires_in
                }
            });
        }

        // For web platform, redirect to frontend
        const frontendUrl = `${process.env.FRONTEND_URL}/auth/chilipiper?access_token=${access_token}&refresh_token=${refresh_token}&expires_in=${expires_in}`;
        res.redirect(frontendUrl);
    } catch (error) {
        console.error('OAuth token exchange error:', error.response?.data || error.message);
        throw new Error('Failed to exchange authorization code for tokens');
    }
});

// Refresh access token
const refreshAccessToken = async (refreshToken) => {
    try {
        const response = await axios.post(CHILIPIPER_OAUTH_CONFIG.tokenUrl, null, {
            params: {
                grant_type: 'refresh_token',
                client_id: CHILIPIPER_OAUTH_CONFIG.clientId,
                client_secret: CHILIPIPER_OAUTH_CONFIG.clientSecret,
                refresh_token: refreshToken
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token, expires_in } = response.data;

        // Update token store
        tokenStore.set(access_token, {
            refreshToken: refresh_token,
            expiresAt: Date.now() + (expires_in * 1000)
        });

        return response.data;
    } catch (error) {
        console.error('Token refresh error:', error.response?.data || error.message);
        throw new Error('Failed to refresh access token');
    }
};

// @desc    Create a new ChiliPiper meeting
// @route   POST /api/chilipiper/meetings
// @access  Private
export const createMeeting = asyncHandler(async (req, res) => {
    const {
        routerName,
        startTime,
        endTime,
        attendees,
        meetingDetails,
        metadata
    } = req.body;

    try {
        const response = await axios.post(
            `https://${process.env.CHILI_PIPER_WORKSPACE_ID}.chilipiper.com/api/v1/meetings`,
            {
                routerName,
                startTime,
                endTime,
                attendees,
                meetingDetails,
                metadata
            },
            {
                headers: {
                    'Authorization': `Bearer ${req.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(201).json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error creating meeting:', error.response?.data || error.message);
        throw new Error('Failed to create meeting');
    }
});

// @desc    Get meetings from ChiliPiper
// @route   GET /api/chilipiper/meetings
// @access  Private
export const getMeetings = asyncHandler(async (req, res) => {
    try {
        const response = await axios.get(
            `https://${process.env.CHILI_PIPER_WORKSPACE_ID}.chilipiper.com/api/v1/meetings`,
            {
                headers: {
                    'Authorization': `Bearer ${req.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error fetching meetings:', error.response?.data || error.message);
        throw new Error('Failed to fetch meetings');
    }
});

// @desc    Get single meeting
// @route   GET /api/chilipiper/meetings/:id
// @access  Private
export const getMeeting = asyncHandler(async (req, res) => {
    try {
        const response = await axios.get(
            `https://${process.env.CHILI_PIPER_WORKSPACE_ID}.chilipiper.com/api/v1/meetings/${req.params.id}`,
            {
                headers: {
                    'Authorization': `Bearer ${req.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error fetching meeting:', error.response?.data || error.message);
        throw new Error('Failed to fetch meeting');
    }
});

// @desc    Update meeting
// @route   PUT /api/chilipiper/meetings/:id
// @access  Private
export const updateMeeting = asyncHandler(async (req, res) => {
    try {
        const response = await axios.put(
            `https://${process.env.CHILI_PIPER_WORKSPACE_ID}.chilipiper.com/api/v1/meetings/${req.params.id}`,
            req.body,
            {
                headers: {
                    'Authorization': `Bearer ${req.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error updating meeting:', error.response?.data || error.message);
        throw new Error('Failed to update meeting');
    }
});

// @desc    Delete meeting
// @route   DELETE /api/chilipiper/meetings/:id
// @access  Private
export const deleteMeeting = asyncHandler(async (req, res) => {
    try {
        await axios.delete(
            `https://${process.env.CHILI_PIPER_WORKSPACE_ID}.chilipiper.com/api/v1/meetings/${req.params.id}`,
            {
                headers: {
                    'Authorization': `Bearer ${req.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({
            success: true,
            message: 'Meeting deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting meeting:', error.response?.data || error.message);
        throw new Error('Failed to delete meeting');
    }
});

// @desc    Handle ChiliPiper webhooks
// @route   POST /api/chilipiper/webhook
// @access  Public
export const handleWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers['x-chilipiper-signature'];
    
    if (!signature) {
        res.status(401);
        throw new Error('No signature provided');
    }

    const isValid = validateWebhookSignature(
        signature,
        req.body,
        process.env.CHILIPIPER_WEBHOOK_SECRET
    );

    if (!isValid) {
        res.status(401);
        throw new Error('Invalid webhook signature');
    }

    // Process webhook data
    console.log('Received webhook:', req.body);

    res.status(200).json({
        success: true,
        message: 'Webhook processed successfully'
    });
});
