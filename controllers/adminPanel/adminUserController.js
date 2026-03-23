import User from "../../models/userModel.js";
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";

// @desc    Get all users with pagination and filtering
// @route   GET /api/admin/users
// @access  Admin
const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      subscriptionStatus = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { first_name: { $regex: search, $options: 'i' } },
        { last_name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile_no: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (subscriptionStatus) {
      filter.subscriptionStatus = subscriptionStatus;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get users with pagination
    const users = await User.find(filter)
      .populate('currentPlan', 'name price features')
      .select('-password -otp_code')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    // Get token usage for each user
    const UserTokenTotalsCollection = mongoose.connection.collection('user_token_totals');
    
    const enhancedUsers = await Promise.all(users.map(async (user) => {
      // Get token usage
      const tokenAggregation = await UserTokenTotalsCollection.aggregate([
        { $match: { user_id: user._id } },
        {
          $group: {
            _id: null,
            total_input_tokens: { $sum: "$input_tokens" },
            total_output_tokens: { $sum: "$output_tokens" },
            total_tokens: { $sum: "$total_tokens" }
          }
        }
      ]).toArray();

      const tokenUsage = tokenAggregation.length > 0 ? {
        total_input_tokens: tokenAggregation[0].total_input_tokens || 0,
        total_output_tokens: tokenAggregation[0].total_output_tokens || 0,
        total_tokens: tokenAggregation[0].total_tokens || 0
      } : {
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_tokens: 0
      };

      // Calculate subscription info
      const hasActiveSubscription = user.subscriptionStatus === 'active' ||
        (user.subscriptionStatus === 'cancelled' &&
          user.subscriptionEndsAt &&
          new Date(user.subscriptionEndsAt) > new Date());

      const isInTrial = user.trialEndsAt && new Date(user.trialEndsAt) > new Date();

      return {
        ...user,
        hasActiveSubscription,
        isInTrial,
        tokenUsage,
        fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim()
      };
    }));

    res.status(200).json({
      status: 'ok',
      data: {
        users: enhancedUsers,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        filters: {
          search,
          status,
          subscriptionStatus,
          sortBy,
          sortOrder
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Get single user by ID
// @route   GET /api/admin/users/:id
// @access  Admin
const getUserById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(id)
      .populate('currentPlan', 'name price features')
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get token usage
    const UserTokenTotalsCollection = mongoose.connection.collection('user_token_totals');
    const tokenAggregation = await UserTokenTotalsCollection.aggregate([
      { $match: { user_id: user._id } },
      {
        $group: {
          _id: null,
          total_input_tokens: { $sum: "$input_tokens" },
          total_output_tokens: { $sum: "$output_tokens" },
          total_tokens: { $sum: "$total_tokens" }
        }
      }
    ]).toArray();

    const tokenUsage = tokenAggregation.length > 0 ? {
      total_input_tokens: tokenAggregation[0].total_input_tokens || 0,
      total_output_tokens: tokenAggregation[0].total_output_tokens || 0,
      total_tokens: tokenAggregation[0].total_tokens || 0
    } : {
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_tokens: 0
    };

    // Calculate subscription info
    const hasActiveSubscription = user.subscriptionStatus === 'active' ||
      (user.subscriptionStatus === 'cancelled' &&
        user.subscriptionEndsAt &&
        new Date(user.subscriptionEndsAt) > new Date());

    const isInTrial = user.trialEndsAt && new Date(user.trialEndsAt) > new Date();

    const enhancedUser = {
      ...user,
      hasActiveSubscription,
      isInTrial,
      tokenUsage,
      fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim()
    };

    res.status(200).json({
      status: 'ok',
      data: {
        user: enhancedUser
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Create new user
// @route   POST /api/admin/users
// @access  Admin
const createUser = asyncHandler(async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      mobile_no,
      address,
      dob,
      gender,
      company,
      language,
      notification_preferences,
      default_input_mode,
      status,
      isAdmin
    } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User with this email already exists'
      });
    }

    // Create user object
    const userData = {
      first_name,
      last_name,
      email,
      mobile_no,
      address,
      dob,
      gender,
      company,
      language: language || 'English',
      notification_preferences: notification_preferences || 'all',
      default_input_mode: default_input_mode || 'text',
      status: status || 'active',
      verified: 1, // Admin created users are verified by default
      isAdmin: isAdmin || false
    };

    // Add password if provided
    if (password) {
      userData.password = password;
    }

    const user = await User.create(userData);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      status: 'ok',
      message: 'User created successfully',
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Admin
const updateUser = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format'
      });
    }

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // If email is being updated, check for duplicates
    if (updateData.email) {
      const existingUser = await User.findOne({ 
        email: updateData.email,
        _id: { $ne: id }
      });
      
      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          message: 'Email already exists for another user'
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { 
        new: true,
        runValidators: true
      }
    ).populate('currentPlan', 'name price features').select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: 'ok',
      message: 'User updated successfully',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Admin
const deleteUser = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Prevent deletion of admin users by non-super-admin
    if (user.isAdmin && !req.user.isSuperAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Cannot delete admin users'
      });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      status: 'ok',
      message: 'User deleted successfully',
      data: {
        deletedUserId: id
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Update user status (activate/suspend/deactivate)
// @route   PATCH /api/admin/users/:id/status
// @access  Admin
const updateUserStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format'
      });
    }

    const validStatuses = ['active', 'suspended', 'inactive', 'deactivated'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status. Must be: active, suspended, inactive, or deactivated'
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    user.status = status;
    await user.save();

    res.status(200).json({
      status: 'ok',
      message: `User status updated to ${status}`,
      data: {
        userId: user._id,
        status: user.status,
        reason: reason || null
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Reset user password
// @route   PATCH /api/admin/users/:id/reset-password
// @access  Admin
const resetUserPassword = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format'
      });
    }

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters long'
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    user.password = new_password;
    await user.save();

    res.status(200).json({
      status: 'ok',
      message: 'Password reset successfully',
      data: {
        userId: user._id,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Get user statistics
// @route   GET /api/admin/users/stats
// @access  Admin
const getUserStats = asyncHandler(async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const suspendedUsers = await User.countDocuments({ status: 'suspended' });
    const inactiveUsers = await User.countDocuments({ status: 'inactive' });
    const deactivatedUsers = await User.countDocuments({ status: 'deactivated' });
    const verifiedUsers = await User.countDocuments({ verified: 1 });
    const unverifiedUsers = await User.countDocuments({ verified: 0 });
    const adminUsers = await User.countDocuments({ isAdmin: true });

    // Subscription statistics
    const activeSubscriptions = await User.countDocuments({ subscriptionStatus: 'active' });
    const cancelledSubscriptions = await User.countDocuments({ subscriptionStatus: 'cancelled' });
    const inactiveSubscriptions = await User.countDocuments({ subscriptionStatus: 'inactive' });

    // Recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRegistrations = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.status(200).json({
      status: 'ok',
      data: {
        userStats: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          inactive: inactiveUsers,
          deactivated: deactivatedUsers,
          verified: verifiedUsers,
          unverified: unverifiedUsers,
          admins: adminUsers,
          recentRegistrations
        },
        subscriptionStats: {
          active: activeSubscriptions,
          cancelled: cancelledSubscriptions,
          inactive: inactiveSubscriptions
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserStatus,
  resetUserPassword,
  getUserStats
}; 