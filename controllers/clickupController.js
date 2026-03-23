import axios from 'axios';
import dotenv from 'dotenv';
import { clickupApi } from '../utils/clickupApi.js';
import logger from '../utils/logger.js';

dotenv.config();

const CLICKUP_CLIENT_ID = process.env.CLICKUP_CLIENT_ID;
const CLICKUP_CLIENT_SECRET = process.env.CLICKUP_CLIENT_SECRET;
const REDIRECT_URI = process.env.CLICKUP_LIVE_REDIRECT_URI || process.env.CLICKUP_REDIRECT_URI;

// Generate OAuth URL and redirect
export const getAuthUrl = async (req, res) => {
    const requestId = Date.now().toString();
    console.log(`[${requestId}] Starting OAuth flow`);
    
    try {
        // Direct OAuth URL without any additional parameters
        const authUrl = `https://app.clickup.com/api?client_id=${CLICKUP_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
        
        console.log(`[${requestId}] Generated Auth URL:`, authUrl);
        
        // Auto redirect to the authorization URL
        res.redirect(authUrl);
    } catch (error) {
        console.error(`[${requestId}] Error:`, error);
        res.status(500).json({ 
            error: 'Failed to generate authorization URL',
            details: error.message,
            requestId
        });
    }
};

// Handle OAuth callback
export const handleCallback = async (req, res) => {
    const requestId = Date.now().toString();
    console.log(`[${requestId}] Callback received:`, req.query);
    
    try {
        const { code, error } = req.query;

        if (error) {
            console.error(`[${requestId}] ClickUp error:`, error);
            return res.status(400).json({ 
                error: `ClickUp authorization error: ${error}`,
                requestId
            });
        }

        if (!code) {
            console.error(`[${requestId}] No code received`);
            return res.status(400).json({ 
                error: 'Authorization code is required',
                requestId
            });
        }

        // Exchange code for token
        const tokenResponse = await axios({
            method: 'post',
            url: 'https://api.clickup.com/api/v2/oauth/token',
            data: {
                client_id: CLICKUP_CLIENT_ID,
                client_secret: CLICKUP_CLIENT_SECRET,
                code: code
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log(`[${requestId}] Token exchange successful`);
        console.log(`[${requestId}] Token response:`, tokenResponse.data);
        
        const { 
            access_token, 
            user,
            team,
            token_type
        } = tokenResponse.data;

        // Return success response with tokens and user info
        // Note: ClickUp OAuth access tokens do not expire and no refresh token is provided
        res.json({
            message: 'Successfully authenticated with ClickUp',
            data: {
                access_token,
                token_type: token_type || 'Bearer',
                expires: false, // ClickUp tokens don't expire
                user: user?.user ? {
                    id: user.user.id,
                    username: user.user.username,
                    email: user.user.email,
                    color: user.user.color,
                    profile_picture: user.user.profile_picture
                } : null,
                team: team ? {
                    id: team.id,
                    name: team.name,
                    color: team.color,
                    avatar: team.avatar
                } : null
            },
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(`[${requestId}] Error:`, {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            stack: error.stack
        });
        
        // More detailed error response
        res.status(500).json({ 
            error: 'Failed to complete OAuth process',
            details: error.response?.data || error.message,
            requestId,
            timestamp: new Date().toISOString()
        });
    }
};

// Refresh access token
export const refreshAccessToken = async (req, res) => {
    const requestId = Date.now().toString();
    console.log(`[${requestId}] Refresh token request`);
    
    // ClickUp OAuth access tokens do not expire and no refresh token is provided
    // This endpoint is not needed for ClickUp integration
    res.status(400).json({
        error: 'Token refresh not supported',
        message: 'ClickUp OAuth access tokens do not expire and do not require refreshing. Your access token remains valid indefinitely.',
        documentation: 'https://developer.clickup.com/docs/faq#do-oauth-access-tokens-expire',
        requestId,
        timestamp: new Date().toISOString()
    });
};

// Revoke access
export const revokeAccess = async (req, res) => {
    const requestId = Date.now().toString();
    console.log(`[${requestId}] Revoke access request`);
    
    try {
        const { access_token } = req.body;

        if (!access_token) {
            return res.status(400).json({ 
                error: 'Access token is required',
                requestId
            });
        }

        await axios({
            method: 'post',
            url: 'https://api.clickup.com/api/v2/oauth/revoke',
            data: {
                client_id: CLICKUP_CLIENT_ID,
                client_secret: CLICKUP_CLIENT_SECRET,
                token: access_token
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log(`[${requestId}] Access revoked successfully`);

        res.json({ 
            message: 'Access revoked successfully',
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(`[${requestId}] Error:`, {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            stack: error.stack
        });
        
        res.status(500).json({ 
            error: 'Failed to revoke access',
            details: error.response?.data || error.message,
            requestId,
            timestamp: new Date().toISOString()
        });
    }
};

// Get user information
export const getUser = async (req, res) => {
    const requestId = Date.now().toString();
    try {
        const userData = await clickupApi.get('/user', req.clickupToken);
        res.json({
            message: 'User information retrieved successfully',
            data: userData,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Get teams with pagination
export const getTeams = async (req, res) => {
    const requestId = Date.now().toString();
    const { teamId } = req.params;
    const { page = 0, limit = 100 } = req.query;
    
    try {
        const endpoint = teamId ? `/team/${teamId}` : '/team';
        const teamsData = await clickupApi.get(endpoint, req.clickupToken, { page, limit });
        res.json({
            message: 'Teams retrieved successfully',
            data: teamsData,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: teamsData.teams?.length || 0
            },
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Get team by ID
export const getTeamById = async (req, res) => {
    const requestId = Date.now().toString();
    const { teamId } = req.params;

    try {
        const teamData = await clickupApi.get(`/team/${teamId}`, req.clickupToken);
        res.json({
            message: 'Team retrieved successfully',
            data: teamData,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Create team
export const createTeam = async (req, res) => {
    const requestId = Date.now().toString();
    const teamData = req.body;

    try {
        // Log the incoming request
        logger.info({
            requestId,
            action: 'createTeam',
            requestData: teamData,
            headers: req.headers,
            timestamp: new Date().toISOString()
        });

        // Validate token
        if (!req.clickupToken) {
            logger.warn({
                requestId,
                action: 'createTeam',
                error: 'Missing ClickUp token',
                timestamp: new Date().toISOString()
            });

            return res.status(401).json({
                error: 'ClickUp authentication token is required',
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Log token details (without exposing the full token)
        logger.info({
            requestId,
            action: 'createTeam',
            tokenInfo: {
                present: true,
                length: req.clickupToken.length,
                type: req.clickupToken.startsWith('pk_') ? 'Private Key' : 
                      req.clickupToken.startsWith('Bearer ') ? 'Bearer Token' : 'Unknown'
            },
            timestamp: new Date().toISOString()
        });

        // Validate required fields
        const requiredFields = ['name'];
        const missingFields = requiredFields.filter(field => !teamData[field]);
        
        if (missingFields.length > 0) {
            logger.warn({
                requestId,
                action: 'createTeam',
                error: 'Missing required fields',
                missingFields,
                timestamp: new Date().toISOString()
            });

            return res.status(400).json({
                error: `Missing required fields: ${missingFields.join(', ')}`,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Validate team data structure
        if (typeof teamData.name !== 'string' || teamData.name.trim().length === 0) {
            logger.warn({
                requestId,
                action: 'createTeam',
                error: 'Invalid team name',
                teamData,
                timestamp: new Date().toISOString()
            });

            return res.status(400).json({
                error: 'Team name must be a non-empty string',
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Prepare the request payload according to ClickUp API documentation
        const payload = {
            name: teamData.name.trim()
        };

        // Add optional fields if provided
        if (teamData.color) {
            // Validate color format
            if (!/^#[0-9A-Fa-f]{6}$/.test(teamData.color)) {
                logger.warn({
                    requestId,
                    action: 'createTeam',
                    error: 'Invalid color format',
                    color: teamData.color,
                    timestamp: new Date().toISOString()
                });

                return res.status(400).json({
                    error: 'Color must be a valid hex color code (e.g., #FF5733)',
                    requestId,
                    timestamp: new Date().toISOString()
                });
            }
            payload.color = teamData.color;
        }

        if (teamData.avatar) {
            // Validate avatar URL
            try {
                new URL(teamData.avatar);
                payload.avatar = teamData.avatar;
            } catch (e) {
                logger.warn({
                    requestId,
                    action: 'createTeam',
                    error: 'Invalid avatar URL',
                    avatar: teamData.avatar,
                    timestamp: new Date().toISOString()
                });

                return res.status(400).json({
                    error: 'Avatar must be a valid URL',
                    requestId,
                    timestamp: new Date().toISOString()
                });
            }
        }

        if (teamData.members && Array.isArray(teamData.members)) {
            // Validate members array
            const validMembers = teamData.members.every(member => 
                member.user_id && 
                (member.role === 1 || member.role === 2)
            );

            if (!validMembers) {
                logger.warn({
                    requestId,
                    action: 'createTeam',
                    error: 'Invalid members data',
                    members: teamData.members,
                    timestamp: new Date().toISOString()
                });

                return res.status(400).json({
                    error: 'Each member must have a user_id and a valid role (1 for admin, 2 for member)',
                    requestId,
                    timestamp: new Date().toISOString()
                });
            }

            payload.members = teamData.members.map(member => ({
                user_id: member.user_id,
                role: member.role
            }));
        }

        // Log API call attempt
        logger.info({
            requestId,
            action: 'createTeam',
            message: 'Attempting to create team via ClickUp API',
            payload,
            endpoint: 'team',
            timestamp: new Date().toISOString()
        });

        // Make the API call to the correct endpoint
        const newTeam = await clickupApi.post('team', req.clickupToken, payload, requestId);

        // Log successful response
        logger.info({
            requestId,
            action: 'createTeam',
            message: 'Team created successfully',
            teamId: newTeam.id,
            response: newTeam,
            timestamp: new Date().toISOString()
        });

        res.status(201).json({
            message: 'Team created successfully',
            data: newTeam,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Log the error
        logger.error({
            requestId,
            action: 'createTeam',
            error: {
                message: error.message,
                stack: error.stack,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    baseURL: error.config?.baseURL,
                    data: error.config?.data
                }
            },
            timestamp: new Date().toISOString()
        });

        // Handle specific error cases
        if (error.name === 'ClickUpApiError') {
            return res.status(error.status).json({
                error: error.message,
                details: error.data,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Handle unexpected errors
        res.status(500).json({
            error: 'Failed to create team',
            details: error.message,
            requestId,
            timestamp: new Date().toISOString()
        });
    }
};

// Update team
export const updateTeam = async (req, res) => {
    const requestId = Date.now().toString();
    const { teamId } = req.params;
    const teamData = req.body;

    if (Object.keys(teamData).length === 0) {
        return res.status(400).json({
            error: 'No update data provided',
            requestId
        });
    }

    try {
        const updatedTeam = await clickupApi.put(`/team/${teamId}`, req.clickupToken, teamData);
        res.json({
            message: 'Team updated successfully',
            data: updatedTeam,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Delete team
export const deleteTeam = async (req, res) => {
    const requestId = Date.now().toString();
    const { teamId } = req.params;

    try {
        await clickupApi.delete(`/team/${teamId}`, req.clickupToken);
        res.json({
            message: 'Team deleted successfully',
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Get spaces with pagination
export const getSpaces = async (req, res) => {
    const requestId = Date.now().toString();
    const { teamId, spaceId } = req.params;
    const { page = 0, limit = 100, archived = false } = req.query;

    try {
        // Log the incoming request
        logger.info({
            requestId,
            action: 'getSpaces',
            params: { teamId, spaceId },
            query: req.query,
            timestamp: new Date().toISOString()
        });

        let endpoint;
        let params = {
            page: parseInt(page),
            limit: parseInt(limit),
            archived: archived === 'true'
        };

        // Determine the correct endpoint based on the request
        if (teamId) {
            endpoint = `/team/${teamId}/space`;
        } else if (spaceId) {
            endpoint = `/space/${spaceId}`;
        } else {
            // If no teamId or spaceId is provided, we need to get all teams first
            logger.info({
                requestId,
                action: 'getSpaces',
                message: 'No teamId provided, fetching all teams first',
                timestamp: new Date().toISOString()
            });

            const teamsResponse = await clickupApi.get('/team', req.clickupToken);
            
            if (!teamsResponse.teams || teamsResponse.teams.length === 0) {
                logger.warn({
                    requestId,
                    action: 'getSpaces',
                    error: 'No teams found',
                    timestamp: new Date().toISOString()
                });
                return res.status(404).json({
                    error: 'No teams found',
                    requestId,
                    timestamp: new Date().toISOString()
                });
            }

            // Use the first team's ID to get spaces
            const teamId = teamsResponse.teams[0].id;
            endpoint = `/team/${teamId}/space`;
        }

        // Log API call attempt
        logger.info({
            requestId,
            action: 'getSpaces',
            message: 'Attempting to fetch spaces',
            endpoint,
            params,
            timestamp: new Date().toISOString()
        });

        const spacesData = await clickupApi.get(endpoint, req.clickupToken, params);

        // Log successful response
        logger.info({
            requestId,
            action: 'getSpaces',
            message: 'Spaces retrieved successfully',
            spacesCount: spacesData.spaces?.length || 0,
            timestamp: new Date().toISOString()
        });

        res.json({
            message: 'Spaces retrieved successfully',
            data: spacesData,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: spacesData.spaces?.length || 0
            },
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Log the error
        logger.error({
            requestId,
            action: 'getSpaces',
            error: {
                message: error.message,
                stack: error.stack,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    baseURL: error.config?.baseURL,
                    params: error.config?.params
                }
            },
            timestamp: new Date().toISOString()
        });

        // Handle specific error cases
        if (error.name === 'ClickUpApiError') {
            return res.status(error.status).json({
                error: error.message,
                details: error.data,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Handle unexpected errors
        res.status(500).json({
            error: 'Failed to retrieve spaces',
            details: error.message,
            requestId,
            timestamp: new Date().toISOString()
        });
    }
};

// Get space by ID
export const getSpaceById = async (req, res) => {
    const requestId = Date.now().toString();
    const { spaceId } = req.params;

    try {
        const spaceData = await clickupApi.get(`/space/${spaceId}`, req.clickupToken);
        res.json({
            message: 'Space retrieved successfully',
            data: spaceData,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Create space
export const createSpace = async (req, res) => {
    const requestId = Date.now().toString();
    const { teamId } = req.params;
    const spaceData = req.body;

    try {
        // Log the incoming request
        logger.info({
            requestId,
            action: 'createSpace',
            requestData: spaceData,
            teamId,
            timestamp: new Date().toISOString()
        });

        // Validate required fields
        const requiredFields = ['name'];
        const missingFields = requiredFields.filter(field => !spaceData[field]);
        
        if (missingFields.length > 0) {
            logger.warn({
                requestId,
                action: 'createSpace',
                error: 'Missing required fields',
                missingFields,
                timestamp: new Date().toISOString()
            });

            return res.status(400).json({
                error: `Missing required fields: ${missingFields.join(', ')}`,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Validate space data structure
        if (typeof spaceData.name !== 'string' || spaceData.name.trim().length === 0) {
            return res.status(400).json({
                error: 'Space name must be a non-empty string',
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Prepare the request payload
        const payload = {
            name: spaceData.name.trim(),
            ...(spaceData.multiple_assignees && { multiple_assignees: spaceData.multiple_assignees }),
            ...(spaceData.features && { features: spaceData.features }),
            ...(spaceData.folderless && { folderless: spaceData.folderless }),
            ...(spaceData.private && { private: spaceData.private }),
            ...(spaceData.statuses && { statuses: spaceData.statuses }),
            ...(spaceData.custom_fields && { custom_fields: spaceData.custom_fields })
        };

        // Validate optional fields
        if (spaceData.features && typeof spaceData.features !== 'object') {
            return res.status(400).json({
                error: 'Features must be an object',
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        if (spaceData.statuses && !Array.isArray(spaceData.statuses)) {
            return res.status(400).json({
                error: 'Statuses must be an array',
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Make the API call
        const endpoint = teamId ? `/team/${teamId}/space` : '/space';
        const newSpace = await clickupApi.post(endpoint, req.clickupToken, payload, requestId);

        // Log successful response
        logger.info({
            requestId,
            action: 'createSpace',
            message: 'Space created successfully',
            spaceId: newSpace.id,
            response: newSpace,
            timestamp: new Date().toISOString()
        });

        res.status(201).json({
            message: 'Space created successfully',
            data: newSpace,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Log the error
        logger.error({
            requestId,
            action: 'createSpace',
            error: {
                message: error.message,
                stack: error.stack,
                response: error.response?.data,
                status: error.response?.status
            },
            timestamp: new Date().toISOString()
        });

        // Handle specific error cases
        if (error.name === 'ClickUpApiError') {
            return res.status(error.status).json({
                error: error.message,
                details: error.data,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Handle unexpected errors
        res.status(500).json({
            error: 'Failed to create space',
            details: error.message,
            requestId,
            timestamp: new Date().toISOString()
        });
    }
};

// Update space
export const updateSpace = async (req, res) => {
    const requestId = Date.now().toString();
    const { spaceId } = req.params;
    const spaceData = req.body;

    if (Object.keys(spaceData).length === 0) {
        return res.status(400).json({
            error: 'No update data provided',
            requestId
        });
    }

    try {
        const updatedSpace = await clickupApi.put(`/space/${spaceId}`, req.clickupToken, spaceData);
        res.json({
            message: 'Space updated successfully',
            data: updatedSpace,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Delete space
export const deleteSpace = async (req, res) => {
    const requestId = Date.now().toString();
    const { spaceId } = req.params;

    try {
        await clickupApi.delete(`/space/${spaceId}`, req.clickupToken);
        res.json({
            message: 'Space deleted successfully',
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Get folders with pagination
export const getFolders = async (req, res) => {
    const requestId = Date.now().toString();
    const { spaceId, folderId } = req.params;
    const { page = 0, limit = 100, archived = false } = req.query;

    try {
        let endpoint;
        if (spaceId) {
            endpoint = `/space/${spaceId}/folder`;
        } else if (folderId) {
            endpoint = `/folder/${folderId}`;
        } else {
            endpoint = '/folder';
        }

        const foldersData = await clickupApi.get(endpoint, req.clickupToken, {
            page,
            limit,
            archived
        });
        res.json({
            message: 'Folders retrieved successfully',
            data: foldersData,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: foldersData.folders?.length || 0
            },
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Get folder by ID
export const getFolderById = async (req, res) => {
    const requestId = Date.now().toString();
    const { folderId } = req.params;

    try {
        const folderData = await clickupApi.get(`/folder/${folderId}`, req.clickupToken);
        res.json({
            message: 'Folder retrieved successfully',
            data: folderData,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Create folder
export const createFolder = async (req, res) => {
    const requestId = Date.now().toString();
    const { spaceId } = req.params;
    const folderData = req.body;

    try {
        // Log the incoming request
        logger.info({
            requestId,
            action: 'createFolder',
            requestData: folderData,
            spaceId,
            timestamp: new Date().toISOString()
        });

        // Validate required fields
        const requiredFields = ['name'];
        const missingFields = requiredFields.filter(field => !folderData[field]);
        
        if (missingFields.length > 0) {
            logger.warn({
                requestId,
                action: 'createFolder',
                error: 'Missing required fields',
                missingFields,
                timestamp: new Date().toISOString()
            });

            return res.status(400).json({
                error: `Missing required fields: ${missingFields.join(', ')}`,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Validate folder data structure
        if (typeof folderData.name !== 'string' || folderData.name.trim().length === 0) {
            return res.status(400).json({
                error: 'Folder name must be a non-empty string',
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Prepare the request payload
        const payload = {
            name: folderData.name.trim()
        };

        // Add optional fields if provided
        if (folderData.content) {
            payload.content = folderData.content;
        }

        if (folderData.multiple_assignees !== undefined) {
            payload.multiple_assignees = folderData.multiple_assignees;
        }

        if (folderData.features) {
            payload.features = folderData.features;
        }

        if (folderData.private !== undefined) {
            payload.private = folderData.private;
        }

        if (folderData.statuses && Array.isArray(folderData.statuses)) {
            payload.statuses = folderData.statuses;
        }

        if (folderData.custom_fields && Array.isArray(folderData.custom_fields)) {
            payload.custom_fields = folderData.custom_fields;
        }

        // Make the API call
        const endpoint = spaceId ? `/space/${spaceId}/folder` : '/folder';
        
        // Log API call attempt
        logger.info({
            requestId,
            action: 'createFolder',
            message: 'Attempting to create folder via ClickUp API',
            payload,
            endpoint,
            timestamp: new Date().toISOString()
        });

        const newFolder = await clickupApi.post(endpoint, req.clickupToken, payload, requestId);

        // Log successful response
        logger.info({
            requestId,
            action: 'createFolder',
            message: 'Folder created successfully',
            folderId: newFolder.id,
            response: newFolder,
            timestamp: new Date().toISOString()
        });

        res.status(201).json({
            message: 'Folder created successfully',
            data: newFolder,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Log the error
        logger.error({
            requestId,
            action: 'createFolder',
            error: {
                message: error.message,
                stack: error.stack,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    baseURL: error.config?.baseURL,
                    data: error.config?.data
                }
            },
            timestamp: new Date().toISOString()
        });

        // Handle specific error cases
        if (error.name === 'ClickUpApiError') {
            return res.status(error.status).json({
                error: error.message,
                details: error.data,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Handle unexpected errors
        res.status(500).json({
            error: 'Failed to create folder',
            details: error.message,
            requestId,
            timestamp: new Date().toISOString()
        });
    }
};

// Update folder
export const updateFolder = async (req, res) => {
    const requestId = Date.now().toString();
    const { folderId } = req.params;
    const folderData = req.body;

    if (Object.keys(folderData).length === 0) {
        return res.status(400).json({
            error: 'No update data provided',
            requestId
        });
    }

    try {
        const updatedFolder = await clickupApi.put(`/folder/${folderId}`, req.clickupToken, folderData);
        res.json({
            message: 'Folder updated successfully',
            data: updatedFolder,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Delete folder
export const deleteFolder = async (req, res) => {
    const requestId = Date.now().toString();
    const { folderId } = req.params;

    try {
        await clickupApi.delete(`/folder/${folderId}`, req.clickupToken);
        res.json({
            message: 'Folder deleted successfully',
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Get lists with pagination
export const getLists = async (req, res) => {
    const requestId = Date.now().toString();
    const { folderId, listId } = req.params;
    const { page = 0, limit = 100, archived = false } = req.query;

    try {
        // Log the incoming request
        logger.info({
            requestId,
            action: 'getLists',
            params: { folderId, listId },
            query: req.query,
            timestamp: new Date().toISOString()
        });

        let endpoint;
        let params = {
            page: parseInt(page),
            limit: parseInt(limit),
            archived: archived === 'true'
        };

        // Determine the correct endpoint based on the request
        if (listId) {
            endpoint = `/list/${listId}`;
        } else if (folderId) {
            endpoint = `/folder/${folderId}/list`;
        } else {
            // If no folderId or listId is provided, we need to get all teams and spaces first
            logger.info({
                requestId,
                action: 'getLists',
                message: 'No folderId provided, fetching all teams and spaces first',
                timestamp: new Date().toISOString()
            });

            // Get all teams
            const teamsResponse = await clickupApi.get('/team', req.clickupToken);
            
            if (!teamsResponse.teams || teamsResponse.teams.length === 0) {
                logger.warn({
                    requestId,
                    action: 'getLists',
                    error: 'No teams found',
                    timestamp: new Date().toISOString()
                });
                return res.status(404).json({
                    error: 'No teams found',
                    requestId,
                    timestamp: new Date().toISOString()
                });
            }

            // Get all spaces for the first team
            const teamId = teamsResponse.teams[0].id;
            const spacesResponse = await clickupApi.get(`/team/${teamId}/space`, req.clickupToken);
            
            if (!spacesResponse.spaces || spacesResponse.spaces.length === 0) {
                logger.warn({
                    requestId,
                    action: 'getLists',
                    error: 'No spaces found',
                    timestamp: new Date().toISOString()
                });
                return res.status(404).json({
                    error: 'No spaces found',
                    requestId,
                    timestamp: new Date().toISOString()
                });
            }

            // Get all lists from all spaces
            const allLists = [];
            for (const space of spacesResponse.spaces) {
                try {
                    // Get folderless lists
                    const spaceListsResponse = await clickupApi.get(`/space/${space.id}/list`, req.clickupToken);
                    if (spaceListsResponse.lists) {
                        allLists.push(...spaceListsResponse.lists);
                    }

                    // Get lists in folders
                    const foldersResponse = await clickupApi.get(`/space/${space.id}/folder`, req.clickupToken);
                    if (foldersResponse.folders) {
                        for (const folder of foldersResponse.folders) {
                            const folderListsResponse = await clickupApi.get(`/folder/${folder.id}/list`, req.clickupToken);
                            if (folderListsResponse.lists) {
                                allLists.push(...folderListsResponse.lists);
                            }
                        }
                    }
                } catch (error) {
                    logger.warn({
                        requestId,
                        action: 'getLists',
                        message: `Error fetching lists for space ${space.id}`,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                    continue;
                }
            }

            // Return the combined lists
            return res.json({
                message: 'Lists retrieved successfully',
                data: { lists: allLists },
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: allLists.length
                },
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Log API call attempt
        logger.info({
            requestId,
            action: 'getLists',
            message: 'Attempting to fetch lists',
            endpoint,
            params,
            timestamp: new Date().toISOString()
        });

        const listsData = await clickupApi.get(endpoint, req.clickupToken, params);

        // Log successful response
        logger.info({
            requestId,
            action: 'getLists',
            message: 'Lists retrieved successfully',
            listsCount: listsData.lists?.length || 0,
            timestamp: new Date().toISOString()
        });

        res.json({
            message: 'Lists retrieved successfully',
            data: listsData,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: listsData.lists?.length || 0
            },
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Log the error
        logger.error({
            requestId,
            action: 'getLists',
            error: {
                message: error.message,
                stack: error.stack,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    baseURL: error.config?.baseURL,
                    params: error.config?.params
                }
            },
            timestamp: new Date().toISOString()
        });

        // Handle specific error cases
        if (error.name === 'ClickUpApiError') {
            return res.status(error.status).json({
                error: error.message,
                details: error.data,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Handle unexpected errors
        res.status(500).json({
            error: 'Failed to retrieve lists',
            details: error.message,
            requestId,
            timestamp: new Date().toISOString()
        });
    }
};

// Get list by ID
export const getListById = async (req, res) => {
    const requestId = Date.now().toString();
    const { listId } = req.params;

    try {
        const listData = await clickupApi.get(`/list/${listId}`, req.clickupToken);
        res.json({
            message: 'List retrieved successfully',
            data: listData,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Create list
export const createList = async (req, res) => {
    const requestId = Date.now().toString();
    const { folderId } = req.params;
    const listData = req.body;

    try {
        // Log the incoming request
        logger.info({
            requestId,
            action: 'createList',
            requestData: listData,
            folderId,
            timestamp: new Date().toISOString()
        });

        // Validate required fields
        const requiredFields = ['name'];
        const missingFields = requiredFields.filter(field => !listData[field]);
        
        if (missingFields.length > 0) {
            logger.warn({
                requestId,
                action: 'createList',
                error: 'Missing required fields',
                missingFields,
                timestamp: new Date().toISOString()
            });

            return res.status(400).json({
                error: `Missing required fields: ${missingFields.join(', ')}`,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Validate list data structure
        if (typeof listData.name !== 'string' || listData.name.trim().length === 0) {
            return res.status(400).json({
                error: 'List name must be a non-empty string',
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Prepare the request payload
        const payload = {
            name: listData.name.trim()
        };

        // Add optional fields if provided
        if (listData.content) {
            payload.content = listData.content;
        }

        if (listData.due_date) {
            payload.due_date = listData.due_date;
        }

        if (listData.priority) {
            payload.priority = listData.priority;
        }

        if (listData.assignee) {
            payload.assignee = listData.assignee;
        }

        if (listData.status) {
            payload.status = listData.status;
        }

        if (listData.custom_fields && Array.isArray(listData.custom_fields)) {
            payload.custom_fields = listData.custom_fields;
        }

        // Make the API call
        const endpoint = folderId ? `/folder/${folderId}/list` : '/list';
        
        // Log API call attempt
        logger.info({
            requestId,
            action: 'createList',
            message: 'Attempting to create list via ClickUp API',
            payload,
            endpoint,
            timestamp: new Date().toISOString()
        });

        const newList = await clickupApi.post(endpoint, req.clickupToken, payload, requestId);

        // Log successful response
        logger.info({
            requestId,
            action: 'createList',
            message: 'List created successfully',
            listId: newList.id,
            response: newList,
            timestamp: new Date().toISOString()
        });

        res.status(201).json({
            message: 'List created successfully',
            data: newList,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Log the error
        logger.error({
            requestId,
            action: 'createList',
            error: {
                message: error.message,
                stack: error.stack,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    baseURL: error.config?.baseURL,
                    data: error.config?.data
                }
            },
            timestamp: new Date().toISOString()
        });

        // Handle specific error cases
        if (error.name === 'ClickUpApiError') {
            return res.status(error.status).json({
                error: error.message,
                details: error.data,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Handle unexpected errors
        res.status(500).json({
            error: 'Failed to create list',
            details: error.message,
            requestId,
            timestamp: new Date().toISOString()
        });
    }
};

// Update list
export const updateList = async (req, res) => {
    const requestId = Date.now().toString();
    const { listId } = req.params;
    const listData = req.body;

    if (Object.keys(listData).length === 0) {
        return res.status(400).json({
            error: 'No update data provided',
            requestId
        });
    }

    try {
        const updatedList = await clickupApi.put(`/list/${listId}`, req.clickupToken, listData);
        res.json({
            message: 'List updated successfully',
            data: updatedList,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Delete list
export const deleteList = async (req, res) => {
    const requestId = Date.now().toString();
    const { listId } = req.params;

    try {
        await clickupApi.delete(`/list/${listId}`, req.clickupToken);
        res.json({
            message: 'List deleted successfully',
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(error.status || 500).json(error);
    }
};

// Get tasks with enhanced pagination and filtering
export const getTasks = async (req, res) => {
    const requestId = Date.now().toString();
    const { listId, taskId } = req.params;
    const { 
        page = 0, 
        limit = 100, 
        status,
        assignees,
        due_date_gt,
        due_date_lt,
        date_created_gt,
        date_created_lt,
        date_updated_gt,
        date_updated_lt,
        custom_fields,
        include_closed = false,
        subtasks = false
    } = req.query;

    try {
        // Log the incoming request
        logger.info({
            requestId,
            action: 'getTasks',
            params: { listId, taskId },
            query: req.query,
            timestamp: new Date().toISOString()
        });

        let endpoint;
        let params = {
            page: parseInt(page),
            limit: parseInt(limit),
            include_closed: include_closed === 'true',
            subtasks: subtasks === 'true'
        };

        // Add optional filters if provided
        if (status) params.status = status;
        if (assignees) params.assignees = assignees;
        if (due_date_gt) params.due_date_gt = due_date_gt;
        if (due_date_lt) params.due_date_lt = due_date_lt;
        if (date_created_gt) params.date_created_gt = date_created_gt;
        if (date_created_lt) params.date_created_lt = date_created_lt;
        if (date_updated_gt) params.date_updated_gt = date_updated_gt;
        if (date_updated_lt) params.date_updated_lt = date_updated_lt;
        if (custom_fields) params.custom_fields = custom_fields;

        // Determine the correct endpoint based on the request
        if (taskId) {
            endpoint = `/task/${taskId}`;
        } else if (listId) {
            endpoint = `/list/${listId}/task`;
        } else {
            // For getting all tasks, we need to first get the team ID
            const teamsResponse = await clickupApi.get('/team', req.clickupToken);
            
            if (!teamsResponse.teams || teamsResponse.teams.length === 0) {
                return res.status(404).json({
                    error: 'No teams found',
                    requestId,
                    timestamp: new Date().toISOString()
                });
            }

            // Use the first team's ID to get tasks
            const teamId = teamsResponse.teams[0].id;
            endpoint = `/team/${teamId}/task`;
        }

        // Log API call attempt
        logger.info({
            requestId,
            action: 'getTasks',
            message: 'Attempting to fetch tasks via ClickUp API',
            endpoint,
            params,
            timestamp: new Date().toISOString()
        });

        const tasksData = await clickupApi.get(endpoint, req.clickupToken, params);

        // Log successful response
        logger.info({
            requestId,
            action: 'getTasks',
            message: 'Tasks retrieved successfully',
            count: tasksData.tasks?.length || 0,
            timestamp: new Date().toISOString()
        });

        res.json({
            message: 'Tasks retrieved successfully',
            data: tasksData,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: tasksData.tasks?.length || 0
            },
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Log the error
        logger.error({
            requestId,
            action: 'getTasks',
            error: {
                message: error.message,
                stack: error.stack,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    baseURL: error.config?.baseURL,
                    params: error.config?.params
                }
            },
            timestamp: new Date().toISOString()
        });

        // Handle specific error cases
        if (error.name === 'ClickUpApiError') {
            return res.status(error.status).json({
                error: error.message,
                details: error.data,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Handle unexpected errors
        res.status(500).json({
            error: 'Failed to retrieve tasks',
            details: error.message,
            requestId,
            timestamp: new Date().toISOString()
        });
    }
};

// Create task
export const createTask = async (req, res) => {
    const requestId = Date.now().toString();
    const { listId } = req.params;
    const taskData = req.body;

    try {
        // Log the incoming request
        logger.info({
            requestId,
            action: 'createTask',
            requestData: taskData,
            listId,
            timestamp: new Date().toISOString()
        });

        // Validate required fields
        const requiredFields = ['name'];
        const missingFields = requiredFields.filter(field => !taskData[field]);
        
        if (missingFields.length > 0) {
            logger.warn({
                requestId,
                action: 'createTask',
                error: 'Missing required fields',
                missingFields,
                timestamp: new Date().toISOString()
            });

            return res.status(400).json({
                error: `Missing required fields: ${missingFields.join(', ')}`,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Validate task data structure
        if (typeof taskData.name !== 'string' || taskData.name.trim().length === 0) {
            return res.status(400).json({
                error: 'Task name must be a non-empty string',
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Prepare the request payload
        const payload = {
            name: taskData.name.trim()
        };

        // Add optional fields if provided
        if (taskData.description) {
            payload.description = taskData.description;
        }

        // Handle dates properly
        if (taskData.due_date) {
            try {
                // Convert to milliseconds if it's a date string
                if (typeof taskData.due_date === 'string') {
                    payload.due_date = new Date(taskData.due_date).getTime();
                } else {
                    payload.due_date = taskData.due_date;
                }
            } catch (error) {
                return res.status(400).json({
                    error: 'Invalid due date format. Please provide a valid date string or timestamp',
                    requestId,
                    timestamp: new Date().toISOString()
                });
            }
        }

        if (taskData.start_date) {
            try {
                // Convert to milliseconds if it's a date string
                if (typeof taskData.start_date === 'string') {
                    payload.start_date = new Date(taskData.start_date).getTime();
                } else {
                    payload.start_date = taskData.start_date;
                }
            } catch (error) {
                return res.status(400).json({
                    error: 'Invalid start date format. Please provide a valid date string or timestamp',
                    requestId,
                    timestamp: new Date().toISOString()
                });
            }
        }

        if (taskData.priority) {
            payload.priority = taskData.priority;
        }

        if (taskData.assignees) {
            // Convert string IDs to numbers if needed
            payload.assignees = taskData.assignees.map(id => 
                typeof id === 'string' ? parseInt(id, 10) : id
            );
        }

        if (taskData.status) {
            payload.status = taskData.status;
        }

        if (taskData.parent) {
            payload.parent = taskData.parent;
        }

        if (taskData.time_estimate) {
            payload.time_estimate = taskData.time_estimate;
        }

        if (taskData.notify_all !== undefined) {
            payload.notify_all = taskData.notify_all;
        }

        if (taskData.custom_fields) {
            payload.custom_fields = taskData.custom_fields;
        }

        // Log API call attempt
        logger.info({
            requestId,
            action: 'createTask',
            message: 'Attempting to create task via ClickUp API',
            payload,
            endpoint: listId ? `/list/${listId}/task` : '/task',
            timestamp: new Date().toISOString()
        });

        // Make the API call
        const endpoint = listId ? `/list/${listId}/task` : '/task';
        const newTask = await clickupApi.post(endpoint, req.clickupToken, payload, requestId);

        // Log successful response
        logger.info({
            requestId,
            action: 'createTask',
            message: 'Task created successfully',
            taskId: newTask.id,
            response: newTask,
            timestamp: new Date().toISOString()
        });

        res.status(201).json({
            message: 'Task created successfully',
            data: newTask,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Log the error
        logger.error({
            requestId,
            action: 'createTask',
            error: {
                message: error.message,
                stack: error.stack,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    baseURL: error.config?.baseURL,
                    data: error.config?.data
                }
            },
            timestamp: new Date().toISOString()
        });

        // Handle specific error cases
        if (error.name === 'ClickUpApiError') {
            return res.status(error.status).json({
                error: error.message,
                details: error.data,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Handle unexpected errors
        res.status(500).json({
            error: 'Failed to create task',
            details: error.message,
            requestId,
            timestamp: new Date().toISOString()
        });
    }
};

// Update task
export const updateTask = async (req, res) => {
    const requestId = Date.now().toString();
    const { taskId } = req.params;
    const taskData = req.body;

    try {
        // Log the incoming request
        logger.info({
            requestId,
            action: 'updateTask',
            taskId,
            requestData: taskData,
            timestamp: new Date().toISOString()
        });

        if (Object.keys(taskData).length === 0) {
            return res.status(400).json({
                error: 'No update data provided',
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Prepare the request payload
        const payload = {};

        // Add fields if provided
        if (taskData.name) payload.name = taskData.name.trim();
        if (taskData.description) payload.description = taskData.description;
        if (taskData.due_date) payload.due_date = taskData.due_date;
        if (taskData.priority) payload.priority = taskData.priority;
        if (taskData.assignees) payload.assignees = taskData.assignees;
        if (taskData.status) payload.status = taskData.status;
        if (taskData.parent) payload.parent = taskData.parent;
        if (taskData.time_estimate) payload.time_estimate = taskData.time_estimate;
        if (taskData.start_date) payload.start_date = taskData.start_date;
        if (taskData.notify_all !== undefined) payload.notify_all = taskData.notify_all;
        if (taskData.custom_fields) payload.custom_fields = taskData.custom_fields;

        // Log API call attempt
        logger.info({
            requestId,
            action: 'updateTask',
            message: 'Attempting to update task via ClickUp API',
            taskId,
            payload,
            timestamp: new Date().toISOString()
        });

        const updatedTask = await clickupApi.put(`/task/${taskId}`, req.clickupToken, payload, requestId);

        // Log successful response
        logger.info({
            requestId,
            action: 'updateTask',
            message: 'Task updated successfully',
            taskId,
            response: updatedTask,
            timestamp: new Date().toISOString()
        });

        res.json({
            message: 'Task updated successfully',
            data: updatedTask,
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Log the error
        logger.error({
            requestId,
            action: 'updateTask',
            error: {
                message: error.message,
                stack: error.stack,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    baseURL: error.config?.baseURL,
                    data: error.config?.data
                }
            },
            timestamp: new Date().toISOString()
        });

        // Handle specific error cases
        if (error.name === 'ClickUpApiError') {
            return res.status(error.status).json({
                error: error.message,
                details: error.data,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Handle unexpected errors
        res.status(500).json({
            error: 'Failed to update task',
            details: error.message,
            requestId,
            timestamp: new Date().toISOString()
        });
    }
};

// Delete task
export const deleteTask = async (req, res) => {
    const requestId = Date.now().toString();
    const { taskId } = req.params;

    try {
        // Log the incoming request
        logger.info({
            requestId,
            action: 'deleteTask',
            taskId,
            timestamp: new Date().toISOString()
        });

        // Log API call attempt
        logger.info({
            requestId,
            action: 'deleteTask',
            message: 'Attempting to delete task via ClickUp API',
            taskId,
            timestamp: new Date().toISOString()
        });

        await clickupApi.delete(`/task/${taskId}`, req.clickupToken, null, requestId);

        // Log successful response
        logger.info({
            requestId,
            action: 'deleteTask',
            message: 'Task deleted successfully',
            taskId,
            timestamp: new Date().toISOString()
        });

        res.json({
            message: 'Task deleted successfully',
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Log the error
        logger.error({
            requestId,
            action: 'deleteTask',
            error: {
                message: error.message,
                stack: error.stack,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    baseURL: error.config?.baseURL
                }
            },
            timestamp: new Date().toISOString()
        });

        // Handle specific error cases
        if (error.name === 'ClickUpApiError') {
            return res.status(error.status).json({
                error: error.message,
                details: error.data,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Handle unexpected errors
        res.status(500).json({
            error: 'Failed to delete task',
            details: error.message,
            requestId,
            timestamp: new Date().toISOString()
        });
    }
};

// Get tasks by username
export const getTasksByUsername = async (req, res) => {
    const requestId = Date.now().toString();
    const { username } = req.params;
    const { 
        page = 0, 
        limit = 100, 
        status,
        include_closed = false,
        subtasks = false
    } = req.query;

    try {
        // Log the incoming request
        logger.info({
            requestId,
            action: 'getTasksByUsername',
            username,
            query: req.query,
            timestamp: new Date().toISOString()
        });

        // First, get all teams to find the user
        const teamsResponse = await clickupApi.get('/team', req.clickupToken);
        
        if (!teamsResponse.teams || teamsResponse.teams.length === 0) {
            return res.status(404).json({
                error: 'No teams found',
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Find the user in teams
        let userId = null;
        let userTeamId = null;

        for (const team of teamsResponse.teams) {
            try {
                // Get team members
                const teamMembersResponse = await clickupApi.get(`/team/${team.id}/member`, req.clickupToken);
                
                if (teamMembersResponse.members) {
                    const user = teamMembersResponse.members.find(member => 
                        member.user.username.toLowerCase() === username.toLowerCase()
                    );
                    
                    if (user) {
                        userId = user.user.id;
                        userTeamId = team.id;
                        break;
                    }
                }
            } catch (error) {
                logger.warn({
                    requestId,
                    action: 'getTasksByUsername',
                    message: `Error fetching members for team ${team.id}`,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
                continue;
            }
        }

        if (!userId || !userTeamId) {
            return res.status(404).json({
                error: `User with username '${username}' not found in any team`,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Prepare query parameters
        const params = {
            page: parseInt(page),
            limit: parseInt(limit),
            include_closed: include_closed === 'true',
            subtasks: subtasks === 'true',
            assignees: [userId] // Filter by user ID
        };

        // Add optional status filter
        if (status) {
            params.status = status;
        }

        // Log API call attempt
        logger.info({
            requestId,
            action: 'getTasksByUsername',
            message: 'Attempting to fetch tasks for user',
            userId,
            teamId: userTeamId,
            params,
            timestamp: new Date().toISOString()
        });

        // Get tasks for the user's team
        const tasksData = await clickupApi.get(`/team/${userTeamId}/task`, req.clickupToken, params);

        // Filter tasks to only include those assigned to the user
        const userTasks = tasksData.tasks ? tasksData.tasks.filter(task => 
            task.assignees && task.assignees.some(assignee => assignee.id === userId)
        ) : [];

        // Log successful response
        logger.info({
            requestId,
            action: 'getTasksByUsername',
            message: 'Tasks retrieved successfully',
            count: userTasks.length,
            timestamp: new Date().toISOString()
        });

        res.json({
            message: 'Tasks retrieved successfully',
            data: {
                tasks: userTasks,
                user: {
                    id: userId,
                    username: username
                }
            },
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: userTasks.length
            },
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Log the error
        logger.error({
            requestId,
            action: 'getTasksByUsername',
            error: {
                message: error.message,
                stack: error.stack,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    baseURL: error.config?.baseURL,
                    params: error.config?.params
                }
            },
            timestamp: new Date().toISOString()
        });

        // Handle specific error cases
        if (error.name === 'ClickUpApiError') {
            return res.status(error.status).json({
                error: error.message,
                details: error.data,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Handle unexpected errors
        res.status(500).json({
            error: 'Failed to retrieve tasks',
            details: error.message,
            requestId,
            timestamp: new Date().toISOString()
        });
    }
};

// Search across ClickUp entities
export const searchClickUp = async (req, res) => {
    const requestId = Date.now().toString();
    const { 
        searchQuery,
        type = 'all', // all, tasks, lists, spaces, folders, teams
        page = 0,
        limit = 100,
        include_closed = false
    } = req.query;

    try {
        // Log the incoming request
        logger.info({
            requestId,
            action: 'searchClickUp',
            searchQuery,
            type,
            page,
            limit,
            include_closed,
            timestamp: new Date().toISOString()
        });

        if (!searchQuery) {
            logger.warn({
                requestId,
                action: 'searchClickUp',
                error: 'Search query is missing',
                timestamp: new Date().toISOString()
            });
            return res.status(400).json({
                error: 'Search query is required',
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        // Helper function to safely check if a string contains the search query
        const matchesSearch = (text) => {
            if (!text) return false;
            return String(text).toLowerCase().includes(searchQuery.toLowerCase());
        };

        // Get all teams first
        logger.info({
            requestId,
            action: 'searchClickUp',
            message: 'Fetching teams',
            timestamp: new Date().toISOString()
        });

        const teamsResponse = await clickupApi.get('/team', req.clickupToken);
        
        logger.info({
            requestId,
            action: 'searchClickUp',
            message: 'Teams response received',
            teamsCount: teamsResponse.teams?.length || 0,
            timestamp: new Date().toISOString()
        });
        
        if (!teamsResponse.teams || teamsResponse.teams.length === 0) {
            logger.warn({
                requestId,
                action: 'searchClickUp',
                error: 'No teams found',
                timestamp: new Date().toISOString()
            });
            return res.status(404).json({
                error: 'No teams found',
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        const searchResults = {
            tasks: [],
            lists: [],
            spaces: [],
            folders: [],
            teams: []
        };

        // Search through each team
        for (const team of teamsResponse.teams) {
            logger.info({
                requestId,
                action: 'searchClickUp',
                message: `Processing team: ${team.name} (${team.id})`,
                timestamp: new Date().toISOString()
            });

            // Search teams
            if (type === 'all' || type === 'teams') {
                if (matchesSearch(team.name)) {
                    logger.info({
                        requestId,
                        action: 'searchClickUp',
                        message: `Found matching team: ${team.name}`,
                        timestamp: new Date().toISOString()
                    });
                    searchResults.teams.push(team);
                }
            }

            // Search spaces
            if (type === 'all' || type === 'spaces') {
                try {
                    logger.info({
                        requestId,
                        action: 'searchClickUp',
                        message: `Fetching spaces for team: ${team.id}`,
                        timestamp: new Date().toISOString()
                    });

                    const spacesResponse = await clickupApi.get(`/team/${team.id}/space`, req.clickupToken);
                    
                    logger.info({
                        requestId,
                        action: 'searchClickUp',
                        message: `Spaces response received for team: ${team.id}`,
                        spacesCount: spacesResponse.spaces?.length || 0,
                        spaces: spacesResponse.spaces?.map(s => ({ id: s.id, name: s.name })) || [],
                        timestamp: new Date().toISOString()
                    });

                    if (spacesResponse.spaces) {
                        const matchingSpaces = spacesResponse.spaces.filter(space => 
                            matchesSearch(space.name) || matchesSearch(space.description)
                        );
                        
                        logger.info({
                            requestId,
                            action: 'searchClickUp',
                            message: `Found ${matchingSpaces.length} matching spaces for team: ${team.id}`,
                            timestamp: new Date().toISOString()
                        });

                        searchResults.spaces.push(...matchingSpaces);
                    }
                } catch (error) {
                    logger.error({
                        requestId,
                        action: 'searchClickUp',
                        message: `Error fetching spaces for team ${team.id}`,
                        error: error.message,
                        stack: error.stack,
                        response: error.response?.data,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            // Search folders and lists
            if (type === 'all' || type === 'folders' || type === 'lists') {
                // First get all spaces for the team
                try {
                    logger.info({
                        requestId,
                        action: 'searchClickUp',
                        message: `Fetching all spaces for team: ${team.id}`,
                        timestamp: new Date().toISOString()
                    });

                    const spacesResponse = await clickupApi.get(`/team/${team.id}/space`, req.clickupToken);
                    
                    logger.info({
                        requestId,
                        action: 'searchClickUp',
                        message: 'Spaces response received',
                        spacesCount: spacesResponse.spaces?.length || 0,
                        spaces: spacesResponse.spaces?.map(s => ({ id: s.id, name: s.name })) || [],
                        timestamp: new Date().toISOString()
                    });
                    
                    if (spacesResponse.spaces) {
                        for (const space of spacesResponse.spaces) {
                            logger.info({
                                requestId,
                                action: 'searchClickUp',
                                message: `Processing space: ${space.name} (${space.id})`,
                                timestamp: new Date().toISOString()
                            });

                            try {
                                // Search lists directly in space (folderless lists)
                                if (type === 'all' || type === 'lists') {
                                    logger.info({
                                        requestId,
                                        action: 'searchClickUp',
                                        message: `Fetching folderless lists for space: ${space.id}`,
                                        timestamp: new Date().toISOString()
                                    });

                                    const spaceListsResponse = await clickupApi.get(`/space/${space.id}/list`, req.clickupToken);
                                    
                                    logger.info({
                                        requestId,
                                        action: 'searchClickUp',
                                        message: `Space lists response received for space: ${space.id}`,
                                        listsCount: spaceListsResponse.lists?.length || 0,
                                        lists: spaceListsResponse.lists?.map(l => ({ id: l.id, name: l.name })) || [],
                                        timestamp: new Date().toISOString()
                                    });

                                    if (spaceListsResponse.lists) {
                                        const matchingLists = spaceListsResponse.lists.filter(list => {
                                            const matches = matchesSearch(list.name);
                                            logger.info({
                                                requestId,
                                                action: 'searchClickUp',
                                                message: `Checking list: ${list.name}`,
                                                matches,
                                                searchQuery,
                                                timestamp: new Date().toISOString()
                                            });
                                            return matches;
                                        });
                                        
                                        logger.info({
                                            requestId,
                                            action: 'searchClickUp',
                                            message: `Found ${matchingLists.length} matching folderless lists for space: ${space.id}`,
                                            matchingLists: matchingLists.map(l => ({ id: l.id, name: l.name })),
                                            timestamp: new Date().toISOString()
                                        });

                                        searchResults.lists.push(...matchingLists);
                                    }
                                }

                                // Search folders and their lists
                                if (type === 'all' || type === 'folders' || type === 'lists') {
                                    logger.info({
                                        requestId,
                                        action: 'searchClickUp',
                                        message: `Fetching folders for space: ${space.id}`,
                                        timestamp: new Date().toISOString()
                                    });

                                    const foldersResponse = await clickupApi.get(`/space/${space.id}/folder`, req.clickupToken);
                                    
                                    logger.info({
                                        requestId,
                                        action: 'searchClickUp',
                                        message: `Folders response received for space: ${space.id}`,
                                        foldersCount: foldersResponse.folders?.length || 0,
                                        folders: foldersResponse.folders?.map(f => ({ id: f.id, name: f.name })) || [],
                                        timestamp: new Date().toISOString()
                                    });

                                    if (foldersResponse.folders) {
                                        const matchingFolders = foldersResponse.folders.filter(folder => 
                                            matchesSearch(folder.name)
                                        );
                                        
                                        logger.info({
                                            requestId,
                                            action: 'searchClickUp',
                                            message: `Found ${matchingFolders.length} matching folders for space: ${space.id}`,
                                            matchingFolders: matchingFolders.map(f => ({ id: f.id, name: f.name })),
                                            timestamp: new Date().toISOString()
                                        });

                                        searchResults.folders.push(...matchingFolders);

                                        // Search lists in folders
                                        for (const folder of foldersResponse.folders) {
                                            try {
                                                logger.info({
                                                    requestId,
                                                    action: 'searchClickUp',
                                                    message: `Fetching lists for folder: ${folder.id}`,
                                                    timestamp: new Date().toISOString()
                                                });

                                                const folderListsResponse = await clickupApi.get(`/folder/${folder.id}/list`, req.clickupToken);
                                                
                                                logger.info({
                                                    requestId,
                                                    action: 'searchClickUp',
                                                    message: `Folder lists response received for folder: ${folder.id}`,
                                                    listsCount: folderListsResponse.lists?.length || 0,
                                                    lists: folderListsResponse.lists?.map(l => ({ id: l.id, name: l.name })) || [],
                                                    timestamp: new Date().toISOString()
                                                });

                                                if (folderListsResponse.lists) {
                                                    const matchingLists = folderListsResponse.lists.filter(list => {
                                                        const matches = matchesSearch(list.name);
                                                        logger.info({
                                                            requestId,
                                                            action: 'searchClickUp',
                                                            message: `Checking list: ${list.name}`,
                                                            matches,
                                                            searchQuery,
                                                            timestamp: new Date().toISOString()
                                                        });
                                                        return matches;
                                                    });
                                                    
                                                    logger.info({
                                                        requestId,
                                                        action: 'searchClickUp',
                                                        message: `Found ${matchingLists.length} matching lists in folder: ${folder.id}`,
                                                        matchingLists: matchingLists.map(l => ({ id: l.id, name: l.name })),
                                                        timestamp: new Date().toISOString()
                                                    });

                                                    searchResults.lists.push(...matchingLists);
                                                }
                                            } catch (error) {
                                                logger.error({
                                                    requestId,
                                                    action: 'searchClickUp',
                                                    message: `Error fetching lists for folder ${folder.id}`,
                                                    error: error.message,
                                                    stack: error.stack,
                                                    response: error.response?.data,
                                                    timestamp: new Date().toISOString()
                                                });
                                            }
                                        }
                                    }
                                }
                            } catch (error) {
                                logger.error({
                                    requestId,
                                    action: 'searchClickUp',
                                    message: `Error processing space ${space.id}`,
                                    error: error.message,
                                    stack: error.stack,
                                    response: error.response?.data,
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                    }
                } catch (error) {
                    logger.error({
                        requestId,
                        action: 'searchClickUp',
                        message: `Error fetching spaces for team ${team.id}`,
                        error: error.message,
                        stack: error.stack,
                        response: error.response?.data,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            // Search tasks
            if (type === 'all' || type === 'tasks') {
                try {
                    logger.info({
                        requestId,
                        action: 'searchClickUp',
                        message: `Fetching tasks for team: ${team.id}`,
                        params: {
                            page: parseInt(page),
                            limit: parseInt(limit),
                            include_closed: include_closed === 'true'
                        },
                        timestamp: new Date().toISOString()
                    });

                    const tasksResponse = await clickupApi.get(`/team/${team.id}/task`, req.clickupToken, {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        include_closed: include_closed === 'true'
                    });

                    logger.info({
                        requestId,
                        action: 'searchClickUp',
                        message: `Tasks response received for team: ${team.id}`,
                        tasksCount: tasksResponse.tasks?.length || 0,
                        timestamp: new Date().toISOString()
                    });

                    if (tasksResponse.tasks) {
                        // Log a sample task to understand its structure
                        if (tasksResponse.tasks.length > 0) {
                            logger.info({
                                requestId,
                                action: 'searchClickUp',
                                message: 'Sample task structure',
                                sampleTask: tasksResponse.tasks[0],
                                timestamp: new Date().toISOString()
                            });
                        }

                        const matchingTasks = tasksResponse.tasks.filter(task => {
                            try {
                                return (
                                    matchesSearch(task.name) ||
                                    matchesSearch(task.description) ||
                                    (task.status && matchesSearch(task.status.status))
                                );
                            } catch (error) {
                                logger.error({
                                    requestId,
                                    action: 'searchClickUp',
                                    message: `Error processing task ${task.id}`,
                                    error: error.message,
                                    task: task,
                                    timestamp: new Date().toISOString()
                                });
                                return false;
                            }
                        });
                        
                        logger.info({
                            requestId,
                            action: 'searchClickUp',
                            message: `Found ${matchingTasks.length} matching tasks for team: ${team.id}`,
                            timestamp: new Date().toISOString()
                        });

                        searchResults.tasks.push(...matchingTasks);
                    }
                } catch (error) {
                    logger.error({
                        requestId,
                        action: 'searchClickUp',
                        message: `Error fetching tasks for team ${team.id}`,
                        error: error.message,
                        stack: error.stack,
                        response: error.response?.data,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }

        // Apply pagination to results
        const paginatedResults = {
            tasks: searchResults.tasks.slice(page * limit, (page + 1) * limit),
            lists: searchResults.lists.slice(page * limit, (page + 1) * limit),
            spaces: searchResults.spaces.slice(page * limit, (page + 1) * limit),
            folders: searchResults.folders.slice(page * limit, (page + 1) * limit),
            teams: searchResults.teams.slice(page * limit, (page + 1) * limit)
        };

        logger.info({
            requestId,
            action: 'searchClickUp',
            message: 'Search completed',
            results: {
                total: {
                    tasks: searchResults.tasks.length,
                    lists: searchResults.lists.length,
                    spaces: searchResults.spaces.length,
                    folders: searchResults.folders.length,
                    teams: searchResults.teams.length
                },
                paginated: {
                    tasks: paginatedResults.tasks.length,
                    lists: paginatedResults.lists.length,
                    spaces: paginatedResults.spaces.length,
                    folders: paginatedResults.folders.length,
                    teams: paginatedResults.teams.length
                }
            },
            timestamp: new Date().toISOString()
        });

        res.json({
            message: 'Search completed successfully',
            data: paginatedResults,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: {
                    tasks: searchResults.tasks.length,
                    lists: searchResults.lists.length,
                    spaces: searchResults.spaces.length,
                    folders: searchResults.folders.length,
                    teams: searchResults.teams.length
                }
            },
            requestId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error({
            requestId,
            action: 'searchClickUp',
            error: {
                message: error.message,
                stack: error.stack,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    baseURL: error.config?.baseURL,
                    params: error.config?.params
                }
            },
            timestamp: new Date().toISOString()
        });

        if (error.name === 'ClickUpApiError') {
            return res.status(error.status).json({
                error: error.message,
                details: error.data,
                requestId,
                timestamp: new Date().toISOString()
            });
        }

        res.status(500).json({
            error: 'Failed to perform search',
            details: error.message,
            requestId,
            timestamp: new Date().toISOString()
        });
    }
};
