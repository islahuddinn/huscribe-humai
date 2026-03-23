import axios from 'axios';

class HuscribeCrmSDK {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.CRM_BASE_URL;
    this.authToken = options.authToken;
    this.namespaceId = options.namespaceId;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.modules = new Map();
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Authentication
  async login(credentials) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/system/auth/login`, credentials);
      this.authToken = response.data.response.jwt;
      return this.authToken;
    } catch (error) {
      console.error('Login failed:', error.response?.data || error.message);
      throw new Error('Authentication failed');
    }
  }

  // Get headers with authentication
  getHeaders() {
    if (!this.authToken) {
      throw new Error('Not authenticated. Call login() first.');
    }
    
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Discover and cache modules
  async discoverModules() {
    try {
      const cacheKey = `modules_${this.namespaceId}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const response = await axios.get(
        `${this.baseUrl}/api/compose/namespace/${this.namespaceId}/module/`,
        { headers: this.getHeaders() }
      );

      const modules = response.data.response.set || [];
      
      // Cache modules by handle and ID
      modules.forEach(module => {
        this.modules.set(module.handle, module);
        this.modules.set(module.moduleID, module);
      });

      this.setCache(cacheKey, modules);
      return modules;
    } catch (error) {
      console.error('Failed to discover modules:', error.response?.data || error.message);
      throw new Error('Failed to discover modules');
    }
  }

  // Get module by handle or ID
  async getModule(handleOrId) {
    if (!this.modules.has(handleOrId)) {
      await this.discoverModules();
    }
    return this.modules.get(handleOrId);
  }

  // Generic CRUD operations
  
  // Create record
  async create(moduleHandle, data) {
    try {
      const module = await this.getModule(moduleHandle);
      if (!module) {
        throw new Error(`Module '${moduleHandle}' not found`);
      }

      const response = await axios.post(
        `${this.baseUrl}/api/compose/namespace/${this.namespaceId}/module/${module.moduleID}/record/`,
        { values: data },
        { headers: this.getHeaders() }
      );

      return response.data.response;
    } catch (error) {
      console.error(`Failed to create ${moduleHandle} record:`, error.response?.data || error.message);
      throw new Error(`Failed to create ${moduleHandle} record`);
    }
  }

  // List/Search records
  async list(moduleHandle, options = {}) {
    try {
      const module = await this.getModule(moduleHandle);
      if (!module) {
        throw new Error(`Module '${moduleHandle}' not found`);
      }

      const params = new URLSearchParams({
        query: options.query || '',
        filter: options.filter || '',
        sort: options.sort || '',
        limit: (options.limit || 20).toString(),
        offset: (options.offset || 0).toString()
      });

      const response = await axios.get(
        `${this.baseUrl}/api/compose/namespace/${this.namespaceId}/module/${module.moduleID}/record/?${params}`,
        { headers: this.getHeaders() }
      );

      return response.data.response;
    } catch (error) {
      console.error(`Failed to list ${moduleHandle} records:`, error.response?.data || error.message);
      throw new Error(`Failed to list ${moduleHandle} records`);
    }
  }

  // Specialized CRM methods
  
  // Lead management
  async createLead(data) {
    return this.create('lead', data);
  }

  async convertLead(leadId, contactData = {}) {
    try {
      const lead = await this.read('lead', leadId);
      
      // Create contact from lead data
      const contact = await this.create('contact', {
        firstName: contactData.firstName || lead.values.name?.split(' ')[0] || '',
        lastName: contactData.lastName || lead.values.name?.split(' ').slice(1).join(' ') || '',
        email: lead.values.email,
        phone: lead.values.phone,
        company: lead.values.company,
        ...contactData
      });

      // Update lead status
      await this.update('lead', leadId, { status: 'converted' });

      return { lead, contact };
    } catch (error) {
      console.error('Lead conversion failed:', error.message);
      throw new Error('Lead conversion failed');
    }
  }

  // Pipeline management
  async getPipeline(stageFilter = '') {
    try {
      const filter = stageFilter ? `stage = "${stageFilter}"` : '';
      const opportunities = await this.list('opportunity', { filter, sort: 'stage ASC, amount DESC' });
      
      // Group by stage
      const pipeline = {};
      opportunities.set?.forEach(opp => {
        const stage = opp.values.stage || 'unknown';
        if (!pipeline[stage]) {
          pipeline[stage] = [];
        }
        pipeline[stage].push(opp);
      });

      return pipeline;
    } catch (error) {
      console.error('Failed to get pipeline:', error.message);
      throw new Error('Failed to get pipeline');
    }
  }

  // Cache management
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
}

export default HuscribeCrmSDK;