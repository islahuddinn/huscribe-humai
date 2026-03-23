// Simple diagnostic script for user sales access
import axios from 'axios';

const BASE_URL = 'http://localhost:5001/api/dynamic';

// STEP 1: Get your access token
// 1. Go to: http://localhost:5001/api/dynamics/auth/initiate
// 2. Complete authentication with your licensed user
// 3. Get token from: http://localhost:5001/api/dynamics/auth/token
// 4. Replace TOKEN_HERE with the actual token

const ACCESS_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6IkNOdjBPSTNSd3FsSEZFVm5hb01Bc2hDSDJYRSIsImtpZCI6IkNOdjBPSTNSd3FsSEZFVm5hb01Bc2hDSDJYRSJ9.eyJhdWQiOiJodHRwczovL29yZzRjZmIyYmMwLmNybTE1LmR5bmFtaWNzLmNvbSIsImlzcyI6Imh0dHBzOi8vc3RzLndpbmRvd3MubmV0LzY0ZGJmMjA3LTQ2OTktNDJlZC05OTMyLTU0MmI0ZWU1ZDBkOS8iLCJpYXQiOjE3NTAyMzA5MzIsIm5iZiI6MTc1MDIzMDkzMiwiZXhwIjoxNzUwMjM0OTA3LCJhY2N0IjowLCJhY3IiOiIxIiwiYWlvIjoiQVpRQWEvOFpBQUFBYW02aUlZeGwra0ZhUEY4c3ByUkI4Unl4eGcvRExzeURXVlRyZFhvZW9GUDlmUUJSUTU0WkRyOVpDWjlERitTcUFtQlljNjB2VUJqc3o1N01ZUnYvako0aVZna1l4MkdNdWlOWkt1ZTNjTWxwWFAwSytZRzR4ekNlRDh2SlNCNUpkVkJxYlVhUEdRdEFjeTlHd3FjeXdLak11QjJTRW5tUTNiN0hzaDRKRnY2cXNaU1p5YWt0aklpQnkwRzZRV2tXIiwiYW1yIjpbInB3ZCIsIm1mYSJdLCJhcHBpZCI6ImYxODAzNDliLTEzMjAtNDE4Yi1hNGIyLTZhMzlhZjgzNjIyNCIsImFwcGlkYWNyIjoiMSIsImZhbWlseV9uYW1lIjoiS2hhbiIsImdpdmVuX25hbWUiOiJIYXJpcyIsImlkdHlwIjoidXNlciIsImlwYWRkciI6IjExOS4xNTcuMjMwLjE5NiIsImxvZ2luX2hpbnQiOiJPLkNpUTNPVFUyT1dOaE9TMHdaV05pTFRSallUTXRZVEF3TkMxbE9XVmxaV0ZqTTJVNE5qVVNKRFkwWkdKbU1qQTNMVFEyT1RrdE5ESmxaQzA1T1RNeUxUVTBNbUkwWldVMVpEQmtPUm9TYUd0b1lXNUFhSFZ0WVdrdFlXa3VZMjl0SUlrQiIsIm5hbWUiOiJIYXJpcyBLaGFuIiwib2lkIjoiNzk1NjljYTktMGVjYi00Y2EzLWEwMDQtZTllZWVhYzNlODY1IiwicHVpZCI6IjEwMDMyMDA0QkE2MENFOTAiLCJyaCI6IjEuQVU4QUJfTGJaSmxHN1VLWk1sUXJUdVhRMlFjQUFBQUFBQUFBd0FBQUFBQUFBQUE1QVFwUEFBLiIsInNjcCI6InVzZXJfaW1wZXJzb25hdGlvbiIsInNpZCI6IjAwNWU1NDg5LTU2NTEtYzZlMy1iYzUyLWViMDE3N2U1ZGYzMCIsInN1YiI6ImxHSDNNMnk1ZGpqTEpQM2htTUxRSVNhUk1sbm5zTlZNVWZ0ZnV4a3hhQnciLCJ0ZW5hbnRfcmVnaW9uX3Njb3BlIjoiRVUiLCJ0aWQiOiI2NGRiZjIwNy00Njk5LTQyZWQtOTkzMi01NDJiNGVlNWQwZDkiLCJ1bmlxdWVfbmFtZSI6ImhraGFuQGh1bWFpLWFpLmNvbSIsInVwbiI6ImhraGFuQGh1bWFpLWFpLmNvbSIsInV0aSI6IlVUTHdhSHlLV2stTUt6N3FkQTVzQUEiLCJ2ZXIiOiIxLjAiLCJ3aWRzIjpbImYyOGExZjUwLWY2ZTctNDU3MS04MThiLTZhMTJmMmFmNmI2YyIsImZlOTMwYmU3LTVlNjItNDdkYi05MWFmLTk4YzNhNDlhMzhiMSIsIjExNjQ4NTk3LTkyNmMtNGNmMy05YzM2LWJjZWJiMGJhOGRjYyIsIjYyZTkwMzk0LTY5ZjUtNDIzNy05MTkwLTAxMjE3NzE0NWUxMCIsIjcyOTgyN2UzLTljMTQtNDlmNy1iYjFiLTk2MDhmMTU2YmJiOCIsImI3OWZiZjRkLTNlZjktNDY4OS04MTQzLTc2YjE5NGU4NTUwOSJdLCJ4bXNfZnRkIjoieTR3cjZ0c2RmR2NvUUR1MHIwa2NMcEFpbXA4ckZaM2JJNE1xUHZMS0hNOEJabkpoYm1ObFl5MWtjMjF6IiwieG1zX2lkcmVsIjoiMSA0In0.b6thlANR1pAkFlLX-HWbipzQdKIGyRvsOncGgRUnzlriBMTwLXYJwUNB4FMrwx4UKutDyEM23FsuhWRcQkWflpiYsAbiY0NnFKPIDE8jOSRfM6zcUHkxR_Y_k3_wFc7maZmjHpWmLcdZC1oKcRwwAaKaRphIjM-Th6qHGyAVw_u1sWuJCLpZVa6FfPV9lQcgD8QYDXIQNuofw5jQJxmyAVyY6jRh1dfAtwq4qtCV8NWtO_70GBw1Mzk6mndcuSguKUtsEFeJls1JgTdpW1pamUVHBtf6HuP03ApLyUwHBrXd1HW-nqINiF719y4Oo4tKsvPdkym3vNB1D6nE6lv3Lw';

