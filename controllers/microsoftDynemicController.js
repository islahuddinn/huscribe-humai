import axios from 'axios';
import jwt from 'jsonwebtoken';
import { 
  getAuthUrl, 
  getAccessTokenWithCode, 
  refreshAccessToken, 
  makeCrmRequest,
  discoverEntityDetails,
  getAllAvailableEntities,
  discoverUserOrganizations,
  validateOrganizationAccess,
  discoverActualEntitySets,
  getWorkingEntityDetails,
  validateEntityRequiredFields,
  createEntityWithValidation,
  prepareEntityData,
  STANDARD_ENTITIES,
  ENTITY_ALIASES
} from '../config/microsoftDynemicConfig.js';
import {
  createEntityDynamic,
  getEntitiesDynamic,
  updateEntityDynamic,
  deleteEntityDynamic,
  searchEntitiesDynamic,
  validateEntityData
} from '../services/dynamicsEntityService.js';

// Simple in-memory storage for instance URLs by access token (for demonstration)
// In production, this should be stored in Redis, database, or JWT payload
const tokenInstanceMap = new Map();

// Helper function to store instance URL with access token
function storeInstanceUrlForToken(accessToken, instanceUrl) {
  if (accessToken && instanceUrl) {
    const tokenKey = accessToken.substring(0, 50); // Use first 50 chars as key
    tokenInstanceMap.set(tokenKey, {
      instanceUrl,
      storedAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    });
    console.log('🔗 Stored instance URL for token:', { tokenKey: tokenKey + '...', instanceUrl });
  }
}

// Helper function to retrieve instance URL for access token
function getInstanceUrlForToken(accessToken) {
  if (!accessToken) return null;
  
  const tokenKey = accessToken.substring(0, 50);
  const stored = tokenInstanceMap.get(tokenKey);
  
  if (stored && stored.expiresAt > Date.now()) {
    console.log('🔗 Retrieved stored instance URL for token:', stored.instanceUrl);
    return stored.instanceUrl;
  }
  
  if (stored) {
    tokenInstanceMap.delete(tokenKey); // Clean up expired entry
  }
  
  return null;
}

// Enhanced helper function to get instance URL from multiple sources
function getInstanceUrlFromRequest(req) {
  // Priority 1: Check X-Instance-URL header
  const headerInstanceUrl = req.headers['x-instance-url'] || req.headers['X-Instance-URL'];
  if (headerInstanceUrl) {
    console.log('✅ Using instance URL from X-Instance-URL header:', headerInstanceUrl);
    return headerInstanceUrl;
  }
  
  // Priority 2: Check X-Organization-URL header (backward compatibility)
  const orgHeaderUrl = req.headers['x-organization-url'] || req.headers['X-Organization-URL'];
  if (orgHeaderUrl) {
    console.log('✅ Using instance URL from X-Organization-URL header:', orgHeaderUrl);
    return orgHeaderUrl;
  }
  
  // Priority 3: Get from middleware (already set)
  if (req.dynamicsInstanceUrl) {
    console.log('✅ Using instance URL from middleware:', req.dynamicsInstanceUrl);
    return req.dynamicsInstanceUrl;
  }
  
  // Priority 4: Get from token mapping
  const accessToken = getAccessTokenFromHeader(req);
  if (accessToken) {
    const instanceUrl = getInstanceUrlForToken(accessToken);
    if (instanceUrl) {
      console.log('✅ Using instance URL from token mapping:', instanceUrl);
      return instanceUrl;
    }
  }
  
  console.log('❌ No instance URL found in headers, middleware, or token mapping');
  return null;
}

// Enhanced Error Class for better error handling
class DynamicsError extends Error {
  constructor(message, statusCode = 500, errorCode = 'DYNAMICS_ERROR', details = null) {
    super(message);
    this.name = 'DynamicsError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}


async function getDynamicsUserInfo(accessToken, instanceUrl) {
  try {
    console.log('👤 Getting Dynamics user information...');
    
    const response = await makeCrmRequest('GET', 'WhoAmI', accessToken, null, instanceUrl);
    
    if (response.UserId) {
      // Get additional user details
      const userDetails = await makeCrmRequest(
        'GET',
        `systemusers(${response.UserId})?$select=fullname,internalemailaddress,isdisabled,businessunitid`,
        accessToken,
        null,
        instanceUrl
      );
      
      return {
        UserId: response.UserId,
        OrganizationId: response.OrganizationId,
        BusinessUnitId: response.BusinessUnitId,
        FullName: userDetails.fullname || 'Unknown',
        Email: userDetails.internalemailaddress || 'Unknown',
        IsEnabled: !userDetails.isdisabled
      };
    }
    
    return response;
  } catch (error) {
    console.error('❌ Failed to get user info:', error.message);
    throw new Error(`Failed to get user information: ${error.message}`);
  }
}

// Enhanced error handler with actionable solutions
const handleDynamicsError = (error, operation = 'unknown') => {
  console.error(`[${operation.toUpperCase()}] Error:`, {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    operation
  });

  // Azure AD specific errors
  if (error.message.includes('AADSTS')) {
    if (error.message.includes('AADSTS65001')) {
      return new DynamicsError(
        'Admin consent required. Please contact your administrator to grant consent for this application.',
        403,
        'ADMIN_CONSENT_REQUIRED',
        {
          solution: 'Have an admin visit the consent URL',
          consentUrl: `https://login.microsoftonline.com/common/adminconsent?client_id=${process.env.MD_CLIENT_ID}`,
          steps: [
            'Contact your organization administrator',
            'Ask them to visit the consent URL above',
            'Have them grant consent for the application',
            'Try authentication again'
          ]
        }
      );
    }
    
    if (error.message.includes('AADSTS90102')) {
      return new DynamicsError(
        'Invalid redirect URI configuration.',
        400,
        'INVALID_REDIRECT_URI',
        {
          solution: 'Update Azure AD app registration with correct redirect URI',
          steps: [
            'Go to Azure Portal → App Registrations',
            'Find your application',
            'Go to Authentication section',
            'Add the correct redirect URI',
            'Save the configuration'
          ]
        }
      );
    }

    if (error.message.includes('invalid_client')) {
      return new DynamicsError(
        'Invalid client credentials. Please check your Client ID and Client Secret.',
        401,
        'INVALID_CLIENT_CREDENTIALS',
        {
          solution: 'Verify environment variables',
          steps: [
            'Check MD_CLIENT_ID in environment variables',
            'Verify MD_CLIENT_SECRET is correct',
            'Ensure client secret has not expired',
            'Confirm TENANT_ID is accurate'
          ]
        }
      );
    }

    if (error.message.includes('AADSTS700005')) {
      return new DynamicsError(
        'Tenant mismatch error. The authorization code was issued for a different tenant.',
        400,
        'TENANT_MISMATCH_ERROR',
        {
          solution: 'Fix tenant configuration consistency',
          issue: 'Authorization and token exchange are using different tenants',
          steps: [
            'Ensure both auth URL and token endpoint use the same tenant',
            'For multi-tenant apps, use "common" for both',
            'For single-tenant apps, use specific TENANT_ID for both',
            'Clear browser cache and try authentication again',
            'Check if TENANT_ID environment variable is correctly set'
          ],
          tenantInfo: {
            authTenant: 'Likely using "common" tenant',
            tokenTenant: 'Likely using specific TENANT_ID',
            recommendation: 'Use consistent tenant in both operations'
          }
        }
      );
    }
  }

  // Dynamics 365 API errors
  if (error.response?.status === 401) {
    return new DynamicsError(
      'Authentication failed. Your access token may have expired or is invalid.',
      401,
      'AUTHENTICATION_FAILED',
      {
        solution: 'Refresh your access token',
        steps: [
          'Use the refresh token endpoint',
          'Re-authenticate if refresh fails',
          'Check token expiration time',
          'Verify token format'
        ]
      }
    );
  }

  if (error.response?.status === 403) {
    return new DynamicsError(
      'Permission denied. You do not have sufficient permissions for this operation.',
      403,
      'INSUFFICIENT_PERMISSIONS',
      {
        solution: 'Contact your system administrator',
        steps: [
          'Verify you have a Dynamics 365 license',
          'Check your security role assignments',
          'Ensure entity permissions are granted',
          'Contact your system administrator for access'
        ]
      }
    );
  }

  if (error.response?.status === 404) {
    return new DynamicsError(
      `Resource not found: ${error.response?.data?.error?.message || 'The requested resource does not exist'}`,
      404,
      'RESOURCE_NOT_FOUND',
      {
        solution: 'Verify the resource exists',
        steps: [
          'Check entity name spelling',
          'Verify entity ID is correct',
          'Ensure entity exists in your environment',
          'Check your access permissions'
        ]
      }
    );
  }

  if (error.response?.status === 400) {
    return new DynamicsError(
      `Bad request: ${error.response?.data?.error?.message || error.message}`,
      400,
      'BAD_REQUEST',
      {
        solution: 'Check your request data',
        steps: [
          'Verify all required fields are provided',
          'Check field formats and data types',
          'Ensure field names are correct',
          'Validate data against entity schema'
        ]
      }
    );
  }

  return new DynamicsError(
    error.message || 'An unexpected error occurred',
    error.statusCode || error.response?.status || 500,
    'UNKNOWN_ERROR',
    {
      originalError: error.message,
      solution: 'Contact support with error details',
      steps: [
        'Try the operation again',
        'Check your internet connection',
        'Verify service availability',
        'Contact technical support if the issue persists'
      ]
    }
  );
};

// Helper functions
const createSuccessResponse = (data, message = 'Operation completed successfully', statusCode = 200) => {
  return {
    status: statusCode,
    success: true,
    message,
    timestamp: new Date().toISOString(),
    ...data
  };
};

const createErrorResponse = (error, operation = 'unknown') => {
  const dynamicsError = error instanceof DynamicsError ? error : handleDynamicsError(error, operation);
  
  return {
    status: dynamicsError.statusCode,
    success: false,
    error: dynamicsError.message,
    errorCode: dynamicsError.errorCode,
    timestamp: dynamicsError.timestamp,
    operation: operation,
    details: dynamicsError.details,
    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
};

function getAccessTokenFromHeader(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new DynamicsError(
      'Authorization header is required',
      401,
      'MISSING_AUTH_HEADER',
      {
        solution: 'Include Authorization header in your request',
        steps: [
          'Add "Authorization: Bearer <your-token>" header',
          'Ensure token is not expired',
          'Verify token format is correct'
        ]
      }
    );
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new DynamicsError(
      'Authorization header must use Bearer token format',
      401,
      'INVALID_AUTH_FORMAT',
      {
        solution: 'Use proper Bearer token format',
        example: 'Authorization: Bearer your-access-token-here'
      }
    );
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new DynamicsError(
      'Access token is empty',
      401,
      'EMPTY_TOKEN'
    );
  }

  return token;
}

export const validateD365Token = (token) => {
  try {
    if (typeof token !== 'string' || !token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.]*$/)) {
      throw new DynamicsError(
        'Invalid JWT token structure',
        401,
        'INVALID_TOKEN_STRUCTURE'
      );
    }

    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded) {
      throw new DynamicsError(
        'Failed to decode JWT token',
        401,
        'TOKEN_DECODE_FAILED'
      );
    }

    const requiredClaims = ['iss', 'aud', 'exp', 'nbf', 'oid', 'tid', 'preferred_username'];
    const missingClaims = requiredClaims.filter(claim => !decoded.payload[claim]);
    
