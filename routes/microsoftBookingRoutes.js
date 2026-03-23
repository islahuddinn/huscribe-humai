import express from 'express';
// import { protect } from '../middleware/authMiddleware.js';
import {
    getBookingBusinesses,
    getBookingAppointments,
    createBookingAppointment,
    updateBookingAppointment,
    deleteBookingAppointment,
    getBookingCustomers,
    getBookingServices,
    getBookingStaff,
    testAuth,
    diagnosticCheck, 
    getBookingAppointmentById,
    getAppointmentsDashboard,
    getBookingBusinessDetails,
    createBookingBusiness,
    publishBookingBusiness
} from '../controllers/microsoftBookingController.js';

const router = express.Router();

////// Booking Business routes
router.get('/businesses', getBookingBusinesses);

//// Get detailed information for a specific business
router.get('/businesses/:businessId', getBookingBusinessDetails);

//// Appointment routes
router.get('/appointments',  getBookingAppointments);
router.post('/appointments/create',  createBookingAppointment);
router.put('/appointments/:appointmentId', updateBookingAppointment);
router.delete('/appointments/:appointmentId', deleteBookingAppointment);

// Get specific appointment
router.get('/appointments/:businessId/:appointmentId', getBookingAppointmentById);

// Get dashboard summary
router.get('/dashboard', getAppointmentsDashboard);

// Other booking related routes
router.get('/customers', getBookingCustomers);
router.get('/services', getBookingServices);
router.get('/staff', getBookingStaff);

// Test authentication
router.get('/test-auth', testAuth);

router.get('/diagnostic', diagnosticCheck);

/// business creation routes
router.post('/businesses/create', createBookingBusiness);
router.post('/businesses/:businessId/publish', publishBookingBusiness);

export default router;
