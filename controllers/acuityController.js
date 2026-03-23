import Acuity from 'acuityscheduling';
import { validationResult } from 'express-validator';
import crypto from 'crypto';
import axios from 'axios';
import qs from 'qs';

// OAuth configuration
const ACUITY_OAUTH_CLIENT_ID = process.env.ACUITY_OAUTH_CLIENT_ID;
const ACUITY_OAUTH_CLIENT_SECRET = process.env.ACUITY_OAUTH_CLIENT_SECRET;
const ACUITY_OAUTH_REDIRECT_URI = process.env.ACUITY_OAUTH_REDIRECT_URI;
const ACUITY_OAUTH_AUTH_URL = 'https://acuityscheduling.com/oauth2/authorize';
const ACUITY_OAUTH_TOKEN_URL = 'https://acuityscheduling.com/oauth2/token';

// Store OAuth state and user sessions (in production, use a proper database)
const oauthStates = new Map();
const userSessions = new Map();

// Generate random state for OAuth security
const generateState = () => {
    return crypto.randomBytes(16).toString('hex');
};

// Modify the error handling middleware
const handleAcuityError = (error) => {
    console.error('[Acuity Error] Full error:', error);
    console.error('[Acuity Error] Response data:', error.response?.data);
    console.error('[Acuity Error] Status:', error.response?.status);
    console.error('[Acuity Error] Headers:', error.response?.headers);

    if (error.response) {
        return {
            status: error.response.status,
            message: error.response.data.message || 'Acuity API error',
            details: error.response.data
        };
    }
    return {
        status: 500,
        message: 'Internal server error',
        details: error.message
    };
};

// OAuth Controller Functions
export const initiateOAuth = (req, res) => {
    try {
        const state = generateState();
        const returnUrl = req.query.returnUrl || '/';
        const autoRedirect = req.query.autoRedirect === 'true';

        // Log the generated state and returnUrl
        console.log('[Acuity OAuth] Generated state:', state);
        console.log('[Acuity OAuth] Return URL:', returnUrl);

        oauthStates.set(state, {
            timestamp: Date.now(),
            returnUrl
        });

        // Log the OAuth config values
        console.log('[Acuity OAuth] Client ID:', ACUITY_OAUTH_CLIENT_ID);
        console.log('[Acuity OAuth] Redirect URI:', ACUITY_OAUTH_REDIRECT_URI);
        console.log('[Acuity OAuth] Auth URL:', ACUITY_OAUTH_AUTH_URL);

        const authUrl = new URL(ACUITY_OAUTH_AUTH_URL);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('client_id', ACUITY_OAUTH_CLIENT_ID);
        authUrl.searchParams.append('redirect_uri', ACUITY_OAUTH_REDIRECT_URI);
        authUrl.searchParams.append('state', state);
        authUrl.searchParams.append('scope', 'api-v1'); // REQUIRED by Acuity

        // Log the final URL
        console.log('[Acuity OAuth] Final Auth URL:', authUrl.toString());

        if (autoRedirect) {
            return res.redirect(authUrl.toString());
        }

        res.redirect(authUrl.toString());
    } catch (error) {
        console.error('[Acuity OAuth] Error in initiateOAuth:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initiate OAuth flow',
            details: error.message
        });
    }
};

