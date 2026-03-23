import express from "express";
import passport from "passport";

import {
  login,
  register,
  adminPortalDashboard,
  verifyRegistrationOTP,
  forgotPassword,
  updatePassword,
  updateUserDetails,
  deleteUser,
  getSpecificUser,
  sendResetOTP,
  getUsers,
  getConversations,
  updateHash,
  checkUserExists,
  changePassword,
  getAylaConversations,
  checkPlanAndQuota,
  getAdminUsersList,
  updateUserStatus,
  getUserTokenUsage,
  updateFcmToken,
  socialLogin,
  // New account management functions
  getUserProfile,
  updateUserProfile,
  updateProfilePicture,
  changeEmail,
  resetPassword,
  getSecuritySettings,
  removeDevice,
  getUsageStats,
  updateNotificationPreferences,
  getNotificationPreferences,
  getPrivacySettings,
  deactivateAccount,
  requestDataExport,
  testProfileUpdate,
  microsoftLogin
} from "../controllers/userController.js";
import { protect, restrictTo, googleAuth } from "../controllers/authController.js";
const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/social-login", socialLogin);
router.post("/microsoft-login", microsoftLogin);
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/google/callback", passport.authenticate("google", { session: false }), googleAuth);


router.post("/forgotPassword", forgotPassword);
router.post("/check-exists", checkUserExists);
router.post("/verifyRegistrationOTP", verifyRegistrationOTP);
router.put("/updatePassword", updatePassword);
router.get('/token-usage/:user_id?', getUserTokenUsage);
router.post("/sendResetOTP", sendResetOTP);
router.get("/getUsers", getUsers);
router.delete("/deleteUserAdmin", deleteUser);

// Protected routes - require authentication
router.use(protect);

// Account Management Routes
// Profile Management
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.put('/profile-picture', updateProfilePicture);

// Security & Authentication
router.put('/change-email', changeEmail);
router.put('/reset-password', resetPassword);
router.get('/security', getSecuritySettings);
router.delete('/devices/:device', removeDevice);

// Usage & Statistics
router.get('/usage-stats', getUsageStats);

// Preferences & Settings
router.get('/notifications', getNotificationPreferences);
router.put('/notifications', updateNotificationPreferences);
router.get('/privacy', getPrivacySettings);

// Account Actions
router.put('/deactivate', deactivateAccount);
router.post('/export-data', requestDataExport);

// Test endpoint (for debugging)
router.post('/test-profile-update', testProfileUpdate);

// FCM token route (protected)
router.post('/fcm-token', updateFcmToken);

// Legacy routes (keeping for backward compatibility)
router.get("/getConversations", getConversations);
router.get("/getAylaConversations", getAylaConversations);
router.delete("/deleteUser", deleteUser);
router.get("/getSpecificUser", getSpecificUser);
router.put("/updateUserDetails", updateUserDetails);
router.post('/updateHash', updateHash);
router.put('/change-password', changePassword);
router.get('/check-plan-quota', checkPlanAndQuota);

// Admin routes - require admin access
router.use('/admin', restrictTo('admin'));
router.get('/admin/dashboard', adminPortalDashboard);
router.get('/admin/users', getAdminUsersList);
router.put('/admin/update-status', updateUserStatus);

export default router;
