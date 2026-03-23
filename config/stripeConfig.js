import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_S_SECRET_KEY);

export default stripe;