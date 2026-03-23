import Stripe from 'stripe';
import Plan from '../models/planModel.js';
import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import sgMail from '@sendgrid/mail';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Reusable function to send emails
const sendEmail = async (to, subject, html) => {
    const msg = {
        to,
        from: {
            email: process.env.EMAIL_FROM,
            name: "Hupply Support"
        },
        subject,
        html
    };

    try {
        await sgMail.send(msg);
    } catch (error) {
        console.error('SendGrid Error:', {
            message: error.message,
            response: error.response?.body,
            code: error.code
        });

        // Check for specific SendGrid errors
        if (error.code === 403) {
            throw new Error('Email sending failed: Sender verification required. Please verify your sender identity in SendGrid.');
        } else {
            throw new Error(`Email sending failed: ${error.message}`);
        }
    }
};

const planController = {
    // Get all plans from database
    getPlans: asyncHandler(async (req, res) => {
        try {
            // Get all active plans from database, sorted by price
            const plans = await Plan.find({ isActive: true }).sort({ 'price.amount': 1 });

            if (!plans || plans.length === 0) {
                return res.status(404).json({ message: 'No active plans found' });
            }

            res.json(plans);
        } catch (error) {
            console.error('Error fetching plans from database:', error);
            res.status(500).json({ message: error.message });
        }
    }),
    // Get all plans from database
    getPlansForAdmin: asyncHandler(async (req, res) => {
        try {
            // Get all active plans from database, sorted by price
            const plans = await Plan.find({}).sort({ 'price.amount': 1 });

            if (!plans || plans.length === 0) {
                return res.status(404).json({ message: 'No active plans found' });
            }

            res.json(plans);
        } catch (error) {
            console.error('Error fetching plans from database:', error);
            res.status(500).json({ message: error.message });
        }
    }),

    // Get single plan
    getPlan: asyncHandler(async (req, res) => {
        try {
            const plan = await Plan.findById(req.params.id);
            if (!plan) {
                return res.status(404).json({ message: 'Plan not found' });
            }
            res.json(plan);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }),

    // Create new plan (admin only)
    createPlan: asyncHandler(async (req, res) => {
        try {
            const { name, description, price, features } = req.body;

            // Create product in Stripe
            const product = await stripe.products.create({
                name,
                description,
                active: true,
                metadata: {
                    ...features,
                    rfqsPerMonth: features.rfqsPerMonth.toString(),
                    suppliersPerRfq: features.suppliersPerRfq.toString(),
                    whatsappAccess: features.whatsappAccess.toString(),
                    emailAccess: features.emailAccess.toString(),
                    webAccess: features.webAccess.toString(),
                    personalization: features.personalization.toString(),
                    publicDb: features.publicDb.toString()
                }
            });

            // Create price in Stripe
            const stripePrice = await stripe.prices.create({
                product: product.id,
                unit_amount: Math.round(price.amount * 100), // Convert to cents
                currency: price.currency,
                recurring: {
                    interval: 'month'
                },
                active: true
            });

            // Create plan in our database
            const plan = await Plan.create({
                name,
                description,
                price,
                features,
                stripeProductId: product.id,
                stripePriceId: stripePrice.id,
                isActive: true
            });

            res.status(200).json({ message: "Record Added!", status: "ok", data: plan });

        } catch (error) {
            console.error('Error creating plan:', error);
            res.status(500).json({ message: error.message });
        }
    }),

    // Update plan (admin only)
    updatePlan: asyncHandler(async (req, res) => {
        try {
            const plan = await Plan.findById(req.params.id);
            if (!plan) {
                return res.status(404).json({ message: 'Plan not found' });
            }

            const { name, description, features, isActive } = req.body;

            // Update product in Stripe
            await stripe.products.update(plan.stripeProductId, {
                name,
                description,
                active: isActive,
                metadata: {
                    ...features,
                    rfqsPerMonth: features.rfqsPerMonth.toString(),
                    suppliersPerRfq: features.suppliersPerRfq.toString(),
                    whatsappAccess: features.whatsappAccess.toString(),
                    emailAccess: features.emailAccess.toString(),
                    webAccess: features.webAccess.toString(),
                    personalization: features.personalization.toString(),
                    publicDb: features.publicDb.toString()
                }
            });

            // Update plan in database
            const updatedPlan = await Plan.findByIdAndUpdate(
                req.params.id,
                { name, description, features, isActive },
                { new: true }
            );

            res.status(200).json({ message: "Record Updated!", status: "ok", data: updatedPlan });
        } catch (error) {
            console.error('Error updating plan:', error);
            res.status(500).json({ message: error.message });
        }
    }),

    // Delete plan (admin only)
    deletePlan: asyncHandler(async (req, res) => {
        try {
            const plan = await Plan.findById(req.params.id);
            if (!plan) {
                return res.status(404).json({ message: 'Plan not found' });
            }

            // Archive product in Stripe (don't delete to maintain subscription history)
            await stripe.products.update(plan.stripeProductId, {
                active: false
            });

            // Deactivate price in Stripe
            await stripe.prices.update(plan.stripePriceId, {
                active: false
            });

            // Mark plan as inactive in database
            plan.isActive = false;
            await plan.save();

            res.json({ message: 'Plan deleted successfully', status: "ok" });
        } catch (error) {
            console.error('Error deleting plan:', error);
            res.status(500).json({ message: error.message });
        }
    }),

    // Get user's current plan
    getUserCurrentPlan: asyncHandler(async (req, res) => {
        try {
            const userId = req.params.userId;
            const user = await User.findById(userId).populate('currentPlan');

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            if (!user.currentPlan) {
                return res.status(404).json({ message: 'No active plan found for this user' });
            }
            res.json({ plan: user.currentPlan.name, status: "ok" });
        } catch (error) {
            console.error('Error fetching user plan:', error);
            res.status(500).json({ message: error.message, status: "error" });
        }
    }),

    // Send email notification for plan quota exhaustion
    sendPlanQuotaEmail: asyncHandler(async (req, res) => {
        try {
            const { userId } = req.body;
            const user = await User.findById(userId).populate('currentPlan');

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const emailHtml = `
                <h2>Hello ${user.first_name},</h2>
                <p>We noticed that you've reached the quota limit of your current plan (${user.currentPlan.name}).</p>
                <p>To continue enjoying our services without interruption, please consider upgrading your plan.</p>
                <p>Benefits of upgrading include:</p>
                <ul>
                    <li>More RFQs per month</li>
                    <li>Increased suppliers per RFQ</li>
                    <li>Additional features and capabilities</li>
                </ul>
                <p>Visit our pricing page to explore available plans and upgrade options.</p>
                <p>Thank you for using our service!</p>
            `;

            await sendEmail(
                user.email,
                'Plan Quota Exhausted - Time to Upgrade!',
                emailHtml
            );

            res.json({
                success: true,
                message: 'Quota notification email sent successfully'
            });
        } catch (error) {
            console.error('Error sending quota notification email:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to send email notification'
            });
        }
    })
};

export default planController; 