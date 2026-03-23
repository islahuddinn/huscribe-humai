import express from 'express';
import {
  adminLogin,
  adminLogout,
  getCurrentAdmin,
  refreshAdminToken,
  changeAdminPassword
} from '../../controllers/adminAuthController.js';
import { protectAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/login', adminLogin);

// Protected routes (admin authentication required)
router.use(protectAdmin); // Apply admin authentication to all routes below

router.post('/logout', adminLogout);
router.get('/me', getCurrentAdmin);
router.post('/refresh', refreshAdminToken);
router.patch('/change-password', changeAdminPassword);

export default router; 