import axios from 'axios';
import CortezaService from './services/cortezaService.js';
import CrmTenant from './models/crmTenantModel.js';
import connectDb from './db.js';

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3001',
  cortezaUrl: 'http://localhost:18080',
  testUser: {
    email: 'test@example.com',
    password: 'testpassword123'
  },
  testTenant: {
    plan: 'startup',
    slug: 'test-company',
    companyName: 'Test Company Inc.'
  }
};

class CrmProvisioningTest {
  constructor() {
    this.authToken = null;
    this.tenantId = null;
    this.cortezaService = new CortezaService();
  }

  async init() {
    console.log('🔄 Initializing CRM Provisioning Tests...');
    
    // Connect to database
    await connectDb();
    console.log('✅ Database connected');

    // Check Corteza health
    const health = await this.cortezaService.healthCheck();
    console.log('📊 Corteza Status:', health.status);
    
    if (health.status !== 'healthy') {
      throw new Error('Corteza is not healthy. Please ensure Corteza is running.');
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up test data...');
    
    try {
      // Remove test tenant
      if (this.tenantId) {
        await CrmTenant.findOneAndDelete({ tenantId: this.tenantId });
        console.log('✅ Test tenant removed from database');
      }
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  }

  async authenticateUser() {
    console.log('🔐 Authenticating test user...');
    
    try {
      const response = await axios.post(`${TEST_CONFIG.baseUrl}/api/users/login`, {
        email: TEST_CONFIG.testUser.email,
        password: TEST_CONFIG.testUser.password
      });

      this.authToken = response.data.token;
      console.log('✅ User authenticated');
      return this.authToken;
    } catch (error) {
      console.log('ℹ️ User not found, creating test user...');
      
      // Create test user
      await axios.post(`${TEST_CONFIG.baseUrl}/api/users/register`, {
        name: 'Test User',
        email: TEST_CONFIG.testUser.email,
        password: TEST_CONFIG.testUser.password
      });

      // Login again
      const loginResponse = await axios.post(`${TEST_CONFIG.baseUrl}/api/users/login`, {
        email: TEST_CONFIG.testUser.email,
        password: TEST_CONFIG.testUser.password
      });

      this.authToken = loginResponse.data.token;
      console.log('✅ Test user created and authenticated');
      return this.authToken;
    }
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    };
  }

  async testTenantProvisioning() {
    console.log('\n📋 Testing CRM Tenant Provisioning...');
    
    const startTime = Date.now();
    
    try {
      const response = await axios.post(
        `${TEST_CONFIG.baseUrl}/api/crm/provision`,
        TEST_CONFIG.testTenant,
        { headers: this.getAuthHeaders() }
      );

      this.tenantId = response.data.data.tenantId;
      const provisioningTime = Date.now() - startTime;

      console.log('✅ Tenant provisioning started');
      console.log(`📊 Response time: ${provisioningTime}ms`);
      console.log(`🆔 Tenant ID: ${this.tenantId}`);
      console.log(`🔗 Tenant URL: ${response.data.data.url}`);

      return response.data;
    } catch (error) {
      console.error('❌ Tenant provisioning failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async waitForProvisioning(maxWaitTime = 60000) {
    console.log('\n⏳ Waiting for provisioning to complete...');
    
    const startTime = Date.now();
    let attempts = 0;
    
    while (Date.now() - startTime < maxWaitTime) {
      attempts++;
      
      try {
        const response = await axios.get(
          `${TEST_CONFIG.baseUrl}/api/crm/tenant/${this.tenantId}/status`,
          { headers: this.getAuthHeaders() }
        );

        const status = response.data.data.status;
        console.log(`📊 Attempt ${attempts}: Status = ${status}`);

        if (status === 'active') {
          console.log('✅ Provisioning completed successfully!');
          return response.data.data;
        } else if (status === 'error') {
          console.error('❌ Provisioning failed with error');
          throw new Error('Provisioning failed');
        }

        // Wait 2 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ Status check failed:`, error.response?.data || error.message);
        throw error;
      }
    }

    throw new Error('Provisioning timed out');
  }

  async testTenantListing() {
    console.log('\n📋 Testing Tenant Listing...');
    
    try {
      const response = await axios.get(
        `${TEST_CONFIG.baseUrl}/api/crm/tenants`,
        { headers: this.getAuthHeaders() }
      );

      console.log('✅ Tenant listing successful');
      console.log(`📊 Total tenants: ${response.data.data.tenants.length}`);
      
      return response.data;
    } catch (error) {
      console.error('❌ Tenant listing failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async testSystemStatus() {
    console.log('\n📊 Testing System Status...');
    
    try {
      const response = await axios.get(
        `${TEST_CONFIG.baseUrl}/api/crm/system/status`,
        { headers: this.getAuthHeaders() }
      );

      console.log('✅ System status retrieved');
      console.log(`🔧 Corteza: ${response.data.data.corteza.status}`);
      console.log(`📈 Active tenants: ${response.data.data.statistics.activeTenants}`);
      
      return response.data;
    } catch (error) {
      console.error('❌ System status failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async testCortezaIntegration() {
    console.log('\n🔧 Testing Corteza Integration...');
    
    try {
      // Test authentication
      await this.cortezaService.authenticate();
      console.log('✅ Corteza authentication successful');

      // Test namespace creation
      const testNamespace = await this.cortezaService.createNamespace({
        companyName: 'Test Integration Company',
        slug: 'test-integration',
        plan: 'startup'
      });
      
      console.log('✅ Test namespace created');
      console.log(`🆔 Namespace ID: ${testNamespace.namespaceID}`);

      // Test baseline import
      const moduleIds = await this.cortezaService.importBaseline(testNamespace.namespaceID, 'startup');
      console.log('✅ Baseline modules imported');
      console.log(`📊 Modules created: ${Object.keys(moduleIds).length}`);

      return { namespaceId: testNamespace.namespaceID, moduleIds };
    } catch (error) {
      console.error('❌ Corteza integration test failed:', error.message);
      throw error;
    }
  }

  async runPerfomanceTest() {
    console.log('\n⚡ Running Performance Test...');
    
    const concurrentRequests = 5;
    const requests = [];
    const startTime = Date.now();

    for (let i = 0; i < concurrentRequests; i++) {
      const tenantData = {
        plan: 'startup',
        slug: `perf-test-${i}-${Date.now()}`,
        companyName: `Performance Test Company ${i}`
      };

      requests.push(
        axios.post(
          `${TEST_CONFIG.baseUrl}/api/crm/provision`,
          tenantData,
          { headers: this.getAuthHeaders() }
        )
      );
    }

    try {
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / concurrentRequests;

      console.log('✅ Performance test completed');
      console.log(`📊 Concurrent requests: ${concurrentRequests}`);
      console.log(`⏱️ Total time: ${totalTime}ms`);
      console.log(`📈 Average time per request: ${avgTime}ms`);
      console.log(`🎯 Target: < 60s (${avgTime < 60000 ? 'PASS' : 'FAIL'})`);

      // Cleanup performance test tenants
      for (const response of responses) {
        const tenantId = response.data.data.tenantId;
        await CrmTenant.findOneAndDelete({ tenantId });
      }

      return { concurrentRequests, totalTime, avgTime };
    } catch (error) {
      console.error('❌ Performance test failed:', error.message);
      throw error;
    }
  }

  async runAllTests() {
    try {
      console.log('🚀 Starting CRM Provisioning Test Suite\n');
      
      await this.init();
      await this.authenticateUser();
      
      // Core functionality tests
      await this.testTenantProvisioning();
      const tenantData = await this.waitForProvisioning();
      await this.testTenantListing();
      await this.testSystemStatus();
      
      // Integration tests
      await this.testCortezaIntegration();
      
      // Performance tests
      await this.runPerfomanceTest();
      
      console.log('\n🎉 All tests completed successfully!');
      
      // Test summary
      console.log('\n📊 Test Summary:');
      console.log('✅ Tenant provisioning: PASS');
      console.log('✅ Tenant listing: PASS');
      console.log('✅ System status: PASS');
      console.log('✅ Corteza integration: PASS');
      console.log('✅ Performance test: PASS');
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new CrmProvisioningTest();
  
  test.runAllTests()
    .then(() => {
      console.log('\n✅ Test suite completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Test suite failed:', error.message);
      process.exit(1);
    });
}

export default CrmProvisioningTest; 