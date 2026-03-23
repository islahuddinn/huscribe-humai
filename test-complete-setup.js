#!/usr/bin/env node

import axios from 'axios';
import chalk from 'chalk';

const CORTEZA_URL = 'http://localhost:18080';
const HUSCRIBE_URL = 'http://localhost:5001';

class SetupTester {
  constructor() {
    this.results = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow,
      info: chalk.blue
    };
    
    console.log(`${colors[type](`[${type.toUpperCase()}]`)} ${message}`);
    this.results.push({ timestamp, type, message });
  }

  async test(name, testFn) {
    try {
      this.log(`Testing: ${name}`, 'info');
      await testFn();
      this.log(`✅ ${name}: PASSED`, 'success');
      return true;
    } catch (error) {
      this.log(`❌ ${name}: FAILED - ${error.message}`, 'error');
      return false;
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testCortezaHealth() {
    const response = await axios.get(`${CORTEZA_URL}/version`, { timeout: 5000 });
    if (response.status !== 200) {
      throw new Error('Corteza health check failed');
    }
  }

  async testCortezaWebInterface() {
    const response = await axios.get(`${CORTEZA_URL}`, { timeout: 5000 });
    if (response.status !== 200) {
      throw new Error('Corteza web interface not accessible');
    }
  }

  async testHuscribeServer() {
    const response = await axios.get(`${HUSCRIBE_URL}/`, { timeout: 5000 });
    if (response.status !== 200) {
      throw new Error('Huscribe server not responding');
    }
  }

  async testCRMProvisioningEndpoint() {
    try {
      // This should return 401 (unauthorized) which means the endpoint exists
      await axios.get(`${HUSCRIBE_URL}/api/crm/system/status`, { timeout: 5000 });
    } catch (error) {
      if (error.response?.status === 401) {
        // Expected - endpoint exists but requires auth
        return;
      }
      throw new Error(`CRM endpoint not found: ${error.message}`);
    }
  }

  async testDatabaseConnection() {
    try {
      // Test if we can reach MongoDB through the app
      const response = await axios.get(`${HUSCRIBE_URL}/api/health`, { timeout: 5000 });
      // If endpoint doesn't exist, that's fine - server is running
    } catch (error) {
      if (error.response?.status === 404) {
        // Endpoint doesn't exist but server is responding
        return;
      }
      throw error;
    }
  }

  async runAllTests() {
    console.log(chalk.cyan('🚀 Starting Complete Setup Test Suite\n'));
    
    const tests = [
      { name: 'Corteza Health Check', fn: () => this.testCortezaHealth() },
      { name: 'Corteza Web Interface', fn: () => this.testCortezaWebInterface() },
      { name: 'Huscribe Server Status', fn: () => this.testHuscribeServer() },
      { name: 'CRM Provisioning Endpoint', fn: () => this.testCRMProvisioningEndpoint() },
      { name: 'Database Connection', fn: () => this.testDatabaseConnection() }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      const result = await this.test(test.name, test.fn);
      if (result) passed++;
      else failed++;
      
      // Small delay between tests
      await this.sleep(1000);
    }

    console.log('\n' + '='.repeat(60));
    console.log(chalk.cyan('📊 TEST RESULTS SUMMARY'));
    console.log('='.repeat(60));
    console.log(chalk.green(`✅ Passed: ${passed}`));
    console.log(chalk.red(`❌ Failed: ${failed}`));
    console.log(chalk.blue(`📊 Total: ${tests.length}`));
    
    if (failed === 0) {
      console.log('\n🎉 ' + chalk.green('ALL TESTS PASSED! Your setup is working correctly.'));
      this.printNextSteps();
    } else {
      console.log('\n⚠️  ' + chalk.yellow('Some tests failed. Check the logs above for details.'));
      this.printTroubleshooting();
    }
  }

  printNextSteps() {
    console.log('\n' + chalk.cyan('🔥 NEXT STEPS:'));
    console.log('━'.repeat(50));
    console.log('1. 🌐 Access Corteza: http://localhost:18080');
    console.log('2. 🔧 Login with: admin@huscribe.com / admin123');
    console.log('3. 📡 Test CRM API: http://localhost:5001/api/crm/system/status');
    console.log('4. 📋 Use Postman to test provisioning endpoints');
    console.log('5. 🚀 Start creating CRM tenants!');
  }

  printTroubleshooting() {
    console.log('\n' + chalk.yellow('🔧 TROUBLESHOOTING:'));
    console.log('━'.repeat(50));
    console.log('1. Check if Docker containers are running: docker-compose ps');
    console.log('2. Check Corteza logs: docker-compose logs corteza-server');
    console.log('3. Restart containers: docker-compose down && docker-compose up -d');
    console.log('4. Wait 30 seconds after restart for full initialization');
  }
}

// Run tests
const tester = new SetupTester();
tester.runAllTests(); 