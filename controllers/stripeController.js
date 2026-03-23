import stripe from '../config/stripeConfig.js';
import Plan from '../models/planModel.js';
import User from '../models/userModel.js';

export const createCheckoutSession = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const userId = req.user._id;

  try {
    const user = await User.findById(userId);
    const plan = await Plan.findById(planId);

    if (!user || !plan) {
      res.status(404);
      throw new Error('User or Plan not found');
    }

    /////// Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      customer: user.stripeCustomerId || undefined,
      metadata: {
        userId: userId.toString(),
        planId: planId.toString(),
      },
    });

    res.status(200).json({ status: true, url: session.url });
  } catch (error) {
    res.status(500);
    throw new Error(`Error creating checkout session: ${error.message}`);
  }
});

export const handleStripeWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  /////// Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;

      const user = await User.findById(session.metadata.userId);
      const plan = await Plan.findById(session.metadata.planId);

      if (user && plan) {
        user.currentPlan = plan._id;
        user.stripeSubscriptionId = session.subscription;
        user.subscriptionStatus = 'active';
        user.subscriptionEndsAt = new Date(session.current_period_end * 1000);
        user.remainingVoices = plan.voices;
        user.remainingMeetings = plan.meetings;

        await user.save();
      }
      break;

    case 'customer.subscription.updated':
      const subscription = event.data.object;

      // Update user's subscription status if cancelled or past due
      const subUser = await User.findOne({ stripeSubscriptionId: subscription.id });

      if (subUser) {
        if (subscription.status === 'canceled' || subscription.status === 'past_due') {
          subUser.subscriptionStatus = subscription.status;
          subUser.subscriptionEndsAt = new Date(subscription.current_period_end * 1000);
          await subUser.save();
        }
      }
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
});

export const purchaseAdditionalFeatures = asyncHandler(async (req, res) => {
  const { type, quantity } = req.body;
  const userId = req.user._id;

  try {
    const user = await User.findById(userId).populate('currentPlan');

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    let priceId;
    let amount;

    if (type === 'voice') {
      priceId = process.env.STRIPE_ADDITIONAL_VOICE_PRICE_ID;
      amount = user.currentPlan.additionalVoicePrice * quantity;
    } else if (type === 'meeting') {
      priceId = process.env.STRIPE_ADDITIONAL_MEETING_PRICE_ID;
      amount = user.currentPlan.additionalMeetingPrice * quantity;
    } else {
      res.status(400);
      throw new Error('Invalid feature type');
    }

    // Create a Stripe Checkout Session for additional features
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: quantity,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      customer: user.stripeCustomerId,
      metadata: {
        userId: userId.toString(),
        type: type,
        quantity: quantity.toString(),
      },
    });

    res.status(200).json({ status: true, url: session.url });
  } catch (error) {
    res.status(500);
    throw new Error(`Error purchasing additional features: ${error.message}`);
  }
});