import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Setup script to identify and configure the correct Sales environment
 */

async function setupSalesEnvironment() {
  console.log('🔧 Dynamics 365 Sales Environment Setup Script');
  console.log('===============================================\n');

  // Check current configuration
  console.log('📋 Current Configuration:');
  console.log(`DYNAMICS_CRM_URL: ${process.env.DYNAMICS_CRM_URL || 'NOT SET'}`);
  console.log(`MD_CLIENT_ID: ${process.env.MD_CLIENT_ID ? 'SET' : 'NOT SET'}`);
  console.log(`TENANT_ID: ${process.env.TENANT_ID || 'NOT SET'}\n`);

  if (!process.env.MD_CLIENT_ID || !process.env.TENANT_ID) {
    console.error('❌ Missing required environment variables.');
    console.log('Please ensure the following are set in your .env file:');
    console.log('- MD_CLIENT_ID');
    console.log('- MD_CLIENT_SECRET');
    console.log('- TENANT_ID');
    console.log('- MD_REDIRECT_URI\n');
    return;
  }

  // Instructions for getting access token
  console.log('🔐 To run this setup, you need an access token.');
  console.log('Follow these steps:');
  console.log('1. Start your server: npm start');
  console.log('2. Go to: http://localhost:3000/api/dynamics/auth/initiate');
  console.log('3. Complete the authentication');
  console.log('4. Extract the access_token from the callback');
  console.log('5. Run this script with: node scripts/setupSalesEnvironment.js YOUR_ACCESS_TOKEN\n');

  const accessToken = process.argv[2];
  
  if (!accessToken) {
    console.log('⚠️  No access token provided.');
    console.log('Usage: node scripts/setupSalesEnvironment.js YOUR_ACCESS_TOKEN\n');
    return;
  }

  console.log('🔍 Analyzing your Dynamics 365 environments...\n');

  try {
    // Test current configuration first
    if (process.env.DYNAMICS_CRM_URL) {
      console.log('🧪 Testing current configuration...');
      const currentTest = await testEnvironment(process.env.DYNAMICS_CRM_URL, accessToken);
      console.log(`Current environment sales score: ${currentTest.salesScore}%\n`);
    }

    // Discover available organizations
    console.log('🔍 Discovering available organizations...');
    const organizations = await discoverOrganizations(accessToken);
    
    if (organizations.length === 0) {
      console.log('❌ No Dynamics 365 organizations found.');
      console.log('Please ensure:');
      console.log('- You have a Dynamics 365 license');
      console.log('- Your user is added to a Dynamics 365 organization');
      console.log('- The access token has the correct permissions\n');
      return;
    }

    console.log(`✅ Found ${organizations.length} organization(s):\n`);

    // Test each organization for Sales entities
    const results = [];
    for (const org of organizations) {
      console.log(`🧪 Testing: ${org.friendlyName}`);
      const test = await testEnvironment(org.apiUrl, accessToken);
      results.push({
        ...org,
        ...test
      });
      console.log(`  Sales score: ${test.salesScore}% (${test.salesEntitiesAvailable}/${test.totalSalesEntities} entities)`);
    }

    console.log('\n📊 Results Summary:');
    results.sort((a, b) => b.salesEntitiesAvailable - a.salesEntitiesAvailable);
    
    results.forEach((result, index) => {
      const status = result.salesScore >= 80 ? '🎯 SALES ENVIRONMENT' : 
                    result.salesScore > 0 ? '⚠️  PARTIAL SALES' : '❌ NO SALES';
      console.log(`${index + 1}. ${result.friendlyName} - ${status} (${result.salesScore}%)`);
      console.log(`   URL: ${result.apiUrl}`);
      console.log(`   Region: ${result.region}`);
    });

    // Find the best Sales environment
    const bestSalesEnv = results.find(r => r.salesScore >= 80);
    
    if (bestSalesEnv) {
      console.log(`\n🎯 Recommended Sales Environment: ${bestSalesEnv.friendlyName}`);
      console.log(`   URL: ${bestSalesEnv.apiUrl}\n`);
      
      console.log('✅ .env file configuration:');
      console.log(`DYNAMICS_CRM_URL=${bestSalesEnv.apiUrl}`);
      console.log('\n🔄 Please update your .env file and restart your application.\n');
    } else {
      console.log('\n⚠️  No environment with full Sales functionality found.');
      console.log('Recommendations:');
      console.log('1. Install Dynamics 365 Sales Hub in your preferred environment');
      console.log('2. Ensure you have the appropriate license');
      console.log('3. Contact your administrator for assistance\n');
    }

    console.log('✅ Setup complete! Next steps:');
    console.log('1. Update your .env file with the recommended URL');
    console.log('2. Restart your application');
    console.log('3. Test with: GET /api/dynamics/test-connection');
    console.log('4. Create a test lead: POST /api/dynamics/entity/lead/test');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Verify your access token is valid');
    console.log('2. Check your internet connection');
    console.log('3. Ensure your user has Dynamics 365 access');
  }
}

async function discoverOrganizations(accessToken) {
  try {
    const response = await axios.get(
      'https://globaldisco.crm.dynamics.com/api/discovery/v2.0/Instances',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    return response.data.value?.map(org => ({
      friendlyName: org.FriendlyName,
      uniqueName: org.UniqueName,
      apiUrl: org.ApiUrl,
      region: org.Region,
      version: org.Version
    })) || [];
  } catch (error) {
    console.error('Failed to discover organizations:', error.message);
    return [];
  }
}

async function testEnvironment(apiUrl, accessToken) {
  const salesEntities = ['lead', 'opportunity', 'product', 'quote', 'invoice', 'salesorder'];
  let salesEntitiesAvailable = 0;
  const salesEntityTest = {};

  for (const entityType of salesEntities) {
    try {
      await axios.get(
        `${apiUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${entityType}')?$select=LogicalName,DisplayName`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
          }
        }
      );
      
      salesEntityTest[entityType] = { available: true };
      salesEntitiesAvailable++;
    } catch (testError) {
      salesEntityTest[entityType] = { available: false };
    }
  }

  const salesScore = Math.round((salesEntitiesAvailable / salesEntities.length) * 100);

  return {
    salesScore,
    salesEntitiesAvailable,
    totalSalesEntities: salesEntities.length,
    salesEntityTest
  };
}

// Run the setup
setupSalesEnvironment().catch(console.error); 