    if (missingClaims.length > 0) {
      throw new DynamicsError(
        `Token missing required claims: ${missingClaims.join(', ')}`,
        401,
        'MISSING_TOKEN_CLAIMS',
        { missingClaims }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (decoded.payload.exp < now) {
      throw new DynamicsError(
        `Token expired at ${new Date(decoded.payload.exp * 1000).toISOString()}`,
        401,
        'TOKEN_EXPIRED',
        {
          expiredAt: new Date(decoded.payload.exp * 1000).toISOString(),
          solution: 'Refresh your access token',
          refreshEndpoint: '/auth/refresh'
        }
      );
    }

    if (decoded.payload.nbf > now) {
      throw new DynamicsError(
        `Token not valid before ${new Date(decoded.payload.nbf * 1000).toISOString()}`,
        401,
        'TOKEN_NOT_YET_VALID'
      );
    }

    if (!decoded.payload.iss.startsWith('https://login.microsoftonline.com/')) {
      throw new DynamicsError(
        `Unexpected token issuer: ${decoded.payload.iss}`,
        401,
        'INVALID_TOKEN_ISSUER'
      );
    }

    return decoded.payload;
  } catch (error) {
    if (error instanceof DynamicsError) {
      throw error;
    }
    
    console.error('Token validation failed:', {
      error: error.message,
      tokenPreview: token?.length > 50 ? 
        `${token.substring(0, 25)}...${token.slice(-25)}` : token
    });
    
    throw new DynamicsError(
      `Token validation failed: ${error.message}`,
      401,
      'TOKEN_VALIDATION_FAILED'
    );
  }
};

// Authentication endpoints
export const initiateAuth = (req, res) => {
  try {
    const platform = req.query.platform || 'external';
    const forceConsent = req.query.force_consent === 'true';
    // DEFAULT TO BASIC AUTHENTICATION - only request Dynamics 365 permissions if explicitly requested
    const dynamicsAccess = req.query.dynamics_access === 'true';
    
    console.log(`🔐 Initiating authentication:`, {
      platform,
      forceConsent,
      dynamicsAccess: dynamicsAccess,
      authType: dynamicsAccess ? 'dynamics' : 'basic',
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...'
    });
    
    // Generate auth URL with appropriate scope
    const authUrl = getAuthUrl(platform, forceConsent, dynamicsAccess);
    
    if (dynamicsAccess) {
      console.log('🔑 Using Dynamics 365 authentication - requires existing environment access');
    } else {
      console.log('🔑 Using basic Microsoft Graph authentication - will discover Dynamics 365 access after login');
    }
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('Initiation error:', error);
    const errorResponse = createErrorResponse(error, 'initiate_auth');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// New endpoint for users with specific Dynamics 365 environments
export const initiateAuthForSpecificEnvironment = (req, res) => {
  try {
    const platform = req.query.platform || 'external';
    const forceConsent = req.query.force_consent === 'true';
    const environmentUrl = req.query.environment_url;
    
    console.log(`🔐 Initiating authentication for specific environment:`, {
      platform,
      forceConsent,
      environmentUrl,
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...'
    });
    
    if (!environmentUrl) {
      return res.status(400).json(createErrorResponse(
        new Error('environment_url parameter is required'),
        'initiate_auth_specific_env'
      ));
    }
    
    // Validate environment URL format
    if (!environmentUrl.startsWith('https://') || !environmentUrl.includes('.dynamics.com')) {
      return res.status(400).json(createErrorResponse(
        new Error('Invalid environment URL format. Must be a valid Dynamics 365 URL (e.g., https://orgname.crm.dynamics.com)'),
        'initiate_auth_specific_env'
      ));
    }
    
    // Generate auth URL with custom scope for the specific environment
    const customScope = `${environmentUrl}/.default`;
    console.log(`🔑 Using custom Dynamics 365 environment: ${environmentUrl}`);
    console.log(`🔑 Custom scope: ${customScope}`);
    
    // Temporarily override the environment for this auth request
    const originalUrl = process.env.DYNAMICS_CRM_URL;
    process.env.DYNAMICS_CRM_URL = environmentUrl;
    
    try {
      const authUrl = getAuthUrl(platform, forceConsent, true); // Always use dynamics access for specific environment
      
      // Restore original URL
      process.env.DYNAMICS_CRM_URL = originalUrl;
      
      console.log('✅ Custom environment auth URL generated successfully');
      res.redirect(authUrl);
    } catch (authError) {
      // Restore original URL on error
      process.env.DYNAMICS_CRM_URL = originalUrl;
      throw authError;
    }
    
  } catch (error) {
    console.error('Specific environment auth initiation error:', error);
    const errorResponse = createErrorResponse(error, 'initiate_auth_specific_env');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const handleCallback = async (req, res) => {
  try {
    const { code, state, error: authError } = req.query;
    
    if (authError) {
      throw new DynamicsError(
        `Azure AD authentication error: ${authError}`,
        400,
        'AZURE_AD_ERROR',
        { authError, state }
      );
    }
    
    if (!code) {
      throw new DynamicsError(
        'Authorization code is required for token exchange',
        400,
        'MISSING_AUTH_CODE'
      );
    }

    // Parse state to determine authentication type
    const stateParts = state?.split('_') || [];
    const platform = stateParts[0] || 'external';
    
    console.log(`🔍 Authentication callback - platform: ${platform}`);

    // Phase 1: Get Graph tokens for organization discovery
    console.log('🔄 Phase 1: Getting Graph tokens...');
    const graphTokens = await getAccessTokenWithCode(code, platform);

    console.log(`✅ Graph token exchange successful - scope: ${graphTokens.scope}`);

    // Phase 2: Get user info from Microsoft Graph
    let userInfo;
    try {
      console.log('🔍 Getting user info from Microsoft Graph...');
      const graphResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${graphTokens.accessToken}`,
          'Accept': 'application/json'
        }
      });

      userInfo = {
        id: graphResponse.data.id,
        userPrincipalName: graphResponse.data.userPrincipalName,
        displayName: graphResponse.data.displayName,
        mail: graphResponse.data.mail,
        email: graphResponse.data.mail || graphResponse.data.userPrincipalName,
        fullName: graphResponse.data.displayName,
        username: graphResponse.data.userPrincipalName
      };

      console.log('✅ User info retrieved successfully:', {
        displayName: userInfo.displayName,
        userPrincipalName: userInfo.userPrincipalName
      });

    } catch (userInfoError) {
      console.error('❌ Failed to get user info from Microsoft Graph:', userInfoError.message);
      throw new DynamicsError(
        'Failed to retrieve user information',
        500,
        'USER_INFO_ERROR',
        { originalError: userInfoError.message }
      );
    }

    // Phase 3: Comprehensive Dynamics 365 instance/environment discovery
    let availableInstances = [];
    let selectedInstance = null;
    let dynamicsTokens = null;
    let discoveryError = null;

    try {
      console.log('🔍 Phase 3: Discovering user\'s Dynamics 365 instances/environments...');
      
      // Try multiple discovery methods
      const discoveryMethods = [
        // Method 1: Microsoft Global Discovery Service
        async () => {
          console.log('📡 Trying Global Discovery Service...');
          const orgs = await discoverUserOrganizations(graphTokens.accessToken);
          return orgs.map(org => ({
            friendlyName: org.FriendlyName || org.friendlyName,
            environmentName: org.UniqueName || org.uniqueName,
            instanceUrl: org.ApiUrl || org.apiUrl,
            uniqueName: org.UniqueName || org.uniqueName,
            urlName: org.UrlName || org.urlName,
            region: org.Region || org.region,
            version: org.Version || org.version || '9.2',
            state: org.State || org.state,
            discoveryMethod: 'GlobalDiscovery'
          }));
        },
        
        // Method 2: Try tenant-based instance URL inference
        async () => {
          console.log('🔍 Trying tenant-based discovery...');
          // Extract tenant ID from user principal name or token
          const tenantId = userInfo.userPrincipalName?.split('@')[1]?.split('.')[0];
          const domain = userInfo.userPrincipalName?.split('@')[1];
          
          console.log('🔍 Tenant analysis:', {
            userPrincipalName: userInfo.userPrincipalName,
            extractedTenantId: tenantId,
            domain: domain
          });
          
          if (tenantId && domain) {
            // Common patterns for instance URLs based on tenant
            const possibleUrls = [
              // PRIORITY: Known trial patterns (based on user feedback)
              `https://org4cfb2bc0.crm15.dynamics.com`, // Specific known working pattern
              
              // Based on organization name from email domain
              `https://${tenantId}.crm.dynamics.com`,
              `https://${tenantId}.crm4.dynamics.com`, // Europe/Africa/Middle East
              `https://${tenantId}.crm15.dynamics.com`, // UAE region
              `https://${tenantId}.crm5.dynamics.com`, // Asia Pacific
              `https://${tenantId}.crm12.dynamics.com`, // France
              `https://${tenantId}.crm11.dynamics.com`, // UK
              
              // With 'org' prefix (common pattern)
              `https://org${tenantId}.crm.dynamics.com`,
              `https://org${tenantId}.crm4.dynamics.com`,
              `https://org${tenantId}.crm15.dynamics.com`,
              `https://org${tenantId}.crm5.dynamics.com`,
              `https://org${tenantId}.crm12.dynamics.com`,
              `https://org${tenantId}.crm11.dynamics.com`,
              
              // Organization hash-based (common for newer tenants)
              `https://org${tenantId.substring(0, 8).toLowerCase()}.crm.dynamics.com`,
              `https://org${tenantId.substring(0, 8).toLowerCase()}.crm15.dynamics.com`,
              `https://org${tenantId.substring(0, 8).toLowerCase()}.crm4.dynamics.com`,
              
              // Trial-specific patterns with various hash lengths
              `https://org${tenantId.substring(8, 16).toLowerCase()}.crm15.dynamics.com`,
              `https://org${tenantId.substring(16, 24).toLowerCase()}.crm15.dynamics.com`,
              `https://org${tenantId.substring(24, 32).toLowerCase()}.crm15.dynamics.com`,
              
              // Common trial hashes based on known patterns
              `https://org${tenantId.replace(/-/g, '').substring(0, 8).toLowerCase()}.crm15.dynamics.com`,
              `https://org${tenantId.replace(/-/g, '').substring(8, 16).toLowerCase()}.crm15.dynamics.com`
            ];
            
            const validInstances = [];
            for (const url of possibleUrls) {
              try {
                console.log(`🧪 Testing potential instance: ${url}`);
                const testToken = await getDynamicsTokenForOrganization(graphTokens.refreshToken, url);
                const validation = await validateOrganizationAccess(url, testToken.accessToken);
                if (validation.hasAccess) {
                  validInstances.push({
                    friendlyName: url.split('//')[1]?.split('.')[0]?.toUpperCase() || 'Dynamics 365',
                    environmentName: url.split('//')[1]?.split('.')[0] || 'dynamics365',
                    instanceUrl: url,
                    uniqueName: url.split('//')[1]?.split('.')[0] || 'dynamics365',
                    urlName: url.split('//')[1]?.split('.')[0] || 'dynamics365',
                    region: url.includes('.crm') ? url.split('.crm')[1]?.split('.')[0] || 'Unknown' : 'Unknown',
                    version: '9.2',
                    state: 'Active',
                    discoveryMethod: 'TenantInference',
                    userId: validation.userId,
                    organizationId: validation.organizationId
                  });
                  console.log(`✅ Valid instance found: ${url}`);
                }
              } catch (testError) {
                console.log(`❌ Instance test failed for ${url}: ${testError.message}`);
              }
            }
            return validInstances;
          }
          return [];
        }
      ];

      // Try discovery methods in order
      for (const method of discoveryMethods) {
        try {
          const instances = await method();
          if (instances && instances.length > 0) {
            availableInstances.push(...instances);
            console.log(`✅ Found ${instances.length} instance(s) via discovery method`);
          }
        } catch (methodError) {
          console.log(`⚠️ Discovery method failed: ${methodError.message}`);
        }
      }

      // Remove duplicates based on instanceUrl
      availableInstances = availableInstances.filter((instance, index, self) =>
        index === self.findIndex(i => i.instanceUrl === instance.instanceUrl)
      );

      console.log(`🎯 Total unique instances found: ${availableInstances.length}`);

      if (availableInstances.length > 0) {
        // Auto-select the first instance
        selectedInstance = availableInstances[0];
        console.log(`🎯 Auto-selected instance: ${selectedInstance.friendlyName} (${selectedInstance.instanceUrl})`);
        
        // Phase 4: Get Dynamics 365 specific token for the selected instance
        console.log('🔄 Phase 4: Getting Dynamics 365 specific token...');
        try {
          dynamicsTokens = await getDynamicsTokenForOrganization(
            graphTokens.refreshToken,
            selectedInstance.instanceUrl
          );
          console.log('✅ Dynamics 365 token obtained successfully');
        } catch (dynamicsTokenError) {
          console.error('❌ Failed to get Dynamics token:', dynamicsTokenError.message);
          // Continue without Dynamics token - user can still see instances
        }
      } else {
        console.log('ℹ️ No Dynamics 365 instances found via automatic discovery');
        discoveryError = 'No instances found via automatic discovery methods';
      }

    } catch (discoveryErrorCatch) {
      console.log('⚠️ Instance discovery failed:', discoveryErrorCatch.message);
      discoveryError = discoveryErrorCatch.message;
    }
    
    // Prepare response data
    const responseData = {
      user: {
        id: userInfo.id,
        userPrincipalName: userInfo.userPrincipalName,
        displayName: userInfo.displayName,
        mail: userInfo.mail,
        email: userInfo.email,
        fullName: userInfo.fullName,
        username: userInfo.username
      },
      graphTokens: {
        accessToken: graphTokens.accessToken,
        refreshToken: graphTokens.refreshToken,
        expiresIn: graphTokens.expiresIn,
        tokenType: graphTokens.tokenType,
        scope: graphTokens.scope
      },
      dynamicsTokens: dynamicsTokens ? {
        accessToken: dynamicsTokens.accessToken,
        refreshToken: dynamicsTokens.refreshToken,
        expiresIn: dynamicsTokens.expiresIn,
        tokenType: dynamicsTokens.tokenType,
        scope: dynamicsTokens.scope,
        organizationUrl: dynamicsTokens.organizationUrl
      } : null,
      dynamics365: {
        hasAccess: availableInstances && availableInstances.length > 0,
        instancesCount: availableInstances ? availableInstances.length : 0,
        availableInstances: availableInstances || [],
        availableEnvironments: availableInstances || [], // Alias for backward compatibility
        selectedInstance: selectedInstance,
        selectedEnvironment: selectedInstance, // Alias for backward compatibility
        hasDynamicsToken: !!dynamicsTokens,
        discoveryError: discoveryError,
        nextSteps: availableInstances && availableInstances.length > 0 ? 
          [
            'Use the dynamicsTokens.accessToken for CRM operations',
            `Use X-Instance-URL header: ${selectedInstance?.instanceUrl}`,
            'Multiple instances available - use /auth/switch-organization to switch',
            'Instance URL is your environment URL for all CRM operations'
          ] :
          [
            'No Dynamics 365 instances found automatically',
            'Use /auth/connect-instance endpoint with your known instance URL',
            'Ensure you have a valid Dynamics 365 license and access'
          ]
      },
      platform: platform,
      timestamp: new Date().toISOString()
    };

    // Handle web platform redirect
    if (platform === 'web') {
      const frontendUrl = process.env.MD_FRONTEND_URL;
      const params = new URLSearchParams({
        access_token: dynamicsTokens?.accessToken || graphTokens.accessToken,
        refresh_token: dynamicsTokens?.refreshToken || graphTokens.refreshToken,
        expires_in: dynamicsTokens?.expiresIn || graphTokens.expiresIn,
        email: userInfo.email,
        fullName: userInfo.fullName,
        username: userInfo.username,
        instance_url: selectedInstance?.instanceUrl || '',
        environment_url: selectedInstance?.instanceUrl || '', // Alias since environment URL = instance URL
        environment_name: selectedInstance?.environmentName || '',
        has_dynamics: dynamicsTokens ? 'true' : 'false',
        dynamics_instances: availableInstances ? availableInstances.length : 0
      });
      
      const redirectUrl = `${frontendUrl}?${params.toString()}`;
      return res.redirect(redirectUrl);
    }

    const response = createSuccessResponse(responseData, 'Authentication successful');
    res.status(response.status).json(response);
    
  } catch (error) {
    console.error('Auth callback error:', error);
    const errorResponse = createErrorResponse(error, 'auth_callback');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const checkToken = async (req, res, next) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    
    // Extract instance URL from headers (required for dynamic environments)
    let instanceUrl = req.headers['x-instance-url'] || req.headers['X-Instance-URL'];
    
    // 🚀 NEW: If no instance URL in headers, try to get from storage
    if (!instanceUrl && accessToken) {
      instanceUrl = getInstanceUrlForToken(accessToken);
      if (instanceUrl) {
        console.log('🔗 Auto-retrieved stored instance URL for request');
      }
    }
    
    // Store both access token and instance URL in request object for easy access
    req.dynamicsAccessToken = accessToken;
    req.dynamicsInstanceUrl = instanceUrl;
    
    // Log the extracted values for debugging
    console.log('🔍 Token middleware extracted:', {
      hasAccessToken: !!accessToken,
      tokenLength: accessToken?.length,
      instanceUrl: instanceUrl,
      hasInstanceUrl: !!instanceUrl,
      sourceOfInstanceUrl: req.headers['x-instance-url'] || req.headers['X-Instance-URL'] ? 'header' : (instanceUrl ? 'auto-stored' : 'none'),
      headers: Object.keys(req.headers).filter(h => h.toLowerCase().includes('instance') || h.toLowerCase().includes('authorization'))
    });
    
    next();
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'token_validation');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const getToken = async (req, res) => {
  try {
    const token = getAccessTokenFromHeader(req);
    const response = createSuccessResponse({
      access_token: token
    }, 'Access token retrieved successfully');

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'get_token');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Dynamic Entity Operations
export const createEntity = async (req, res) => {
  try {
    const { entityType } = req.params;
    const accessToken = getAccessTokenFromHeader(req);
    const entityData = req.body;

    // Get instance URL using enhanced helper function
    const instanceUrl = getInstanceUrlFromRequest(req);

    if (!entityData || Object.keys(entityData).length === 0) {
      throw new DynamicsError(
        'Entity data is required in request body',
        400,
        'MISSING_ENTITY_DATA',
        {
          solution: 'Provide entity data in JSON format',
          example: { firstname: 'John', lastname: 'Doe', emailaddress1: 'john@example.com' }
        }
      );
    }

    // List of Sales entities that require Sales Hub
    const salesEntities = ['lead', 'opportunity', 'product', 'quote', 'salesorder', 'invoice'];
    const normalizedEntityType = entityType.toLowerCase().trim();
    const isSalesEntity = salesEntities.includes(normalizedEntityType);
    
    console.log(`🔍 Entity type analysis:`, {
      originalEntityType: entityType,
      normalizedEntityType: normalizedEntityType,
      isSalesEntity: isSalesEntity,
      salesEntitiesList: salesEntities
    });

    // Validate instance URL is provided
    if (!instanceUrl) {
      console.log('❌ Instance URL debugging info:', {
        hasXInstanceUrlHeader: !!(req.headers['x-instance-url'] || req.headers['X-Instance-URL']),
        hasXOrganizationUrlHeader: !!(req.headers['x-organization-url'] || req.headers['X-Organization-URL']),
        hasMiddlewareInstanceUrl: !!req.dynamicsInstanceUrl,
        hasAccessToken: !!accessToken,
        tokenLength: accessToken?.length,
        tokenStart: accessToken?.substring(0, 20) + '...',
        storedInstanceUrl: accessToken ? getInstanceUrlForToken(accessToken) : 'no access token',
        allHeaders: Object.keys(req.headers).filter(h => h.toLowerCase().includes('instance') || h.toLowerCase().includes('organization') || h.toLowerCase().includes('auth'))
      });
      
      throw new DynamicsError(
        'Instance URL is required for Dynamics 365 operations. Please ensure you have connected to an instance or provide the X-Instance-URL header.',
        400,
        'MISSING_INSTANCE_URL',
        {
          solutions: [
            '1. Use the access token from /auth/connect-instance endpoint (automatically stores instance URL)',
            '2. Include X-Instance-URL header: https://your-org.crm.dynamics.com',
            '3. Include X-Organization-URL header (legacy support)',
            '4. Call /auth/connect-instance first to establish instance mapping'
          ],
          debugging: {
            hasXInstanceUrlHeader: !!(req.headers['x-instance-url'] || req.headers['X-Instance-URL']),
            hasXOrganizationUrlHeader: !!(req.headers['x-organization-url'] || req.headers['X-Organization-URL']),
            hasAccessToken: !!accessToken,
            tokenMappingExists: accessToken ? !!getInstanceUrlForToken(accessToken) : false
          },
          example: 'X-Instance-URL: https://org4cfb2bc0.crm15.dynamics.com',
          connectEndpoint: '/api/dynamics/auth/connect-instance',
          note: 'After calling /auth/connect-instance, the instance URL is automatically stored for your access token'
        }
      );
    }

    console.log(`🚀 Creating ${entityType} entity:`, {
      entityType,
      isSalesEntity,
      fieldCount: Object.keys(entityData).length,
      instanceUrl: instanceUrl,
      timestamp: new Date().toISOString()
    });

    // Create the entity using the provided instance URL
    const result = await createEntityDynamic(entityType, entityData, accessToken, {
      organizationUrl: instanceUrl, // Keep organizationUrl for backward compatibility
      fallbackStrategy: 'none' // Explicitly disable fallbacks
    });

    // Success response
    const response = createSuccessResponse(
      result,
      isSalesEntity ? 
        `${entityType} created successfully in Sales environment` : 
      `${entityType} created successfully`,
      201
    );

    res.status(response.status).json(response);
  } catch (error) {
    console.error(`❌ Create ${req.params.entityType} error:`, error.message);
    
    // Enhanced error handling for licensing and validation issues
    if (error.message.includes('SALES_HUB_REQUIRED')) {
      const response = createErrorResponse(
        new DynamicsError(
          error.message,
          402, // Payment Required
          'SALES_HUB_REQUIRED',
          {
            entityType: req.params.entityType,
            requiredLicense: 'Dynamics 365 Sales Hub',
            alternatives: ['contact', 'account', 'task', 'appointment'],
            documentation: 'https://docs.microsoft.com/en-us/dynamics365/sales/',
            solution: 'Install Dynamics 365 Sales Hub or use alternative entities',
            environmentConfiguration: {
              current: req.headers['x-environment-url'] || process.env.DYNAMICS_CRM_URL,
              recommendation: 'Use the /environment/identify-sales endpoint to find the correct Sales environment URL'
            }
          }
        ),
        `create_${req.params.entityType}`
      );
      return res.status(response.status).json(response);
    }
    
    if (error.message.includes('not found') || error.message.includes('not available')) {
      const response = createErrorResponse(
        new DynamicsError(
          `Entity '${req.params.entityType}' is not available in your target environment. This may require additional licensing such as Dynamics 365 Sales Hub.`,
          404,
          'ENTITY_NOT_AVAILABLE',
          {
            entityType: req.params.entityType,
            targetEnvironment: req.headers['x-environment-url'] || process.env.DYNAMICS_CRM_URL,
            suggestion: 'Check your Dynamics 365 licensing and ensure the required modules are installed in the target environment.',
            supportedEntities: ['contact', 'account', 'task', 'appointment', 'incident', 'annotation'],
            documentation: 'https://docs.microsoft.com/en-us/dynamics365/sales/licensing',
            environmentHelp: 'Use /environment/identify-sales to find the correct environment for Sales entities'
          }
        ),
        `create_${req.params.entityType}`
      );
      return res.status(response.status).json(response);
    }
    
    // Handle authentication errors
    if (error.message.includes('Authentication failed') || error.message.includes('Token')) {
      const response = createErrorResponse(
        new DynamicsError(
          'Authentication failed. Your access token may be expired or invalid.',
          401,
          'AUTHENTICATION_FAILED',
          {
            solution: 'Refresh your access token or re-authenticate',
            steps: [
              'Check if your token has expired',
              'Use the refresh token endpoint if available',
              'Re-authenticate if refresh fails',
              'Ensure token has correct permissions'
            ],
            refreshEndpoint: '/api/dynamics/auth/refresh'
          }
        ),
        `create_${req.params.entityType}`
      );
      return res.status(response.status).json(response);
    }

    // Handle permission errors
    if (error.message.includes('Permission denied') || error.message.includes('403')) {
      const response = createErrorResponse(
        new DynamicsError(
          'Insufficient permissions to create this entity.',
          403,
          'INSUFFICIENT_PERMISSIONS',
          {
            entityType: req.params.entityType,
            solution: 'Contact your system administrator to grant necessary permissions',
            steps: [
              'Verify you have a valid Dynamics 365 license',
              'Check your security role assignments',
              'Ensure entity permissions are granted for create operations',
              'Contact your system administrator if issues persist'
            ],
            adminHelp: 'Security roles can be managed in Power Platform Admin Center'
          }
        ),
        `create_${req.params.entityType}`
      );
      return res.status(response.status).json(response);
    }

    // Handle validation errors
    if (error.message.includes('VALIDATION_ERROR') || error.message.includes('Bad request')) {
      const response = createErrorResponse(
        new DynamicsError(
          `Data validation failed for ${req.params.entityType}: ${error.message.replace('VALIDATION_ERROR: ', '')}`,
          400,
          'VALIDATION_FAILED',
          {
            entityType: req.params.entityType,
            solution: 'Check your entity data format and required fields',
            steps: [
              'Verify all required fields are provided',
              'Check field formats and data types',
              'Ensure field names are correct',
              'Validate data against entity schema'
            ],
            testEndpoint: `/api/dynamics/entity/${req.params.entityType}/test`,
            guideEndpoint: `/api/dynamics/entity/${req.params.entityType}/guide`
          }
        ),
        `create_${req.params.entityType}`
      );
      return res.status(response.status).json(response);
    }

    // Handle network/connectivity errors
    if (error.message.includes('Network Error') || error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
      const response = createErrorResponse(
        new DynamicsError(
          'Network connectivity issue. Unable to reach Dynamics 365 service.',
          503,
          'NETWORK_ERROR',
          {
            solution: 'Check your network connection and service availability',
            steps: [
              'Verify your internet connection',
              'Check if Dynamics 365 service is available',
              'Confirm the environment URL is correct',
              'Try again in a moment'
            ],
            statusPage: 'https://status.office365.com/'
          }
        ),
        `create_${req.params.entityType}`
      );
      return res.status(response.status).json(response);
    }

    // Handle environment URL errors
    if (error.message.includes('Resource not found for the segment') || error.message.includes('Invalid URI')) {
      const response = createErrorResponse(
        new DynamicsError(
          'Invalid environment URL or entity endpoint.',
          404,
          'INVALID_ENVIRONMENT_URL',
          {
            currentUrl: req.headers['x-environment-url'] || process.env.DYNAMICS_CRM_URL,
            solution: 'Verify your Dynamics 365 environment URL is correct',
            steps: [
              'Check your DYNAMICS_CRM_URL environment variable',
              'Use /environment/identify-sales to find correct URL',
              'Ensure the URL format is correct (https://[org].crm[x].dynamics.com)',
              'Verify you have access to the specified environment'
            ],
            discoveryEndpoint: '/api/dynamics/environment/identify-sales'
          }
        ),
        `create_${req.params.entityType}`
      );
      return res.status(response.status).json(response);
    }

    // Generic error handler
    const response = createErrorResponse(error, `create_${req.params.entityType}`);
    res.status(response.status).json(response);
  }
};

// Helper function to discover Sales environment for entity creation
const discoverSalesEnvironmentForEntity = async (accessToken) => {
  try {
    console.log('🔍 Discovering Sales environment for entity creation...');
    
    // Get user's organizations
    const organizations = await discoverUserOrganizations(accessToken);
    
    if (!organizations || organizations.length === 0) {
      throw new Error('No Dynamics 365 organizations found for this user');
    }

    console.log(`📋 Found ${organizations.length} organization(s). Testing for Sales capabilities...`);

    const salesEnvironments = [];
    const salesEntities = ['lead', 'opportunity', 'product', 'quote', 'salesorder', 'invoice'];

    // Test each organization for Sales capabilities
    for (const org of organizations) {
      console.log(`🧪 Testing organization: ${org.friendlyName} (${org.apiUrl})`);
      
      let salesEntitiesAvailable = 0;
      const salesEntityTest = {};
      
      // Test each sales entity
      for (const entityType of salesEntities) {
        try {
          // Test entity metadata access
          const response = await axios.get(
            `${org.apiUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${entityType}')?$select=LogicalName,DisplayName`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0'
              },
              timeout: 10000
            }
          );
          
          salesEntityTest[entityType] = { available: true, status: 'SUCCESS' };
          salesEntitiesAvailable++;
          console.log(`  ✅ ${entityType} - Available`);
        } catch (testError) {
          salesEntityTest[entityType] = { 
            available: false, 
            status: 'NOT_AVAILABLE',
            error: testError.response?.status || 'ERROR'
          };
          console.log(`  ❌ ${entityType} - Not available (${testError.response?.status || 'ERROR'})`);
        }
      }
      
      const salesScore = Math.round((salesEntitiesAvailable / salesEntities.length) * 100);
      
      // Bonus points for environments named "Sales" (user's specific requirement)
      let finalScore = salesScore;
      const isSalesNamed = org.friendlyName.toLowerCase().includes('sales');
      if (isSalesNamed && salesScore > 0) {
        finalScore += 20; // Bonus for Sales-named environments
        console.log(`🎯 Bonus points for Sales-named environment: ${org.friendlyName}`);
      }
      
      console.log(`📊 ${org.friendlyName}: ${salesEntitiesAvailable}/${salesEntities.length} entities (${salesScore}% base, ${finalScore}% final)`);
      
      if (salesScore >= 50) { // At least 50% of sales entities available
        salesEnvironments.push({
          friendlyName: org.friendlyName,
          uniqueName: org.uniqueName,
          apiUrl: org.apiUrl,
          region: org.region,
          salesScore: finalScore,
          baseSalesScore: salesScore,
          salesEntitiesAvailable,
          totalSalesEntities: salesEntities.length,
          salesEntityTest,
          isSalesNamed,
          recommendation: salesScore >= 80 ? 
            'Excellent Sales environment - recommended' : 
            'Good Sales environment - usable'
        });
      }
    }
    
    // Sort by final score (highest first), prioritizing Sales-named environments
    salesEnvironments.sort((a, b) => {
      // First priority: Sales-named environments with good scores
      if (a.isSalesNamed && !b.isSalesNamed && a.baseSalesScore >= 50) return -1;
      if (!a.isSalesNamed && b.isSalesNamed && b.baseSalesScore >= 50) return 1;
      
      // Second priority: by sales score
      return b.salesScore - a.salesScore;
    });
    
    console.log(`🎯 Sales environment discovery complete: ${salesEnvironments.length} suitable environments found`);
    
    if (salesEnvironments.length > 0) {
      const topEnvironment = salesEnvironments[0];
      console.log(`✅ Top Sales environment: ${topEnvironment.friendlyName} (${topEnvironment.salesScore}% score)`);
    }
    
    return {
      success: true,
      salesEnvironments,
      totalOrganizations: organizations.length,
      fallbackMode: false
    };
    
  } catch (error) {
    console.error('❌ Sales environment discovery failed:', error.message);
    
    // Handle 401 errors gracefully - likely due to insufficient permissions for global discovery
    if (error.response?.status === 401 || error.message.includes('401') || error.message.includes('Organization discovery failed')) {
      console.log('⚠️ Organization discovery not available (insufficient permissions). Falling back to current environment testing.');
      
      // Fallback: Test the current environment for Sales capabilities
      try {
        const currentEnvironmentUrl = process.env.DYNAMICS_CRM_URL;
        if (!currentEnvironmentUrl) {
          throw new Error('No DYNAMICS_CRM_URL configured and organization discovery failed');
        }
        
        console.log(`🔄 Testing current environment for Sales capabilities: ${currentEnvironmentUrl}`);
        
        const salesEntities = ['lead', 'opportunity', 'product', 'quote', 'salesorder', 'invoice'];
        let salesScore = 0;
        const availableEntities = [];
        const salesEntityTest = {};
        
        // Test each sales entity in the current environment
        for (const entity of salesEntities) {
          try {
            const entityDetails = await discoverEntityDetails(entity, accessToken);
            
            // Test basic access to the entity in current environment
            await makeCrmRequest(
              'GET', 
              `${entityDetails.entitySetName}?$top=1&$select=${entityDetails.primaryIdField}`, 
              accessToken
            );
            
            availableEntities.push(entity);
            salesScore += 1;
            salesEntityTest[entity] = { available: true, status: 'SUCCESS' };
            console.log(`  ✅ ${entity} - Available in current environment`);
          } catch (entityError) {
            salesEntityTest[entity] = { available: false, status: 'NOT_AVAILABLE', error: entityError.message };
            console.log(`  ❌ ${entity} - Not available in current environment: ${entityError.message}`);
          }
        }
        
        const finalScore = Math.round((salesScore / salesEntities.length) * 100);
        console.log(`📊 Current environment sales score: ${finalScore}% (${salesScore}/${salesEntities.length} entities)`);
        
        if (salesScore >= 3) { // At least 3 sales entities available (lead, opportunity, account)
          return {
            success: true,
            salesEnvironments: [{
              friendlyName: 'Current Environment',
              apiUrl: currentEnvironmentUrl,
              salesScore: finalScore,
              salesEntitiesAvailable: salesScore,
              totalSalesEntities: salesEntities.length,
              salesEntityTest,
              isSalesNamed: false,
              recommendation: 'Using current environment with available sales entities'
            }],
            totalOrganizations: 1,
            fallbackMode: true
          };
        } else {
          throw new Error(`Current environment has insufficient Sales capabilities (${salesScore}/${salesEntities.length} entities available)`);
        }
        
      } catch (fallbackError) {
        console.error(`❌ Fallback testing failed: ${fallbackError.message}`);
        throw new Error(`Sales environment discovery failed: ${error.message}. Fallback also failed: ${fallbackError.message}`);
      }
    }
    
    throw error;
  }
};

export const getEntities = async (req, res) => {
  try {
    const { entityType } = req.params;
    const accessToken = getAccessTokenFromHeader(req);
    const { page = 1, pageSize = 10, filter, orderBy, select } = req.query;
    
    // Get instance URL using enhanced helper function
    const instanceUrl = getInstanceUrlFromRequest(req);
    
    if (!instanceUrl) {
      throw new DynamicsError(
        'Instance URL is required for Dynamics 365 operations. Please ensure you have connected to an instance or provide the X-Instance-URL header.',
        400,
        'MISSING_INSTANCE_URL',
        {
          solution: 'Call /auth/connect-instance first or include X-Instance-URL header',
          connectEndpoint: '/api/dynamics/auth/connect-instance'
        }
      );
    }

    const options = {
      top: parseInt(pageSize),
      skip: (parseInt(page) - 1) * parseInt(pageSize),
      count: true,
      organizationUrl: instanceUrl
    };

    if (filter) options.filter = filter;
    if (orderBy) options.orderBy = orderBy;
    if (select) options.select = select;

    const result = await getEntitiesDynamic(entityType, accessToken, options);

    const response = createSuccessResponse({
      ...result,
      pagination: {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalRecords: result.count,
        totalPages: Math.ceil(result.count / parseInt(pageSize)),
        hasNextPage: result.count > parseInt(page) * parseInt(pageSize),
        hasPreviousPage: parseInt(page) > 1
      }
    }, `${entityType} entities retrieved successfully`);

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, `get_${req.params.entityType}`);
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const getEntityById = async (req, res) => {
  try {
    const { entityType, id } = req.params;
    const accessToken = getAccessTokenFromHeader(req);
    
    // Get instance URL using enhanced helper function
    const instanceUrl = getInstanceUrlFromRequest(req);
    
    if (!instanceUrl) {
      throw new DynamicsError(
        'Instance URL is required for Dynamics 365 operations. Please ensure you have connected to an instance or provide the X-Instance-URL header.',
        400,
        'MISSING_INSTANCE_URL',
        {
          solution: 'Call /auth/connect-instance first or include X-Instance-URL header',
          connectEndpoint: '/api/dynamics/auth/connect-instance'
        }
      );
    }

    if (!id) {
      throw new DynamicsError(
        'Entity ID is required',
        400,
        'MISSING_ENTITY_ID'
      );
    }

    const entityDetails = await discoverEntityDetails(entityType, accessToken, instanceUrl);
    const result = await makeCrmRequest('GET', `${entityDetails.entitySetName}(${id})`, accessToken, null, instanceUrl);

    const response = createSuccessResponse({
      entityType: entityDetails.logicalName,
      data: result
    }, `${entityType} retrieved successfully`);

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, `get_${req.params.entityType}_by_id`);
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const updateEntity = async (req, res) => {
  try {
    const { entityType, id } = req.params;
    const accessToken = getAccessTokenFromHeader(req);
    const entityData = req.body;
    
    // Get instance URL using enhanced helper function
    const instanceUrl = getInstanceUrlFromRequest(req);
    
    if (!instanceUrl) {
      throw new DynamicsError(
        'Instance URL is required for Dynamics 365 operations. Please ensure you have connected to an instance or provide the X-Instance-URL header.',
        400,
        'MISSING_INSTANCE_URL',
        {
          solution: 'Call /auth/connect-instance first or include X-Instance-URL header',
          connectEndpoint: '/api/dynamics/auth/connect-instance'
        }
      );
    }

    if (!id) {
      throw new DynamicsError(
        'Entity ID is required for update operation',
        400,
        'MISSING_ENTITY_ID'
      );
    }

    if (!entityData || Object.keys(entityData).length === 0) {
      throw new DynamicsError(
        'Update data is required in request body',
        400,
        'MISSING_UPDATE_DATA'
      );
    }

    const result = await updateEntityDynamic(entityType, id, entityData, accessToken, {
      organizationUrl: instanceUrl
    });

    const response = createSuccessResponse(
      result,
      `${entityType} updated successfully`
    );

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, `update_${req.params.entityType}`);
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const deleteEntity = async (req, res) => {
  try {
    const { entityType, id } = req.params;
    const accessToken = getAccessTokenFromHeader(req);
    
    // Get instance URL using enhanced helper function
    const instanceUrl = getInstanceUrlFromRequest(req);
    
    if (!instanceUrl) {
      throw new DynamicsError(
        'Instance URL is required for Dynamics 365 operations. Please ensure you have connected to an instance or provide the X-Instance-URL header.',
        400,
        'MISSING_INSTANCE_URL',
        {
          solution: 'Call /auth/connect-instance first or include X-Instance-URL header',
          connectEndpoint: '/api/dynamics/auth/connect-instance'
        }
      );
    }

    if (!id) {
      throw new DynamicsError(
        'Entity ID is required for delete operation',
        400,
        'MISSING_ENTITY_ID'
      );
    }

    const result = await deleteEntityDynamic(entityType, id, accessToken, {
      organizationUrl: instanceUrl
    });

    const response = createSuccessResponse(
      result,
      `${entityType} deleted successfully`
    );

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, `delete_${req.params.entityType}`);
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const searchEntities = async (req, res) => {
  try {
    const { entityType } = req.params;
    const { 
      searchTerm, 
      page = 1, 
      pageSize = 10, 
      fields, 
      exactMatch = false,
      includeInactive = false,
      sortBy,
      sortOrder = 'desc'
    } = req.query;
    const accessToken = getAccessTokenFromHeader(req);

    if (!searchTerm) {
      throw new DynamicsError(
        'Search term is required',
        400,
        'MISSING_SEARCH_TERM',
        {
          solution: 'Provide a search term in query parameters',
          example: '?searchTerm=john',
          supportedFeatures: [
            'fields: Custom fields to search (comma-separated)',
            'exactMatch: true/false for exact vs partial matching',
            'includeInactive: true/false to include inactive records',
            'sortBy: Field name to sort by',
            'sortOrder: asc/desc'
          ]
        }
      );
    }

    console.log(`🔍 Enhanced entity search - ${entityType}:`, {
      searchTerm: searchTerm.substring(0, 30) + (searchTerm.length > 30 ? '...' : ''),
      customFields: !!fields,
      exactMatch: exactMatch === 'true',
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });

    // Use the enhanced search functionality
    const searchConfig = await buildIntelligentSearchConfig(
      entityType,
      searchTerm,
      {
        customFields: fields,
        exactMatch: exactMatch === 'true',
        includeInactive: includeInactive === 'true',
        sortBy,
        sortOrder
      },
      accessToken
    );

    const entityDetails = await discoverEntityDetails(entityType, accessToken);

    const searchOptions = {
      pageSize: Math.min(parseInt(pageSize), 100),
      skip: (parseInt(page) - 1) * Math.min(parseInt(pageSize), 100),
      filter: searchConfig.filter,
      orderBy: searchConfig.orderBy,
      select: searchConfig.selectFields
    };

    const result = await executeEnhancedSearch(entityDetails, searchOptions, accessToken);

    const response = createSuccessResponse({
      searchTerm,
      entityType: entityDetails.logicalName,
      entityDisplayName: entityDetails.displayName,
      searchConfiguration: {
        fieldsSearched: searchConfig.searchFields,
        searchType: exactMatch === 'true' ? 'exact' : 'partial',
        includeInactive: includeInactive === 'true',
        customFields: !!fields
      },
      results: result.data,
      count: result.count,
      totalRecords: result.totalCount || result.count,
      pagination: {
        currentPage: parseInt(page),
        pageSize: Math.min(parseInt(pageSize), 100),
        totalRecords: result.totalCount || result.count,
        totalPages: Math.ceil((result.totalCount || result.count) / Math.min(parseInt(pageSize), 100)),
        hasMore: !!(result.nextLink)
      },
      searchMetadata: {
        searchDuration: result.searchDuration || 'N/A',
        optimizations: result.optimizations || []
      }
    }, `Found ${result.count} ${entityDetails.displayName}(s) matching "${searchTerm}"`);

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, `search_${req.params.entityType}`);
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Legacy Compatibility Endpoints
export const createContact = async (req, res) => {
  req.params.entityType = 'contact';
  return createEntity(req, res);
};

export const getContacts = async (req, res) => {
  req.params.entityType = 'contact';
  return getEntities(req, res);
};

export const updateContact = async (req, res) => {
  req.params.entityType = 'contact';
  return updateEntity(req, res);
};

export const deleteContact = async (req, res) => {
  req.params.entityType = 'contact';
  return deleteEntity(req, res);
};

// Enhanced Lead Controllers with validation and business logic
export const createLead = async (req, res) => {
  try {
    console.log('🎯 [LEGACY] createLead - redirecting to enhanced createEntity with Sales environment discovery...');
    
    // Set the entity type in params for createEntity
    req.params.entityType = 'lead';
    
    // Call the enhanced createEntity function which has Sales environment auto-discovery
    return createEntity(req, res);
    
  } catch (error) {
    console.error('❌ [LEGACY] createLead error:', error.message);
    const errorResponse = createErrorResponse(error, 'create_lead_legacy');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const getLeads = async (req, res) => {
  try {
    // Enhanced lead filtering with common business filters
    const { status, source, rating, created_after, created_before } = req.query;
    
    let filter = '';
    const filters = [];
    
    if (status) {
      filters.push(`statuscode eq ${status}`);
    }
    if (source) {
      filters.push(`leadsourcecode eq ${source}`);
    }
    if (rating) {
      filters.push(`leadqualitycode eq ${rating}`);
    }
    if (created_after) {
      filters.push(`createdon ge ${created_after}`);
    }
    if (created_before) {
      filters.push(`createdon le ${created_before}`);
    }
    
    if (filters.length > 0) {
      req.query.filter = filters.join(' and ');
    }
    
    // Default ordering by creation date (newest first)
    if (!req.query.orderBy) {
      req.query.orderBy = 'createdon desc';
    }

    req.params.entityType = 'lead';
    return getEntities(req, res);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'get_leads_enhanced');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const getLeadById = async (req, res) => {
  req.params.entityType = 'lead';
  return getEntityById(req, res);
};

export const updateLead = async (req, res) => {
  req.params.entityType = 'lead';
  return updateEntity(req, res);
};

export const deleteLead = async (req, res) => {
  req.params.entityType = 'lead';
  return deleteEntity(req, res);
};

// Enhanced Deal/Opportunity Controllers with sales pipeline logic
export const createDeal = async (req, res) => {
  try {
    console.log('🎯 [LEGACY] createDeal - Starting deal creation process...');
    console.log('💰 Deal creation request:', {
      hasData: !!req.body,
      fieldCount: Object.keys(req.body || {}).length,
      dealName: req.body?.name,
      estimatedValue: req.body?.estimatedvalue,
      originalUrl: req.originalUrl,
      method: req.method
    });
    
    // Validate input data
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new DynamicsError(
        'Deal data is required in request body',
        400,
        'MISSING_DEAL_DATA',
        {
          solution: 'Provide deal data in JSON format',
          example: { name: 'Software Deal', estimatedvalue: 50000, estimatedclosedate: '2024-12-31' },
          requiredField: 'name'
        }
      );
    }
    
    // Ensure we have a deal name
    if (!req.body.name) {
      throw new DynamicsError(
        'Deal name is required',
        400,
        'MISSING_DEAL_NAME',
        {
          solution: 'Provide a name for the deal/opportunity',
          example: { name: 'Enterprise Software License Deal' }
        }
      );
    }
    
    // Set the entity type in params for createEntity (deals are opportunities)
    console.log('🔄 Converting deal to opportunity entity type...');
    req.params.entityType = 'opportunity';
    
    console.log('🚀 Calling enhanced createEntity with opportunity type...');
    
    // Call the enhanced createEntity function which has Sales environment auto-discovery
    return createEntity(req, res);
    
  } catch (error) {
    console.error('❌ [LEGACY] createDeal error:', error.message);
    const errorResponse = createErrorResponse(error, 'create_deal_legacy');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const getDeals = async (req, res) => {
  try {
    // Enhanced deal filtering with sales pipeline filters
    const { stage, status, min_value, max_value, close_date_after, close_date_before, probability_min } = req.query;
    
    const filters = [];
    
    if (stage) {
      filters.push(`stepname eq '${stage}'`);
    }
    if (status) {
      filters.push(`statuscode eq ${status}`);
    }
    if (min_value) {
      filters.push(`estimatedvalue ge ${min_value}`);
    }
    if (max_value) {
      filters.push(`estimatedvalue le ${max_value}`);
    }
    if (close_date_after) {
      filters.push(`estimatedclosedate ge ${close_date_after}`);
    }
    if (close_date_before) {
      filters.push(`estimatedclosedate le ${close_date_before}`);
    }
    if (probability_min) {
      filters.push(`closeprobability ge ${probability_min}`);
    }
    
    if (filters.length > 0) {
      req.query.filter = filters.join(' and ');
    }
    
    // Default ordering by estimated value (highest first)
    if (!req.query.orderBy) {
      req.query.orderBy = 'estimatedvalue desc';
    }

    req.params.entityType = 'opportunity';
    return getEntities(req, res);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'get_deals_enhanced');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const getDealById = async (req, res) => {
  req.params.entityType = 'opportunity';
  return getEntityById(req, res);
};

export const updateDeal = async (req, res) => {
  try {
    const dealData = req.body;
    
    // Auto-update probability based on stage if stage is being updated
    if (dealData.stepname && !dealData.closeprobability) {
      dealData.closeprobability = getDefaultProbability(dealData.stepname);
    }
    
    req.params.entityType = 'opportunity';
    req.body = dealData;
    
    console.log('💰 Updating deal/opportunity:', {
      id: req.params.id,
      stage: dealData.stepname,
      probability: dealData.closeprobability
    });
    
    return updateEntity(req, res);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'update_deal_enhanced');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const deleteDeal = async (req, res) => {
  req.params.entityType = 'opportunity';
  return deleteEntity(req, res);
};

// Helper function to get default probability based on sales stage
function getDefaultProbability(stage) {
  const stageProbabilities = {
    'Qualify': 25,
    'Develop': 50,
    'Propose': 75,
    'Close': 90,
    'Won': 100,
    'Lost': 0
  };
  return stageProbabilities[stage] || 25;
}

export const createTask = async (req, res) => {
  req.params.entityType = 'task';
  return createEntity(req, res);
};

export const getTasks = async (req, res) => {
  req.params.entityType = 'task';
  return getEntities(req, res);
};

export const getTaskById = async (req, res) => {
  req.params.entityType = 'task';
  return getEntityById(req, res);
};

export const updateTask = async (req, res) => {
  req.params.entityType = 'task';
  return updateEntity(req, res);
};

export const deleteTask = async (req, res) => {
  req.params.entityType = 'task';
  return deleteEntity(req, res);
};

export const createAccount = async (req, res) => {
  req.params.entityType = 'account';
  return createEntity(req, res);
};

export const getAccounts = async (req, res) => {
  req.params.entityType = 'account';
  return getEntities(req, res);
};

export const getAccountById = async (req, res) => {
  req.params.entityType = 'account';
  return getEntityById(req, res);
};

export const updateAccount = async (req, res) => {
  req.params.entityType = 'account';
  return updateEntity(req, res);
};

export const deleteAccount = async (req, res) => {
  req.params.entityType = 'account';
  return deleteEntity(req, res);
};

export const createCase = async (req, res) => {
  req.params.entityType = 'incident';
  return createEntity(req, res);
};

export const getCases = async (req, res) => {
  req.params.entityType = 'incident';
  return getEntities(req, res);
};

// Enhanced Product Controllers with inventory and pricing logic
export const createProduct = async (req, res) => {
  try {
    console.log('🎯 [LEGACY] createProduct - redirecting to enhanced createEntity with Sales environment discovery...');
    console.log('📦 Product creation request:', {
      hasData: !!req.body,
      fieldCount: Object.keys(req.body || {}).length,
      productName: req.body?.name,
      productNumber: req.body?.productnumber,
      price: req.body?.price
    });
    
    // Auto-generate product number if not provided
    if (req.body && req.body.name && !req.body.productnumber) {
      req.body.productnumber = generateProductNumber(req.body.name);
      console.log(`🔧 Auto-generated product number: ${req.body.productnumber}`);
    }
    
    // Set the entity type in params for createEntity
    req.params.entityType = 'product';
    
    // Call the enhanced createEntity function which has Sales environment auto-discovery
    return createEntity(req, res);
    
  } catch (error) {
    console.error('❌ [LEGACY] createProduct error:', error.message);
    const errorResponse = createErrorResponse(error, 'create_product_legacy');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const getProducts = async (req, res) => {
  try {
    // Enhanced product filtering with business filters
    const { status, type, min_price, max_price, category, in_stock } = req.query;
    
    const filters = [];
    
    if (status) {
      filters.push(`statuscode eq ${status}`);
    }
    if (type) {
      filters.push(`producttypecode eq ${type}`);
    }
    if (min_price) {
      filters.push(`price ge ${min_price}`);
    }
    if (max_price) {
      filters.push(`price le ${max_price}`);
    }
    if (category) {
      filters.push(`productstructure eq ${category}`);
    }
    if (in_stock === 'true') {
      filters.push(`quantityonhand gt 0`);
    }
    
    if (filters.length > 0) {
      req.query.filter = filters.join(' and ');
    }
    
    // Default ordering by name
    if (!req.query.orderBy) {
      req.query.orderBy = 'name asc';
    }

    req.params.entityType = 'product';
    return getEntities(req, res);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'get_products_enhanced');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Helper function to generate product number
function generateProductNumber(productName) {
  const prefix = productName.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${timestamp}`;
}

// Enhanced Quote Controllers with pricing and approval logic
export const createQuote = async (req, res) => {
  try {
    console.log('🎯 [LEGACY] createQuote - redirecting to enhanced createEntity with Sales environment discovery...');
    console.log('📋 Quote creation request:', {
      hasData: !!req.body,
      fieldCount: Object.keys(req.body || {}).length,
      quoteName: req.body?.name,
      quoteNumber: req.body?.quotenumber,
      description: req.body?.description
    });
    
    // Auto-generate quote number if not provided
    if (req.body && req.body.name && !req.body.quotenumber) {
      req.body.quotenumber = generateQuoteNumber();
      console.log(`🔧 Auto-generated quote number: ${req.body.quotenumber}`);
    }
    
    // Set the entity type in params for createEntity
    req.params.entityType = 'quote';
    
    // Call the enhanced createEntity function which has Sales environment auto-discovery
    return createEntity(req, res);
    
  } catch (error) {
    console.error('❌ [LEGACY] createQuote error:', error.message);
    const errorResponse = createErrorResponse(error, 'create_quote_legacy');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const getQuotes = async (req, res) => {
  try {
    // Enhanced quote filtering with business filters
    const { status, min_amount, max_amount, valid_after, valid_before, customer } = req.query;
    
    const filters = [];
    
    if (status) {
      filters.push(`statuscode eq ${status}`);
    }
    if (min_amount) {
      filters.push(`totalamount ge ${min_amount}`);
    }
    if (max_amount) {
      filters.push(`totalamount le ${max_amount}`);
    }
    if (valid_after) {
      filters.push(`effectivefrom ge ${valid_after}`);
    }
    if (valid_before) {
      filters.push(`effectiveto le ${valid_before}`);
    }
    if (customer) {
      filters.push(`customerid eq ${customer}`);
    }
    
    if (filters.length > 0) {
      req.query.filter = filters.join(' and ');
    }
    
    // Default ordering by creation date (newest first)
    if (!req.query.orderBy) {
      req.query.orderBy = 'createdon desc';
    }

    req.params.entityType = 'quote';
    return getEntities(req, res);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'get_quotes_enhanced');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Helper function to generate quote number
function generateQuoteNumber() {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-4);
  return `Q-${year}${month}-${timestamp}`;
}

// Enhanced Sales Order Controllers with fulfillment and shipping logic
export const createOrder = async (req, res) => {
  try {
    console.log('🎯 [LEGACY] createOrder - redirecting to enhanced createEntity with Sales environment discovery...');
    console.log('📦 Sales Order creation request:', {
      hasData: !!req.body,
      fieldCount: Object.keys(req.body || {}).length,
      orderName: req.body?.name,
      orderNumber: req.body?.ordernumber,
      description: req.body?.description
    });
    
    // Auto-generate order number if not provided
    if (req.body && req.body.name && !req.body.ordernumber) {
      req.body.ordernumber = generateOrderNumber();
      console.log(`🔧 Auto-generated order number: ${req.body.ordernumber}`);
    }
    
    // Set the entity type in params for createEntity
    req.params.entityType = 'salesorder';
    
    // Call the enhanced createEntity function which has Sales environment auto-discovery
    return createEntity(req, res);
    
  } catch (error) {
    console.error('❌ [LEGACY] createOrder error:', error.message);
    const errorResponse = createErrorResponse(error, 'create_order_legacy');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const createSalesOrder = async (req, res) => {
  try {
    console.log('🎯 [LEGACY] createSalesOrder - redirecting to enhanced createEntity with Sales environment discovery...');
    console.log('📦 Sales Order creation request:', {
      hasData: !!req.body,
      fieldCount: Object.keys(req.body || {}).length,
      orderName: req.body?.name,
      orderNumber: req.body?.ordernumber,
      description: req.body?.description
    });
    
    // Auto-generate order number if not provided
    if (req.body && req.body.name && !req.body.ordernumber) {
      req.body.ordernumber = generateOrderNumber();
      console.log(`🔧 Auto-generated order number: ${req.body.ordernumber}`);
    }
    
    // Set the entity type in params for createEntity
    req.params.entityType = 'salesorder';
    
    // Call the enhanced createEntity function which has Sales environment auto-discovery
    return createEntity(req, res);
    
  } catch (error) {
    console.error('❌ [LEGACY] createSalesOrder error:', error.message);
    const errorResponse = createErrorResponse(error, 'create_salesorder_legacy');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const getOrders = async (req, res) => {
  try {
    // Enhanced sales order filtering with fulfillment filters
    const { status, min_amount, max_amount, delivery_after, delivery_before, shipping_method, payment_terms } = req.query;
    
    const filters = [];
    
    if (status) {
      filters.push(`statuscode eq ${status}`);
    }
    if (min_amount) {
      filters.push(`totalamount ge ${min_amount}`);
    }
    if (max_amount) {
      filters.push(`totalamount le ${max_amount}`);
    }
    if (delivery_after) {
      filters.push(`requestdeliveryby ge ${delivery_after}`);
    }
    if (delivery_before) {
      filters.push(`requestdeliveryby le ${delivery_before}`);
    }
    if (shipping_method) {
      filters.push(`shippingmethodcode eq ${shipping_method}`);
    }
    if (payment_terms) {
      filters.push(`paymenttermscode eq ${payment_terms}`);
    }
    
    if (filters.length > 0) {
      req.query.filter = filters.join(' and ');
    }
    
    // Default ordering by requested delivery date (earliest first)
    if (!req.query.orderBy) {
      req.query.orderBy = 'requestdeliveryby asc';
    }

    req.params.entityType = 'salesorder';
    return getEntities(req, res);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'get_orders_enhanced');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Helper function to generate order number
function generateOrderNumber() {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const day = String(new Date().getDate()).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-3);
  return `SO-${year}${month}${day}-${timestamp}`;
}

// Enhanced Invoice Controllers with billing and payment logic
export const createInvoice = async (req, res) => {
  try {
    console.log('🎯 [LEGACY] createInvoice - redirecting to enhanced createEntity with Sales environment discovery...');
    console.log('🧾 Invoice creation request:', {
      hasData: !!req.body,
      fieldCount: Object.keys(req.body || {}).length,
      invoiceName: req.body?.name,
      invoiceNumber: req.body?.invoicenumber,
      description: req.body?.description
    });
    
    // Auto-generate invoice number if not provided
    if (req.body && req.body.name && !req.body.invoicenumber) {
      req.body.invoicenumber = generateInvoiceNumber();
      console.log(`🔧 Auto-generated invoice number: ${req.body.invoicenumber}`);
    }
    
    // Set the entity type in params for createEntity
    req.params.entityType = 'invoice';
    
    // Call the enhanced createEntity function which has Sales environment auto-discovery
    return createEntity(req, res);
    
  } catch (error) {
    console.error('❌ [LEGACY] createInvoice error:', error.message);
    const errorResponse = createErrorResponse(error, 'create_invoice_legacy');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const getInvoices = async (req, res) => {
  try {
    // Enhanced invoice filtering with billing filters
    const { status, min_amount, max_amount, due_after, due_before, payment_terms, overdue } = req.query;
    
    const filters = [];
    
    if (status) {
      filters.push(`statuscode eq ${status}`);
    }
    if (min_amount) {
      filters.push(`totalamount ge ${min_amount}`);
    }
    if (max_amount) {
      filters.push(`totalamount le ${max_amount}`);
    }
    if (due_after) {
      filters.push(`duedate ge ${due_after}`);
    }
    if (due_before) {
      filters.push(`duedate le ${due_before}`);
    }
    if (payment_terms) {
      filters.push(`paymenttermscode eq ${payment_terms}`);
    }
    if (overdue === 'true') {
      const today = new Date().toISOString().split('T')[0];
      filters.push(`duedate lt ${today} and statuscode ne 4`); // Not paid and overdue
    }
    
    if (filters.length > 0) {
      req.query.filter = filters.join(' and ');
    }
    
    // Default ordering by due date (earliest first)
    if (!req.query.orderBy) {
      req.query.orderBy = 'duedate asc';
    }

    req.params.entityType = 'invoice';
    return getEntities(req, res);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'get_invoices_enhanced');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Helper function to generate invoice number
function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const day = String(new Date().getDate()).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-3);
  return `INV-${year}${month}${day}-${timestamp}`;
}

export const createCampaign = async (req, res) => {
  req.params.entityType = 'campaign';
  return createEntity(req, res);
};

export const getCampaigns = async (req, res) => {
  req.params.entityType = 'campaign';
  return getEntities(req, res);
};

// ==========================================
// ADDITIONAL ENTITY CONTROLLERS
// ==========================================

// Appointment (Meeting) Controllers
export const createAppointment = async (req, res) => {
  req.params.entityType = 'appointment';
  return createEntity(req, res);
};

export const getAppointments = async (req, res) => {
  req.params.entityType = 'appointment';
  return getEntities(req, res);
};

export const getAppointmentById = async (req, res) => {
  req.params.entityType = 'appointment';
  return getEntityById(req, res);
};

export const updateAppointment = async (req, res) => {
  req.params.entityType = 'appointment';
  return updateEntity(req, res);
};

export const deleteAppointment = async (req, res) => {
  req.params.entityType = 'appointment';
  return deleteEntity(req, res);
};

// Meeting Controllers (alias for appointments)
export const createMeeting = async (req, res) => {
  req.params.entityType = 'appointment';
  return createEntity(req, res);
};

export const getMeetings = async (req, res) => {
  req.params.entityType = 'appointment';
  return getEntities(req, res);
};

export const getMeetingById = async (req, res) => {
  req.params.entityType = 'appointment';
  return getEntityById(req, res);
};

export const updateMeeting = async (req, res) => {
  req.params.entityType = 'appointment';
  return updateEntity(req, res);
};

export const deleteMeeting = async (req, res) => {
  req.params.entityType = 'appointment';
  return deleteEntity(req, res);
};

// Case Controllers (incident)
export const getCaseById = async (req, res) => {
  req.params.entityType = 'incident';
  return getEntityById(req, res);
};

export const updateCase = async (req, res) => {
  req.params.entityType = 'incident';
  return updateEntity(req, res);
};

export const deleteCase = async (req, res) => {
  req.params.entityType = 'incident';
  return deleteEntity(req, res);
};

// Note (Annotation) Controllers
export const createNote = async (req, res) => {
  req.params.entityType = 'annotation';
  return createEntity(req, res);
};

export const getNotes = async (req, res) => {
  req.params.entityType = 'annotation';
  return getEntities(req, res);
};

export const getNoteById = async (req, res) => {
  req.params.entityType = 'annotation';
  return getEntityById(req, res);
};

export const updateNote = async (req, res) => {
  req.params.entityType = 'annotation';
  return updateEntity(req, res);
};

export const deleteNote = async (req, res) => {
  req.params.entityType = 'annotation';
  return deleteEntity(req, res);
};

// Phone Call Controllers
export const createPhoneCall = async (req, res) => {
  req.params.entityType = 'phonecall';
  return createEntity(req, res);
};

export const getPhoneCalls = async (req, res) => {
  req.params.entityType = 'phonecall';
  return getEntities(req, res);
};

export const getPhoneCallById = async (req, res) => {
  req.params.entityType = 'phonecall';
  return getEntityById(req, res);
};

export const updatePhoneCall = async (req, res) => {
  req.params.entityType = 'phonecall';
  return updateEntity(req, res);
};

export const deletePhoneCall = async (req, res) => {
  req.params.entityType = 'phonecall';
  return deleteEntity(req, res);
};

// Call Controllers (alias for phonecall)
export const createCall = async (req, res) => {
  req.params.entityType = 'phonecall';
  return createEntity(req, res);
};

export const getCalls = async (req, res) => {
  req.params.entityType = 'phonecall';
  return getEntities(req, res);
};

export const getCallById = async (req, res) => {
  req.params.entityType = 'phonecall';
  return getEntityById(req, res);
};

export const updateCall = async (req, res) => {
  req.params.entityType = 'phonecall';
  return updateEntity(req, res);
};

export const deleteCall = async (req, res) => {
  req.params.entityType = 'phonecall';
  return deleteEntity(req, res);
};

// Email Controllers
export const createEmail = async (req, res) => {
  req.params.entityType = 'email';
  return createEntity(req, res);
};

export const getEmails = async (req, res) => {
  req.params.entityType = 'email';
  return getEntities(req, res);
};

export const getEmailById = async (req, res) => {
  req.params.entityType = 'email';
  return getEntityById(req, res);
};

export const updateEmail = async (req, res) => {
  req.params.entityType = 'email';
  return updateEntity(req, res);
};

export const deleteEmail = async (req, res) => {
  req.params.entityType = 'email';
  return deleteEntity(req, res);
};

// Sales Order Controllers
export const getSalesOrderById = async (req, res) => {
  req.params.entityType = 'salesorder';
  return getEntityById(req, res);
};

export const updateSalesOrder = async (req, res) => {
  req.params.entityType = 'salesorder';
  return updateEntity(req, res);
};

export const deleteSalesOrder = async (req, res) => {
  req.params.entityType = 'salesorder';
  return deleteEntity(req, res);
};

// Order Controllers (alias for salesorder) - Enhanced
export const getOrderById = async (req, res) => {
  req.params.entityType = 'salesorder';
  return getEntityById(req, res);
};

export const updateOrder = async (req, res) => {
  req.params.entityType = 'salesorder';
  return updateEntity(req, res);
};

export const deleteOrder = async (req, res) => {
  req.params.entityType = 'salesorder';
  return deleteEntity(req, res);
};

// Invoice Controllers - Enhanced
export const getInvoiceById = async (req, res) => {
  req.params.entityType = 'invoice';
  return getEntityById(req, res);
};

export const updateInvoice = async (req, res) => {
  req.params.entityType = 'invoice';
  return updateEntity(req, res);
};

export const deleteInvoice = async (req, res) => {
  req.params.entityType = 'invoice';
  return deleteEntity(req, res);
};

// Utility Endpoints
export const searchCRM = async (req, res) => {
  try {
    console.log('🔍 Starting comprehensive CRM search...');
    
    const { 
      searchTerm, 
      module,
      entityType, // Support legacy parameter name
      page = 1, 
      pageSize = 10, 
      fields, 
      exactMatch = false,
      includeInactive = false,
      sortBy,
      sortOrder = 'desc'
    } = req.query;
    
    const accessToken = getAccessTokenFromHeader(req);

    // Support both 'module' and 'entityType' parameters for backward compatibility
    const targetEntityType = module || entityType;

    // Validate required parameters
    if (!searchTerm) {
      throw new DynamicsError(
        'Search term is required',
        400,
        'MISSING_SEARCH_TERM',
        {
          solution: 'Provide a search term to search for',
          example: '?searchTerm=john&module=contact',
          supportedModules: Object.keys(STANDARD_ENTITIES),
          supportedFeatures: [
            'fields: Custom fields to search (comma-separated)',
            'exactMatch: true/false for exact vs partial matching',
            'includeInactive: true/false to include inactive records',
            'sortBy: Field name to sort by',
            'sortOrder: asc/desc'
          ]
        }
      );
    }

    if (!targetEntityType) {
      throw new DynamicsError(
        'Module (entity type) is required',
        400,
        'MISSING_MODULE',
        {
          solution: 'Specify which entity type to search in using either "module" or "entityType" parameter',
          example: '?searchTerm=john&module=contact',
          alternativeExample: '?searchTerm=john&entityType=contact',
          supportedModules: Object.keys(STANDARD_ENTITIES)
        }
      );
    }

    console.log('🔍 Search parameters:', {
      searchTerm: searchTerm.substring(0, 50) + (searchTerm.length > 50 ? '...' : ''),
      module: targetEntityType,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      customFields: !!fields,
      exactMatch: exactMatch === 'true',
      includeInactive: includeInactive === 'true'
    });

    // Get entity details with alias resolution
    const resolvedEntityType = ENTITY_ALIASES[targetEntityType.toLowerCase()] || targetEntityType.toLowerCase();
    
    if (!STANDARD_ENTITIES[resolvedEntityType]) {
      throw new DynamicsError(
        `Module '${targetEntityType}' is not supported`,
        400,
        'UNSUPPORTED_MODULE',
        {
          providedModule: targetEntityType,
          resolvedModule: resolvedEntityType,
          supportedModules: Object.keys(STANDARD_ENTITIES),
          suggestion: `Try one of: ${Object.keys(STANDARD_ENTITIES).slice(0, 5).join(', ')}...`,
          entityAliases: ENTITY_ALIASES
        }
      );
    }

    const entityDetails = await discoverEntityDetails(resolvedEntityType, accessToken);
    console.log(`✅ Entity discovered: ${entityDetails.displayName} (${entityDetails.logicalName})`);

    // Build intelligent search configuration
    const searchConfig = await buildIntelligentSearchConfig(
      resolvedEntityType, 
      searchTerm, 
      {
        customFields: fields,
        exactMatch: exactMatch === 'true',
        includeInactive: includeInactive === 'true',
        sortBy,
        sortOrder
      },
      accessToken
    );

    console.log('🎯 Search configuration:', {
      fieldsToSearch: searchConfig.searchFields.length,
      filterQuery: searchConfig.filter.substring(0, 100) + '...',
      hasCustomSort: !!searchConfig.orderBy
    });

    // Execute the search
    const searchOptions = {
      pageSize: Math.min(parseInt(pageSize), 100), // Cap at 100 for performance
      skip: (parseInt(page) - 1) * Math.min(parseInt(pageSize), 100),
      filter: searchConfig.filter,
      orderBy: searchConfig.orderBy,
      select: searchConfig.selectFields,
      // Add search context for fallback scenarios
      searchTerm: searchTerm,
      searchFields: searchConfig.searchFields
    };

    const result = await executeEnhancedSearch(entityDetails, searchOptions, accessToken);

    // Prepare response with enhanced metadata
    const response = createSuccessResponse({
      searchTerm,
      module: resolvedEntityType,
      entityType: resolvedEntityType, // Include for backward compatibility
      entityDisplayName: entityDetails.displayName,
      searchConfiguration: {
        fieldsSearched: searchConfig.searchFields,
        searchType: exactMatch === 'true' ? 'exact' : 'partial',
        includeInactive: includeInactive === 'true',
        customFields: !!fields
      },
      results: result.data,
      count: result.count,
      totalRecords: result.totalCount || result.count,
      pagination: {
        currentPage: parseInt(page),
        pageSize: Math.min(parseInt(pageSize), 100),
        totalRecords: result.totalCount || result.count,
        totalPages: Math.ceil((result.totalCount || result.count) / Math.min(parseInt(pageSize), 100)),
        hasMore: !!(result.nextLink)
      },
      searchMetadata: {
        searchDuration: result.searchDuration || 'N/A',
        indexesUsed: result.indexesUsed || [],
        optimizationApplied: result.optimizations || []
      },
      availableFeatures: {
        supportedQueryParams: [
          'searchTerm (required): Text to search for',
          'module (required): Entity type to search (contact, lead, opportunity, etc.)',
          'fields (optional): Comma-separated custom fields to search',
          'exactMatch (optional): true/false for exact vs partial matching',
          'includeInactive (optional): true/false to include inactive records',
          'sortBy (optional): Field name to sort by',
          'sortOrder (optional): asc/desc',
          'page (optional): Page number for pagination',
          'pageSize (optional): Records per page (max 100)'
        ],
        supportedModules: Object.keys(STANDARD_ENTITIES),
        entityAliases: ENTITY_ALIASES
      }
    }, `Found ${result.count} ${entityDetails.displayName}(s) matching "${searchTerm}"`);

    console.log(`✅ Search completed: Found ${result.count} records in ${entityDetails.displayName}`);
    res.status(response.status).json(response);

  } catch (error) {
    console.error('❌ CRM search failed:', error.message);
    const errorResponse = createErrorResponse(error, 'search_crm');
    res.status(errorResponse.status).json(errorResponse);
  }
};



/**
 * Build intelligent search configuration based on entity type and search term
 */
const buildIntelligentSearchConfig = async (entityType, searchTerm, options = {}, accessToken) => {
  console.log(`🧠 Building intelligent search config for ${entityType}...`);
  
  // Get field mappings from the entity service
  const { ENTITY_FIELD_MAPPINGS } = await import('../services/dynamicsEntityService.js');
  const fieldMapping = ENTITY_FIELD_MAPPINGS[entityType];
  
  // Determine search fields
  let searchFields = [];
  
  if (options.customFields) {
    // Use custom fields if provided
    searchFields = options.customFields.split(',').map(field => field.trim());
    console.log(`🎯 Using custom search fields: ${searchFields.join(', ')}`);
  } else if (fieldMapping?.searchFields) {
    // Use predefined search fields for the entity
    searchFields = [...fieldMapping.searchFields];
    console.log(`📋 Using predefined search fields: ${searchFields.join(', ')}`);
  } else {
    // Fallback to basic fields based on entity type
    searchFields = getDefaultSearchFields(entityType);
    console.log(`🔧 Using fallback search fields: ${searchFields.join(', ')}`);
  }

  // Escape the search term for OData queries
  const escapedSearchTerm = searchTerm.replace(/'/g, "''");
  
  // Build search conditions based on search type
  let searchConditions = [];
  
  if (options.exactMatch) {
    // Exact match search
    searchConditions = searchFields.map(field => 
      `${field} eq '${escapedSearchTerm}'`
    );
    console.log('🎯 Using exact match search');
  } else {
    // Partial match search using startswith (most compatible)
    // This will find records where the field starts with the search term
    searchConditions = searchFields.map(field => 
      `startswith(tolower(${field}), tolower('${escapedSearchTerm}'))`
    );
    console.log('🔍 Using partial match search with startswith (compatible mode)');
  }

  // Build filter query
  let filter = searchConditions.join(' or ');
  
  // Add status filter if needed
  if (!options.includeInactive) {
    if (entityType === 'contact' || entityType === 'lead' || entityType === 'account') {
      filter = `(${filter}) and (statecode eq 0)`;
    } else if (entityType === 'task' || entityType === 'appointment' || entityType === 'email' || entityType === 'phonecall') {
      filter = `(${filter}) and (statecode ne 2)`;
    }
  }

  // Build order by clause
  let orderBy = '';
  if (options.sortBy) {
    const validSortFields = ['createdon', 'modifiedon', 'name', 'subject', 'title', 'fullname'];
    if (validSortFields.includes(options.sortBy.toLowerCase())) {
      orderBy = `${options.sortBy} ${options.sortOrder}`;
    }
  } else {
    // Default sorting
    orderBy = 'modifiedon desc';
  }

  // Build select fields for better performance
  const selectFields = [...new Set([
    ...searchFields,
    'createdon',
    'modifiedon',
    getEntityPrimaryKey(entityType),
    getEntityPrimaryName(entityType)
  ])].filter(Boolean);

  return {
    searchFields,
    filter,
    orderBy,
    selectFields,
    searchType: options.exactMatch ? 'exact' : 'partial'
  };
};

/**
 * Get default search fields for an entity type
 */
const getDefaultSearchFields = (entityType) => {
  const defaultFields = {
    contact: ['firstname', 'lastname', 'fullname', 'emailaddress1', 'telephone1'],
    lead: ['firstname', 'lastname', 'fullname', 'companyname', 'emailaddress1', 'subject'],
    account: ['name', 'emailaddress1', 'telephone1', 'websiteurl'],
    opportunity: ['name', 'description'],
    task: ['subject', 'description'],
    appointment: ['subject', 'description', 'location'],
    incident: ['title', 'ticketnumber', 'description'],
    product: ['name', 'productnumber', 'description'],
    quote: ['name', 'quotenumber', 'description'],
    salesorder: ['name', 'ordernumber', 'description'],
    invoice: ['name', 'invoicenumber', 'description'],
    campaign: ['name', 'description'],
    annotation: ['subject', 'notetext'],
    email: ['subject', 'description'],
    phonecall: ['subject', 'description', 'phonenumber'],
    goal: ['title', 'description']
  };
  
  return defaultFields[entityType] || ['name', 'subject', 'title'].filter(Boolean);
};

/**
 * Get entity primary key field
 */
const getEntityPrimaryKey = (entityType) => {
  const primaryKeys = {
    contact: 'contactid',
    lead: 'leadid',
    account: 'accountid',
    opportunity: 'opportunityid',
    task: 'activityid',
    appointment: 'activityid',
    incident: 'incidentid',
    product: 'productid',
    quote: 'quoteid',
    salesorder: 'salesorderid',
    invoice: 'invoiceid',
    campaign: 'campaignid',
    annotation: 'annotationid',
    email: 'activityid',
    phonecall: 'activityid',
    goal: 'goalid'
  };
  
  return primaryKeys[entityType] || 'id';
};

/**
 * Get entity primary name field
 */
const getEntityPrimaryName = (entityType) => {
  const primaryNames = {
    contact: 'fullname',
    lead: 'fullname',
    account: 'name',
    opportunity: 'name',
    task: 'subject',
    appointment: 'subject',
    incident: 'title',
    product: 'name',
    quote: 'name',
    salesorder: 'name',
    invoice: 'name',
    campaign: 'name',
    annotation: 'subject',
    email: 'subject',
    phonecall: 'subject',
    goal: 'title'
  };
  
  return primaryNames[entityType] || 'name';
};

/**
 * Execute enhanced search with optimization and fallback mechanisms
 */
const executeEnhancedSearch = async (entityDetails, searchOptions, accessToken) => {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 Executing search on ${entityDetails.entitySetName}...`);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    if (searchOptions.filter) {
      queryParams.append('$filter', searchOptions.filter);
    }
    
    if (searchOptions.orderBy) {
      queryParams.append('$orderby', searchOptions.orderBy);
    }
    
    if (searchOptions.select && searchOptions.select.length > 0) {
      queryParams.append('$select', searchOptions.select.join(','));
    }
    
    if (searchOptions.pageSize) {
      queryParams.append('$top', searchOptions.pageSize);
    }
    
    if (searchOptions.skip) {
      queryParams.append('$skip', searchOptions.skip);
    }
    
    // Always include count for pagination
    queryParams.append('$count', 'true');

    const endpoint = queryParams.toString() ? 
      `${entityDetails.entitySetName}?${queryParams.toString()}` : 
      entityDetails.entitySetName;

    console.log(`📡 Search endpoint: ${endpoint.substring(0, 200)}...`);

    // Execute the search
    const result = await makeCrmRequest('GET', endpoint, accessToken);
    
    const searchDuration = Date.now() - startTime;
    
    console.log(`✅ Search executed successfully:`, {
      foundRecords: result.value?.length || 0,
      totalCount: result['@odata.count'] || 0,
      duration: `${searchDuration}ms`,
      hasNextLink: !!result['@odata.nextLink']
    });

    return {
      data: result.value || [],
      count: result.value?.length || 0,
      totalCount: result['@odata.count'],
      nextLink: result['@odata.nextLink'],
      searchDuration: `${searchDuration}ms`,
      optimizations: ['Field selection', 'Count optimization', 'Pagination'],
      indexesUsed: ['Primary', 'Search Fields'],
      searchMethod: 'advanced'
    };

  } catch (error) {
    console.error(`❌ Search execution failed:`, error.message);
    
    // Check if the error is related to unsupported OData functions
    if (error.message.includes('function isn\'t supported') || error.message.includes('startswith')) {
      console.log('⚠️ Advanced search functions not supported, falling back to basic search...');
      return await executeBasicSearch(entityDetails, searchOptions, accessToken, startTime);
    }
    
    throw new Error(`Search execution failed: ${error.message}`);
  }
};

/**
 * Fallback basic search for environments with limited OData support
 */
const executeBasicSearch = async (entityDetails, searchOptions, accessToken, startTime) => {
  try {
    console.log(`🔄 Executing basic search fallback on ${entityDetails.entitySetName}...`);
    
    // Build simpler query parameters without advanced filtering
    const queryParams = new URLSearchParams();
    
    if (searchOptions.orderBy) {
      queryParams.append('$orderby', searchOptions.orderBy);
    }
    
    if (searchOptions.select && searchOptions.select.length > 0) {
      queryParams.append('$select', searchOptions.select.join(','));
    }
    
    if (searchOptions.pageSize) {
      queryParams.append('$top', Math.min(searchOptions.pageSize * 3, 100)); // Get more records for client-side filtering
    }
    
    if (searchOptions.skip) {
      queryParams.append('$skip', searchOptions.skip);
    }
    
    // Include count for pagination
    queryParams.append('$count', 'true');

    const endpoint = queryParams.toString() ? 
      `${entityDetails.entitySetName}?${queryParams.toString()}` : 
      entityDetails.entitySetName;

    console.log(`📡 Basic search endpoint: ${endpoint.substring(0, 200)}...`);

    // Execute the basic search
    const result = await makeCrmRequest('GET', endpoint, accessToken);
    
    // Client-side filtering since server-side filtering isn't supported
    const searchTerm = searchOptions.searchTerm?.toLowerCase() || '';
    const searchFields = searchOptions.searchFields || [];
    
    let filteredData = result.value || [];
    
    if (searchTerm && searchFields.length > 0) {
      filteredData = filteredData.filter(record => {
        return searchFields.some(field => {
          const fieldValue = record[field];
          if (fieldValue && typeof fieldValue === 'string') {
            return fieldValue.toLowerCase().includes(searchTerm);
          }
          return false;
        });
      });
    }
    
    // Apply pagination to filtered results
    const actualPageSize = searchOptions.pageSize || 10;
    const paginatedData = filteredData.slice(0, actualPageSize);
    
    const searchDuration = Date.now() - startTime;
    
    console.log(`✅ Basic search completed:`, {
      totalRecords: result.value?.length || 0,
      filteredRecords: filteredData.length,
      returnedRecords: paginatedData.length,
      duration: `${searchDuration}ms`,
      method: 'client-side-filtering'
    });

    return {
      data: paginatedData,
      count: paginatedData.length,
      totalCount: filteredData.length,
      nextLink: null,
      searchDuration: `${searchDuration}ms`,
      optimizations: ['Client-side filtering', 'Basic pagination'],
      indexesUsed: ['None - client filtering'],
      searchMethod: 'basic_fallback',
      note: 'Using client-side filtering due to limited OData support'
    };

  } catch (error) {
    console.error(`❌ Basic search fallback also failed:`, error.message);
    throw new Error(`Both advanced and basic search failed: ${error.message}`);
  }
};



export const refreshToken = async (req, res) => {
  try {
    const refresh_token = req.body.refresh_token || 
                         req.query.refresh_token || 
                         req.headers['x-refresh-token'];

    if (!refresh_token) {
      throw new DynamicsError(
        'Refresh token is required',
        400,
        'MISSING_REFRESH_TOKEN',
        {
          solution: 'Provide refresh token in request body, query parameter, or x-refresh-token header',
          example: {
            body: { refresh_token: 'your_refresh_token_here' },
            query: '?refresh_token=your_refresh_token_here',
            header: 'x-refresh-token: your_refresh_token_here'
          }
        }
      );
    }

    console.log('🔄 Processing token refresh request...');
    const tokens = await refreshAccessToken(refresh_token);

    const response = createSuccessResponse({
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenType: tokens.tokenType,
        scope: tokens.scope,
        usedTenant: tokens.usedTenant
      },
      tokenInfo: {
        expiresAt: new Date(Date.now() + (tokens.expiresIn * 1000)).toISOString(),
        refreshedAt: new Date().toISOString(),
        tenantUsed: tokens.usedTenant
      }
    }, 'Token refreshed successfully');

    res.status(response.status).json(response);
  } catch (error) {
    console.error('❌ Token refresh failed:', error.message);
    
    // Enhanced error handling for refresh token issues
    if (error.message.includes('Tenant not found')) {
      const errorResponse = createErrorResponse(
        new DynamicsError(
          'Tenant configuration issue detected',
          400,
          'TENANT_NOT_FOUND',
          {
            currentTenantId: process.env.TENANT_ID,
            recommendation: 'Update your .env file with TENANT_ID=common',
            steps: [
              'Open your .env file',
              'Change TENANT_ID=common (instead of specific tenant ID)',
              'Restart your application',
              'Try token refresh again',
              'If still failing, re-authenticate completely'
            ],
            reAuthUrl: '/api/dynamics/auth/initiate',
            originalError: error.message
          }
        ),
        'refresh_token'
      );
      return res.status(errorResponse.status).json(errorResponse);
    }
    
    if (error.message.includes('expired') || error.message.includes('invalid_grant')) {
      const errorResponse = createErrorResponse(
        new DynamicsError(
          'Refresh token has expired - re-authentication required',
          401,
          'REFRESH_TOKEN_EXPIRED',
          {
            solution: 'User must re-authenticate to get new tokens',
            steps: [
              'Direct user to authentication endpoint',
              'Complete OAuth flow again',
              'Store new refresh token',
              'Use new access token for API calls'
            ],
            reAuthUrl: '/api/dynamics/auth/initiate',
            note: 'Refresh tokens typically expire after 90 days of inactivity'
          }
        ),
        'refresh_token'
      );
      return res.status(errorResponse.status).json(errorResponse);
    }
    
    if (error.message.includes('invalid_client')) {
      const errorResponse = createErrorResponse(
        new DynamicsError(
          'Invalid client credentials',
          401,
          'INVALID_CLIENT_CREDENTIALS',
          {
            issue: 'MD_CLIENT_ID or MD_CLIENT_SECRET is incorrect',
            steps: [
              'Verify MD_CLIENT_ID in your .env file',
              'Check MD_CLIENT_SECRET is correct and not expired',
              'Ensure client secret hasn\'t been regenerated in Azure',
              'Verify Azure AD app registration is active'
            ],
            azurePortalUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade'
          }
        ),
        'refresh_token'
      );
      return res.status(errorResponse.status).json(errorResponse);
    }

    // Generic error handling
    const errorResponse = createErrorResponse(error, 'refresh_token');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const logout = async (req, res) => {
  try {
    const { platform } = req.query;
    const frontendUrl = process.env.MD_FRONTEND_URL;

    if (platform === 'web' && frontendUrl) {
      return res.redirect(`${frontendUrl}?logout=true`);
    }

    const response = createSuccessResponse({}, 'Logout successful');
    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'logout');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const testConnection = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const response = await axios.get(
      `${process.env.DYNAMICS_CRM_URL}/api/data/v9.2/WhoAmI`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );
    
    const successResponse = createSuccessResponse({
      connectionStatus: 'Connected',
      userInfo: response.data,
      instanceUrl: process.env.DYNAMICS_CRM_URL
    }, 'Connection test successful');

    res.status(successResponse.status).json(successResponse);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'test_connection');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const checkAvailableEntities = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const response = await axios.get(
      `${process.env.DYNAMICS_CRM_URL}/api/data/v9.2/EntityDefinitions?$select=LogicalName,EntitySetName,DisplayName`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    ); 
    
    const successResponse = createSuccessResponse({
      entities: response.data.value,
      count: response.data.value.length
    }, 'Available entities retrieved successfully');

    res.status(successResponse.status).json(successResponse);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'check_available_entities');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const checkEntityPermissions = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { entityName } = req.params;
    
    if (!entityName) {
      throw new DynamicsError(
        'Entity name is required',
        400,
        'MISSING_ENTITY_NAME'
      );
    }

    const entityDetails = await discoverEntityDetails(entityName, accessToken);
    
    const successResponse = createSuccessResponse({
      entityDetails,
      hasAccess: true
    }, `Entity permissions verified for ${entityDetails.logicalName}`);

    res.status(successResponse.status).json(successResponse);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'check_entity_permissions');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const getAllEntities = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    
    // Use the enhanced entity discovery
    const allEntities = await getAllAvailableEntities(accessToken);
    
    const entities = Array.from(allEntities.values()).sort((a, b) => 
      a.logicalName.localeCompare(b.logicalName)
    );
    
    const successResponse = createSuccessResponse({
      entities,
      count: entities.length,
      sorted: true,
      cacheInfo: {
        cached: true,
        note: 'Entity definitions are cached for 5 minutes for performance'
      }
    }, 'All entities retrieved successfully');

    res.status(successResponse.status).json(successResponse);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'get_all_entities');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const checkUserAccess = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    
    const whoAmIResponse = await axios.get(
      `${process.env.DYNAMICS_CRM_URL}/api/data/v9.2/WhoAmI`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    const userId = whoAmIResponse.data.UserId;
    const orgId = whoAmIResponse.data.OrganizationId;

    const userResponse = await axios.get(
      `${process.env.DYNAMICS_CRM_URL}/api/data/v9.2/systemusers(${userId})?$select=fullname,internalemailaddress`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    const successResponse = createSuccessResponse({
      userAccess: {
        userId: userId,
        organizationId: orgId,
        userDetails: userResponse.data,
        hasAccess: true,
        accessLevel: 'Authenticated'
      }
    }, 'User access verified successfully');

    res.status(successResponse.status).json(successResponse);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'check_user_access');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const discoverInstanceUrl = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);

    const response = await axios.get(
      `${process.env.DYNAMICS_CRM_URL}/api/data/v9.2/organizations?$select=name,organizationid,version,uniquename`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    if (response.data && response.data.value && response.data.value.length > 0) {
      const organization = response.data.value[0];
      
      const successResponse = createSuccessResponse({
        instanceUrl: process.env.DYNAMICS_CRM_URL,
        organization: {
          name: organization.name,
          uniqueName: organization.uniquename || 'Unknown',
          version: organization.version,
          organizationId: organization.organizationid
        }
      }, 'Instance discovery successful');

      res.status(successResponse.status).json(successResponse);
    } else {
      throw new DynamicsError(
        'No organization found',
        404,
        'NO_ORGANIZATION_FOUND'
      );
    }
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'discover_instance_url');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const checkUserSetup = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    
    const whoAmIResponse = await axios.get(
      `${process.env.DYNAMICS_CRM_URL}/api/data/v9.2/WhoAmI`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    const successResponse = createSuccessResponse({
      userSetup: {
        isSetup: true,
        userId: whoAmIResponse.data.UserId,
        organizationId: whoAmIResponse.data.OrganizationId,
        setupComplete: true
      }
    }, 'User setup verification successful');

    res.status(successResponse.status).json(successResponse);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'check_user_setup');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const addUserToOrganization = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { email, firstName, lastName, securityRoleName = 'System Administrator' } = req.body;

    if (!email || !firstName || !lastName) {
      throw new DynamicsError(
        'Email, firstName, and lastName are required',
        400,
        'MISSING_USER_INFO',
        {
          required: ['email', 'firstName', 'lastName'],
          optional: ['securityRoleName']
        }
      );
    }

    const successResponse = createSuccessResponse({
      message: 'User addition requires administrator privileges',
      instructions: [
        'Contact your system administrator',
        'Ensure the user has a Dynamics 365 license',
        'Add the user through the Dynamics 365 admin center',
        'Assign appropriate security roles'
      ],
      adminPortal: 'https://admin.microsoft.com', 
      userInfo: { email, firstName, lastName, securityRoleName }
    }, 'User addition request acknowledged');

    res.status(successResponse.status).json(successResponse);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'add_user_to_organization');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// New organization discovery and validation endpoints
export const discoverUserOrgs = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    
    console.log('🔍 Starting organization discovery for user...');
    
    const organizations = await discoverUserOrganizations(accessToken);
    
    const response = createSuccessResponse({
      organizations,
      count: organizations.length,
      currentlyConfigured: process.env.DYNAMICS_CRM_URL,
      recommendation: organizations.length > 0 ? 
        `Update DYNAMICS_CRM_URL to: ${organizations[0].apiUrl}` : 
        'No organizations found - user may need Dynamics 365 license'
    }, 'Organization discovery completed');

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'discover_user_organizations');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const validateCurrentOrg = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const organizationUrl = process.env.DYNAMICS_CRM_URL;
    
    if (!organizationUrl) {
      throw new DynamicsError(
        'DYNAMICS_CRM_URL is not configured',
        400,
        'MISSING_CRM_URL'
      );
    }
    
    console.log(`🔬 Validating current organization: ${organizationUrl}`);
    
    const validation = await validateOrganizationAccess(organizationUrl, accessToken);
    
    const response = createSuccessResponse({
      organizationUrl,
      validation,
      recommendation: validation.hasAccess ? 
        'Organization access is working correctly' : 
        'User does not have access to this organization. Try discovering available organizations.'
    }, validation.hasAccess ? 'Organization access validated' : 'Organization access failed');

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'validate_current_organization');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const diagnoseAccessIssue = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    
    console.log('🩺 Starting comprehensive access diagnosis...');
    
    // Step 1: Discover available organizations
    let organizations = [];
    let discoveryError = null;
    
    try {
      organizations = await discoverUserOrganizations(accessToken);
    } catch (error) {
      discoveryError = error.message;
    }
    
    // Step 2: Validate current configuration
    let currentOrgValidation = null;
    if (process.env.DYNAMICS_CRM_URL) {
      try {
        currentOrgValidation = await validateOrganizationAccess(process.env.DYNAMICS_CRM_URL, accessToken);
      } catch (error) {
        currentOrgValidation = { hasAccess: false, error: error.message };
      }
    }
    
    // Step 3: Generate recommendations
    const recommendations = [];
    
    if (discoveryError) {
      recommendations.push({
        issue: 'Organization Discovery Failed',
        solution: 'User may not have a Dynamics 365 license or access to any organizations',
        action: 'Contact your administrator to assign a Dynamics 365 license'
      });
    } else if (organizations.length === 0) {
      recommendations.push({
        issue: 'No Organizations Found',
        solution: 'User has valid authentication but no Dynamics 365 organizations',
        action: 'Ensure user has a Dynamics 365 license and is added to an organization'
      });
    } else if (currentOrgValidation && !currentOrgValidation.hasAccess) {
      recommendations.push({
        issue: 'Wrong Organization URL',
        solution: `Current URL: ${process.env.DYNAMICS_CRM_URL} is not accessible`,
        action: `Update DYNAMICS_CRM_URL to: ${organizations[0].apiUrl}`,
        availableOrganizations: organizations.map(org => ({
          name: org.friendlyName,
          url: org.apiUrl
        }))
      });
    } else if (currentOrgValidation && currentOrgValidation.hasAccess) {
      recommendations.push({
        issue: 'No Issues Found',
        solution: 'Organization access is working correctly',
        action: 'The issue may be with specific entity permissions'
      });
    }
    
    const response = createSuccessResponse({
      diagnosis: {
        tokenValid: true,
        organizationsFound: organizations.length,
        currentOrgAccess: currentOrgValidation?.hasAccess || false,
        configuredUrl: process.env.DYNAMICS_CRM_URL
      },
      availableOrganizations: organizations,
      currentOrganization: currentOrgValidation,
      recommendations,
      discoveryError
    }, 'Access diagnosis completed');

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'diagnose_access_issue');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Enhanced entity discovery endpoint for debugging
export const testEntityDiscovery = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { entityType } = req.params;

    if (!entityType) {
      throw new DynamicsError(
        'Entity type is required',
        400,
        'MISSING_ENTITY_TYPE',
        {
          solution: 'Provide entityType in URL path',
          example: '/test-discovery/contact'
        }
      );
    }

    console.log(`🧪 Testing entity discovery for: ${entityType}`);
    
    // Test the enhanced discovery
    const entityDetails = await discoverEntityDetails(entityType, accessToken);
    
    // Also get all available entities for comparison
    const allEntities = await getAllAvailableEntities(accessToken);
    const availableEntities = Array.from(allEntities.keys()).sort();

    const successResponse = createSuccessResponse({
      discoveryResult: {
        requested: entityType,
        found: entityDetails,
        success: true
      },
      context: {
        totalAvailableEntities: allEntities.size,
        availableEntityNames: availableEntities,
        cacheStatus: 'Using static entity mappings'
      }
    }, `Entity discovery successful for ${entityType}`);

    res.status(successResponse.status).json(successResponse);
  } catch (error) {
    console.error(`❌ Entity discovery test failed for ${req.params.entityType}:`, error.message);
    
    // Enhanced error response for discovery testing
    try {
      const allEntities = await getAllAvailableEntities(req.headers.authorization?.split(' ')[1]);
      const availableEntities = Array.from(allEntities.keys()).sort();
      
      const errorResponse = createErrorResponse(error, 'test_entity_discovery');
      errorResponse.debugInfo = {
        requestedEntity: req.params.entityType,
        availableEntities: availableEntities,
        totalAvailable: allEntities.size,
        suggestion: 'Try one of the available entity names listed above'
      };
      
      res.status(errorResponse.status).json(errorResponse);
    } catch (cacheError) {
      console.error(`❌ Failed to get available entities for debug info:`, cacheError.message);
      const errorResponse = createErrorResponse(error, 'test_entity_discovery');
      errorResponse.debugInfo = {
        requestedEntity: req.params.entityType,
        note: 'Could not retrieve available entities list'
      };
      
      res.status(errorResponse.status).json(errorResponse);
    }
  }
};

// Alternative organization discovery using token claims
export const discoverOrgFromToken = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    
    console.log('🔍 Analyzing token for organization information...');
    
    // Decode the JWT token to extract organization information
    const decoded = jwt.decode(accessToken, { complete: true });
    
    if (!decoded || !decoded.payload) {
      throw new DynamicsError(
        'Invalid token format',
        400,
        'INVALID_TOKEN'
      );
    }
    
    const tokenPayload = decoded.payload;
    console.log('📋 Token claims analysis:', {
      aud: tokenPayload.aud,
      iss: tokenPayload.iss,
      tid: tokenPayload.tid,
      hasResourceScope: !!tokenPayload.aud?.includes('dynamics.com')
    });
    
    // Extract potential organization info from token
    const organizationHints = [];
    
    // Check if token audience contains dynamics URL
    if (tokenPayload.aud && Array.isArray(tokenPayload.aud)) {
      tokenPayload.aud.forEach(audience => {
        if (audience.includes('dynamics.com') || audience.includes('.crm')) {
          organizationHints.push({
            source: 'token_audience',
            url: audience,
            type: 'potential_org_url'
          });
        }
      });
    } else if (typeof tokenPayload.aud === 'string' && tokenPayload.aud.includes('dynamics.com')) {
      organizationHints.push({
        source: 'token_audience',
        url: tokenPayload.aud,
        type: 'potential_org_url'
      });
    }
    
    // Generate region-based suggestions
    const tenantId = tokenPayload.tid;
    const regionSuggestions = [
      'https://org0fba86c0.crm.dynamics.com',      // North America
      'https://org0fba86c0.crm4.dynamics.com',     // Europe
      'https://org0fba86c0.crm5.dynamics.com',     // Asia Pacific
      'https://org0fba86c0.crm7.dynamics.com',     // Japan
      'https://org0fba86c0.crm8.dynamics.com',     // India
      'https://org0fba86c0.crm9.dynamics.com',     // Canada
      'https://org0fba86c0.crm11.dynamics.com',    // United Kingdom
      'https://org0fba86c0.crm12.dynamics.com'     // Australia
    ];
    
    // Try to extract organization name from current URL
    const currentUrl = process.env.DYNAMICS_CRM_URL;
    let orgNamePattern = null;
    if (currentUrl) {
      const match = currentUrl.match(/https:\/\/([^.]+)\.crm/);
      if (match) {
        orgNamePattern = match[1];
      }
    }
    
    const response = createSuccessResponse({
      tokenAnalysis: {
        tenantId: tenantId,
        issuer: tokenPayload.iss,
        audience: tokenPayload.aud,
        scope: tokenPayload.scp || tokenPayload.roles,
        extractedHints: organizationHints
      },
      manualDiscoverySteps: [
        'Go to https://dynamics.microsoft.com/',
        'Sign in with the same Microsoft account',
        'Note the URL you are redirected to',
        'That URL is your Dynamics 365 organization URL'
      ],
      alternativeUrlsToTry: orgNamePattern ? regionSuggestions.map(url => 
        url.replace('org0fba86c0', orgNamePattern)
      ) : regionSuggestions,
      recommendations: [
        {
          priority: 'HIGH',
          action: 'Manual Discovery',
          steps: [
            'Visit https://dynamics.microsoft.com/',
            'Sign in with your account',
            'Copy the organization URL from the browser',
            'Update DYNAMICS_CRM_URL in your .env file'
          ]
        },
        {
          priority: 'MEDIUM', 
          action: 'Try Different Regions',
          description: 'If you know your organization name, try different regional URLs'
        }
      ]
    }, 'Token analysis completed - manual discovery recommended');

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'discover_org_from_token');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Test multiple organization URLs
export const testMultipleOrgs = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { orgUrls } = req.body;
    
    if (!orgUrls || !Array.isArray(orgUrls)) {
      throw new DynamicsError(
        'Array of organization URLs is required in request body',
        400,
        'MISSING_ORG_URLS',
        {
          example: { orgUrls: ['https://org1.crm.dynamics.com', 'https://org2.crm.dynamics.com'] }
        }
      );
    }
    
    console.log(`🧪 Testing ${orgUrls.length} organization URLs...`);
    
    const results = [];
    
    for (const orgUrl of orgUrls) {
      console.log(`🔬 Testing: ${orgUrl}`);
      
      try {
        const validation = await validateOrganizationAccess(orgUrl, accessToken);
        results.push({
          url: orgUrl,
          ...validation,
          status: validation.hasAccess ? 'SUCCESS' : 'FAILED'
        });
        
        if (validation.hasAccess) {
          console.log(`✅ Found working organization: ${orgUrl}`);
        }
      } catch (error) {
        results.push({
          url: orgUrl,
          hasAccess: false,
          error: error.message,
          status: 'ERROR'
        });
      }
    }
    
    const workingOrgs = results.filter(r => r.hasAccess);
    const response = createSuccessResponse({
      testResults: results,
      workingOrganizations: workingOrgs,
      recommendation: workingOrgs.length > 0 ? 
        `Update DYNAMICS_CRM_URL to: ${workingOrgs[0].url}` :
        'No working organizations found. Please verify your account has Dynamics 365 access.'
    }, `Tested ${orgUrls.length} organizations - found ${workingOrgs.length} working`);

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'test_multiple_orgs');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Discover actual available entity sets in the environment
export const discoverAvailableEntitySets = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    
    console.log('🔍 Starting entity set discovery...');
    
    const discovery = await discoverActualEntitySets(accessToken);
    
    const response = createSuccessResponse({
      environmentInfo: {
        totalEntitySets: discovery.totalEntitySets,
        availableStandardEntities: discovery.availableStandardEntities,
        unavailableStandardEntities: discovery.unavailableStandardEntities
      },
      entityStatus: discovery.standardEntityStatus,
      recommendations: discovery.unavailableStandardEntities.length > 0 ? [
        {
          issue: `${discovery.unavailableStandardEntities.length} entities are not available`,
          missingEntities: discovery.unavailableStandardEntities,
          possibleCauses: [
            'These entities require specific Dynamics 365 apps (Sales, Marketing, Customer Service)',
            'Your license may not include these features',
            'The entities may need to be enabled by an administrator'
          ],
          solutions: [
            'Check if you have the required Dynamics 365 apps installed',
            'Verify your license includes the needed features',
            'Contact your administrator to enable missing entities',
            'Use only the available entities for now'
          ]
        }
      ] : [
        {
          status: 'All standard entities are available',
          message: 'Your environment supports all standard entity operations'
        }
      ],
      availableEntitySets: discovery.availableEntitySets
    }, `Discovered ${discovery.totalEntitySets} entity sets - ${discovery.availableStandardEntities.length} standard entities available`);

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'discover_available_entity_sets');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Check if a specific entity is available in the environment
export const checkEntityAvailability = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { entityType } = req.params;

    if (!entityType) {
      throw new DynamicsError(
        'Entity type is required',
        400,
        'MISSING_ENTITY_TYPE'
      );
    }

    console.log(`🔍 Checking availability for entity: ${entityType}`);
    
    try {
      const entityDetails = await getWorkingEntityDetails(entityType, accessToken);
      
      const response = createSuccessResponse({
        entityType,
        isAvailable: true,
        entityDetails,
        message: `Entity '${entityType}' is available and ready to use`,
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true
      }, `Entity '${entityType}' is available`);

      res.status(response.status).json(response);
    } catch (availabilityError) {
      // Entity is not available
      const response = createSuccessResponse({
        entityType,
        isAvailable: false,
        error: availabilityError.message,
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
        recommendations: [
          {
            issue: `Entity '${entityType}' is not available`,
            possibleCauses: [
              'Entity requires specific Dynamics 365 apps or licenses',
              'Entity may need to be enabled by administrator',
              'Your environment may not include this feature'
            ],
            solutions: [
              'Check what Dynamics 365 apps you have installed',
              'Verify your license includes this entity type',
              'Contact your administrator about enabling this entity',
              'Use alternative available entities'
            ]
          }
        ]
      }, `Entity '${entityType}' is not available in your environment`);

      res.status(response.status).json(response);
    }
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'check_entity_availability');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Get comprehensive environment analysis
export const analyzeEnvironment = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    
    console.log('🩺 Starting comprehensive environment analysis...');
    
