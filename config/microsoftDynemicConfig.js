import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Microsoft OAuth Configuration
const oauthConfig = {
  identityMetadata: `https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration`,
  clientId: process.env.MD_CLIENT_ID,
  clientSecret: process.env.MD_CLIENT_SECRET,
  tenantId: process.env.TENANT_ID,
  redirectUri: process.env.MD_REDIRECT_URI,
  authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
  responseType: 'code',
  responseMode: 'query',
  scopes: [
    `${process.env.DYNAMICS_CRM_URL}/.default`,
    'offline_access',
    'openid',
    'profile',
    'email'
  ],
  validateIssuer: false,
  passReqToCallback: true
};

// Standard Dynamics 365 Entity Mappings (no permissions required)
const STANDARD_ENTITIES = {
  // Core CRM Entities
  'contact': {
    logicalName: 'contact',
    entitySetName: 'contacts',
    displayName: 'Contact',
    primaryIdField: 'contactid',
    primaryNameField: 'fullname'
  },
  'lead': {
    logicalName: 'lead',
    entitySetName: 'leads',
    displayName: 'Lead',
    primaryIdField: 'leadid',
    primaryNameField: 'fullname'
  },
  'account': {
    logicalName: 'account',
    entitySetName: 'accounts',
    displayName: 'Account',
    primaryIdField: 'accountid',
    primaryNameField: 'name'
  },
  'opportunity': {
    logicalName: 'opportunity',
    entitySetName: 'opportunities',
    displayName: 'Opportunity',
    primaryIdField: 'opportunityid',
    primaryNameField: 'name'
  },
  'task': {
    logicalName: 'task',
    entitySetName: 'tasks',
    displayName: 'Task',
    primaryIdField: 'activityid',
    primaryNameField: 'subject'
  },
  'appointment': {
    logicalName: 'appointment',
    entitySetName: 'appointments',
    displayName: 'Appointment',
    primaryIdField: 'activityid',
    primaryNameField: 'subject'
  },
  'incident': {
    logicalName: 'incident',
    entitySetName: 'incidents',
    displayName: 'Case',
    primaryIdField: 'incidentid',
    primaryNameField: 'title'
  },
  'product': {
    logicalName: 'product',
    entitySetName: 'products',
    displayName: 'Product',
    primaryIdField: 'productid',
    primaryNameField: 'name'
  },
  'quote': {
    logicalName: 'quote',
    entitySetName: 'quotes',
    displayName: 'Quote',
    primaryIdField: 'quoteid',
    primaryNameField: 'name'
  },
  'salesorder': {
    logicalName: 'salesorder',
    entitySetName: 'salesorders',
    displayName: 'Order',
    primaryIdField: 'salesorderid',
    primaryNameField: 'name'
  },
  'invoice': {
    logicalName: 'invoice',
    entitySetName: 'invoices',
    displayName: 'Invoice',
    primaryIdField: 'invoiceid',
    primaryNameField: 'name'
  },
  'campaign': {
    logicalName: 'campaign',
    entitySetName: 'campaigns',
    displayName: 'Campaign',
    primaryIdField: 'campaignid',
    primaryNameField: 'name'
  },
  'goal': {
    logicalName: 'goal',
    entitySetName: 'goals',
    displayName: 'Goal',
    primaryIdField: 'goalid',
    primaryNameField: 'title'
  },
  'annotation': {
    logicalName: 'annotation',
    entitySetName: 'annotations',
    displayName: 'Note',
    primaryIdField: 'annotationid',
    primaryNameField: 'subject'
  },
  'phonecall': {
    logicalName: 'phonecall',
    entitySetName: 'phonecalls',
    displayName: 'Phone Call',
    primaryIdField: 'activityid',
    primaryNameField: 'subject'
  },
  'email': {
    logicalName: 'email',
    entitySetName: 'emails',
    displayName: 'Email',
    primaryIdField: 'activityid',
    primaryNameField: 'subject'
  }
};

// Entity aliases for common variations
const ENTITY_ALIASES = {
  'deal': 'opportunity',
  'deals': 'opportunity',
  'meeting': 'appointment',
  'meetings': 'appointment',
  'case': 'incident',
  'cases': 'incident',
  'note': 'annotation',
  'notes': 'annotation',
  'order': 'salesorder',
  'orders': 'salesorder',
  'call': 'phonecall',  
  'calls': 'phonecall',
  'phone': 'phonecall'
};

// Function to get authorization URL - Enhanced for dynamic multi-tenant support
export const getAuthUrl = (platform = 'external', forceConsent = false, requestDynamicsAccess = true) => {
  try {
    console.log(`🔐 Generating auth URL for platform: ${platform}, forceConsent: ${forceConsent}, requestDynamicsAccess: ${requestDynamicsAccess}`);
    
    // Use 'common' tenant for multi-tenant support
    const tenant = 'common';
    
    // Enhanced scopes for better multi-tenant support
    let scopes = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'https://graph.microsoft.com/User.Read',
      'https://graph.microsoft.com/Organization.Read.All',
      'https://admin.services.crm.dynamics.com/user_impersonation'
    ];

    // Ensure redirect URI is properly formatted
    const redirectUri = process.env.MD_REDIRECT_URI;
    if (!redirectUri) {
      throw new Error('MD_REDIRECT_URI is not configured in environment variables');
    }

    // Validate client ID
    if (!process.env.MD_CLIENT_ID) {
      throw new Error('MD_CLIENT_ID is not configured in environment variables');
    }

    // Create URL parameters with proper encoding
    const params = new URLSearchParams({
      client_id: process.env.MD_CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state: `${platform}_discovery_${Date.now()}`,
      response_mode: 'query',
      prompt: forceConsent ? 'consent' : 'consent'  // Always request consent for multi-tenant
    });

    // Build the complete URL
    const authUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
    
    console.log('🔗 Generated auth URL with scopes:', scopes);
    
    return authUrl;
  } catch (error) {
    console.error('❌ Error generating auth URL:', error);
    throw error;
  }
};

// Function to get Dynamics 365 specific token for a discovered organization
export const getDynamicsTokenForOrganization = async (refreshToken, organizationUrl) => {
  console.log(`🔄 Getting Dynamics 365 token for organization: ${organizationUrl}`);
  
  // Use common tenant for initial token exchange
  const tenant = 'common';
  
  // Dynamics 365 specific scopes for the organization
  const scopes = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'https://graph.microsoft.com/User.Read',
    'https://graph.microsoft.com/Organization.Read.All',
    `${organizationUrl}/.default`,
    'https://admin.services.crm.dynamics.com/user_impersonation'
  ];

  const params = new URLSearchParams({
    client_id: process.env.MD_CLIENT_ID,
    client_secret: process.env.MD_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: scopes.join(' ')
  });

  try {
    console.log(`📡 Making Dynamics token request for organization: ${organizationUrl}`);
    
    const response = await axios.post(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    // Store the instance URL with the new token
    if (response.data.access_token) {
      storeInstanceUrlForToken(response.data.access_token, organizationUrl);
    }

    console.log(`✅ Dynamics token exchange successful for organization`);

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type,
      scope: response.data.scope,
      organizationUrl: organizationUrl
    };
  } catch (error) {
    console.error('❌ Dynamics Token Error:', {
      status: error.response?.status,
      error: error.response?.data?.error,
      description: error.response?.data?.error_description,
      organizationUrl: organizationUrl
    });
    
    throw new Error(`Failed to get Dynamics 365 token for organization: ${error.response?.data?.error_description || error.message}`);
  }
};

// Function to get access token with authorization code - Phase 1: Graph token only
export const getAccessTokenWithCode = async (code, platform = 'external') => {
  console.log(`🔄 Exchanging auth code for Graph tokens, platform: ${platform}`);
  
  // Ensure redirect URI is properly formatted
  const redirectUri = process.env.MD_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error('MD_REDIRECT_URI is not configured in environment variables');
  }

  // Validate required environment variables
  if (!process.env.MD_CLIENT_ID) {
    throw new Error('MD_CLIENT_ID is not configured in environment variables');
  }
  if (!process.env.MD_CLIENT_SECRET) {
    throw new Error('MD_CLIENT_SECRET is not configured in environment variables');
  }

  // Always use 'common' for multi-tenant support
  const tenant = 'common';

  // Phase 1: Only Graph scopes for organization discovery
  const scopes = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'https://graph.microsoft.com/User.Read'
  ];

  const params = new URLSearchParams({
    client_id: process.env.MD_CLIENT_ID,
    client_secret: process.env.MD_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    scope: scopes.join(' ')
  });

  try {
    console.log(`📡 Making Graph token request to tenant: ${tenant}`);
    
    const response = await axios.post(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log(`✅ Graph token exchange successful, expires in: ${response.data.expires_in} seconds`);

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type,
      scope: response.data.scope,
      tenantUsed: tenant,
      tokenType: 'graph' // Mark this as Graph token
    };
  } catch (error) {
    console.error('❌ Token Error Details:', {
      status: error.response?.status,
      error: error.response?.data?.error,
      description: error.response?.data?.error_description,
      correlationId: error.response?.data?.correlation_id,
      redirectUri: redirectUri,
      tenant: tenant,
      timestamp: new Date().toISOString()
    });
    
    // Enhanced error handling
    const errorData = error.response?.data;
    
    if (errorData?.error_codes?.includes(90002)) {
      throw new Error(`Tenant configuration error. Current tenant '${tenant}' not found. 
      
Recommendations:
1. Ensure your Azure AD app is configured for multi-tenant access
2. Check that your app registration supports "Accounts in any organizational directory"
3. Verify the redirect URI matches exactly: ${redirectUri}`);
    }
    
    if (errorData?.error === 'invalid_client') {
      throw new Error(`Invalid client credentials. Please verify:
1. MD_CLIENT_ID is correct: ${process.env.MD_CLIENT_ID?.substring(0, 8)}...
2. MD_CLIENT_SECRET is valid and not expired
3. Azure AD app registration is active
4. App registration supports multi-tenant authentication`);
    }
    
    if (errorData?.error === 'invalid_grant') {
      throw new Error('Authorization code is invalid or expired. Please try authentication again.');
    }

    if (errorData?.error === 'invalid_request' && errorData?.error_description?.includes('client_id')) {
      throw new Error(`Client ID parameter error. Please check:
1. MD_CLIENT_ID environment variable is set correctly
2. Azure AD app registration client ID matches environment variable
3. No special characters or spaces in client ID
Current client ID: ${process.env.MD_CLIENT_ID?.substring(0, 8)}...`);
    }
    
    throw new Error(`Azure AD Error: ${errorData?.error_description || error.message}`);
  }
};

