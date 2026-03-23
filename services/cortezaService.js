import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { crmBaselineManifest } from '../manifests/crm-baseline.js';

class CortezaService {
  constructor() {
    this.baseUrl = process.env.CORTEZA_BASE_URL || 'http://localhost:18080';
    this.apiUrl = `${this.baseUrl}/api`;
    this.authToken = null;
    this.refreshToken = null;
  }

  // Authentication
  async authenticate() {
    try {
      const response = await axios.post(`${this.apiUrl}/system/auth/oauth2/token`, {
        grant_type: 'client_credentials',
        client_id: process.env.CORTEZA_CLIENT_ID,
        client_secret: process.env.CORTEZA_CLIENT_SECRET,
        scope: 'api'
      });

      this.authToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      
      return this.authToken;
    } catch (error) {
      console.error('Corteza authentication failed:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Corteza');
    }
  }

  // Get authenticated headers
  getHeaders() {
    if (!this.authToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }
    
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Create a new namespace (tenant)
  async createNamespace(tenantData) {
    try {
      await this.authenticate();
      
      const namespaceData = {
        name: `${tenantData.companyName} CRM`,
        slug: tenantData.slug,
        enabled: true,
        meta: {
          description: `CRM instance for ${tenantData.companyName}`,
          plan: tenantData.plan,
          createdAt: new Date().toISOString()
        }
      };

      const response = await axios.post(
        `${this.apiUrl}/compose/namespace/`,
        namespaceData,
        { headers: this.getHeaders() }
      );

      return response.data.response;
    } catch (error) {
      console.error('Failed to create namespace:', error.response?.data || error.message);
      throw new Error('Failed to create Corteza namespace');
    }
  }

  // Import baseline modules into namespace
  async importBaseline(namespaceId, plan = 'startup') {
    try {
      const manifest = { ...crmBaselineManifest };
      
      // Create modules
      const moduleIds = {};
      for (const moduleConfig of manifest.modules) {
        const module = await this.createModule(namespaceId, moduleConfig);
        moduleIds[moduleConfig.handle] = module.moduleID;
      }

      // Create workflows (if plan supports it)
      if (plan === 'scale' || plan === 'enterprise') {
        for (const workflowConfig of manifest.workflows) {
          await this.createWorkflow(namespaceId, workflowConfig, moduleIds);
        }
      }

      return moduleIds;
    } catch (error) {
      console.error('Failed to import baseline:', error.response?.data || error.message);
      throw new Error('Failed to import CRM baseline');
    }
  }

  // Create a module in the namespace
  async createModule(namespaceId, moduleConfig) {
    try {
      const moduleData = {
        name: moduleConfig.name,
        handle: moduleConfig.handle,
        fields: moduleConfig.fields.map(field => ({
          name: field.name,
          label: field.name,
          kind: field.kind,
          options: {
            multiLine: field.isMultiLine || false,
            required: field.required || false,
            unique: field.unique || false,
            precision: field.precision || 0,
            selectOptions: field.options || []
          }
        }))
      };

      const response = await axios.post(
        `${this.apiUrl}/compose/namespace/${namespaceId}/module/`,
        moduleData,
        { headers: this.getHeaders() }
      );

      return response.data.response;
    } catch (error) {
      console.error(`Failed to create module ${moduleConfig.name}:`, error.response?.data || error.message);
      throw new Error(`Failed to create module: ${moduleConfig.name}`);
    }
  }

  // Create OAuth client for the namespace
  async createOAuthClient(namespaceId, slug) {
    try {
      const clientData = {
        handle: `crm-${slug}`,
        meta: {
          name: `${slug} CRM Client`,
          description: `OAuth client for ${slug} CRM instance`
        },
        scope: 'api',
        redirectURI: `https://${slug}.crm.huscribe.com/auth/callback`,
        grants: ['authorization_code', 'refresh_token'],
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400
      };

      const response = await axios.post(
        `${this.apiUrl}/system/auth/client/`,
        clientData,
        { headers: this.getHeaders() }
      );

      return {
        clientId: response.data.response.clientID,
        clientSecret: response.data.response.secret
      };
    } catch (error) {
      console.error('Failed to create OAuth client:', error.response?.data || error.message);
      throw new Error('Failed to create OAuth client');
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseUrl}/version`);
      return {
        status: 'healthy',
        version: response.data.version,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default CortezaService;