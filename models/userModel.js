import mongoose from 'mongoose';
import moment from 'moment';
import bcrypt from 'bcryptjs';
import pkg from 'mongoose';
const { Schema } = pkg;

const userSchema = new mongoose.Schema(
  {
    first_name: {
      type: String,
    },
    last_name: {
      type: String,
    },
    email: {
      type: String,
      unique: true,
    },
    password: {
      type: String,
      // required: true,
    },
    address: {
      type: String,
    },
    dob: {
      type: String,
    },
    emirates_id: {
      type: String,
    },
    emirates_id_photo: {
      type: String,
    },
    insurance_card: {
      type: String,
    },
    app_hash: {
      type: String
    },
    mobile_no: {
      type: String,
      // required: true
    },
    language: {
      type: String,
      default: 'English'
    },
    otp_code: {
       type: Number,
      required: false,
    },
    verified: {
      type: Number,
      required: false,
      default: 0
    },
    profile_picture: {
      type: String,
      required: false,
      default: 'https://www.murrayglass.com/wp-content/uploads/2020/10/avatar-2048x2048.jpeg'
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other']
    },
    date: {
      type: String,
      default: moment().format('MM/DD/YYYY')
    },
    company: {
      type: String,
      required: false
    },
    notification_preferences: {
      type: String,
      required: false,
      default: 'all'  // You can adjust the default value as needed
    },
    default_input_mode: {
      type: String,
      enum: ['voice', 'text'],
      required: false,
      default: 'text'
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    // Subscription fields
    currentPlan: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      default: null
    },
    stripeCustomerId: {
      type: String,
      default: null
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
    },
    // Apple In-App Purchase fields
    appleTransactionId: {
      type: String,
      default: null
    },
    processedTransactions: [{
      type: String
    }],
    crmConfig:{
      crmType: {
        type: String,
        required: false
      },
      email: {
        type: String,
        required: false
      },
      username: {
        type: String,
        required: false
      },
      fullName:{
        type: String,
        required: false
      },
      accessToken: {
        type: String,
        required: false
      },
      refreshToken: {
        type: String,
        required: false
      },
      instanceUrl: {
        type: String,
        required: false
      },
      expirationTime: {
        type: String,
        required: false
          }
    },
    // Google Play Billing fields
    googleOrderId: {
      type: String,
      default: null
    },
    processedOrders: [{
      type: String
    }],
    // Payment method tracking
    lastPaymentMethod: {
      type: String,
      enum: ['stripe', 'apple_iap', 'google_play'],
      default: 'stripe'
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'inactive', 'cancelled', 'past_due'],
      default: 'inactive',
    },
    subscriptionEndsAt: {
      type: Date,
      default: null,
    },
    additionalVoices: {
      type: Number,
      default: 10,
    },
    additionalMeetings: {
      type: Number,
      default: 10,
    },
    remainingVoices: {
      type: Number,
      default: 10,
    },
    remainingMeetings: {
      type: Number,
      default: 10,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'deactivated', 'inactive'],
      default: 'inactive'
    },
    trialEndsAt: {
      type: Date,
      default: null
    },
    usage: {
      voicesUsed: {
        type: Number,
        default: 0
      },
      meetingsUsed: {
        type: Number,
        default: 0
      },
      lastResetDate: {
        type: Date,
        default: Date.now
      }
    },
    token: {
      type: String,
      default: null
    },
    fcmTokens: [{
      token: {
        type: String,
        required: true
      },
      device: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    salesforce_user_id: {
      type: String,
      sparse: true,
    },
    salesforce_info: {
      organization_id: String,
      username: String,
      display_name: String,
      email: String,
      first_name: String,
      last_name: String,
      locale: String,
      language: String,
      timezone: String,
      instance_url: String,
      user_type: String,
      last_modified_date: Date,
      profile_id: String,
      role_id: String
    },
    isTemporary: {
      type: Boolean,
      default: false
    },
    // Outlook integration fields
    outlookAccessToken: {
      type: String,
      default: null
    },
    outlookRefreshToken: {
      type: String,
      default: null
    },
    outlookTokenExpiresAt: {
      type: Date,
      default: null
    },
    outlookConnected: {
      type: Boolean,
      default: false
    },
    privacy_settings: {
      dataProcessingConsent: {
        type: Boolean,
        default: true
      },
      marketingConsent: {
        type: Boolean,
        default: false
      },
      analyticsConsent: {
        type: Boolean,
        default: true
      },
      thirdPartySharing: {
        type: Boolean,
        default: false
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    }
  },
  { timestamps: true }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Subscription helper methods
userSchema.methods.hasActiveSubscription = function () {
  return (this.subscriptionStatus === 'active' ||
    (this.subscriptionStatus === 'cancelled' && this.subscriptionEndsAt && new Date(this.subscriptionEndsAt) > new Date()));
};

userSchema.methods.isInTrial = function () {
  return this.trialEndsAt && new Date(this.trialEndsAt) > new Date();
};

userSchema.methods.canUseFeature = async function (featureName) {
  if (!this.currentPlan) return false;
  if (!this.hasActiveSubscription()) return false;

  await this.populate('currentPlan');
  return this.currentPlan.features[featureName];
};

//== Method to update remaining voices and meetings
userSchema.methods.updateUsage = async function (type, count = 1) {
  if (type === 'voice') {
    this.remainingVoices -= count;
  } else if (type === 'meeting') {
    this.remainingMeetings -= count;
  }
  await this.save();
};

//== Method to check if user has enough voices or meetings
userSchema.methods.hasQuota = async function (type, count = 1) {
  if (type === 'voice') {
    return this.remainingVoices >= count;
  } else if (type === 'meeting') {
    return this.remainingMeetings >= count;
  }
  return false;
};

userSchema.methods.incrementUsage = async function (type, count = 1) {
  // Reset usage if it's a new month
  const lastReset = new Date(this.usage.lastResetDate);
  const now = new Date();

  if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
    this.usage.voicesUsed = 0;
    this.usage.meetingsUsed = 0;
    this.usage.lastResetDate = now;
  }

  // Only increment voice or meeting usage
  if (type === 'voice') {
    this.usage.voicesUsed += 1;
  } else if (type === 'meeting') {
    this.usage.meetingsUsed += 1;
  }

  await this.save();
};

// Add method to manage FCM tokens
userSchema.methods.addFcmToken = async function (token, device) {
  // Remove any existing tokens for the same device
  this.fcmTokens = this.fcmTokens.filter(t => t.device !== device);

  // Add new token
  this.fcmTokens.push({ token, device });

  return this.save();
};

const User = mongoose.model('User', userSchema);
export default User;
