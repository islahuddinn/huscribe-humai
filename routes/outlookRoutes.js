const express = require('express');
const router = express.Router();
const outlookController = require('../controllers/outlookController');
const authMiddleware = require('../middleware/auth');

// Initialize Outlook authentication
router.get('/auth/init', authMiddleware, outlookController.initOutlookAuth);

// Handle OAuth callback
router.get('/auth/callback', outlookController.handleOutlookCallback);

// Email endpoints
router.get('/emails', authMiddleware, outlookController.getEmails);
router.post('/emails/send', authMiddleware, outlookController.sendEmail);

// Calendar endpoints
router.get('/calendar/events', authMiddleware, outlookController.getCalendarEvents);
router.post('/calendar/events', authMiddleware, outlookController.createCalendarEvent);

// Contacts endpoints
router.get('/contacts', authMiddleware, outlookController.getContacts);

// Token refresh endpoint
router.post('/auth/refresh', authMiddleware, outlookController.refreshOutlookToken);

module.exports = router;
