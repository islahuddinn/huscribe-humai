import {
  fetchAllFromZoho,
  fetchOneFromZoho,
  createOrUpdateInZoho,
  deleteFromZoho,
  getAccessTokenFromHeader,
  searchInZoho,
  enhancedSearchInZoho,
  searchMultipleModules,
  handleZohoApiError,
  validateAndRefreshToken
} from '../utils/zohoUtils.js';
import axios from 'axios';

// Helper function to find Products module
const findProductsModule = async (accessToken) => {
  try {
    const modulesResponse = await axios.get(
      'https://www.zohoapis.com/crm/v2/settings/modules',
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const availableModules = modulesResponse.data.modules || [];
    
    // Try to find the Products module by different possible names
    const possibleProductModuleNames = [
      'Products',
      'Product',
      'Items',
      'Inventory',
      'Catalogue',
      'Catalog'
    ];

    for (const moduleName of possibleProductModuleNames) {
      const productsModule = availableModules.find(
        module => 
          module.module_name === moduleName || 
          module.api_name === moduleName ||
          module.module_name.toLowerCase() === moduleName.toLowerCase() ||
          module.api_name.toLowerCase() === moduleName.toLowerCase()
      );
      if (productsModule) {
        return {
          success: true,
          module: productsModule,
          availableModules
        };
      }
    }

    return {
      success: false,
      module: null,
      availableModules,
      error: 'Products module not found'
    };

  } catch (error) {
    console.error('Error fetching modules:', error.response?.data || error.message);
    return {
      success: false,
      module: null,
      availableModules: [],
      error: error.response?.data || error.message
    };
  }
};

// Function to validate token scopes
const validateTokenScopes = async (accessToken) => {
  try {
    const response = await axios.get('https://www.zohoapis.com/crm/v2/settings/modules', {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    return { isValid: true, data: response.data };
  } catch (error) {
    if (error.response?.data?.code === 'OAUTH_SCOPE_MISMATCH') {
      return { isValid: false, error: 'Token scope mismatch' };
    }
    throw error;
  }
};

// Function to refresh token
const refreshZohoToken = async (refreshToken) => {
  try {
    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        refresh_token: refreshToken,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    throw new Error('Failed to refresh token');
  }
};

// Create a Lead
export const createLead = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newLead } = req.body;

    const zohoResponse = await createOrUpdateInZoho('Leads', accessToken, newLead);

    if (!newLead.First_Name || !newLead.Last_Name || !newLead.Email) {
      throw new Error('Required fields (First_Name, Last_Name, Email) are missing in the Zoho response');
    }

    res.json({ status: 201, success: true, data: zohoResponse, newLead });
  } catch (error) {
    console.error('Error in createLead:', error.message);
    
    // Enhanced error handling for scope issues
    if (error.response?.data?.code === 'OAUTH_SCOPE_MISMATCH') {
      return res.status(401).json({
        status: false,
        success: false,
        error: 'OAuth scope mismatch - insufficient permissions for Leads module',
        code: 'OAUTH_SCOPE_MISMATCH',
        details: {
          message: 'Your access token does not have permission to access the Leads module',
          required_scopes: [
            'ZohoCRM.modules.ALL',
            'ZohoCRM.modules.leads.ALL',
            'ZohoCRM.modules.leads.CREATE'
          ],
          solution: 'Re-authenticate with broader scopes',
          action_url: '/api/zoho/auth/url?platform=web'
        }
      });
    }
    
    // Use enhanced error handling
    if (error.response) {
      return handleZohoApiError(error, res, 'create lead');
    }
    
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

// Get All Leads
export const getAllLeads = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);

    const { data, total } = await fetchAllFromZoho('Leads', accessToken);

    res.json({ status: 200, success: true, data, total });
  } catch (error) {
    console.error('Error in getAllLeads:', error.message);
    
    // Use enhanced error handling
    if (error.response) {
      return handleZohoApiError(error, res, 'get all leads');
    }
    
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

// Get a Lead by ID
export const getLeadById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const leadId = req.params.id;

    const zohoResponse = await fetchOneFromZoho('Leads', accessToken, leadId);

    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in getLeadById:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

// Update a Lead
export const updateLead = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const leadId = req.params.id;
    const updatedLead = req.body;

    const zohoResponse = await createOrUpdateInZoho('Leads', accessToken, updatedLead, leadId);

    res.json({ status: 200, success: true, data: zohoResponse, updatedLead });
  } catch (error) {
    console.error('Error in updateLead:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

// Delete a Lead
export const deleteLead = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const leadId = req.params.id;

    const zohoResponse = await deleteFromZoho('Leads', accessToken, leadId);

    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in deleteLead:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};


//////=====contacts===///

// Create a Contact
export const createContact = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newContact } = req.body;

    const zohoResponse = await createOrUpdateInZoho('Contacts', accessToken, newContact);

    if (!newContact.First_Name || !newContact.Last_Name || !newContact.Email) {
      throw new Error('Required fields (First_Name, Last_Name, Email) are missing in the Zoho response');
    }

    res.json({ status: 201, success: true, data: zohoResponse, newContact });
  } catch (error) {
    console.error('Error in createContact:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

// Get All Contacts
export const getAllContacts = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);

    const { data, total } = await fetchAllFromZoho('Contacts', accessToken);

    res.json({ status: 200, success: true, data, total });
  } catch (error) {
    console.error('Error in getAllContacts:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

// Get a Contact by ID
export const getContactById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const contactId = req.params.id;

    const zohoResponse = await fetchOneFromZoho('Contacts', accessToken, contactId);

    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in getContactById:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

// Update a Contact
export const updateContact = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const contactId = req.params.id;
    const updatedContact = req.body;

    const zohoResponse = await createOrUpdateInZoho('Contacts', accessToken, updatedContact, contactId);

    res.json({ status: 200, success: true, data: zohoResponse, updatedContact });
  } catch (error) {
    console.error('Error in updateContact:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

// Delete a Contact
export const deleteContact = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const contactId = req.params.id;

    const zohoResponse = await deleteFromZoho('Contacts', accessToken, contactId);

    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in deleteContact:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};


/////====tasks======////

// Create a Task
export const createTask = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newTask } = req.body;

    // Validate required fields before making the API call
    if (!newTask.Subject || !newTask.Due_Date || !newTask.Status) {
      throw new Error('Required fields (Subject, Due_Date, Status) are missing in the request body');
    }

    // Ensure the SEMODULE field is set to "Tasks" if not already provided
    if (!newTask.SEMODULE) {
      newTask.SEMODULE = 'Tasks';
    }

    // Call the utility function to create the task in Zoho CRM
    const zohoResponse = await createOrUpdateInZoho('Tasks', accessToken, newTask);

    // Respond with the Zoho API response and the new task data
    res.json({ status: 201, success: true, data: zohoResponse, newTask });
  } catch (error) {
    console.error('Error in createTask:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

// Get All Tasks
export const getAllTasks = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);

    const { data, total } = await fetchAllFromZoho('Tasks', accessToken);

    res.json({ status: 200, success: true, data, total });
  } catch (error) {
    console.error('Error in getAllTasks:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

// Get a Task by ID
export const getTaskById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const taskId = req.params.id;

    const zohoResponse = await fetchOneFromZoho('Tasks', accessToken, taskId);

    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in getTaskById:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

// Update a Task
export const updateTask = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const taskId = req.params.id;
    const updatedTask = req.body;

    const zohoResponse = await createOrUpdateInZoho('Tasks', accessToken, updatedTask, taskId);

    res.json({ status: 200, success: true, data: zohoResponse, updatedTask });
  } catch (error) {
    console.error('Error in updateTask:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

// Delete a Task
export const deleteTask = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const taskId = req.params.id;

    const zohoResponse = await deleteFromZoho('Tasks', accessToken, taskId);

    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in deleteTask:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

////====meetings=====////


// Create a Meeting
export const createMeeting = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newMeeting }= req.body;

    const zohoResponse = await createOrUpdateInZoho('Events', accessToken, newMeeting);

    res.json({
      status: 201,
      success: true,
      crmType: 'zoho',
      data: zohoResponse,
      newMeeting,
    });
  } catch (error) {
    console.error('Error in createMeeting:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      crmType: 'zoho',
      error: error.message,
    });
  }
};

// Get All Meetings
export const getAllMeetings = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);

    const { data, total } = await fetchAllFromZoho('Events', accessToken);

    res.json({
      status: 200,
      success: true,
      crmType: 'zoho',
      data,
      total,
    });
  } catch (error) {
    console.error('Error in getAllMeetings:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      crmType: 'zoho',
      error: error.message,
    });
  }
};

// Get a Meeting by ID
export const getMeetingById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const meetingId = req.params.id;

    const zohoResponse = await fetchOneFromZoho('Events', accessToken, meetingId);

    res.json({
      status: 200,
      success: true,
      crmType: 'zoho',
      data: zohoResponse,
    });
  } catch (error) {
    console.error('Error in getMeetingById:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      crmType: 'zoho',
      error: error.message,
    });
  }
};

// Update a Meeting
export const updateMeeting = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const meetingId = req.params.id;
    const updatedMeeting = req.body;

    const zohoResponse = await createOrUpdateInZoho('Events', accessToken, updatedMeeting, meetingId);

    res.json({
      status: 200,
      success: true,
      crmType: 'zoho',
      data: zohoResponse,
      updatedMeeting,
    });
  } catch (error) {
    console.error('Error in updateMeeting:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      crmType: 'zoho',
      error: error.message,
    });
  }
};

// Delete a Meeting
export const deleteMeeting = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const meetingId = req.params.id;

    const zohoResponse = await deleteFromZoho('Events', accessToken, meetingId);

    res.json({
      status: 200,
      success: true,
      crmType: 'zoho',
      data: zohoResponse,
    });
  } catch (error) {
    console.error('Error in deleteMeeting:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      crmType: 'zoho',
      error: error.message,
    });
  }
};

////====Searching====////


export const searchAllModules = async (req, res) => {
  console.log("Enhanced search API being called ==========");
  
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { 
      searchQuery, 
      module, 
      searchFields, 
      page = 1, 
      per_page = 200,
      multiModule = false,
      modules 
    } = req.query;

    console.log({
      searchQuery, 
      module, 
      searchFields, 
      page, 
      per_page,
      multiModule,
      modules
    }, "Enhanced search parameters =======");

    // Validate that at least module is provided
    if (!module && !multiModule) {
      return res.status(400).json({
        status: 400,
        success: false,
        crmType: 'zoho',
        error: 'Module parameter is required. Specify a module name (e.g., Leads, Contacts, Accounts) or set multiModule=true',
        example: {
          singleModule: '/api/zoho/search?module=Leads&searchQuery=john',
          allRecords: '/api/zoho/search?module=Leads',
          multiModule: '/api/zoho/search?multiModule=true&searchQuery=john&modules=Leads,Contacts,Accounts',
          customFields: '/api/zoho/search?module=Leads&searchQuery=john&searchFields=First_Name,Last_Name,Email'
        }
      });
    }

    // Multi-module search
    if (multiModule === 'true' || multiModule === true) {
      const modulesList = modules ? modules.split(',').map(m => m.trim()) : [];
      
      console.log(`Performing multi-module search across: ${modulesList.length > 0 ? modulesList.join(', ') : 'default modules'}`);
      
      const searchResults = await searchMultipleModules(
        accessToken, 
        searchQuery, 
        modulesList, 
        parseInt(page), 
        parseInt(per_page)
      );

      return res.json({
        status: 200,
        success: true,
        crmType: 'zoho',
        searchType: 'multi-module',
        searchQuery: searchQuery || 'all records',
        modules: modulesList,
        page: parseInt(page),
        per_page: parseInt(per_page),
        results: searchResults,
        totalModules: searchResults.length,
        successfulModules: searchResults.filter(r => r.success).length
      });
    }

    // Single module search
    const fieldsToSearch = searchFields ? searchFields.split(',').map(f => f.trim()) : [];
    
    console.log(`Performing search in ${module} module`);
    console.log(`Search query: "${searchQuery || 'none (fetching all records)'}"`);
    console.log(`Custom fields: ${fieldsToSearch.length > 0 ? fieldsToSearch.join(', ') : 'using default fields'}`);

    // Use enhanced search function
    const searchResults = await enhancedSearchInZoho(
      module, 
      accessToken, 
      searchQuery, 
      fieldsToSearch, 
      parseInt(page), 
      parseInt(per_page)
    );

    // Enhanced response with more details
    res.json({
      status: 200,
      success: true,
      crmType: 'zoho',
      searchType: 'single-module',
      module,
      searchQuery: searchQuery || null,
      searchFields: searchResults.searchFields || fieldsToSearch,
      page: parseInt(page),
      per_page: parseInt(per_page),
      data: searchResults.data,
      total: searchResults.total,
      hasMore: searchResults.hasMore,
      searchMethod: searchResults.searchMethod || 'api',
      metadata: {
        recordsReturned: searchResults.data ? searchResults.data.length : 0,
        isSearching: !!searchQuery,
        pagination: {
          currentPage: parseInt(page),
          recordsPerPage: parseInt(per_page),
          hasMoreRecords: searchResults.hasMore
        }
      }
    });

      } catch (error) {
      console.error('Error in enhanced search:', error.message);
      
      // Handle specific search-related errors
      if (error.message.includes('No searchable fields')) {
        return res.status(400).json(createZohoError('FIELD',
          'No searchable fields available for this module',
          {
            module: module,
            searchFields: fieldsToSearch,
            context: 'search',
            suggestion: 'Use GET /api/zoho/fields/' + module + ' to see available fields'
          }
        ));
      }
      
      if (error.message.includes('Invalid module')) {
        return res.status(400).json(createZohoError('MODULE',
          'Invalid or unsupported module specified',
          {
            module: module,
            context: 'search',
            available_endpoints: {
              list_modules: 'GET /api/zoho/modules',
              module_fields: 'GET /api/zoho/fields/{module}',
              search_guide: 'See documentation for supported modules'
            }
          }
        ));
      }

      if (error.message.includes('Invalid search fields')) {
        return res.status(400).json(createZohoError('FIELD',
          'One or more invalid search fields specified',
          {
            module: module,
            invalid_fields: fieldsToSearch,
            context: 'search',
            suggestion: 'Use GET /api/zoho/fields/' + module + ' to see available fields'
          }
        ));
      }

      // Handle API-specific errors
      if (error.response) {
        return handleZohoApiError(error, res, 'search');
      }
      
      // Handle unexpected errors
      return res.status(500).json(createZohoError('SEARCH',
        'Search operation failed',
        {
          module: module,
          searchQuery: searchQuery || null,
          searchFields: fieldsToSearch,
          error_message: error.message,
          context: 'search',
          request_params: {
            multiModule,
            modules: modules || null,
            page,
            per_page
          }
        }
      ));
    }
};