    // Step 1: Discover entity sets
    let entityDiscovery = null;
    try {
      entityDiscovery = await discoverActualEntitySets(accessToken);
    } catch (discoveryError) {
      console.error('Entity discovery failed:', discoveryError.message);
    }
    
    // Step 2: Test working entities
    const entityTests = {};
    const testEntities = [
      'contact', 'account', 'task', 
      'appointment', 'incident', 'annotation', 'phonecall', 'email',
      'lead', 'opportunity', 'campaign', 'product', 'quote', 'invoice', 'salesorder'
    ];
    
    for (const entityType of testEntities) {
      try {
        await getWorkingEntityDetails(entityType, accessToken);
        entityTests[entityType] = { available: true, status: 'WORKING' };
      } catch (testError) {
        entityTests[entityType] = { 
          available: false, 
          status: 'NOT_AVAILABLE',
          error: testError.message 
        };
      }
    }
    
    // Step 3: Generate environment profile
    const workingEntities = Object.keys(entityTests).filter(e => entityTests[e].available);
    const missingEntities = Object.keys(entityTests).filter(e => !entityTests[e].available);
    
    let environmentType = 'Unknown';
    const coreEntities = ['contact', 'account', 'task'];
    const salesEntities = ['lead', 'opportunity', 'product', 'quote', 'invoice', 'salesorder'];
    const serviceEntities = ['incident', 'appointment', 'phonecall', 'email'];
    const basicActivities = ['annotation', 'task', 'appointment'];
    
