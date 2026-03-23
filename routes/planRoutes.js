import express from 'express';
import planController from '../controllers/planController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', planController.getPlans);
router.get('/:id', planController.getPlan);

// Admin routes (no auth for testing)
router.get('/admin', planController.getPlansForAdmin);
router.post('/', planController.createPlan);
router.put('/:id', planController.updatePlan);
router.delete('/:id', planController.deletePlan);

// Get user's current plan
router.get('/user/:userId', protect, planController.getUserCurrentPlan);

// Send plan quota exhaustion email
router.post('/quota-notification', protect, planController.sendPlanQuotaEmail);

export default router; 