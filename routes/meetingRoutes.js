import express from 'express';
import {
    createMeeting,
    getMeetings,
    getMeetingById,
    updateMeeting,
    deleteMeeting,
    startZoomMeeting,
    startGoogleMeet,
    handleRecordingWebhook
} from '../controllers/meetingController.js';
import { protect } from '../controllers/authController.js';

const router = express.Router();

// Protect all routes except webhook
router.use(protect);

router.route('/')
    .post(createMeeting)
    .get(getMeetings);

router.route('/:id')
    .get(getMeetingById)
    .put(updateMeeting)
    .delete(deleteMeeting);

// Platform-specific routes
router.post('/zoom/start', startZoomMeeting);
router.post('/google/start', startGoogleMeet);

// Webhook route (public)
router.post('/recording-webhook', handleRecordingWebhook);

export default router; 