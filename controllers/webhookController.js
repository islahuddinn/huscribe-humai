import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
import Payment from '../models/paymentModel.js';

export const handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    // Log incoming webhook details (safely)
    console.log('Received webhook with signature:', sig);
    console.log('Webhook endpoint secret being used:', process.env.STRIPE_WEBHOOK_SECRET);

    try {
        // Verify the webhook signature
        // The req.body is already a raw buffer because of express.raw() middleware in the route
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET.trim() // Trim to remove any whitespace
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        console.error('Full error:', err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Log successful verification
    console.log('Webhook signature verified successfully. Event type:', event.type);

    // Handle different webhook events
    try {
        switch (event.type) {
            case 'invoice.payment_succeeded':
                await handleSuccessfulPayment(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handleFailedPayment(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionCanceled(event.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Error processing webhook:', err);
        res.status(500).json({ error: err.message });
    }
};

// Handle successful payment
async function handleSuccessfulPayment(invoice) {
    try {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const payment = await Payment.findOne({ subscriptionId: invoice.subscription });

        if (payment) {
            // Update payment record
            payment.status = 'active';
            payment.lastBillingDate = new Date();
            payment.nextBillingDate = new Date(subscription.current_period_end * 1000);
            payment.amount = invoice.amount_paid / 100;

            // Reset usage quotas for new billing cycle
            payment.usage = {
                voicesUsed: 0,
                meetingsUsed: 0,
                lastResetDate: new Date()
            };

            await payment.save();

            console.log(`Payment successful for subscription ${invoice.subscription}, usage quotas reset`);
        }
    } catch (error) {
        console.error('Error handling successful payment:', error);
    }
}

// Handle failed payment
async function handleFailedPayment(invoice) {
    try {
        const payment = await Payment.findOne({ subscriptionId: invoice.subscription });

        if (payment) {
            payment.status = 'past_due';
            await payment.save();

            // You could add notification logic here
            console.log(`Payment failed for subscription ${invoice.subscription}`);
        }
    } catch (error) {
        console.error('Error handling failed payment:', error);
    }
}

// Handle subscription cancellation
async function handleSubscriptionCanceled(subscription) {
    try {
        const payment = await Payment.findOne({ subscriptionId: subscription.id });

        if (payment) {
            payment.status = 'canceled';
            await payment.save();

            console.log(`Subscription ${subscription.id} canceled`);
        }
    } catch (error) {
        console.error('Error handling subscription cancellation:', error);
    }
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription) {
    try {
        const payment = await Payment.findOne({ subscriptionId: subscription.id });

        if (payment) {
            payment.status = subscription.status;
            payment.nextBillingDate = new Date(subscription.current_period_end * 1000);

            // Check if this is a new billing period by comparing current_period_start with lastResetDate
            const currentPeriodStart = new Date(subscription.current_period_start * 1000);
            if (!payment.usage?.lastResetDate || currentPeriodStart > payment.usage.lastResetDate) {
                // Reset usage quotas for new billing period
                payment.usage = {
                    voicesUsed: 0,
                    meetingsUsed: 0,
                    lastResetDate: new Date()
                };
                console.log(`Usage quotas reset for subscription ${subscription.id} - new billing period started`);
            }

            await payment.save();

            console.log(`Subscription ${subscription.id} updated`);
        }
    } catch (error) {
        console.error('Error handling subscription update:', error);
    }
} 