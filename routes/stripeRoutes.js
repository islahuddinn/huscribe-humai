import express from 'express';
import {
  createCheckoutSession,
  handleStripeWebhook,
  purchaseAdditionalFeatures,
} from '../controllers/stripeController.js';

const router = express.Router();
///====checkout
router.post('/create-checkout-session', protect, createCheckoutSession);
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
router.post('/purchase-additional-features', protect, purchaseAdditionalFeatures);

export default router;