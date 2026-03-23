import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    initiateCalendlyAuth,
    handleCalendlyCallback,
    getCurrentUser,
    disconnectCalendly,
    getSchedulingLink,
    getScheduledEvents,
    createSchedulingLink,
    bookMeeting,
    getAvailableTimes,
    createEventType,
    refreshAccessToken,
    addEventTypeAvailability
} from '../controllers/calendlyController.js';

const router = express.Router();

// Public routes
router.get('/auth', initiateCalendlyAuth);
router.get('/callback', handleCalendlyCallback);

// Protected routes (require authentication)
router.use(protect);
router.get('/me', getCurrentUser);
router.delete('/disconnect', disconnectCalendly);
router.get('/scheduling-link', getSchedulingLink);
router.get('/events', getScheduledEvents);
router.post('/create-scheduling-link', createSchedulingLink);
router.post('/book-meeting', bookMeeting);
router.get('/available-times', getAvailableTimes);
router.post('/event-types', createEventType);
router.post('/refresh-token', refreshAccessToken);
router.post('/event-types/:eventTypeId/available-times', addEventTypeAvailability);

export default router; 