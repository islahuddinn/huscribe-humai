import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import generateAdminToken from '../utils/generateAdminToken.js';
import catchAsync from '../utils/catchAsync.js';
import { AppError } from '../utils/appError.js';

// @desc    Admin login
// @route   POST /api/admin/auth/login
// @access  Public
export const adminLogin = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  // 2) Check if user exists and is admin
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new AppError('Invalid admin credentials', 401));
  }

  // 3) Check if user is admin
  if (!user.isAdmin) {
    return next(new AppError('Access denied. Admin privileges required.', 403));
  }

  // 4) Check if user account is active
  if (user.status === 'suspended') {
    return next(new AppError('Admin account is suspended. Contact system administrator.', 403));
  }

  if (user.status === 'inactive') {
    return next(new AppError('Admin account is inactive. Contact system administrator.', 403));
  }

  // 5) Check if password is correct
  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    return next(new AppError('Invalid admin credentials', 401));
  }

  // 6) Generate admin token
  const adminToken = generateAdminToken(user._id);

  // 7) Update user's token in database (optional)
  user.token = adminToken;
  await user.save({ validateBeforeSave: false });

  // 8) Remove password from output
  user.password = undefined;

  // 9) Log admin login
  console.log(`[ADMIN LOGIN] ${new Date().toISOString()} - Admin: ${user.email} (${user._id}) - IP: ${req.ip}`);

  res.status(200).json({
    status: 'ok',
    message: 'Admin login successful',
    data: {
      user: {
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        isAdmin: user.isAdmin,
        status: user.status,
        createdAt: user.createdAt
      },
      adminToken,
      tokenType: 'admin',
      expiresIn: '7d'
    }
  });
});

// @desc    Admin logout
// @route   POST /api/admin/auth/logout
// @access  Admin
export const adminLogout = catchAsync(async (req, res, next) => {
  // Clear the token from database
  const user = await User.findById(req.user._id);
  if (user) {
    user.token = null;
    await user.save({ validateBeforeSave: false });
  }

  // Log admin logout
  console.log(`[ADMIN LOGOUT] ${new Date().toISOString()} - Admin: ${req.user.email} (${req.user._id}) - IP: ${req.ip}`);

  res.status(200).json({
    status: 'ok',
    message: 'Admin logout successful'
  });
});

// @desc    Get current admin user
// @route   GET /api/admin/auth/me
// @access  Admin
export const getCurrentAdmin = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('-password -token');

  if (!user) {
    return next(new AppError('Admin user not found', 404));
  }

  if (!user.isAdmin) {
    return next(new AppError('User is no longer an admin', 403));
  }

  res.status(200).json({
    status: 'ok',
    data: {
      user: {
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        isAdmin: user.isAdmin,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    }
  });
});

// @desc    Refresh admin token
// @route   POST /api/admin/auth/refresh
// @access  Admin
export const refreshAdminToken = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new AppError('Admin user not found', 404));
  }

  if (!user.isAdmin) {
    return next(new AppError('User is no longer an admin', 403));
  }

  if (user.status !== 'active') {
    return next(new AppError('Admin account is not active', 403));
  }

  // Generate new admin token
  const newAdminToken = generateAdminToken(user._id);

  // Update token in database
  user.token = newAdminToken;
  await user.save({ validateBeforeSave: false });

  // Log token refresh
  console.log(`[ADMIN TOKEN REFRESH] ${new Date().toISOString()} - Admin: ${user.email} (${user._id}) - IP: ${req.ip}`);

  res.status(200).json({
    status: 'ok',
    message: 'Admin token refreshed successfully',
    data: {
      adminToken: newAdminToken,
      tokenType: 'admin',
      expiresIn: '7d'
    }
  });
});

// @desc    Change admin password
// @route   PATCH /api/admin/auth/change-password
// @access  Admin
export const changeAdminPassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // 1) Validate input
  if (!currentPassword || !newPassword || !confirmPassword) {
    return next(new AppError('Please provide current password, new password, and confirm password', 400));
  }

  if (newPassword !== confirmPassword) {
    return next(new AppError('New password and confirm password do not match', 400));
  }

  if (newPassword.length < 6) {
    return next(new AppError('New password must be at least 6 characters long', 400));
  }

  // 2) Get user with password
  const user = await User.findById(req.user._id).select('+password');

  if (!user) {
    return next(new AppError('Admin user not found', 404));
  }

  // 3) Check current password
  const isCurrentPasswordCorrect = await bcrypt.compare(currentPassword, user.password);

  if (!isCurrentPasswordCorrect) {
    return next(new AppError('Current password is incorrect', 400));
  }

  // 4) Hash new password
  const saltRounds = 12;
  const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

  // 5) Update password
  user.password = hashedNewPassword;
  await user.save();

  // 6) Generate new admin token (invalidate old sessions)
  const newAdminToken = generateAdminToken(user._id);
  user.token = newAdminToken;
  await user.save({ validateBeforeSave: false });

  // Log password change
  console.log(`[ADMIN PASSWORD CHANGE] ${new Date().toISOString()} - Admin: ${user.email} (${user._id}) - IP: ${req.ip}`);

  res.status(200).json({
    status: 'ok',
    message: 'Admin password changed successfully',
    data: {
      adminToken: newAdminToken,
      tokenType: 'admin',
      expiresIn: '7d'
    }
  });
}); 