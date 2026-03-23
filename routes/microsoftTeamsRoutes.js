import express from 'express';
import {
    getTeams,
    getTeamChannels,
    createChannel,
    getChannelMessages,
    sendChannelMessage,
    getTeamMembers
} from '../controllers/microsoftTeamsController.js';

const router = express.Router();

// Get all teams for the authenticated user
router.get('/teams', getTeams);

// Get channels for a specific team
router.get('/teams/:teamId/channels', getTeamChannels);

// Create a new channel in a team
router.post('/teams/:teamId/channels', createChannel);

// Get messages from a channel
router.get('/teams/:teamId/channels/:channelId/messages', getChannelMessages);

// Send a message to a channel
router.post('/teams/:teamId/channels/:channelId/messages', sendChannelMessage);

// Get team members
router.get('/teams/:teamId/members', getTeamMembers);

export default router; 