// Function to refresh access token with enhanced error handling
export const refreshAccessToken = async (refreshToken) => {
  console.log('🔄 Refreshing access token...');
  
  // Try different tenant configurations for refresh
  const tenantOptions = [
    'common',  // Multi-tenant approach (recommended for refresh)
    process.env.TENANT_ID  // Specific tenant ID
  ].filter(Boolean);
  
  for (const tenant of tenantOptions) {
    console.log(`🔄 Attempting token refresh with tenant: ${tenant}`);
  
  const params = new URLSearchParams({
      client_id: process.env.MD_CLIENT_ID,
      client_secret: process.env.MD_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
      scope: [
        'openid',
        'profile', 
        'email',
        'offline_access',
        `${process.env.DYNAMICS_CRM_URL}/.default`
      ].join(' ')
  });

  try {
      const tokenEndpoint = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
      console.log(`📡 Token refresh endpoint: ${tokenEndpoint}`);
      
    const response = await axios.post(
        tokenEndpoint,
      params,
      {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log(`✅ Token refresh successful with tenant: ${tenant}`);

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
        tokenType: response.data.token_type,
        scope: response.data.scope,
        usedTenant: tenant
      };
    } catch (tenantError) {
      console.log(`❌ Token refresh failed with tenant ${tenant}:`, {
        error: tenantError.response?.data?.error,
        description: tenantError.response?.data?.error_description,
        status: tenantError.response?.status
      });
      
      // If this is the last tenant option, we'll throw the error
      if (tenant === tenantOptions[tenantOptions.length - 1]) {
        // Enhanced error handling for common refresh token issues
        const errorData = tenantError.response?.data;
        
        if (errorData?.error === 'invalid_grant') {
          throw new Error('Refresh token has expired or is invalid. Please re-authenticate by visiting the auth initiate endpoint.');
        }
        
        if (errorData?.error === 'invalid_client') {
          throw new Error('Invalid client credentials. Please check your MD_CLIENT_ID and MD_CLIENT_SECRET environment variables.');
        }
        
        if (errorData?.error_codes?.includes(90002)) {
          throw new Error(`Tenant not found error. This usually means:
1. Your TENANT_ID environment variable may be incorrect
2. Try using 'common' instead of a specific tenant ID
3. Your Azure AD app may not be properly configured for multi-tenant access
4. The tenant may have been deleted or suspended

Current TENANT_ID: ${process.env.TENANT_ID}
Recommendation: Update your .env file to use TENANT_ID=common for multi-tenant apps`);
        }
        
        if (errorData?.error_codes?.includes(50173)) {
          throw new Error('User needs to sign-in again. The refresh token is no longer valid. Please re-authenticate.');
        }
        
        // Generic error with helpful context
        throw new Error(`Token refresh failed: ${errorData?.error_description || tenantError.message}
        
Troubleshooting steps:
1. Check if your refresh token is still valid
2. Verify your client credentials (MD_CLIENT_ID, MD_CLIENT_SECRET)
3. Try setting TENANT_ID=common in your .env file
4. Re-authenticate if the refresh token has expired
5. Check Azure AD app registration configuration`);
      }
    }
  }
};

// Function to make CRM API requests with dynamic organization URL
export const makeCrmRequest = async (method, endpoint, accessToken, data = null, organizationUrl = null) => {
  try {
    // Use provided organization URL (required for dynamic environments)
    if (!organizationUrl) {
      throw new Error('Organization URL is required for CRM API requests. Please ensure user has selected a Dynamics 365 organization.');
    }
    
    const crmUrl = organizationUrl;
    
    // Check if endpoint already includes the API path to avoid duplication
    let fullUrl;
    if (endpoint.startsWith('/api/data/v9.2/') || endpoint.startsWith('api/data/v9.2/')) {
      // Endpoint already has the API path, just append to base URL
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      fullUrl = `${crmUrl}${cleanEndpoint}`;
    } else {
      // Endpoint doesn't have API path, add it
      fullUrl = `${crmUrl}/api/data/v9.2/${endpoint}`;
    }
    
    console.log(`📡 Making CRM ${method} request:`, { 
      method, 
      endpoint,
      fullUrl,
      organizationUrl: crmUrl,
      hasAccessToken: !!accessToken,
      tokenLength: accessToken?.length,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : []
    });

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      'Accept': 'application/json',
      'Prefer': 'return=representation',
      'If-None-Match': 'null'
    };

    // Add additional headers for specific operations
    if (method === 'POST') {
      headers['Prefer'] = 'return=representation,odata.include-annotations="*"';
    }

    console.log('📋 Request headers configured:', {
      ...headers,
      Authorization: 'Bearer [REDACTED]'
    });

    const config = {
      method,
      url: fullUrl,
      headers,
      data,
      validateStatus: function (status) {
        return status >= 200 && status < 300;
      }
    };

    const response = await axios(config);
    console.log(`✅ CRM ${method} request successful:`, {
      status: response.status,
      hasData: !!response.data,
      dataType: typeof response.data
    });
    
    return response.data;
  } catch (error) {
    console.error(`❌ CRM API Error for ${method} ${endpoint}:`, {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers,
      organizationUrl: organizationUrl,
      request: {
        url: error.config?.url,
        method: error.config?.method,
        headers: {
          ...error.config?.headers,
          Authorization: 'Bearer [REDACTED]'
        }
      }
    });

    // Enhanced error handling
    if (error.response?.status === 401) {
      throw new Error('Authentication failed: Token may be expired or invalid for this Dynamics 365 organization');
    }

    if (error.response?.status === 403) {
      throw new Error('Permission denied: You do not have sufficient permissions for this operation in this Dynamics 365 organization');
    }

    if (error.response?.status === 404) {
      const errorMessage = error.response?.data?.error?.message || 'Resource not found';
      throw new Error(`Resource not found: ${errorMessage}`);
    }

    if (error.response?.status === 400) {
      const errorMessage = error.response?.data?.error?.message || 'Invalid request';
      throw new Error(`Bad request: ${errorMessage}`);
    }

    throw new Error(`CRM API Error: ${error.response?.data?.error?.message || error.message}`);
  }
};

// Simplified entity discovery without requiring EntityDefinitions access
export const discoverEntityDetails = async (entityType, accessToken, organizationUrl = null) => {
  try {
    console.log(`🔍 Starting entity discovery for: ${entityType}`);
    
    // Normalize the entity type
    const normalizedType = entityType.toLowerCase().trim();
    console.log(`📝 Normalized entity type: ${normalizedType}`);
    
    // Check aliases first
    const targetEntityName = ENTITY_ALIASES[normalizedType] || normalizedType;
    console.log(`🎯 Target entity name: ${targetEntityName} (original: ${entityType})`);
    
    // Check if we have a standard mapping
    if (STANDARD_ENTITIES[targetEntityName]) {
      const entityDetails = STANDARD_ENTITIES[targetEntityName];
      console.log(`✅ Found standard entity mapping:`, entityDetails);
      
      // Validate entity access by making a simple request with organization URL
      try {
        console.log(`🔬 Validating access to entity: ${entityDetails.entitySetName}`);
        await makeCrmRequest('GET', `${entityDetails.entitySetName}?$top=1&$select=${entityDetails.primaryIdField}`, accessToken, null, organizationUrl);
        console.log(`✅ Entity access validated for: ${entityDetails.logicalName}`);
        return entityDetails;
      } catch (accessError) {
        console.error(`❌ Entity access validation failed for ${entityDetails.logicalName}:`, accessError.message);
        throw new Error(`Entity '${entityType}' exists but you don't have permission to access it: ${accessError.message}`);
      }
    }

    // If not found in standard entities, list available ones
    const availableEntities = Object.keys(STANDARD_ENTITIES).sort();
    console.error(`❌ Entity '${entityType}' not found in standard mappings.`);
    console.log(`📋 Available entities:`, availableEntities);

    throw new Error(`Entity '${entityType}' not supported. Available entities: ${availableEntities.join(', ')}`);
    
  } catch (error) {
    console.error(`❌ Entity discovery failed for ${entityType}:`, {
      errorMessage: error.message,
      entityType,
      timestamp: new Date().toISOString()
    });
    
    throw new Error(`Entity discovery failed for ${entityType}: ${error.message}`);
  }
};

// Function to get all available standard entities (no API call needed)
export const getAllAvailableEntities = async (accessToken) => {
  console.log('📋 Getting all available standard entities...');
  
  const entities = new Map();
  
  // Convert standard entities to Map format
  Object.entries(STANDARD_ENTITIES).forEach(([key, value]) => {
    entities.set(key, value);
  });
  
  console.log(`✅ Retrieved ${entities.size} standard entities`);
  return entities;
};

// Function to test entity access
export const testEntityAccess = async (entityType, accessToken) => {
  try {
    console.log(`🧪 Testing access to entity: ${entityType}`);
    
    const entityDetails = await discoverEntityDetails(entityType, accessToken);
    
    // Test basic read access
    const testResponse = await makeCrmRequest(
      'GET', 
      `${entityDetails.entitySetName}?$top=1&$select=${entityDetails.primaryIdField}`, 
      accessToken
    );
    
    console.log(`✅ Entity access test successful for: ${entityType}`);
    
    return {
      hasAccess: true,
      entityDetails,
      testResponse: {
        recordCount: testResponse.value?.length || 0,
        canRead: true
      }
    };
  } catch (error) {
    console.error(`❌ Entity access test failed for ${entityType}:`, error.message);
    
    return {
      hasAccess: false,
      entityDetails: null,
      error: error.message
    };
  }
};

// Function to get entity cache status (simplified)
export const getEntityCacheStatus = () => {
  const entities = Object.keys(STANDARD_ENTITIES).sort();
  return {
    size: entities.length,
    isExpired: false,
    expiresAt: null,
    entities: entities,
    type: 'static_mapping',
    note: 'Using static entity mappings for better reliability'
  };
};

// Clear cache function (no-op for static mapping)
export const clearEntityCache = () => {
  console.log('ℹ️ Static entity mappings don\'t require cache clearing');
  return true;
};

