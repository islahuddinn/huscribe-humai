const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID, MICROSOFT_REDIRECT_URI } = process.env;

// Microsoft Graph API endpoints
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
const AUTH_URL = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`;
const TOKEN_URL = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

// Initialize Outlook integration
const initOutlookAuth = async (req, res) => {
    try {
        const authUrl = new URL(AUTH_URL);
        authUrl.searchParams.append('client_id', MICROSOFT_CLIENT_ID);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('redirect_uri', MICROSOFT_REDIRECT_URI);
        authUrl.searchParams.append('scope', 'offline_access Mail.Read Mail.ReadWrite Mail.Send Calendars.Read Calendars.ReadWrite Contacts.Read Contacts.ReadWrite');
        authUrl.searchParams.append('response_mode', 'query');
        authUrl.searchParams.append('state', req.query.state || 'default');

        res.json({ authUrl: authUrl.toString() });
    } catch (error) {
        console.error('Outlook auth initialization error:', error);
        res.status(500).json({ error: 'Failed to initialize Outlook authentication' });
    }
};

// Handle OAuth callback
const handleOutlookCallback = async (req, res) => {
    try {
        const { code, state } = req.query;
        
        // Exchange code for tokens
        const tokenResponse = await axios.post(TOKEN_URL, {
            client_id: MICROSOFT_CLIENT_ID,
            client_secret: MICROSOFT_CLIENT_SECRET,
            code,
            redirect_uri: MICROSOFT_REDIRECT_URI,
            grant_type: 'authorization_code',
            scope: 'offline_access Mail.Read Mail.ReadWrite Mail.Send Calendars.Read Calendars.ReadWrite Contacts.Read Contacts.ReadWrite'
        });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        // Store tokens in user's database
        const userId = req.user.id; // Assuming user is authenticated
        await User.findByIdAndUpdate(userId, {
            outlookAccessToken: access_token,
            outlookRefreshToken: refresh_token,
            outlookTokenExpiresAt: new Date(Date.now() + expires_in * 1000)
        });

        res.redirect(`${process.env.FRONTEND_URL}/dashboard?outlook=success`);
    } catch (error) {
        console.error('Outlook callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/dashboard?outlook=error`);
    }
};

// Get user's emails
const getEmails = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user.outlookAccessToken) {
            return res.status(401).json({ error: 'Outlook not connected' });
        }

        const response = await axios.get(`${GRAPH_API_BASE}/me/messages`, {
            headers: {
                Authorization: `Bearer ${user.outlookAccessToken}`
            },
            params: {
                $select: 'subject,from,receivedDateTime,bodyPreview',
                $top: 50,
                $orderby: 'receivedDateTime desc'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching emails:', error);
        res.status(500).json({ error: 'Failed to fetch emails' });
    }
};

// Send email
const sendEmail = async (req, res) => {
    try {
        const { to, subject, body } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!user.outlookAccessToken) {
            return res.status(401).json({ error: 'Outlook not connected' });
        }

        const response = await axios.post(
            `${GRAPH_API_BASE}/me/sendMail`,
            {
                message: {
                    subject,
                    body: {
                        contentType: 'HTML',
                        content: body
                    },
                    toRecipients: [
                        {
                            emailAddress: {
                                address: to
                            }
                        }
                    ]
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${user.outlookAccessToken}`
                }
            }
        );

        res.json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
};

// Get calendar events
const getCalendarEvents = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user.outlookAccessToken) {
            return res.status(401).json({ error: 'Outlook not connected' });
        }

        const response = await axios.get(`${GRAPH_API_BASE}/me/calendar/events`, {
            headers: {
                Authorization: `Bearer ${user.outlookAccessToken}`
            },
            params: {
                $select: 'subject,start,end,location,body',
                $top: 50,
                $orderby: 'start/dateTime desc'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
};

// Create calendar event
const createCalendarEvent = async (req, res) => {
    try {
        const { subject, start, end, location, body } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!user.outlookAccessToken) {
            return res.status(401).json({ error: 'Outlook not connected' });
        }

        const response = await axios.post(
            `${GRAPH_API_BASE}/me/calendar/events`,
            {
                subject,
                start: {
                    dateTime: start,
                    timeZone: 'UTC'
                },
                end: {
                    dateTime: end,
                    timeZone: 'UTC'
                },
                location: {
                    displayName: location
                },
                body: {
                    contentType: 'HTML',
                    content: body
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${user.outlookAccessToken}`
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Error creating calendar event:', error);
        res.status(500).json({ error: 'Failed to create calendar event' });
    }
};

// Get contacts
const getContacts = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user.outlookAccessToken) {
            return res.status(401).json({ error: 'Outlook not connected' });
        }

        const response = await axios.get(`${GRAPH_API_BASE}/me/contacts`, {
            headers: {
                Authorization: `Bearer ${user.outlookAccessToken}`
            },
            params: {
                $select: 'displayName,emailAddresses,businessPhones,mobilePhone',
                $top: 50
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
};

// Refresh token
const refreshOutlookToken = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user.outlookRefreshToken) {
            return res.status(401).json({ error: 'No refresh token available' });
        }

        const response = await axios.post(TOKEN_URL, {
            client_id: MICROSOFT_CLIENT_ID,
            client_secret: MICROSOFT_CLIENT_SECRET,
            refresh_token: user.outlookRefreshToken,
            grant_type: 'refresh_token',
            scope: 'offline_access Mail.Read Mail.ReadWrite Mail.Send Calendars.Read Calendars.ReadWrite Contacts.Read Contacts.ReadWrite'
        });

        const { access_token, refresh_token, expires_in } = response.data;

        await User.findByIdAndUpdate(user.id, {
            outlookAccessToken: access_token,
            outlookRefreshToken: refresh_token,
            outlookTokenExpiresAt: new Date(Date.now() + expires_in * 1000)
        });

        res.json({ success: true, message: 'Token refreshed successfully' });
    } catch (error) {
        console.error('Error refreshing token:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
};

module.exports = {
    initOutlookAuth,
    handleOutlookCallback,
    getEmails,
    sendEmail,
    getCalendarEvents,
    createCalendarEvent,
    getContacts,
    refreshOutlookToken
};
