import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/userModel.js';

// Load environment variables
dotenv.config();

const verifyAdmin = async () => {
  console.log('🚀 Starting admin verification...');
  console.log('📋 Environment check:');
  console.log(`- MONGO_URI exists: ${!!process.env.MONGO_URI}`);
  console.log(`- MONGO_URI: ${process.env.MONGO_URI ? process.env.MONGO_URI.substring(0, 20) + '...' : 'NOT SET'}`);

  try {
    // Connect to MongoDB
    console.log('🔌 Attempting to connect to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB successfully');

    const email = 'admin@huscribe.com';
    const testPassword = 'Admin123!';

    console.log(`\n🔍 Looking for admin user with email: ${email}`);

    // Find the admin user
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log('❌ Admin user not found!');
      
      // Let's check if there are any users at all
      const userCount = await User.countDocuments();
      console.log(`📊 Total users in database: ${userCount}`);
      
      if (userCount > 0) {
        const allUsers = await User.find({}, { email: 1, isAdmin: 1 }).limit(5);
        console.log('📋 Sample users:');
        allUsers.forEach(u => console.log(`  - ${u.email} (isAdmin: ${u.isAdmin})`));
      }
      
      process.exit(1);
    }

    console.log('✅ Admin user found:');
    console.log(`- ID: ${user._id}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Name: ${user.first_name} ${user.last_name}`);
    console.log(`- isAdmin: ${user.isAdmin}`);
    console.log(`- Status: ${user.status}`);
    console.log(`- Email verified: ${user.email_verified}`);
    console.log(`- Password exists: ${!!user.password}`);
    console.log(`- Password length: ${user.password ? user.password.length : 'N/A'}`);
    console.log(`- Password starts with: ${user.password ? user.password.substring(0, 10) + '...' : 'N/A'}`);

    if (!user.password) {
      console.log('❌ Password field is missing or empty!');
      process.exit(1);
    }

    // Test password comparison
    console.log('\n🔍 Testing password comparison...');
    console.log(`Testing password: "${testPassword}"`);
    const isMatch = await bcrypt.compare(testPassword, user.password);
    console.log(`- Password "${testPassword}" matches: ${isMatch ? '✅ YES' : '❌ NO'}`);

    // Test password variations
    console.log('\n🧪 Testing password variations:');
    const passwordVariations = [
      'Admin123!',
      'Huscribe@123',
      'admin123!',
      'ADMIN123!',
      'Admin@123'
    ];

    for (const variation of passwordVariations) {
      const matches = await bcrypt.compare(variation, user.password);
      console.log(`- "${variation}": ${matches ? '✅ MATCH' : '❌ NO MATCH'}`);
    }

    // Check if password field is properly selected
    console.log('\n📋 User object keys:', Object.keys(user.toObject()));

    // Test bcrypt directly
    console.log('\n🔧 Testing bcrypt functionality:');
    const testHash = await bcrypt.hash('test123', 12);
    const testCompare = await bcrypt.compare('test123', testHash);
    console.log(`- Bcrypt test: ${testCompare ? '✅ Working' : '❌ Failed'}`);

  } catch (error) {
    console.error('❌ Error verifying admin user:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n📝 Database connection closed.');
    }
    process.exit(0);
  }
};

console.log('🎯 Admin Verification Script Started');
verifyAdmin().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
}); 