import express from 'express';
import {
    handleSalesforceCallback,
    refreshSalesforceToken,
    revokeSalesforceTokens
} from '../controllers/salesforceAuthController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/callback', handleSalesforceCallback);

// Protected routes
router.post('/refresh', protect, refreshSalesforceToken);
router.post('/revoke', protect, revokeSalesforceTokens);

export default router;