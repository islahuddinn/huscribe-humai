import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import VoiceMemo from '../models/voiceMemoModel.js';
import Meeting from '../models/meetingModel.js';
import Transcription from '../models/transcriptionModel.js';
import Summarization from '../models/summarizationModel.js';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Reusable function to send emails
const sendEmail = async (to, subject, html) => {
  const msg = {
    to,
    from: {
      email: process.env.EMAIL_FROM,
      name: "Huscribe Support"
    },
    subject,
    html
  };

  try {
    await sgMail.send(msg);
  } catch (error) {
    console.error('SendGrid Error:', error);
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

// @desc    Get comprehensive account overview
// @route   GET /api/users/account/overview
// @access  Private
const getAccountOverview = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('currentPlan', 'name features price')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get usage statistics
    const [voiceMemoCount, meetingCount, transcriptionCount, summarizationCount] = await Promise.all([
      VoiceMemo.countDocuments({ userId: user._id }),
      Meeting.countDocuments({ user_id: user._id }),
      Transcription.countDocuments({ user_id: user._id }),
      Summarization.countDocuments({ user_id: user._id })
    ]);

    // Calculate account metrics
    const accountMetrics = {
      totalVoiceMemos: voiceMemoCount,
      totalMeetings: meetingCount,
      totalTranscriptions: transcriptionCount,
      totalSummarizations: summarizationCount,
      accountAge: Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)), // days
      lastLogin: user.updatedAt
    };

    // Subscription info
    const subscriptionInfo = {
      hasActiveSubscription: user.hasActiveSubscription(),
      isInTrial: user.isInTrial(),
      subscriptionStatus: user.subscriptionStatus,
      subscriptionEndsAt: user.subscriptionEndsAt,
      trialEndsAt: user.trialEndsAt,
      currentPlan: user.currentPlan
    };

    // Usage info
    const usageInfo = {
      voicesUsed: user.usage.voicesUsed,
      meetingsUsed: user.usage.meetingsUsed,
      remainingVoices: user.remainingVoices,
      remainingMeetings: user.remainingMeetings,
      lastResetDate: user.usage.lastResetDate
    };

    res.status(200).json({
      status: 'ok',
      data: {
        user: {
          ...user.toObject(),
          password: undefined
        },
        accountMetrics,
        subscriptionInfo,
        usageInfo
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Update account privacy settings
// @route   PUT /api/users/account/privacy
// @access  Private
const updatePrivacySettings = asyncHandler(async (req, res) => {
  try {
    const {
      dataProcessingConsent,
      marketingConsent,
      analyticsConsent,
      thirdPartySharing
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Add privacy settings to user schema (you may need to add these fields to the user model)
    const privacySettings = {
      dataProcessingConsent: dataProcessingConsent !== undefined ? dataProcessingConsent : true,
      marketingConsent: marketingConsent !== undefined ? marketingConsent : false,
      analyticsConsent: analyticsConsent !== undefined ? analyticsConsent : true,
      thirdPartySharing: thirdPartySharing !== undefined ? thirdPartySharing : false,
      updatedAt: new Date()
    };

    // Store privacy settings (you might want to add a privacy_settings field to user schema)
    user.privacy_settings = privacySettings;
    await user.save();

    res.status(200).json({
      status: 'ok',
      message: 'Privacy settings updated successfully',
      data: {
        privacy_settings: privacySettings
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Get account privacy settings
// @route   GET /api/users/account/privacy
// @access  Private
const getPrivacySettings = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('privacy_settings createdAt');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Default privacy settings if none exist
    const defaultPrivacySettings = {
      dataProcessingConsent: true,
      marketingConsent: false,
      analyticsConsent: true,
      thirdPartySharing: false,
      updatedAt: user.createdAt
    };

    res.status(200).json({
      status: 'ok',
      data: {
        privacy_settings: user.privacy_settings || defaultPrivacySettings
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Get account activity log
// @route   GET /api/users/account/activity
// @access  Private
const getAccountActivity = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get recent activities (you might want to create an ActivityLog model)
    const activities = [
      {
        type: 'login',
        description: 'User logged in',
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
      // In a real implementation, you would fetch from an activity log collection
    ];

    // Get recent voice memos and meetings as activities
    const [recentVoiceMemos, recentMeetings] = await Promise.all([
      VoiceMemo.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('title createdAt'),
      Meeting.find({ user_id: req.user._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('title platform createdAt')
    ]);

    // Combine activities
    const combinedActivities = [
      ...activities,
      ...recentVoiceMemos.map(memo => ({
        type: 'voice_memo',
        description: `Created voice memo: ${memo.title}`,
        timestamp: memo.createdAt,
        resourceId: memo._id
      })),
      ...recentMeetings.map(meeting => ({
        type: 'meeting',
        description: `Created meeting: ${meeting.title} (${meeting.platform})`,
        timestamp: meeting.createdAt,
        resourceId: meeting._id
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const paginatedActivities = combinedActivities.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      status: 'ok',
      data: {
        activities: paginatedActivities,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(combinedActivities.length / parseInt(limit)),
          totalResults: combinedActivities.length,
          resultsPerPage: parseInt(limit)
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

// @desc    Verify account with additional security
// @route   POST /api/users/account/verify-security
// @access  Private
const verifyAccountSecurity = asyncHandler(async (req, res) => {
  try {
    const { password, securityQuestion, securityAnswer } = req.body;

    if (!password) {
      return res.status(400).json({
        status: 'error',
        message: 'Password is required for security verification'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Password is incorrect'
      });
    }

    // Generate security verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store verification token (you might want to add these fields to user schema)
    user.securityVerificationToken = verificationToken;
    user.securityVerificationExpires = verificationExpires;
    await user.save();

    res.status(200).json({
      status: 'ok',
      message: 'Security verification successful',
      data: {
        verificationToken,
        expiresAt: verificationExpires
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Download account data
// @route   GET /api/users/account/download-data
// @access  Private
const downloadAccountData = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('currentPlan')
      .select('-password -securityVerificationToken');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get all user data
    const [voiceMemos, meetings, transcriptions, summarizations] = await Promise.all([
      VoiceMemo.find({ userId: user._id }).select('-__v'),
      Meeting.find({ user_id: user._id }).select('-__v'),
      Transcription.find({ user_id: user._id }).select('-__v'),
      Summarization.find({ user_id: user._id }).select('-__v')
    ]);

    const accountData = {
      exportInfo: {
        exportDate: new Date(),
        exportVersion: '1.0',
        userId: user._id
      },
      profile: user.toObject(),
      voiceMemos,
      meetings,
      transcriptions,
      summarizations,
      statistics: {
        totalVoiceMemos: voiceMemos.length,
        totalMeetings: meetings.length,
        totalTranscriptions: transcriptions.length,
        totalSummarizations: summarizations.length
      }
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="huscribe-account-data-${user._id}-${new Date().toISOString().split('T')[0]}.json"`);

    res.status(200).json(accountData);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Close account permanently
// @route   DELETE /api/users/account/close
// @access  Private
const closeAccount = asyncHandler(async (req, res) => {
  try {
    const { password, reason, confirmText } = req.body;

    if (!password || confirmText !== 'DELETE MY ACCOUNT') {
      return res.status(400).json({
        status: 'error',
        message: 'Password and confirmation text "DELETE MY ACCOUNT" are required'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Password is incorrect'
      });
    }

    // Delete all user data
    await Promise.all([
      VoiceMemo.deleteMany({ userId: user._id }),
      Meeting.deleteMany({ user_id: user._id }),
      Transcription.deleteMany({ user_id: user._id }),
      Summarization.deleteMany({ user_id: user._id })
    ]);

    // Send account closure confirmation email
    await sendEmail(
      user.email,
      "Account Permanently Closed",
      `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: auto; padding: 20px; font-family: Arial, sans-serif; }
          .header { text-align: center; color: #e74c3c; font-size: 24px; margin-bottom: 20px; }
          .message { font-size: 16px; line-height: 1.6; color: #333; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">Account Permanently Closed</div>
          <div class="message">
            <p>Your Huscribe account has been permanently closed and all associated data has been deleted.</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            <p>This action cannot be undone. If you need to use our services again, you will need to create a new account.</p>
            <p>Thank you for using Huscribe.</p>
          </div>
        </div>
      </body>
      </html>
      `
    );

    // Delete the user account
    await User.findByIdAndDelete(user._id);

    res.status(200).json({
      status: 'ok',
      message: 'Account permanently closed and all data deleted'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @desc    Reactivate deactivated account
// @route   POST /api/users/account/reactivate
// @access  Public
const reactivateAccount = asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ email, status: 'inactive' });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'No inactive account found with this email'
      });
    }

    // Verify password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Password is incorrect'
      });
    }

    // Reactivate account
    user.status = 'active';
    user.verified = 1;
    await user.save();

    // Send reactivation confirmation email
    await sendEmail(
      user.email,
      "Account Reactivated",
      `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: auto; padding: 20px; font-family: Arial, sans-serif; }
          .header { text-align: center; color: #27ae60; font-size: 24px; margin-bottom: 20px; }
          .message { font-size: 16px; line-height: 1.6; color: #333; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">Account Reactivated</div>
          <div class="message">
            <p>Welcome back! Your Huscribe account has been successfully reactivated.</p>
            <p>You can now log in and continue using all our services.</p>
            <p>Thank you for choosing Huscribe.</p>
          </div>
        </div>
      </body>
      </html>
      `
    );

    res.status(200).json({
      status: 'ok',
      message: 'Account reactivated successfully. You can now log in.'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});


const salesCount = asyncHandler(async (req, res) => {
  ///

export {
  getAccountOverview,
  updatePrivacySettings,
  getPrivacySettings,
  getAccountActivity,
  verifyAccountSecurity,
  downloadAccountData,
  closeAccount,
  reactivateAccount
}; 