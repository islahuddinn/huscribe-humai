#!/usr/bin/env node

import axios from 'axios';

const CORTEZA_BASE_URL = 'http://localhost:18080';
const API_BASE = `${CORTEZA_BASE_URL}/api`;

// Default admin credentials
const ADMIN_EMAIL = 'm.islahuddin87@gmail.com';
const ADMIN_PASSWORD = 'admin123!';

class CortezaSetup {
  constructor() {
    this.authToken = null;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async waitForCorteza() {
    console.log('🔄 Waiting for Corteza to be ready...');
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(`${CORTEZA_BASE_URL}/version`, { timeout: 5000 });
        if (response.status === 200) {
          console.log('✅ Corteza is ready!');
          console.log(`📋 Version: ${response.data.version || 'Unknown'}`);
          return true;
        }
      } catch (error) {
        attempts++;
        console.log(`⏳ Attempt ${attempts}/${maxAttempts} - Corteza not ready yet...`);
        await this.sleep(2000);
      }
    }
    
    throw new Error('❌ Corteza failed to start within expected time');
  }

  async createAdminUser() {
    console.log('👤 Setting up admin user...');
    
    try {
      // Try to signup first
      const signupData = {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        handle: 'admin',
        name: 'Huscribe Admin'
      };

      const signupResponse = await axios.post(`${API_BASE}/system/auth/signup`, signupData);
      console.log('✅ Admin user created successfully');
      
      return signupResponse.data;
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('ℹ️  Admin user already exists, proceeding with login...');
        return null;
      }
      console.error('❌ Error creating admin user:', error.response?.data || error.message);
      throw error;
    }
  }

  async loginAdmin() {
    console.log('🔐 Logging in as admin...');
    
    try {
      const loginData = {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      };

      const response = await axios.post(`${API_BASE}/system/auth/login`, loginData);
      
      if (response.data.response?.jwt) {
        this.authToken = response.data.response.jwt;
        console.log('✅ Admin login successful');
        return this.authToken;
      } else {
        throw new Error('No JWT token received');
      }
    } catch (error) {
      console.error('❌ Admin login failed:', error.response?.data || error.message);
      throw error;
    }
  }

  getHeaders() {
    if (!this.authToken) {
      throw new Error('Not authenticated. Please login first.');
    }
    
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    };
  }

  async createOAuthClient() {
    console.log('🔑 Creating OAuth client for CRM system...');
    
    try {
      const clientData = {
        handle: 'huscribe-crm-client',
        meta: {
          name: 'Huscribe CRM Client',
          description: 'OAuth client for Huscribe CRM provisioning system'
        },
        scope: 'api',
        redirectURI: 'http://localhost:5001/api/crm/auth/callback',
        grants: ['client_credentials', 'authorization_code', 'refresh_token'],
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400
      };

      const response = await axios.post(
        `${API_BASE}/system/auth/client/`,
        clientData,
        { headers: this.getHeaders() }
      );

      const client = response.data.response;
      console.log('✅ OAuth client created successfully');
      console.log(`📋 Client ID: ${client.clientID}`);
      console.log(`🔐 Client Secret: ${client.secret}`);
      
      return {
        clientId: client.clientID,
        clientSecret: client.secret
      };
    } catch (error) {
      console.error('❌ Error creating OAuth client:', error.response?.data || error.message);
      throw error;
    }
  }

  async listNamespaces() {
    console.log('📂 Checking existing namespaces...');
    
    try {
      const response = await axios.get(
        `${API_BASE}/compose/namespace/`,
        { headers: this.getHeaders() }
      );

      const namespaces = response.data.response?.set || [];
      console.log(`📋 Found ${namespaces.length} existing namespaces:`);
      
      namespaces.forEach(ns => {
        console.log(`   - ${ns.name} (${ns.slug}) - ${ns.enabled ? '✅ Enabled' : '❌ Disabled'}`);
      });
      
      return namespaces;
    } catch (error) {
      console.error('❌ Error listing namespaces:', error.response?.data || error.message);
      return [];
    }
  }

  async checkCRMNamespace() {
    console.log('🔍 Checking for CRM namespace...');
    
    const namespaces = await this.listNamespaces();
    const crmNamespace = namespaces.find(ns => ns.slug === 'crm');
    
    if (crmNamespace) {
      console.log('✅ CRM namespace found:', crmNamespace.name);
      return crmNamespace;
    } else {
      console.log('ℹ️  No CRM namespace found - will be created during tenant provisioning');
      return null;
    }
  }

  async getSystemInfo() {
    console.log('📊 Getting system information...');
    
    try {
      const [versionResponse, healthResponse] = await Promise.all([
        axios.get(`${CORTEZA_BASE_URL}/version`),
        axios.get(`${CORTEZA_BASE_URL}/healthcheck`)
      ]);

      console.log('📋 System Information:');
      console.log(`   Version: ${versionResponse.data.version || 'Unknown'}`);
      console.log(`   Health: ${healthResponse.status === 200 ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log(`   Base URL: ${CORTEZA_BASE_URL}`);
      console.log(`   API URL: ${API_BASE}`);
      
    } catch (error) {
      console.error('❌ Error getting system info:', error.message);
    }
  }

  async setup() {
    try {
      console.log('🚀 Starting Corteza setup for Huscribe CRM...\n');
      
      // Step 1: Wait for Corteza to be ready
      await this.waitForCorteza();
      
      // Step 2: Get system info
      await this.getSystemInfo();
      
      // Step 3: Create admin user
      await this.createAdminUser();
      
      // Step 4: Login as admin
      await this.loginAdmin();
      
      // Step 5: Create OAuth client
      const oauthClient = await this.createOAuthClient();
      
      // Step 6: Check namespaces
      await this.checkCRMNamespace();
      
      console.log('\n🎉 Corteza setup completed successfully!');
      console.log('\n📋 Configuration Summary:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🌐 Corteza URL: ${CORTEZA_BASE_URL}`);
      console.log(`👤 Admin Email: ${ADMIN_EMAIL}`);
      console.log(`🔐 Admin Password: ${ADMIN_PASSWORD}`);
      console.log(`🔑 OAuth Client ID: ${oauthClient.clientId}`);
      console.log(`🔐 OAuth Client Secret: ${oauthClient.clientSecret}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      console.log('\n📝 Add these to your .env file:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`CORTEZA_BASE_URL=${CORTEZA_BASE_URL}`);
      console.log(`CORTEZA_CLIENT_ID=${oauthClient.clientId}`);
      console.log(`CORTEZA_CLIENT_SECRET=${oauthClient.clientSecret}`);
      console.log(`CORTEZA_ADMIN_EMAIL=${ADMIN_EMAIL}`);
      console.log(`CORTEZA_ADMIN_PASSWORD=${ADMIN_PASSWORD}`);
      console.log(`CRM_BASE_URL=${CORTEZA_BASE_URL}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      console.log('\n✅ Next steps:');
      console.log('1. Add the above environment variables to your .env file');
      console.log('2. Restart your Node.js server');
      console.log('3. Test the CRM provisioning API');
      console.log(`4. Access Corteza admin panel: ${CORTEZA_BASE_URL}`);
      
      return {
        baseUrl: CORTEZA_BASE_URL,
        adminEmail: ADMIN_EMAIL,
        adminPassword: ADMIN_PASSWORD,
        oauthClient
      };
      
    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    }
  }
}

// Run setup if called directly
const setup = new CortezaSetup();
setup.setup(); 
export default CortezaSetup; 