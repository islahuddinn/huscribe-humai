import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

console.log('🧪 Testing Token Mismatch Detection and Fix');
console.log('===========================================');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const apiBase = `${baseUrl}/api/dynamics`;

// Test with a mock Graph token (this would be your actual token)
const mockGraphToken = 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20iLCJpc3MiOiJodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vY29tbW9uL3YyLjAiLCJleHAiOjk5OTk5OTk5OTksInN1YiI6InRlc3R1c2VyIn0.test';

async function testTokenDiagnosis() {
  console.log('🔍 Testing Token Diagnosis Endpoint...');
  
  try {
    const response = await axios.get(`${apiBase}/auth/diagnose-token`, {
      headers: {
        'Authorization': mockGraphToken
      }
    });
    
    console.log('✅ Token diagnosis successful:');
    console.log('📋 Results:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.log('❌ Token diagnosis failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
    return null;
  }
}

async function testEntityCreationWithMismatch() {
  console.log('🚀 Testing Entity Creation with Token Mismatch...');
  
  try {
    const response = await axios.post(`${apiBase}/entity/contact`, {
      firstname: 'Test',
      lastname: 'User',
      emailaddress1: 'test@example.com'
    }, {
      headers: {
        'Authorization': mockGraphToken,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Entity creation successful (unexpected):');
    console.log('📋 Results:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Entity creation failed (expected):');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error Code:', error.response.data.errorCode);
      console.log('Error Message:', error.response.data.error);
      
      // Check if we got the expected TOKEN_MISMATCH error
      if (error.response.data.errorCode === 'TOKEN_MISMATCH') {
        console.log('✅ TOKEN_MISMATCH error detected correctly!');
        console.log('💡 Recommendations:', error.response.data.details.steps);
        return true;
      } else {
        console.log('⚠️ Got different error than expected TOKEN_MISMATCH');
      }
    } else {
      console.log('Error:', error.message);
    }
    return false;
  }
}

async function runTests() {
  console.log('🔧 Environment Check:');
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   API Base: ${apiBase}`);
  console.log(`   CRM URL: ${process.env.DYNAMICS_CRM_URL || 'Not configured'}`);
  console.log('');
  
  // Test 1: Token Diagnosis
  console.log('📋 Test 1: Token Diagnosis');
  const diagnosisResult = await testTokenDiagnosis();
  console.log('');
  
  // Test 2: Entity Creation with Mismatch
  console.log('📋 Test 2: Entity Creation with Token Mismatch');
  const mismatchDetected = await testEntityCreationWithMismatch();
  console.log('');
  
  // Summary
  console.log('📊 Test Summary:');
  console.log(`   Token Diagnosis: ${diagnosisResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Mismatch Detection: ${mismatchDetected ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
  
  if (diagnosisResult && mismatchDetected) {
    console.log('🎉 All tests passed! Token mismatch detection is working.');
    console.log('');
    console.log('🎯 Next Steps for Real Usage:');
    console.log('1. Use the diagnosis endpoint to check your actual token');
    console.log('2. If mismatch detected, use the token exchange endpoint');
    console.log('3. Or re-authenticate with the correct scope');
    console.log('');
    console.log('📚 Helpful Endpoints:');
    console.log(`   Diagnose Token: GET ${apiBase}/auth/diagnose-token`);
    console.log(`   Exchange Token: POST ${apiBase}/auth/exchange-environment`);
    console.log(`   Dynamics Auth: GET ${apiBase}/auth/initiate-dynamics`);
  } else {
    console.log('❌ Some tests failed. Check the logs above for details.');
  }
}

// Run the tests
runTests().catch(console.error); 