//// Accounts
export const createAccount = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newAccount } = req.body;

    const zohoResponse = await createOrUpdateInZoho('Accounts', accessToken, newAccount);

    res.json({ status: 201, success: true, data: zohoResponse, newAccount });
  } catch (error) {
    console.error('Error in createAccount:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const getAllAccounts = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { data, total } = await fetchAllFromZoho('Accounts', accessToken);
    res.json({ status: 200, success: true, data, total });
  } catch (error) {
    console.error('Error in getAllAccounts:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const getAccountById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const accountId = req.params.id;
    const zohoResponse = await fetchOneFromZoho('Accounts', accessToken, accountId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in getAccountById:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const updateAccount = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const accountId = req.params.id;
    const updatedAccount = req.body;
    const zohoResponse = await createOrUpdateInZoho('Accounts', accessToken, updatedAccount, accountId);
    res.json({ status: 200, success: true, data: zohoResponse, updatedAccount });
  } catch (error) {
    console.error('Error in updateAccount:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const accountId = req.params.id;
    const zohoResponse = await deleteFromZoho('Accounts', accessToken, accountId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in deleteAccount:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

//// Campaigns
export const createCampaign = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newCampaign } = req.body;
    const zohoResponse = await createOrUpdateInZoho('Campaigns', accessToken, newCampaign);
    res.json({ status: 201, success: true, data: zohoResponse, newCampaign });
  } catch (error) {
    console.error('Error in createCampaign:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const getAllCampaigns = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { data, total } = await fetchAllFromZoho('Campaigns', accessToken);
    res.json({ status: 200, success: true, data, total });
  } catch (error) {
    console.error('Error in getAllCampaigns:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const getCampaignById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const campaignId = req.params.id;
    const zohoResponse = await fetchOneFromZoho('Campaigns', accessToken, campaignId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in getCampaignById:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const updateCampaign = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const campaignId = req.params.id;
    const updatedCampaign = req.body;
    const zohoResponse = await createOrUpdateInZoho('Campaigns', accessToken, updatedCampaign, campaignId);
    res.json({ status: 200, success: true, data: zohoResponse, updatedCampaign });
  } catch (error) {
    console.error('Error in updateCampaign:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const deleteCampaign = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const campaignId = req.params.id;
    const zohoResponse = await deleteFromZoho('Campaigns', accessToken, campaignId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in deleteCampaign:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

//// Campaign Members
export const createCampaignMember = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newCampaignMember } = req.body;
    const zohoResponse = await createOrUpdateInZoho('Campaign_Members', accessToken, newCampaignMember);
    res.json({ status: 201, success: true, data: zohoResponse, newCampaignMember });
  } catch (error) {
    console.error('Error in createCampaignMember:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const getAllCampaignMembers = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { data, total } = await fetchAllFromZoho('Campaign_Members', accessToken);
    res.json({ status: 200, success: true, data, total });
  } catch (error) {
    console.error('Error in getAllCampaignMembers:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const getCampaignMemberById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const memberId = req.params.id;
    const zohoResponse = await fetchOneFromZoho('Campaign_Members', accessToken, memberId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in getCampaignMemberById:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const updateCampaignMember = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const memberId = req.params.id;
    const updatedMember = req.body;
    const zohoResponse = await createOrUpdateInZoho('Campaign_Members', accessToken, updatedMember, memberId);
    res.json({ status: 200, success: true, data: zohoResponse, updatedMember });
  } catch (error) {
    console.error('Error in updateCampaignMember:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const deleteCampaignMember = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const memberId = req.params.id;
    const zohoResponse = await deleteFromZoho('Campaign_Members', accessToken, memberId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in deleteCampaignMember:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

//// Notes
export const createNote = async (req, res) => {
  console.log('=== Starting createNote function ===');
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newNote } = req.body;

    console.log('Received note data:', newNote);

    // Validate required fields
    if (!newNote.Note_Title || !newNote.Note_Content) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Required fields missing: Note_Title, Note_Content'
      });
    }

    // Validate Parent_Id and Se_Module if provided
    if (newNote.Parent_Id && !newNote.Se_Module) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Se_Module is required when Parent_Id is provided',
        validModules: ['Leads', 'Contacts', 'Accounts', 'Deals', 'Cases', 'Solutions', 'Products', 'Vendors', 'Price_Books', 'Quotes', 'Sales_Orders', 'Purchase_Orders', 'Invoices']
      });
    }

    // Validate Se_Module if provided
    if (newNote.Se_Module) {
      const validModules = ['Leads', 'Contacts', 'Accounts', 'Deals', 'Cases', 'Solutions', 'Products', 'Vendors', 'Price_Books', 'Quotes', 'Sales_Orders', 'Purchase_Orders', 'Invoices'];
      if (!validModules.includes(newNote.Se_Module)) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Invalid Se_Module',
          validModules
        });
      }
    }

    // First verify if the Parent_Id exists in the specified module
    if (newNote.Parent_Id && newNote.Se_Module) {
      try {
        const verifyResponse = await axios.get(
          `https://www.zohoapis.com/crm/v2/${newNote.Se_Module}/${newNote.Parent_Id}`,
          {
            headers: {
              'Authorization': `Zoho-oauthtoken ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!verifyResponse.data.data || verifyResponse.data.data.length === 0) {
          return res.status(404).json({
            status: 404,
            success: false,
            error: `Parent record not found in ${newNote.Se_Module} module`,
            details: {
              Parent_Id: newNote.Parent_Id,
              Se_Module: newNote.Se_Module
            }
          });
        }
      } catch (error) {
        console.error('Error verifying parent record:', error.response?.data || error.message);
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Failed to verify parent record',
          details: error.response?.data || error.message
        });
      }
    }

    // Prepare note data with correct field names
    const noteData = {
      Note_Title: newNote.Note_Title,
      Note_Content: newNote.Note_Content,
      ...(newNote.Parent_Id && { Parent_Id: newNote.Parent_Id }),
      ...(newNote.Se_Module && { $se_module: newNote.Se_Module }), // Changed from Se_Module to $se_module
      Note_Type: newNote.Note_Type || 'Note',
      Attachments: newNote.Attachments || []
    };

    console.log('Prepared note data:', noteData);

    // Make API call to create note
    const response = await axios.post(
      'https://www.zohoapis.com/crm/v2/Notes',
      { data: [noteData] },
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Zoho API Response:', response.data);
    
    res.status(201).json({
      status: 201,
      success: true,
      data: response.data,
      newNote: noteData
    });
  } catch (error) {
    console.error('Error in createNote:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });

    // Handle specific Zoho CRM errors
    if (error.response?.data?.data?.[0]?.code === 'INVALID_DATA') {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Invalid data provided',
        details: {
          message: error.response.data.data[0].message,
          field: error.response.data.data[0].details?.api_name,
          note: 'Make sure the Parent_Id exists in the specified Se_Module and you have the correct permissions'
        }
      });
    }

    if (error.response?.data?.data?.[0]?.code === 'MANDATORY_NOT_FOUND') {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Required field missing',
        details: {
          message: error.response.data.data[0].message,
          field: error.response.data.data[0].details?.api_name,
          note: 'The Se_Module field is required when creating a note with a Parent_Id'
        }
      });
    }

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};

export const getAllNotes = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader (req);
    const { data, total } = await fetchAllFromZoho('Notes', accessToken);
    res.json({ status: 200, success: true, data, total });
  } catch (error) {
    console.error('Error in getAllNotes:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const getNoteById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const noteId = req.params.id;
    const zohoResponse = await fetchOneFromZoho('Notes', accessToken, noteId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in getNoteById:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const updateNote = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const noteId = req.params.id;
    const updatedNote = req.body;
    const zohoResponse = await createOrUpdateInZoho('Notes', accessToken, updatedNote, noteId);
    res.json({ status: 200, success: true, data: zohoResponse, updatedNote });
  } catch (error) {
    console.error('Error in updateNote:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const deleteNote = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const noteId = req.params.id;
    const zohoResponse = await deleteFromZoho('Notes', accessToken, noteId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in deleteNote:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

//// Bulk Creation
export const bulkCreate = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { entities } = req.body;

    if (!entities || !Array.isArray(entities)) {
      throw new Error('Invalid request body. Expected an array of entities.');
    }

    const results = [];
    const errors = [];

    for (const entity of entities) {
      try {
        const { module, data } = entity;
        if (!module || !data) {
          throw new Error('Each entity must have module and data properties');
        }

        const zohoResponse = await createOrUpdateInZoho(module, accessToken, data);
        results.push({
          module,
          success: true,
          data: zohoResponse
        });
      } catch (error) {
        errors.push({
          module: entity.module,
          error: error.message
        });
      }
    }

    res.json({
      status: 200,
      success: true,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error in bulkCreate:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

//// Deals (Potentials)
export const createDeal = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newDeal } = req.body;

    if (!newDeal.Deal_Name || !newDeal.Stage || !newDeal.Amount) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Required fields missing: Deal_Name, Stage, Amount'
      });
    }

    const zohoResponse = await createOrUpdateInZoho('Deals', accessToken, newDeal);
    res.json({ status: 201, success: true, data: zohoResponse, newDeal });
  } catch (error) {
    console.error('Error in createDeal:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const getAllDeals = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { page = 1, limit = 10 } = req.query;
    
    const { data, total } = await fetchAllFromZoho('Deals', accessToken, {
      page,
      per_page: limit
    });

    res.json({ 
      status: 200, 
      success: true, 
      data, 
      total,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllDeals:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const getDealById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const dealId = req.params.id;

    const zohoResponse = await fetchOneFromZoho('Deals', accessToken, dealId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in getDealById:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const updateDeal = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const dealId = req.params.id;
    const updatedDeal = req.body;

    const zohoResponse = await createOrUpdateInZoho('Deals', accessToken, updatedDeal, dealId);
    res.json({ status: 200, success: true, data: zohoResponse, updatedDeal });
  } catch (error) {
    console.error('Error in updateDeal:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const deleteDeal = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const dealId = req.params.id;

    const zohoResponse = await deleteFromZoho('Deals', accessToken, dealId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in deleteDeal:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

//// Products
export const createProduct = async (req, res) => {
  console.log('=== Starting createProduct function ===');
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newProduct } = req.body;

    console.log('Received product data:', newProduct);

    // Validate required fields
    if (!newProduct.Product_Name) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Required field missing: Product_Name'
      });
    }

    // First, get all available modules to check what's available
    console.log('Fetching available modules...');
    let availableModules = [];
    let productsModule = null;
    
    try {
      const modulesResponse = await axios.get(
        'https://www.zohoapis.com/crm/v2/settings/modules',
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      availableModules = modulesResponse.data.modules || [];
      console.log('Available modules:', availableModules.map(m => ({ name: m.module_name, api_name: m.api_name })));

      // Try to find the Products module by different possible names
      const possibleProductModuleNames = [
        'Products',
        'Product',
        'Items',
        'Inventory',
        'Catalogue',
        'Catalog'
      ];

      for (const moduleName of possibleProductModuleNames) {
        productsModule = availableModules.find(
          module => 
            module.module_name === moduleName || 
            module.api_name === moduleName ||
            module.module_name.toLowerCase() === moduleName.toLowerCase() ||
            module.api_name.toLowerCase() === moduleName.toLowerCase()
        );
        if (productsModule) {
          console.log(`Found products module: ${productsModule.module_name} (${productsModule.api_name})`);
          break;
        }
      }

      if (!productsModule) {
        // Check if there's a custom module that might be used for products
        const customModules = availableModules.filter(module => 
          module.module_name.toLowerCase().includes('product') ||
          module.module_name.toLowerCase().includes('item') ||
          module.module_name.toLowerCase().includes('inventory')
        );

        if (customModules.length > 0) {
          console.log('Found potential custom product modules:', customModules.map(m => m.module_name));
          return res.status(400).json({
            status: 400,
            success: false,
            error: 'Products module not found, but custom modules detected',
            details: {
              message: 'No standard Products module found, but detected custom modules that might handle products.',
              customModules: customModules.map(m => ({
                name: m.module_name,
                api_name: m.api_name
              })),
              suggestion: 'You might need to use one of these custom modules or contact your Zoho CRM administrator to enable the Products module.',
              allAvailableModules: availableModules.map(m => ({
                name: m.module_name,
                api_name: m.api_name,
                status: m.status
              }))
            }
          });
        }

        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Products module not available',
          details: {
            message: 'The Products module is not available in your Zoho CRM instance.',
            availableModules: availableModules.map(m => ({
              name: m.module_name,
              api_name: m.api_name,
              status: m.status
            })),
            instructions: [
              '1. Log in to your Zoho CRM account',
              '2. Go to Setup > Customization > Modules and Fields',
              '3. Look for the Products module and enable it if it exists',
              '4. If Products module is not available, you may need to:',
              '   - Upgrade your Zoho CRM plan',
              '   - Contact Zoho support to enable the Products module',
              '   - Use a custom module for product management',
              '5. Alternatively, create a custom module named "Products" with the required fields'
            ]
          }
        });
      }

    } catch (moduleError) {
      console.error('Error fetching modules:', moduleError.response?.data || moduleError.message);
      return res.status(500).json({
        status: 500,
        success: false,
        error: 'Failed to fetch available modules',
        details: {
          message: 'Could not retrieve the list of available modules from Zoho CRM.',
          error: moduleError.response?.data || moduleError.message,
          instructions: [
            '1. Check your access token permissions',
            '2. Ensure your token has ZohoCRM.settings.ALL scope',
            '3. Try refreshing your access token'
          ]
        }
      });
    }

    // Now try to create the product using the found module
    try {
      console.log(`Attempting to create product using module: ${productsModule.api_name}`);

      // Prepare product data with default values
      const productData = {
        Product_Name: newProduct.Product_Name,
        Product_Code: newProduct.Product_Code || `PROD-${Date.now()}`,
        Description: newProduct.Description || '',
        Category: newProduct.Category || '',
        Unit_Price: newProduct.Unit_Price || 0,
        Tax: newProduct.Tax || 0,
        Status: newProduct.Status || 'Active',
        Manufacturer: newProduct.Manufacturer || '',
        Product_Category: newProduct.Product_Category || '',
        Sales_Start_Date: newProduct.Sales_Start_Date || new Date().toISOString().split('T')[0],
        Sales_End_Date: newProduct.Sales_End_Date || '',
        Support_Start_Date: newProduct.Support_Start_Date || '',
        Support_End_Date: newProduct.Support_End_Date || '',
        Usage_Unit: newProduct.Usage_Unit || 'Unit',
        Qty_in_Demand: newProduct.Qty_in_Demand || 0,
        Qty_in_Stock: newProduct.Qty_in_Stock || 0,
        Reorder_Level: newProduct.Reorder_Level || 0,
        Handler: newProduct.Handler || '',
        Vendor_Name: newProduct.Vendor_Name || '',
        Commission_Rate: newProduct.Commission_Rate || 0,
        Taxable: newProduct.Taxable !== undefined ? newProduct.Taxable : false,
        Currency: newProduct.Currency || 'USD',
        Recurring: newProduct.Recurring !== undefined ? newProduct.Recurring : false,
        Exempt: newProduct.Exempt !== undefined ? newProduct.Exempt : false,
        Shipping_Cost: newProduct.Shipping_Cost || 0,
        Weight: newProduct.Weight || 0,
        Width: newProduct.Width || 0,
        Length: newProduct.Length || 0,
        Height: newProduct.Height || 0
      };

      console.log('Prepared product data:', productData);

      const response = await axios.post(
        `https://www.zohoapis.com/crm/v2/${productsModule.api_name}`,
        { data: [productData] },
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Product created successfully:', response.data);
      return res.status(201).json({
        status: 201,
        success: true,
        data: response.data,
        newProduct: productData,
        moduleUsed: {
          name: productsModule.module_name,
          api_name: productsModule.api_name
        }
      });

    } catch (createError) {
      console.error('Error creating product:', createError.response?.data || createError.message);
      
      // Handle specific creation errors
      if (createError.response?.status === 401) {
        const errorData = createError.response?.data;
        if (errorData?.code === 'OAUTH_SCOPE_MISMATCH') {
          return res.status(401).json({
            status: 401,
            success: false,
            error: 'OAuth scope mismatch',
            details: {
              message: 'Your access token does not have the required permissions.',
              requiredScopes: [
                'ZohoCRM.modules.ALL',
                'ZohoCRM.modules.products.ALL',
                'ZohoCRM.settings.ALL'
              ],
              instructions: [
                '1. Go to https://api-console.zoho.com/',
                '2. Select your client application',
                '3. Update scopes to include:',
                '   - ZohoCRM.modules.ALL',
                '   - ZohoCRM.settings.ALL',
                '4. Generate a new authorization code',
                '5. Get a fresh access token with the new scopes'
              ]
            }
          });
        }
        
        return res.status(401).json({
          status: 401,
          success: false,
          error: 'Authentication failed',
          details: {
            message: 'Your access token is invalid or has expired.',
            moduleUsed: productsModule.api_name,
            instructions: [
              '1. Generate a new access token',
              '2. Ensure proper scopes are included',
              '3. Try the request again'
            ]
          }
        });
      }

      if (createError.response?.status === 400) {
        const errorDetails = createError.response?.data;
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Product creation failed',
          details: {
            message: errorDetails?.message || 'Bad request while creating product',
            zohoError: errorDetails,
            moduleUsed: productsModule.api_name,
            sentData: productData,
            possibleSolutions: [
              '1. Check if all required fields are provided',
              '2. Verify field names match your Zoho CRM configuration',
              '3. Check if any fields have validation rules in Zoho CRM',
              '4. Ensure data types match expected formats (dates, numbers, etc.)'
            ]
          }
        });
      }

      // Handle other creation errors
      return res.status(createError.response?.status || 500).json({
        status: createError.response?.status || 500,
        success: false,
        error: 'Failed to create product',
        details: {
          message: createError.response?.data?.message || createError.message,
          moduleUsed: productsModule.api_name,
          zohoError: createError.response?.data
        }
      });
    }

  } catch (error) {
    console.error('Unexpected error in createProduct:', error);
    res.status(500).json({
      status: 500,
      success: false,
      error: 'Internal server error',
      details: {
        message: error.message,
        type: 'UNEXPECTED_ERROR'
      }
    });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { 
      page = 1, 
      limit = 10,
      search,
      category,
      status,
      manufacturer,
      vendor
    } = req.query;

    // First, find the products module
    let productsModule = null;
    
    try {
      const modulesResponse = await axios.get(
        'https://www.zohoapis.com/crm/v2/settings/modules',
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const availableModules = modulesResponse.data.modules || [];
      
      // Try to find the Products module by different possible names
      const possibleProductModuleNames = [
        'Products',
        'Product',
        'Items',
        'Inventory',
        'Catalogue',
        'Catalog'
      ];

      for (const moduleName of possibleProductModuleNames) {
        productsModule = availableModules.find(
          module => 
            module.module_name === moduleName || 
            module.api_name === moduleName ||
            module.module_name.toLowerCase() === moduleName.toLowerCase() ||
            module.api_name.toLowerCase() === moduleName.toLowerCase()
        );
        if (productsModule) break;
      }

      if (!productsModule) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Products module not available',
          details: {
            message: 'The Products module is not available in your Zoho CRM instance.',
            availableModules: availableModules.map(m => ({
              name: m.module_name,
              api_name: m.api_name,
              status: m.status
            }))
          }
        });
      }

    } catch (moduleError) {
      console.error('Error fetching modules:', moduleError.response?.data || moduleError.message);
      return res.status(500).json({
        status: 500,
        success: false,
        error: 'Failed to fetch available modules',
        details: moduleError.response?.data || moduleError.message
      });
    }

    // Build filter criteria
    let criteria = '';
    const filters = [];

    if (search) {
      filters.push(`(Product_Name:contains:${search} OR Product_Code:contains:${search} OR Description:contains:${search})`);
    }
    if (category) filters.push(`Category:equals:${category}`);
    if (status) filters.push(`Status:equals:${status}`);
    if (manufacturer) filters.push(`Manufacturer:equals:${manufacturer}`);
    if (vendor) filters.push(`Vendor_Name:equals:${vendor}`);

    if (filters.length > 0) {
      criteria = filters.join(' AND ');
    }

    // Make API call to get products using the found module
    const response = await axios.get(
      `https://www.zohoapis.com/crm/v2/${productsModule.api_name}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          criteria,
          page,
          per_page: limit,
          fields: 'id,Product_Name,Product_Code,Description,Category,Unit_Price,Tax,Status,Manufacturer,Product_Category,Vendor_Name,Qty_in_Stock'
        }
      }
    );

    res.status(200).json({
      status: 200,
      success: true,
      data: response.data.data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: response.data.info?.count || 0
      },
      moduleUsed: {
        name: productsModule.module_name,
        api_name: productsModule.api_name
      }
    });
  } catch (error) {
    console.error('Error in getAllProducts:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const productId = req.params.id;

    // First, find the products module
    let productsModule = null;
    
    try {
      const modulesResponse = await axios.get(
        'https://www.zohoapis.com/crm/v2/settings/modules',
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const availableModules = modulesResponse.data.modules || [];
      
      // Try to find the Products module by different possible names
      const possibleProductModuleNames = [
        'Products',
        'Product',
        'Items',
        'Inventory',
        'Catalogue',
        'Catalog'
      ];

      for (const moduleName of possibleProductModuleNames) {
        productsModule = availableModules.find(
          module => 
            module.module_name === moduleName || 
            module.api_name === moduleName ||
            module.module_name.toLowerCase() === moduleName.toLowerCase() ||
            module.api_name.toLowerCase() === moduleName.toLowerCase()
        );
        if (productsModule) break;
      }

      if (!productsModule) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Products module not available',
          details: {
            message: 'The Products module is not available in your Zoho CRM instance.',
            availableModules: availableModules.map(m => ({
              name: m.module_name,
              api_name: m.api_name,
              status: m.status
            }))
          }
        });
      }

    } catch (moduleError) {
      console.error('Error fetching modules:', moduleError.response?.data || moduleError.message);
      return res.status(500).json({
        status: 500,
        success: false,
        error: 'Failed to fetch available modules',
        details: moduleError.response?.data || moduleError.message
      });
    }

    const response = await axios.get(
      `https://www.zohoapis.com/crm/v2/${productsModule.api_name}/${productId}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data.data || response.data.data.length === 0) {
      return res.status(404).json({
        status: 404,
        success: false,
        error: 'Product not found'
      });
    }

    res.status(200).json({
      status: 200,
      success: true,
      data: response.data.data[0],
      moduleUsed: {
        name: productsModule.module_name,
        api_name: productsModule.api_name
      }
    });
  } catch (error) {
    console.error('Error in getProductById:', error.message);
    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};

export const updateProduct = async (req, res) => {
  console.log('=== Starting updateProduct function ===');
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const productId = req.params.id;
    const { updatedProduct } = req.body;

    console.log('Received update data:', updatedProduct);

    // Validate product exists
    try {
      await axios.get(
        `https://www.zohoapis.com/crm/v2/Products/${productId}`,
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      return res.status(404).json({
        status: 404,
        success: false,
        error: 'Product not found'
      });
    }

    // Prepare update data
    const updateData = {
      ...(updatedProduct.Product_Name && { Product_Name: updatedProduct.Product_Name }),
      ...(updatedProduct.Product_Code && { Product_Code: updatedProduct.Product_Code }),
      ...(updatedProduct.Description && { Description: updatedProduct.Description }),
      ...(updatedProduct.Category && { Category: updatedProduct.Category }),
      ...(updatedProduct.Unit_Price !== undefined && { Unit_Price: updatedProduct.Unit_Price }),
      ...(updatedProduct.Tax !== undefined && { Tax: updatedProduct.Tax }),
      ...(updatedProduct.Status && { Status: updatedProduct.Status }),
      ...(updatedProduct.Manufacturer && { Manufacturer: updatedProduct.Manufacturer }),
      ...(updatedProduct.Product_Category && { Product_Category: updatedProduct.Product_Category }),
      ...(updatedProduct.Sales_Start_Date && { Sales_Start_Date: updatedProduct.Sales_Start_Date }),
      ...(updatedProduct.Sales_End_Date && { Sales_End_Date: updatedProduct.Sales_End_Date }),
      ...(updatedProduct.Support_Start_Date && { Support_Start_Date: updatedProduct.Support_Start_Date }),
      ...(updatedProduct.Support_End_Date && { Support_End_Date: updatedProduct.Support_End_Date }),
      ...(updatedProduct.Usage_Unit && { Usage_Unit: updatedProduct.Usage_Unit }),
      ...(updatedProduct.Qty_in_Demand !== undefined && { Qty_in_Demand: updatedProduct.Qty_in_Demand }),
      ...(updatedProduct.Qty_in_Stock !== undefined && { Qty_in_Stock: updatedProduct.Qty_in_Stock }),
      ...(updatedProduct.Reorder_Level !== undefined && { Reorder_Level: updatedProduct.Reorder_Level }),
      ...(updatedProduct.Handler && { Handler: updatedProduct.Handler }),
      ...(updatedProduct.Vendor_Name && { Vendor_Name: updatedProduct.Vendor_Name }),
      ...(updatedProduct.Commission_Rate !== undefined && { Commission_Rate: updatedProduct.Commission_Rate }),
      ...(updatedProduct.Taxable !== undefined && { Taxable: updatedProduct.Taxable }),
      ...(updatedProduct.Currency && { Currency: updatedProduct.Currency }),
      ...(updatedProduct.Recurring !== undefined && { Recurring: updatedProduct.Recurring }),
      ...(updatedProduct.Exempt !== undefined && { Exempt: updatedProduct.Exempt }),
      ...(updatedProduct.Shipping_Cost !== undefined && { Shipping_Cost: updatedProduct.Shipping_Cost }),
      ...(updatedProduct.Weight !== undefined && { Weight: updatedProduct.Weight }),
      ...(updatedProduct.Width !== undefined && { Width: updatedProduct.Width }),
      ...(updatedProduct.Length !== undefined && { Length: updatedProduct.Length }),
      ...(updatedProduct.Height !== undefined && { Height: updatedProduct.Height })
    };

    console.log('Prepared update data:', updateData);

    // Make API call to update product
    const response = await axios.put(
      `https://www.zohoapis.com/crm/v2/Products/${productId}`,
      { data: [updateData] },
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Zoho API Response:', response.data);
    
    res.status(200).json({
      status: 200,
      success: true,
      data: response.data,
      updatedProduct: updateData
    });
  } catch (error) {
    console.error('Error in updateProduct:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const productId = req.params.id;

    // First verify if the product exists
    try {
      await axios.get(
        `https://www.zohoapis.com/crm/v2/Products/${productId}`,
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      return res.status(404).json({
        status: 404,
        success: false,
        error: 'Product not found'
      });
    }

    // Make API call to delete product
    const response = await axios.delete(
      `https://www.zohoapis.com/crm/v2/Products/${productId}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      status: 200,
      success: true,
      data: response.data,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteProduct:', error.message);
    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};

//// Price Books
export const createPriceBook = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newPriceBook } = req.body;

    if (!newPriceBook.Name) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Required field missing: Name'
      });
    }

    const zohoResponse = await createOrUpdateInZoho('Price_Books', accessToken, newPriceBook);
    res.json({ status: 201, success: true, data: zohoResponse, newPriceBook });
  } catch (error) {
    console.error('Error in createPriceBook:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const getAllPriceBooks = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { page = 1, limit = 10 } = req.query;
    
    const { data, total } = await fetchAllFromZoho('Price_Books', accessToken, {
      page,
      per_page: limit
    });

    res.json({ 
      status: 200, 
      success: true, 
      data, 
      total,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllPriceBooks:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const getPriceBookById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const priceBookId = req.params.id;

    const zohoResponse = await fetchOneFromZoho('Price_Books', accessToken, priceBookId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in getPriceBookById:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const updatePriceBook = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const priceBookId = req.params.id;
    const updatedPriceBook = req.body;

    const zohoResponse = await createOrUpdateInZoho('Price_Books', accessToken, updatedPriceBook, priceBookId);
    res.json({ status: 200, success: true, data: zohoResponse, updatedPriceBook });
  } catch (error) {
    console.error('Error in updatePriceBook:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const deletePriceBook = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const priceBookId = req.params.id;

    const zohoResponse = await deleteFromZoho('Price_Books', accessToken, priceBookId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in deletePriceBook:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

//// Quotes
export const createQuote = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token is missing or invalid' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { newQuote } = req.body;

    // Validate required fields
    if (!newQuote.Subject || !newQuote.Deal_Name || !newQuote.Contact_Name || !newQuote.Quote_Stage) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: {
          message: 'Subject, Deal_Name, Contact_Name, and Quote_Stage are required'
        }
      });
    }

    // First verify if the contact exists
    try {
      const contactResponse = await axios.get(
        `https://www.zohoapis.com/crm/v2/Contacts/${newQuote.Contact_Name}`,
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('Contact verification response:', contactResponse.data);
  } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Contact_Name',
        details: {
          message: 'The specified Contact_Name ID does not exist or is not accessible',
          original_error: error.response?.data
        }
      });
    }

    // Validate Product_Details
    if (!Array.isArray(newQuote.Product_Details) || newQuote.Product_Details.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Product_Details',
        details: {
          message: 'Product_Details must be a non-empty array'
        }
      });
    }

    // Format the data according to Zoho's requirements
    const quoteData = {
      data: [{
        Subject: newQuote.Subject,
        Deal_Name: {
          id: String(newQuote.Deal_Name)
        },
        Contact_Name: {
          id: String(newQuote.Contact_Name)
        },
        Quote_Stage: newQuote.Quote_Stage,
        Product_Details: newQuote.Product_Details.map(product => ({
          product: {
            id: String(product.product.id)
          },
          quantity: Number(product.quantity),
          list_price: Number(product.list_price),
          Discount: Number(product.discount) || 0,
          total: Number(product.total) || (Number(product.quantity) * Number(product.list_price) - (Number(product.discount) || 0))
        })),
        Valid_Till: newQuote.Valid_Till,
        Sub_Total: Number(newQuote.Sub_Total),
        Discount: Number(newQuote.Discount),
        Adjustment: newQuote.Adjustment ? Number(newQuote.Adjustment) : undefined,
        Terms_and_Conditions: newQuote.Terms_and_Conditions
      }]
    };

    console.log('Quote request payload:', JSON.stringify(quoteData, null, 2));

    // Make the API call to create quote
    const response = await axios.post(
      'https://www.zohoapis.com/crm/v2/Quotes',
      quoteData,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(201).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Error creating quote:', error.response?.data || error);
    
    // Enhanced error handling
    const errorResponse = {
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data || {}
    };

    // If it's a specific Zoho error, include their error details
    if (error.response?.data?.details) {
      errorResponse.details = error.response.data.details;
    }

    res.status(error.response?.status || 500).json(errorResponse);
  }
};

export const getAllQuotes = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token is missing or invalid' });
    }
    const accessToken = authHeader.split(' ')[1];

    const response = await axios.get(
      'https://www.zohoapis.com/crm/v2/Quotes',
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      success: true, 
      data: response.data
    });

  } catch (error) {
    console.error('Error fetching quotes:', error.response?.data || error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data || {}
    });
  }
};

