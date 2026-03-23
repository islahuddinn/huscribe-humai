import axios from 'axios';
import 'dotenv/config';

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REDIRECT_URI = process.env.ZOHO_REDIRECT_URI;
const ZOHO_ACCOUNTS_URL = process.env.ZOHO_ACCOUNTS_URL;
const ZOHO_CRM_API_URL = process.env.ZOHO_CRM_API_URL;


// Revoke Access Token
export const revokeAccessToken = async (accessToken) => {
  const url = `${ZOHO_ACCOUNTS_URL}/oauth/v2/token/revoke`;
  const params = new URLSearchParams();
  params.append('token', accessToken);

  try {
    const response = await axios.post(url, params);
    return response.data;
  } catch (error) {
    console.error('Error revoking access token:', error.response ? error.response.data : error.message);
    throw error;
  }
};
// Refresh Access Token
export async function refreshAccessToken(refreshToken) {
  if (!ZOHO_ACCOUNTS_URL) {
    throw new Error('ZOHO_ACCOUNTS_URL environment variable is not set');
  }
  
  if (!ZOHO_CLIENT_ID) {
    throw new Error('ZOHO_CLIENT_ID environment variable is not set');
  }
  
  if (!ZOHO_CLIENT_SECRET) {
    throw new Error('ZOHO_CLIENT_SECRET environment variable is not set');
  }
  
  if (!refreshToken) {
    throw new Error('Refresh token is missing or invalid');
  }

  const url = `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`;
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('client_id', ZOHO_CLIENT_ID);
  params.append('client_secret', ZOHO_CLIENT_SECRET);
  params.append('refresh_token', refreshToken);

  console.log('Making refresh token request to:', url);
  console.log('Using client ID:', ZOHO_CLIENT_ID ? `${ZOHO_CLIENT_ID.substring(0, 5)}...` : 'Missing');
  console.log('Using client secret:', ZOHO_CLIENT_SECRET ? `${ZOHO_CLIENT_SECRET.substring(0, 5)}...` : 'Missing');
  console.log('Using refresh token:', refreshToken ? `${refreshToken.substring(0, 5)}...` : 'Missing');

  try {
    console.log('Full request parameters:', Object.fromEntries(params));
    
    const response = await axios.post(url, params, {
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      validateStatus: function (status) {
        return status < 500; // Resolve only if the status code is less than 500
      }
    });
    
    console.log('Refresh token response status:', response.status);
    console.log('Refresh token response headers:', response.headers);
    console.log('Refresh token raw response:', response.data);
    
    // Check for error in response even with 200 status
    if (response.data && response.data.error) {
      console.error(`Zoho API returned error: ${response.data.error}`);
      
      if (response.data.error === 'invalid_code') {
        throw new Error('The refresh token is invalid or has expired. Please get a new refresh token by initiating a new OAuth flow.');
      } else if (response.data.error === 'invalid_client') {
        throw new Error('Invalid client credentials (client_id or client_secret)');
      } else {
        throw new Error(`Zoho API error: ${response.data.error}`);
      }
    }
    
    if (response.status !== 200) {
      console.error('Non-200 response:', response.status, response.data);
      throw new Error(`Zoho API returned status ${response.status}: ${JSON.stringify(response.data)}`);
    }
    
    if (!response.data || !response.data.access_token) {
      console.error('Invalid response format:', response.data);
      throw new Error('Invalid response format from Zoho API');
    }
    
    console.log('Successfully received new access token');
    
    // Return the full token response data
    return response.data;
  } catch (error) {
    console.error('Error refreshing access token:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data));
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received. Request:', error.request);
    }
    
    // Provide a more specific error based on common issues
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 400) {
        if (data.error === 'invalid_client') {
          throw new Error('Invalid client credentials (client_id or client_secret)');
        } else if (data.error === 'invalid_grant') {
          throw new Error('Invalid or expired refresh token');
        } else {
          throw new Error(`Bad request: ${data.error || JSON.stringify(data)}`);
        }
      } else if (status === 401) {
        throw new Error('Authentication failed. Check your client credentials.');
      }
    }
    
    throw error;
  }
}

