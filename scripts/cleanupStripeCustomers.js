import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import User from '../models/userModel.js';

// Load environment variables
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const cleanupStripeCustomers = async () => {
  try {
    console.log('🧹 Stripe Customer Cleanup Script Started');
    
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB successfully');

    // Find all users with Stripe customer IDs
    console.log('\n🔍 Finding users with Stripe customer IDs...');
    const usersWithStripeIds = await User.find({
      stripeCustomerId: { $ne: null, $exists: true }
    });

    console.log(`📊 Found ${usersWithStripeIds.length} users with Stripe customer IDs`);

    if (usersWithStripeIds.length === 0) {
      console.log('✅ No users with Stripe customer IDs found');
      return;
    }

    let validCustomers = 0;
    let invalidCustomers = 0;
    let cleanedUsers = [];

    for (const user of usersWithStripeIds) {
      console.log(`\n🔍 Checking customer: ${user.stripeCustomerId} for user: ${user.email}`);
      
      try {
        // Try to retrieve the customer from Stripe
        const customer = await stripe.customers.retrieve(user.stripeCustomerId);
        
        if (customer.deleted) {
          console.log(`❌ Customer ${user.stripeCustomerId} is deleted in Stripe`);
          await cleanupUserStripeData(user);
          invalidCustomers++;
          cleanedUsers.push(user.email);
        } else {
          console.log(`✅ Customer ${user.stripeCustomerId} is valid`);
          validCustomers++;
        }
      } catch (error) {
        if (error.code === 'resource_missing') {
          console.log(`❌ Customer ${user.stripeCustomerId} not found in Stripe`);
          await cleanupUserStripeData(user);
          invalidCustomers++;
          cleanedUsers.push(user.email);
        } else {
          console.log(`⚠️  Error checking customer ${user.stripeCustomerId}:`, error.message);
        }
      }
    }

    console.log('\n📊 Cleanup Summary:');
    console.log(`✅ Valid customers: ${validCustomers}`);
    console.log(`❌ Invalid customers cleaned: ${invalidCustomers}`);
    
    if (cleanedUsers.length > 0) {
      console.log('\n🧹 Cleaned users:');
      cleanedUsers.forEach(email => console.log(`  - ${email}`));
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n📝 Database connection closed.');
    process.exit(0);
  }
};

const cleanupUserStripeData = async (user) => {
  try {
    console.log(`🧹 Cleaning Stripe data for user: ${user.email}`);
    
    // Reset Stripe-related fields
    user.stripeCustomerId = null;
    user.stripeSubscriptionId = null;
    user.subscriptionStatus = 'inactive';
    user.subscriptionEndsAt = null;
    
    await user.save();
    console.log(`✅ Cleaned Stripe data for user: ${user.email}`);
  } catch (error) {
    console.error(`❌ Error cleaning user ${user.email}:`, error.message);
  }
};

cleanupStripeCustomers(); 