// Function to discover user's available Dynamics 365 organizations
export const discoverUserOrganizations = async (accessToken) => {
  console.log('🔍 Discovering user\'s available Dynamics 365 organizations...');
  
  try {
    // Use the global discovery service to find user's organizations
    const response = await axios.get(
      'https://globaldisco.crm.dynamics.com/api/discovery/v2.0/Instances',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    console.log('✅ Discovery successful:', {
      organizationCount: response.data.value?.length || 0
    });

    if (response.data.value && response.data.value.length > 0) {
      const organizations = response.data.value.map(org => ({
        friendlyName: org.FriendlyName,
        uniqueName: org.UniqueName,
        urlName: org.UrlName,
        apiUrl: org.ApiUrl,
        region: org.Region,
        version: org.Version,
        state: org.State
      }));

      console.log('📋 Available organizations:', organizations);
      return organizations;
    } else {
      console.log('⚠️ No Dynamics 365 organizations found for this user');
      return [];
    }
  } catch (error) {
    console.error('❌ Organization discovery failed:', {
      status: error.response?.status,
      error: error.response?.data?.error,
      message: error.message
    });

    // If discovery fails, try alternative approach
    if (error.response?.status === 403) {
      throw new Error('User does not have access to any Dynamics 365 organizations. Please ensure the user has a valid Dynamics 365 license and is added to an organization.');
    }

    throw new Error(`Organization discovery failed: ${error.message}`);
  }
};

// Function to validate organization access with enhanced checks
export const validateOrganizationAccess = async (organizationUrl, accessToken) => {
  console.log(`🔬 Validating access to organization: ${organizationUrl}`);
  
  try {
    // Step 1: Basic WhoAmI check
    const whoAmIResponse = await axios.get(
      `${organizationUrl}/api/data/v9.2/WhoAmI`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    // Step 2: Check user roles and privileges
    const userRolesResponse = await axios.get(
      `${organizationUrl}/api/data/v9.2/systemusers(${whoAmIResponse.data.UserId})?$expand=systemuserroles_association($select=name,roleid)`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    // Step 3: Check basic entity access
    const testEntities = ['account', 'contact', 'lead'];
    const entityAccess = {};

    for (const entity of testEntities) {
      try {
        await axios.get(
          `${organizationUrl}/api/data/v9.2/${entity}s?$top=1`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
              'OData-MaxVersion': '4.0',
              'OData-Version': '4.0'
            }
          }
        );
        entityAccess[entity] = true;
      } catch (error) {
        entityAccess[entity] = false;
      }
    }

    const roles = userRolesResponse.data.systemuserroles_association || [];
    const hasAdminRole = roles.some(role => 
      role.name.toLowerCase().includes('admin') || 
      role.name.toLowerCase().includes('system customizer')
    );

    console.log('✅ Organization access validated:', {
      userId: whoAmIResponse.data.UserId,
      organizationId: whoAmIResponse.data.OrganizationId,
      roles: roles.map(r => r.name),
      entityAccess
    });

    return {
      hasAccess: true,
      userId: whoAmIResponse.data.UserId,
      organizationId: whoAmIResponse.data.OrganizationId,
      businessUnitId: whoAmIResponse.data.BusinessUnitId,
      roles: roles.map(r => ({ id: r.roleid, name: r.name })),
      isAdmin: hasAdminRole,
      entityAccess,
      accessLevel: hasAdminRole ? 'admin' : 'standard',
      validationTimestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Organization access validation failed:', {
      status: error.response?.status,
      error: error.response?.data?.error,
      message: error.message
    });

    const is403 = error.response?.status === 403;
    const is401 = error.response?.status === 401;

    return {
      hasAccess: false,
      error: error.message,
      details: error.response?.data?.error,
      statusCode: error.response?.status,
      type: is403 ? 'INSUFFICIENT_PERMISSIONS' : 
            is401 ? 'INVALID_TOKEN' : 
            'CONNECTION_ERROR',
      recommendation: is403 ? 'User needs additional permissions in Dynamics 365' :
                     is401 ? 'Token is invalid or expired' :
                     'Check network connection and Dynamics 365 URL',
      validationTimestamp: new Date().toISOString()
    };
  }
};

// Function to discover actual available entity sets in the environment
export const discoverActualEntitySets = async (accessToken) => {
  console.log('🔍 Discovering actual entity sets in your D365 environment...');
  
  try {
    // Use the $metadata endpoint to get actual entity sets
    const response = await axios.get(
      `${process.env.DYNAMICS_CRM_URL}/api/data/v9.2/$metadata`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/xml',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    console.log('✅ Metadata retrieved successfully');

    // Parse the XML to extract entity sets
    const xmlContent = response.data;
    
    // Extract EntitySet names using regex (simple approach)
    const entitySetMatches = xmlContent.match(/<EntitySet[^>]*Name="([^"]*)"[^>]*>/g);
    
    if (!entitySetMatches) {
      throw new Error('Could not parse entity sets from metadata');
    }

    const availableEntitySets = [];
    const entitySetMap = new Map();

    entitySetMatches.forEach(match => {
      const nameMatch = match.match(/Name="([^"]*)"/);
      if (nameMatch) {
        const entitySetName = nameMatch[1];
        availableEntitySets.push(entitySetName);
        entitySetMap.set(entitySetName.toLowerCase(), entitySetName);
      }
    });

    console.log(`✅ Found ${availableEntitySets.length} entity sets in environment`);
    
    // Check which of our standard entities are available
    const standardEntityStatus = {};
    
    Object.entries(STANDARD_ENTITIES).forEach(([key, entity]) => {
      const isAvailable = entitySetMap.has(entity.entitySetName.toLowerCase());
      standardEntityStatus[key] = {
        ...entity,
        isAvailable,
        status: isAvailable ? 'AVAILABLE' : 'NOT_FOUND'
      };
    });

    return {
      totalEntitySets: availableEntitySets.length,
      availableEntitySets: availableEntitySets.sort(),
      standardEntityStatus,
      availableStandardEntities: Object.keys(standardEntityStatus).filter(
        key => standardEntityStatus[key].isAvailable
      ),
      unavailableStandardEntities: Object.keys(standardEntityStatus).filter(
        key => !standardEntityStatus[key].isAvailable
      )
    };
  } catch (error) {
    console.error('❌ Failed to discover actual entity sets:', {
      status: error.response?.status,
      error: error.response?.data?.error || error.message
    });

    throw new Error(`Entity set discovery failed: ${error.message}`);
  }
};

