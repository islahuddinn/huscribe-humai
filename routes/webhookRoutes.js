import express from 'express';
import { handleWebhook } from '../controllers/webhookController.js';

const router = express.Router();

// This route needs raw body for Stripe signature verification
router.post('/stripe', express.raw({ type: 'application/json' }), handleWebhook);

export default router;