export const getQuoteById = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token is missing or invalid' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Quote ID is required'
      });
    }

    const response = await axios.get(
      `https://www.zohoapis.com/crm/v2/Quotes/${id}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Error fetching quote:', error.response?.data || error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data || {}
    });
  }
};

export const updateQuote = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token is missing or invalid' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { id } = req.params;
    const { quoteData } = req.body;

    if (!id || !quoteData) {
      return res.status(400).json({
        success: false,
        error: 'Quote ID and update data are required'
      });
    }

    // Format the data for update
    const formattedData = {
      data: [{
        id: String(id),
        ...quoteData,
        // Format nested objects if they exist
        Deal_Name: quoteData.Deal_Name ? { id: String(quoteData.Deal_Name) } : undefined,
        Contact_Name: quoteData.Contact_Name ? { id: String(quoteData.Contact_Name) } : undefined,
        Product_Details: quoteData.Product_Details ? quoteData.Product_Details.map(product => ({
          product: {
            id: String(product.product.id)
          },
          quantity: Number(product.quantity),
          list_price: Number(product.list_price),
          Discount: Number(product.discount) || 0,
          total: Number(product.total) || (Number(product.quantity) * Number(product.list_price) - (Number(product.discount) || 0))
        })) : undefined
      }]
    };

    const response = await axios.put(
      `https://www.zohoapis.com/crm/v2/Quotes/${id}`,
      formattedData,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Error updating quote:', error.response?.data || error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data || {}
    });
  }
};

