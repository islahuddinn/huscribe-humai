import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    stripeCustomerId: {
        type: String,
        required: true
    },
    subscriptionId: {
        type: String,
        required: true
    },
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'canceled', 'past_due', 'unpaid'],
        default: 'active'
    },
    planType: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'usd'
    },
    nextBillingDate: {
        type: Date,
        required: true
    },
    lastBillingDate: Date,
    paymentMethod: {
        type: String,
        required: true
    },
    isFreeTrial: {
        type: Boolean,
        default: false
    },
    trialEndsAt: {
        type: Date
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
    couponApplied: {
        code: String,
        discountPercentage: Number,
        originalAmount: Number,
        discountedAmount: Number
    }
}, {
    timestamps: true
});

// Method to check if user has reached RFQ limit
paymentSchema.methods.hasRfqQuotaAvailable = function () {
    const plan = this.planId;
    if (!plan) return false;

    // If rfqsPerMonth is -1, it means unlimited
    if (plan.features.rfqsPerMonth === -1) return true;

    return this.usage.voicesUsed < plan.features.rfqsPerMonth;
};

// Method to check if user has reached supplier limit per RFQ
paymentSchema.methods.hasSupplierQuotaAvailable = function (suppliersRequested) {
    const plan = this.planId;
    if (!plan) return false;

    // If suppliersPerRfq is -1, it means unlimited
    if (plan.features.suppliersPerRfq === -1) return true;

    return suppliersRequested <= plan.features.suppliersPerRfq;
};

// Method to check if user has access to a specific feature
paymentSchema.methods.hasFeatureAccess = function (featureName) {
    const plan = this.planId;
    if (!plan) return false;

    return plan.features[featureName] === true;
};

// Method to increment usage counters
paymentSchema.methods.incrementUsage = async function (rfqCount = 1, supplierCount = 0) {
    this.usage.voicesUsed += rfqCount;
    this.usage.meetingsUsed += supplierCount;
    await this.save();
};

// Reset usage counters (called monthly)
paymentSchema.methods.resetUsage = async function () {
    this.usage.voicesUsed = 0;
    this.usage.meetingsUsed = 0;
    this.usage.lastResetDate = new Date();
    await this.save();
};

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment; 