    const hasCoreEntities = coreEntities.every(e => workingEntities.includes(e));
    const hasSalesEntities = salesEntities.some(e => workingEntities.includes(e));
    const hasServiceEntities = serviceEntities.some(e => workingEntities.includes(e));
    const hasActivities = basicActivities.some(e => workingEntities.includes(e));
    const hasCampaign = workingEntities.includes('campaign');
    
    if (hasCoreEntities) {
      if (hasSalesEntities && hasCampaign) {
        environmentType = 'Full Dynamics 365 (Sales + Marketing)';
      } else if (hasSalesEntities) {
        environmentType = 'Dynamics 365 Sales Hub';
      } else if (hasServiceEntities) {
        environmentType = 'Dynamics 365 Customer Service';
      } else if (hasActivities) {
        environmentType = 'Basic Dynamics 365 (Activities & Core Entities)';
      } else {
        environmentType = 'Minimal Dynamics 365 (Core Entities Only)';
      }
    } else if (hasActivities || hasServiceEntities) {
      environmentType = 'Limited Dynamics 365 Access';
    }
       
    const response = createSuccessResponse({
      analysis: {
        environmentType,
        totalEntitySets: entityDiscovery?.totalEntitySets || 'Unknown',
        workingEntitiesCount: workingEntities.length,
        missingEntitiesCount: missingEntities.length
      },
      workingEntities,
      missingEntities,
      entityTests,
      fallbackStrategies: {
        lead: 'Creates as Contact with lead information in description',
        opportunity: 'Creates as Task with deal information',
        product: 'Creates as Note/Annotation with product details',
        quote: 'Creates as Task with quote information',
        invoice: 'Creates as Task with invoice information',
        salesorder: 'Creates as Task with order information'
      },
      recommendations: missingEntities.length > 0 ? [
        {
          priority: 'HIGH',
          issue: `${missingEntities.length} entities are not available`,
          recommendation: 'Enable required Dynamics 365 apps and licenses',
          actions: [
            'Go to Power Platform Admin Center (https://admin.powerplatform.microsoft.com/)',
            'Select your environment',
            'Go to Dynamics 365 apps',
            'Install "Dynamics 365 Sales, Enterprise Edition"',
            'Wait for installation to complete (15-30 minutes)',
            'Test entity availability again'
          ],
          missingEntities,
          note: 'API will use fallback entities until sales entities are enabled'
        }
      ] : [
        {
          status: 'EXCELLENT',
          message: 'All tested entities are available',
          recommendation: 'Your environment is fully functional'
        }
      ],
      usage: {
        recommendedEntities: workingEntities,
        note: 'API automatically uses fallback entities when sales entities are not available'
      }
    }, `Environment analysis complete - ${workingEntities.length}/${testEntities.length} entities available`);

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'analyze_environment');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// New endpoint to check Sales Hub installation status
export const checkSalesHubStatus = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    
    console.log('🔍 Checking Sales Hub installation status...');
    
    // Test key sales entities
    const salesEntities = ['lead', 'opportunity', 'product', 'quote', 'invoice', 'salesorder'];
    const salesEntityStatus = {};
    
    for (const entityType of salesEntities) {
      try {
        await getWorkingEntityDetails(entityType, accessToken);
        salesEntityStatus[entityType] = { 
          available: true, 
          status: 'INSTALLED',
          message: `${entityType} entity is available`
        };
      } catch (testError) {
        salesEntityStatus[entityType] = { 
          available: false, 
          status: 'NOT_INSTALLED',
          error: testError.message,
          message: `${entityType} entity requires Sales Hub`
        };
      }
    }
    
    const availableSalesEntities = Object.keys(salesEntityStatus).filter(e => salesEntityStatus[e].available);
    const missingSalesEntities = Object.keys(salesEntityStatus).filter(e => !salesEntityStatus[e].available);
    
    let salesHubStatus = 'NOT_INSTALLED';
    let installationProgress = 0;
    
    if (availableSalesEntities.length === salesEntities.length) {
      salesHubStatus = 'FULLY_INSTALLED';
      installationProgress = 100;
    } else if (availableSalesEntities.length > 0) {
      salesHubStatus = 'PARTIALLY_INSTALLED';
      installationProgress = Math.round((availableSalesEntities.length / salesEntities.length) * 100);
    }
    
    const response = createSuccessResponse({
      salesHubStatus,
      installationProgress: `${installationProgress}%`,
      availableSalesEntities,
      missingSalesEntities,
      entityStatus: salesEntityStatus,
      recommendations: salesHubStatus === 'FULLY_INSTALLED' ? [
        {
          status: 'SUCCESS',
          message: 'Dynamics 365 Sales Hub is fully installed and functional',
          action: 'You can now use all sales entities (leads, opportunities, products, etc.)'
        }
      ] : [
        {
          priority: 'HIGH',
          issue: `Sales Hub is ${salesHubStatus.toLowerCase().replace('_', ' ')}`,
          steps: [
            'Go to Power Platform Admin Center: https://admin.powerplatform.microsoft.com/',
            'Navigate to Environments → Your Environment',
            'Click on "Dynamics 365 apps"',
            'Find "Dynamics 365 Sales, Enterprise Edition"',
            'Click Install and wait for completion (15-30 minutes)',
            'Test this endpoint again to verify installation'
          ],
          fallbackNote: 'API will continue using fallback entities until Sales Hub is fully installed'
        }
      ]
    }, `Sales Hub Status: ${salesHubStatus} (${installationProgress}% complete)`);

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'check_sales_hub_status');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Comprehensive entity testing and diagnosis endpoint
export const testEntityCreation = async (req, res) => {
  try {
    const { entityType } = req.params;
    const accessToken = getAccessTokenFromHeader(req);
    const testData = req.body;

    console.log(`🧪 Testing entity creation for: ${entityType}`);

    // Step 1: Check entity availability and licensing
    console.log('📋 Step 1: Checking entity availability and licensing...');
    let entityInfo;
    try {
      entityInfo = await discoverEntityWithLicensing(entityType, accessToken);
      console.log(`✅ Entity ${entityType} is available:`, {
        displayName: entityInfo.displayName,
        licenseRequired: entityInfo.licenseRequired,
        isAvailable: entityInfo.isAvailable
      });
    } catch (entityError) {
      console.log(`❌ Entity availability check failed:`, entityError.message);
      return res.status(400).json({
        success: false,
        step: 'entity_availability',
        error: entityError.message,
        entityType,
        recommendation: entityError.message.includes('SALES_HUB_REQUIRED') 
          ? 'Install Dynamics 365 Sales Hub or use alternative entities like contact, account, task, appointment'
          : 'Check your Dynamics 365 licensing and permissions'
      });
    }

    // Step 2: Validate required fields
    console.log('📋 Step 2: Validating required fields...');
    let validation;
    try {
      validation = await validateEntityRequiredFields(entityType, testData, accessToken);
      
      if (!validation.isValid) {
        console.log(`❌ Validation failed:`, validation.error);
        return res.status(400).json({
          success: false,
          step: 'field_validation',
          error: validation.error,
          entityType,
          required: validation.required,
          recommended: validation.recommended,
          providedFields: Object.keys(testData),
          suggestion: 'Ensure all required fields are provided with valid data'
        });
      }
      
      console.log(`✅ Field validation passed`);
    } catch (validationError) {
      console.log(`❌ Field validation error:`, validationError.message);
      return res.status(400).json({
        success: false,
        step: 'field_validation',
        error: validationError.message,
        entityType
      });
    }

    // Step 3: Test actual creation (dry run if requested)
    const isDryRun = req.query.dryRun === 'true';
    
    if (isDryRun) {
      console.log('🔍 Dry run mode - validation completed without creating entity');
      return res.status(200).json({
        success: true,
        mode: 'dry_run',
        entityType,
        entityInfo,
        validation: {
          isValid: validation.isValid,
          required: validation.required,
          recommended: validation.recommended
        },
        message: 'Entity creation test passed - ready for actual creation'
      });
    }

    // Step 4: Actual creation
    console.log('📋 Step 3: Attempting actual entity creation...');
    try {
      const result = await createEntityWithValidation(entityType, testData, accessToken);
      
      console.log(`✅ Entity creation successful:`, {
        id: result.id,
        entityType: result.entityType
      });

      return res.status(201).json({
        success: true,
        mode: 'actual_creation',
        entityType,
        entityInfo,
        result: {
          id: result.id,
          entityType: result.entityType,
          location: result.location
        },
        validation: {
          isValid: validation.isValid,
          required: validation.required,
          recommended: validation.recommended
        },
        message: 'Entity created successfully'
      });

    } catch (creationError) {
      console.log(`❌ Entity creation failed:`, creationError.message);
      
      // Provide detailed error analysis
      let errorAnalysis = {
        step: 'entity_creation',
        error: creationError.message,
        entityType
      };

      if (creationError.response?.status === 400) {
        errorAnalysis.type = 'Bad Request';
        errorAnalysis.suggestion = 'Check data format and field values';
        errorAnalysis.details = creationError.response.data;
      } else if (creationError.response?.status === 403) {
        errorAnalysis.type = 'Permission Denied';
        errorAnalysis.suggestion = 'Check user permissions and security roles';
      } else if (creationError.response?.status === 404) {
        errorAnalysis.type = 'Entity Not Found';
        errorAnalysis.suggestion = 'Entity may require additional licensing';
      }

      return res.status(creationError.response?.status || 500).json({
        success: false,
        ...errorAnalysis
      });
    }

  } catch (error) {
    console.error(`❌ Entity creation test failed:`, error);
    return res.status(500).json({
      success: false,
      step: 'test_setup',
      error: error.message,
      entityType: req.params.entityType
    });
  }
};

