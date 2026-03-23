import express from 'express';
import {
  createAdminUser,
  getAllAdmins,
  updateAdminPermissions,
  revokeAdminPrivileges,
  getAdminActivityLogs,
  getAdminStats
} from '../../controllers/adminPanel/adminManagementController.js';
import { requireSuperAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

// Admin statistics (available to all admins)
router.get('/stats', getAdminStats);

// Super admin only routes
router.use(requireSuperAdmin); // Apply super admin restriction to routes below

// Admin management routes
router.post('/create-admin', createAdminUser);
router.get('/admins', getAllAdmins);
router.patch('/admins/:id/permissions', updateAdminPermissions);
router.patch('/admins/:id/revoke', revokeAdminPrivileges);
router.get('/activity-logs', getAdminActivityLogs);

export default router; 