import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        enum: ['BASIC', 'STANDARD', 'PRO']
    },
    stripeProductId: {
        type: String,
        required: true
    },
    stripePriceId: {
        type: String,
        required: true
    },
    // Apple In-App Purchase (iOS)
    appleProductId: {
        type: String,
        required: false,
        default: null
    },
    // Google Play Billing (Android)
    googleProductId: {
        type: String,
        required: false,
        default: null
    },
    features: {
        voicesPerMonth: {
            type: Number,
            required: true,
            default: 25
        },
        meetingsPerMonth: {
            type: Number,
            required: true,
            default: 8
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    price: {
        amount: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            default: 'usd'
        }
    },
    description: {
        type: String,
        required: true
    },
    // Platform availability
    platforms: {
        web: {
            type: Boolean,
            default: true
        },
        ios: {
            type: Boolean,
            default: false
        },
        android: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true
});

const Plan = mongoose.model('Plan', planSchema);

export default Plan; 