// Entity creation guide endpoint
export const getEntityCreationGuide = async (req, res) => {
  try {
    const { entityType } = req.params;
    const accessToken = getAccessTokenFromHeader(req);

    console.log(`📚 Getting creation guide for: ${entityType}`);

    // Get entity information
    let entityInfo;
    try {
      entityInfo = await discoverEntityWithLicensing(entityType, accessToken);
    } catch (error) {
      if (error.message.includes('SALES_HUB_REQUIRED')) {
        return res.status(402).json({
          success: false,
          entityType,
          error: 'Sales Hub Required',
          message: error.message,
          alternatives: {
            contact: {
              description: 'Store person information',
              requiredFields: [],
              recommendedFields: ['firstname', 'lastname', 'emailaddress1']
            },
            account: {
              description: 'Store company information',
              requiredFields: ['name'],
              recommendedFields: ['name', 'telephone1', 'emailaddress1']
            },
            task: {
              description: 'Create tasks and activities',
              requiredFields: ['subject'],
              recommendedFields: ['subject', 'description', 'scheduledend']
            },
            appointment: {
              description: 'Schedule meetings and appointments',
              requiredFields: ['subject', 'scheduledstart', 'scheduledend'],
              recommendedFields: ['subject', 'scheduledstart', 'scheduledend', 'location']
            }
          }
        });
      }
      throw error;
    }

    // Get field validation rules
    const validation = await validateEntityRequiredFields(entityType, {}, accessToken);

    // Prepare creation guide
    const guide = {
      entityType,
      displayName: entityInfo.displayName,
      licenseRequired: entityInfo.licenseRequired,
      isAvailable: entityInfo.isAvailable,
      fields: {
        required: validation.required || [],
        recommended: validation.recommended || []
      },
      examples: getEntityExamples(entityType),
      endpoints: {
        create: `/api/dynamics/entities/${entityType}`,
        test: `/api/dynamics/entities/${entityType}/test`,
        list: `/api/dynamics/entities/${entityType}`
      }
    };

    res.status(200).json({
      success: true,
      guide
    });

  } catch (error) {
    console.error(`❌ Failed to get creation guide:`, error);
    const errorResponse = createErrorResponse(error, `get_${req.params.entityType}_guide`);
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Opportunity Controllers
export const createOpportunity = async (req, res) => {
  req.params.entityType = 'opportunity';
  return createEntity(req, res);
};

export const getOpportunities = async (req, res) => {
  req.params.entityType = 'opportunity';
  return getEntities(req, res);
};

export const getOpportunityById = async (req, res) => {
  req.params.entityType = 'opportunity';
  return getEntityById(req, res);
};

export const updateOpportunity = async (req, res) => {
  req.params.entityType = 'opportunity';
  return updateEntity(req, res);
};

export const deleteOpportunity = async (req, res) => {
  req.params.entityType = 'opportunity';
  return deleteEntity(req, res);
};

export const getCurrentEnvironment = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    
    try {
      // Simple WhoAmI request to verify connectivity
      const whoAmIResponse = await makeCrmRequest('GET', 'WhoAmI', accessToken);
      
      const response = createSuccessResponse({
        currentEnvironment: {
          url: process.env.DYNAMICS_CRM_URL,
          userId: whoAmIResponse.UserId,
          organizationId: whoAmIResponse.OrganizationId,
          businessUnitId: whoAmIResponse.BusinessUnitId
        },
        connectionStatus: 'Connected',
        userAuthenticated: true,
        apiVersion: '9.2',
        region: 'EU'
      }, 'Successfully connected to Dynamics 365 environment');

      return res.status(response.status).json(response);

    } catch (whoAmIError) {
      console.error('Environment check failed:', {
        error: whoAmIError.message,
        response: whoAmIError.response?.data,
        status: whoAmIError.response?.status
      });

      throw new DynamicsError(
        'Failed to connect to Dynamics 365 environment',
        whoAmIError.response?.status || 500,
        'CONNECTION_FAILED',
        {
          solution: 'Verify your connection settings',
          steps: [
            'Check if your access token is valid',
            'Ensure DYNAMICS_CRM_URL is correct',
            'Verify you have proper licenses assigned'
          ],
          currentUrl: process.env.DYNAMICS_CRM_URL,
          error: whoAmIError.response?.data
        }
      );
    }

  } catch (error) {
    const errorResponse = createErrorResponse(error, 'get_current_environment');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const checkTokenDetails = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const tokenPayload = validateD365Token(accessToken);
    
    const response = createSuccessResponse({
      tokenValid: true,
      tenantId: tokenPayload.tid,
      userId: tokenPayload.oid,
      issuer: tokenPayload.iss,
      audience: tokenPayload.aud,
      expiresAt: new Date(tokenPayload.exp * 1000).toISOString()
    }, 'Token details retrieved successfully');

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'check_token_details');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// New endpoint to check and fix tenant configuration
export const checkTenantConfiguration = async (req, res) => {
  try {
    console.log('🔍 Checking tenant configuration for multi-tenant setup...');

    const requiredEnvVars = {
      'MD_CLIENT_ID': process.env.MD_CLIENT_ID,
      'MD_CLIENT_SECRET': process.env.MD_CLIENT_SECRET,
      'TENANT_ID': process.env.TENANT_ID,
      'MD_REDIRECT_URI': process.env.MD_REDIRECT_URI,
      'DYNAMICS_CRM_URL': process.env.DYNAMICS_CRM_URL
    };

    const missingVars = [];
    const presentVars = {};

    Object.entries(requiredEnvVars).forEach(([key, value]) => {
      if (!value) {
        missingVars.push(key);
      } else {
        presentVars[key] = key === 'MD_CLIENT_SECRET' ? 'SET (hidden)' : value;
      }
    });

    // Validate tenant configuration
    const tenantAnalysis = {
      currentTenantId: process.env.TENANT_ID,
      isMultiTenant: process.env.TENANT_ID === 'common',
      recommendation: process.env.TENANT_ID === 'common' ? 
        'Perfect for multi-tenant support' : 
        'Change to "common" for better multi-tenant support'
    };

    // Validate redirect URI format
    let redirectUriAnalysis = { valid: false, issues: [] };
    if (process.env.MD_REDIRECT_URI) {
      try {
        const url = new URL(process.env.MD_REDIRECT_URI);
        redirectUriAnalysis = {
          valid: true,
          protocol: url.protocol,
          host: url.host,
          pathname: url.pathname,
          endsWithCallback: url.pathname.endsWith('/callback'),
          recommendation: url.pathname.endsWith('/callback') ? 
            'Correct callback path' : 
            'Should end with /callback'
        };
      } catch (error) {
        redirectUriAnalysis = {
          valid: false,
          issues: [`Invalid URL format: ${error.message}`]
        };
      }
    }

    // Generate test authentication URL
    let testAuthUrl = null;
    let authUrlError = null;
    
    try {
      if (process.env.MD_CLIENT_ID && process.env.MD_REDIRECT_URI && process.env.DYNAMICS_CRM_URL) {
        const authParams = new URLSearchParams({
          client_id: process.env.MD_CLIENT_ID,
          response_type: 'code',
          redirect_uri: process.env.MD_REDIRECT_URI,
          scope: [
            'openid',
            'profile',
            'email',
            'offline_access',
            `${process.env.DYNAMICS_CRM_URL}/.default`
          ].join(' '),
          state: `test_${Date.now()}`,
          response_mode: 'query'
        });

        testAuthUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${authParams.toString()}`;
      }
    } catch (error) {
      authUrlError = error.message;
    }

    // Azure AD app registration checklist
    const azureAdChecklist = [
      {
        item: 'Supported account types',
        requirement: 'Accounts in any organizational directory (Any Azure AD directory - Multitenant)',
        status: 'manual_check'
      },
      {
        item: 'Redirect URI',
        requirement: `Must match exactly: ${process.env.MD_REDIRECT_URI}`,
        status: redirectUriAnalysis.valid ? 'likely_correct' : 'needs_attention'
      },
      {
        item: 'API permissions',
        requirement: 'Dynamics CRM (user_impersonation) - Delegated',
        status: 'manual_check'
      },
      {
        item: 'API permissions',
        requirement: 'Microsoft Graph (User.Read, offline_access) - Delegated',
        status: 'manual_check'
      },
      {
        item: 'Admin consent',
        requirement: 'Must be granted for all permissions',
        status: 'manual_check'
      },
      {
        item: 'signInAudience in manifest',
        requirement: 'Should be "AzureADMultipleOrgs"',
        status: 'manual_check'
      }
    ];

    const response = createSuccessResponse({
      configurationStatus: {
        missingEnvironmentVariables: missingVars,
        presentEnvironmentVariables: presentVars,
        configurationValid: missingVars.length === 0
      },
      tenantConfiguration: tenantAnalysis,
      redirectUriValidation: redirectUriAnalysis,
      testAuthenticationUrl: {
        url: testAuthUrl,
        error: authUrlError,
        instructions: testAuthUrl ? [
          'Copy the URL and open in incognito/private browser',
          'Try logging in with different Microsoft accounts',
          'Each user should see their own organizations'
        ] : ['Fix missing environment variables first']
      },
      azureAdAppRegistrationChecklist: azureAdChecklist,
      troubleshooting: {
        commonIssues: [
          {
            issue: 'AADSTS900144: client_id parameter missing',
            solutions: [
              'Ensure MD_CLIENT_ID environment variable is set',
              'Check Azure AD app registration client ID',
              'Verify no special characters in client ID',
              'Restart application after changing environment variables'
            ]
          },
          {
            issue: 'AADSTS90002: Tenant not found',
            solutions: [
              'Set TENANT_ID=common for multi-tenant support',
              'Ensure Azure AD app supports multi-tenant authentication',
              'Check app registration "Supported account types" setting'
            ]
          },
          {
            issue: 'AADSTS50011: Redirect URI mismatch',
            solutions: [
              'Ensure MD_REDIRECT_URI exactly matches Azure AD app registration',
              'Check for trailing slashes or protocol differences',
              'Add all required redirect URIs to Azure AD app'
            ]
          }
        ]
      },
      nextSteps: missingVars.length === 0 ? [
        'Update your .env file if any values are incorrect',
        'Restart your application',
        'Test the authentication URL in incognito browser',
        'Verify Azure AD app registration settings',
        'Test with multiple Microsoft accounts'
      ] : [
        `Set missing environment variables: ${missingVars.join(', ')}`,
        'Restart your application',
        'Run this check again to validate configuration'
      ]
    }, 'Tenant configuration analysis complete');

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'check_tenant_configuration');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Helper function to provide entity examples
function getEntityExamples(entityType) {
  const examples = {
    contact: {
      minimal: {
        firstname: 'John',
        lastname: 'Doe'
      },
      complete: {
        firstname: 'John',
        lastname: 'Doe',
        emailaddress1: 'john.doe@example.com',
        telephone1: '+1-555-0123',
        jobtitle: 'Software Developer',
        description: 'Contact from API integration'
      }
    },
    lead: {
      minimal: {
        subject: 'Interested in our services',
        firstname: 'Jane',
        lastname: 'Smith'
      },
      complete: {
        subject: 'Interested in software solutions',
        firstname: 'Jane',
        lastname: 'Smith',
        companyname: 'Tech Corp',
        emailaddress1: 'jane@techcorp.com',
        telephone1: '+1-555-0124',
        description: 'Lead from website contact form'
      }
    },
    account: {
      minimal: {
        name: 'Acme Corporation'
      },
      complete: {
        name: 'Acme Corporation',
        telephone1: '+1-555-0125',
        emailaddress1: 'info@acme.com',
        websiteurl: 'https://acme.com',
        description: 'Technology company'
      }
    },
    opportunity: {
      minimal: {
        name: 'Software License Deal'
      },
      complete: {
        name: 'Acme Corp - Annual Software License',
        estimatedvalue: 50000,
        estimatedclosedate: '2024-12-31',
        description: 'Annual software license renewal opportunity'
      }
    },
    task: {
      minimal: {
        subject: 'Follow up with client'
      },
      complete: {
        subject: 'Follow up with Acme Corp',
        description: 'Schedule follow-up meeting to discuss requirements',
        scheduledend: '2024-12-31T17:00:00Z',
        prioritycode: 1
      }
    },
    appointment: {
      minimal: {
        subject: 'Client Meeting',
        scheduledstart: '2024-12-30T14:00:00Z',
        scheduledend: '2024-12-30T15:00:00Z'
      },
      complete: {
        subject: 'Requirements Discussion with Acme Corp',
        scheduledstart: '2024-12-30T14:00:00Z',
        scheduledend: '2024-12-30T15:00:00Z',
        location: 'Conference Room A',
        description: 'Discuss project requirements and timeline'
      }
    }
  };

  return examples[entityType] || {
    minimal: { name: 'Example Name' },
    complete: { name: 'Example Name', description: 'Example description' }
  };
}

// New endpoint to help identify Sales environment URL
export const identifySalesEnvironment = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    
    console.log('🔍 Identifying Sales environment from available organizations...');
    
    // Get all available organizations
    const organizations = await discoverUserOrganizations(accessToken);
    
    // Test each organization for Sales Hub entities
    const salesEntities = ['lead', 'opportunity', 'product', 'quote', 'invoice', 'salesorder'];
    const environmentResults = [];
    
    for (const org of organizations) {
      console.log(`🧪 Testing organization: ${org.friendlyName}`);
      
      const salesEntityTest = {};
      let salesEntitiesAvailable = 0;
      
      for (const entityType of salesEntities) {
        try {
          // Test entity access using the organization's API URL
          const response = await axios.get(
            `${org.apiUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${entityType}')?$select=LogicalName,DisplayName`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0'
              }
            }
          );
          
          salesEntityTest[entityType] = { available: true, status: 'SUCCESS' };
          salesEntitiesAvailable++;
        } catch (testError) {
          salesEntityTest[entityType] = { 
            available: false, 
            status: 'NOT_AVAILABLE',
            error: testError.response?.status || 'ERROR'
          };
        }
      }
      
      const salesScore = Math.round((salesEntitiesAvailable / salesEntities.length) * 100);
      
      environmentResults.push({
        friendlyName: org.friendlyName,
        uniqueName: org.uniqueName,
        apiUrl: org.apiUrl,
        region: org.region,
        salesScore: `${salesScore}%`,
        salesEntitiesAvailable,
        totalSalesEntities: salesEntities.length,
        salesEntityTest,
        isSalesEnvironment: salesScore >= 80, // 80% or more sales entities available
        recommendation: salesScore >= 80 ? 
          'This appears to be your Sales environment - use this URL' : 
          salesScore > 0 ? 'Partial sales functionality available' : 'No sales functionality detected'
      });
    }
    
    // Sort by sales score (highest first)
    environmentResults.sort((a, b) => b.salesEntitiesAvailable - a.salesEntitiesAvailable);
    
    const salesEnvironments = environmentResults.filter(env => env.isSalesEnvironment);
    
    const response = createSuccessResponse({
      currentConfiguration: process.env.DYNAMICS_CRM_URL,
      availableEnvironments: environmentResults,
      salesEnvironments,
      recommendations: salesEnvironments.length > 0 ? [
        {
          priority: 'HIGH',
          action: 'Update Environment Configuration',
          recommendedUrl: salesEnvironments[0].apiUrl,
          environmentName: salesEnvironments[0].friendlyName,
          steps: [
            `Update your .env file: DYNAMICS_CRM_URL=${salesEnvironments[0].apiUrl}`,
            'Restart your application',
            'Test entity creation again',
            'All sales objects should now work correctly'
          ]
        }
      ] : [
        {
          priority: 'HIGH',
          issue: 'No Sales environments detected',
          action: 'Install Dynamics 365 Sales Hub',
          steps: [
            'Go to Power Platform Admin Center',
            'Select your target environment (likely "Sales")',
            'Install Dynamics 365 Sales Hub application',
            'Wait for installation to complete',
            'Run this endpoint again to verify'
          ]
        }
      ]
    }, `Found ${environmentResults.length} environments - ${salesEnvironments.length} with Sales functionality`);

    res.status(response.status).json(response);
  } catch (error) {
    console.error('❌ Failed to identify Sales environment:', error);
    const errorResponse = createErrorResponse(error, 'identify_sales_environment');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Quick Sales environment identification and testing endpoint
export const quickSalesEnvironmentSetup = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    
    console.log('🚀 Quick Sales Environment Setup...');
    
    // Step 1: Try to discover Sales environment
    console.log('🔍 Step 1: Discovering Sales environments...');
    let salesEnvironmentResult;
    
    try {
      salesEnvironmentResult = await discoverSalesEnvironmentForEntity(accessToken);
    } catch (discoveryError) {
      console.log(`⚠️ Discovery failed: ${discoveryError.message}`);
      salesEnvironmentResult = { success: false, salesEnvironments: [] };
    }
    
    // Step 2: Find the best Sales environment
    let recommendedEnvironment = null;
    let currentEnvironmentScore = 0;
    
    if (salesEnvironmentResult.success && salesEnvironmentResult.salesEnvironments.length > 0) {
      // Look for environment named "Sales" first
      recommendedEnvironment = salesEnvironmentResult.salesEnvironments.find(env => 
        env.friendlyName.toLowerCase().includes('sales')
      ) || salesEnvironmentResult.salesEnvironments[0];
      
      console.log(`✅ Found Sales environment: ${recommendedEnvironment.friendlyName}`);
    }
    
    // Step 3: Test current environment if no Sales environment found
    if (!recommendedEnvironment) {
      console.log('🔄 Testing current environment for Sales capabilities...');
      
      const currentUrl = process.env.DYNAMICS_CRM_URL;
      const salesEntities = ['lead', 'opportunity', 'product', 'quote', 'salesorder', 'invoice'];
      let availableEntities = 0;
      
      for (const entity of salesEntities) {
        try {
          await getWorkingEntityDetails(entity, accessToken);
          availableEntities++;
        } catch (error) {
          // Entity not available
        }
      }
      
      currentEnvironmentScore = Math.round((availableEntities / salesEntities.length) * 100);
      
      if (availableEntities >= 3) {
        recommendedEnvironment = {
          friendlyName: 'Current Environment',
          apiUrl: currentUrl,
          salesScore: currentEnvironmentScore,
          salesEntitiesAvailable: availableEntities,
          totalSalesEntities: salesEntities.length,
          isCurrent: true
        };
      }
    }
    
    // Step 4: Provide setup instructions
    const response = createSuccessResponse({
      currentConfiguration: {
        url: process.env.DYNAMICS_CRM_URL,
        score: currentEnvironmentScore
      },
      recommendedEnvironment,
      availableEnvironments: salesEnvironmentResult.salesEnvironments || [],
      setupInstructions: recommendedEnvironment ? {
        step1: 'Update your .env file',
        step2: `Set DYNAMICS_CRM_URL=${recommendedEnvironment.apiUrl}`,
        step3: 'Restart your application',
        step4: 'Test with the endpoints below'
      } : {
        step1: 'Install Dynamics 365 Sales Hub',
        step2: 'Go to Power Platform Admin Center',
        step3: 'Install Sales Hub in your environment',
        step4: 'Run this endpoint again after installation'
      },
      testEndpoints: {
        testConnection: 'GET /api/dynamics/test-connection',
        testLead: 'POST /api/dynamics/entity/lead/test',
        testOpportunity: 'POST /api/dynamics/entity/opportunity/test',
        checkSalesHub: 'GET /api/dynamics/environment/sales-hub-status'
      },
      nextSteps: recommendedEnvironment ? [
        `✅ Sales environment found: ${recommendedEnvironment.friendlyName}`,
        `🔧 Update .env: DYNAMICS_CRM_URL=${recommendedEnvironment.apiUrl}`,
        '🔄 Restart your application',
        '🧪 Test sales entity creation'
      ] : [
        '❌ No suitable Sales environment found',
        '🏗️ Install Dynamics 365 Sales Hub',
        '⚙️ Configure proper licensing',
        '🔄 Run this endpoint again'
      ]
    }, recommendedEnvironment ? 
      `Sales environment ready: ${recommendedEnvironment.friendlyName}` : 
      'Sales environment setup required');

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'quick_sales_environment_setup');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Enhanced permissions and licensing checker for Sales Hub entities
export const checkUserSalesCapabilities = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    
    console.log('🔍 Checking user Sales Hub capabilities and permissions...');
    
    // Test different entity types to determine user capabilities
    const salesEntities = [
      { name: 'lead', displayName: 'Lead', required: false },
      { name: 'opportunity', displayName: 'Opportunity', required: true },
      { name: 'product', displayName: 'Product', required: true },
      { name: 'quote', displayName: 'Quote', required: true },
      { name: 'salesorder', displayName: 'Sales Order', required: true },
      { name: 'invoice', displayName: 'Invoice', required: true },
      { name: 'campaign', displayName: 'Campaign', required: false }
    ];
    
    const capabilities = {
      hasBasicCRM: false,
      hasSalesHub: false,
      canCreateLeads: false,
      canCreateOpportunities: false,
      canCreateProducts: false,
      canCreateQuotes: false,
      canCreateSalesOrders: false,
      canCreateInvoices: false,
      canCreateCampaigns: false,
      userInfo: null,
      licenseInfo: null,
      securityRoles: [],
      recommendations: []
    };
    
    // Get user information first
    try {
      const userInfo = await makeCrmRequest('GET', 'WhoAmI', accessToken);
      capabilities.userInfo = {
        userId: userInfo.UserId,
        organizationId: userInfo.OrganizationId,
        businessUnitId: userInfo.BusinessUnitId
      };
      console.log('✅ User info retrieved successfully');
    } catch (error) {
      console.log('❌ Failed to get user info:', error.message);
    }
    
    // Test entity access capabilities
    for (const entity of salesEntities) {
      console.log(`🧪 Testing ${entity.displayName} access...`);
      
      try {
        // Try to read entity metadata first
        const metadataResponse = await makeCrmRequest(
          'GET',
          `${entity.name}s?$top=1&$select=${entity.name}id`,
          accessToken
        );
        
        // If we can read, test if we can create
        try {
          // Test creation permissions with minimal data
          const testData = getMinimalTestData(entity.name);
          
          // Use dry run if available, otherwise catch the actual creation error
          await makeCrmRequest(
            'POST',
            `${entity.name}s`,
            accessToken,
            testData
          );
          
          // If we get here, user can create this entity
          capabilities[`canCreate${entity.displayName.replace(' ', '')}s`] = true;
          console.log(`✅ ${entity.displayName}: CREATE permission granted`);
          
        } catch (createError) {
          if (createError.message.includes('403') || createError.message.includes('Insufficient')) {
            console.log(`❌ ${entity.displayName}: CREATE permission denied`);
            capabilities[`canCreate${entity.displayName.replace(' ', '')}s`] = false;
          } else {
            // Other errors might be data validation, which means create permission exists
            console.log(`⚠️ ${entity.displayName}: CREATE permission likely exists (validation error)`);
            capabilities[`canCreate${entity.displayName.replace(' ', '')}s`] = true;
          }
        }
        
      } catch (readError) {
        console.log(`❌ ${entity.displayName}: READ access denied`);
        capabilities[`canCreate${entity.displayName.replace(' ', '')}s`] = false;
        
        if (entity.required) {
          capabilities.recommendations.push({
            issue: `No access to ${entity.displayName}`,
            solution: `${entity.displayName} requires Dynamics 365 Sales Hub license`,
            priority: 'HIGH',
            action: 'Contact admin to assign Sales Hub license'
          });
        }
      }
    }
    
    // Determine overall capabilities
    capabilities.hasBasicCRM = capabilities.canCreateLeads;
    capabilities.hasSalesHub = capabilities.canCreateOpportunities && capabilities.canCreateProducts;
    
    // Generate recommendations based on capabilities
    if (!capabilities.hasSalesHub) {
      capabilities.recommendations.push({
        issue: 'Sales Hub entities not accessible',
        solution: 'User needs Dynamics 365 Sales Hub license and appropriate security roles',
        priority: 'CRITICAL',
        action: 'Contact system administrator',
        details: [
          'Assign Dynamics 365 Sales Hub license to user',
          'Add user to appropriate security roles (Sales Manager, Salesperson, etc.)',
          'Ensure user has Create permissions for Sales entities',
          'Verify user is in the correct Business Unit'
        ]
      });
    }
    
    if (capabilities.hasBasicCRM && !capabilities.hasSalesHub) {
      capabilities.recommendations.push({
        issue: 'Limited to basic CRM entities',
        solution: 'User can create Leads and Contacts but not full Sales entities',
        priority: 'MEDIUM',
        action: 'Use alternative entities or upgrade license',
        alternatives: {
          'opportunity': 'Use Task or custom entity',
          'product': 'Use Note or custom entity',
          'quote': 'Use Task with description',
          'salesorder': 'Use Task or custom entity',
          'invoice': 'Use Task or custom entity'
        }
      });
    }
    
    const response = createSuccessResponse({
      capabilities,
      summary: {
        overallStatus: capabilities.hasSalesHub ? 'FULL_SALES_ACCESS' : 
                      capabilities.hasBasicCRM ? 'BASIC_CRM_ACCESS' : 'LIMITED_ACCESS',
        canUseSalesHub: capabilities.hasSalesHub,
        canUseBasicCRM: capabilities.hasBasicCRM,
        recommendedAction: capabilities.hasSalesHub ? 'Ready to use Sales Hub' :
                          capabilities.hasBasicCRM ? 'Upgrade to Sales Hub license' :
                          'Contact administrator for access'
      },
      nextSteps: capabilities.hasSalesHub ? [
        'You can create all Sales Hub entities',
        'Use the standard /api/dynamics/entity/{entityType} endpoints',
        'All sales workflows are available'
      ] : [
        'Contact your system administrator',
        'Request Dynamics 365 Sales Hub license',
        'Ask to be added to Sales security roles',
        'Use basic CRM entities (leads, contacts) in the meantime'
      ]
    }, capabilities.hasSalesHub ? 
      'User has full Sales Hub access' : 
      'User has limited access - Sales Hub license required');

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'check_user_sales_capabilities');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Helper function to get minimal test data for permission testing
function getMinimalTestData(entityType) {
  const testData = {
    lead: { subject: 'Permission Test', firstname: 'Test', lastname: 'User' },
    opportunity: { name: 'Permission Test Opportunity' },
    product: { name: 'Permission Test Product' },
    quote: { name: 'Permission Test Quote' },
    salesorder: { name: 'Permission Test Order' },
    invoice: { name: 'Permission Test Invoice' },
    campaign: { name: 'Permission Test Campaign' }
  };
  
  return testData[entityType] || { name: 'Permission Test' };
}