export const deleteQuote = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token is missing or invalid' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Quote ID is required'
      });
    }

    const response = await axios.delete(
      `https://www.zohoapis.com/crm/v2/Quotes/${id}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Error deleting quote:', error.response?.data || error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data || {}
    });
  }
};

//// Sales Orders
export const createSalesOrder = async (req, res) => {
  console.log('=== Starting createSalesOrder function ===');
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newSalesOrder } = req.body;

    console.log('Received sales order data:', newSalesOrder);

    // Validate required fields
    if (!newSalesOrder.Subject || !newSalesOrder.Account_Name || !newSalesOrder.Status || !newSalesOrder.Product_Details) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Required fields missing',
        required: ['Subject', 'Account_Name', 'Status', 'Product_Details'],
        received: {
          Subject: newSalesOrder.Subject,
          Account_Name: newSalesOrder.Account_Name,
          Status: newSalesOrder.Status,
          Product_Details: newSalesOrder.Product_Details
        }
      });
    }

    // Validate Product_Details
    if (!Array.isArray(newSalesOrder.Product_Details) || newSalesOrder.Product_Details.length === 0) {
      console.log('Validation failed: Product_Details must be a non-empty array');
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Product_Details must be a non-empty array'
      });
    }

    // Validate each product in Product_Details
    for (const product of newSalesOrder.Product_Details) {
      if (!product.product || !product.product.id || !product.quantity || !product.list_price) {
        console.log('Validation failed: Each product must have product.id, quantity, and list_price');
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Each product must have product.id, quantity, and list_price',
          invalidProduct: product
        });
      }
    }

    // Format dates for Zoho CRM (YYYY-MM-DD format)
    const formatDateForZoho = (dateString) => {
      if (!dateString) return null;
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
    };

    // Calculate totals if not provided
    if (!newSalesOrder.Total) {
      newSalesOrder.Total = newSalesOrder.Product_Details.reduce((sum, product) => {
        const productTotal = (product.list_price * product.quantity) - (product.discount || 0);
        return sum + productTotal;
      }, 0);
    }

    // Ensure all required fields are in the correct format
    const salesOrderData = {
      Subject: newSalesOrder.Subject,
      Account_Name: newSalesOrder.Account_Name,
      Status: newSalesOrder.Status,
      Description: newSalesOrder.Description,
      Order_Date: formatDateForZoho(newSalesOrder.Order_Date) || formatDateForZoho(new Date()),
      Due_Date: formatDateForZoho(newSalesOrder.Due_Date),
      Billing_Address: newSalesOrder.Billing_Address,
      Shipping_Address: newSalesOrder.Shipping_Address,
      Product_Details: newSalesOrder.Product_Details,
      Sub_Total: newSalesOrder.Sub_Total || newSalesOrder.Total,
      Discount: newSalesOrder.Discount || 0,
      Adjustment: newSalesOrder.Adjustment || 0,
      Total: newSalesOrder.Total,
      Terms_and_Conditions: newSalesOrder.Terms_and_Conditions,
      Currency: newSalesOrder.Currency || 'USD'
    };

    console.log('Prepared sales order data:', salesOrderData);

    // Note: Zoho CRM uses 'Sales_Orders' as the module name
    const zohoResponse = await createOrUpdateInZoho('Sales_Orders', accessToken, salesOrderData);
    console.log('Zoho API Response:', zohoResponse);
    
    res.status(201).json({
      status: 201,
      success: true,
      data: zohoResponse,
      newSalesOrder: salesOrderData
    });
  } catch (error) {
    console.error('Error creating sales order:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};

export const getAllSalesOrders = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { page = 1, limit = 10 } = req.query;
    
    const { data, total } = await fetchAllFromZoho('Sales_Orders', accessToken, {
      page,
      per_page: limit
    });

    res.json({ 
      status: 200, 
      success: true, 
      data, 
      total,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllSalesOrders:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const getSalesOrderById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const salesOrderId = req.params.id;

    const zohoResponse = await fetchOneFromZoho('Sales_Orders', accessToken, salesOrderId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in getSalesOrderById:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const updateSalesOrder = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const salesOrderId = req.params.id;
    const updatedSalesOrder = req.body;

    const zohoResponse = await createOrUpdateInZoho('Sales_Orders', accessToken, updatedSalesOrder, salesOrderId);
    res.json({ status: 200, success: true, data: zohoResponse, updatedSalesOrder });
  } catch (error) {
    console.error('Error in updateSalesOrder:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const deleteSalesOrder = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const salesOrderId = req.params.id;

    const zohoResponse = await deleteFromZoho('Sales_Orders', accessToken, salesOrderId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in deleteSalesOrder:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

//// Invoices
export const createInvoice = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newInvoice } = req.body;

    if (!newInvoice.Subject || !newInvoice.Account_Name || !newInvoice.Status) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Required fields missing: Subject, Account_Name, Status'
      });
    }

    const zohoResponse = await createOrUpdateInZoho('Invoices', accessToken, newInvoice);
    res.json({ status: 201, success: true, data: zohoResponse, newInvoice });
  } catch (error) {
    console.error('Error in createInvoice:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const getAllInvoices = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { page = 1, limit = 10 } = req.query;
    
    const { data, total } = await fetchAllFromZoho('Invoices', accessToken, {
      page,
      per_page: limit
    });

    res.json({ 
      status: 200, 
      success: true, 
      data, 
      total,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllInvoices:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const getInvoiceById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const invoiceId = req.params.id;

    const zohoResponse = await fetchOneFromZoho('Invoices', accessToken, invoiceId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in getInvoiceById:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const updateInvoice = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const invoiceId = req.params.id;
    const updatedInvoice = req.body;

    const zohoResponse = await createOrUpdateInZoho('Invoices', accessToken, updatedInvoice, invoiceId);
    res.json({ status: 200, success: true, data: zohoResponse, updatedInvoice });
  } catch (error) {
    console.error('Error in updateInvoice:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};

export const deleteInvoice = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const invoiceId = req.params.id;

    const zohoResponse = await deleteFromZoho('Invoices', accessToken, invoiceId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in deleteInvoice:', error.message);
    res.status(500).json({ status: 500, success: false, error: error.message });
  }
};



const validModules = [
  'Leads',
  'Contacts',
  'Accounts',
  'Deals',
  'Campaigns',
  'Tasks',
  'Cases',
  'Solutions',
  'Products',
  'Vendors',
  'Price_Books',
  'Quotes',
  'Sales_Orders',
  'Purchase_Orders',
  'Invoices',
  'Activities',
  'Calls',
  'Events',
  'Notes'
];

// Helper function to check if a string matches the search query (case-insensitive, partial match)
const isMatch = (value, searchQuery) => {
  if (!value || !searchQuery) return false;
  const strValue = String(value).toLowerCase();
  const strQuery = String(searchQuery).toLowerCase();
  return strValue.includes(strQuery);
};

// Helper function to check if any field in an object matches the search query
const hasMatchingField = (record, searchQuery) => {
  return Object.entries(record).some(([key, value]) => {
    // Skip the id field and null/undefined values
    if (key === 'id' || value == null) return false;
    return isMatch(value, searchQuery);
  });
};

export const searchIds = async (req, res) => {
  try {
    const { module, searchQuery } = req.query;
    const accessToken = getAccessTokenFromHeader(req);

    // Validate module
    if (!module) {
      return res.status(400).json({
        success: false,
        error: 'Module parameter is required',
        validModules: validModules
      });
    }

    // Find correct module name case
    const formattedModule = validModules.find(
      mod => mod.toLowerCase() === module.toLowerCase()
    );

    if (!formattedModule) {
      return res.status(400).json({
        success: false,
        error: 'Invalid module name',
        validModules: validModules
      });
    }

    // Construct Zoho API URL
    const baseURL = 'https://www.zohoapis.com/crm/v2';
    const headers = {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json'
    };

    let response;
    
    // Special handling for Products module
    if (formattedModule === 'Products') {
      // Get all products with specific fields
      response = await axios.get(`${baseURL}/Products`, {
        headers,
        params: {
          fields: 'id,Product_Name,Product_Code,Description,Category,Unit_Price,Tax,Status,Manufacturer,Product_Category,Vendor_Name'
        }
      });

      // If searchQuery is provided, filter the results
      if (searchQuery) {
        const filteredData = response.data.data.filter(product => {
          const searchFields = [
            product.Product_Name,
            product.Product_Code,
            product.Description,
            product.Category,
            product.Manufacturer,
            product.Vendor_Name
          ];
          
          return searchFields.some(field => 
            field && field.toLowerCase().includes(searchQuery.toLowerCase())
          );
        });
        
        response.data.data = filteredData;
      }
    } else {
      // For other modules, use the original approach
      response = await axios.get(`${baseURL}/${formattedModule}`, {
        headers,
        params: {
          per_page: 200
        }
      });

      // Format all records
      let records = response.data.data?.map(record => {
        const formattedRecord = {
          id: record.id
        };

        // Add all fields from the module's field mapping
        Object.keys(getDefaultModuleFields(formattedModule)).forEach(field => {
          formattedRecord[field] = record[field] || '—';
        });

        return formattedRecord;
      }) || [];

      // If searchQuery is provided, filter the records
      if (searchQuery) {
        records = records.filter(record => hasMatchingField(record, searchQuery));
      }

      response.data.data = records;
    }

    if (!response.data.data || response.data.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No records found',
        details: searchQuery ? 'Try searching with different criteria' : 'No records exist in this module'
      });
    }

    return res.status(200).json({
      success: true,
      count: response.data.data.length,
      module: formattedModule,
      data: response.data.data
    });

  } catch (error) {
    console.error('Zoho Search Error:', error.response?.data || error.message);
    
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || 'Search failed';

    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: error.response?.data?.details
    });
  }
};

// Helper function to get searchable fields for each module
function getSearchableFields(module) {
  const searchableFields = {
    'Contacts': [
      'First_Name',
      'Last_Name',
      'Email',
      'Phone',
      'Mobile'
    ],
    'Accounts': [
      'Account_Name',
      'Phone',
      'Website'
    ],
    'Deals': [
      'Deal_Name',
      'Stage',
      'Amount'
    ],
    'Products': [
      'Product_Name',
      'Product_Code'
    ],
    'Quotes': [
      'Subject',
      'Quote_Stage'
    ],
    'Sales_Orders': [
      'Subject',
      'Status'
    ],
    'Invoices': [
      'Subject',
      'Status'
    ],
    'Tasks': [
      'Subject',
      'Status'
    ],
    'Meetings': [
      'Subject',
      'Location'
    ],
    'Notes': [
      'Note_Title'
    ]
  };

  return searchableFields[module] || [];
}

// Helper function to get all fields for each module
function getDefaultModuleFields(module) {
  const fieldMappings = {
    'Leads': {
      'First_Name': 'First Name',
      'Last_Name': 'Last Name',
      'Email': 'Email',
      'Phone': 'Phone',
      'Mobile': 'Mobile',
      'Company': 'Company',
      'Designation': 'Designation',
      'Lead_Source': 'Lead Source',
      'Lead_Status': 'Lead Status',
      'Industry': 'Industry',
      'Annual_Revenue': 'Annual Revenue',
      'Website': 'Website',
      'Description': 'Description'
    },
    'Contacts': {
      'First_Name': 'First Name',
      'Last_Name': 'Last Name',
      'Email': 'Email',
      'Phone': 'Phone',
      'Mobile': 'Mobile',
      'Title': 'Title',
      'Department': 'Department',
      'Company': 'Company'
    },
    'Accounts': {
      'Account_Name': 'Account Name',
      'Phone': 'Phone',
      'Website': 'Website',
      'Industry': 'Industry',
      'Type': 'Type',
      'Billing_City': 'Billing City',
      'Billing_Country': 'Billing Country'
    },
    'Deals': {
      'Deal_Name': 'Deal Name',
      'Stage': 'Stage',
      'Amount': 'Amount',
      'Expected_Revenue': 'Expected Revenue',
      'Closing_Date': 'Closing Date',
      'Type': 'Type'
    },
    'Products': {
      'Product_Name': 'Product Name',
      'Product_Code': 'Product Code',
      'Description': 'Description',
      'Category': 'Category',
      'Unit_Price': 'Unit Price',
      'Tax': 'Tax',
      'Status': 'Status',
      'Manufacturer': 'Manufacturer',
      'Product_Category': 'Product Category',
      'Sales_Start_Date': 'Sales Start Date',
      'Sales_End_Date': 'Sales End Date',
      'Support_Start_Date': 'Support Start Date',
      'Support_End_Date': 'Support End Date',
      'Usage_Unit': 'Usage Unit',
      'Qty_in_Demand': 'Quantity in Demand',
      'Qty_in_Stock': 'Quantity in Stock',
      'Reorder_Level': 'Reorder Level',
      'Handler': 'Handler',
      'Vendor_Name': 'Vendor Name',
      'Commission_Rate': 'Commission Rate',
      'Taxable': 'Taxable',
      'Currency': 'Currency',
      'Recurring': 'Recurring',
      'Exempt': 'Exempt',
      'Shipping_Cost': 'Shipping Cost',
      'Weight': 'Weight',
      'Width': 'Width',
      'Length': 'Length',
      'Height': 'Height'
    },
    'Events': {
      'Subject': 'Subject',
      'Start_DateTime': 'Start Date Time',
      'End_DateTime': 'End Date Time',
      'Location': 'Location',
      'Description': 'Description',
      'Status': 'Status',
      'Priority': 'Priority',
      'Reminder': 'Reminder'
    },
    'Campaigns': {
      'Campaign_Name': 'Campaign Name',
      'Type': 'Type',
      'Status': 'Status',
      'Start_Date': 'Start Date',
      'End_Date': 'End Date',
      'Expected_Revenue': 'Expected Revenue',
      'Budgeted_Cost': 'Budgeted Cost',
      'Actual_Cost': 'Actual Cost',
      'Description': 'Description'
    },
    'Quotes': {
      'Subject': 'Subject',
      'Quote_Stage': 'Quote Stage',
      'Valid_Till': 'Valid Till',
      'Terms_and_Conditions': 'Terms and Conditions'
    },
    'Sales_Orders': {
      'Subject': 'Subject',
      'Status': 'Status',
      'Order_Date': 'Order Date',
      'Due_Date': 'Due Date'
    },
    'Invoices': {
      'Subject': 'Subject',
      'Status': 'Status',
      'Invoice_Date': 'Invoice Date',
      'Due_Date': 'Due Date'
    },
    'Tasks': {
      'Subject': 'Subject',
      'Status': 'Status',
      'Priority': 'Priority',
      'Due_Date': 'Due Date'
    },
    'Notes': {
      'Note_Title': 'Note Title',
      'Note_Content': 'Note Content'
    },
    'Cases': {
      'Subject': 'Subject',
      'Description': 'Description',
      'Status': 'Status',
      'Priority': 'Priority',
      'Type': 'Type',
      'Origin': 'Origin'
    },
    'Solutions': {
      'Solution_Title': 'Solution Title',
      'Solution_Type': 'Solution Type',
      'Status': 'Status',
      'Description': 'Description'
    },
    'Price_Books': {
      'Name': 'Name',
      'Description': 'Description',
      'Status': 'Status'
    },
    'Vendors': {
      'Vendor_Name': 'Vendor Name',
      'Email': 'Email',
      'Phone': 'Phone',
      'Website': 'Website',
      'Category': 'Category'
    },
    'Purchase_Requests': {
      'Subject': 'Subject',
      'Status': 'Status',
      'Requested_By': 'Requested By',
      'Request_Date': 'Request Date'
    }
  };

  return fieldMappings[module] || {};
}

// ===== Cases/Tickets Controller =====

  
export const createCase = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token is missing or invalid' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { newCase } = req.body;

    // Validate required fields
    if (!newCase.Subject || !newCase.Status || !newCase.Priority) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: {
          message: 'Subject, Status, and Priority are required'
        }
      });
    }

    // Format the data according to Zoho's requirements
    const caseData = {
      data: [{
      Subject: newCase.Subject,
        Status: newCase.Status,
        Priority: newCase.Priority,
        Case_Origin: newCase.Case_Origin || 'Web',
      Description: newCase.Description,
        Account_Name: newCase.Account_Name ? { id: String(newCase.Account_Name) } : undefined,
        Contact_Name: newCase.Contact_Name ? { id: String(newCase.Contact_Name) } : undefined,
        Email: newCase.Email,
        Phone: newCase.Phone,
        Product_Name: newCase.Product_Name ? { id: String(newCase.Product_Name) } : undefined,
        Solution: newCase.Solution,
        Internal_Comments: newCase.Internal_Comments,
        Due_Date: newCase.Due_Date
      }]
    };

    // Make the API call to create case
    const response = await axios.post(
      'https://www.zohoapis.com/crm/v2/Cases',
      caseData,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.status(201).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Error creating case:', error.response?.data || error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data || {}
    });
  }
};


export const getCases = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token is missing or invalid' });
    }
    const accessToken = authHeader.split(' ')[1];

    const response = await axios.get(
      'https://www.zohoapis.com/crm/v2/Cases',
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Error fetching cases:', error.response?.data || error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data || {}
    });
  }
};


export const getCaseById = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token is missing or invalid' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Case ID is required'
      });
    }

    const response = await axios.get(
      `https://www.zohoapis.com/crm/v2/Cases/${id}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Error fetching case:', error.response?.data || error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data || {}
    });
  }
};


