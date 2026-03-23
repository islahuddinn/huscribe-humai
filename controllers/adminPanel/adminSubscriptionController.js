import User from "../../models/userModel.js";
import Plan from "../../models/planModel.js";
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";

// @desc    Get all subscriptions with pagination and filtering
// @route   GET /api/admin/subscriptions
// @access  Admin
const getAllSubscriptions = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      planType = '',
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
        { stripeCustomerId: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      filter.subscriptionStatus = status;
    }

    // Only include users with subscription data
    filter.$or = [
      { subscriptionStatus: { $exists: true, $ne: null } },
      { currentPlan: { $exists: true, $ne: null } },
      { stripeCustomerId: { $exists: true, $ne: null } }
    ];

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get subscriptions with pagination
    const subscriptions = await User.find(filter)
      .populate('currentPlan', 'name price features duration')
      .select('first_name last_name email subscriptionStatus currentPlan stripeCustomerId stripeSubscriptionId subscriptionEndsAt trialEndsAt createdAt updatedAt')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalSubscriptions = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalSubscriptions / parseInt(limit));

    // Enhance subscription data
    const enhancedSubscriptions = subscriptions.map(subscription => {
      const hasActiveSubscription = subscription.subscriptionStatus === 'active' ||
        (subscription.subscriptionStatus === 'cancelled' &&
          subscription.subscriptionEndsAt &&
          new Date(subscription.subscriptionEndsAt) > new Date());

      const isInTrial = subscription.trialEndsAt && new Date(subscription.trialEndsAt) > new Date();
      
      const daysUntilExpiry = subscription.subscriptionEndsAt 
        ? Math.ceil((new Date(subscription.subscriptionEndsAt) - new Date()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...subscription,
        hasActiveSubscription,
        isInTrial,
        daysUntilExpiry,
        fullName: `${subscription.first_name || ''} ${subscription.last_name || ''}`.trim()
      };
    });

    res.status(200).json({
      status: 'ok',
      data: {
        subscriptions: enhancedSubscriptions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalSubscriptions,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        filters: {
          search,
          status,
          planType,
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

// @desc    Get single subscription by user ID
// @route   GET /api/admin/subscriptions/:userId
// @access  Admin
const getSubscriptionByUserId = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId)
      .populate('currentPlan', 'name price features duration')
      .select('first_name last_name email subscriptionStatus currentPlan stripeCustomerId stripeSubscriptionId subscriptionEndsAt trialEndsAt additionalVoices additionalMeetings remainingVoices remainingMeetings usage createdAt updatedAt')
      .lean();

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Calculate subscription details
    const hasActiveSubscription = user.subscriptionStatus === 'active' ||
      (user.subscriptionStatus === 'cancelled' &&
        user.subscriptionEndsAt &&
        new Date(user.subscriptionEndsAt) > new Date());

    const isInTrial = user.trialEndsAt && new Date(user.trialEndsAt) > new Date();
    
    const daysUntilExpiry = user.subscriptionEndsAt 
      ? Math.ceil((new Date(user.subscriptionEndsAt) - new Date()) / (1000 * 60 * 60 * 24))
      : null;

    const enhancedSubscription = {
      ...user,
      hasActiveSubscription,
      isInTrial,
      daysUntilExpiry,
      fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim()
    };

    res.status(200).json({
      status: 'ok',
      data: {
        subscription: enhancedSubscription
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Update user subscription
// @route   PUT /api/admin/subscriptions/:userId
// @access  Admin
const updateSubscription = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      subscriptionStatus,
      currentPlan,
      subscriptionEndsAt,
      trialEndsAt,
      additionalVoices,
      additionalMeetings,
      remainingVoices,
      remainingMeetings
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Build update object
    const updateData = {};
    if (subscriptionStatus !== undefined) updateData.subscriptionStatus = subscriptionStatus;
    if (currentPlan !== undefined) updateData.currentPlan = currentPlan;
    if (subscriptionEndsAt !== undefined) updateData.subscriptionEndsAt = subscriptionEndsAt;
    if (trialEndsAt !== undefined) updateData.trialEndsAt = trialEndsAt;
    if (additionalVoices !== undefined) updateData.additionalVoices = additionalVoices;
    if (additionalMeetings !== undefined) updateData.additionalMeetings = additionalMeetings;
    if (remainingVoices !== undefined) updateData.remainingVoices = remainingVoices;
    if (remainingMeetings !== undefined) updateData.remainingMeetings = remainingMeetings;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { 
        new: true,
        runValidators: true
      }
    ).populate('currentPlan', 'name price features duration').select('-password');

    res.status(200).json({
      status: 'ok',
      message: 'Subscription updated successfully',
      data: {
        subscription: updatedUser
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Cancel user subscription
// @route   PATCH /api/admin/subscriptions/:userId/cancel
// @access  Admin
const cancelSubscription = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, immediateCancel = false } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Update subscription status
    if (immediateCancel) {
      user.subscriptionStatus = 'cancelled';
      user.subscriptionEndsAt = new Date();
    } else {
      user.subscriptionStatus = 'cancelled';
      // Keep existing end date for grace period
    }

    await user.save();

    res.status(200).json({
      status: 'ok',
      message: 'Subscription cancelled successfully',
      data: {
        userId: user._id,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndsAt: user.subscriptionEndsAt,
        reason: reason || null,
        immediateCancel
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Reactivate user subscription
// @route   PATCH /api/admin/subscriptions/:userId/reactivate
// @access  Admin
const reactivateSubscription = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const { newEndDate, planId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Update subscription
    user.subscriptionStatus = 'active';
    if (newEndDate) user.subscriptionEndsAt = new Date(newEndDate);
    if (planId) user.currentPlan = planId;

    await user.save();

    const updatedUser = await User.findById(userId)
      .populate('currentPlan', 'name price features duration')
      .select('-password');

    res.status(200).json({
      status: 'ok',
      message: 'Subscription reactivated successfully',
      data: {
        subscription: updatedUser
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Extend user subscription
// @route   PATCH /api/admin/subscriptions/:userId/extend
// @access  Admin
const extendSubscription = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const { extensionDays, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format'
      });
    }

    if (!extensionDays || extensionDays <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Extension days must be a positive number'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Calculate new end date
    const currentEndDate = user.subscriptionEndsAt || new Date();
    const newEndDate = new Date(currentEndDate);
    newEndDate.setDate(newEndDate.getDate() + parseInt(extensionDays));

    user.subscriptionEndsAt = newEndDate;
    await user.save();

    res.status(200).json({
      status: 'ok',
      message: `Subscription extended by ${extensionDays} days`,
      data: {
        userId: user._id,
        previousEndDate: currentEndDate,
        newEndDate: newEndDate,
        extensionDays: parseInt(extensionDays),
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

// @desc    Update user quota (voices/meetings)
// @route   PATCH /api/admin/subscriptions/:userId/quota
// @access  Admin
const updateUserQuota = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      additionalVoices, 
      additionalMeetings, 
      remainingVoices, 
      remainingMeetings,
      resetUsage = false
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Update quota
    if (additionalVoices !== undefined) user.additionalVoices = additionalVoices;
    if (additionalMeetings !== undefined) user.additionalMeetings = additionalMeetings;
    if (remainingVoices !== undefined) user.remainingVoices = remainingVoices;
    if (remainingMeetings !== undefined) user.remainingMeetings = remainingMeetings;

    // Reset usage if requested
    if (resetUsage) {
      user.usage.voicesUsed = 0;
      user.usage.meetingsUsed = 0;
      user.usage.lastResetDate = new Date();
    }

    await user.save();

    res.status(200).json({
      status: 'ok',
      message: 'User quota updated successfully',
      data: {
        userId: user._id,
        additionalVoices: user.additionalVoices,
        additionalMeetings: user.additionalMeetings,
        remainingVoices: user.remainingVoices,
        remainingMeetings: user.remainingMeetings,
        usage: user.usage,
        resetUsage
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Get subscription statistics
// @route   GET /api/admin/subscriptions/stats
// @access  Admin
const getSubscriptionStats = asyncHandler(async (req, res) => {
  try {
    // Basic subscription counts
    const totalSubscriptions = await User.countDocuments({
      $or: [
        { subscriptionStatus: { $exists: true, $ne: null } },
        { currentPlan: { $exists: true, $ne: null } }
      ]
    });

    const activeSubscriptions = await User.countDocuments({ subscriptionStatus: 'active' });
    const cancelledSubscriptions = await User.countDocuments({ subscriptionStatus: 'cancelled' });
    const inactiveSubscriptions = await User.countDocuments({ subscriptionStatus: 'inactive' });
    const pastDueSubscriptions = await User.countDocuments({ subscriptionStatus: 'past_due' });

    // Trial statistics
    const usersInTrial = await User.countDocuments({
      trialEndsAt: { $gt: new Date() }
    });

    const expiredTrials = await User.countDocuments({
      trialEndsAt: { $lt: new Date(), $ne: null }
    });

    // Subscription expiry analysis
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringIn30Days = await User.countDocuments({
      subscriptionEndsAt: { 
        $gte: new Date(), 
        $lte: thirtyDaysFromNow 
      },
      subscriptionStatus: { $in: ['active', 'cancelled'] }
    });

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiringIn7Days = await User.countDocuments({
      subscriptionEndsAt: { 
        $gte: new Date(), 
        $lte: sevenDaysFromNow 
      },
      subscriptionStatus: { $in: ['active', 'cancelled'] }
    });

    // Revenue analysis (if you have plan pricing)
    const planStats = await User.aggregate([
      {
        $match: {
          currentPlan: { $exists: true, $ne: null },
          subscriptionStatus: 'active'
        }
      },
      {
        $lookup: {
          from: 'plans',
          localField: 'currentPlan',
          foreignField: '_id',
          as: 'planDetails'
        }
      },
      {
        $unwind: '$planDetails'
      },
      {
        $group: {
          _id: '$planDetails.name',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$planDetails.price' }
        }
      }
    ]);

    // Recent subscription activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSubscriptions = await User.countDocuments({
      subscriptionStatus: 'active',
      createdAt: { $gte: thirtyDaysAgo }
    });

    const recentCancellations = await User.countDocuments({
      subscriptionStatus: 'cancelled',
      updatedAt: { $gte: thirtyDaysAgo }
    });

    // Churn rate calculation
    const churnRate = totalSubscriptions > 0 
      ? ((recentCancellations / totalSubscriptions) * 100).toFixed(2)
      : 0;

    res.status(200).json({
      status: 'ok',
      data: {
        subscriptionStats: {
          total: totalSubscriptions,
          active: activeSubscriptions,
          cancelled: cancelledSubscriptions,
          inactive: inactiveSubscriptions,
          pastDue: pastDueSubscriptions
        },
        trialStats: {
          inTrial: usersInTrial,
          expiredTrials: expiredTrials
        },
        expiryStats: {
          expiringIn7Days: expiringIn7Days,
          expiringIn30Days: expiringIn30Days
        },
        planDistribution: planStats,
        recentActivity: {
          newSubscriptions: recentSubscriptions,
          cancellations: recentCancellations,
          churnRate: parseFloat(churnRate)
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

// @desc    Get expiring subscriptions
// @route   GET /api/admin/subscriptions/expiring
// @access  Admin
const getExpiringSubscriptions = asyncHandler(async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + parseInt(days));

    const expiringSubscriptions = await User.find({
      subscriptionEndsAt: { 
        $gte: new Date(), 
        $lte: targetDate 
      },
      subscriptionStatus: { $in: ['active', 'cancelled'] }
    })
    .populate('currentPlan', 'name price')
    .select('first_name last_name email subscriptionStatus subscriptionEndsAt currentPlan')
    .sort({ subscriptionEndsAt: 1 })
    .lean();

    const enhancedSubscriptions = expiringSubscriptions.map(sub => {
      const daysUntilExpiry = Math.ceil((new Date(sub.subscriptionEndsAt) - new Date()) / (1000 * 60 * 60 * 24));
      return {
        ...sub,
        daysUntilExpiry,
        fullName: `${sub.first_name || ''} ${sub.last_name || ''}`.trim()
      };
    });

    res.status(200).json({
      status: 'ok',
      data: {
        expiringSubscriptions: enhancedSubscriptions,
        count: enhancedSubscriptions.length,
        daysFilter: parseInt(days)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Create subscription for a user
// @route   POST /api/admin/subscriptions
// @access  Admin
const createSubscription = asyncHandler(async (req, res) => {
  try {
    const {
      userId,
      planId,
      subscriptionStatus = 'active',
      subscriptionEndsAt,
      trialEndsAt,
      additionalVoices = 0,
      additionalMeetings = 0,
      stripeCustomerId,
      stripeSubscriptionId,
      notes
    } = req.body;

    // Validation
    if (!userId || !planId) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID and Plan ID are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid plan ID format'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check if plan exists
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        status: 'error',
        message: 'Plan not found'
      });
    }

    if (!plan.isActive) {
      return res.status(400).json({
        status: 'error',
        message: 'Selected plan is not active'
      });
    }

    // Check if user already has an active subscription
    if (user.subscriptionStatus === 'active' && user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > new Date()) {
      return res.status(400).json({
        status: 'error',
        message: 'User already has an active subscription. Use update endpoint to modify existing subscription.'
      });
    }

    // Calculate subscription end date if not provided
    let calculatedEndDate = subscriptionEndsAt;
    if (!calculatedEndDate) {
      calculatedEndDate = new Date();
      calculatedEndDate.setMonth(calculatedEndDate.getMonth() + 1); // Default to 1 month
    }

    // Set initial quota based on plan
    const remainingVoices = plan.features.voicesPerMonth + additionalVoices;
    const remainingMeetings = plan.features.meetingsPerMonth + additionalMeetings;

    // Update user subscription
    const updateData = {
      currentPlan: planId,
      subscriptionStatus,
      subscriptionEndsAt: new Date(calculatedEndDate),
      additionalVoices,
      additionalMeetings,
      remainingVoices,
      remainingMeetings,
      'usage.voicesUsed': 0,
      'usage.meetingsUsed': 0,
      'usage.lastResetDate': new Date()
    };

    if (trialEndsAt) {
      updateData.trialEndsAt = new Date(trialEndsAt);
    }

    if (stripeCustomerId) {
      updateData.stripeCustomerId = stripeCustomerId;
    }

    if (stripeSubscriptionId) {
      updateData.stripeSubscriptionId = stripeSubscriptionId;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { 
        new: true,
        runValidators: true
      }
    ).populate('currentPlan', 'name price features description').select('-password');

    // Log the subscription creation
    console.log(`Admin created subscription for user ${user.email} with plan ${plan.name}`);

    res.status(201).json({
      status: 'ok',
      message: 'Subscription created successfully',
      data: {
        subscription: {
          userId: updatedUser._id,
          userEmail: updatedUser.email,
          userName: `${updatedUser.first_name || ''} ${updatedUser.last_name || ''}`.trim(),
          plan: updatedUser.currentPlan,
          subscriptionStatus: updatedUser.subscriptionStatus,
          subscriptionEndsAt: updatedUser.subscriptionEndsAt,
          trialEndsAt: updatedUser.trialEndsAt,
          additionalVoices: updatedUser.additionalVoices,
          additionalMeetings: updatedUser.additionalMeetings,
          remainingVoices: updatedUser.remainingVoices,
          remainingMeetings: updatedUser.remainingMeetings,
          stripeCustomerId: updatedUser.stripeCustomerId,
          stripeSubscriptionId: updatedUser.stripeSubscriptionId,
          createdAt: new Date(),
          notes: notes || null
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
}; 