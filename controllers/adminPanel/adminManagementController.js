import bcrypt from 'bcryptjs';
import User from '../../models/userModel.js';
import generateAdminToken from '../../utils/generateAdminToken.js';
import catchAsync from '../../utils/catchAsync.js';
import { AppError } from '../../utils/appError.js';

// @desc    Create new admin user
// @route   POST /api/admin/management/create-admin
// @access  Super Admin
export const createAdminUser = catchAsync(async (req, res, next) => {
  const { email, password, first_name, last_name, permissions } = req.body;

  // 1) Validate required fields
  if (!email || !password || !first_name || !last_name) {
    return next(new AppError('Please provide email, password, first name, and last name', 400));
  }

  // 2) Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new AppError('Please provide a valid email address', 400));
  }

  // 3) Validate password strength
  if (password.length < 8) {
    return next(new AppError('Password must be at least 8 characters long', 400));
  }

  // 4) Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    if (existingUser.isAdmin) {
      return next(new AppError('Admin user with this email already exists', 400));
    } else {
      // Update existing user to admin
      existingUser.isAdmin = true;
      existingUser.status = 'active';
      existingUser.email_verified = true;
      if (permissions) {
        existingUser.admin_permissions = permissions;
      }
      await existingUser.save();

      // Log admin creation
      console.log(`[ADMIN CREATED] ${new Date().toISOString()} - New Admin: ${existingUser.email} (${existingUser._id}) - Created by: ${req.user.email} (${req.user._id}) - IP: ${req.ip}`);

      return res.status(200).json({
        status: 'ok',
        message: 'Existing user promoted to admin successfully',
        data: {
          admin: {
            _id: existingUser._id,
            first_name: existingUser.first_name,
            last_name: existingUser.last_name,
            email: existingUser.email,
            isAdmin: existingUser.isAdmin,
            status: existingUser.status,
            createdAt: existingUser.createdAt,
            admin_permissions: existingUser.admin_permissions
          }
        }
      });
    }
  }

  // 5) Hash password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // 6) Create new admin user
  const newAdmin = new User({
    first_name,
    last_name,
    email,
    password: hashedPassword,
    isAdmin: true,
    status: 'active',
    email_verified: true,
    subscription_status: 'active',
    current_plan: 'premium',
    subscription_start_date: new Date(),
    subscription_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    additional_voices: 10,
    additional_meetings: 100,
    admin_permissions: permissions || ['users', 'subscriptions', 'analytics']
  });

  await newAdmin.save();

  // 7) Remove password from response
  newAdmin.password = undefined;

  // 8) Log admin creation
  console.log(`[ADMIN CREATED] ${new Date().toISOString()} - New Admin: ${newAdmin.email} (${newAdmin._id}) - Created by: ${req.user.email} (${req.user._id}) - IP: ${req.ip}`);

  res.status(201).json({
    status: 'ok',
    message: 'Admin user created successfully',
    data: {
      admin: {
        _id: newAdmin._id,
        first_name: newAdmin.first_name,
        last_name: newAdmin.last_name,
        email: newAdmin.email,
        isAdmin: newAdmin.isAdmin,
        status: newAdmin.status,
        createdAt: newAdmin.createdAt,
        admin_permissions: newAdmin.admin_permissions
      }
    }
  });
});

// @desc    Get all admin users
// @route   GET /api/admin/management/admins
// @access  Super Admin
export const getAllAdmins = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Build filter for admin users only
  const filter = { isAdmin: true };

  // Add search functionality
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    filter.$or = [
      { first_name: searchRegex },
      { last_name: searchRegex },
      { email: searchRegex }
    ];
  }

  // Add status filter
  if (req.query.status) {
    filter.status = req.query.status;
  }

  // Get admins with pagination
  const admins = await User.find(filter)
    .select('-password -token')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Get total count for pagination
  const totalAdmins = await User.countDocuments(filter);
  const totalPages = Math.ceil(totalAdmins / limit);

  res.status(200).json({
    status: 'ok',
    data: {
      admins,
      pagination: {
        currentPage: page,
        totalPages,
        totalAdmins,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  });
});