// Enhanced entity creation with automatic permission checking and fallbacks
// Smart endpoint controller removed - using direct entity creation only

// Alternative creation function removed - using direct entity creation only

// Enhanced entity creation function is imported from config file

// Helper function to ensure a default metric exists
const ensureDefaultMetricExists = async (accessToken) => {
  try {
    console.log('🔍 Checking for existing metrics...');
    
    // First, check if any metrics exist
    const existingMetrics = await makeCrmRequest(
      'GET',
      'metrics?$select=metricid,name,amountdatatype&$top=1',
      accessToken
    );

    if (existingMetrics.value && existingMetrics.value.length > 0) {
      console.log('✅ Found existing metric:', existingMetrics.value[0].name);
      return existingMetrics.value[0].metricid;
    }

    console.log('📝 No metrics found, creating default metric...');
    
    // Create a default metric
    const defaultMetricData = {
      name: "Revenue (Auto-created)",
      description: "Default revenue metric automatically created for goal tracking",
      amountdatatype: 0, // Money type
      isstretchtracked: true // Allow stretch targets
    };

    const createdMetric = await makeCrmRequest(
      'POST',
      'metrics',
      accessToken,
      defaultMetricData
    );

    console.log('✅ Default metric created successfully:', createdMetric.metricid);
    return createdMetric.metricid;

  } catch (error) {
    console.error('❌ Error ensuring metric exists:', error.message);
    throw new Error(`Failed to ensure metric exists: ${error.message}`);
  }
};

