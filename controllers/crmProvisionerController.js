import asyncHandler from 'express-async-handler';
import { v4 as uuidv4 } from 'uuid';
import CrmTenant from '../models/crmTenantModel.js';
import CortezaService from '../services/cortezaService.js';
import generateToken from '../utils/generateToken.js';

const cortezaService = new CortezaService();

// @desc    Provision new CRM tenant
// @route   POST /api/crm/provision
// @access  Private
export const provisionTenant = asyncHandler(async (req, res) => {
  const { plan, slug, companyName } = req.body;

  // Validate input
  if (!plan || !slug || !companyName) {
    res.status(400);
    throw new Error('Plan, slug, and company name are required');
  }

  // Validate slug format
  const slugRegex = /^[a-z][a-z0-9-]{1,20}$/;
  if (!slugRegex.test(slug)) {
    res.status(400);
    throw new Error('Slug must be 2-21 characters, start with letter, contain only lowercase letters, numbers, and hyphens');
  }

  // Check if slug is already taken
  const existingTenant = await CrmTenant.findOne({ slug });
  if (existingTenant) {
    res.status(409);
    throw new Error('Slug is already taken');
  }

  // Validate plan
  const validPlans = ['startup', 'growth', 'scale', 'enterprise'];
  if (!validPlans.includes(plan)) {
    res.status(400);
    throw new Error('Invalid plan. Must be one of: startup, growth, scale, enterprise');
  }

  const startTime = Date.now();
  
  try {
    // Create tenant record
    const tenantId = uuidv4();
    const tenant = new CrmTenant({
      tenantId,
      userId: req.user._id,
      companyName,
      slug,
      plan,
      status: 'provisioning'
    });

    await tenant.save();

    // Start async provisioning process
    provisionTenantAsync(tenant, req.user).catch(error => {
      console.error(`Async provisioning failed for tenant ${tenantId}:`, error);
      CrmTenant.findByIdAndUpdate(tenant._id, { 
        status: 'error',
        'metadata.error': error.message 
      }).catch(updateError => {
        console.error('Failed to update tenant status:', updateError);
      });
    });

    const provisioningTime = Date.now() - startTime;

    res.status(201).json({
      success: true,
      message: 'CRM provisioning started',
      data: {
        tenantId: tenant.tenantId,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        url: tenant.getTenantUrl(),
        provisioningTime: `${provisioningTime}ms`
      }
    });

  } catch (error) {
    console.error('Provisioning error:', error);
    res.status(500);
    throw new Error('Failed to start CRM provisioning');
  }
});

// Async provisioning function
async function provisionTenantAsync(tenant, user) {
  try {
    console.log(`Starting async provisioning for tenant: ${tenant.tenantId}`);

    // Step 1: Create Corteza namespace
    const namespace = await cortezaService.createNamespace({
      companyName: tenant.companyName,
      slug: tenant.slug,
      plan: tenant.plan
    });

    // Step 2: Import baseline modules
    const moduleIds = await cortezaService.importBaseline(namespace.namespaceID, tenant.plan);

    // Step 3: Create OAuth client
    const oauthClient = await cortezaService.createOAuthClient(namespace.namespaceID, tenant.slug);

    // Step 4: Update tenant with Corteza details
    tenant.cortezaNamespaceId = namespace.namespaceID;
    tenant.oauthClientId = oauthClient.clientId;
    tenant.oauthClientSecret = oauthClient.clientSecret;
    tenant.status = 'active';
    tenant.metadata.provisionedAt = new Date();

    // Step 5: Store module information
    tenant.modules = Object.entries(moduleIds).map(([handle, moduleId]) => ({
      moduleId,
      name: handle.charAt(0).toUpperCase() + handle.slice(1),
      handle,
      isCustom: false
    }));

    await tenant.save();

    console.log(`Successfully provisioned tenant: ${tenant.tenantId}`);

  } catch (error) {
    console.error(`Async provisioning failed for tenant ${tenant.tenantId}:`, error);
    tenant.status = 'error';
    tenant.metadata.error = error.message;
    await tenant.save();
    throw error;
  }
}

// @desc    Get tenant status
// @route   GET /api/crm/tenant/:tenantId/status
// @access  Private
export const getTenantStatus = asyncHandler(async (req, res) => {
  const { tenantId } = req.params;

  const tenant = await CrmTenant.findOne({ 
    tenantId, 
    userId: req.user._id 
  });

  if (!tenant) {
    res.status(404);
    throw new Error('Tenant not found');
  }

  res.json({
    success: true,
    data: {
      tenantId: tenant.tenantId,
      slug: tenant.slug,
      plan: tenant.plan,
      status: tenant.status,
      url: tenant.getTenantUrl(),
      companyName: tenant.companyName,
      infrastructure: tenant.infrastructure,
      limits: tenant.limits,
      usage: tenant.usage,
      features: tenant.features,
      metadata: tenant.metadata,
      modules: tenant.modules
    }
  });
});

// @desc    List user's CRM tenants
// @route   GET /api/crm/tenants
// @access  Private
export const listTenants = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, plan } = req.query;

  const query = { userId: req.user._id };
  
  if (status) query.status = status;
  if (plan) query.plan = plan;

  const tenants = await CrmTenant.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await CrmTenant.countDocuments(query);

  res.json({
    success: true,
    data: {
      tenants: tenants.map(tenant => ({
        tenantId: tenant.tenantId,
        slug: tenant.slug,
        companyName: tenant.companyName,
        plan: tenant.plan,
        status: tenant.status,
        url: tenant.getTenantUrl(),
        infrastructure: tenant.infrastructure,
        createdAt: tenant.createdAt,
        lastActiveAt: tenant.metadata.lastActiveAt
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    }
  });
});

// @desc    Get CRM system status
// @route   GET /api/crm/system/status
// @access  Private
export const getSystemStatus = asyncHandler(async (req, res) => {
  try {
    const cortezaHealth = await cortezaService.healthCheck();
    
    const stats = {
      totalTenants: await CrmTenant.countDocuments(),
      activeTenants: await CrmTenant.countDocuments({ status: 'active' }),
      provisioningTenants: await CrmTenant.countDocuments({ status: 'provisioning' }),
      errorTenants: await CrmTenant.countDocuments({ status: 'error' })
    };

    const planDistribution = await CrmTenant.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        corteza: cortezaHealth,
        statistics: stats,
        planDistribution: planDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500);
    throw new Error('Failed to get system status');
  }
});