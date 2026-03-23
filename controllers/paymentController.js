import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
import Payment from '../models/paymentModel.js';
import Plan from '../models/planModel.js';
import User from '../models/userModel.js';
import Coupon from '../models/couponModel.js';
import PlanHistory from '../models/planHistoryModel.js';
import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const paymentController = {
    // Create a subscription
    createSubscription: asyncHandler(async (req, res) => {
        const { 
            planId, 
            paymentMethodId, 
            userId, 
            couponCode,
            // IAP specific fields
            paymentType = 'stripe', // 'stripe', 'apple_iap', 'google_play'
            receiptData, // For Apple IAP
            transactionId, // For Apple IAP
            purchaseToken, // For Google Play
            orderId // For Google Play
        } = req.body;

        // Get userId from either req.user._id (if authenticated) or from request body
        const subscriberUserId = req.user?._id || userId;

        if (!subscriberUserId) {
            return res.status(400).json({ 
                status: 'error',
                message: 'User ID is required' 
            });
        }

        try {
            // Get the user and plan
            const user = await User.findById(subscriberUserId);
            const plan = await Plan.findById(planId);

            if (!user || !plan) {
                return res.status(404).json({ 
                    status: 'error',
                    message: 'User or plan not found' 
                });
            }

            // Validate payment method and platform compatibility
            if (paymentType === 'apple_iap') {
                if (!receiptData || !transactionId) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Receipt data and transaction ID are required for Apple IAP'
                    });
                }

                if (!plan.appleProductId || !plan.platforms?.ios) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'This plan is not available for iOS purchases'
                    });
                }

                // Check if transaction was already processed
                if (user.processedTransactions && user.processedTransactions.includes(transactionId)) {
                    return res.status(409).json({
                        status: 'error',
                        message: 'Transaction already processed'
                    });
                }

                // Validate Apple receipt
                const appleValidation = await validateWithApple(receiptData);
                if (!appleValidation.isValid) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid Apple receipt',
                        details: appleValidation.error
                    });
                }

            } else if (paymentType === 'google_play') {
                if (!purchaseToken || !orderId) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Purchase token and order ID are required for Google Play'
                    });
                }

                if (!plan.googleProductId || !plan.platforms?.android) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'This plan is not available for Android purchases'
                    });
                }

                // Check if order was already processed
                if (user.processedOrders && user.processedOrders.includes(orderId)) {
                    return res.status(409).json({
                        status: 'error',
                        message: 'Order already processed'
                    });
                }

                // Validate Google Play purchase
                const googleValidation = await validateWithGoogle(purchaseToken, plan.googleProductId);
                if (!googleValidation.isValid) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid Google Play purchase',
                        details: googleValidation.error
                    });
                }

            } else if (paymentType === 'stripe') {
                // Existing Stripe validation - ensure plan supports web platform
                if (!plan.platforms?.web) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'This plan is not available for web purchases'
                    });
                }
            }

            // Check for any active or cancelled-but-not-expired subscriptions
            const activePayment = await Payment.findOne({
                userId: user._id,
                status: { $in: ['active', 'cancelled'] },
                endsAt: { $gt: new Date() }
            }).sort({ createdAt: -1 });

            // If there's an active subscription, cancel it
            if (activePayment) {
                // Cancel the existing subscription in Stripe (only if it's a Stripe subscription)
                if (activePayment.subscriptionId && activePayment.paymentMethod !== 'apple_iap' && activePayment.paymentMethod !== 'google_play') {
                    await stripe.subscriptions.update(activePayment.subscriptionId, {
                        cancel_at_period_end: true
                    });
                }

                // Update the payment record
                activePayment.status = 'cancelled';
                await activePayment.save();

                // Update the plan history record for the old subscription
                await PlanHistory.findOneAndUpdate(
                    { 
                        userId: user._id,
                        subscriptionId: activePayment.subscriptionId,
                        status: { $in: ['active', 'cancelled'] }
                    },
                    {
                        status: 'cancelled',
                        endDate: new Date(),
                        cancellationDetails: {
                            cancelledAt: new Date(),
                            reason: 'Upgraded to new plan'
                        }
                    }
                );
            }

            let subscription;
            let stripeCustomerId = user.stripeCustomerId;
            let appliedCoupon = null;

            // Validate coupon if provided (only for Stripe payments)
            if (couponCode && paymentType === 'stripe') {
                appliedCoupon = await Coupon.findOne({
                    code: couponCode.toUpperCase(),
                    isActive: true,
                    validUntil: { $gt: new Date() }
                });

                if (!appliedCoupon) {
                    return res.status(400).json({ 
                        status: 'error',
                        message: 'Invalid or expired coupon code' 
                    });
                }

                // Check max uses
                if (appliedCoupon.maxUses && appliedCoupon.currentUses >= appliedCoupon.maxUses) {
                    return res.status(400).json({ 
                        status: 'error',
                        message: 'This coupon has reached its maximum usage limit' 
                    });
                }
            }

            // Handle different payment methods
            if (paymentType === 'apple_iap' || paymentType === 'google_play') {
                // For IAP, create a mock subscription object
                const subscriptionEndDate = new Date();
                subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

                subscription = {
                    id: paymentType === 'apple_iap' ? transactionId : orderId,
                    status: 'active',
                    current_period_end: Math.floor(subscriptionEndDate.getTime() / 1000),
                    trial_end: null
                };

                // Update user with IAP-specific fields
                if (paymentType === 'apple_iap') {
                    user.appleTransactionId = transactionId;
                    user.lastPaymentMethod = 'apple_iap';
                    if (!user.processedTransactions) user.processedTransactions = [];
                    user.processedTransactions.push(transactionId);
                } else {
                    user.googleOrderId = orderId;
                    user.lastPaymentMethod = 'google_play';
                    if (!user.processedOrders) user.processedOrders = [];
                    user.processedOrders.push(orderId);
                }

            } else {
                // Existing Stripe logic
                // Handle free plans differently
                if (plan.price.amount === 0) {
                    // For free plans, we might not need a payment method
                    if (!stripeCustomerId) {
                        const customer = await stripe.customers.create({
                            email: user.email
                        });
                        stripeCustomerId = customer.id;
                        user.stripeCustomerId = stripeCustomerId;
                        await user.save();
                    } else {
                        // Validate existing customer ID
                        try {
                            await stripe.customers.retrieve(stripeCustomerId);
                        } catch (error) {
                            if (error.code === 'resource_missing') {
                                console.log(`Invalid customer ID ${stripeCustomerId} for user ${user.email}, creating new customer`);
                                // Create new customer if the existing one is invalid
                                const customer = await stripe.customers.create({
                                    email: user.email
                                });
                                stripeCustomerId = customer.id;
                                user.stripeCustomerId = stripeCustomerId;
                                await user.save();
                            } else {
                                throw error;
                            }
                        }
                    }

                    subscription = await stripe.subscriptions.create({
                        customer: stripeCustomerId,
                        items: [{ price: plan.stripePriceId }],
                    });
                } else {
                    // Paid plans require payment method
                    if (!stripeCustomerId) {
                        const customer = await stripe.customers.create({
                            email: user.email,
                            payment_method: paymentMethodId,
                            invoice_settings: { default_payment_method: paymentMethodId },
                        });
                        stripeCustomerId = customer.id;
                        user.stripeCustomerId = stripeCustomerId;
                        await user.save();
                    } else {
                        // Validate existing customer ID first
                        try {
                            await stripe.customers.retrieve(stripeCustomerId);
                            
                            // Update the customer's payment method
                            await stripe.paymentMethods.attach(paymentMethodId, {
                                customer: stripeCustomerId,
                            });
                            await stripe.customers.update(stripeCustomerId, {
                                invoice_settings: { default_payment_method: paymentMethodId },
                            });
                        } catch (error) {
                            if (error.code === 'resource_missing') {
                                console.log(`Invalid customer ID ${stripeCustomerId} for user ${user.email}, creating new customer`);
                                // Create new customer if the existing one is invalid
                                const customer = await stripe.customers.create({
                                    email: user.email,
                                    payment_method: paymentMethodId,
                                    invoice_settings: { default_payment_method: paymentMethodId },
                                });
                                stripeCustomerId = customer.id;
                                user.stripeCustomerId = stripeCustomerId;
                                await user.save();
                            } else {
                                throw error;
                            }
                        }
                    }

                    // Create subscription with coupon if available
                    const subscriptionData = {
                        customer: stripeCustomerId,
                        items: [{ price: plan.stripePriceId }],
                        expand: ['latest_invoice.payment_intent']
                    };

                    if (appliedCoupon) {
                        // Create a one-time coupon in Stripe with the exact discounted price
                        const discountedPrice = req.body.discountedPrice || plan.price.amount * (1 - appliedCoupon.discountPercentage / 100);

                        // Create a new price with the discounted amount
                        const discountedStripePrice = await stripe.prices.create({
                            unit_amount: Math.round(discountedPrice * 100), // Convert to cents
                            currency: plan.price.currency,
                            recurring: {
                                interval: 'month' // or whatever your plan's interval is
                            },
                            product: plan.stripeProductId
                        });

                        // Use the discounted price in the subscription
                        subscriptionData.items = [{ price: discountedStripePrice.id }];
                    }

                    subscription = await stripe.subscriptions.create(subscriptionData);
                }

                user.lastPaymentMethod = 'stripe';
            }

            // Increment coupon usage if applied (for both free and paid plans)
            if (appliedCoupon) {
                // Find and update the coupon
                const couponToUpdate = await Coupon.findById(appliedCoupon._id);
                if (couponToUpdate) {
                    couponToUpdate.currentUses += 1;
                    await couponToUpdate.save();
                    console.log('Coupon usage updated:', couponToUpdate.code, 'Current uses:', couponToUpdate.currentUses);
                }
            }

            // Update user's subscription details
            user.currentPlan = plan._id;
            user.subscriptionStatus = subscription.status === 'active' ? 'active' : 'inactive';
            user.subscriptionEndsAt = new Date(subscription.current_period_end * 1000);

            // Set trial end date if applicable
            if (subscription.trial_end) {
                user.trialEndsAt = new Date(subscription.trial_end * 1000);
            }

            // Reset usage counters and set remaining quotas
            user.usage = {
                voicesUsed: 0,
                meetingsUsed: 0,
                lastResetDate: new Date()
            };
            user.remainingVoices = plan.features.voicesPerMonth;
            user.remainingMeetings = plan.features.meetingsPerMonth;

            await user.save();

            // Calculate next billing date
            const nextBillingDate = new Date(subscription.current_period_end * 1000);

            // Create a payment record
            const paymentRecord = await Payment.create({
                userId: user._id,
                planId: plan._id,
                stripeCustomerId: paymentType === 'stripe' ? stripeCustomerId : null,
                subscriptionId: subscription.id,
                amount: plan.price.amount,
                currency: plan.price.currency,
                status: subscription.status,
                paymentMethod: paymentType === 'stripe' ? (paymentMethodId || 'free') : paymentType,
                planType: plan.name,
                nextBillingDate: nextBillingDate,
                isFreeTrial: !!subscription.trial_end,
                trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
                couponApplied: appliedCoupon ? {
                    code: appliedCoupon.code,
                    discountPercentage: appliedCoupon.discountPercentage
                } : null,
                // IAP specific fields
                appleTransactionId: paymentType === 'apple_iap' ? transactionId : null,
                googleOrderId: paymentType === 'google_play' ? orderId : null
            });

            // Create plan history record
            await paymentController.createPlanHistoryRecord(
                user,
                plan,
                subscription,
                paymentRecord,
                appliedCoupon
            );

            // Return appropriate response based on payment type
            const baseResponse = {
                status: 'ok',
                message: `${paymentType === 'apple_iap' ? 'Apple IAP' : paymentType === 'google_play' ? 'Google Play' : 'Stripe'} subscription activated successfully`,
                data: {
                    subscriptionId: subscription.id,
                    status: subscription.status,
                    plan: plan.name,
                    subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
                    remainingVoices: plan.features.voicesPerMonth,
                    remainingMeetings: plan.features.meetingsPerMonth,
                    appliedCoupon: appliedCoupon ? {
                        code: appliedCoupon.code,
                        discountPercentage: appliedCoupon.discountPercentage
                    } : null
                }
            };

            // Add client secret for Stripe paid plans
            if (paymentType === 'stripe' && plan.price.amount > 0 && subscription.latest_invoice?.payment_intent) {
                baseResponse.data.clientSecret = subscription.latest_invoice.payment_intent.client_secret;
            }

            res.status(201).json(baseResponse);

        } catch (error) {
            console.error('Subscription error:', error);
            res.status(500).json({ 
                status: 'error',
                message: 'Internal server error during subscription creation'
            });
        }
    }),

    // Cancel a subscription
    cancelSubscription: asyncHandler(async (req, res) => {
        const { subscriptionId } = req.params;
        const userId = req.user._id;

        try {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Get the subscription from Stripe to check current period end
            const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
            const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);

            // Cancel the subscription in Stripe at period end
            const subscription = await stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: true
            });

            // Update user's subscription status
            // Note: We keep subscriptionStatus as 'active' but mark it as cancelled in other records
            // This ensures the user can still use the subscription until the end
            user.subscriptionStatus = 'active'; // Keep as active to maintain access
            user.subscriptionEndsAt = currentPeriodEnd;
            await user.save();

            // Update payment record
            await Payment.findOneAndUpdate(
                { subscriptionId: subscriptionId },
                {
                    status: 'cancelled', // Mark as cancelled in payment record
                    cancelledAt: new Date(),
                    endsAt: currentPeriodEnd
                }
            );

            // Update plan history record
            await PlanHistory.findOneAndUpdate(
                { 
                    userId: user._id,
                    subscriptionId: subscriptionId,
                    status: 'active'
                },
                {
                    status: 'cancelled', // Mark as cancelled but keep access
                    endDate: currentPeriodEnd,
                    cancellationDetails: {
                        cancelledAt: new Date(),
                        reason: 'User cancelled subscription',
                        accessUntil: currentPeriodEnd
                    }
                }
            );

            res.json({
                message: 'Subscription cancelled successfully. You can continue using your current plan until the end of the billing period.',
                endsAt: currentPeriodEnd,
                status: 'cancelled',
                canUseUntil: currentPeriodEnd,
                remainingDays: Math.ceil((currentPeriodEnd - new Date()) / (1000 * 60 * 60 * 24))
            });
        } catch (error) {
            console.error('Cancellation error:', error);
            res.status(400).json({ message: error.message });
        }
    }),

    // Get subscription details
    getSubscription: asyncHandler(async (req, res) => {
        const userId = req.params.userId || req.user._id;

        try {
            const user = await User.findById(userId).populate('currentPlan');
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Get the latest payment record for this user
            const payment = await Payment.findOne({ userId: user._id }).sort({ createdAt: -1 });

            // Check if subscription is ending
            const isEnding = user.subscriptionEndsAt && user.subscriptionStatus === 'active';

            const subscription = {
                plan: user.currentPlan,
                status: user.subscriptionStatus,
                endsAt: user.subscriptionEndsAt,
                trialEndsAt: user.trialEndsAt,
                usage: user.usage,
                isEnding,
                remainingDays: isEnding ?
                    Math.ceil((new Date(user.subscriptionEndsAt) - new Date()) / (1000 * 60 * 60 * 24)) :
                    null,
                subscriptionId: payment?.subscriptionId // Include the subscription ID from payment record
            };

            res.json(subscription);
        } catch (error) {
            console.error('Fetch subscription error:', error);
            res.status(400).json({ message: error.message });
        }
    }),

    // Handle Stripe webhook events
    handleWebhook: asyncHandler(async (req, res) => {
        const sig = req.headers['stripe-signature'];
        let event;

        try {
            event = stripe.webhooks.constructEvent(
                req.body,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            console.error('Webhook error:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Handle the event
        switch (event.type) {
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const user = await User.findOne({ stripeCustomerId: subscription.customer });

                if (user) {
                    // If subscription is active but scheduled for cancellation
                    if (subscription.status === 'active' && subscription.cancel_at_period_end) {
                        user.subscriptionStatus = 'active';
                        user.subscriptionEndsAt = new Date(subscription.current_period_end * 1000);
                    } else {
                        user.subscriptionStatus = subscription.status === 'active' ? 'active' : 'inactive';
                        user.subscriptionEndsAt = subscription.current_period_end ?
                            new Date(subscription.current_period_end * 1000) : null;
                    }

                    if (subscription.status === 'canceled' && new Date() >= new Date(subscription.current_period_end * 1000)) {
                        user.subscriptionStatus = 'cancelled';
                        user.currentPlan = null;
                    }

                    await user.save();

                    // Update payment record
                    await Payment.findOneAndUpdate(
                        { stripeSubscriptionId: subscription.id },
                        {
                            status: subscription.status,
                            endsAt: subscription.current_period_end ?
                                new Date(subscription.current_period_end * 1000) : null
                        }
                    );
                }
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const user = await User.findOne({ stripeCustomerId: invoice.customer });

                if (user) {
                    user.subscriptionStatus = 'past_due';
                    await user.save();
                }
                break;
            }
        }

        res.json({ received: true });
    }),

    // Get user's plan history and restrictions
    getUserPlanHistory: asyncHandler(async (req, res) => {
        const userId = req.params.userId || req.user._id;

        try {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Get all payment records for this user
            const payments = await Payment.find({ userId: user._id })
                .populate('planId')
                .sort({ createdAt: -1 });

            // Get current subscription status
            const currentSubscription = await Payment.findOne({
                userId: user._id,
                status: { $in: ['active', 'cancelled'] },
                endsAt: { $gt: new Date() }
            }).populate('planId').sort({ createdAt: -1 });

            // Calculate restrictions for each plan
            const planHistory = payments.map(payment => {
                const canResubscribe = !currentSubscription || 
                    currentSubscription._id.toString() !== payment._id.toString();

                return {
                    _id: payment._id,
                    plan: payment.planId,
                    status: payment.status,
                    subscribedAt: payment.createdAt,
                    endsAt: payment.endsAt,
                    amount: payment.amount,
                    currency: payment.currency,
                    paymentMethod: payment.paymentMethod,
                    canResubscribe,
                    isCurrentPlan: currentSubscription && 
                        currentSubscription._id.toString() === payment._id.toString()
                };
            });

            res.json({
                planHistory,
                currentSubscription: currentSubscription ? {
                    plan: currentSubscription.planId,
                    status: currentSubscription.status,
                    endsAt: currentSubscription.endsAt,
                    isEnding: currentSubscription.status === 'cancelled'
                } : null
            });

        } catch (error) {
            console.error('Plan history error:', error);
            res.status(400).json({ message: error.message });
        }
    }),

    // Get mobile plans (for IAP)
    getMobilePlans: asyncHandler(async (req, res) => {
        try {
            const { platform } = req.query; // 'ios', 'android', or undefined for all
            
            let query = { isActive: true };
            
            if (platform === 'ios') {
                query['platforms.ios'] = true;
                query.appleProductId = { $ne: null };
            } else if (platform === 'android') {
                query['platforms.android'] = true;
                query.googleProductId = { $ne: null };
            }

            const plans = await Plan.find(query).select({
                name: 1,
                description: 1,
                price: 1,
                features: 1,
                appleProductId: platform === 'ios' ? 1 : 0,
                googleProductId: platform === 'android' ? 1 : 0,
                stripeProductId: 1,
                stripePriceId: 1
            });

            res.status(200).json({
                status: 'ok',
                message: 'Plans retrieved successfully',
                data: {
                    plans,
                    platform: platform || 'all'
                }
            });

        } catch (error) {
            console.error('Error fetching mobile plans:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error while fetching plans'
            });
        }
    }),

    // Restore purchases (for iOS)
    restorePurchases: asyncHandler(async (req, res) => {
        try {
            const { receiptData } = req.body;
            const userId = req.user?._id;
            
            if (!userId) {
                return res.status(401).json({
                    status: 'error',
                    message: 'User authentication required'
                });
            }

            const user = await User.findById(userId);
            
            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }

            if (!receiptData) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Receipt data is required'
                });
            }

            // Validate receipt with Apple and get all transactions
            const appleValidation = await validateWithApple(receiptData, true);
            
            if (!appleValidation.isValid) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid receipt',
                    details: appleValidation.error
                });
            }

            // Find the latest valid subscription
            const latestSubscription = appleValidation.latestSubscription;
            
            if (latestSubscription) {
                const plan = await Plan.findOne({ appleProductId: latestSubscription.productId });
                
                if (plan) {
                    await User.findByIdAndUpdate(user._id, {
                        currentPlan: plan._id,
                        subscriptionStatus: latestSubscription.isActive ? 'active' : 'expired',
                        subscriptionEndsAt: new Date(latestSubscription.expiresDate),
                        remainingVoices: plan.features.voicesPerMonth,
                        remainingMeetings: plan.features.meetingsPerMonth,
                        appleTransactionId: latestSubscription.transactionId,
                        lastPaymentMethod: 'apple_iap'
                    });
                }
            }

            res.status(200).json({
                status: 'ok',
                message: 'Purchases restored successfully',
                data: {
                    hasActiveSubscription: latestSubscription?.isActive || false,
                    subscriptionEndsAt: latestSubscription?.expiresDate || null
                }
            });

        } catch (error) {
            console.error('Restore purchases error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error during purchase restoration'
            });
        }
    }),

    // Usage tracking routes handlers
    incrementVoiceUsage: asyncHandler(async (req, res) => {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }

        // Check if user has an active subscription
        if (!user.hasActiveSubscription() && !user.isInTrial()) {
            res.status(403);
            throw new Error('Active subscription required');
        }

        await user.populate('currentPlan');
        const plan = user.currentPlan;

        // Check if user has exceeded monthly limit
        if (user.usage.voicesUsed >= plan.features.voicesPerMonth) {
            res.status(403);
            throw new Error('Monthly voice usage limit reached');
        }

        // Increment usage
        await user.incrementUsage('voice');
        
        // Update usage in plan history
        await paymentController.updatePlanHistoryUsage(
            userId,
            user.subscriptionId,
            'voice'
        );

        res.json({ success: true, voicesUsed: user.usage.voicesUsed });
    }),

    incrementMeetingUsage: asyncHandler(async (req, res) => {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }

        // Check if user has an active subscription
        if (!user.hasActiveSubscription() && !user.isInTrial()) {
            res.status(403);
            throw new Error('Active subscription required');
        }

        await user.populate('currentPlan');
        const plan = user.currentPlan;

        // Check if user has exceeded monthly limit
        if (user.usage.meetingsUsed >= plan.features.meetingsPerMonth) {
            res.status(403);
            throw new Error('Monthly meeting usage limit reached');
        }

        // Increment usage
        await user.incrementUsage('meeting');
        
        // Update usage in plan history
        await paymentController.updatePlanHistoryUsage(
            userId,
            user.subscriptionId,
            'meeting'
        );

        res.json({ success: true, meetingsUsed: user.usage.meetingsUsed });
    }),

    // Check feature access
    checkFeatureAccess: asyncHandler(async (req, res) => {
        const userId = req.user._id;
        const { featureName } = req.params;

        try {
            const user = await User.findById(userId).populate('currentPlan');
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Check if user has an active subscription
            if (!user.hasActiveSubscription()) {
                return res.status(403).json({ message: 'No active subscription found' });
            }

            // Check if user has access to the requested feature
            const hasAccess = await user.canUseFeature(featureName);

            res.json({
                hasAccess,
                feature: featureName,
                subscriptionStatus: user.subscriptionStatus,
                planName: user.currentPlan.name
            });
        } catch (error) {
            console.error('Feature access check error:', error);
            res.status(400).json({ message: error.message });
        }
    }),

    // Update the getDetailedPlanHistory function to properly show cancelled but usable subscriptions
    getDetailedPlanHistory: asyncHandler(async (req, res) => {
        const userId = req.params.userId || req.user._id;

        try {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Get complete plan history
            const planHistory = await PlanHistory.find({ userId })
                .populate('planId')
                .populate('paymentId')
                .sort({ startDate: -1 });

            // Get current active or usable cancelled subscription
            const currentSubscription = planHistory.find(history => {
                if (history.status === 'active') return true;
                
                // Include cancelled subscriptions that are still usable
                if (history.status === 'cancelled' && 
                    history.endDate && 
                    new Date(history.endDate) > new Date()) {
                    return true;
                }
                
                return false;
            });

            // Process history records
            const processedHistory = planHistory.map(record => {
                // Determine the actual status and access state
                let currentStatus = record.status;
                let accessState = {
                    hasAccess: false,
                    accessEndsAt: null
                };
                
                // Handle active subscriptions
                if (currentStatus === 'active') {
                    accessState.hasAccess = true;
                    accessState.accessEndsAt = record.endDate;
                }
                
                // Handle cancelled subscriptions
                if (currentStatus === 'cancelled') {
                    const endDate = new Date(record.endDate);
                    const now = new Date();
                    
                    if (endDate > now) {
                        accessState.hasAccess = true;
                        accessState.accessEndsAt = endDate;
                    } else {
                        currentStatus = 'expired';
                        accessState.hasAccess = false;
                    }
                }

                return {
                    plan: record.planId,
                    subscriptionId: record.subscriptionId,
                    subscriptionPeriod: {
                        start: record.startDate,
                        end: record.endDate
                    },
                    status: currentStatus,
                    access: accessState,
                    usage: {
                        voices: {
                            used: record.usageMetrics.voicesUsed,
                            limit: record.usageMetrics.voicesLimit
                        },
                        meetings: {
                            used: record.usageMetrics.meetingsUsed,
                            limit: record.usageMetrics.meetingsLimit
                        },
                        lastReset: record.usageMetrics.lastResetDate
                    },
                    billing: {
                        amount: record.billingDetails.amount,
                        currency: record.billingDetails.currency,
                        interval: record.billingDetails.interval,
                        isFreePlan: record.billingDetails.isFreePlan
                    },
                    coupon: record.couponApplied,
                    trial: record.trialPeriod,
                    cancellation: record.cancellationDetails,
                    isCurrentPlan: currentSubscription ? 
                        currentSubscription._id.toString() === record._id.toString() : 
                        false,
                    canResubscribe: calculateResubscribeEligibility(record)
                };
            });

            res.json({
                currentPlan: currentSubscription ? {
                    subscriptionId: currentSubscription.subscriptionId,
                    ...currentSubscription.planId.toObject(),
                    status: currentSubscription.status,
                    usage: currentSubscription.usageMetrics,
                    endsAt: currentSubscription.endDate,
                    isCancelled: currentSubscription.status === 'cancelled',
                    hasAccess: true,
                    accessEndsAt: currentSubscription.endDate
                } : null,
                planHistory: processedHistory,
           });

        } catch (error) {
            console.error('Fetch detailed plan history error:', error);
            res.status(400).json({ message: error.message });
        }
    }),

    // Helper function to create plan history record
    createPlanHistoryRecord: asyncHandler(async (user, plan, subscription, payment, coupon = null) => {
        try {
            const historyRecord = {
                userId: user._id,
                planId: plan._id,
                paymentId: payment._id,
                startDate: new Date(subscription.current_period_start * 1000),
                endDate: new Date(subscription.current_period_end * 1000),
                status: subscription.status,
                subscriptionId: subscription.id,
                stripeCustomerId: user.stripeCustomerId,
                usageMetrics: {
                    voicesUsed: 0,
                    meetingsUsed: 0,
                    voicesLimit: plan.features.voicesPerMonth,
                    meetingsLimit: plan.features.meetingsPerMonth,
                    lastResetDate: new Date()
                },
                billingDetails: {
                    amount: plan.price.amount,
                    currency: plan.price.currency,
                    interval: 'month', // or get from plan
                    isFreePlan: plan.price.amount === 0
                },
                trialPeriod: {
                    isTrialPeriod: !!subscription.trial_end,
                    trialStartDate: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
                    trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
                }
            };

            if (coupon) {
                historyRecord.couponApplied = {
                    code: coupon.code,
                    discountPercentage: coupon.discountPercentage
                };
            }

            const planHistory = await PlanHistory.create(historyRecord);
            return planHistory;
        } catch (error) {
            console.error('Error creating plan history record:', error);
            throw error;
        }
    }),

    // Helper function to update plan history usage
    updatePlanHistoryUsage: asyncHandler(async (userId, subscriptionId, usageType) => {
        try {
            const historyRecord = await PlanHistory.findOne({
                userId,
                status: { $in: ['active', 'cancelled'] },
                endDate: { $gt: new Date() }
            }).sort({ startDate: -1 });

            if (!historyRecord) {
                console.error('No active plan history record found for user:', userId);
                return;
            }

            const updateField = usageType === 'voice' ? 
                'usageMetrics.voicesUsed' : 'usageMetrics.meetingsUsed';

            await PlanHistory.findByIdAndUpdate(
                historyRecord._id,
                { 
                    $inc: { [updateField]: 1 },
                    $set: { 'usageMetrics.lastResetDate': new Date() }
                },
                { new: true }
            );

        } catch (error) {
            console.error('Error updating plan history usage:', error);
            throw error;
        }
    })
};