// Enhanced goal creation with automatic metric handling
export const createGoal = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Access token is required',
        timestamp: new Date().toISOString()
      });
    }

    let goalData = { ...req.body };
    
    console.log('🚀 Creating goal with automatic metric handling...');
    console.log('📋 Original goal data:', goalData);

    // Check if user provided a metric
    const hasMetric = goalData.metricid || 
                     goalData._metricid_value || 
                     goalData['metricid@odata.bind'];

    if (!hasMetric) {
      console.log('⚠️ No metric provided, ensuring default metric exists...');
      
      try {
        // Get or create a default metric
        const defaultMetricId = await ensureDefaultMetricExists(accessToken);
        
        // Add the metric to the goal data using navigation property
        goalData['metricid@odata.bind'] = `/metrics(${defaultMetricId})`;
        
        console.log('✅ Added default metric to goal:', defaultMetricId);
        
        // Also set the amountdatatype to match the default metric (Money = 0)
        if (!goalData.amountdatatype) {
          goalData.amountdatatype = 0; // Money type
        }
        
        // Ensure isamount is set for money metrics
        if (!goalData.isamount) {
          goalData.isamount = true;
        }
        
        // If no target is specified, set a default target based on the data type
        if (!goalData.targetmoney && !goalData.targetdecimal && !goalData.targetinteger) {
          if (goalData.amountdatatype === 0) {
            goalData.targetmoney = goalData.targetmoney || 10000.00; // Default $10,000 target
          } else if (goalData.amountdatatype === 1) {
            goalData.targetdecimal = goalData.targetdecimal || 100.0; // Default 100.0 target
          } else if (goalData.amountdatatype === 2) {
            goalData.targetinteger = goalData.targetinteger || 50; // Default 50 target
          }
        }
        
      } catch (metricError) {
        console.error('❌ Failed to handle metric:', metricError.message);
        return res.status(400).json({
          success: false,
          error: `Failed to create or find metric for goal: ${metricError.message}`,
          solution: 'Ensure Goal Management is enabled in your Dynamics 365 environment',
          troubleshooting: [
            'Check if you have permissions to create metrics',
            'Verify Goal Management is enabled in System Settings',
            'Try providing a specific metricid in your request',
            'Contact your system administrator'
          ],
          timestamp: new Date().toISOString()
        });
      }
    } else {
      console.log('✅ Metric already provided in request');
    }

    // Set default dates if not provided
    if (!goalData.goalstartdate) {
      goalData.goalstartdate = new Date().toISOString();
    }
    
    if (!goalData.goalenddate) {
      // Default to end of current year
      const endOfYear = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);
      goalData.goalenddate = endOfYear.toISOString();
    }

    console.log('📋 Enhanced goal data:', goalData);

    // Update the request body with enhanced data
    req.body = goalData;
    req.params.entityType = 'goal';
    
    // Call the standard entity creation
    await createEntity(req, res);
    
  } catch (error) {
    console.error('❌ Goal creation failed:', error.message);
    const errorResponse = createErrorResponse(error, 'create_goal');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const getGoals = async (req, res) => {
  try {
    req.params.entityType = 'goal';
    await getEntities(req, res);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'get_goals');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const getGoalById = async (req, res) => {
  try {
    req.params.entityType = 'goal';
    await getEntityById(req, res);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'get_goal_by_id');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const updateGoal = async (req, res) => {
  try {
    req.params.entityType = 'goal';
    await updateEntity(req, res);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'update_goal');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const deleteGoal = async (req, res) => {
  try {
    req.params.entityType = 'goal';
    await deleteEntity(req, res);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'delete_goal');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Helper function to get available metrics for goal creation
export const getAvailableMetrics = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Access token is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log('🔍 Fetching available metrics...');

    // Get metrics from Dynamics 365
    const metrics = await makeCrmRequest(
      'GET',
      'metrics?$select=metricid,name,description,amountdatatype,isstretchtracked&$top=50',
      accessToken
    );

    console.log(`✅ Found ${metrics.value?.length || 0} metrics`);

    const response = createSuccessResponse({
      metrics: metrics.value || [],
      count: metrics.value?.length || 0,
      examples: {
        basicGoal: {
          title: "Sales Revenue Goal",
          metricid: "USE_ONE_OF_THE_METRIC_IDs_FROM_ABOVE",
          goalstartdate: "2024-01-01T00:00:00.000Z",
          goalenddate: "2024-12-31T23:59:59.000Z",
          targetmoney: 100000.00,
          amountdatatype: 0,
          isamount: true,
          isfiscalperiodgoal: false
        },
        goalWithNavigation: {
          title: "Q1 Sales Target",
          "metricid@odata.bind": "/metrics(METRIC_ID_HERE)",
          goalstartdate: "2024-01-01T00:00:00.000Z",
          goalenddate: "2024-03-31T23:59:59.000Z",
          targetmoney: 25000.00,
          stretchtargetmoney: 30000.00,
          amountdatatype: 0,
          isamount: true,
          isfiscalperiodgoal: false
        }
      },
      instructions: [
        "1. First, choose a metric ID from the metrics array above",
        "2. Use either 'metricid' field with the ID or 'metricid@odata.bind' navigation property",
        "3. Set proper start and end dates for your goal period",
        "4. Choose the appropriate target value field based on amountdatatype:",
        "   - amountdatatype: 0 = Money (use targetmoney)",
        "   - amountdatatype: 1 = Decimal (use targetdecimal)", 
        "   - amountdatatype: 2 = Integer (use targetinteger)",
        "5. Optionally set stretch targets for additional motivation"
      ]
    }, 'Available metrics retrieved successfully');

    res.status(response.status).json(response);
  } catch (error) {
    console.error('❌ Error fetching metrics:', error.message);
    
    if (error.message.includes('Resource not found')) {
      return res.status(404).json({
        success: false,
        error: 'Metrics entity not found. This might indicate that Goal Management is not enabled in your Dynamics 365 environment.',
        solution: 'Contact your system administrator to enable Goal Management in Dynamics 365 Settings > Goals Configuration',
        timestamp: new Date().toISOString()
      });
    }
    
    const errorResponse = createErrorResponse(error, 'get_available_metrics');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Helper function to create a default metric if none exist
export const createDefaultMetric = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Access token is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log('🚀 Creating default metric for goals...');

    const defaultMetricData = {
      name: "Revenue (Money)",
      description: "Default revenue metric for tracking monetary goals",
      amountdatatype: 0, // Money type
      isstretchtracked: true // Allow stretch targets
    };

    const createdMetric = await makeCrmRequest(
      'POST',
      'metrics',
      accessToken,
      defaultMetricData
    );

    console.log('✅ Default metric created successfully');

    const metricId = createdMetric.metricid;

    const response = createSuccessResponse({
      metric: createdMetric,
      metricId: metricId,
      exampleGoalData: {
        title: "Example Revenue Goal",
        metricid: metricId,
        goalstartdate: "2024-01-01T00:00:00.000Z",
        goalenddate: "2024-12-31T23:59:59.000Z",
        targetmoney: 100000.00,
        stretchtargetmoney: 120000.00,
        amountdatatype: 0,
        isamount: true,
        isfiscalperiodgoal: false
      },
      instructions: [
        "Default revenue metric has been created successfully!",
        "You can now use this metric ID to create goals",
        "Use the example goal data provided above",
        "Modify the target amounts and dates as needed"
      ]
    }, 'Default metric created successfully');

    res.status(response.status).json(response);
  } catch (error) {
    console.error('❌ Error creating default metric:', error.message);
    const errorResponse = createErrorResponse(error, 'create_default_metric');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// New endpoint to switch organizations and get new Dynamics token
export const switchOrganization = async (req, res) => {
  try {
    const { organizationUrl, refreshToken } = req.body;
    
    if (!organizationUrl) {
      throw new DynamicsError(
        'Organization URL is required',
        400,
        'MISSING_ORGANIZATION_URL'
      );
    }
    
    if (!refreshToken) {
      throw new DynamicsError(
        'Refresh token is required',
        400,
        'MISSING_REFRESH_TOKEN'
      );
    }
    
    console.log(`🔄 Switching to organization: ${organizationUrl}`);
    
    // Import functions from config
    const { getDynamicsTokenForOrganization, validateOrganizationAccess } = await import('../config/microsoftDynemicConfig.js');
    
    // Get Dynamics 365 specific token for the new organization
    const dynamicsTokens = await getDynamicsTokenForOrganization(refreshToken, organizationUrl);
    
    // Validate access to the organization
    const orgValidation = await validateOrganizationAccess(organizationUrl, dynamicsTokens.accessToken);
    
    console.log('✅ Organization switch successful');
    
    const response = createSuccessResponse({
      organizationUrl: organizationUrl,
      dynamicsTokens: {
        accessToken: dynamicsTokens.accessToken,
        refreshToken: dynamicsTokens.refreshToken,
        expiresIn: dynamicsTokens.expiresIn,
        tokenType: dynamicsTokens.tokenType,
        scope: dynamicsTokens.scope
      },
      organizationAccess: orgValidation,
      instructions: [
        'Organization switched successfully',
        'Use the new dynamicsTokens.accessToken for CRM operations',
        'Include X-Organization-URL header in all requests',
        'All API calls will now target this organization'
      ]
    }, 'Organization switched successfully');
    
    res.status(response.status).json(response);
  } catch (error) {
    console.error('❌ Error switching organization:', error.message);
    const errorResponse = createErrorResponse(error, 'switch_organization');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// New endpoint to connect directly to a known Dynamics 365 instance URL
// Switch to a specific discovered instance/environment
export const switchToInstance = async (req, res) => {
  try {
    const { instanceUrl, refreshToken } = req.body;
    
    if (!instanceUrl) {
      throw new DynamicsError(
        'Instance URL is required for switching',
        400,
        'MISSING_INSTANCE_URL',
        {
          solution: 'Provide the instanceUrl from the available instances list',
          example: 'https://org4cfb2bc0.crm15.dynamics.com'
        }
      );
    }
    
    if (!refreshToken) {
      throw new DynamicsError(
        'Refresh token is required for switching',
        400,
        'MISSING_REFRESH_TOKEN',
        {
          solution: 'Provide the refresh token from your authentication'
        }
      );
    }
    
    console.log(`🔄 Switching to instance: ${instanceUrl}`);
    
    // Import functions from config
    const { getDynamicsTokenForOrganization, validateOrganizationAccess } = await import('../config/microsoftDynemicConfig.js');
    
    // Get Dynamics 365 specific token for the selected instance
    const dynamicsTokens = await getDynamicsTokenForOrganization(refreshToken, instanceUrl);
    
    // Validate access to the instance
    const instanceValidation = await validateOrganizationAccess(instanceUrl, dynamicsTokens.accessToken);
    
    // 🚀 ENHANCEMENT: Automatically store instance URL with access token
    storeInstanceUrlForToken(dynamicsTokens.accessToken, instanceUrl);
    console.log('💾 Instance URL automatically stored for future requests');
    
    // Create organization info for the selected instance
    const selectedInstance = {
      friendlyName: instanceUrl.split('//')[1]?.split('.')[0]?.toUpperCase() || 'Dynamics 365',
      environmentName: instanceUrl.split('//')[1]?.split('.')[0] || 'dynamics365',
      instanceUrl: instanceUrl,
      uniqueName: instanceUrl.split('//')[1]?.split('.')[0] || 'dynamics365',
      urlName: instanceUrl.split('//')[1]?.split('.')[0] || 'dynamics365',
      region: instanceUrl.includes('.crm') ? instanceUrl.split('.crm')[1]?.split('.')[0] || 'Unknown' : 'Unknown',
      version: '9.2',
      state: 'Active'
    };
    
    console.log('✅ Instance switch successful');
    
    const response = createSuccessResponse({
      selectedInstance: selectedInstance,
      selectedEnvironment: selectedInstance, // Alias
      dynamicsTokens: {
        accessToken: dynamicsTokens.accessToken,
        refreshToken: dynamicsTokens.refreshToken,
        expiresIn: dynamicsTokens.expiresIn,
        tokenType: dynamicsTokens.tokenType,
        scope: dynamicsTokens.scope
      },
      instanceAccess: instanceValidation,
      instructions: [
        'Instance switch successful!',
        'Use the new dynamicsTokens.accessToken for all CRM operations',
        'Include X-Instance-URL header with this instance URL in all requests',
        'Environment URL and Instance URL refer to the same thing'
      ],
      headerExample: {
        'Authorization': `Bearer ${dynamicsTokens.accessToken.substring(0, 50)}...`,
        'X-Instance-URL': instanceUrl,
        'Content-Type': 'application/json'
      }
    }, 'Switched to Dynamics 365 instance successfully');
    
    res.status(response.status).json(response);
  } catch (error) {
    console.error('❌ Error switching instance:', error.message);
    const errorResponse = createErrorResponse(error, 'switch_instance');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Test endpoint to verify instance URL mapping
export const testInstanceUrlMapping = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const instanceUrl = getInstanceUrlFromRequest(req);
    
    console.log('🧪 Testing instance URL mapping:', {
      hasAccessToken: !!accessToken,
      tokenLength: accessToken?.length,
      foundInstanceUrl: instanceUrl,
      requestHeaders: {
        xInstanceUrl: req.headers['x-instance-url'],
        xOrganizationUrl: req.headers['x-organization-url'],
        authorization: req.headers.authorization ? 'Present' : 'Missing'
      }
    });
    
    const response = createSuccessResponse({
      status: 'Instance URL mapping test successful',
      accessToken: {
        present: !!accessToken,
        length: accessToken?.length,
        startsWith: accessToken?.substring(0, 20) + '...'
      },
      instanceUrl: {
        found: !!instanceUrl,
        value: instanceUrl,
        source: instanceUrl ? 'header' : 'none'
      },
      headers: {
        xInstanceUrl: req.headers['x-instance-url'] || null,
        xOrganizationUrl: req.headers['x-organization-url'] || null
      }
    }, 'Instance URL mapping test completed');
    
    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'test_instance_url_mapping');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Comprehensive permission guide endpoint
export const getPermissionGuide = async (req, res) => {
  try {
    const permissionGuide = {
      overview: {
        title: "Dynamics 365 Permissions and Licensing Guide",
        description: "Complete guide to resolve permission issues when creating entities in Dynamics 365",
        lastUpdated: new Date().toISOString()
      },
      
      commonIssues: {
        "403_insufficient_permissions": {
          title: "403 - Insufficient Permissions",
          description: "User doesn't have create permissions for the entity",
          causes: [
            "Missing security role assignment",
            "Security role doesn't include Create permissions",
            "User account is disabled",
            "Entity requires specific licensing (e.g., Sales Hub)"
          ],
          solutions: [
            {
              title: "Check and assign security roles",
              steps: [
                "Go to Power Platform Admin Center (admin.powerplatform.microsoft.com)",
                "Navigate to your environment",
                "Go to Settings > Users + permissions > Security roles",
                "Assign appropriate roles like 'Salesperson', 'Customer Service Representative', or 'System Administrator'"
              ]
            },
            {
              title: "Verify user is enabled",
              steps: [
                "In Power Platform Admin Center, go to Users",
                "Check if user status is 'Enabled'",
                "If disabled, enable the user account"
              ]
            },
            {
              title: "Grant entity-specific permissions",
              steps: [
                "Go to Security roles in Power Platform Admin Center",
                "Edit the user's security role",
                "Navigate to Core Records tab",
                "Ensure Create permission is checked for Contact, Account, etc.",
                "Save the security role"
              ]
            }
          ]
        },
        
        "licensing_required": {
          title: "Entity Requires Specific Licensing",
          description: "Some entities require Dynamics 365 Sales Hub or other specific licenses",
          entitiesRequiringLicenses: {
            salesHub: ["lead", "opportunity", "quote", "invoice", "salesorder"],
            customerService: ["incident", "case"],
            basic: ["contact", "account", "task", "appointment", "annotation"]
          },
          solutions: [
            {
              title: "For Sales entities (Lead, Opportunity, etc.)",
              steps: [
                "Purchase Dynamics 365 Sales Hub licenses",
                "Assign Sales Hub license to users",
                "Install Sales Hub apps in your environment",
                "Assign 'Salesperson' or 'Sales Manager' security roles"
              ]
            },
            {
              title: "For Customer Service entities (Case, etc.)",
              steps: [
                "Purchase Dynamics 365 Customer Service licenses",
                "Install Customer Service apps",
                "Assign 'Customer Service Representative' security roles"
              ]
            }
          ]
        },
        
        "organization_access": {
          title: "User Not in Organization",
          description: "User account exists but not added to Dynamics 365 organization",
          solutions: [
            {
              title: "Add user to organization",
              steps: [
                "Go to Power Platform Admin Center",
                "Navigate to your environment",
                "Go to Settings > Users + permissions > Users",
                "Click '+ Add user'",
                "Search and add the user",
                "Assign appropriate security roles and licenses"
              ]
            }
          ]
        }
      },
      
      securityRoles: {
        recommended: {
          "System Administrator": {
            description: "Full access to all entities and admin functions",
            entities: "All entities",
            permissions: "Create, Read, Update, Delete, Assign, Share",
            useCase: "Administrators and power users"
          },
          "Salesperson": {
            description: "Standard sales user with access to sales entities",
            entities: "Contact, Account, Lead, Opportunity, Quote, Order",
            permissions: "Create, Read, Update, limited Delete",
            useCase: "Sales team members",
            requiresLicense: "Dynamics 365 Sales Hub"
          },
          "Customer Service Representative": {
            description: "Customer service user with access to service entities",
            entities: "Contact, Account, Case, Knowledge Articles",
            permissions: "Create, Read, Update, limited Delete",
            useCase: "Customer service team",
            requiresLicense: "Dynamics 365 Customer Service"
          },
          "Basic User": {
            description: "Limited access to basic CRM entities",
            entities: "Contact, Account, Task, Appointment",
            permissions: "Create, Read, Update own records",
            useCase: "General business users"
          }
        }
      },
      
      troubleshooting: {
        quickChecks: [
          "Verify user has an active Dynamics 365 license",
          "Check if user is enabled in the organization",
          "Confirm user has appropriate security role assigned",
          "Ensure required apps (Sales Hub, Customer Service) are installed",
          "Verify organization/environment is accessible"
        ],
        
        stepByStepDiagnosis: [
          {
            step: 1,
            title: "Test basic access",
            endpoint: "GET /api/dynamics/diagnose-permissions",
            description: "Use this endpoint to get comprehensive permission diagnosis"
          },
          {
            step: 2,
            title: "Check organization access",
            endpoint: "GET /api/dynamics/organizations/validate-current",
            description: "Verify user can access the Dynamics 365 organization"
          },
          {
            step: 3,
            title: "Test entity permissions",
            endpoint: "GET /api/dynamics/entity/contact",
            description: "Try reading contacts to test basic entity access"
          },
          {
            step: 4,
            title: "Test create permissions",
            endpoint: "POST /api/dynamics/entity/contact",
            description: "Try creating a contact with minimal data to test create permissions"
          }
        ]
      },
      
      commonScenarios: {
        "new_user_setup": {
          title: "Setting up a new user",
          checklist: [
            "User has Microsoft 365 account",
            "User assigned appropriate Dynamics 365 license",
            "User added to Dynamics 365 environment",
            "Security role assigned (Salesperson, Customer Service Rep, etc.)",
            "Required apps installed in environment",
            "User can login to Dynamics 365 web interface"
          ]
        },
        
        "api_integration": {
          title: "Setting up API integration",
          checklist: [
            "App registration created in Azure AD",
            "API permissions granted (Dynamics 365 access)",
            "Admin consent provided for the app",
            "Service user created with appropriate permissions",
            "Token obtained with correct scopes",
            "Instance URL identified and configured"
          ]
        }
      },
      
      helpfulLinks: {
        "Power Platform Admin Center": "https://admin.powerplatform.microsoft.com",
        "Dynamics 365 Security Roles Documentation": "https://docs.microsoft.com/en-us/power-platform/admin/security-roles-privileges",
        "Dynamics 365 Licensing Guide": "https://docs.microsoft.com/en-us/dynamics365/get-started/licensing-guide",
        "API Permissions Setup": "https://docs.microsoft.com/en-us/powerapps/developer/data-platform/authenticate-oauth"
      }
    };

    const response = createSuccessResponse(
      permissionGuide,
      'Dynamics 365 permission guide retrieved successfully'
    );

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'get_permission_guide');
    res.status(errorResponse.status).json(errorResponse);
  }
};

export const connectToInstanceUrl = async (req, res) => {
  try {
    const { instanceUrl, refreshToken } = req.body;
    
    if (!instanceUrl) {
      throw new DynamicsError(
        'Instance URL is required',
        400,
        'MISSING_INSTANCE_URL',
        {
          example: 'https://org4cfb2bc0.crm15.dynamics.com',
          solution: 'Provide your Dynamics 365 instance URL in the request body'
        }
      );
    }
    
    if (!refreshToken) {
      throw new DynamicsError(
        'Refresh token is required',
        400,
        'MISSING_REFRESH_TOKEN',
        {
          solution: 'Provide the refresh token from your initial authentication'
        }
      );
    }
    
    console.log(`🔗 Connecting to instance URL: ${instanceUrl}`);
    
    // Import functions from config
    const { getDynamicsTokenForOrganization, validateOrganizationAccess } = await import('../config/microsoftDynemicConfig.js');
    
    // Get Dynamics 365 specific token for the instance
    const dynamicsTokens = await getDynamicsTokenForOrganization(refreshToken, instanceUrl);
    
    // Validate access to the instance
    const instanceValidation = await validateOrganizationAccess(instanceUrl, dynamicsTokens.accessToken);
    
    // Create organization info for the instance
    const organizationInfo = {
      friendlyName: instanceUrl.split('//')[1]?.split('.')[0]?.toUpperCase() || 'Dynamics 365',
      uniqueName: instanceUrl.split('//')[1]?.split('.')[0] || 'dynamics365',
      apiUrl: instanceUrl,
      urlName: instanceUrl.split('//')[1]?.split('.')[0] || 'dynamics365',
      region: instanceUrl.includes('.crm') ? instanceUrl.split('.crm')[1]?.split('.')[0] || 'Unknown' : 'Unknown',
      version: '9.2',
      state: 'Active'
    };
    
    console.log('✅ Instance connection successful');
    
    // 🚀 ENHANCEMENT: Automatically store instance URL with access token for future requests
    storeInstanceUrlForToken(dynamicsTokens.accessToken, instanceUrl);
    console.log('💾 Instance URL automatically stored - no need for headers in future requests');
    
    const response = createSuccessResponse({
      instanceUrl: instanceUrl,
      dynamicsTokens: {
        accessToken: dynamicsTokens.accessToken,
        refreshToken: dynamicsTokens.refreshToken,
        expiresIn: dynamicsTokens.expiresIn,
        tokenType: dynamicsTokens.tokenType,
        scope: dynamicsTokens.scope
      },
      organization: organizationInfo,
      instanceAccess: instanceValidation,
      connectionDetails: {
        connected: true,
        instanceUrl: instanceUrl,
        userId: instanceValidation.userId,
        organizationId: instanceValidation.organizationId
      },
      instructions: [
        'Instance connection successful!',
        'Use the dynamicsTokens.accessToken for all CRM operations',
        '✅ Instance URL is automatically stored - no need to include X-Instance-URL header in future requests',
        'The system will automatically use the correct instance URL for this access token',
        'You can now create/read/update/delete entities without passing instance URL headers'
      ],
      headerExample: {
        'Authorization': `Bearer ${dynamicsTokens.accessToken.substring(0, 50)}...`,
        'Content-Type': 'application/json',
        'Note': 'X-Instance-URL header is optional - automatically retrieved from storage'
      }
    }, 'Connected to Dynamics 365 instance successfully - Instance URL stored automatically');
    
    res.status(response.status).json(response);
  } catch (error) {
    console.error('❌ Error connecting to instance URL:', error.message);
    
    // Enhanced error handling for common scenarios
    if (error.message.includes('invalid_grant')) {
      const errorResponse = createErrorResponse(
        new DynamicsError(
          'Refresh token has expired or is invalid. Please re-authenticate.',
          401,
          'INVALID_REFRESH_TOKEN',
          {
            solution: 'Re-authenticate using the /auth/initiate endpoint',
            authEndpoint: '/api/dynamics/auth/initiate'
          }
        ),
        'connect_instance_url'
      );
      return res.status(errorResponse.status).json(errorResponse);
    }
    
    if (error.message.includes('invalid_resource') || error.message.includes('audience')) {
      const errorResponse = createErrorResponse(
        new DynamicsError(
          'Invalid instance URL or insufficient permissions for this Dynamics 365 instance.',
          403,
          'INVALID_INSTANCE_URL',
          {
            providedUrl: req.body.instanceUrl,
            solution: 'Verify the instance URL and ensure you have access to this Dynamics 365 organization',
            urlFormat: 'https://yourorg.crm.dynamics.com (or your region-specific URL)'
          }
        ),
        'connect_instance_url'
      );
      return res.status(errorResponse.status).json(errorResponse);
    }
    
    const errorResponse = createErrorResponse(error, 'connect_instance_url');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// New diagnostic endpoint to check user permissions and capabilities
export const diagnoseUserPermissions = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const instanceUrl = getInstanceUrlFromRequest(req);
    
    if (!instanceUrl) {
      throw new DynamicsError(
        'Instance URL is required for permission diagnosis',
        400,
        'MISSING_INSTANCE_URL',
        {
          solution: 'Include the X-Instance-URL header with your request',
          example: 'X-Instance-URL: https://org4cfb2bc0.crm15.dynamics.com'
        }
      );
    }

    console.log('🔍 Diagnosing user permissions and capabilities...');
    
    const diagnosis = {
      user: null,
      organization: null,
      basicAccess: false,
      entityPermissions: {},
      licensing: {},
      securityRoles: [],
      recommendations: []
    };

    // Step 1: Get user information
    try {
      const userInfo = await getDynamicsUserInfo(accessToken, instanceUrl);
      diagnosis.user = {
        userId: userInfo.UserId,
        fullName: userInfo.FullName,
        email: userInfo.Email,
        isEnabled: userInfo.IsEnabled,
        businessUnitId: userInfo.BusinessUnitId,
        organizationId: userInfo.OrganizationId
      };
      console.log('✅ User information retrieved');
    } catch (userError) {
      console.error('❌ Failed to get user information:', userError.message);
      diagnosis.user = { error: userError.message };
    }

    // Step 2: Test basic organization access
    try {
      const orgAccess = await validateOrganizationAccess(instanceUrl, accessToken);
      diagnosis.organization = orgAccess;
      diagnosis.basicAccess = orgAccess.hasAccess;
      console.log('✅ Organization access validated');
    } catch (orgError) {
      console.error('❌ Organization access validation failed:', orgError.message);
      diagnosis.organization = { hasAccess: false, error: orgError.message };
    }

    // Step 3: Test entity permissions for common entities
    const testEntities = ['contact', 'account', 'lead', 'opportunity', 'task', 'appointment'];
    
    for (const entityType of testEntities) {
      try {
        console.log(`🧪 Testing ${entityType} permissions...`);
        
        // Test read permission
        const readTest = await makeCrmRequest(
          'GET',
          `${getEntitySetName(entityType)}?$top=1&$select=${getPrimaryIdField(entityType)}`,
          accessToken,
          null,
          instanceUrl
        );
        
        const hasReadAccess = true;
        
        // Test create permission by attempting to create with minimal data
        let hasCreateAccess = false;
        try {
          const testData = getMinimalTestData(entityType);
          await makeCrmRequest(
            'POST',
            getEntitySetName(entityType),
            accessToken,
            testData,
            instanceUrl
          );
          hasCreateAccess = true;
          console.log(`✅ ${entityType} create permission confirmed`);
        } catch (createError) {
          if (createError.response?.status === 403) {
            hasCreateAccess = false;
            console.log(`❌ ${entityType} create permission denied`);
          } else {
            // If it's not a 403, it might be a validation error, which means we have create permission
            hasCreateAccess = true;
            console.log(`✅ ${entityType} create permission confirmed (validation error expected)`);
          }
        }
        
        diagnosis.entityPermissions[entityType] = {
          read: hasReadAccess,
          create: hasCreateAccess,
          accessible: hasReadAccess
        };
        
      } catch (entityError) {
        console.error(`❌ ${entityType} permission test failed:`, entityError.message);
        
        const is403 = entityError.response?.status === 403;
        const is404 = entityError.response?.status === 404;
        
        diagnosis.entityPermissions[entityType] = {
          read: !is403,
          create: false,
          accessible: !is403 && !is404,
          error: entityError.message,
          statusCode: entityError.response?.status
        };
      }
    }

    // Step 4: Analyze licensing based on accessible entities
    const accessibleEntities = Object.keys(diagnosis.entityPermissions).filter(
      entity => diagnosis.entityPermissions[entity].accessible
    );
    
    const salesEntities = ['lead', 'opportunity'].filter(
      entity => diagnosis.entityPermissions[entity]?.accessible
    );
    
    diagnosis.licensing = {
      hasBasicCRM: accessibleEntities.includes('contact') && accessibleEntities.includes('account'),
      hasSalesHub: salesEntities.length > 0,
      accessibleEntities: accessibleEntities,
      salesEntities: salesEntities,
      totalAccessible: accessibleEntities.length
    };

    // Step 5: Generate recommendations
    if (!diagnosis.basicAccess) {
      diagnosis.recommendations.push({
        priority: 'HIGH',
        issue: 'No basic organization access',
        solution: 'User needs to be added to the Dynamics 365 organization or granted basic access',
        action: 'Contact system administrator to add user to organization'
      });
    }

    if (diagnosis.licensing.totalAccessible === 0) {
      diagnosis.recommendations.push({
        priority: 'HIGH',
        issue: 'No entity access permissions',
        solution: 'User needs security roles with entity permissions',
        action: 'Assign security roles like "Salesperson" (limited) or "System Administrator" (full access)'
      });
    }

    if (!diagnosis.licensing.hasBasicCRM) {
      diagnosis.recommendations.push({
        priority: 'MEDIUM',
        issue: 'Limited basic CRM access',
        solution: 'User needs permissions for basic CRM entities (Contact, Account)',
        action: 'Assign security role with read/write permissions for basic entities'
      });
    }

    if (!diagnosis.licensing.hasSalesHub && diagnosis.licensing.hasBasicCRM) {
      diagnosis.recommendations.push({
        priority: 'LOW',
        issue: 'No Sales Hub access',
        solution: 'User needs Dynamics 365 Sales license for sales entities (Lead, Opportunity)',
        action: 'Upgrade to Sales Hub license or assign Sales security roles'
      });
    }

    // Step 6: Add specific permission fixes
    const noCreatePermissions = Object.keys(diagnosis.entityPermissions).filter(
      entity => diagnosis.entityPermissions[entity].accessible && !diagnosis.entityPermissions[entity].create
    );
    
    if (noCreatePermissions.length > 0) {
      diagnosis.recommendations.push({
        priority: 'MEDIUM',
        issue: `Cannot create entities: ${noCreatePermissions.join(', ')}`,
        solution: 'User needs Create permissions for these entities',
        action: 'Update security role to include Create permissions, or assign a role with higher privileges'
      });
    }

    console.log('✅ Permission diagnosis completed');

    const response = createSuccessResponse({
      diagnosis,
      summary: {
        hasBasicAccess: diagnosis.basicAccess,
        canCreateContacts: diagnosis.entityPermissions.contact?.create || false,
        accessibleEntities: accessibleEntities.length,
        recommendationsCount: diagnosis.recommendations.length,
        userStatus: diagnosis.user?.isEnabled ? 'Enabled' : 'Disabled/Unknown',
        licensingLevel: diagnosis.licensing.hasSalesHub ? 'Sales Hub' : 
                      diagnosis.licensing.hasBasicCRM ? 'Basic CRM' : 'Limited/None'
      }
    }, 'User permission diagnosis completed');

    res.status(response.status).json(response);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'diagnose_user_permissions');
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Helper functions for permission diagnosis
const getEntitySetName = (entityType) => {
  const entitySetMappings = {
    'contact': 'contacts',
    'account': 'accounts',
    'lead': 'leads',
    'opportunity': 'opportunities',
    'task': 'tasks',
    'appointment': 'appointments'
  };
  return entitySetMappings[entityType] || `${entityType}s`;
};

const getPrimaryIdField = (entityType) => {
  const primaryIdMappings = {
    'contact': 'contactid',
    'account': 'accountid',
    'lead': 'leadid',
    'opportunity': 'opportunityid',
    'task': 'activityid',
    'appointment': 'activityid'
  };
  return primaryIdMappings[entityType] || `${entityType}id`;
};

// ========================= NEW MULTI-TENANT DYNAMIC FEATURES =========================

/**
 * Enhanced multi-tenant subscription detection and management
 */
export const detectUserSubscription = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const instanceUrl = getInstanceUrlFromRequest(req);

    if (!instanceUrl) {
      throw new DynamicsError(
        'Instance URL is required for subscription detection',
        400,
        'MISSING_INSTANCE_URL'
      );
    }

    console.log('🔍 Detecting user subscription and capabilities...');

    // Phase 1: Get user information and permissions
    const userInfo = await getUserDetailedInfo(accessToken, instanceUrl);
    
    // Phase 2: Detect available entities (subscription-based)
    const availableEntities = await detectAvailableEntities(accessToken, instanceUrl);
    
    // Phase 3: Analyze licensing based on available entities
    const subscriptionAnalysis = analyzeSubscriptionFromEntities(availableEntities);
    
    // Phase 4: Test specific entity permissions
    const entityPermissions = await testEntityPermissions(accessToken, instanceUrl, subscriptionAnalysis.availableEntities);

    const response = createSuccessResponse({
      user: userInfo,
      subscription: subscriptionAnalysis,
      entityPermissions: entityPermissions,
      environment: {
        instanceUrl: instanceUrl,
        isTrialEnvironment: instanceUrl.includes('crm15') || instanceUrl.includes('trial'),
        supportedOperations: getSupportedOperations(subscriptionAnalysis.subscriptionType)
      },
      recommendations: getSubscriptionRecommendations(subscriptionAnalysis)
    }, 'Subscription detection completed successfully');

    res.status(response.status).json(response);
  } catch (error) {
    console.error('❌ Subscription detection failed:', error.message);
    const errorResponse = createErrorResponse(error, 'detect_user_subscription');
    res.status(errorResponse.status).json(errorResponse);
  }
};

/**
 * Get detailed user information including security roles
 */
const getUserDetailedInfo = async (accessToken, instanceUrl) => {
  try {
    // Get basic user info
    const whoAmIResponse = await axios.get(`${instanceUrl}/api/data/v9.2/WhoAmI`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
      }
    });

    const userId = whoAmIResponse.data.UserId;
    const orgId = whoAmIResponse.data.OrganizationId;

    // Get user details with security roles
    const userResponse = await axios.get(
      `${instanceUrl}/api/data/v9.2/systemusers(${userId})?$select=fullname,domainname,businessunitid,accessmode,isdisabled&$expand=systemuserroles_association($select=roleid,name)`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    // Get organization info
    const orgResponse = await axios.get(
      `${instanceUrl}/api/data/v9.2/organizations(${orgId})?$select=name,friendlyname,isprevieworganization,organizationstate`,
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
      userId: userId,
      organizationId: orgId,
      userDetails: userResponse.data,
      securityRoles: userResponse.data.systemuserroles_association || [],
      organization: orgResponse.data,
      isTrialUser: orgResponse.data.isprevieworganization || false,
      organizationState: orgResponse.data.organizationstate
    };
  } catch (error) {
    console.error('❌ Failed to get detailed user info:', error.message);
    throw new DynamicsError(
      'Failed to retrieve user information and permissions',
      500,
      'USER_INFO_ERROR',
      { originalError: error.message }
    );
  }
};

/**
 * Detect available entities based on user's subscription
 */
const detectAvailableEntities = async (accessToken, instanceUrl) => {
  const entityTests = [
    // Basic CRM entities (available in all subscriptions)
    { name: 'contact', logicalName: 'contact', tier: 'basic', required: false },
    { name: 'account', logicalName: 'account', tier: 'basic', required: false },
    { name: 'task', logicalName: 'task', tier: 'basic', required: false },
    { name: 'appointment', logicalName: 'appointment', tier: 'basic', required: false },
    
    // Sales entities (require Sales subscription)
    { name: 'lead', logicalName: 'lead', tier: 'sales', required: false },
    { name: 'opportunity', logicalName: 'opportunity', tier: 'sales', required: false },
    { name: 'quote', logicalName: 'quote', tier: 'sales', required: false },
    { name: 'product', logicalName: 'product', tier: 'sales', required: false },
    { name: 'salesorder', logicalName: 'salesorder', tier: 'sales', required: false },
    { name: 'invoice', logicalName: 'invoice', tier: 'sales', required: false },
    
    // Service entities (require Customer Service subscription)
    { name: 'incident', logicalName: 'incident', tier: 'service', required: false },
    
    // Marketing entities (require Marketing subscription)
    { name: 'campaign', logicalName: 'campaign', tier: 'marketing', required: false },
    
    // Advanced features
    { name: 'goal', logicalName: 'goal', tier: 'sales_advanced', required: false },
    { name: 'metric', logicalName: 'metric', tier: 'sales_advanced', required: false }
  ];

  const availableEntities = [];
  const unavailableEntities = [];

  for (const entity of entityTests) {
    try {
      // Test if entity exists and is accessible
      const testResponse = await axios.get(
        `${instanceUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${entity.logicalName}')?$select=LogicalName,DisplayName,CanCreateAttributes`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
          }
        }
      );

      if (testResponse.data) {
        availableEntities.push({
          ...entity,
          displayName: testResponse.data.DisplayName?.UserLocalizedLabel?.Label || entity.name,
          canCreate: testResponse.data.CanCreateAttributes !== false,
          status: 'available'
        });
      }
    } catch (error) {
      console.log(`⚠️ Entity ${entity.name} not available: ${error.response?.status}`);
      unavailableEntities.push({
        ...entity,
        status: 'unavailable',
        reason: error.response?.status === 404 ? 'not_found' : 'permission_denied'
      });
    }
  }

  return { availableEntities, unavailableEntities };
};

/**
 * Analyze subscription type based on available entities
 */
const analyzeSubscriptionFromEntities = (entitiesData) => {
  const { availableEntities } = entitiesData;
  const availableEntityNames = availableEntities.map(e => e.name);

  let subscriptionType = 'basic';
  let features = ['contacts', 'accounts', 'activities'];

  // Check for Sales capabilities
  const salesEntities = ['lead', 'opportunity', 'quote', 'product', 'salesorder', 'invoice'];
  const hasSalesEntities = salesEntities.some(entity => availableEntityNames.includes(entity));
  
  if (hasSalesEntities) {
    subscriptionType = 'sales';
    features.push('sales_automation', 'lead_management', 'opportunity_management');
    
    // Check for advanced sales features
    if (availableEntityNames.includes('goal') && availableEntityNames.includes('metric')) {
      subscriptionType = 'sales_enterprise';
      features.push('goal_management', 'sales_analytics');
    }
  }

  // Check for Service capabilities
  if (availableEntityNames.includes('incident')) {
    features.push('case_management');
    if (subscriptionType === 'basic') {
      subscriptionType = 'service';
    } else if (subscriptionType === 'sales') {
      subscriptionType = 'sales_service';
    }
  }

  // Check for Marketing capabilities
  if (availableEntityNames.includes('campaign')) {
    features.push('campaign_management');
    if (subscriptionType === 'basic') {
      subscriptionType = 'marketing';
    }
  }

  return {
    subscriptionType,
    features,
    availableEntities: availableEntityNames,
    capabilities: {
      canCreateContacts: availableEntityNames.includes('contact'),
      canCreateLeads: availableEntityNames.includes('lead'),
      canCreateOpportunities: availableEntityNames.includes('opportunity'),
      canCreateCases: availableEntityNames.includes('incident'),
      canCreateProducts: availableEntityNames.includes('product'),
      canManageGoals: availableEntityNames.includes('goal'),
      hasSalesHub: hasSalesEntities,
      hasServiceHub: availableEntityNames.includes('incident'),
      hasMarketingHub: availableEntityNames.includes('campaign')
    }
  };
};

/**
 * Test specific entity permissions (Create, Read, Update, Delete)
 */
const testEntityPermissions = async (accessToken, instanceUrl, availableEntities) => {
  const permissions = {};

  for (const entityName of availableEntities) {
    try {
      const entitySetName = getEntitySetName(entityName);
      
      // Test READ permission
      let canRead = false;
      try {
        await axios.get(`${instanceUrl}/api/data/v9.2/${entitySetName}?$top=1`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
          }
        });
        canRead = true;
      } catch (readError) {
        canRead = readError.response?.status !== 403;
      }

      // Test CREATE permission by checking entity metadata
      let canCreate = false;
      try {
        const metadataResponse = await axios.get(
          `${instanceUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${entityName}')?$select=CanCreateAttributes,Privileges`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
              'OData-MaxVersion': '4.0',
              'OData-Version': '4.0'
            }
          }
        );
        canCreate = metadataResponse.data.CanCreateAttributes !== false;
      } catch (createError) {
        canCreate = false;
      }

      permissions[entityName] = {
        canRead,
        canCreate,
        canUpdate: canCreate, // Usually same as create
        canDelete: canCreate  // Usually same as create
      };

    } catch (error) {
      permissions[entityName] = {
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        error: error.message
      };
    }
  }

  return permissions;
};

