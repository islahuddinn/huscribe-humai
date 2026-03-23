import express from 'express';
import {
    initiateLinkedInAuth,
    handleLinkedInCallback,
    searchLeads,
    getLeadDetails,
    saveLeadToList,
    getSavedLists
} from '../controllers/linkedinSalesNavController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Auth routes
router.get('/auth', initiateLinkedInAuth);
router.get('/callback', handleLinkedInCallback);

// Protected routes
router.use(protect);
router.post('/search', searchLeads);
router.get('/leads/:leadId', getLeadDetails);
router.post('/lists/save-lead', saveLeadToList);
router.get('/lists', getSavedLists);

export default router;
