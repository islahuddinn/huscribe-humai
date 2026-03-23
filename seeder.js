import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import { defaultPlans } from './data/defaultPlans.js';
import Plan from './models/planModel.js';
import connectDb from './db.js';

dotenv.config();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Connect to database
connectDb();

// Import data
const importData = async () => {
    try {
        // Clear existing plans
        await Plan.deleteMany();
        console.log('Cleared existing plans from database');

        // Get all products and prices from Stripe
        const [products, prices] = await Promise.all([
            stripe.products.list({ limit: 100, active: true }),
            stripe.prices.list({ limit: 100, active: true })
        ]);

        // First, archive all prices
        console.log('Archiving existing prices in Stripe...');
        for (const price of prices.data) {
            await stripe.prices.update(price.id, { active: false });
        }

        // Then, try to archive or delete products
        console.log('Processing existing products in Stripe...');
        for (const product of products.data) {
            try {
                await stripe.products.del(product.id);
                console.log(`Deleted product: ${product.name}`);
            } catch (error) {
                console.log(`Archiving product instead: ${product.name}`);
                await stripe.products.update(product.id, { active: false });
            }
        }

        console.log('Creating plans...');

        // Create plans in Stripe and database
        for (const planData of defaultPlans) {
            console.log(`Processing ${planData.name} plan...`);

            try {
                // Create product in Stripe
                const product = await stripe.products.create({
                    name: planData.name,
                    description: planData.description,
                    active: true,
                    metadata: {
                        voicesPerMonth: planData.features.voicesPerMonth.toString(),
                        meetingsPerMonth: planData.features.meetingsPerMonth.toString()
                    }
                });
                console.log(`Created Stripe product for ${planData.name}`);

                // Create price in Stripe
                const price = await stripe.prices.create({
                    product: product.id,
                    unit_amount: Math.round(planData.price.amount * 100), // Convert to cents
                    currency: planData.price.currency,
                    recurring: {
                        interval: 'month'
                    },
                    active: true
                });
                console.log(`Created Stripe price for ${planData.name}`);

                // Create plan in database with all necessary data
                const plan = await Plan.create({
                    name: planData.name,
                    description: planData.description,
                    price: planData.price,
                    features: planData.features,
                    stripeProductId: product.id,
                    stripePriceId: price.id,
                    isActive: true
                });

                console.log(`Created database entry for ${planData.name}:`, {
                    name: plan.name,
                    price: plan.price,
                    features: plan.features
                });

            } catch (error) {
                console.error(`Error processing ${planData.name} plan:`, error.message);
                throw error;
            }
        }

        // Verify all plans were created
        const createdPlans = await Plan.find({});
        console.log('\nCreated Plans Summary:');
        createdPlans.forEach(plan => {
            console.log(`${plan.name}:`, {
                price: plan.price,
                features: plan.features
            });
        });

        console.log('\nAll Data Imported Successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

// Delete data
const destroyData = async () => {
    try {
        // Delete all plans from database
        await Plan.deleteMany();
        console.log('Database plans deleted');

        // Get all products and prices from Stripe
        const [products, prices] = await Promise.all([
            stripe.products.list({ limit: 100, active: true }),
            stripe.prices.list({ limit: 100, active: true })
        ]);

        // First, archive all prices
        console.log('Archiving prices in Stripe...');
        for (const price of prices.data) {
            await stripe.prices.update(price.id, { active: false });
        }

        // Then, try to archive or delete products
        console.log('Processing products in Stripe...');
        for (const product of products.data) {
            try {
                await stripe.products.del(product.id);
                console.log(`Deleted product: ${product.name}`);
            } catch (error) {
                console.log(`Archiving product instead: ${product.name}`);
                await stripe.products.update(product.id, { active: false });
            }
        }

        console.log('All Data Destroyed!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

// Run script with argument
if (process.argv[2] === '-d') {
    destroyData();
} else {
    importData();
} 