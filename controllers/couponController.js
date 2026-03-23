import Coupon from '../models/couponModel.js';
import catchAsync from '../utils/catchAsync.js';
import { AppError } from '../utils/appError.js';

// Get all coupons
export const getAllCoupons = catchAsync(async (req, res) => {
    const coupons = await Coupon.find();
    res.status(200).json(coupons);
});

// Get single coupon
export const getCoupon = catchAsync(async (req, res, next) => {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
        return next(new AppError('No coupon found with that ID', 404));
    }
    res.status(200).json(coupon);
});

// Create coupon
export const createCoupon = catchAsync(async (req, res) => {
    const coupon = await Coupon.create(req.body);
    res.status(201).json(coupon);
});

// Update coupon
export const updateCoupon = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const updateData = {
        ...req.body,
        code: req.body.code?.toUpperCase() // Ensure code is uppercase if provided
    };

    const coupon = await Coupon.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
    );

    if (!coupon) {
        return next(new AppError('No coupon found with that ID', 404));
    }

    res.status(200).json(coupon);
});

// Delete coupon
export const deleteCoupon = catchAsync(async (req, res, next) => {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);

    if (!coupon) {
        return next(new AppError('No coupon found with that ID', 404));
    }

    res.status(204).json(null);
});

// Toggle coupon active status
export const toggleCouponStatus = catchAsync(async (req, res, next) => {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
        return next(new AppError('No coupon found with that ID', 404));
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.status(200).json(coupon);
});

// Validate coupon
export const validateCoupon = catchAsync(async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({
            status: 'error',
            message: 'Please provide a coupon code'
        });
    }

    const coupon = await Coupon.findOne({
        code: code.toUpperCase(),
        validUntil: { $gt: new Date() },
        isActive: true
    });

    if (!coupon) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid or expired coupon code'
        });
    }

    // Check maxUses separately since we can't compare with $maxUses directly
    if (coupon.currentUses >= coupon.maxUses) {
        return res.status(400).json({
            status: 'error',
            message: 'Coupon has reached maximum usage limit'
        });
    }

    res.status(200).json({
        status: 'success',
        valid: true,
        discountPercentage: coupon.discountPercentage
    });
});

// Apply coupon
export const applyCoupon = catchAsync(async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({
            status: 'error',
            message: 'Please provide a coupon code'
        });
    }

    const coupon = await Coupon.findOne({
        code: code.toUpperCase(),
        validUntil: { $gt: new Date() },
        isActive: true
    });

    if (!coupon) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid or expired coupon code'
        });
    }

    if (coupon.currentUses >= coupon.maxUses) {
        return res.status(400).json({
            status: 'error',
            message: 'Coupon has reached maximum usage limit'
        });
    }

    // Increment currentUses after validation
    coupon.currentUses += 1;
    await coupon.save();

    res.status(200).json({
        status: 'success',
        discountPercentage: coupon.discountPercentage
    });
}); 