export const updateCase = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token is missing or invalid' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { id } = req.params;
    const { caseData } = req.body;

    if (!id || !caseData) {
        return res.status(400).json({
          success: false,
        error: 'Case ID and update data are required'
      });
    }

    // Format the data for update
    const formattedData = {
      data: [{
        id: String(id),
        ...caseData,
        // Format nested objects if they exist
        Account_Name: caseData.Account_Name ? { id: String(caseData.Account_Name) } : undefined,
        Contact_Name: caseData.Contact_Name ? { id: String(caseData.Contact_Name) } : undefined,
        Product_Name: caseData.Product_Name ? { id: String(caseData.Product_Name) } : undefined
      }]
    };

    const response = await axios.put(
      `https://www.zohoapis.com/crm/v2/Cases/${id}`,
      formattedData,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Error updating case:', error.response?.data || error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data || {}
    });
  }
};


export const deleteCase = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token is missing or invalid' });
    }
    const accessToken = authHeader.split(' ')[1];

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Case ID is required'
      });
    }

    const response = await axios.delete(
      `https://www.zohoapis.com/crm/v2/Cases/${id}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Error deleting case:', error.response?.data || error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data || {}
    });
  }
};

// ===== Goals Controller =====


export const createGoal = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const {
      // Required fields
      name,
      target,
      startDate,
      endDate,
      
      // Optional fields
      description,
      type = 'Sales',
      status = 'In Progress',
      assignedTo,
      progress = 0,
      customFields = {}
    } = req.body;

    // Validate required fields
    if (!name || !target || !startDate || !endDate) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Missing required fields',
        required: ['name', 'target', 'startDate', 'endDate'],
        received: { name, target, startDate, endDate }
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Invalid date format',
        message: 'Dates must be in valid ISO format'
      });
    }

    if (end < start) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Invalid date range',
        message: 'End date must be after start date'
      });
    }

    // Validate type
    const validTypes = ['Sales', 'Revenue', 'Customer', 'Product', 'Custom'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Invalid goal type',
        validTypes
      });
    }

    // Validate status
    const validStatuses = ['Not Started', 'In Progress', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Invalid status value',
        validStatuses
      });
    }

    // Validate progress
    if (progress < 0 || progress > 100) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Invalid progress value',
        message: 'Progress must be between 0 and 100'
      });
    }

    // Prepare goal data
    const goalData = {
      Name: name,
      Target: target,
      Start_Date: startDate,
      End_Date: endDate,
      Description: description,
      Type: type,
      Status: status,
      Progress: progress,
      ...(assignedTo && { AssignedTo: assignedTo }),
      ...customFields
    };

    // Make API call to create goal
    const response = await axios.post(
      'https://www.zohoapis.com/crm/v2/Goals',
      { data: [goalData] },
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(201).json({
      status: 201,
      success: true,
      data: response.data.data[0],
      message: 'Goal created successfully'
    });

  } catch (error) {
    console.error('Error creating goal:', {
      message: error.message,
      response: error.response?.data
    });

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};


export const getGoals = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { 
      page = 1, 
      limit = 10,
      type,
      status,
      assignedTo,
      search
    } = req.query;

    // Build filter criteria
    let criteria = '';
    const filters = [];

    if (type) filters.push(`Type:equals:${type}`);
    if (status) filters.push(`Status:equals:${status}`);
    if (assignedTo) filters.push(`AssignedTo:equals:${assignedTo}`);
    if (search) {
      filters.push(`(Name:contains:${search} OR Description:contains:${search})`);
    }

    if (filters.length > 0) {
      criteria = filters.join(' AND ');
    }

    // Make API call to get goals
    const response = await axios.get(
      'https://www.zohoapis.com/crm/v2/Goals',
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          criteria,
          page,
          per_page: limit
        }
      }
    );

    res.status(200).json({
      status: 200,
      success: true,
      data: response.data.data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: response.data.info.count
      }
    });

  } catch (error) {
    console.error('Error fetching goals:', {
      message: error.message,
      response: error.response?.data
    });

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};


export const getGoalById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { id } = req.params;

    const response = await axios.get(
      `https://www.zohoapis.com/crm/v2/Goals/${id}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      status: 200,
      success: true,
      data: response.data.data[0]
    });

  } catch (error) {
    console.error('Error fetching goal:', {
      message: error.message,
      response: error.response?.data
    });

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};


