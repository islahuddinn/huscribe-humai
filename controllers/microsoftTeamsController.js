import axios from 'axios';
import asyncHandler from 'express-async-handler';

// Base URL for Microsoft Graph API
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// Get all teams for the authenticated user
export const getTeams = asyncHandler(async (req, res) => {
    try {
        const accessToken = req.session.msalTokens?.accessToken;
        if (!accessToken) {
            return res.status(401).json({ error: 'No access token available' });
        }

        const response = await axios.get(`${GRAPH_API_BASE}/me/joinedTeams`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        res.json(response.data);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch teams',
            details: error.message
        });
    }
});

// Get channels for a specific team
export const getTeamChannels = asyncHandler(async (req, res) => {
    try {
        const { teamId } = req.params;
        const accessToken = req.session.msalTokens?.accessToken;
        
        if (!accessToken) {
            return res.status(401).json({ error: 'No access token available' });
        }

        const response = await axios.get(`${GRAPH_API_BASE}/teams/${teamId}/channels`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        res.json(response.data);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch team channels',
            details: error.message
        });
    }
});

// Create a new channel in a team
export const createChannel = asyncHandler(async (req, res) => {
    try {
        const { teamId } = req.params;
        const { displayName, description } = req.body;
        const accessToken = req.session.msalTokens?.accessToken;

        if (!accessToken) {
            return res.status(401).json({ error: 'No access token available' });
        }

        const response = await axios.post(
            `${GRAPH_API_BASE}/teams/${teamId}/channels`,
            {
                displayName,
                description
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(201).json(response.data);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to create channel',
            details: error.message
        });
    }
});

// Get messages from a channel
export const getChannelMessages = asyncHandler(async (req, res) => {
    try {
        const { teamId, channelId } = req.params;
        const accessToken = req.session.msalTokens?.accessToken;

        if (!accessToken) {
            return res.status(401).json({ error: 'No access token available' });
        }

        const response = await axios.get(
            `${GRAPH_API_BASE}/teams/${teamId}/channels/${channelId}/messages`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch channel messages',
            details: error.message
        });
    }
});

// Send a message to a channel
export const sendChannelMessage = asyncHandler(async (req, res) => {
    try {
        const { teamId, channelId } = req.params;
        const { content } = req.body;
        const accessToken = req.session.msalTokens?.accessToken;

        if (!accessToken) {
            return res.status(401).json({ error: 'No access token available' });
        }

        const response = await axios.post(
            `${GRAPH_API_BASE}/teams/${teamId}/channels/${channelId}/messages`,
            {
                body: {
                    content
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(201).json(response.data);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to send message',
            details: error.message
        });
    }
});

// Get team members
export const getTeamMembers = asyncHandler(async (req, res) => {
    try {
        const { teamId } = req.params;
        const accessToken = req.session.msalTokens?.accessToken;

        if (!accessToken) {
            return res.status(401).json({ error: 'No access token available' });
        }

        const response = await axios.get(
            `${GRAPH_API_BASE}/teams/${teamId}/members`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch team members',
            details: error.message
        });
    }
}); 