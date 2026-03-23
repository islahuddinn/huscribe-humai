import express from "express";
import {
  createSubscription,
  getAllSubscriptions,
  getSubscriptionByUserId,
  updateSubscription,
  cancelSubscription,
  reactivateSubscription,
  extendSubscription,
  updateUserQuota,
  getSubscriptionStats,
  getExpiringSubscriptions
} from "../../controllers/adminPanel/adminSubscriptionController.js";

const router = express.Router();

// Statistics and special routes (should be before parameterized routes)
router.get('/stats', getSubscriptionStats);
router.get('/expiring', getExpiringSubscriptions);

// CRUD routes
router.route('/')
  .get(getAllSubscriptions)     // GET /api/admin/subscriptions - Get all subscriptions with pagination and filtering
  .post(createSubscription);    // POST /api/admin/subscriptions - Create new subscription

// User-specific subscription routes
router.route('/user/:userId')
  .get(getSubscriptionByUserId)  // GET /api/admin/subscriptions/user/:userId - Get single subscription
  .put(updateSubscription);      // PUT /api/admin/subscriptions/user/:userId - Update subscription

// Special action routes
router.put('/user/:userId/cancel', cancelSubscription);        // put /api/admin/subscriptions/user/:userId/cancel - Cancel subscription
router.put('/user/:userId/reactivate', reactivateSubscription); // put /api/admin/subscriptions/user/:userId/reactivate - Reactivate subscription
router.put('/user/:userId/extend', extendSubscription);        // put /api/admin/subscriptions/user/:userId/extend - Extend subscription
router.put('/user/:userId/quota', updateUserQuota);            // put /api/admin/subscriptions/user/:userId/quota - Update user quota

export default router; 