import mongoose from 'mongoose';

const planHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        required: true
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    },
    status: {
        type: String,
        enum: ['active', 'cancelled', 'expired', 'past_due'],
        required: true
    },
    subscriptionId: String,
    stripeCustomerId: String,
    usageMetrics: {
        voicesUsed: {
            type: Number,
            default: 0
        },
        meetingsUsed: {
            type: Number,
            default: 0
        },
        voicesLimit: Number,
        meetingsLimit: Number,
        lastResetDate: Date
    },
    billingDetails: {
        amount: Number,
        currency: String,
        interval: String,
        isFreePlan: {
            type: Boolean,
            default: false
        }
    },
    couponApplied: {
        code: String,
        discountPercentage: Number
    },
    trialPeriod: {
        isTrialPeriod: {
            type: Boolean,
            default: false
        },
        trialStartDate: Date,
        trialEndDate: Date
    },
    cancellationDetails: {
        cancelledAt: Date,
        reason: String
    }
}, {
    timestamps: true
});

// Index for efficient queries
planHistorySchema.index({ userId: 1, startDate: -1 });
planHistorySchema.index({ subscriptionId: 1 });

const PlanHistory = mongoose.model('PlanHistory', planHistorySchema);

export default PlanHistory; 