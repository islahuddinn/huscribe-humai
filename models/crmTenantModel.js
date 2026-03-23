import mongoose from 'mongoose';

const crmTenantSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  companyName: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    match: /^[a-z][a-z0-9-]{1,20}$/
  },
  plan: {
    type: String,
    enum: ['startup', 'growth', 'scale', 'enterprise'],
    required: true,
    default: 'startup'
  },
  status: {
    type: String,
    enum: ['provisioning', 'active', 'suspended', 'migrating', 'error'],
    default: 'provisioning'
  },
  cortezaNamespaceId: {
    type: String,
    unique: true,
    sparse: true
  },
  oauthClientId: {
    type: String,
    unique: true,
    sparse: true
  },
  oauthClientSecret: {
    type: String
  },
  customDomain: {
    type: String,
    unique: true,
    sparse: true
  },
  infrastructure: {
    type: String,
    enum: ['shared', 'dedicated'],
    default: 'shared'
  },
  limits: {
    seats: {
      type: Number,
      default: 5
    },
    storage: {
      type: Number,
      default: 10 // GB
    },
    customModules: {
      type: Number,
      default: 0
    },
    workflows: {
      type: Number,
      default: 0
    },
    integrations: {
      type: Number,
      default: 0
    }
  },
  usage: {
    seats: {
      type: Number,
      default: 1
    },
    storage: {
      type: Number,
      default: 0
    },
    customModules: {
      type: Number,
      default: 0
    },
    workflows: {
      type: Number,
      default: 0
    },
    integrations: {
      type: Number,
      default: 0
    }
  },
  modules: [{
    moduleId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    handle: {
      type: String,
      required: true
    },
    isCustom: {
      type: Boolean,
      default: false
    },
    fields: [{
      name: String,
      handle: String,
      kind: String,
      required: Boolean,
      unique: Boolean
    }]
  }],
  features: {
    advancedRelations: {
      type: Boolean,
      default: false
    },
    customWorkflows: {
      type: Boolean,
      default: false
    },
    calendarSync: {
      type: Boolean,
      default: false
    },
    emailSync: {
      type: Boolean,
      default: false
    },
    facetedSearch: {
      type: Boolean,
      default: false
    },
    customReporting: {
      type: Boolean,
      default: false
    }
  },
  metadata: {
    provisionedAt: {
      type: Date
    },
    lastActiveAt: {
      type: Date,
      default: Date.now
    },
    migrationHistory: [{
      fromPlan: String,
      toPlan: String,
      fromInfrastructure: String,
      toInfrastructure: String,
      migratedAt: Date,
      downtime: Number // in seconds
    }]
  },
  cortezaConfig: {
    baseUrl: {
      type: String,
      default: process.env.CORTEZA_BASE_URL || 'http://localhost:18080'
    },
    authToken: String,
    refreshToken: String
  }
}, {
  timestamps: true
});

// Indexes for performance
crmTenantSchema.index({ userId: 1 });
crmTenantSchema.index({ slug: 1 });
crmTenantSchema.index({ plan: 1 });
crmTenantSchema.index({ status: 1 });
crmTenantSchema.index({ 'metadata.lastActiveAt': -1 });

// Pre-save middleware to set plan limits
crmTenantSchema.pre('save', function(next) {
  if (this.isModified('plan')) {
    switch (this.plan) {
      case 'startup':
        this.limits.seats = 5;
        this.limits.storage = 10;
        this.limits.customModules = 0;
        this.limits.workflows = 0;
        this.limits.integrations = 0;
        break;
      case 'growth':
        this.limits.seats = 30;
        this.limits.storage = 50;
        this.limits.customModules = 0;
        this.limits.workflows = 0;
        this.limits.integrations = 0;
        break;
      case 'scale':
        this.limits.seats = 49;
        this.limits.storage = 100;
        this.limits.customModules = -1; // unlimited
        this.limits.workflows = 5;
        this.limits.integrations = 10;
        this.features.advancedRelations = true;
        this.features.facetedSearch = true;
        break;
      case 'enterprise':
        this.limits.seats = -1; // unlimited
        this.limits.storage = -1; // unlimited
        this.limits.customModules = -1; // unlimited
        this.limits.workflows = -1; // unlimited
        this.limits.integrations = -1; // unlimited
        this.infrastructure = 'dedicated';
        this.features.advancedRelations = true;
        this.features.customWorkflows = true;
        this.features.calendarSync = true;
        this.features.emailSync = true;
        this.features.facetedSearch = true;
        this.features.customReporting = true;
        break;
    }
  }
  next();
});

// Method to check if tenant can exceed limits
crmTenantSchema.methods.canExceedLimit = function(limitType, requestedAmount = 1) {
  const currentUsage = this.usage[limitType] || 0;
  const limit = this.limits[limitType];
  
  // -1 means unlimited
  if (limit === -1) return true;
  
  return (currentUsage + requestedAmount) <= limit;
};

// Method to get tenant URL
crmTenantSchema.methods.getTenantUrl = function() {
  if (this.customDomain) {
    return `https://${this.customDomain}`;
  }
  return `https://${this.slug}.crm.huscribe.com`;
};

const CrmTenant = mongoose.model('CrmTenant', crmTenantSchema);

export default CrmTenant; 