export const updateGoal = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { id } = req.params;
    const {
      name,
      target,
      startDate,
      endDate,
      description,
      type,
      status,
      assignedTo,
      progress,
      customFields = {}
    } = req.body;

    // Validate dates if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if ((startDate && isNaN(start.getTime())) || (endDate && isNaN(end.getTime()))) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Invalid date format',
          message: 'Dates must be in valid ISO format'
        });
      }

      if (start && end && end < start) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Invalid date range',
          message: 'End date must be after start date'
        });
      }
    }

    // Validate type if provided
    if (type) {
      const validTypes = ['Sales', 'Revenue', 'Customer', 'Product', 'Custom'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Invalid goal type',
          validTypes
        });
      }
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ['Not Started', 'In Progress', 'Completed', 'Cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Invalid status value',
          validStatuses
        });
      }
    }

    // Validate progress if provided
    if (progress !== undefined) {
      if (progress < 0 || progress > 100) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Invalid progress value',
          message: 'Progress must be between 0 and 100'
        });
      }
    }

    // Prepare update data
    const updateData = {
      ...(name && { Name: name }),
      ...(target && { Target: target }),
      ...(startDate && { Start_Date: startDate }),
      ...(endDate && { End_Date: endDate }),
      ...(description && { Description: description }),
      ...(type && { Type: type }),
      ...(status && { Status: status }),
      ...(assignedTo && { AssignedTo: assignedTo }),
      ...(progress !== undefined && { Progress: progress }),
      ...customFields
    };

    // Make API call to update goal
    const response = await axios.put(
      `https://www.zohoapis.com/crm/v2/Goals/${id}`,
      { data: [updateData] },
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      status: 200,
      success: true,
      data: response.data.data[0],
      message: 'Goal updated successfully'
    });

  } catch (error) {
    console.error('Error updating goal:', {
      message: error.message,
      response: error.response?.data
    });

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};


export const deleteGoal = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { id } = req.params;

    await axios.delete(
      `https://www.zohoapis.com/crm/v2/Goals/${id}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      status: 200,
      success: true,
      message: 'Goal deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting goal:', {
      message: error.message,
      response: error.response?.data
    });

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};

// ===== Orders Controller =====


export const createOrder = async (req, res) => {
  console.log('=== Starting createOrder function ===');
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newOrder } = req.body;

    console.log('Received order data:', newOrder);

    // Validate required fields
    if (!newOrder.Subject || !newOrder.Account_Name) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Required fields missing: Subject, Account_Name'
      });
    }

    // Prepare order data
    const orderData = {
      Subject: newOrder.Subject,
      Account_Name: newOrder.Account_Name,
      Status: newOrder.Status || 'Draft',
      Order_Date: newOrder.Order_Date || new Date().toISOString(),
      Due_Date: newOrder.Due_Date,
      Billing_Address: newOrder.Billing_Address,
      Shipping_Address: newOrder.Shipping_Address,
      Product_Details: newOrder.Product_Details || [],
      Sub_Total: newOrder.Sub_Total || 0,
      Discount: newOrder.Discount || 0,
      Adjustment: newOrder.Adjustment || 0,
      Total: newOrder.Total || 0,
      Terms_and_Conditions: newOrder.Terms_and_Conditions,
      Currency: newOrder.Currency || 'USD'
    };

    console.log('Prepared order data:', orderData);

    // Note: Zoho CRM uses 'Sales_Orders' as the module name
    const zohoResponse = await createOrUpdateInZoho('Sales_Orders', accessToken, orderData);
    console.log('Zoho API Response:', zohoResponse);
    
    res.status(201).json({
      status: 201,
      success: true,
      data: zohoResponse,
      newOrder: orderData
    });
  } catch (error) {
    console.error('Error in createOrder:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });
    res.status(500).json({
      status: 500,
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
};


export const getOrders = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { 
      page = 1, 
      limit = 10,
      status,
      accountId,
      search,
      startDate,
      endDate
    } = req.query;

    // Build filter criteria
    let criteria = '';
    const filters = [];

    if (status) filters.push(`Status:equals:${status}`);
    if (accountId) filters.push(`AccountId:equals:${accountId}`);
    if (search) {
      filters.push(`(Subject:contains:${search} OR Description:contains:${search})`);
    }
    if (startDate) filters.push(`Order_Date:greater_equals:${startDate}`);
    if (endDate) filters.push(`Order_Date:less_equals:${endDate}`);

    if (filters.length > 0) {
      criteria = filters.join(' AND ');
    }

    // Make API call to get orders
    const response = await axios.get(
      'https://www.zohoapis.com/crm/v2/Orders',
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          criteria,
          page,
          per_page: limit
        }
      }
    );

    res.status(200).json({
      status: 200,
      success: true,
      data: response.data.data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: response.data.info.count
      }
    });

  } catch (error) {
    console.error('Error fetching orders:', {
      message: error.message,
      response: error.response?.data
    });

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};


export const getOrderById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { id } = req.params;

    const response = await axios.get(
      `https://www.zohoapis.com/crm/v2/Orders/${id}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      status: 200,
      success: true,
      data: response.data.data[0]
    });

  } catch (error) {
    console.error('Error fetching order:', {
      message: error.message,
      response: error.response?.data
    });

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};


export const updateOrder = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { id } = req.params;
    const {
      subject,
      accountId,
      description,
      orderDate,
      dueDate,
      status,
      billingAddress,
      shippingAddress,
      items,
      totalAmount,
      currency,
      customFields = {}
    } = req.body;

    // Validate status if provided
    if (status) {
      const validStatuses = ['Draft', 'Submitted', 'Approved', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Invalid status value',
          validStatuses
        });
      }
    }

    // Validate dates if provided
    if (orderDate || dueDate) {
      const order = orderDate ? new Date(orderDate) : null;
      const due = dueDate ? new Date(dueDate) : null;

      if ((orderDate && isNaN(order.getTime())) || (dueDate && isNaN(due.getTime()))) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Invalid date format',
          message: 'Dates must be in valid ISO format'
        });
      }

      if (order && due && due < order) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Invalid date range',
          message: 'Due date must be after order date'
        });
      }
    }

    // Validate items if provided
    if (items && items.length > 0) {
      for (const item of items) {
        if (!item.name || !item.quantity || !item.price) {
          return res.status(400).json({
            status: 400,
            success: false,
            error: 'Invalid item data',
            message: 'Each item must have name, quantity, and price'
          });
        }
      }
    }

    // Prepare update data
    const updateData = {
      ...(subject && { Subject: subject }),
      ...(accountId && { AccountId: accountId }),
      ...(description && { Description: description }),
      ...(orderDate && { Order_Date: orderDate }),
      ...(dueDate && { Due_Date: dueDate }),
      ...(status && { Status: status }),
      ...(billingAddress && { Billing_Address: billingAddress }),
      ...(shippingAddress && { Shipping_Address: shippingAddress }),
      ...(items && { Items: items }),
      ...(totalAmount && { Total_Amount: totalAmount }),
      ...(currency && { Currency: currency }),
      ...customFields
    };

    // Make API call to update order
    const response = await axios.put(
      `https://www.zohoapis.com/crm/v2/Orders/${id}`,
      { data: [updateData] },
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      status: 200,
      success: true,
      data: response.data.data[0],
      message: 'Order updated successfully'
    });

  } catch (error) {
    console.error('Error updating order:', {
      message: error.message,
      response: error.response?.data
    });

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};


