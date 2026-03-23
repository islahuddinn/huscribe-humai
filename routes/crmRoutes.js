import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  provisionTenant,
  getTenantStatus,
  listTenants,
  getSystemStatus
} from '../controllers/crmProvisionerController.js';

const router = express.Router();

// Provision new CRM tenant
router.post('/provision', protect, provisionTenant);

// Get tenant status
router.get('/tenant/:tenantId/status', protect, getTenantStatus);

// List user's tenants
router.get('/tenants', protect, listTenants);

// System status (for monitoring)
router.get('/system/status', protect, getSystemStatus);

export default router; 