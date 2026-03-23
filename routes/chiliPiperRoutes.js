import express from 'express';
import {
    createMeeting,
    getMeetings,
    getMeeting,
    updateMeeting,
    deleteMeeting,
    handleWebhook,
    initiateOAuth,
    handleOAuthCallback,
    authenticateToken
} from '../controllers/chiliPiperController.js';

const router = express.Router();

// OAuth routes
router.get('/oauth/initiate', initiateOAuth);
router.get('/oauth/callback', handleOAuthCallback);

// Protected routes
router.route('/meetings')
    .post(authenticateToken, createMeeting)
    .get(authenticateToken, getMeetings);

router.route('/meetings/:id')
    .get(authenticateToken, getMeeting)
    .put(authenticateToken, updateMeeting)
    .delete(authenticateToken, deleteMeeting);

// Webhook endpoint
router.post('/webhook', handleWebhook);

export default router;