export const deleteOrder = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { id } = req.params;

    await axios.delete(
      `https://www.zohoapis.com/crm/v2/Orders/${id}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      status: 200,
      success: true,
      message: 'Order deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting order:', {
      message: error.message,
      response: error.response?.data
    });

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};

// ===== Email Controller =====


// ===== Enhanced Email Creation Controller =====

export const sendEmail = async (req, res) => {
  try {
    console.log('=== Enhanced Email Creation Started ===');
    const accessToken = getAccessTokenFromHeader(req);
    
    // Handle multiple input formats for flexibility
    const emailData = req.body.newEmail || req.body.new_email || req.body.emailData || req.body;
    
    console.log('Received email data:', JSON.stringify(emailData, null, 2));

    // Comprehensive validation
    if (!emailData || typeof emailData !== 'object') {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Email data is required',
        expectedFormat: {
          newEmail: {
            to: 'recipient@example.com or [emails]',
            subject: 'Email subject',
            content: 'Email content or body',
            from: 'sender@example.com or {email, user_name}',
            Related_To: 'Leads, Contacts, Accounts, or Deals',
            Related_Id: 'Record ID to associate email with'
          }
        }
      });
    }

    // Enhanced field validation with better error messages
    const requiredFields = [];
    if (!emailData.to) requiredFields.push('to (recipient email)');
    if (!emailData.subject) requiredFields.push('subject');
    if (!emailData.content && !emailData.body) requiredFields.push('content or body');
    if (!emailData.from) requiredFields.push('from (sender email)');

    if (requiredFields.length > 0) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: `Missing required fields: ${requiredFields.join(', ')}`,
        received: {
          to: emailData.to ? 'provided' : 'missing',
          subject: emailData.subject ? 'provided' : 'missing',
          content: emailData.content || emailData.body ? 'provided' : 'missing',
          from: emailData.from ? 'provided' : 'missing',
          Related_To: emailData.Related_To || 'optional',
          Related_Id: emailData.Related_Id || 'optional'
        }
      });
    }

    // Method 1: Try sending email via associated record (if Related_To and Related_Id provided)
    let sendMailError = null;
    if (emailData.Related_To && emailData.Related_Id) {
      console.log('Attempting Method 1: Send via associated record');
      
      // Validate Related_To field
      const validRelatedModules = ['Leads', 'Contacts', 'Accounts', 'Deals', 'Cases', 'Quotes'];
      if (!validRelatedModules.includes(emailData.Related_To)) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: `Invalid Related_To value: ${emailData.Related_To}`,
          validValues: validRelatedModules
        });
      }

      // First verify the related record exists
      try {
        await axios.get(
          `https://www.zohoapis.com/crm/v2/${emailData.Related_To}/${emailData.Related_Id}`,
          {
            headers: {
              'Authorization': `Zoho-oauthtoken ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('Related record verified successfully');
      } catch (verifyError) {
        console.warn('Related record verification failed:', verifyError.response?.data);
        return res.status(400).json({
          status: 400,
          success: false,
          error: `Related record not found: ${emailData.Related_To} with ID ${emailData.Related_Id}`,
          details: verifyError.response?.data
        });
      }

      // Prepare email data for send_mail action
      const sendMailData = {
        from: typeof emailData.from === 'string' 
          ? { email: emailData.from }
          : {
              email: emailData.from.email,
              ...(emailData.from.user_name && { user_name: emailData.from.user_name })
            },
        to: Array.isArray(emailData.to) 
          ? emailData.to.map(email => typeof email === 'string' ? { email } : email)
          : [typeof emailData.to === 'string' ? { email: emailData.to } : emailData.to],
        subject: emailData.subject,
        content: emailData.content || emailData.body,
        ...(emailData.cc && {
          cc: Array.isArray(emailData.cc) 
            ? emailData.cc.map(email => typeof email === 'string' ? { email } : email)
            : [typeof emailData.cc === 'string' ? { email: emailData.cc } : emailData.cc]
        }),
        ...(emailData.bcc && {
          bcc: Array.isArray(emailData.bcc) 
            ? emailData.bcc.map(email => typeof email === 'string' ? { email } : email)
            : [typeof emailData.bcc === 'string' ? { email: emailData.bcc } : emailData.bcc]
        }),
        ...(emailData.mail_format && { mail_format: emailData.mail_format }),
        ...(emailData.template && { template: emailData.template }),
        ...(emailData.scheduled_time && { scheduled_time: emailData.scheduled_time })
      };

      const endpoint = `https://www.zohoapis.com/crm/v2/${emailData.Related_To}/${emailData.Related_Id}/actions/send_mail`;
      
      console.log('Send mail endpoint:', endpoint);
      console.log('Send mail data:', JSON.stringify(sendMailData, null, 2));

      try {
        const response = await axios.post(endpoint, sendMailData, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('Method 1 successful:', response.data);
        return res.status(201).json({
          status: 201,
          success: true,
          method: 'send_mail_action',
          data: response.data,
          emailData: sendMailData
        });
             } catch (error) {
         sendMailError = error;
         console.warn('Method 1 failed:', error.response?.data);
         console.log('Falling back to Method 2: Create email record');
       }
    }

    // Method 2: Create email as a record in the Emails module
    console.log('Attempting Method 2: Create email record');
    
    const emailRecord = {
      Subject: emailData.subject,
      Content: emailData.content || emailData.body,
      From: typeof emailData.from === 'string' ? emailData.from : emailData.from.email,
      To: Array.isArray(emailData.to) 
        ? emailData.to.join(', ')
        : typeof emailData.to === 'string' 
        ? emailData.to 
        : emailData.to.email,
      ...(emailData.cc && { 
        CC: Array.isArray(emailData.cc) 
          ? emailData.cc.map(email => typeof email === 'string' ? email : email.email).join(', ')
          : typeof emailData.cc === 'string' 
          ? emailData.cc 
          : emailData.cc.email 
      }),
      ...(emailData.bcc && { 
        BCC: Array.isArray(emailData.bcc) 
          ? emailData.bcc.map(email => typeof email === 'string' ? email : email.email).join(', ')
          : typeof emailData.bcc === 'string' 
          ? emailData.bcc 
          : emailData.bcc.email 
      }),
      Status: emailData.status || 'Sent',
      Date_Time: new Date().toISOString(),
      ...(emailData.Related_To && emailData.Related_Id && {
        [`${emailData.Related_To.slice(0, -1)}_Name`]: { id: emailData.Related_Id }
      }),
      ...(emailData.owner && { Owner: emailData.owner }),
      ...(emailData.mail_format && { Mail_Format: emailData.mail_format }),
      ...(emailData.priority && { Priority: emailData.priority })
    };

    console.log('Email record data:', JSON.stringify(emailRecord, null, 2));

    try {
      const response = await axios.post(
        'https://www.zohoapis.com/crm/v2/Emails',
        { data: [emailRecord] },
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Method 2 successful:', response.data);
      return res.status(201).json({
        status: 201,
        success: true,
        method: 'create_email_record',
        data: response.data,
        emailRecord
      });
    } catch (createError) {
      console.error('Method 2 failed:', createError.response?.data);
      
      // Handle specific permission errors
      if (createError.response?.data?.code === 'NO_PERMISSION') {
        return res.status(403).json({
          status: 403,
          success: false,
          error: 'Email creation permission denied',
          code: 'NO_PERMISSION',
          details: {
            message: 'Your Zoho CRM account does not have permission to create emails',
            required_permission: 'Crm_Implied_Create_Emails',
            solutions: [
              'Contact your Zoho CRM administrator to enable email permissions',
              'Check if the Emails module is enabled in your CRM',
              'Verify your user profile has email creation rights',
              'Try using a different authentication method'
            ],
            troubleshooting_steps: [
              '1. Log into Zoho CRM as an administrator',
              '2. Go to Setup > Users and Control > Security Control > Module Permissions',
              '3. Enable "Emails" module for your user profile',
              '4. Ensure "Create" permission is enabled for Emails',
              '5. Re-authenticate and try again'
            ]
          }
        });
      }
      
      // Method 3: Simplified email creation (last resort)
      console.log('Attempting Method 3: Simplified email creation');
      
      const simpleEmailRecord = {
        Subject: emailData.subject,
        Content: emailData.content || emailData.body,
        From: typeof emailData.from === 'string' ? emailData.from : emailData.from.email,
        To: Array.isArray(emailData.to) ? emailData.to[0] : emailData.to,
        Status: 'Draft'
      };

      try {
        const response = await axios.post(
          'https://www.zohoapis.com/crm/v2/Emails',
          { data: [simpleEmailRecord] },
          {
            headers: {
              'Authorization': `Zoho-oauthtoken ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('Method 3 successful:', response.data);
        return res.status(201).json({
          status: 201,
          success: true,
          method: 'simplified_email_record',
          data: response.data,
          emailRecord: simpleEmailRecord,
          note: 'Email created as draft record. Some fields may not be populated due to API limitations.'
        });
      } catch (simpleError) {
        console.error('All methods failed. Final error:', simpleError.response?.data);
        
                 return res.status(simpleError.response?.status || 500).json({
           status: simpleError.response?.status || 500,
           success: false,
           error: 'Email creation failed with all methods',
           details: {
             method1_error: sendMailError?.response?.data || 'Not attempted (missing Related_To/Related_Id)',
             method2_error: createError.response?.data,
             method3_error: simpleError.response?.data,
            troubleshooting: {
              suggestions: [
                'Verify your access token has email permissions',
                'Check if the Emails module is enabled in your Zoho CRM',
                'Ensure Related_To and Related_Id are valid if provided',
                'Try with minimal required fields only'
              ],
              requiredScopes: [
                'ZohoCRM.modules.emails.ALL',
                'ZohoCRM.modules.ALL'
              ]
            }
          }
        });
      }
    }

  } catch (error) {
    console.error('Unexpected error in sendEmail:', error);
    return res.status(500).json({
      status: 500,
      success: false,
      error: 'Unexpected error during email creation',
      details: {
        message: error.message,
        stack: error.stack
      }
    });
  }
};

// ===== Simple Email Creation (Alternative Method) =====
export const createEmail = async (req, res) => {
  try {
    console.log('=== Simple Email Creation Started ===');
    const accessToken = getAccessTokenFromHeader(req);
    
    const { newEmail } = req.body;
    
    if (!newEmail) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'newEmail object is required',
        example: {
          newEmail: {
            to: 'recipient@example.com',
            subject: 'Test Email',
            content: 'Email body content',
            from: 'sender@example.com'
          }
        }
      });
    }

    // Basic validation
    if (!newEmail.to || !newEmail.subject || !newEmail.content || !newEmail.from) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Required fields: to, subject, content, from',
        received: {
          to: newEmail.to ? 'provided' : 'missing',
          subject: newEmail.subject ? 'provided' : 'missing',
          content: newEmail.content ? 'provided' : 'missing',
          from: newEmail.from ? 'provided' : 'missing'
        }
      });
    }

    // Create simple email record
    const emailData = {
      Subject: newEmail.subject,
      Content: newEmail.content,
      From: newEmail.from,
      To: newEmail.to,
      Status: newEmail.status || 'Draft',
      Date_Time: new Date().toISOString(),
      ...(newEmail.cc && { CC: newEmail.cc }),
      ...(newEmail.bcc && { BCC: newEmail.bcc }),
      ...(newEmail.priority && { Priority: newEmail.priority })
    };

    console.log('Creating email with data:', emailData);

    const response = await axios.post(
      'https://www.zohoapis.com/crm/v2/Emails',
      { data: [emailData] },
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(201).json({
      status: 201,
      success: true,
      data: response.data,
      emailData
    });

  } catch (error) {
    console.error('Error in createEmail:', error.response?.data || error.message);
    
    // Enhanced error handling
    if (error.response?.data?.code === 'OAUTH_SCOPE_MISMATCH') {
      return res.status(401).json({
        status: 401,
        success: false,
        error: 'OAuth scope mismatch - insufficient permissions for Emails module',
        code: 'OAUTH_SCOPE_MISMATCH',
        details: {
          message: 'Your access token does not have permission to access the Emails module',
          required_scopes: [
            'ZohoCRM.modules.ALL',
            'ZohoCRM.modules.emails.ALL',
            'ZohoCRM.modules.emails.CREATE'
          ],
          solution: 'Re-authenticate with broader scopes',
          action_url: '/api/zoho/auth/url?platform=web'
        }
      });
    }

    if (error.response?.data?.code === 'NO_PERMISSION') {
      return res.status(403).json({
        status: 403,
        success: false,
        error: 'Email creation permission denied',
        code: 'NO_PERMISSION',
        details: {
          message: 'Your Zoho CRM account does not have permission to create emails',
          required_permission: 'Crm_Implied_Create_Emails',
          solutions: [
            'Contact your Zoho CRM administrator to enable email permissions',
            'Check if the Emails module is enabled in your CRM',
            'Verify your user profile has email creation rights',
            'Try using a different authentication method'
          ],
          troubleshooting_steps: [
            '1. Log into Zoho CRM as an administrator',
            '2. Go to Setup > Users and Control > Security Control > Module Permissions',
            '3. Enable "Emails" module for your user profile',
            '4. Ensure "Create" permission is enabled for Emails',
            '5. Re-authenticate and try again'
          ]
        }
      });
    }

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};

// ===== Alternative Email Creation (No Emails Module Required) =====
export const createEmailActivity = async (req, res) => {
  try {
    console.log('=== Alternative Email Activity Creation Started ===');
    const accessToken = getAccessTokenFromHeader(req);
    
    const { newEmail } = req.body;
    
    if (!newEmail) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'newEmail object is required',
        example: {
          newEmail: {
            to: 'recipient@example.com',
            subject: 'Test Email',
            content: 'Email body content',
            from: 'sender@example.com',
            Related_To: 'Leads',
            Related_Id: '123456789012345678'
          }
        }
      });
    }

    // Basic validation
    if (!newEmail.to || !newEmail.subject || !newEmail.content || !newEmail.from) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Required fields: to, subject, content, from',
        received: {
          to: newEmail.to ? 'provided' : 'missing',
          subject: newEmail.subject ? 'provided' : 'missing',
          content: newEmail.content ? 'provided' : 'missing',
          from: newEmail.from ? 'provided' : 'missing'
        }
      });
    }

    // Create email as an Activity/Task instead of Email record
    const emailActivityData = {
      Subject: `Email: ${newEmail.subject}`,
      Description: `Email sent to: ${newEmail.to}\nFrom: ${newEmail.from}\n\nContent:\n${newEmail.content}`,
      Status: 'Completed',
      Priority: newEmail.priority || 'Normal',
      Due_Date: new Date().toISOString().split('T')[0],
      SEMODULE: newEmail.Related_To || 'Tasks',
      ...(newEmail.Related_To && newEmail.Related_Id && {
        [`${newEmail.Related_To.slice(0, -1)}_Name`]: { id: newEmail.Related_Id }
      })
    };

    console.log('Creating email activity with data:', emailActivityData);

    const response = await axios.post(
      'https://www.zohoapis.com/crm/v2/Tasks',
      { data: [emailActivityData] },
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(201).json({
      status: 201,
      success: true,
      method: 'email_as_task_activity',
      data: response.data,
      emailActivityData,
      note: 'Email created as a Task activity since direct email creation requires additional permissions'
    });

  } catch (error) {
    console.error('Error in createEmailActivity:', error.response?.data || error.message);
    
    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};


export const getEmails = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { 
      page = 1, 
      limit = 10,
      to,
      from,
      subject,
      startDate,
      endDate,
      relatedTo,
      relatedToId
    } = req.query;

    // Build filter criteria
    let criteria = '';
    const filters = [];

    if (to) filters.push(`To:equals:${to}`);
    if (from) filters.push(`From:equals:${from}`);
    if (subject) filters.push(`Subject:contains:${subject}`);
    if (startDate) filters.push(`Date:greater_equals:${startDate}`);
    if (endDate) filters.push(`Date:less_equals:${endDate}`);
    if (relatedTo) filters.push(`RelatedTo:equals:${relatedTo}`);
    if (relatedToId) filters.push(`RelatedToId:equals:${relatedToId}`);

    if (filters.length > 0) {
      criteria = filters.join(' AND ');
    }

    // Make API call to get emails
    const response = await axios.get(
      'https://www.zohoapis.com/crm/v2/Emails',
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          criteria,
          page,
          per_page: limit
        }
      }
    );

    res.status(200).json({
      status: 200,
      success: true,
      data: response.data.data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: response.data.info.count
      }
    });

  } catch (error) {
    console.error('Error fetching emails:', {
      message: error.message,
      response: error.response?.data
    });

    res.status(error.response?.status || 500).json({
      status: error.response?.status || 500,
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};

export const getEmailById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const emailId = req.params.id;

    const zohoResponse = await fetchOneFromZoho('Emails', accessToken, emailId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in getEmailById:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
};


export const updateEmail = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const emailId = req.params.id;
    const { updatedEmail } = req.body;

    // Validate email status if provided
    if (updatedEmail.Status) {
      const validStatuses = ['Draft', 'Sent', 'Failed', 'Scheduled'];
      if (!validStatuses.includes(updatedEmail.Status)) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Invalid email status',
          validStatuses
        });
      }
    }

    const zohoResponse = await createOrUpdateInZoho('Emails', accessToken, updatedEmail, emailId);
    res.json({ status: 200, success: true, data: zohoResponse, updatedEmail });
  } catch (error) {
    console.error('Error in updateEmail:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
};


export const deleteEmail = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const emailId = req.params.id;

    const zohoResponse = await deleteFromZoho('Emails', accessToken, emailId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in deleteEmail:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
};

// ===== Calls Controller =====


export const createCall = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { newCall } = req.body;

    // Validate required fields
    if (!newCall.Subject || !newCall.Call_Type) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'Required fields missing: Subject, Call_Type'
      });
    }

    // Prepare call data
    const callData = {
      Subject: newCall.Subject,
      Call_Type: newCall.Call_Type,
      Call_Start_Time: newCall.Call_Start_Time || new Date().toISOString(),
      Call_Duration: newCall.Call_Duration || '0',
      Call_Result: newCall.Call_Result || 'Not Started',
      ...(newCall.Account_Name && { Account_Name: newCall.Account_Name }),
      ...(newCall.Contact_Name && { Contact_Name: newCall.Contact_Name }),
      ...(newCall.Assigned_To && { Assigned_To: newCall.Assigned_To }),
      ...(newCall.Description && { Description: newCall.Description })
    };

    const zohoResponse = await createOrUpdateInZoho('Calls', accessToken, callData);
    
    res.status(201).json({
      status: 201,
      success: true,
      data: zohoResponse,
      newCall: callData
    });
  } catch (error) {
    console.error('Error in createCall:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
};


export const getAllCalls = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { 
      page = 1, 
      limit = 10,
      callType,
      callResult,
      assignedTo,
      startDate,
      endDate,
      search
    } = req.query;

    // Build filter criteria
    let criteria = '';
    const filters = [];

    if (callType) filters.push(`Call_Type:equals:${callType}`);
    if (callResult) filters.push(`Call_Result:equals:${callResult}`);
    if (assignedTo) filters.push(`Assigned_To:equals:${assignedTo}`);
    if (startDate) filters.push(`Call_Start_Time:greater_equals:${startDate}`);
    if (endDate) filters.push(`Call_Start_Time:less_equals:${endDate}`);
    if (search) {
      filters.push(`(Subject:contains:${search} OR Description:contains:${search})`);
    }

    if (filters.length > 0) {
      criteria = filters.join(' AND ');
    }

    const { data, total } = await fetchAllFromZoho('Calls', accessToken, {
      page,
      per_page: limit,
      criteria
    });

    res.status(200).json({
      status: 200,
      success: true,
      data,
      total,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllCalls:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
};


export const getCallById = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const callId = req.params.id;

    const zohoResponse = await fetchOneFromZoho('Calls', accessToken, callId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in getCallById:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
};


export const updateCall = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const callId = req.params.id;
    const { updatedCall } = req.body;

    // Validate call type if provided
    if (updatedCall.Call_Type) {
      const validCallTypes = ['Inbound', 'Outbound'];
      if (!validCallTypes.includes(updatedCall.Call_Type)) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Invalid call type',
          validCallTypes
        });
      }
    }

    // Validate call result if provided
    if (updatedCall.Call_Result) {
      const validCallResults = ['Not Started', 'In Progress', 'Completed', 'Busy', 'No Answer', 'Cancelled'];
      if (!validCallResults.includes(updatedCall.Call_Result)) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: 'Invalid call result',
          validCallResults
        });
      }
    }

    const zohoResponse = await createOrUpdateInZoho('Calls', accessToken, updatedCall, callId);
    res.json({ status: 200, success: true, data: zohoResponse, updatedCall });
  } catch (error) {
    console.error('Error in updateCall:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
};


export const deleteCall = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const callId = req.params.id;

    const zohoResponse = await deleteFromZoho('Calls', accessToken, callId);
    res.json({ status: 200, success: true, data: zohoResponse });
  } catch (error) {
    console.error('Error in deleteCall:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
};

// ===== Cases Controller =====


export const getAllCases = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token is missing or invalid' });
    }
    const accessToken = authHeader.split(' ')[1];

    const response = await axios.get(
      'https://www.zohoapis.com/crm/v2/Cases',
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Error fetching cases:', error.response?.data || error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data || {}
    });
  }
};


export const getAllEmails = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { 
      page = 1, 
      limit = 10,
      to,
      from,
      subject,
      startDate,
      endDate,
      relatedTo,
      relatedToId,
      search
    } = req.query;

    // Build filter criteria
    let criteria = '';
    const filters = [];

    if (to) filters.push(`To:equals:${to}`);
    if (from) filters.push(`From:equals:${from}`);
    if (subject) filters.push(`Subject:contains:${subject}`);
    if (startDate) filters.push(`Date:greater_equals:${startDate}`);
    if (endDate) filters.push(`Date:less_equals:${endDate}`);
    if (relatedTo) filters.push(`Related_To:equals:${relatedTo}`);
    if (relatedToId) filters.push(`Related_To_Id:equals:${relatedToId}`);
    if (search) {
      filters.push(`(Subject:contains:${search} OR Body:contains:${search})`);
    }

    if (filters.length > 0) {
      criteria = filters.join(' AND ');
    }

    const { data, total } = await fetchAllFromZoho('Emails', accessToken, {
      page,
      per_page: limit,
      criteria
    });

    res.status(200).json({
      status: 200,
      success: true,
      data,
      total,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getAllEmails:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
};

export const searchProducts = async (req, res) => {
  try {
    const { searchQuery } = req.query;
    const accessToken = getAccessTokenFromHeader(req);

    // Validate access token
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Access token is missing'
      });
    }

    // First validate the token scopes
    const tokenValidation = await validateTokenScopes(accessToken);
    
    if (!tokenValidation.isValid) {
      // If token is invalid, try to refresh it
      const refreshToken = req.headers['x-zoho-refresh-token'];
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token scope. Please provide a refresh token to get a new access token.',
          details: {
            message: 'Refresh token is required',
            code: 'REFRESH_TOKEN_REQUIRED'
          }
        });
      }

      try {
        const newTokenData = await refreshZohoToken(refreshToken);
        // Update the access token for this request
        accessToken = newTokenData.access_token;
      } catch (refreshError) {
        return res.status(401).json({
          success: false,
          error: 'Failed to refresh token',
          details: {
            message: refreshError.message,
            code: 'TOKEN_REFRESH_FAILED'
          }
        });
      }
    }

    // Construct Zoho API URL
    const baseURL = 'https://www.zohoapis.com/crm/v2';
    const headers = {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json'
    };

    // Get the Products module
    const moduleResponse = await axios.get(`${baseURL}/settings/modules`, {
      headers
    });

    const productsModule = moduleResponse.data.modules.find(
      module => module.module_name === 'Products'
    );

    if (!productsModule) {
      return res.status(404).json({
        success: false,
        error: 'Products module not found in Zoho CRM'
      });
    }

    // Make API call to get products
    const response = await axios.get(`${baseURL}/${productsModule.api_name}`, {
      headers,
      params: {
        fields: 'id,Product_Name,Product_Code,Description,Category,Unit_Price,Tax,Status,Manufacturer,Product_Category,Vendor_Name'
      }
    });

    let products = response.data.data || [];

    // If searchQuery is provided, filter the products
    if (searchQuery) {
      const searchTerm = searchQuery.toLowerCase();
      products = products.filter(product => {
        return (
          (product.Product_Name && product.Product_Name.toLowerCase().includes(searchTerm)) ||
          (product.Product_Code && product.Product_Code.toLowerCase().includes(searchTerm)) ||
          (product.Description && product.Description.toLowerCase().includes(searchTerm)) ||
          (product.Category && product.Category.toLowerCase().includes(searchTerm)) ||
          (product.Manufacturer && product.Manufacturer.toLowerCase().includes(searchTerm)) ||
          (product.Vendor_Name && product.Vendor_Name.toLowerCase().includes(searchTerm))
        );
      });
    }

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No products found',
        details: searchQuery ? 'Try searching with different criteria' : 'No products exist'
      });
    }

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });

  } catch (error) {
    console.error('Zoho Products Search Error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        details: {
          message: error.response?.data?.message,
          code: error.response?.data?.code
        }
      });
    }

    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || 'Product search failed',
      details: error.response?.data
    });
  }
};

// Add this function before createProduct
const getAvailableModules = async (accessToken) => {
  try {
    const response = await axios.get(
      'https://www.zohoapis.com/crm/v2/settings/modules',
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.modules;
  } catch (error) {
    console.error('Error fetching modules:', error.response?.data || error.message);
    throw error;
  }
};

// Get available fields for a module
export const getModuleFields = async (req, res) => {
  try {
    const accessToken = getAccessTokenFromHeader(req);
    const { module } = req.params;
    
    if (!module) {
      return res.status(400).json(createZohoError('MODULE',
        'Module parameter is required',
        {
          endpoint: '/api/zoho/fields/:module',
          example: '/api/zoho/fields/Leads'
        }
      ));
    }

    console.log(`Fetching fields for module: ${module}`);

    const response = await axios.get(
      `https://www.zohoapis.com/crm/v2/settings/fields?module=${module}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const fields = response.data.fields || [];
    
    // Categorize fields
    const categorizedFields = {
      searchable: fields.filter(f => f.searchable).map(f => ({
        api_name: f.api_name,
        field_label: f.field_label,
        data_type: f.data_type,
        required: f.system_mandatory || f.required,
        length: f.length,
        lookup: f.lookup || null
      })),
      required: fields.filter(f => f.system_mandatory || f.required).map(f => ({
        api_name: f.api_name,
        field_label: f.field_label,
        data_type: f.data_type,
        system_mandatory: f.system_mandatory,
        required: f.required
      })),
      all: fields.map(f => ({
        api_name: f.api_name,
        field_label: f.field_label,
        data_type: f.data_type,
        searchable: f.searchable,
        required: f.system_mandatory || f.required,
        length: f.length,
        lookup: f.lookup || null
      }))
    };

    return res.json({
      status: 200,
      success: true,
      module,
      fields: categorizedFields,
      metadata: {
        total_fields: fields.length,
        searchable_fields: categorizedFields.searchable.length,
        required_fields: categorizedFields.required.length
      }
    });

  } catch (error) {
    console.error('Error fetching module fields:', error.message);
    
    if (error.response?.status === 400) {
      return res.status(400).json(createZohoError('MODULE',
        'Invalid module specified',
        {
          module,
          error: error.response.data,
          available_endpoints: {
            list_modules: 'GET /api/zoho/modules',
            module_fields: 'GET /api/zoho/fields/{module}'
          }
        }
      ));
    }
    
    return handleZohoApiError(error, res, 'get_module_fields');
  }
};