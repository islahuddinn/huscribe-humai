import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/userModel.js';

// Load environment variables
dotenv.config();

const resetAdminPassword = async () => {
  try {
    console.log('🔄 Admin Password Reset Script Started');
    
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB successfully');

    // Find the admin user
    const adminEmail = 'admin@huscribe.com';
    const newPassword = 'Admin123!';
    
    console.log(`\n🔍 Looking for admin user: ${adminEmail}`);
    const adminUser = await User.findOne({ email: adminEmail });
    
    if (!adminUser) {
      console.log('❌ Admin user not found!');
      process.exit(1);
    }
    
    console.log('✅ Admin user found');
    console.log(`- Name: ${adminUser.first_name} ${adminUser.last_name}`);
    console.log(`- Email: ${adminUser.email}`);
    console.log(`- Admin Status: ${adminUser.isAdmin}`);
    
    // Set the password as plain text - the pre-save middleware will hash it
    console.log('\n🔐 Setting new password...');
    console.log('ℹ️  Note: Password will be hashed by the User model pre-save middleware');
    adminUser.password = newPassword;
    
    // Save the user - this will trigger the pre-save middleware to hash the password
    console.log('💾 Saving admin user...');
    await adminUser.save();
    console.log('✅ Password updated successfully');
    
    // Verify the new password by fetching the user again and comparing
    console.log('\n🧪 Verifying new password...');
    const updatedUser = await User.findOne({ email: adminEmail }).select('+password');
    const isMatch = await bcrypt.compare(newPassword, updatedUser.password);
    console.log(`- Password verification: ${isMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (isMatch) {
      console.log('\n🎉 Admin password reset completed successfully!');
      console.log('📋 New Login Credentials:');
      console.log(`- Email: ${adminUser.email}`);
      console.log(`- Password: ${newPassword}`);
      console.log('\n⚠️  Please save these credentials securely!');
    } else {
      console.log('\n❌ Password verification failed after reset!');
    }
    
  } catch (error) {
    console.error('❌ Error resetting admin password:', error.message);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n📝 Database connection closed.');
    process.exit(0);
  }
};

resetAdminPassword(); 