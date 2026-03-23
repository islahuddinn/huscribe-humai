import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/userModel.js';
import generateAdminToken from '../utils/generateAdminToken.js';

// Load environment variables
dotenv.config();

const testAdminLogin = async () => {
  try {
    console.log('🧪 Admin Login Test Script Started');
    
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB successfully');

    // Test credentials
    const email = 'admin@huscribe.com';
    const password = 'Admin123!';
    
    console.log(`\n🔍 Testing login for: ${email}`);
    console.log(`🔑 Using password: ${password}`);
    
    // Find user and select password
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log('❌ User not found!');
      process.exit(1);
    }
    
    console.log('✅ User found');
    console.log(`- Name: ${user.first_name} ${user.last_name}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Admin Status: ${user.isAdmin}`);
    console.log(`- Account Status: ${user.status}`);
    
    // Check if user is admin
    if (!user.isAdmin) {
      console.log('❌ User is not an admin!');
      process.exit(1);
    }
    
    // Check account status
    if (user.status === 'inactive' || user.status === 'suspended') {
      console.log(`❌ Account is ${user.status}!`);
      process.exit(1);
    }
    
    // Verify password
    console.log('\n🔐 Verifying password...');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log(`- Password verification: ${isPasswordValid ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (!isPasswordValid) {
      console.log('❌ Invalid password!');
      process.exit(1);
    }
    
    // Generate admin token
    console.log('\n🎫 Generating admin token...');
    const token = generateAdminToken(user._id);
    console.log('✅ Admin token generated successfully');
    console.log(`- Token length: ${token.length} characters`);
    console.log(`- Token preview: ${token.substring(0, 50)}...`);
    
    // Simulate successful login response
    console.log('\n🎉 Admin login test completed successfully!');
    console.log('📋 Login Response:');
    console.log({
      success: true,
      message: 'Admin login successful',
      admin: {
        id: user._id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        isAdmin: user.isAdmin,
        status: user.status
      },
      token: `${token.substring(0, 20)}...`
    });
    
  } catch (error) {
    console.error('❌ Error testing admin login:', error.message);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n📝 Database connection closed.');
    process.exit(0);
  }
};

testAdminLogin(); 