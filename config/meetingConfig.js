import dotenv from 'dotenv';
dotenv.config();

// Ensure all environment variables are properly trimmed
const getEnvVar = (name) => process.env[name]?.replace(/\s/g, '') || '';

export const zoomConfig = {
    clientId: getEnvVar('ZOOM_CLIENT_ID'),
    clientSecret: getEnvVar('ZOOM_CLIENT_SECRET'),
    accountId: getEnvVar('ZOOM_ACCOUNT_ID'),
    redirectUri: getEnvVar('ZOOM_REDIRECT_URI'),
    apiBaseUrl: 'https://api.zoom.us/v2'
};

export const googleMeetConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    apiBaseUrl: 'https://www.googleapis.com'
}; 