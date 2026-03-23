import express from 'express';
import {
    handleSalesforceCallback,
    refreshSalesforceToken,
    revokeSalesforceTokens,
    salesForceUserLogin,
    salesforceoAuth,
    oauthCallback,
    clearTokens,
    checkTokenStatus
} from '../controllers/salesforceAuthController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/login', salesForceUserLogin);
router.post('/callback', handleSalesforceCallback);

// OAuth routes
router.get('/oauth/authorize', salesforceoAuth);
router.get('/oauth/callback', oauthCallback);

// Token management routes
router.get('/refresh', refreshSalesforceToken);
router.post('/revoke', protect, revokeSalesforceTokens);

// Development testing route
    router.get('/clear-tokens', clearTokens);
    router.get('/token-status', checkTokenStatus);

export default router; 