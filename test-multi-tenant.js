#!/usr/bin/env node

/**
 * Quick Test Script for Multi-Tenant Dynamics 365 Integration
 * Run this after implementing the enhanced multi-tenant features
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/dynamics`;

// Test data
const testContact = {
  firstname: 'Test',
  lastname: 'MultiTenant',
  emailaddress1: 'test.multitenant@example.com'
};

const testLead = {
  firstname: 'Test',
  lastname: 'Lead',
  companyname: 'Test Company',
  subject: 'Multi-tenant Test Lead'
};

class MultiTenantTester {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async testSubscriptionDetection() {
    console.log('\n🔍 Testing Subscription Detection...');
    try {
      const response = await axios.get(`${API_BASE}/subscription/detect`, {
        headers: this.headers
      });
      
      console.log('✅ Subscription Detection Success');
      console.log('📊 Subscription Type:', response.data.data.subscription.subscriptionType);
      console.log('🎯 Capabilities:', response.data.data.subscription.capabilities);
      
      return response.data.data;
    } catch (error) {
      console.error('❌ Subscription Detection Failed:', error.response?.data || error.message);
      return null;
    }
  }

  async testEntityCreationWithLicenseCheck(entityType, entityData) {
    console.log(`\n🚀 Testing ${entityType} creation with license check...`);
    try {
      const response = await axios.post(`${API_BASE}/entity-licensed/${entityType}`, entityData, {
        headers: this.headers
      });
      
      console.log(`✅ ${entityType} created successfully`);
      console.log('📝 Created ID:', response.data.data.id);
      return response.data.data;
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData?.status === 402) {
        console.log(`💳 License Required for ${entityType}:`);
        console.log('📋 Required:', errorData.details.requiredSubscription);
        console.log('🔄 Alternatives:', errorData.details.alternatives);
      } else if (errorData?.status === 403) {
        console.log(`🚫 Permission Denied for ${entityType}:`);
        console.log('💡 Solution:', errorData.details.solution);
    } else {
        console.error(`❌ ${entityType} creation failed:`, errorData || error.message);
      }
      return null;
    }
  }

  async testEnvironmentDiscovery() {
    console.log('\n🌍 Testing Environment Discovery...');
    try {
      const response = await axios.get(`${API_BASE}/organizations/discover`, {
        headers: this.headers
      });
      
      console.log('✅ Environment Discovery Success');
      console.log('🏢 Organizations found:', response.data.data.organizations.length);
      
      response.data.data.organizations.forEach((org, index) => {
        console.log(`   ${index + 1}. ${org.friendlyName} (${org.apiUrl})`);
      });
      
      return response.data.data.organizations;
    } catch (error) {
      console.error('❌ Environment Discovery Failed:', error.response?.data || error.message);
      return null;
    }
  }

  async testPermissionDiagnosis() {
    console.log('\n🔍 Testing Permission Diagnosis...');
    try {
      const response = await axios.get(`${API_BASE}/diagnose-permissions`, {
        headers: this.headers
      });
      
      console.log('✅ Permission Diagnosis Success');
      console.log('👤 User Permissions:', response.data.data);
      
      return response.data.data;
    } catch (error) {
      console.error('❌ Permission Diagnosis Failed:', error.response?.data || error.message);
      return null;
    }
  }

  async runFullTest() {
    console.log('🚀 Starting Multi-Tenant Integration Test Suite');
    console.log('=' .repeat(50));

    // Test 1: Subscription Detection
    const subscriptionData = await this.testSubscriptionDetection();
    if (!subscriptionData) return;

    // Test 2: Environment Discovery
    await this.testEnvironmentDiscovery();

    // Test 3: Permission Diagnosis
    await this.testPermissionDiagnosis();

    // Test 4: Entity Creation Tests
    console.log('\n📋 Testing Entity Creation with License Awareness...');
    
    // Test Contact (should work for all subscriptions)
    await this.testEntityCreationWithLicenseCheck('contact', testContact);
    
    // Test Lead (depends on subscription)
    await this.testEntityCreationWithLicenseCheck('lead', testLead);
    
    // Test based on detected capabilities
    const capabilities = subscriptionData.subscription.capabilities;
    
    if (capabilities.canCreateOpportunities) {
      await this.testEntityCreationWithLicenseCheck('opportunity', {
        name: 'Test Opportunity',
        estimatedvalue: 5000,
        estimatedclosedate: '2024-12-31'
      });
    }
    
    if (capabilities.canCreateCases) {
      await this.testEntityCreationWithLicenseCheck('incident', {
        title: 'Test Case',
        description: 'Multi-tenant test case'
      });
    }

    console.log('\n🎉 Multi-Tenant Test Suite Complete!');
    console.log('=' .repeat(50));
  }
}

// Main execution
async function main() {
  const accessToken = process.argv[2];
  
  if (!accessToken) {
    console.error('❌ Error: Access token required');
    console.log('Usage: node test-multi-tenant.js <ACCESS_TOKEN>');
    console.log('\nTo get an access token:');
    console.log('1. Navigate to: http://localhost:3000/api/dynamics/auth/initiate?platform=web');
    console.log('2. Complete authentication');
    console.log('3. Extract access token from response');
    process.exit(1);
  }

  const tester = new MultiTenantTester(accessToken);
  await tester.runFullTest();
}

// Quick subscription check function
async function quickCheck(accessToken) {
  try {
    const response = await axios.get(`${API_BASE}/subscription/detect`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return response.data.data.subscription;
  } catch (error) {
    console.error('Quick check failed:', error.message);
    return null;
  }
}

// Export for use in other modules
export { MultiTenantTester, quickCheck };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 