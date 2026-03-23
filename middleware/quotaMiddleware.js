import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import RFQ from '../models/rfqModel.js';

const checkRfqQuota = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user._id).populate('currentPlan');

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Check if subscription is active OR cancelled but not yet expired
    const hasValidSubscription = user.subscriptionStatus === 'active' ||
        (user.subscriptionStatus === 'cancelled' &&
            user.subscriptionEndsAt &&
            new Date(user.subscriptionEndsAt) > new Date());

    if (!hasValidSubscription && !user.isInTrial()) {
        res.status(403);
        throw new Error('No active subscription or trial');
    }

    const hasQuota = await user.hasRfqQuota();
    if (!hasQuota) {
        return res.status(403).json({
            status: 'error',
            message: 'Monthly RFQ quota exceeded'
        });
    }

    next();
});

const checkSupplierQuota = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user._id).populate('currentPlan');
    const noOfSuppliers = parseInt(req.body.no_suppliers) || 0;

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Check if subscription is active OR cancelled but not yet expired
    const hasValidSubscription = user.subscriptionStatus === 'active' ||
        (user.subscriptionStatus === 'cancelled' &&
            user.subscriptionEndsAt &&
            new Date(user.subscriptionEndsAt) > new Date());

    if (!hasValidSubscription && !user.isInTrial()) {
        return res.status(403).json({
            status: 'error',
            message: 'No active subscription or trial'
        });
    }

    // For quote creation, check the RFQ's current supplier count
    if (req.originalUrl.includes('/quotes')) {
        const rfqId = req.body.rfq_id;
        if (rfqId) {
            const rfq = await RFQ.findById(rfqId);
            if (rfq) {
                const supplierLimit = user.currentPlan.features.suppliersPerRfq;
                if (supplierLimit === -1) {
                    res.locals.remainingQuota = noOfSuppliers;
                    next();
                    return;
                }

                const remainingQuota = Math.max(0, supplierLimit - rfq.meetingsUsed);
                if (remainingQuota === 0) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'Supplier quota exceeded for this RFQ'
                    });
                }

                // Store the available quota (either requested amount or remaining quota)
                res.locals.remainingQuota = Math.min(noOfSuppliers, remainingQuota);
                next();
                return;
            }
        }
    }

    // For RFQ creation, just check if the requested number is within the limit
    const quotaResult = await user.checkSupplierQuota(noOfSuppliers);
    if (!quotaResult.hasQuota) {
        if (quotaResult.remainingQuota > 0) {
            res.locals.remainingQuota = quotaResult.remainingQuota;
            next();
        } else {
            return res.status(403).json({
                status: 'error',
                message: 'Supplier quota exceeded for this RFQ'
            });
        }
    } else {
        res.locals.remainingQuota = noOfSuppliers;
        next();
    }
});

const incrementUsage = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user._id);
    const noOfSuppliers = res.locals.remainingQuota || 0;

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Only increment RFQ usage if this is an RFQ creation (not a quote)
    if (req.originalUrl.includes('/rfqs')) {
        await user.incrementUsage('rfq');
    }

    // If this is a quote creation, increment the RFQ's supplier count
    if (req.originalUrl.includes('/quotes') && noOfSuppliers > 0) {
        const rfqId = req.body.rfq_id;
        if (rfqId) {
            const rfq = await RFQ.findById(rfqId);
            if (rfq) {
                rfq.meetingsUsed += noOfSuppliers;
                await rfq.save();
            }
        }
    }

    // If partial quota was used, add a warning message to res.locals
    const requestedSuppliers = parseInt(req.body.no_suppliers) || 0;
    if (noOfSuppliers < requestedSuppliers) {
        res.locals.quotaMessage = `RFQ created successfully. Only ${noOfSuppliers} supplier(s) quota was available and has been used. Additional ${requestedSuppliers - noOfSuppliers} supplier(s) quota exceeded.`;
    } else {
        res.locals.quotaMessage = "RFQ created successfully";
    }
    next();
});

export { checkRfqQuota, checkSupplierQuota, incrementUsage }; 