export const handleOAuthCallback = async (req, res) => {
    const { code, state } = req.query;

    console.log('[Acuity OAuth Callback] Received code:', code);
    console.log('[Acuity OAuth Callback] Received state:', state);

    if (!oauthStates.has(state)) {
        console.error('[Acuity OAuth Callback] Invalid state parameter');
        return res.status(400).json({
            success: false,
            error: 'Invalid state parameter'
        });
    }

    const stateData = oauthStates.get(state);
    oauthStates.delete(state);

    try {
        // Exchange code for token using form-urlencoded body
        console.log('[Acuity OAuth Callback] Requesting access token...');
        let tokenResponse;
        try {
            tokenResponse = await axios.post(
                'https://acuityscheduling.com/oauth2/token',
                qs.stringify({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: ACUITY_OAUTH_REDIRECT_URI,
                    client_id: ACUITY_OAUTH_CLIENT_ID,
                    client_secret: ACUITY_OAUTH_CLIENT_SECRET
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );
            console.log('[Acuity OAuth Callback] Token response:', tokenResponse.data);
        } catch (tokenErr) {
            console.error('[Acuity OAuth Callback] Error requesting token:', tokenErr.response?.data || tokenErr.message || tokenErr);
            return res.status(500).json({
                success: false,
                error: 'Failed to exchange code for token',
                details: tokenErr.response?.data || tokenErr.message || tokenErr
            });
        }

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        // Fetch user info using axios
        console.log('[Acuity OAuth Callback] Requesting user info...');
        let userResponse;
        try {
            userResponse = await axios.get('https://acuityscheduling.com/api/v1/me', {
                headers: {
                    Authorization: `Bearer ${access_token}`
                }
            });
            console.log('[Acuity OAuth Callback] User info:', userResponse.data);
        } catch (userErr) {
            console.error('[Acuity OAuth Callback] Error fetching user info:', userErr.response?.data || userErr.message || userErr);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch user info',
                details: userErr.response?.data || userErr.message || userErr
            });
        }

        const userData = userResponse.data;
        const sessionId = crypto.randomBytes(32).toString('hex');

        userSessions.set(sessionId, {
            userId: userData.id,
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: Date.now() + (typeof expires_in === 'number' && !isNaN(expires_in) ? expires_in * 1000 : 3600 * 1000),
            userData
        });

        res.json({
            success: true,
            access_token,
            refresh_token,
            expires_in,
            user: userData
        });
    } catch (error) {
        console.error('[Acuity OAuth Callback] General error:', error.response?.data || error.message || error);
        res.status(500).json({
            success: false,
            error: 'Failed to complete authentication',
            details: error.response?.data || error.message || error
        });
    }
};

export const verifyOAuthToken = async (req, res, next) => {
    console.log('[Acuity Auth] Verifying token...');
    console.log('[Acuity Auth] Headers:', req.headers);
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('[Acuity Auth] No valid authorization header found');
        return res.status(401).json({
            success: false,
            error: 'No access token provided'
        });
    }

    const accessToken = authHeader.split(' ')[1];
    console.log('[Acuity Auth] Access token:', accessToken);
    
    try {
        console.log('[Acuity Auth] Making request to /me endpoint');
        const response = await axios.get('https://acuityscheduling.com/api/v1/me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        console.log('[Acuity Auth] User info response:', response.data);

        req.acuityUser = {
            ...response.data,
            access_token: accessToken
        };
        next();
    } catch (error) {
        console.error('[Acuity Auth] Error verifying token:', error);
        console.error('[Acuity Auth] Error response:', error.response?.data);
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired access token',
            details: error.response?.data
        });
    }
};

