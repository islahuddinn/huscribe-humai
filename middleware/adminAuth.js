import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { AppError } from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';

// Admin authentication middleware
export const protectAdmin = catchAsync(async (req, res, next) => {
    // 1) Get token from header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new AppError('Admin access denied. Please log in with admin credentials.', 401));
    }

    try {
        // 2) Verify admin token
        const decoded = jwt.verify(token, process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET);

        // 3) Check if token is admin type
        if (!decoded.isAdmin || decoded.type !== 'admin') {
            return next(new AppError('Invalid admin token. Admin access required.', 403));
        }

        // 4) Check if user still exists
        const user = await User.findById(decoded.id);
        if (!user) {
            return next(new AppError('The admin user belonging to this token no longer exists.', 401));
        }

        // 5) Check if user is still admin
        if (!user.isAdmin) {
            return next(new AppError('User no longer has admin privileges.', 403));
        }

        // 6) Check if user account is active
        if (user.status === 'suspended' || user.status === 'inactive') {
            return next(new AppError('Admin account is suspended or inactive.', 403));
        }

        // Grant access to admin route
        req.user = user;
        req.adminToken = token;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(new AppError('Invalid admin token. Please log in again.', 401));
        } else if (error.name === 'TokenExpiredError') {
            return next(new AppError('Admin token has expired. Please log in again.', 401));
        }
        return next(new AppError('Admin authentication failed.', 401));
    }
});

// Middleware to ensure super admin access (for sensitive operations)
export const requireSuperAdmin = catchAsync(async (req, res, next) => {
    // This can be extended to check for super admin role if needed
    // For now, we'll use the same admin check
    if (!req.user || !req.user.isAdmin) {
        return next(new AppError('Super admin access required for this operation.', 403));
    }
    next();
});

// Middleware to log admin actions (optional)
export const logAdminAction = (action) => {
    return (req, res, next) => {
        // Log admin action for audit trail
        console.log(`[ADMIN ACTION] ${new Date().toISOString()} - User: ${req.user?.email} (${req.user?._id}) - Action: ${action} - IP: ${req.ip}`);
        next();
    };
}; 