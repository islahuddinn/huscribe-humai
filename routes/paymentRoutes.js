import express from 'express';
import paymentController from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Subscription routes
router.post('/create-subscription', protect, paymentController.createSubscription);
router.post('/cancel-subscription/:subscriptionId', protect, paymentController.cancelSubscription);
router.get('/subscription/:userId?', protect, paymentController.getSubscription);
router.get('/plan-history/:userId?', protect, paymentController.getUserPlanHistory);

// IAP routes
router.get('/mobile-plans', paymentController.getMobilePlans);
router.post('/restore-purchases', protect, paymentController.restorePurchases);

// Usage tracking routes
router.post('/usage/voice', protect, paymentController.incrementVoiceUsage);
router.post('/usage/meeting', protect, paymentController.incrementMeetingUsage);
router.get('/feature/:featureName', protect, paymentController.checkFeatureAccess);

// Webhook route - no auth needed as it's called by Stripe
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// New detailed plan history route
router.get('/subscriptions-history/:userId?', protect, paymentController.getDetailedPlanHistory);

export default router; 