export const getAccessTokenFromHeader = (req) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Access token is missing or invalid');
  }
  return authHeader.split(' ')[1];
};

// Enhanced function to handle token validation and refresh
export const validateAndRefreshToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: false,
        crmType: 'zoho',
        error: 'Access token is missing or invalid',
        code: 'MISSING_ACCESS_TOKEN',
        solution: 'Provide a valid access token in the Authorization header: Bearer <token>'
      });
    }
    
    const accessToken = authHeader.split(' ')[1];
    
    // Test the token with a lightweight API call
    try {
      await axios.get('https://www.zohoapis.com/crm/v2/settings/modules', {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      // Token is valid, continue with the request
      next();
      
    } catch (tokenError) {
      if (tokenError.response?.status === 401) {
        // Token is invalid/expired, try to refresh if refresh token is provided
        const refreshToken = req.headers['x-zoho-refresh-token'] || 
                            req.headers['x-refresh-token'] ||
                            req.body?.refresh_token ||
                            req.query?.refresh_token;
        
        if (refreshToken) {
          try {
            console.log('Attempting automatic token refresh...');
            const newTokenData = await refreshAccessToken(refreshToken);
            
            // Set the new token in the response headers
            res.setHeader('X-New-Access-Token', newTokenData.access_token);
            res.setHeader('X-Token-Refreshed', 'true');
            
            // Update the request headers for this request
            req.headers['authorization'] = `Bearer ${newTokenData.access_token}`;
            
            console.log('Token refreshed successfully, continuing with request');
            next();
            
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError.message);
            return res.status(401).json({
              status: false,
              crmType: 'zoho',
              error: 'Token expired and refresh failed',
              code: 'TOKEN_REFRESH_FAILED',
              details: refreshError.message,
              solution: 'Re-authenticate the user: GET /api/zoho/auth/url?platform=web'
            });
          }
        } else {
          return res.status(401).json({
            status: false,
            crmType: 'zoho',
            error: 'Access token is invalid or expired',
            code: 'INVALID_ACCESS_TOKEN',
            solution: 'Provide a refresh token in x-zoho-refresh-token header or use POST /api/zoho/auth/refresh'
          });
        }
      } else {
        // Other error, pass it through
        throw tokenError;
      }
    }
    
  } catch (error) {
    console.error('Token validation error:', error.message);
    return res.status(500).json({
      status: false,
      crmType: 'zoho',
      error: 'Token validation failed',
      code: 'VALIDATION_ERROR',
      details: error.message
    });
  }
};