// Function to get a working entity mapping based on what's actually available
// Enhanced subscription-aware entity validation
export const validateEntityAvailability = async (entityType, accessToken, organizationUrl = null) => {
  try {
    // Quick entity availability check
    const entitySetName = getEntitySetName(entityType);
    
    const testUrl = organizationUrl || process.env.DYNAMICS_CRM_URL;
    const response = await axios.get(
      `${testUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${entityType}')?$select=LogicalName,DisplayName,CanCreateAttributes,IsValidForAdvancedFind`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    return {
      available: true,
      entityType: entityType,
      displayName: response.data.DisplayName?.UserLocalizedLabel?.Label || entityType,
      canCreate: response.data.CanCreateAttributes !== false,
      canRead: response.data.IsValidForAdvancedFind !== false,
      entitySetName: entitySetName
    };
  } catch (error) {
    return {
      available: false,
      entityType: entityType,
      error: error.response?.status === 404 ? 'Entity not found' : 'Permission denied',
      statusCode: error.response?.status,
      requiresLicense: getRequiredLicenseForEntity(entityType)
    };
  }
};

export const getWorkingEntityDetails = async (entityType, accessToken) => {
  try {
    console.log(`🔍 Getting working entity details for: ${entityType}`);
    
    // First try the standard approach
    const normalizedType = entityType.toLowerCase().trim();
    const targetEntityName = ENTITY_ALIASES[normalizedType] || normalizedType;
    
    if (STANDARD_ENTITIES[targetEntityName]) {
      const entityDetails = STANDARD_ENTITIES[targetEntityName];
      
      // Test if this entity set actually exists by making a minimal request
      try {
        console.log(`🧪 Testing entity set: ${entityDetails.entitySetName}`);
        
        // Make a very simple request to see if the entity set exists
        // Use $top=1 instead of $top=0 as some environments don't accept 0
        await makeCrmRequest('GET', `${entityDetails.entitySetName}?$top=1&$select=${entityDetails.primaryIdField}`, accessToken);
        
        console.log(`✅ Entity set ${entityDetails.entitySetName} is available`);
        return entityDetails;
      } catch (testError) {
        console.error(`❌ Entity set ${entityDetails.entitySetName} is not available:`, testError.message);
        
        if (testError.message.includes('Resource not found for the segment')) {
          throw new Error(`Entity '${entityType}' is not available in your Dynamics 365 environment. This entity requires specific apps or licenses to be enabled.`);
        }
        
        throw testError;
      }
    }

    // If not found in standard entities
    const availableEntities = Object.keys(STANDARD_ENTITIES).sort();
    throw new Error(`Entity '${entityType}' not supported. Available entities: ${availableEntities.join(', ')}`);
    
  } catch (error) {
    console.error(`❌ Working entity discovery failed for ${entityType}:`, {
      errorMessage: error.message,
      entityType,
      timestamp: new Date().toISOString()
    });
    
    throw new Error(`Entity discovery failed for ${entityType}: ${error.message}`);
  }
};

// Enhanced entity discovery with Sales Hub licensing checks
export const discoverEntityWithLicensing = async (entityType, accessToken, organizationUrl = null) => {
  try {
    console.log(`🔍 Discovering entity: ${entityType} with licensing validation...`);
    
    // Resolve entity alias
    const resolvedEntityType = ENTITY_ALIASES[entityType] || entityType;
    
    // Check if entity exists in standard mappings
    if (!STANDARD_ENTITIES[resolvedEntityType]) {
      throw new Error(`Entity type '${entityType}' is not supported. Supported entities: ${Object.keys(STANDARD_ENTITIES).join(', ')}`);
    }

    const entityInfo = STANDARD_ENTITIES[resolvedEntityType];
    
    // First, try to access the entity metadata to check availability
    try {
      const metadataResponse = await makeCrmRequest(
        'GET',
        `/api/data/v9.2/EntityDefinitions(LogicalName='${entityInfo.logicalName}')?$select=LogicalName,DisplayName,IsActivity,IsCustomEntity`,
        accessToken,
        null,
        organizationUrl
      );
      
      console.log(`✅ Entity metadata found for: ${entityInfo.logicalName}`);
      
      // Check if it's a Sales Hub specific entity
      const salesHubEntities = ['lead', 'opportunity', 'quote', 'salesorder', 'invoice'];
      if (salesHubEntities.includes(resolvedEntityType)) {
        // Try to access the entity set to verify licensing
        try {
          await makeCrmRequest(
            'GET',
            `/api/data/v9.2/${entityInfo.entitySetName}?$top=1&$select=${entityInfo.primaryIdField}`,
            accessToken,
            null,
            organizationUrl
          );
          console.log(`✅ Sales Hub entity ${resolvedEntityType} is accessible`);
        } catch (accessError) {
          if (accessError.response?.status === 403) {
            throw new Error(`SALES_HUB_REQUIRED: ${entityInfo.displayName} requires Dynamics 365 Sales Hub license. Please install Sales Hub or use alternative entities like 'contact' for basic CRM functionality.`);
          }
          throw accessError;
        }
      }
      
      return {
        ...entityInfo,
        isAvailable: true,
        licenseRequired: salesHubEntities.includes(resolvedEntityType) ? 'Sales Hub' : 'Basic CRM',
        metadata: metadataResponse.data
      };
      
    } catch (metadataError) {
      if (metadataError.response?.status === 404) {
        throw new Error(`Entity '${entityType}' not found in your Dynamics 365 environment. This may require additional licensing or the entity may not be available in your organization.`);
      }
      throw metadataError;
    }
    
  } catch (error) {
    console.error(`❌ Entity discovery failed for ${entityType}:`, error.message);
    throw error;
  }
};

// Enhanced entity validation with proper required fields
export const validateEntityRequiredFields = async (entityType, data, accessToken, organizationUrl = null) => {
  try {
    const resolvedEntityType = ENTITY_ALIASES[entityType] || entityType;
    
    // Get entity information with licensing check
    const entityInfo = await discoverEntityWithLicensing(resolvedEntityType, accessToken, organizationUrl);
    
    // Define required fields based on Dynamics 365 documentation
    const requiredFieldsByEntity = {
      contact: {
        required: [], // No required fields for contact
        recommended: ['firstname', 'lastname', 'emailaddress1'],
        validation: (data) => {
          if (!data.firstname && !data.lastname && !data.emailaddress1) {
            return 'Contact must have at least a first name, last name, or email address';
          }
          return null;
        }
      },
      lead: {
        required: [], // Subject is not actually required in D365
        recommended: ['subject', 'firstname', 'lastname', 'companyname'],
        validation: (data) => {
          if (!data.subject && !data.firstname && !data.lastname && !data.companyname) {
            return 'Lead must have at least a subject, name (firstname/lastname), or company name';
          }
          return null;
        }
      },
      account: {
        required: ['name'],
        recommended: ['name', 'telephone1', 'emailaddress1'],
        validation: (data) => {
          if (!data.name) {
            return 'Account name is required';
          }
          return null;
        }
      },
      opportunity: {
        required: ['name'],
        recommended: ['name', 'estimatedvalue', 'estimatedclosedate'],
        validation: (data) => {
          if (!data.name) {
            return 'Opportunity name is required';
          }
          return null;
        }
      },
      task: {
        required: ['subject'],
        recommended: ['subject', 'description', 'scheduledend'],
        validation: (data) => {
          if (!data.subject) {
            return 'Task subject is required';
          }
          return null;
        }
      },
      appointment: {
        required: ['subject', 'scheduledstart', 'scheduledend'],
        recommended: ['subject', 'scheduledstart', 'scheduledend', 'location'],
        validation: (data) => {
          if (!data.subject) return 'Appointment subject is required';
          if (!data.scheduledstart) return 'Appointment start time is required';
          if (!data.scheduledend) return 'Appointment end time is required';
          return null;
        }
      },
      incident: {
        required: ['title'],
        recommended: ['title', 'description', 'prioritycode'],
        validation: (data) => {
          if (!data.title) {
            return 'Case title is required';
          }
          return null;
        }
      },
      product: {
        required: ['name'],
        recommended: ['name', 'productnumber', 'description'],
        validation: (data) => {
          if (!data.name) {
            return 'Product name is required';
          }
          return null;
        }
      },
      quote: {
        required: ['name'],
        recommended: ['name', 'description'],
        validation: (data) => {
          if (!data.name) {
            return 'Quote name is required';
          }
          return null;
        }
      },
      salesorder: {
        required: ['name'],
        recommended: ['name', 'description'],
        validation: (data) => {
          if (!data.name) {
            return 'Sales order name is required';
          }
          return null;
        }
      },
      invoice: {
        required: ['name'],
        recommended: ['name', 'description'],
        validation: (data) => {
          if (!data.name) {
            return 'Invoice name is required';
          }
          return null;
        }
      },
      annotation: {
        required: ['subject'],
        recommended: ['subject', 'notetext'],
        validation: (data) => {
          if (!data.subject) {
            return 'Note subject is required';
          }
          return null;
        }
      },
      phonecall: {
        required: ['subject'],
        recommended: ['subject', 'description', 'phonenumber'],
        validation: (data) => {
          if (!data.subject) {
            return 'Phone call subject is required';
          }
          return null;
        }
      },
      email: {
        required: ['subject'],
        recommended: ['subject', 'description'],
        validation: (data) => {
          if (!data.subject) {
            return 'Email subject is required';
          }
          return null;
        }
      },
      goal: {
        required: ['title', 'metricid'],
        recommended: ['title', 'metricid', 'goalstartdate', 'goalenddate'],
        validation: (data) => {
          if (!data.title) {
            return 'Goal title is required';
          }
          if (!data.metricid && !data._metricid_value && !data['metricid@odata.bind']) {
            return 'Goal metric is required. You must specify either metricid, _metricid_value, or metricid@odata.bind field.';
          }
          // Validate date range if both dates are provided
          if (data.goalstartdate && data.goalenddate) {
            const startDate = new Date(data.goalstartdate);
            const endDate = new Date(data.goalenddate);
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate >= endDate) {
              return 'Goal end date must be after start date';
            }
          }
          return null;
        }
      }
    };

    const fieldRules = requiredFieldsByEntity[resolvedEntityType];
    if (!fieldRules) {
      return { isValid: true, entityInfo };
    }

    // Run custom validation
    const validationError = fieldRules.validation(data);
    if (validationError) {
      return {
        isValid: false,
        error: validationError,
        required: fieldRules.required,
        recommended: fieldRules.recommended,
        entityInfo
      };
    }

    return {
      isValid: true,
      entityInfo,
      required: fieldRules.required,
      recommended: fieldRules.recommended
    };

  } catch (error) {
    throw error;
  }
};

// Enhanced entity creation with proper error handling
export const createEntityWithValidation = async (entityType, data, accessToken, organizationUrl = null) => {
  try {
    console.log(`🚀 Creating entity: ${entityType} with validation...`);
    
    // Validate entity and required fields
    const validation = await validateEntityRequiredFields(entityType, data, accessToken, organizationUrl);
    
    if (!validation.isValid) {
      throw new Error(`VALIDATION_ERROR: ${validation.error}`);
    }

    const entityInfo = validation.entityInfo;
    
    // Prepare data with defaults for the specific entity type
    const enhancedData = await prepareEntityData(entityType, data, accessToken, organizationUrl);
    
    // Create the entity
    const response = await makeCrmRequest(
      'POST',
      `/api/data/v9.2/${entityInfo.entitySetName}`,
      accessToken,
      enhancedData,
      organizationUrl
    );

    console.log(`✅ ${entityInfo.displayName} created successfully`);
    
    return {
      id: response.headers['odata-entityid']?.split('(')[1]?.split(')')[0],
      entityType: entityType,
      entitySetName: entityInfo.entitySetName,
      data: enhancedData,
      location: response.headers['odata-entityid']
    };

  } catch (error) {
    console.error(`❌ Failed to create ${entityType}:`, error.message);
    throw error;
  }
};

// Helper function to find an existing contact for case linking
const findExistingContactForCase = async (accessToken, organizationUrl = null) => {
  try {
    console.log('🔍 Searching for existing contact to link case...');
    
    // Try to find any active contact
    const contacts = await makeCrmRequest(
      'GET',
      'contacts?$select=contactid,fullname,emailaddress1&$filter=statecode eq 0&$top=1',
      accessToken,
      null,
      organizationUrl
    );
    
    if (contacts.value && contacts.value.length > 0) {
      const contact = contacts.value[0];
      console.log('✅ Found existing contact for case linking:', {
        contactId: contact.contactid,
        name: contact.fullname,
        email: contact.emailaddress1
      });
      return contact.contactid;
    }
    
    console.log('⚠️ No existing contacts found');
    return null;
  } catch (error) {
    console.error('❌ Error finding existing contact:', error.message);
    return null;
  }
};

// Helper function to create a default contact for case linking
const createDefaultContactForCase = async (accessToken, organizationUrl = null) => {
  try {
    console.log('🚀 Creating default contact for case linking...');
    
    const defaultContactData = {
      firstname: "Default",
      lastname: "Customer",
      emailaddress1: "default.customer@example.com",
      description: "Auto-created contact for case management"
    };
    
    const response = await makeCrmRequest(
      'POST',
      'contacts',
      accessToken,
      defaultContactData,
      organizationUrl
    );
    
    const contactId = response.contactid;
    console.log('✅ Default contact created successfully:', contactId);
    return contactId;
  } catch (error) {
    console.error('❌ Error creating default contact:', error.message);
    return null;
  }
};

