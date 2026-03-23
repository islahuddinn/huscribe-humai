import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    // OAuth
    getAuthUrl,
    handleOAuthCallback,
    refreshToken,
    
    // Contacts
    createContact,
    getContacts,
    getContactById,
    updateContact,
    deleteContact,
    
    // Deals
    createDeal,
    getDeals,
    getDealById,
    updateDeal,
    deleteDeal,
    
    // Companies
    createCompany,
    getCompanies,
    getCompanyById,
    updateCompany,
    deleteCompany,
    
    // Tasks
    createTask,
    getTasks,
    
    // Appointments
    createAppointment,
    getAppointments,
    
    // Search
    searchContacts,
    searchDeals,
    searchCompanies
} from '../controllers/freshSalesController.js';

const router = express.Router();

// OAuth Routes
router.get('/auth/url', getAuthUrl);
router.get('/auth/callback', handleOAuthCallback);
router.post('/auth/refresh', refreshToken);

// Contact Routes
router.post('/contacts', protect, createContact);
router.get('/contacts', protect, getContacts);
router.get('/contacts/:id', protect, getContactById);
router.put('/contacts/:id', protect, updateContact);
router.delete('/contacts/:id', protect, deleteContact);

// Deal Routes
router.post('/deals', protect, createDeal);
router.get('/deals', protect, getDeals);
router.get('/deals/:id', protect, getDealById);
router.put('/deals/:id', protect, updateDeal);
router.delete('/deals/:id', protect, deleteDeal);

// Company Routes
router.post('/companies', protect, createCompany);
router.get('/companies', protect, getCompanies);
router.get('/companies/:id', protect, getCompanyById);
router.put('/companies/:id', protect, updateCompany);
router.delete('/companies/:id', protect, deleteCompany);

// Task Routes
router.post('/tasks', protect, createTask);
router.get('/tasks', protect, getTasks);

// Appointment Routes
router.post('/appointments', protect, createAppointment);
router.get('/appointments', protect, getAppointments);

// Search Routes
router.get('/search/contacts', protect, searchContacts);
router.get('/search/deals', protect, searchDeals);
router.get('/search/companies', protect, searchCompanies);

export default router;