export const refreshAccessToken = async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(400).json({
            success: false,
            error: 'Refresh token is required'
        });
    }

    try {
        const response = await axios.post(
            'https://acuityscheduling.com/oauth2/token',
            qs.stringify({
                grant_type: 'refresh_token',
                refresh_token,
                client_id: ACUITY_OAUTH_CLIENT_ID,
                client_secret: ACUITY_OAUTH_CLIENT_SECRET
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const { access_token, refresh_token: new_refresh_token, expires_in } = response.data;

        res.json({
            success: true,
            access_token,
            refresh_token: new_refresh_token,
            expires_in
        });
    } catch (error) {
        console.error('[Acuity OAuth] Error refreshing token:', error.response?.data || error.message || error);
        res.status(401).json({
            success: false,
            error: 'Failed to refresh token',
            details: error.response?.data || error.message || error
        });
    }
};

export const logout = (req, res) => {
    const sessionId = req.cookies.acuity_session;
    if (sessionId) {
        userSessions.delete(sessionId);
    }
    res.clearCookie('acuity_session');
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
};

// Add this constant for the base URL
const ACUITY_API_BASE_URL = 'https://acuityscheduling.com/api/v1';

// Modify getAppointmentTypes
export const getAppointmentTypes = async (req, res) => {
    console.log('[Acuity] Getting appointment types...');
    console.log('[Acuity] Access token:', req.acuityUser?.access_token);

    try {
        console.log('[Acuity] Making request to /appointment-types');
        const response = await axios.get(`${ACUITY_API_BASE_URL}/appointment-types`, {
            headers: {
                Authorization: `Bearer ${req.acuityUser.access_token}`
            }
        });
        console.log('[Acuity] Appointment types response:', response.data);

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('[Acuity] Error in getAppointmentTypes:', error);
        const errorResponse = handleAcuityError(error);
        res.status(errorResponse.status).json({
            success: false,
            error: errorResponse.message,
            details: errorResponse.details
        });
    }
};

// Modify getAppointments
export const getAppointments = async (req, res) => {
    console.log('[Acuity] Getting appointments...');
    console.log('[Acuity] Access token:', req.acuityUser?.access_token);

    try {
        console.log('[Acuity] Making request to /appointments');
        const response = await axios.get(`${ACUITY_API_BASE_URL}/appointments`, {
            headers: {
                Authorization: `Bearer ${req.acuityUser.access_token}`
            }
        });
        console.log('[Acuity] Appointments response:', response.data);

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('[Acuity] Error in getAppointments:', error);
        const errorResponse = handleAcuityError(error);
        res.status(errorResponse.status).json({
            success: false,
            error: errorResponse.message,
            details: errorResponse.details
        });
    }
};

// Modify createAppointment
export const createAppointment = async (req, res) => {
    console.log('[Acuity] Creating appointment...');
    console.log('[Acuity] Request body:', req.body);
    console.log('[Acuity] Access token:', req.acuityUser?.access_token);

    try {
        // If appointmentTypeName is provided instead of appointmentTypeID
        if (req.body.appointmentTypeName && !req.body.appointmentTypeID) {
            console.log('[Acuity] Looking up appointment type by name:', req.body.appointmentTypeName);
            try {
                const response = await axios.get(`${ACUITY_API_BASE_URL}/appointment-types`, {
                    headers: {
                        Authorization: `Bearer ${req.acuityUser.access_token}`
                    }
                });
                console.log('[Acuity] Available appointment types:', response.data);

                const matchingType = response.data.find(type => 
                    type.name.toLowerCase() === req.body.appointmentTypeName.toLowerCase()
                );

                if (!matchingType) {
                    console.log('[Acuity] No matching appointment type found');
                    return res.status(400).json({
                        success: false,
                        error: `Appointment type "${req.body.appointmentTypeName}" not found`,
                        availableTypes: response.data.map(type => ({
                            id: type.id,
                            name: type.name,
                            duration: type.duration
                        }))
                    });
                }

                console.log('[Acuity] Found matching appointment type:', matchingType);
                req.body.appointmentTypeID = matchingType.id;
                delete req.body.appointmentTypeName;
            } catch (error) {
                console.error('[Acuity] Error fetching appointment types:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch appointment types',
                    details: error.message
                });
            }
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('[Acuity] Validation errors:', errors.array());
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        console.log('[Acuity] Creating appointment with data:', req.body);
        const response = await axios.post(`${ACUITY_API_BASE_URL}/appointments`, req.body, {
            headers: {
                Authorization: `Bearer ${req.acuityUser.access_token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('[Acuity] Appointment created successfully:', response.data);

        res.status(201).json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('[Acuity] Error in createAppointment:', error);
        const errorResponse = handleAcuityError(error);
        res.status(errorResponse.status).json({
            success: false,
            error: errorResponse.message,
            details: errorResponse.details
        });
    }
};

// Modify getAppointmentById
export const getAppointmentById = async (req, res) => {
    console.log('[Acuity] Getting appointment by ID:', req.params.id);
    console.log('[Acuity] Access token:', req.acuityUser?.access_token);

    try {
        const response = await axios.get(`${ACUITY_API_BASE_URL}/appointments/${req.params.id}`, {
            headers: {
                Authorization: `Bearer ${req.acuityUser.access_token}`
            }
        });
        console.log('[Acuity] Appointment response:', response.data);

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('[Acuity] Error in getAppointmentById:', error);
        const errorResponse = handleAcuityError(error);
        res.status(errorResponse.status).json({
            success: false,
            error: errorResponse.message,
            details: errorResponse.details
        });
    }
};

// Modify updateAppointment
export const updateAppointment = async (req, res) => {
    console.log('[Acuity] Updating appointment:', req.params.id);
    console.log('[Acuity] Request body:', req.body);
    console.log('[Acuity] Access token:', req.acuityUser?.access_token);

    try {
        const response = await axios.put(`${ACUITY_API_BASE_URL}/appointments/${req.params.id}`, req.body, {
            headers: {
                Authorization: `Bearer ${req.acuityUser.access_token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('[Acuity] Update response:', response.data);

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('[Acuity] Error in updateAppointment:', error);
        const errorResponse = handleAcuityError(error);
        res.status(errorResponse.status).json({
            success: false,
            error: errorResponse.message,
            details: errorResponse.details
        });
    }
};

// Modify cancelAppointment
export const cancelAppointment = async (req, res) => {
    console.log('[Acuity] Canceling appointment:', req.params.id);
    console.log('[Acuity] Access token:', req.acuityUser?.access_token);

    try {
        const response = await axios.delete(`${ACUITY_API_BASE_URL}/appointments/${req.params.id}`, {
            headers: {
                Authorization: `Bearer ${req.acuityUser.access_token}`
            }
        });
        console.log('[Acuity] Cancel response:', response.data);

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('[Acuity] Error in cancelAppointment:', error);
        const errorResponse = handleAcuityError(error);
        res.status(errorResponse.status).json({
            success: false,
            error: errorResponse.message,
            details: errorResponse.details
        });
    }
};

export const getAvailableTimes = async (req, res) => {
    try {
        const { calendarId, date } = req.query;
        const acuity = Acuity.oauth2({
            clientId: ACUITY_OAUTH_CLIENT_ID,
            clientSecret: ACUITY_OAUTH_CLIENT_SECRET,
            redirectUri: ACUITY_OAUTH_REDIRECT_URI
        });

        const times = await acuity.request('/availability/times', {
            accessToken: req.acuityUser.access_token,
            params: {
                calendarID: calendarId,
                date: date
            }
        });

        res.json({
            success: true,
            data: times
        });
    } catch (error) {
        const errorResponse = handleAcuityError(error);
        res.status(errorResponse.status).json({
            success: false,
            error: errorResponse.message
        });
    }
};

export const getCalendars = async (req, res) => {
    console.log('[Acuity] Getting calendars...');
    console.log('[Acuity] Access token:', req.acuityUser?.access_token);

    try {
        console.log('[Acuity] Making request to /calendars');
        const response = await axios.get(`${ACUITY_API_BASE_URL}/calendars`, {
            headers: {
                Authorization: `Bearer ${req.acuityUser.access_token}`
            }
        });
        console.log('[Acuity] Calendars response:', response.data);

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('[Acuity] Error in getCalendars:', error);
        const errorResponse = handleAcuityError(error);
        res.status(errorResponse.status).json({
            success: false,
            error: errorResponse.message,
            details: errorResponse.details
        });
    }
};