// @desc    Update admin permissions
// @route   PATCH /api/admin/management/admins/:id/permissions
// @access  Super Admin
export const updateAdminPermissions = catchAsync(async (req, res, next) => {
  const { permissions } = req.body;
  const adminId = req.params.id;

  if (!permissions || !Array.isArray(permissions)) {
    return next(new AppError('Please provide valid permissions array', 400));
  }

  // Find admin user
  const admin = await User.findById(adminId);
  if (!admin) {
    return next(new AppError('Admin user not found', 404));
  }

  if (!admin.isAdmin) {
    return next(new AppError('User is not an admin', 400));
  }

  // Prevent self-permission modification
  if (admin._id.toString() === req.user._id.toString()) {
    return next(new AppError('Cannot modify your own permissions', 400));
  }

  // Update permissions
  admin.admin_permissions = permissions;
  await admin.save();

  // Log permission change
  console.log(`[ADMIN PERMISSIONS UPDATED] ${new Date().toISOString()} - Admin: ${admin.email} (${admin._id}) - New Permissions: ${permissions.join(', ')} - Updated by: ${req.user.email} (${req.user._id}) - IP: ${req.ip}`);

  res.status(200).json({
    status: 'ok',
    message: 'Admin permissions updated successfully',
    data: {
      admin: {
        _id: admin._id,
        first_name: admin.first_name,
        last_name: admin.last_name,
        email: admin.email,
        admin_permissions: admin.admin_permissions
      }
    }
  });
});

// @desc    Revoke admin privileges
// @route   PATCH /api/admin/management/admins/:id/revoke
// @access  Super Admin
export const revokeAdminPrivileges = catchAsync(async (req, res, next) => {
  const adminId = req.params.id;

  // Find admin user
  const admin = await User.findById(adminId);
  if (!admin) {
    return next(new AppError('Admin user not found', 404));
  }

  if (!admin.isAdmin) {
    return next(new AppError('User is not an admin', 400));
  }

  // Prevent self-revocation
  if (admin._id.toString() === req.user._id.toString()) {
    return next(new AppError('Cannot revoke your own admin privileges', 400));
  }

  // Revoke admin privileges
  admin.isAdmin = false;
  admin.admin_permissions = [];
  admin.token = null; // Invalidate current sessions
  await admin.save();

  // Log admin revocation
  console.log(`[ADMIN REVOKED] ${new Date().toISOString()} - Admin Revoked: ${admin.email} (${admin._id}) - Revoked by: ${req.user.email} (${req.user._id}) - IP: ${req.ip}`);

  res.status(200).json({
    status: 'ok',
    message: 'Admin privileges revoked successfully',
    data: {
      user: {
        _id: admin._id,
        first_name: admin.first_name,
        last_name: admin.last_name,
        email: admin.email,
        isAdmin: admin.isAdmin,
        status: admin.status
      }
    }
  });
});

// @desc    Get admin activity logs
// @route   GET /api/admin/management/activity-logs
// @access  Super Admin
export const getAdminActivityLogs = catchAsync(async (req, res, next) => {
  // This is a placeholder for admin activity logging
  // In a production environment, you would implement proper logging to a database
  
  res.status(200).json({
    status: 'ok',
    message: 'Admin activity logs feature coming soon',
    data: {
      logs: [],
      note: 'Currently logs are written to console. Implement database logging for production.'
    }
  });
});

// @desc    Get admin statistics
// @route   GET /api/admin/management/stats
// @access  Admin
export const getAdminStats = catchAsync(async (req, res, next) => {
  // Get admin statistics
  const totalAdmins = await User.countDocuments({ isAdmin: true });
  const activeAdmins = await User.countDocuments({ isAdmin: true, status: 'active' });
  const suspendedAdmins = await User.countDocuments({ isAdmin: true, status: 'suspended' });
  
  // Get recent admin activities (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentAdmins = await User.countDocuments({ 
    isAdmin: true, 
    createdAt: { $gte: thirtyDaysAgo } 
  });

  res.status(200).json({
    status: 'ok',
    data: {
      stats: {
        total_admins: totalAdmins,
        active_admins: activeAdmins,
        suspended_admins: suspendedAdmins,
        recent_admins: recentAdmins,
        admin_activity_rate: totalAdmins > 0 ? ((activeAdmins / totalAdmins) * 100).toFixed(2) : 0
      },
      timestamp: new Date().toISOString()
    }
  });
}); 