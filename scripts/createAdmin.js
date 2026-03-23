import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/userModel.js';

// Load environment variables
dotenv.config();

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get admin details from command line arguments or use defaults
    const args = process.argv.slice(2);
    const email = args[0] || 'doe@yopmail.com';
    const password = args[1] || 'Admin123!';
    const firstName = args[2] || 'Super';
    const lastName = args[3] || 'Admin';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      if (existingAdmin.isAdmin) {
        console.log(`❌ Admin user with email ${email} already exists!`);
        process.exit(1);
      } else {
        // Update existing user to admin
        existingAdmin.isAdmin = true;
        existingAdmin.status = 'active';
        await existingAdmin.save();
        console.log(`✅ Updated existing user ${email} to admin status!`);
        console.log('Admin Details:');
        console.log(`- Email: ${existingAdmin.email}`);
        console.log(`- Name: ${existingAdmin.first_name} ${existingAdmin.last_name}`);
        console.log(`- Admin: ${existingAdmin.isAdmin}`);
        console.log(`- Status: ${existingAdmin.status}`);
        process.exit(0);
      }
    }

    // Create admin user
    const adminUser = new User({
      first_name: firstName,
      last_name: lastName,
      email: email,
      password: password, // Let the pre-save middleware handle hashing
      isAdmin: true,
      status: 'active',
      email_verified: true,
      subscription_status: 'active',
      current_plan: 'premium',
      subscription_start_date: new Date(),
      subscription_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      additional_voices: 10,
      additional_meetings: 100
    });

    await adminUser.save();

    console.log('🎉 Admin user created successfully!');
    console.log('Admin Details:');
    console.log(`- Email: ${adminUser.email}`);
    console.log(`- Password: ${password}`);
    console.log(`- Name: ${adminUser.first_name} ${adminUser.last_name}`);
    console.log(`- Admin: ${adminUser.isAdmin}`);
    console.log(`- Status: ${adminUser.status}`);
    console.log(`- ID: ${adminUser._id}`);
    console.log('\n🔐 Please save these credentials securely!');
    console.log('⚠️  Change the password after first login for security.');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n📝 Database connection closed.');
    process.exit(0);
  }
};

// Handle script execution
if (process.argv.length < 3) {
  console.log('📋 Usage:');
  console.log('node scripts/createAdmin.js [email] [password] [firstName] [lastName]');
  console.log('\n📋 Examples:');
  console.log('node scripts/createAdmin.js');
  console.log('node scripts/createAdmin.js admin@company.com SecurePass123 John Doe');
  console.log('\n📋 Default values:');
  console.log('- Email: doe@yopmail.com');
  console.log('- Password: Admin123!');
  console.log('- Name: Super Admin');
}

createAdmin(); 