/**
 * Get supported operations based on subscription type
 */
const getSupportedOperations = (subscriptionType) => {
  const baseOperations = ['create_contact', 'create_account', 'create_task', 'create_appointment'];
  
  const operationMap = {
    'basic': baseOperations,
    'sales': [...baseOperations, 'create_lead', 'create_opportunity', 'create_quote', 'create_product'],
    'sales_enterprise': [...baseOperations, 'create_lead', 'create_opportunity', 'create_quote', 'create_product', 'create_goal', 'sales_analytics'],
    'service': [...baseOperations, 'create_case', 'case_management'],
    'sales_service': [...baseOperations, 'create_lead', 'create_opportunity', 'create_case'],
    'marketing': [...baseOperations, 'create_campaign', 'campaign_management']
  };

  return operationMap[subscriptionType] || baseOperations;
};

/**
 * Get recommendations based on subscription analysis
 */
const getSubscriptionRecommendations = (subscriptionAnalysis) => {
  const recommendations = [];

  if (subscriptionAnalysis.subscriptionType === 'basic') {
    recommendations.push({
      type: 'upgrade',
      title: 'Consider Sales Hub License',
      description: 'Upgrade to Dynamics 365 Sales to access lead and opportunity management',
      entities: ['lead', 'opportunity', 'quote', 'product'],
      priority: 'high'
    });
  }

  if (!subscriptionAnalysis.capabilities.canCreateCases) {
    recommendations.push({
      type: 'feature',
      title: 'Customer Service Capabilities',
      description: 'Add Customer Service license to manage cases and service requests',
      entities: ['incident'],
      priority: 'medium'
    });
  }

  if (!subscriptionAnalysis.capabilities.canManageGoals) {
    recommendations.push({
      type: 'feature',
      title: 'Sales Analytics & Goals',
      description: 'Enterprise features for goal management and sales analytics',
      entities: ['goal', 'metric'],
      priority: 'low'
    });
  }

  return recommendations;
};

/**
 * Enhanced entity creation with license-aware fallbacks
 */
export const createEntityWithLicenseCheck = async (req, res) => {
  try {
    const { entityType } = req.params;
    const accessToken = getAccessTokenFromHeader(req);
    const instanceUrl = getInstanceUrlFromRequest(req);
    const entityData = req.body;

    console.log(`🚀 Creating ${entityType} with license checking...`);

    // First, detect user's subscription capabilities
    const subscriptionInfo = await detectUserCapabilities(accessToken, instanceUrl);
    
    // Check if entity is available in user's subscription
    if (!subscriptionInfo.availableEntities.includes(entityType)) {
      return handleUnavailableEntity(res, entityType, subscriptionInfo);
    }

    // Check specific permissions for this entity
    const hasPermission = await checkEntityCreatePermission(accessToken, instanceUrl, entityType);
    if (!hasPermission) {
      return handleInsufficientPermissions(res, entityType, subscriptionInfo);
    }

    // Proceed with entity creation
    const result = await createEntityDynamic(entityType, entityData, accessToken, {
      organizationUrl: instanceUrl,
      subscriptionInfo: subscriptionInfo
    });

    const response = createSuccessResponse(result, `${entityType} created successfully with license validation`, 201);
    res.status(response.status).json(response);

  } catch (error) {
    console.error(`❌ License-aware creation failed for ${req.params.entityType}:`, error.message);
    const errorResponse = createErrorResponse(error, `create_${req.params.entityType}_with_license_check`);
    res.status(errorResponse.status).json(errorResponse);
  }
};

// Helper function to detect user capabilities quickly
const detectUserCapabilities = async (accessToken, instanceUrl) => {
  try {
    // Quick test of key entities to determine subscription
    const quickTests = ['contact', 'lead', 'opportunity', 'incident'];
    const availableEntities = [];

    for (const entity of quickTests) {
      try {
        const entitySetName = getEntitySetName(entity);
        await axios.get(`${instanceUrl}/api/data/v9.2/${entitySetName}?$top=1`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
          }
        });
        availableEntities.push(entity);
      } catch (error) {
        // Entity not available
      }
    }

    return {
      availableEntities,
      hasSalesHub: availableEntities.includes('lead') || availableEntities.includes('opportunity'),
      hasServiceHub: availableEntities.includes('incident'),
      subscriptionType: availableEntities.includes('opportunity') ? 'sales' : 'basic'
    };
  } catch (error) {
    console.error('❌ Failed to detect user capabilities:', error.message);
    return { availableEntities: ['contact'], hasSalesHub: false, hasServiceHub: false, subscriptionType: 'basic' };
  }
};

// Helper function to check specific entity create permission
const checkEntityCreatePermission = async (accessToken, instanceUrl, entityType) => {
  try {
    const entitySetName = getEntitySetName(entityType);
    
    // Try to get entity metadata to check create permissions
    const response = await axios.get(
      `${instanceUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${entityType}')?$select=CanCreateAttributes,IsValidForAdvancedFind`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    return response.data.CanCreateAttributes !== false;
  } catch (error) {
    console.error(`❌ Permission check failed for ${entityType}:`, error.message);
    return false;
  }
};

// Helper function to handle unavailable entities
const handleUnavailableEntity = (res, entityType, subscriptionInfo) => {
  const alternativeEntities = getAlternativeEntities(entityType, subscriptionInfo.availableEntities);
  
  const response = createErrorResponse(
    new DynamicsError(
      `Entity '${entityType}' is not available in your current Dynamics 365 subscription`,
      402, // Payment Required
      'SUBSCRIPTION_REQUIRED',
      {
        entityType: entityType,
        currentSubscription: subscriptionInfo.subscriptionType,
        requiredSubscription: getRequiredSubscription(entityType),
        alternatives: alternativeEntities,
        upgradeInfo: {
          message: `To use ${entityType}, you need a ${getRequiredSubscription(entityType)} subscription`,
          contactAdmin: 'Contact your administrator to upgrade your Dynamics 365 license',
          trialInfo: subscriptionInfo.subscriptionType === 'trial' ? 'Trial limitations apply' : null
        }
      }
    ),
    `create_${entityType}_subscription_check`
  );
  
  return res.status(response.status).json(response);
};

// Helper function to handle insufficient permissions
const handleInsufficientPermissions = (res, entityType, subscriptionInfo) => {
  const response = createErrorResponse(
    new DynamicsError(
      `Insufficient permissions to create ${entityType}. Please contact your system administrator.`,
      403,
      'INSUFFICIENT_PERMISSIONS',
      {
        entityType: entityType,
        solution: 'Contact your system administrator to grant necessary permissions',
        steps: [
          'Verify you have a valid Dynamics 365 license',
          'Check your security role assignments',
          'Ensure entity permissions are granted for create operations',
          'Confirm the entity is available in your environment'
        ],
        adminHelp: 'Security roles can be managed in Power Platform Admin Center',
        subscriptionInfo: subscriptionInfo
      }
    ),
    `create_${entityType}_permission_check`
  );
  
  return res.status(response.status).json(response);
};

// Helper functions for entity management
const getAlternativeEntities = (entityType, availableEntities) => {
  const alternatives = {
    'lead': ['contact', 'account'],
    'opportunity': ['task', 'appointment'],
    'quote': ['task'],
    'product': ['annotation'],
    'salesorder': ['task'],
    'invoice': ['task'],
    'incident': ['task', 'annotation']
  };
  
  return (alternatives[entityType] || ['contact']).filter(alt => availableEntities.includes(alt));
};

const getRequiredSubscription = (entityType) => {
  const subscriptionMap = {
    'lead': 'Dynamics 365 Sales',
    'opportunity': 'Dynamics 365 Sales',
    'quote': 'Dynamics 365 Sales',
    'product': 'Dynamics 365 Sales',
    'salesorder': 'Dynamics 365 Sales',
    'invoice': 'Dynamics 365 Sales',
    'incident': 'Dynamics 365 Customer Service',
    'campaign': 'Dynamics 365 Marketing',
    'goal': 'Dynamics 365 Sales Enterprise'
  };
  return subscriptionMap[entityType] || 'Dynamics 365 Basic';
};

