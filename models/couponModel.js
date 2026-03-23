import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'A coupon must have a code'],
        unique: true,
        uppercase: true
    },
    discountPercentage: {
        type: Number,
        required: [true, 'A coupon must have a discount percentage'],
        min: [1, 'Discount must be at least 1%'],
        max: [100, 'Discount cannot exceed 100%']
    },
    validUntil: {
        type: Date,
        required: [true, 'A coupon must have an expiry date']
    },
    maxUses: {
        type: Number,
        required: [true, 'A coupon must have a maximum number of uses'],
        min: [1, 'Maximum uses must be at least 1']
    },
    currentUses: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    allowedUsers: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    createdBy: {
        type: String,
        default: 'admin'
    }
}, {
    timestamps: true
});

// Indexes for faster lookups
couponSchema.index({ code: 1 });
couponSchema.index({ validUntil: 1 });
couponSchema.index({ isActive: 1 });

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon; 