// Prepare entity data with appropriate defaults and proper formatting
const prepareEntityData = async (entityType, data, accessToken = null, organizationUrl = null) => {
  const resolvedEntityType = ENTITY_ALIASES[entityType] || entityType;
  
  const enhancedData = { ...data };
  
  // Helper function to format dates properly for Dynamics 365
  const formatDateForDynamics = (dateValue, isDateOnly = false) => {
    if (!dateValue) return null;
    
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    
    if (isDateOnly) {
      // For Edm.Date fields, use YYYY-MM-DD format
      return date.toISOString().split('T')[0];
    } else {
      // For Edm.DateTimeOffset fields, use full ISO format
      return date.toISOString();
    }
  };
  
  // Add entity-specific defaults and formatting
  switch (resolvedEntityType) {
    case 'lead':
      enhancedData.leadsourcecode = enhancedData.leadsourcecode || 1; // Web
      enhancedData.statuscode = enhancedData.statuscode || 1; // New
      enhancedData.leadqualitycode = enhancedData.leadqualitycode || 3; // Warm
      break;
      
    case 'opportunity':
      enhancedData.stepname = enhancedData.stepname || 'Qualify';
      enhancedData.statuscode = enhancedData.statuscode || 1; // In Progress
      enhancedData.statecode = enhancedData.statecode || 0; // Open
      
      // Handle estimated close date
      if (!enhancedData.estimatedclosedate) {
        // Default to 30 days from now
        const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        enhancedData.estimatedclosedate = futureDate.toISOString().split('T')[0]; // Date only
      } else if (enhancedData.estimatedclosedate) {
        const closeDate = new Date(enhancedData.estimatedclosedate);
        if (!isNaN(closeDate.getTime())) {
          enhancedData.estimatedclosedate = closeDate.toISOString().split('T')[0]; // Date only
        } else {
          // If invalid date, set default
          const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          enhancedData.estimatedclosedate = futureDate.toISOString().split('T')[0];
        }
      }
      
      // Handle actual close date if provided
      if (enhancedData.actualclosedate) {
        const actualCloseDate = new Date(enhancedData.actualclosedate);
        if (!isNaN(actualCloseDate.getTime())) {
          enhancedData.actualclosedate = actualCloseDate.toISOString().split('T')[0]; // Date only
        } else {
          delete enhancedData.actualclosedate;
        }
      }
      
      // Handle numeric fields
      if (enhancedData.estimatedvalue && typeof enhancedData.estimatedvalue === 'string') {
        enhancedData.estimatedvalue = parseFloat(enhancedData.estimatedvalue);
      }
      if (enhancedData.actualvalue && typeof enhancedData.actualvalue === 'string') {
        enhancedData.actualvalue = parseFloat(enhancedData.actualvalue);
      }
      
      // Handle probability
      if (enhancedData.closeprobability && typeof enhancedData.closeprobability === 'string') {
        enhancedData.closeprobability = parseInt(enhancedData.closeprobability);
      }
      if (!enhancedData.closeprobability) {
        enhancedData.closeprobability = 50; // Default 50% probability
      }
      break;
      
    case 'task':
      enhancedData.prioritycode = enhancedData.prioritycode || 1; // Normal
      enhancedData.statuscode = enhancedData.statuscode || 2; // Not Started
      // Format datetime fields
      if (enhancedData.scheduledstart) {
        enhancedData.scheduledstart = formatDateForDynamics(enhancedData.scheduledstart, false);
      }
      if (enhancedData.scheduledend) {
        enhancedData.scheduledend = formatDateForDynamics(enhancedData.scheduledend, false);
      }
      break;
      
    case 'appointment':
      enhancedData.prioritycode = enhancedData.prioritycode || 1; // Normal
      enhancedData.statuscode = enhancedData.statuscode || 3; // Scheduled
      // Format required datetime fields
      if (enhancedData.scheduledstart) {
        enhancedData.scheduledstart = formatDateForDynamics(enhancedData.scheduledstart, false);
      }
      if (enhancedData.scheduledend) {
        enhancedData.scheduledend = formatDateForDynamics(enhancedData.scheduledend, false);
      }
      break;
      
    case 'incident':
      console.log('🎫 Processing incident/case data preparation...');
      enhancedData.prioritycode = enhancedData.prioritycode || 2; // Normal
      enhancedData.caseorigincode = enhancedData.caseorigincode || 1; // Phone
      enhancedData.statuscode = enhancedData.statuscode || 1; // In Progress
      
      console.log('📋 Initial incident data:', {
        hasCustomerId: !!enhancedData.customerid,
        hasCustomerIdValue: !!enhancedData._customerid_value,
        hasCustomerIdBind: !!enhancedData['customerid@odata.bind'],
        providedFields: Object.keys(enhancedData)
      });
      
      // Handle customer lookup field mapping for cases/incidents
      // For incidents, customer field uses specific navigation properties:
      // - customerid_contact@odata.bind for contacts
      // - customerid_account@odata.bind for accounts
      let customerLinked = false;
      
      if (enhancedData.customerid) {
        console.log('🔄 Converting customerid to navigation property for incident:', enhancedData.customerid);
        // Use contact-specific navigation property for incidents
        if (typeof enhancedData.customerid === 'string') {
          enhancedData['customerid_contact@odata.bind'] = `/contacts(${enhancedData.customerid})`;
          customerLinked = true;
        }
        delete enhancedData.customerid; // Remove the incorrect field
      }
      
      // Handle _customerid_value field (convert to navigation property)
      if (enhancedData._customerid_value) {
        console.log('🔄 Converting _customerid_value to navigation property for incident:', enhancedData._customerid_value);
        enhancedData['customerid_contact@odata.bind'] = `/contacts(${enhancedData._customerid_value})`;
        delete enhancedData._customerid_value; // Remove entity reference field
        customerLinked = true;
      }
      
      // Handle other common field mappings for cases
      const caseFieldMappings = {
        'customer': 'contact',  // Default to contact
        'customerId': 'contact',
        'contact': 'contact',
        'contactId': 'contact',
        'account': 'account',
        'accountId': 'account'
      };
      
      Object.keys(caseFieldMappings).forEach(oldField => {
        if (enhancedData[oldField] !== undefined) {
          const targetType = caseFieldMappings[oldField];
          console.log(`🔄 Converting ${oldField} to ${targetType} navigation property:`, enhancedData[oldField]);
          
          // Convert to appropriate navigation property based on type
          if (targetType === 'contact') {
            enhancedData['customerid_contact@odata.bind'] = `/contacts(${enhancedData[oldField]})`;
          } else if (targetType === 'account') {
            enhancedData['customerid_account@odata.bind'] = `/accounts(${enhancedData[oldField]})`;
          }
          
          delete enhancedData[oldField];
          customerLinked = true;
        }
      });
      
      // Handle explicit contact/account navigation properties
      if (enhancedData['customerid_contact@odata.bind']) {
        customerLinked = true;
      }
      if (enhancedData['customerid_account@odata.bind']) {
        customerLinked = true;
      }
      
      // If no customer is linked, try to find or create a contact automatically
      if (!customerLinked) {
        console.log('⚠️ No customer linked to case. Dynamics 365 requires a contact or account.');
        console.log('🔍 Attempting to auto-link to existing contact...');
        
        if (accessToken) {
          // Option 1: Try to find any existing contact to link to
          try {
            const existingContactId = await findExistingContactForCase(accessToken, organizationUrl);
            if (existingContactId) {
              enhancedData['customerid_contact@odata.bind'] = `/contacts(${existingContactId})`;
              customerLinked = true;
              console.log('✅ Auto-linked case to existing contact:', existingContactId);
            }
          } catch (contactError) {
            console.log('❌ Could not find existing contact:', contactError.message);
          }
          
          // Option 2: If no existing contact, create a default one
          if (!customerLinked) {
            try {
              console.log('🚀 Creating default contact for case...');
              const newContactId = await createDefaultContactForCase(accessToken, organizationUrl);
              if (newContactId) {
                enhancedData['customerid_contact@odata.bind'] = `/contacts(${newContactId})`;
                customerLinked = true;
                console.log('✅ Auto-linked case to new default contact:', newContactId);
              }
            } catch (createError) {
              console.log('❌ Could not create default contact:', createError.message);
            }
          }
        }
        
        if (!customerLinked) {
          console.log('❌ Unable to auto-link customer. Case creation may fail.');
          console.log('💡 Recommendation: Provide customerid, contactId, or accountId in request');
        }
      } else {
        const customerField = enhancedData['customerid_contact@odata.bind'] || enhancedData['customerid_account@odata.bind'];
        console.log('✅ Customer linked successfully:', customerField);
      }
      
      // Handle date fields for cases
      if (enhancedData.followupby) {
        console.log('📅 Formatting followupby date:', enhancedData.followupby);
        enhancedData.followupby = formatDateForDynamics(enhancedData.followupby, false);
      }
      if (enhancedData.responseby) {
        console.log('📅 Formatting responseby date:', enhancedData.responseby);
        enhancedData.responseby = formatDateForDynamics(enhancedData.responseby, false);
      }
      if (enhancedData.resolveby) {
        console.log('📅 Formatting resolveby date:', enhancedData.resolveby);
        enhancedData.resolveby = formatDateForDynamics(enhancedData.resolveby, false);
      }
      
      // Remove problematic system fields for cases
      const caseProblematicFields = [
        'createdon', 'modifiedon', 'createdby', 'modifiedby', 'ownerid',
        'incidentid', 'ticketnumber', 'versionnumber', 'timezoneruleversionnumber', 
        'utcconversiontimezonecode', 'organizationid'
      ];
      
      console.log('🧹 Removing problematic system fields...');
      caseProblematicFields.forEach(field => {
        if (enhancedData[field] !== undefined) {
          console.log(`🗑️ Removing field: ${field}`);
          delete enhancedData[field];
        }
      });
      
      console.log('✅ Incident data preparation complete:', {
        finalFieldCount: Object.keys(enhancedData).length,
        hasCustomerLink: !!(enhancedData['customerid_contact@odata.bind'] || enhancedData['customerid_account@odata.bind']),
        customerLinkField: enhancedData['customerid_contact@odata.bind'] ? 'customerid_contact@odata.bind' : (enhancedData['customerid_account@odata.bind'] ? 'customerid_account@odata.bind' : 'none'),
        finalFields: Object.keys(enhancedData)
      });
      break;
      
    case 'product':
      console.log('🛠️ Preparing product data:', {
        originalFields: Object.keys(enhancedData),
        hasName: !!enhancedData.name,
        hasProductNumber: !!enhancedData.productnumber
      });
      
      // Auto-generate product number if not provided and we have a name
      if (!enhancedData.productnumber && enhancedData.name) {
        enhancedData.productnumber = `PRD-${Date.now()}`;
        console.log('🔧 Auto-generated product number:', enhancedData.productnumber);
      }
      
      // CRITICAL: Get default unit schedule and unit of measure (REQUIRED for product creation)
      if (!enhancedData._defaultuomscheduleid_value && !enhancedData._defaultuomid_value && accessToken) {
        console.log('🔍 Product missing required unit schedule - attempting to find defaults...');
        try {
          const defaultUnits = await getDefaultUnitSchedule(accessToken, organizationUrl);
          if (defaultUnits) {
            enhancedData._defaultuomscheduleid_value = defaultUnits.scheduleId;
            enhancedData._defaultuomid_value = defaultUnits.uomId;
            console.log('✅ Set default unit schedule and UOM:', {
              scheduleId: defaultUnits.scheduleId,
              scheduleName: defaultUnits.scheduleName,
              uomId: defaultUnits.uomId,
              uomName: defaultUnits.uomName
            });
          } else {
            console.log('❌ Could not find default unit schedule - product creation may fail');
          }
        } catch (unitError) {
          console.log('❌ Error setting default units:', unitError.message);
        }
      }
      
      // Set essential defaults for product creation
      // Based on existing products in the user's environment, these fields are important:
      
      // Product structure: 1 = Product (not a bundle or kit)
      if (enhancedData.productstructure === undefined) {
        enhancedData.productstructure = 1;
      }
      
      // Product type code: 1 = Sales Inventory, 3 = Miscellaneous Charges
      if (enhancedData.producttypecode === undefined) {
        enhancedData.producttypecode = 1;
      }
      
      // Quantity decimal places (most products have 2)
      if (enhancedData.quantitydecimal === undefined) {
        enhancedData.quantitydecimal = 2;
      }
      
      // Stock item flag
      if (enhancedData.isstockitem === undefined) {
        enhancedData.isstockitem = false;
      }
      
      // Kit flag
      if (enhancedData.iskit === undefined) {
        enhancedData.iskit = false;
      }
      
      // GDPR opt out flag
      if (enhancedData.msdyn_gdproptout === undefined) {
        enhancedData.msdyn_gdproptout = false;
      }
      
      // Is reparented flag
      if (enhancedData.isreparented === undefined) {
        enhancedData.isreparented = false;
      }
      
      // Handle date fields for products - these need to be in YYYY-MM-DD format only (Edm.Date)
      const productDateFields = ['validfromdate', 'validtodate'];
      productDateFields.forEach(field => {
        if (enhancedData[field]) {
          const dateValue = new Date(enhancedData[field]);
          if (!isNaN(dateValue.getTime())) {
            // For Edm.Date fields, use YYYY-MM-DD format only
            enhancedData[field] = dateValue.toISOString().split('T')[0];
            console.log(`📅 Formatted ${field}:`, enhancedData[field]);
          } else {
            delete enhancedData[field];
            console.log(`❌ Invalid date for ${field}, removed`);
          }
        }
      });
      
      // Handle numeric fields properly
      const numericFields = ['standardcost', 'currentcost', 'listprice', 'price', 'standardcost_base', 'currentcost_base', 'price_base'];
      numericFields.forEach(field => {
        if (enhancedData[field] !== undefined && enhancedData[field] !== null) {
          if (typeof enhancedData[field] === 'string') {
            const numValue = parseFloat(enhancedData[field]);
            if (!isNaN(numValue)) {
              enhancedData[field] = numValue;
              console.log(`🔢 Converted ${field} to number:`, numValue);
            } else {
              delete enhancedData[field];
              console.log(`❌ Invalid number for ${field}, removed`);
            }
          }
        }
      });
      
      // Remove system-managed fields that cause creation issues
      const systemManagedFields = [
        'createdon', 'modifiedon', 'createdby', 'modifiedby', 'versionnumber',
        'timezoneruleversionnumber', 'utcconversiontimezonecode', 'organizationid',
        'productid', 'entityimage_timestamp', 'entityimageid', 'entityimage_url',
        'dmtimportstate', 'importsequencenumber', 'overriddencreatedon',
        'traversedpath', 'stageid', 'processid', '_createdby_value', '_modifiedby_value',
        '_organizationid_value', '_createdbyexternalparty_value', '_modifiedbyexternalparty_value',
        '_createdonbehalfby_value', '_modifiedonbehalfby_value', 'exchangerate',
        'hierarchypath', '_parentproductid_value', '_pricelevelid_value', 
        '_transactioncurrencyid_value', '_defaultuomid_value', '_defaultuomscheduleid_value',
        '_subjectid_value', 'entityimage'
      ];
      
      const removedFields = [];
      systemManagedFields.forEach(field => {
        if (enhancedData[field] !== undefined) {
          delete enhancedData[field];
          removedFields.push(field);
        }
      });
      
      if (removedFields.length > 0) {
        console.log('🧹 Removed system-managed fields:', removedFields);
      }
      
      // Handle state and status codes carefully
      // Only set these if explicitly provided and valid
      if (enhancedData.statecode !== undefined) {
        // 0 = Active, 1 = Retired, 2 = Draft, 3 = Under Revision
        if (![0, 1, 2, 3].includes(enhancedData.statecode)) {
          console.log('❌ Invalid statecode, removing:', enhancedData.statecode);
          delete enhancedData.statecode;
        }
      }
      
      if (enhancedData.statuscode !== undefined) {
        // Status codes depend on state code, removing to let D365 set defaults
        console.log('🔄 Removing statuscode to let D365 set default');
        delete enhancedData.statuscode;
      }
      
      console.log('✅ Product data preparation complete:', {
        finalFields: Object.keys(enhancedData),
        fieldCount: Object.keys(enhancedData).length,
        hasName: !!enhancedData.name,
        hasProductNumber: !!enhancedData.productnumber,
        productStructure: enhancedData.productstructure,
        productTypeCode: enhancedData.producttypecode
      });
      
      break;
      
    case 'quote':
      enhancedData.statuscode = enhancedData.statuscode || 1; // Draft
      enhancedData.statecode = enhancedData.statecode || 0; // Draft
      
      if (!enhancedData.quotenumber) {
        enhancedData.quotenumber = `QUO-${Date.now()}`;
      }
      
      // Handle customer lookup field mapping
      if (enhancedData.customerid) {
        // Map customerid to the correct lookup field format
        if (typeof enhancedData.customerid === 'string') {
          enhancedData['_customerid_value'] = enhancedData.customerid;
        }
        delete enhancedData.customerid; // Remove the incorrect field
      }
      
      // Handle other common field mappings for quotes
      const quoteFieldMappings = {
        'customer': '_customerid_value',
        'customerId': '_customerid_value',
        'account': '_customerid_value',
        'accountId': '_customerid_value'
      };
      
      Object.keys(quoteFieldMappings).forEach(oldField => {
        if (enhancedData[oldField] !== undefined) {
          enhancedData[quoteFieldMappings[oldField]] = enhancedData[oldField];
          delete enhancedData[oldField];
        }
      });
      
      // Handle date fields for quotes - use proper formats
      if (enhancedData.effectivefrom) {
        const effectiveFromDate = new Date(enhancedData.effectivefrom);
        if (!isNaN(effectiveFromDate.getTime())) {
          enhancedData.effectivefrom = effectiveFromDate.toISOString().split('T')[0]; // Date only
        } else {
          delete enhancedData.effectivefrom;
        }
      }
      if (enhancedData.effectiveto) {
        const effectiveToDate = new Date(enhancedData.effectiveto);
        if (!isNaN(effectiveToDate.getTime())) {
          enhancedData.effectiveto = effectiveToDate.toISOString().split('T')[0]; // Date only
        } else {
          delete enhancedData.effectiveto;
        }
      }
      if (enhancedData.requestdeliveryby) {
        const deliveryDate = new Date(enhancedData.requestdeliveryby);
        if (!isNaN(deliveryDate.getTime())) {
          enhancedData.requestdeliveryby = deliveryDate.toISOString().split('T')[0]; // Date only
        } else {
          delete enhancedData.requestdeliveryby;
        }
      }
      
      // Remove problematic system fields
      const quoteProblematicFields = ['createdon', 'modifiedon', 'createdby', 'modifiedby', 'ownerid'];
      quoteProblematicFields.forEach(field => {
        if (enhancedData[field] !== undefined) {
          delete enhancedData[field];
        }
      });
      
      // Handle numeric fields
      if (enhancedData.totalamount && typeof enhancedData.totalamount === 'string') {
        enhancedData.totalamount = parseFloat(enhancedData.totalamount);
      }
      if (enhancedData.totallineitemamount && typeof enhancedData.totallineitemamount === 'string') {
        enhancedData.totallineitemamount = parseFloat(enhancedData.totallineitemamount);
      }
      if (enhancedData.discountamount && typeof enhancedData.discountamount === 'string') {
        enhancedData.discountamount = parseFloat(enhancedData.discountamount);
      }
      break;
      
    case 'salesorder':
      enhancedData.statuscode = enhancedData.statuscode || 1; // New
      if (!enhancedData.ordernumber) {
        enhancedData.ordernumber = `ORD-${Date.now()}`;
      }
      
      // Handle customer lookup field mapping
      if (enhancedData.customerid) {
        if (typeof enhancedData.customerid === 'string') {
          enhancedData['_customerid_value'] = enhancedData.customerid;
        }
        delete enhancedData.customerid;
      }
      
      // Handle other common field mappings
      const salesOrderFieldMappings = {
        'customer': '_customerid_value',
        'customerId': '_customerid_value',
        'account': '_customerid_value',
        'accountId': '_customerid_value'
      };
      
      Object.keys(salesOrderFieldMappings).forEach(oldField => {
        if (enhancedData[oldField] !== undefined) {
          enhancedData[salesOrderFieldMappings[oldField]] = enhancedData[oldField];
          delete enhancedData[oldField];
        }
      });
      
      // Remove problematic system fields
      const salesOrderProblematicFields = ['createdon', 'modifiedon', 'createdby', 'modifiedby', 'ownerid'];
      salesOrderProblematicFields.forEach(field => {
        if (enhancedData[field] !== undefined) {
          delete enhancedData[field];
        }
      });
      
      // Format date fields
      if (enhancedData.requestdeliveryby) {
        enhancedData.requestdeliveryby = formatDateForDynamics(enhancedData.requestdeliveryby, true);
      }
      if (enhancedData.datedelivered) {
        enhancedData.datedelivered = formatDateForDynamics(enhancedData.datedelivered, true);
      }
      break;
      
    case 'invoice':
      enhancedData.statuscode = enhancedData.statuscode || 1; // New
      if (!enhancedData.invoicenumber) {
        enhancedData.invoicenumber = `INV-${Date.now()}`;
      }
      
      // Handle customer lookup field mapping
      if (enhancedData.customerid) {
        if (typeof enhancedData.customerid === 'string') {
          enhancedData['_customerid_value'] = enhancedData.customerid;
        }
        delete enhancedData.customerid;
      }
      
      // Handle other common field mappings
      const invoiceFieldMappings = {
        'customer': '_customerid_value',
        'customerId': '_customerid_value',
        'account': '_customerid_value',
        'accountId': '_customerid_value'
      };
      
      Object.keys(invoiceFieldMappings).forEach(oldField => {
        if (enhancedData[oldField] !== undefined) {
          enhancedData[invoiceFieldMappings[oldField]] = enhancedData[oldField];
          delete enhancedData[oldField];
        }
      });
      
      // Remove problematic system fields
      const invoiceProblematicFields = ['createdon', 'modifiedon', 'createdby', 'modifiedby', 'ownerid'];
      invoiceProblematicFields.forEach(field => {
        if (enhancedData[field] !== undefined) {
          delete enhancedData[field];
        }
      });
      
      // Format date fields
      if (enhancedData.duedate) {
        enhancedData.duedate = formatDateForDynamics(enhancedData.duedate, true);
      }
      if (enhancedData.datedelivered) {
        enhancedData.datedelivered = formatDateForDynamics(enhancedData.datedelivered, true);
      }
      break;
      
    case 'campaign':
      // Map common incorrect field names to correct ones for campaigns
      if (enhancedData.startdate) {
        enhancedData.actualstart = enhancedData.startdate;
        delete enhancedData.startdate;
      }
      if (enhancedData.enddate) {
        enhancedData.actualend = enhancedData.enddate;
        delete enhancedData.enddate;
      }
      if (enhancedData.proposedstartdate) {
        enhancedData.proposedstart = enhancedData.proposedstartdate;
        delete enhancedData.proposedstartdate;
      }
      if (enhancedData.proposedenddate) {
        enhancedData.proposedend = enhancedData.proposedenddate;
        delete enhancedData.proposedenddate;
      }
      
      // Handle common field name variations
      const campaignFieldMappings = {
        'start_date': 'actualstart',
        'end_date': 'actualend',
        'start': 'actualstart',
        'end': 'actualend',
        'budget': 'budgetedcost',
        'cost': 'budgetedcost',
        'type': 'typecode'
      };
      
      Object.keys(campaignFieldMappings).forEach(oldField => {
        if (enhancedData[oldField] !== undefined) {
          enhancedData[campaignFieldMappings[oldField]] = enhancedData[oldField];
          delete enhancedData[oldField];
        }
      });
      
      // Format date fields for campaigns - use full datetime format
      if (enhancedData.actualstart) {
        const startDate = new Date(enhancedData.actualstart);
        if (!isNaN(startDate.getTime())) {
          enhancedData.actualstart = startDate.toISOString();
        } else {
          delete enhancedData.actualstart;
        }
      }
      if (enhancedData.actualend) {
        const endDate = new Date(enhancedData.actualend);
        if (!isNaN(endDate.getTime())) {
          enhancedData.actualend = endDate.toISOString();
        } else {
          delete enhancedData.actualend;
        }
      }
      if (enhancedData.proposedstart) {
        const proposedStartDate = new Date(enhancedData.proposedstart);
        if (!isNaN(proposedStartDate.getTime())) {
          enhancedData.proposedstart = proposedStartDate.toISOString();
        } else {
          delete enhancedData.proposedstart;
        }
      }
      if (enhancedData.proposedend) {
        const proposedEndDate = new Date(enhancedData.proposedend);
        if (!isNaN(proposedEndDate.getTime())) {
          enhancedData.proposedend = proposedEndDate.toISOString();
        } else {
          delete enhancedData.proposedend;
        }
      }
      
      // Ensure numeric fields are properly formatted
      if (enhancedData.budgetedcost && typeof enhancedData.budgetedcost === 'string') {
        enhancedData.budgetedcost = parseFloat(enhancedData.budgetedcost);
      }
      if (enhancedData.actualcost && typeof enhancedData.actualcost === 'string') {
        enhancedData.actualcost = parseFloat(enhancedData.actualcost);
      }
      
      // Set default status if not provided
      enhancedData.statuscode = enhancedData.statuscode || 0; // Proposed
      enhancedData.statecode = enhancedData.statecode || 0; // Active
      break;
      
    case 'goal':
      // Set default values for goals
      enhancedData.statecode = enhancedData.statecode || 0; // Active
      enhancedData.statuscode = enhancedData.statuscode || 0; // Open
      
      // Handle goal dates - use proper datetime format
      if (enhancedData.goalstartdate) {
        const startDate = new Date(enhancedData.goalstartdate);
        if (!isNaN(startDate.getTime())) {
          enhancedData.goalstartdate = startDate.toISOString();
        } else {
          delete enhancedData.goalstartdate;
        }
      }
      if (enhancedData.goalenddate) {
        const endDate = new Date(enhancedData.goalenddate);
        if (!isNaN(endDate.getTime())) {
          enhancedData.goalenddate = endDate.toISOString();
        } else {
          delete enhancedData.goalenddate;
        }
      }
      
      // Handle fiscal period and year defaults
      if (enhancedData.isfiscalperiodgoal === undefined) {
        enhancedData.isfiscalperiodgoal = false; // Custom period by default
      }
      
      // Handle metric type defaults
      if (enhancedData.isamount === undefined) {
        enhancedData.isamount = true; // Amount type by default
      }
      
      // Handle amount data type (0=Money, 1=Decimal, 2=Integer)
      if (enhancedData.amountdatatype === undefined) {
        enhancedData.amountdatatype = 0; // Money by default
      }
      
      // Handle target values based on amount data type
      if (enhancedData.amountdatatype === 0 && enhancedData.targetmoney !== undefined) {
        // Money type - ensure numeric
        if (typeof enhancedData.targetmoney === 'string') {
          enhancedData.targetmoney = parseFloat(enhancedData.targetmoney);
        }
      } else if (enhancedData.amountdatatype === 1 && enhancedData.targetdecimal !== undefined) {
        // Decimal type - ensure numeric
        if (typeof enhancedData.targetdecimal === 'string') {
          enhancedData.targetdecimal = parseFloat(enhancedData.targetdecimal);
        }
      } else if (enhancedData.amountdatatype === 2 && enhancedData.targetinteger !== undefined) {
        // Integer type - ensure numeric
        if (typeof enhancedData.targetinteger === 'string') {
          enhancedData.targetinteger = parseInt(enhancedData.targetinteger);
        }
      }
      
      // Handle stretch target values
      if (enhancedData.stretchtargetmoney && typeof enhancedData.stretchtargetmoney === 'string') {
        enhancedData.stretchtargetmoney = parseFloat(enhancedData.stretchtargetmoney);
      }
      if (enhancedData.stretchtargetdecimal && typeof enhancedData.stretchtargetdecimal === 'string') {
        enhancedData.stretchtargetdecimal = parseFloat(enhancedData.stretchtargetdecimal);
      }
      if (enhancedData.stretchtargetinteger && typeof enhancedData.stretchtargetinteger === 'string') {
        enhancedData.stretchtargetinteger = parseInt(enhancedData.stretchtargetinteger);
      }
      
      // Handle navigation properties for goal creation
      // Convert lookup value fields to navigation properties
      if (enhancedData._metricid_value || enhancedData.metricid) {
        const metricId = enhancedData._metricid_value || enhancedData.metricid;
        enhancedData['metricid@odata.bind'] = `/metrics(${metricId})`;
        delete enhancedData._metricid_value;
        delete enhancedData.metricid;
      }
      
      if (enhancedData._parentgoalid_value || enhancedData.parentgoalid) {
        const parentGoalId = enhancedData._parentgoalid_value || enhancedData.parentgoalid;
        enhancedData['parentgoalid@odata.bind'] = `/goals(${parentGoalId})`;
        delete enhancedData._parentgoalid_value;
        delete enhancedData.parentgoalid;
      }
      
      if (enhancedData._goalownerid_value || enhancedData.goalownerid) {
        const goalOwnerId = enhancedData._goalownerid_value || enhancedData.goalownerid;
        enhancedData['goalownerid@odata.bind'] = `/systemusers(${goalOwnerId})`;
        delete enhancedData._goalownerid_value;
        delete enhancedData.goalownerid;
      }
      
      // Handle common field mappings for goals
      const goalFieldMappings = {
        'owner': 'ownerid',
        'ownerId': 'ownerid',
        'goalowner': 'goalownerid',
        'goalownerId': 'goalownerid',
        'metric': 'metricid',
        'metricId': 'metricid',
        'parentgoal': 'parentgoalid',
        'parentGoalId': 'parentgoalid'
      };
      
      Object.keys(goalFieldMappings).forEach(oldField => {
        if (enhancedData[oldField] !== undefined) {
          const newField = goalFieldMappings[oldField];
          if (newField === 'metricid') {
            enhancedData['metricid@odata.bind'] = `/metrics(${enhancedData[oldField]})`;
          } else if (newField === 'parentgoalid') {
            enhancedData['parentgoalid@odata.bind'] = `/goals(${enhancedData[oldField]})`;
          } else if (newField === 'goalownerid') {
            enhancedData['goalownerid@odata.bind'] = `/systemusers(${enhancedData[oldField]})`;
          } else {
            enhancedData[newField] = enhancedData[oldField];
          }
          delete enhancedData[oldField];
        }
      });
      
      // Remove problematic system fields
      const goalProblematicFields = ['createdon', 'modifiedon', 'createdby', 'modifiedby', 'versionnumber', 'timezoneruleversionnumber', 'utcconversiontimezonecode'];
      goalProblematicFields.forEach(field => {
        if (enhancedData[field] !== undefined) {
          delete enhancedData[field];
        }
      });
      break;
      
    case 'annotation':
    case 'note':
      console.log('📝 Processing annotation/note data preparation...');
      
      // Handle regarding object (the entity this note is related to)
      console.log('📋 Initial note data:', {
        hasRegardingObjectId: !!enhancedData.regardingobjectid,
        hasRegardingObjectIdValue: !!enhancedData._regardingobjectid_value,
        hasRegardingObjectIdBind: !!enhancedData['regardingobjectid@odata.bind'],
        hasAccountId: !!enhancedData.accountid,
        hasContactId: !!enhancedData.contactid,
        hasOpportunityId: !!enhancedData.opportunityid,
        hasObjectId: !!enhancedData.objectid,
        providedFields: Object.keys(enhancedData)
      });
      
      // Helper function to create navigation property for polymorphic lookup
      const createRegardingObjectReference = (entityType, entityId) => {
        const entitySetMappings = {
          'account': 'accounts',
          'contact': 'contacts', 
          'opportunity': 'opportunities',
          'lead': 'leads',
          'incident': 'incidents',
          'task': 'tasks',
          'appointment': 'appointments',
          'phonecall': 'phonecalls',
          'email': 'emails',
          'quote': 'quotes',
          'salesorder': 'salesorders',
          'invoice': 'invoices'
        };
        
        const entitySetName = entitySetMappings[entityType.toLowerCase()];
        if (entitySetName) {
          return `/${entitySetName}(${entityId})`;
        }
        
        // Fallback: try to construct from entity type
        return `/${entityType.toLowerCase()}s(${entityId})`;
      };
      
      let regardingObjectSet = false;
      
      // Handle various ways to specify the related object
      // Priority order: explicit regardingobjectid -> specific entity IDs -> objectid
      
      // 1. Handle explicit regardingobjectid with entity type
      if (enhancedData.regardingobjectid && enhancedData.regardingobjecttype) {
        console.log('🔗 Converting explicit regardingobjectid with entity type');
        const reference = createRegardingObjectReference(enhancedData.regardingobjecttype, enhancedData.regardingobjectid);
        enhancedData['regardingobjectid@odata.bind'] = reference;
        delete enhancedData.regardingobjectid;
        delete enhancedData.regardingobjecttype;
        regardingObjectSet = true;
        console.log('✅ Set regarding object reference:', reference);
      }
      
      // 2. Handle _regardingobjectid_value
      else if (enhancedData._regardingobjectid_value && enhancedData.regardingobjecttype) {
        console.log('🔗 Converting _regardingobjectid_value with entity type');
        const reference = createRegardingObjectReference(enhancedData.regardingobjecttype, enhancedData._regardingobjectid_value);
        enhancedData['regardingobjectid@odata.bind'] = reference;
        delete enhancedData._regardingobjectid_value;
        delete enhancedData.regardingobjecttype;
        regardingObjectSet = true;
        console.log('✅ Set regarding object reference:', reference);
      }
      
      // 3. Handle specific entity IDs (accountid, contactid, opportunityid, etc.)
      else if (enhancedData.accountid) {
        console.log('🔗 Converting accountid to regarding object');
        enhancedData['regardingobjectid@odata.bind'] = createRegardingObjectReference('account', enhancedData.accountid);
        delete enhancedData.accountid;
        regardingObjectSet = true;
        console.log('✅ Linked note to account:', enhancedData['regardingobjectid@odata.bind']);
      }
      else if (enhancedData.contactid) {
        console.log('🔗 Converting contactid to regarding object');
        enhancedData['regardingobjectid@odata.bind'] = createRegardingObjectReference('contact', enhancedData.contactid);
        delete enhancedData.contactid;
        regardingObjectSet = true;
        console.log('✅ Linked note to contact:', enhancedData['regardingobjectid@odata.bind']);
      }
      else if (enhancedData.opportunityid) {
        console.log('🔗 Converting opportunityid to regarding object');
        enhancedData['regardingobjectid@odata.bind'] = createRegardingObjectReference('opportunity', enhancedData.opportunityid);
        delete enhancedData.opportunityid;
        regardingObjectSet = true;
        console.log('✅ Linked note to opportunity:', enhancedData['regardingobjectid@odata.bind']);
      }
      else if (enhancedData.leadid) {
        console.log('🔗 Converting leadid to regarding object');
        enhancedData['regardingobjectid@odata.bind'] = createRegardingObjectReference('lead', enhancedData.leadid);
        delete enhancedData.leadid;
        regardingObjectSet = true;
        console.log('✅ Linked note to lead:', enhancedData['regardingobjectid@odata.bind']);
      }
      else if (enhancedData.incidentid) {
        console.log('🔗 Converting incidentid to regarding object');
        enhancedData['regardingobjectid@odata.bind'] = createRegardingObjectReference('incident', enhancedData.incidentid);
        delete enhancedData.incidentid;
        regardingObjectSet = true;
        console.log('✅ Linked note to case:', enhancedData['regardingobjectid@odata.bind']);
      }
      
      // 4. Handle generic objectid with objecttype
      else if (enhancedData.objectid && enhancedData.objecttype) {
        console.log('🔗 Converting generic objectid with object type');
        const reference = createRegardingObjectReference(enhancedData.objecttype, enhancedData.objectid);
        enhancedData['regardingobjectid@odata.bind'] = reference;
        delete enhancedData.objectid;
        delete enhancedData.objecttype;
        regardingObjectSet = true;
        console.log('✅ Set regarding object reference:', reference);
      }
      
      // 5. Handle common field name variations
      const noteFieldMappings = {
        'account': 'account',
        'accountId': 'account',
        'account_id': 'account',
        'contact': 'contact',
        'contactId': 'contact',
        'contact_id': 'contact',
        'opportunity': 'opportunity',
        'opportunityId': 'opportunity',
        'opportunity_id': 'opportunity',
        'deal': 'opportunity',
        'dealId': 'opportunity',
        'deal_id': 'opportunity',
        'lead': 'lead',
        'leadId': 'lead',
        'lead_id': 'lead',
        'case': 'incident',
        'caseId': 'incident',
        'case_id': 'incident',
        'incident': 'incident',
        'incidentId': 'incident',
        'incident_id': 'incident'
      };
      
      if (!regardingObjectSet) {
        Object.keys(noteFieldMappings).forEach(fieldName => {
          if (enhancedData[fieldName] !== undefined) {
            const entityType = noteFieldMappings[fieldName];
            console.log(`🔗 Converting ${fieldName} to ${entityType} regarding object`);
            const reference = createRegardingObjectReference(entityType, enhancedData[fieldName]);
            enhancedData['regardingobjectid@odata.bind'] = reference;
            delete enhancedData[fieldName];
            regardingObjectSet = true;
            console.log('✅ Set regarding object reference:', reference);
            return; // Stop after first match
          }
        });
      }
      
      // Handle explicit navigation property (already in correct format)
      if (enhancedData['regardingobjectid@odata.bind']) {
        regardingObjectSet = true;
      }
      
      // Log final state
      if (regardingObjectSet) {
        console.log('✅ Note has regarding object set:', enhancedData['regardingobjectid@odata.bind']);
      } else {
        console.log('ℹ️ Note will be created without regarding object (standalone note)');
      }
      
      // Remove problematic system fields for notes
      const noteProblematicFields = [
        'createdon', 'modifiedon', 'createdby', 'modifiedby', 'ownerid',
        'annotationid', 'versionnumber', 'timezoneruleversionnumber', 
        'utcconversiontimezonecode', 'organizationid', 'objecttypecode',
        'mimetype', 'filesize', 'filename', 'isdocument'
      ];
      
      console.log('🧹 Removing problematic system fields...');
      noteProblematicFields.forEach(field => {
        if (enhancedData[field] !== undefined) {
          console.log(`🗑️ Removing field: ${field}`);
          delete enhancedData[field];
        }
      });
      
      console.log('✅ Note data preparation complete:', {
        finalFieldCount: Object.keys(enhancedData).length,
        hasRegardingObject: !!enhancedData['regardingobjectid@odata.bind'],
        regardingObjectRef: enhancedData['regardingobjectid@odata.bind'],
        finalFields: Object.keys(enhancedData)
      });
      break;
  }
  
  // Global cleanup - remove any date fields that might still have wrong format
  const dateFieldsToClean = Object.keys(enhancedData).filter(key => 
    key.includes('date') && typeof enhancedData[key] === 'string' && 
    enhancedData[key].includes('T') && enhancedData[key].includes('Z')
  );
  
  dateFieldsToClean.forEach(field => {
    // If it's a field that should be date-only, convert it
    if (field.includes('date') && !field.includes('time') && !field.includes('start') && !field.includes('end')) {
      console.log(`🔧 Converting date field ${field} from datetime to date format`);
      enhancedData[field] = formatDateForDynamics(enhancedData[field], true);
    }
  });
  
  // Global cleanup - remove common problematic system fields
  const globalProblematicFields = ['id', 'Id', 'ID', 'createdon', 'modifiedon', 'createdby', 'modifiedby', 'versionnumber', 'timezoneruleversionnumber', 'utcconversiontimezonecode'];
  globalProblematicFields.forEach(field => {
    if (enhancedData[field] !== undefined) {
      console.log(`🧹 Removing problematic system field: ${field}`);
      delete enhancedData[field];
    }
  });
  
  // Global cleanup - handle common lookup field mappings
  const lookupFieldMappings = {
    'ownerid': '_ownerid_value',
    'regardingobjectid': '_regardingobjectid_value',
    'parentaccountid': '_parentaccountid_value',
    'parentcontactid': '_parentcontactid_value'
  };
  
  Object.keys(lookupFieldMappings).forEach(oldField => {
    if (enhancedData[oldField] && typeof enhancedData[oldField] === 'string') {
      enhancedData[lookupFieldMappings[oldField]] = enhancedData[oldField];
      delete enhancedData[oldField];
      console.log(`🔄 Mapped lookup field ${oldField} to ${lookupFieldMappings[oldField]}`);
    }
  });
  
  return enhancedData;
};