const headers = {
  'Authorization': `Bearer ${ACCESS_TOKEN}`,
  'Content-Type': 'application/json'
};

console.log('🔍 DIAGNOSING USER SALES ACCESS');
console.log('================================\n');

async function runQuickDiagnosis() {
  if (ACCESS_TOKEN === 'TOKEN_HERE') {
    console.log('❌ Please update ACCESS_TOKEN first!');
    console.log('\nSteps to get token:');
    console.log('1. Start your server: npm start');
    console.log('2. Visit: http://localhost:5001/api/dynamics/auth/initiate');
    console.log('3. Complete authentication');
    console.log('4. Get token: http://localhost:5001/api/dynamics/auth/token');
    console.log('5. Update ACCESS_TOKEN in this script');
    return;
  }

  try {
    // Test 0: Get user and environment information
    console.log('👤 Test 0: Getting user and environment information...');
    const currentEnvResponse = await axios.get(`${BASE_URL}/get-environment-current`, { headers });
    
    console.log('✅ User & Environment Information:');
    const envData = currentEnvResponse.data.currentEnvironment || currentEnvResponse.data;
    console.log(`   👤 User ID: ${envData.userId || 'Not available'}`);
    console.log(`   🆔 Organization ID: ${envData.organizationId || 'Not available'}`);
    console.log(`   🏢 Business Unit ID: ${envData.businessUnitId || 'Not available'}`);
    console.log(`   🌐 Environment URL: ${envData.url || currentEnvResponse.data.currentEnvironment?.url || 'Not available'}`);
    console.log(`   🌍 Region: ${currentEnvResponse.data.region || 'Not specified'}`);
    console.log(`   ⚡ API Version: ${currentEnvResponse.data.apiVersion || 'Not available'}`);
    console.log(`   🔗 Connection Status: ${currentEnvResponse.data.connectionStatus || 'Unknown'}`);
    console.log(`   ✅ User Authenticated: ${currentEnvResponse.data.userAuthenticated ? 'Yes' : 'No'}`);

    // Test 1: Check user capabilities
    console.log('\n📊 Test 1: Checking user sales capabilities...');
    const capabilitiesResponse = await axios.get(`${BASE_URL}/user/sales-capabilities`, { headers });
    
    const capabilitiesSummary = capabilitiesResponse.data.summary;
    console.log(`✅ Status: ${capabilitiesSummary.overallStatus}`);
    console.log(`✅ Sales Hub Access: ${capabilitiesSummary.canUseSalesHub ? 'YES' : 'NO'}`);
    console.log(`✅ Basic CRM Access: ${capabilitiesSummary.canUseBasicCRM ? 'YES' : 'NO'}`);
    
    if (!capabilitiesSummary.canUseSalesHub) {
      console.log('\n❌ ISSUE IDENTIFIED: User lacks Sales Hub access');
      console.log('Solutions:');
      console.log('1. Assign Dynamics 365 Sales Hub license to user');
      console.log('2. Add user to Sales security roles (Sales Manager, Salesperson)');
      console.log('3. Ensure user is in correct Business Unit');
      return;
    }

    // Test 2: Identify Sales environment
    console.log('\n🔍 Test 2: Identifying Sales environment...');
    const salesEnvResponse = await axios.get(`${BASE_URL}/environment/identify-sales`, { headers });
    
    console.log(`✅ Environment Discovery Results:`);
    console.log(`   📊 Total Environments: ${salesEnvResponse.data.totalOrganizations || 'Unknown'}`);
    console.log(`   🎯 Sales Environments Found: ${salesEnvResponse.data.salesEnvironments?.length || 0}`);
    
    if (salesEnvResponse.data.availableEnvironments?.length > 0) {
      console.log('\n📋 All Available Environments:');
      salesEnvResponse.data.availableEnvironments.forEach((env, index) => {
        console.log(`   ${index + 1}. ${env.friendlyName}`);
        console.log(`      URL: ${env.apiUrl}`);
        console.log(`      Region: ${env.region || 'Unknown'}`);
        console.log(`      Sales Entities: ${env.salesEntitiesAvailable}/${env.totalSalesEntities}`);
        console.log(`      Sales Score: ${env.salesScore}`);
        console.log(`      Recommendation: ${env.recommendation}`);
      });
    }
    
    if (salesEnvResponse.data.salesEnvironments?.length > 0) {
      const salesEnv = salesEnvResponse.data.salesEnvironments[0];
      console.log(`\n🏆 Recommended Sales Environment:`);
      console.log(`   📛 Name: ${salesEnv.friendlyName}`);
      console.log(`   🌐 URL: ${salesEnv.apiUrl}`);
      console.log(`   📊 Sales Score: ${salesEnv.salesScore}`);
      console.log(`   🌍 Region: ${salesEnv.region || 'Unknown'}`);
      console.log(`   ✅ Is Sales Named: ${salesEnv.isSalesNamed ? 'Yes' : 'No'}`);
      
      // Check if current environment matches recommended
      const currentEnv = currentEnvResponse.data.currentEnvironment?.url || process.env.DYNAMICS_CRM_URL;
      if (currentEnv !== salesEnv.apiUrl) {
        console.log('\n⚠️ CONFIGURATION MISMATCH:');
        console.log(`   Current Environment URL: ${currentEnv}`);
        console.log(`   Recommended Environment: ${salesEnv.friendlyName}`);
        console.log(`   Recommended URL: ${salesEnv.apiUrl}`);
        console.log('\n🔧 Solution: Update DYNAMICS_CRM_URL in your .env file');
      } else {
        console.log('\n✅ CONFIGURATION CORRECT: Using recommended Sales environment');
      }
    } else {
      console.log('\n❌ No Sales environments found');
      console.log('🔧 Solution: Install Dynamics 365 Sales Hub in your environment');
      return;
    }

    // Test 3: Try creating a lead
    console.log('\n🧪 Test 3: Testing lead creation...');
    const testLead = {
      subject: 'Test Lead - Access Diagnosis',
      firstname: 'Test',
      lastname: 'User',
      companyname: 'Test Company',
      emailaddress1: 'test@company.com'
    };

    try {
      const leadResponse = await axios.post(`${BASE_URL}/entity/lead`, testLead, { headers });
      console.log('✅ Lead creation SUCCESS!');
      console.log(`✅ Lead ID: ${leadResponse.data.id}`);
      console.log('✅ Your configuration is working correctly!');
    } catch (leadError) {
      console.log('❌ Lead creation FAILED:');
      console.log(`Status: ${leadError.response?.status}`);
      console.log(`Error: ${leadError.response?.data?.error}`);
      console.log(`Error Code: ${leadError.response?.data?.errorCode}`);
      
      if (leadError.response?.data?.errorCode === 'ENTITY_NOT_FOUND') {
        console.log('\n🔧 SOLUTION: Environment targeting issue');
        console.log('Update your .env file with the correct Sales environment URL');
      } else if (leadError.response?.status === 403) {
        console.log('\n🔧 SOLUTION: Permission issue');
        console.log('User needs proper security roles and permissions');
      }
    }

    // Test 4: Try creating an opportunity
    console.log('\n🧪 Test 4: Testing opportunity creation...');
    const testOpportunity = {
      name: 'Test Opportunity - Access Diagnosis',
      description: 'Testing opportunity creation',
      estimatedvalue: 50000,
      estimatedclosedate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    try {
      const oppResponse = await axios.post(`${BASE_URL}/entity/opportunity`, testOpportunity, { headers });
      console.log('✅ Opportunity creation SUCCESS!');
      console.log(`✅ Opportunity ID: ${oppResponse.data.id}`);
    } catch (oppError) {
      console.log('❌ Opportunity creation FAILED:');
      console.log(`Status: ${oppError.response?.status}`);
      console.log(`Error: ${oppError.response?.data?.error}`);
      console.log(`Error Code: ${oppError.response?.data?.errorCode}`);
    }

    console.log('\n✅ DIAGNOSIS COMPLETE!');
    
    // Summary section
    console.log('\n' + '='.repeat(50));
    console.log('📋 SUMMARY');
    console.log('='.repeat(50));
    const summaryEnvData = currentEnvResponse.data.currentEnvironment || currentEnvResponse.data;
    console.log(`👤 User ID: ${summaryEnvData.userId || 'Unknown'}`);
    console.log(`🆔 Organization ID: ${summaryEnvData.organizationId || 'Unknown'}`);
    console.log(`🌐 Current URL: ${summaryEnvData.url || 'Unknown'}`);
    
    if (salesEnvResponse.data.salesEnvironments?.length > 0) {
      const salesEnv = salesEnvResponse.data.salesEnvironments[0];
      console.log(`🎯 Recommended Sales Environment: ${salesEnv.friendlyName}`);
      console.log(`🌐 Recommended URL: ${salesEnv.apiUrl}`);
      
      const currentUrl = summaryEnvData.url || process.env.DYNAMICS_CRM_URL;
      if (currentUrl === salesEnv.apiUrl) {
        console.log('✅ STATUS: Using correct Sales environment');
      } else {
        console.log('⚠️ STATUS: Environment configuration needs update');
      }
    }
    
    const finalSummary = capabilitiesResponse.data.summary;
    console.log(`🔐 Sales Hub Access: ${finalSummary.canUseSalesHub ? '✅ YES' : '❌ NO'}`);
    console.log(`📊 Overall Status: ${finalSummary.overallStatus}`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error.response?.data || error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Ensure your server is running');
    console.log('2. Verify the ACCESS_TOKEN is valid');
    console.log('3. Check your internet connection');
  }
}

runQuickDiagnosis(); 