// Enhanced error handling utility
export const createZohoError = (type, message, details = {}) => {
  const errorTypes = {
    AUTHENTICATION: {
      code: 'ZOHO_AUTH_ERROR',
      status: 401,
      category: 'Authentication',
      solutions: [
        'Refresh your access token using POST /api/zoho/auth/refresh',
        'Re-authenticate using GET /api/zoho/auth/url',
        'Check if your token has the required scopes'
      ]
    },
    PERMISSION: {
      code: 'ZOHO_PERMISSION_ERROR',
      status: 403,
      category: 'Authorization',
      solutions: [
        'Ensure your token has the required module permissions',
        'Check module access in Zoho CRM settings',
        'Request necessary permissions from your Zoho CRM administrator'
      ]
    },
    MODULE: {
      code: 'ZOHO_MODULE_ERROR',
      status: 400,
      category: 'Module Configuration',
      solutions: [
        'Verify the module name is correct',
        'Check if the module exists in your Zoho CRM setup',
        'Use GET /api/zoho/modules to list available modules'
      ]
    },
    FIELD: {
      code: 'ZOHO_FIELD_ERROR',
      status: 400,
      category: 'Field Configuration',
      solutions: [
        'Verify field names using GET /api/zoho/fields/{module}',
        'Check if the fields are searchable',
        'Ensure field names match the API names exactly'
      ]
    },
    SEARCH: {
      code: 'ZOHO_SEARCH_ERROR',
      status: 400,
      category: 'Search Operation',
      solutions: [
        'Verify search query format',
        'Check if search fields are valid',
        'Try reducing the complexity of your search'
      ]
    },
    API: {
      code: 'ZOHO_API_ERROR',
      status: 500,
      category: 'API',
      solutions: [
        'Check Zoho CRM API status',
        'Verify API rate limits',
        'Try the operation again later'
      ]
    },
    RATE_LIMIT: {
      code: 'ZOHO_RATE_LIMIT_ERROR',
      status: 429,
      category: 'Rate Limit',
      solutions: [
        'Implement request throttling',
        'Use pagination to reduce request size',
        'Wait before retrying the request'
      ]
    }
  };

  const errorType = errorTypes[type] || {
    code: 'ZOHO_UNKNOWN_ERROR',
    status: 500,
    category: 'Unknown',
    solutions: ['Contact support if the issue persists']
  };

  return {
    success: false,
    status: errorType.status,
    error: {
      code: errorType.code,
      message: message,
      category: errorType.category,
      details: details,
      solutions: errorType.solutions,
      timestamp: new Date().toISOString(),
      requestId: `zoho-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  };
};

// Enhanced error handler for Zoho API responses
export const handleZohoApiError = (error, res, context = 'API call') => {
  console.error(`Zoho ${context} error:`, error.message);
  
  if (error.response) {
    const { status, data } = error.response;
    
    // Map common Zoho error codes to our error types
    switch (status) {
      case 401:
        return res.status(401).json(createZohoError('AUTHENTICATION', 
          'Authentication failed or token expired',
          {
            zoho_error: data?.code,
            original_error: data?.message,
            context: context
          }
        ));
        
      case 403:
        return res.status(403).json(createZohoError('PERMISSION',
          'Insufficient permissions for this operation',
          {
            zoho_error: data?.code,
            required_scopes: ['ZohoCRM.modules.ALL', 'ZohoCRM.settings.ALL'],
            context: context
          }
        ));
        
      case 429:
        return res.status(429).json(createZohoError('RATE_LIMIT',
          'Rate limit exceeded for Zoho CRM API',
          {
            zoho_error: data?.code,
            retry_after: error.response.headers['retry-after'],
            context: context
          }
        ));
        
      case 400:
        if (data?.code === 'INVALID_MODULE') {
          return res.status(400).json(createZohoError('MODULE',
            'Invalid or unsupported module specified',
            {
              zoho_error: data?.code,
              module: data?.details?.module,
              context: context
            }
          ));
        } else if (data?.code === 'INVALID_FIELD') {
          return res.status(400).json(createZohoError('FIELD',
            'One or more invalid fields specified',
            {
              zoho_error: data?.code,
              invalid_fields: data?.details?.fields,
              context: context
            }
          ));
        }
        return res.status(400).json(createZohoError('SEARCH',
          'Invalid search parameters',
          {
            zoho_error: data?.code,
            details: data?.message,
            context: context
          }
        ));
        
      case 500:
      case 502:
      case 503:
      case 504:
        return res.status(500).json(createZohoError('API',
          'Zoho CRM service is currently unavailable',
          {
            zoho_error: data?.code,
            http_status: status,
            context: context
          }
        ));
        
      default:
        return res.status(status).json(createZohoError('API',
          'Unexpected error from Zoho CRM API',
          {
            zoho_error: data?.code,
            http_status: status,
            details: data,
            context: context
          }
        ));
    }
  } else if (error.code === 'ENOTFOUND') {
    return res.status(500).json(createZohoError('API',
      'Cannot connect to Zoho CRM servers',
      {
        error_code: error.code,
        context: context,
        details: 'DNS resolution failed'
      }
    ));
  } else if (error.code === 'ECONNREFUSED') {
    return res.status(500).json(createZohoError('API',
      'Connection refused by Zoho CRM servers',
      {
        error_code: error.code,
        context: context
      }
    ));
  } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    return res.status(500).json(createZohoError('API',
      'Request to Zoho CRM API timed out',
      {
        error_code: error.code,
        context: context,
        timeout: error.config?.timeout
      }
    ));
  }
  
  return res.status(500).json(createZohoError('API',
    'Unexpected error while communicating with Zoho CRM',
    {
      error_message: error.message,
      error_code: error.code,
      context: context
    }
  ));
};

// Fetch All Records

export async function fetchAllFromZoho(module, accessToken, queryParams = {}) {
  const url = `${ZOHO_CRM_API_URL}/${module}`;
  const headers = {
    Authorization: `Zoho-oauthtoken ${accessToken}`,
  };

  try {
    const response = await axios.get(url, { headers, params: queryParams });

    const data = response.data.data;
    const total = response.data.info?.count || 0;

    return { data, total };
  } catch (error) {
    console.error(`Error fetching ${module}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

// Fetch One Record by ID
export async function fetchOneFromZoho(module, accessToken, recordId) {
  const url = `${ZOHO_CRM_API_URL}/${module}/${recordId}`;
  const headers = {
    Authorization: `Zoho-oauthtoken ${accessToken}`,
  };

  try {
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${module} with ID ${recordId}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

// Create or Update Record
export async function createOrUpdateInZoho(module, accessToken, data, recordId = null) {
  const url = recordId ? `${ZOHO_CRM_API_URL}/${module}/${recordId}` : `${ZOHO_CRM_API_URL}/${module}`;
  const method = recordId ? 'put' : 'post';
  const headers = {
    Authorization: `Zoho-oauthtoken ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const payload = {
    ...data,
    $se_module: module,
  };

  try {
    const response = await axios[method](url, { data: [payload] }, { headers });
    return response.data;
  } catch (error) {
    console.error(`Error in ${method === 'post' ? 'creating' : 'updating'} ${module}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}
// Delete Record
export async function deleteFromZoho(module, accessToken, recordId) {
  const url = `${ZOHO_CRM_API_URL}/${module}/${recordId}`;
  const headers = {
    Authorization: `Zoho-oauthtoken ${accessToken}`,
  };

  try {
    const response = await axios.delete(url, { headers });
    return response.data;
  } catch (error) {
    console.error(`Error deleting ${module} with ID ${recordId}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

////========Searching=====///

export const searchInZoho = async (module, accessToken, searchQuery) => {
  const url = `${ZOHO_CRM_API_URL}/${module}/search`;
  const headers = {
    Authorization: `Zoho-oauthtoken ${accessToken}`,
  };

  let criteria = '';
  switch (module) {
    case 'Contacts':
      criteria = `(Email:equals:${searchQuery}) or (First_Name:equals:${searchQuery}) or (Last_Name:equals:${searchQuery})`;
      break;
    case 'Leads':
      criteria = `(Email:equals:${searchQuery}) or (First_Name:equals:${searchQuery}) or (Last_Name:equals:${searchQuery}) or (Company:equals:${searchQuery})`;
      break;
    case 'Accounts':
      criteria = `(Account_Name:equals:${searchQuery}) or (Phone:equals:${searchQuery})`;
      break;
    case 'Tasks':
      criteria = `(Subject:equals:${searchQuery})`;
      break;
    case 'Events':
      criteria = `(Subject:equals:${searchQuery}) or (Location:equals:${searchQuery})`;
      break;
    default:
      throw new Error(`Unsupported module: ${module}`);
  }

  const params = { criteria };

  console.log(params, "Here are the params=======");

  try {
    const response = await axios.get(url, { headers, params });

    if (response.status === 204) {
      return [];
    }

    return response.data.data;
  } catch (error) {
    console.error(`Error searching in ${module}:`, error.response ? error.response.data : error.message);
    throw error;
  }
};

// Enhanced robust search function
export const enhancedSearchInZoho = async (module, accessToken, searchQuery = null, searchFields = [], page = 1, per_page = 200) => {
  const baseUrl = `${ZOHO_CRM_API_URL}/${module}`;
  const headers = {
    Authorization: `Zoho-oauthtoken ${accessToken}`,
  };

  try {
    // If no search query is provided, return all records from the module
    if (!searchQuery || searchQuery.trim() === '') {
      console.log(`No search query provided. Fetching all records from ${module}...`);
      
      const params = {
        page: page,
        per_page: per_page
      };
      
      const response = await axios.get(baseUrl, { headers, params });
      
      if (response.status === 204) {
        return { data: [], total: 0, hasMore: false };
      }
      
      return {
        data: response.data.data || [],
        total: response.data.info?.count || 0,
        hasMore: response.data.info?.more_records || false,
        page: page,
        per_page: per_page
      };
    }

    // Enhanced search with dynamic field detection
    const searchUrl = `${baseUrl}/search`;
    
    // Get all available fields for the module dynamically
    const moduleFields = await getModuleFieldsFromZoho(module, accessToken);
    
    // Determine which fields to search in
    let fieldsToSearch = [];
    
    if (searchFields && searchFields.length > 0) {
      // Use specified fields
      fieldsToSearch = searchFields.filter(field => moduleFields.includes(field));
    } else {
      // Use all searchable fields for the module
      fieldsToSearch = getDefaultSearchableFieldsForModule(module, moduleFields);
    }
    
    if (fieldsToSearch.length === 0) {
      throw new Error(`No searchable fields available for module: ${module}`);
    }
    
    // Build comprehensive search criteria
    const searchCriteria = buildSearchCriteria(fieldsToSearch, searchQuery);
    
    const params = {
      criteria: searchCriteria,
      page: page,
      per_page: per_page
    };

    console.log(`Searching in ${module} with criteria:`, params.criteria);

    const response = await axios.get(searchUrl, { headers, params });

    if (response.status === 204) {
      return { data: [], total: 0, hasMore: false };
    }

    return {
      data: response.data.data || [],
      total: response.data.info?.count || 0,
      hasMore: response.data.info?.more_records || false,
      page: page,
      per_page: per_page,
      searchQuery: searchQuery,
      searchFields: fieldsToSearch
    };

  } catch (error) {
    console.error(`Error in enhanced search for ${module}:`, error.response ? error.response.data : error.message);
    
    // If search fails, try fallback to basic fetch
    if (error.response?.status === 400 && searchQuery) {
      console.log(`Search failed, falling back to fetch all and filter locally...`);
      return await fallbackLocalSearch(module, accessToken, searchQuery, page, per_page);
    }
    
    throw error;
  }
};

// Get module fields dynamically from Zoho
const getModuleFieldsFromZoho = async (module, accessToken) => {
  try {
    const response = await axios.get(
      `https://www.zohoapis.com/crm/v2/settings/fields?module=${module}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.fields
      .filter(field => field.searchable && !field.system_mandatory)
      .map(field => field.api_name);
  } catch (error) {
    console.warn(`Could not fetch fields for ${module}, using default fields`);
    return getDefaultSearchableFieldsForModule(module);
  }
};

// Get default searchable fields for a module
const getDefaultSearchableFieldsForModule = (module, availableFields = []) => {
  const defaultFields = {
    'Leads': ['First_Name', 'Last_Name', 'Email', 'Phone', 'Mobile', 'Company', 'Designation', 'Lead_Source', 'Lead_Status', 'Industry', 'Website', 'Description', 'Street', 'City', 'State', 'Country', 'Zip_Code'],
    'Contacts': ['First_Name', 'Last_Name', 'Email', 'Phone', 'Mobile', 'Title', 'Department', 'Account_Name', 'Mailing_Street', 'Mailing_City', 'Mailing_State', 'Mailing_Country', 'Description', 'Skype_ID'],
    'Accounts': ['Account_Name', 'Phone', 'Website', 'Industry', 'Type', 'Billing_Street', 'Billing_City', 'Billing_State', 'Billing_Country', 'Billing_Code', 'Description', 'Annual_Revenue'],
    'Deals': ['Deal_Name', 'Stage', 'Amount', 'Expected_Revenue', 'Type', 'Lead_Source', 'Description', 'Next_Step'],
    'Tasks': ['Subject', 'Status', 'Priority', 'Description'],
    'Events': ['Subject', 'Location', 'Description', 'Status', 'Priority'],
    'Campaigns': ['Campaign_Name', 'Type', 'Status', 'Description'],
    'Products': ['Product_Name', 'Product_Code', 'Description', 'Category', 'Manufacturer', 'Product_Category', 'Vendor_Name'],
    'Quotes': ['Subject', 'Quote_Stage', 'Terms_and_Conditions', 'Description'],
    'Sales_Orders': ['Subject', 'Status', 'Description'],
    'Invoices': ['Subject', 'Status', 'Description'],
    'Notes': ['Note_Title', 'Note_Content'],
    'Cases': ['Subject', 'Description', 'Status', 'Priority', 'Type', 'Origin'],
    'Solutions': ['Solution_Title', 'Solution_Type', 'Status', 'Description'],
    'Price_Books': ['Name', 'Description', 'Status'],
    'Vendors': ['Vendor_Name', 'Email', 'Phone', 'Website', 'Street', 'City', 'State', 'Country'],
    'Calls': ['Subject', 'Call_Type', 'Call_Start_Time', 'Description', 'Call_Result']
  };
  
  const moduleDefaults = defaultFields[module] || ['Name', 'Subject', 'Description'];
  
  // If we have available fields from Zoho, filter defaults to only include available ones
  if (availableFields.length > 0) {
    return moduleDefaults.filter(field => availableFields.includes(field));
  }
  
  return moduleDefaults;
};

// Build comprehensive search criteria
const buildSearchCriteria = (fields, searchQuery) => {
  const searchTerm = searchQuery.trim();
  
  // Build OR conditions for all fields
  const conditions = fields.map(field => {
    // Try different search operators
    return [
      `(${field}:contains:${searchTerm})`,
      `(${field}:starts_with:${searchTerm})`,
      `(${field}:equals:${searchTerm})`
    ].join(' or ');
  });
  
  return `(${conditions.join(' or ')})`;
};

// Fallback local search when API search fails
const fallbackLocalSearch = async (module, accessToken, searchQuery, page = 1, per_page = 200) => {
  try {
    console.log(`Performing fallback local search for "${searchQuery}" in ${module}`);
    
    // Fetch all records
    const allRecords = await fetchAllFromZoho(module, accessToken, { page, per_page });
    
    if (!allRecords.data || allRecords.data.length === 0) {
      return { data: [], total: 0, hasMore: false };
    }
    
    // Filter locally
    const searchTerm = searchQuery.toLowerCase();
    const filteredData = allRecords.data.filter(record => {
      return Object.values(record).some(value => {
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchTerm);
      });
    });
    
    return {
      data: filteredData,
      total: filteredData.length,
      hasMore: false,
      searchQuery: searchQuery,
      searchMethod: 'local_fallback'
    };
    
  } catch (error) {
    console.error('Fallback search also failed:', error.message);
    throw error;
  }
};

// Multi-module search function
export const searchMultipleModules = async (accessToken, searchQuery, modules = [], page = 1, per_page = 50) => {
  const defaultModules = ['Leads', 'Contacts', 'Accounts', 'Deals', 'Tasks', 'Events'];
  const modulesToSearch = modules.length > 0 ? modules : defaultModules;
  
  const searchPromises = modulesToSearch.map(async (module) => {
    try {
      const result = await enhancedSearchInZoho(module, accessToken, searchQuery, [], page, per_page);
      return {
        module,
        success: true,
        ...result
      };
    } catch (error) {
      console.error(`Search failed for module ${module}:`, error.message);
      return {
        module,
        success: false,
        error: error.message,
        data: []
      };
    }
  });
  
  const results = await Promise.allSettled(searchPromises);
  
  return results.map(result => result.status === 'fulfilled' ? result.value : result.reason);
};