// Helper function to get default unit schedule and unit of measure
// Helper function to determine required license for an entity
const getRequiredLicenseForEntity = (entityType) => {
  const licenseMap = {
    'lead': 'Dynamics 365 Sales',
    'opportunity': 'Dynamics 365 Sales',
    'quote': 'Dynamics 365 Sales',
    'product': 'Dynamics 365 Sales',
    'salesorder': 'Dynamics 365 Sales',
    'invoice': 'Dynamics 365 Sales',
    'incident': 'Dynamics 365 Customer Service',
    'campaign': 'Dynamics 365 Marketing',
    'goal': 'Dynamics 365 Sales Enterprise',
    'metric': 'Dynamics 365 Sales Enterprise'
  };
  
  return licenseMap[entityType] || 'Dynamics 365 Basic';
};

// Helper function to get entity set name
const getEntitySetName = (entityType) => {
  const entitySetMap = {
    'contact': 'contacts',
    'account': 'accounts',
    'lead': 'leads',
    'opportunity': 'opportunities',
    'task': 'tasks',
    'appointment': 'appointments',
    'incident': 'incidents',
    'product': 'products',
    'quote': 'quotes',
    'salesorder': 'salesorders',
    'invoice': 'invoices',
    'campaign': 'campaigns',
    'goal': 'goals',
    'metric': 'metrics',
    'annotation': 'annotations',
    'phonecall': 'phonecalls',
    'email': 'emails'
  };
  
  return entitySetMap[entityType] || `${entityType}s`;
};

