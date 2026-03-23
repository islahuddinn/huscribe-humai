import { ConfidentialClientApplication } from '@azure/msal-node';
import asyncHandler from 'express-async-handler';

// Configure MSAL
const msalConfig = {
    auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
        redirectUri: process.env.MICROSOFT_REDIRECT_URI // e.g., "http://localhost:5001/api/auth/microsoft/callback"
    }
};

// Initialize MSAL application
const msalClient = new ConfidentialClientApplication(msalConfig);

// Generate login URL
export const getLoginUrl = asyncHandler(async (req, res) => {
    try {
        const authUrl = await msalClient.getAuthCodeUrl({
            scopes: [
                'Bookings.ReadWrite.All',
                'Bookings.Manage.All',
                'offline_access'
            ],
            redirectUri: msalConfig.auth.redirectUri,
            state: req.session.id // To prevent CSRF attacks
        });

        res.json({
            loginUrl: authUrl
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to generate login URL',
            details: error.message
        });
    }
});

// Handle callback from Microsoft
export const handleCallback = asyncHandler(async (req, res) => {
    try {
        const { code } = req.query;

        const result = await msalClient.acquireTokenByCode({
            code,
            scopes: [
                'Bookings.ReadWrite.All',
                'Bookings.Manage.All',
                'offline_access'
            ],
            redirectUri: msalConfig.auth.redirectUri
        });

        // Store tokens in session
        req.session.msalTokens = {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresOn: result.expiresOn
        };

        // Redirect to your frontend
        res.redirect('/booking-dashboard');
    } catch (error) {
        res.status(500).json({
            error: 'Authentication failed',
            details: error.message
        });
    }
});

// Get new access token using refresh token
export const refreshToken = asyncHandler(async (req, res) => {
    try {
        if (!req.session.msalTokens?.refreshToken) {
            throw new Error('No refresh token available');
        }

        const result = await msalClient.acquireTokenByRefreshToken({
            refreshToken: req.session.msalTokens.refreshToken,
            scopes: [
                'Bookings.ReadWrite.All',
                'Bookings.Manage.All',
                'offline_access'
            ]
        });

        req.session.msalTokens = {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresOn: result.expiresOn
        };

        res.json({ message: 'Token refreshed successfully' });
    } catch (error) {
        res.status(500).json({
            error: 'Token refresh failed',
            details: error.message
        });
    }
}); 