import axios from 'axios';
import asyncHandler from 'express-async-handler';
import { v4 as uuidv4 } from 'uuid';

// Constants
const LINKEDIN_API_URL = 'https://api.linkedin.com/v2';
const SALES_NAV_API_URL = 'https://api.linkedin.com/v2/salesApiNavigator';

// Helper function to get access token
const getAccessToken = async (code) => {
    try {
        const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
            params: {
                grant_type: 'authorization_code',
                code,
                client_id: process.env.LINKEDIN_CLIENT_ID,
                client_secret: process.env.LINKEDIN_CLIENT_SECRET,
                redirect_uri: process.env.LINKEDIN_REDIRECT_URI
            }
        });
        return response.data.access_token;
    } catch (error) {
        throw new Error('Failed to get access token: ' + error.message);
    }
};

// Initialize LinkedIn OAuth
export const initiateLinkedInAuth = asyncHandler(async (req, res) => {
    const state = uuidv4();
    const scope = 'r_liteprofile r_emailaddress rw_organization_admin sales_navigator';
    
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
        `response_type=code&` +
        `client_id=${process.env.LINKEDIN_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(process.env.LINKEDIN_REDIRECT_URI)}&` +
        `state=${state}&` +
        `scope=${encodeURIComponent(scope)}`;

    res.json({ authUrl });
});

// Handle LinkedIn OAuth callback
export const handleLinkedInCallback = asyncHandler(async (req, res) => {
    const { code, state } = req.query;
    
    if (!code) {
        res.status(400);
        throw new Error('Authorization code not received');
    }

    try {
        const accessToken = await getAccessToken(code);
        // Store the access token securely (e.g., in database)
        res.json({ success: true, message: 'Successfully authenticated with LinkedIn' });
    } catch (error) {
        res.status(401);
        throw new Error('Failed to authenticate with LinkedIn: ' + error.message);
    }
});

// Search for leads using Sales Navigator
export const searchLeads = asyncHandler(async (req, res) => {
    const { accessToken } = req.user; // Assuming token is stored with user
    const { keywords, filters } = req.body;

    try {
        const response = await axios.post(`${SALES_NAV_API_URL}/search`, {
            keywords,
            filters
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });

        res.json(response.data);
    } catch (error) {
        res.status(500);
        throw new Error('Failed to search leads: ' + error.message);
    }
});

// Get lead details
export const getLeadDetails = asyncHandler(async (req, res) => {
    const { accessToken } = req.user;
    const { leadId } = req.params;

    try {
        const response = await axios.get(`${SALES_NAV_API_URL}/leads/${leadId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });

        res.json(response.data);
    } catch (error) {
        res.status(500);
        throw new Error('Failed to get lead details: ' + error.message);
    }
});

// Save lead to a list
export const saveLeadToList = asyncHandler(async (req, res) => {
    const { accessToken } = req.user;
    const { leadId, listId } = req.body;

    try {
        const response = await axios.post(`${SALES_NAV_API_URL}/lists/${listId}/leads`, {
            leadId
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });

        res.json(response.data);
    } catch (error) {
        res.status(500);
        throw new Error('Failed to save lead to list: ' + error.message);
    }
});

// Get saved lists
export const getSavedLists = asyncHandler(async (req, res) => {
    const { accessToken } = req.user;

    try {
        const response = await axios.get(`${SALES_NAV_API_URL}/lists`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });

        res.json(response.data);
    } catch (error) {
        res.status(500);
        throw new Error('Failed to get saved lists: ' + error.message);
    }
});