const getDefaultUnitSchedule = async (accessToken, organizationUrl = null) => {
  try {
    console.log('🔍 Finding default unit schedule for product creation...');
    
    // Try to get the default unit schedule (usually the first one)
    const uomSchedules = await makeCrmRequest(
      'GET',
      'uomschedules?$select=uomscheduleid,name&$filter=statecode eq 0&$top=1',
      accessToken,
      null,
      organizationUrl
    );
    
    if (uomSchedules.value && uomSchedules.value.length > 0) {
      const defaultSchedule = uomSchedules.value[0];
      console.log('✅ Found default unit schedule:', {
        id: defaultSchedule.uomscheduleid,
        name: defaultSchedule.name
      });
      
      // Now get the default unit of measure for this schedule
      const uoms = await makeCrmRequest(
        'GET',
        `uoms?$select=uomid,name&$filter=_uomscheduleid_value eq ${defaultSchedule.uomscheduleid} and statecode eq 0&$top=1`,
        accessToken,
        null,
        organizationUrl
      );
      
      if (uoms.value && uoms.value.length > 0) {
        const defaultUom = uoms.value[0];
        console.log('✅ Found default unit of measure:', {
          id: defaultUom.uomid,
          name: defaultUom.name
        });
        
        return {
          scheduleId: defaultSchedule.uomscheduleid,
          scheduleName: defaultSchedule.name,
          uomId: defaultUom.uomid,
          uomName: defaultUom.name
        };
      }
    }
    
    console.log('❌ No default unit schedule or UOM found');
    return null;
  } catch (error) {
    console.error('❌ Error getting default unit schedule:', error.message);
    return null;
  }
};

export { oauthConfig, STANDARD_ENTITIES, ENTITY_ALIASES, getDefaultUnitSchedule, prepareEntityData };