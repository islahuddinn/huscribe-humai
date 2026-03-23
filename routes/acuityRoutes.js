import express from 'express';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import {
    // OAuth functions
    initiateOAuth,
    handleOAuthCallback,
    refreshAccessToken,
    verifyOAuthToken,
    logout,
    // API functions
    getAppointments,
    getAppointmentById,
    createAppointment,
    updateAppointment,
    cancelAppointment,
    getAvailableTimes,
    getCalendars,
    getAppointmentTypes
} from '../controllers/acuityController.js';

const router = express.Router();

// Rate limiting configuration
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    trustProxy: false, // Disable trust proxy
    keyGenerator: (req) => {
        // Use a combination of IP and user agent for better rate limiting
        return `${req.ip}-${req.headers['user-agent']}`;
    }
});

// Apply rate limiting to all routes
router.use(apiLimiter);

// OAuth routes (unprotected)
router.get('/oauth/auth', initiateOAuth);
router.get('/oauth/callback', handleOAuthCallback);
router.post('/oauth/refresh', refreshAccessToken);
router.get('/oauth/me', verifyOAuthToken, (req, res) => {
    res.json({
        success: true,
        data: req.acuityUser
    });
});
router.post('/oauth/logout', logout);

// Apply OAuth middleware to all protected routes
router.use(verifyOAuthToken);

// Validation middleware
const validateAppointment = [
    body('appointmentTypeID').optional().isInt().withMessage('Appointment type ID must be an integer'),
    body('appointmentTypeName').optional().isString().withMessage('Appointment type name must be a string'),
    body('calendarID').isInt().withMessage('Calendar ID must be an integer'),
    body('datetime').isISO8601().withMessage('Invalid date format'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('Invalid email format'),
    body('phone').optional().matches(/^\+?[0-9\s\-()]+$/).withMessage('Invalid phone number format')
];

// Protected API routes
router.get('/appointments', getAppointments);
router.get('/appointments/:id', 
    param('id').isInt().withMessage('Invalid appointment ID'),
    getAppointmentById
);
router.post('/appointments/create', validateAppointment, createAppointment);
router.put('/appointments/:id', 
    param('id').isInt().withMessage('Invalid appointment ID'),
    validateAppointment,
    updateAppointment
);
router.delete('/appointments/:id',
    param('id').isInt().withMessage('Invalid appointment ID'),
    cancelAppointment
);
router.get('/availability/times',
    query('calendarId').isInt().withMessage('Calendar ID must be an integer'),
    query('date').isISO8601().withMessage('Invalid date format'),
    getAvailableTimes
);
router.get('/calendars', getCalendars);
router.get('/appointment-types', getAppointmentTypes);

export default router;
