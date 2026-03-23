import express from "express";
import adminUserRoutes from "./adminUserRoutes.js";
import adminSubscriptionRoutes from "./adminSubscriptionRoutes.js";
import adminAuthRoutes from "./adminAuthRoutes.js";
import adminManagementRoutes from "./adminManagementRoutes.js";
import { protectAdmin } from "../../middleware/adminAuth.js";

const router = express.Router();

// Admin authentication routes (public login + protected routes)
router.use('/auth', adminAuthRoutes);

// Apply admin authentication to all other admin routes
router.use(protectAdmin);

// Mount admin routes
router.use('/users', adminUserRoutes);
router.use('/subscriptions', adminSubscriptionRoutes);
router.use('/management', adminManagementRoutes);

// Admin panel health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Admin panel is operational',
    timestamp: new Date().toISOString(),
    admin: {
      id: req.user._id,
      email: req.user.email,
      isAdmin: req.user.isAdmin
    }
  });
});

export default router; 