// Helper function to determine if user can resubscribe to a plan
function calculateResubscribeEligibility(historyRecord) {
    // Free plan can only be used once
    if (historyRecord.billingDetails.isFreePlan && historyRecord.status !== 'active') {
        return false;
    }

    // Can't resubscribe to cancelled plan until it expires
    if (historyRecord.status === 'cancelled' && new Date(historyRecord.endDate) > new Date()) {
        return false;
    }

    // Can't subscribe to current active plan
    if (historyRecord.status === 'active') {
        return false;
    }

    return true;
}

// Helper function to validate Apple receipt
async function validateWithApple(receiptData, includeHistory = false) {
    try {
        const isProduction = process.env.NODE_ENV === 'production';
        const appleUrl = isProduction 
            ? 'https://buy.itunes.apple.com/verifyReceipt'
            : 'https://sandbox.itunes.apple.com/verifyReceipt';

        const requestBody = {
            'receipt-data': receiptData,
            'password': process.env.APPLE_SHARED_SECRET,
            'exclude-old-transactions': !includeHistory
        };

        const response = await axios.post(appleUrl, requestBody, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        const { status, receipt, latest_receipt_info } = response.data;

        if (status === 0) {
            // Receipt is valid
            if (includeHistory && latest_receipt_info) {
                // Find the latest subscription
                const latestTransaction = latest_receipt_info
                    .sort((a, b) => parseInt(b.expires_date_ms) - parseInt(a.expires_date_ms))[0];
                
                return {
                    isValid: true,
                    latestSubscription: {
                        productId: latestTransaction.product_id,
                        transactionId: latestTransaction.transaction_id,
                        expiresDate: parseInt(latestTransaction.expires_date_ms),
                        isActive: parseInt(latestTransaction.expires_date_ms) > Date.now()
                    }
                };
            }
            
            return { isValid: true, receipt };
        } else {
            return { 
                isValid: false, 
                error: `Apple validation failed with status: ${status}` 
            };
        }

    } catch (error) {
        console.error('Apple validation error:', error);
        return { 
            isValid: false, 
            error: 'Failed to validate with Apple servers' 
        };
    }
}

// Helper function to validate Google Play purchase
async function validateWithGoogle(purchaseToken, productId) {
    try {
        const packageName = process.env.GOOGLE_PACKAGE_NAME;
        const accessToken = await getGoogleAccessToken();

        const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        const purchaseData = response.data;
        
        // Check if purchase is valid and not cancelled
        const isValid = purchaseData.purchaseState === 0 && // Purchased
                        !purchaseData.cancelReason &&
                        parseInt(purchaseData.expiryTimeMillis) > Date.now();

        return { 
            isValid, 
            purchaseData,
            error: !isValid ? 'Purchase is not valid or expired' : null
        };

    } catch (error) {
        console.error('Google validation error:', error);
        return { 
            isValid: false, 
            error: 'Failed to validate with Google Play servers' 
        };
    }
}

// Helper function to get Google Play access token
async function getGoogleAccessToken() {
    try {
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        
        const jwtPayload = {
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/androidpublisher',
            aud: 'https://oauth2.googleapis.com/token',
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000)
        };

        const token = jwt.sign(jwtPayload, serviceAccount.private_key, { algorithm: 'RS256' });

        const response = await axios.post('https://oauth2.googleapis.com/token', {
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: token
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return response.data.access_token;

    } catch (error) {
        console.error('Error getting Google access token:', error);
        throw new Error('Failed to get Google access token');
    }
}

export default paymentController;