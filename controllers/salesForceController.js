import axios from 'axios';
import {
  createRecord, 
  getAllRecords,
  getRecordById, 
  updateRecord, 
  deleteRecord,
  makeSalesforceRequest,
  formatResponse,
  checkObjectAccessibility
} from "../utils/salesForceUtils.js"


const SALESFORCE_LOGIN_URL = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
const SALESFORCE_CLIENT_ID = process.env.SF_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SF_CLIENT_SECRET;
const SALESFORCE_USERNAME = process.env.SF_USERNAME;
const SALESFORCE_PASSWORD = process.env.SF_PASSWORD;

// Step 1: Get Access Token
export const getAccessToken = async () => {
  try {
    const response = await axios.post(
      `${SALESFORCE_LOGIN_URL}/services/oauth2/token`,
      null,
      {
        params: {
          grant_type: 'password',
          client_id: SALESFORCE_CLIENT_ID,
          client_secret: SALESFORCE_CLIENT_SECRET,
          username: SALESFORCE_USERNAME,
          password: SALESFORCE_PASSWORD,
        },
      }
    );

    const { access_token, instance_url } = response.data;
    return { access_token, instance_url };
  } catch (error) {
    console.error('Error getting access token:', error.response?.data || error.message);
    throw error;
  }
};


export const searchSalesforce = async (req, res) => {
  const { module, searchQuery, page = 1, pageSize = 10, fields, sortBy = 'CreatedDate', sortOrder = 'DESC' } = req.query;

  // Ensure pageSize is a valid number
  const parsedPageSize = parseInt(pageSize) || 10;
  const parsedPage = parseInt(page) || 1;

  console.log('Search Request Parameters:', { 
    module,
    searchQuery, 
    page: parsedPage, 
    pageSize: parsedPageSize,
    fields,
    sortBy,
    sortOrder
  });

  if (!module) {
    return res.status(400).json(formatResponse('Module parameter is required', 400, false));
  }

  // Validate if the module is supported
  const supportedModules = [
    'Account', 'Contact', 'Lead', 'Event', 'Task',
    'Opportunity', 'Note', 'Product2', 'Pricebook2',
    'OpportunityLineItem', 'Quote', 'Campaign',
    'CampaignMember', 'Order', 'Case'
  ];

  if (!supportedModules.includes(module)) {
    return res.status(400).json(formatResponse(
      `Invalid module. Supported modules are: ${supportedModules.join(', ')}`,
      400,
      false
    ));
  }

  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Get object description to know all available fields
    const describeEndpoint = `/services/data/v59.0/sobjects/${module}/describe`;
    const describeResult = await makeSalesforceRequest('GET', describeEndpoint, accessToken, instanceUrl);

    if (!describeResult.success) {
      return res.status(describeResult.status || 500).json(formatResponse(
        `Failed to get ${module} description: ${describeResult.data}`,
        describeResult.status,
        false
      ));
    }

    // Get all searchable fields from the object description
    const searchableFields = describeResult.data.fields
      .filter(field => field.type !== 'address' && field.type !== 'location') // Exclude complex types
      .map(field => field.name);

    // If specific fields are requested, validate them
    let selectedFields = fields ? fields.split(',') : searchableFields;
    selectedFields = selectedFields.filter(field => searchableFields.includes(field));

    if (selectedFields.length === 0) {
      selectedFields = ['Id', 'Name']; // Fallback to basic fields
    }

    // Always include Id field
    if (!selectedFields.includes('Id')) {
      selectedFields.unshift('Id');
    }

    // Construct the SOQL query
    let soqlQuery = `SELECT ${selectedFields.join(', ')} FROM ${module}`;

    // Add search conditions if searchQuery is provided
    if (searchQuery) {
      const searchConditions = searchableFields
        .map(field => `${field} LIKE '%${searchQuery}%'`)
        .join(' OR ');
      soqlQuery += ` WHERE ${searchConditions}`;
    }

    // Add sorting
    const validSortField = searchableFields.includes(sortBy) ? sortBy : 'CreatedDate';
    const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    soqlQuery += ` ORDER BY ${validSortField} ${validSortOrder}`;

    // Add pagination
    const offset = (parsedPage - 1) * parsedPageSize;
    soqlQuery += ` LIMIT ${parsedPageSize} OFFSET ${offset}`;

    console.log('SOQL Query:', soqlQuery);

    // Execute the query
    const endpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(soqlQuery)}`;
    const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);

    if (!result.success) {
      return res.status(result.status || 500).json(formatResponse(
        `Failed to execute search: ${result.data}`,
        result.status,
        false
      ));
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT() FROM ${module}${searchQuery ? ` WHERE ${searchConditions}` : ''}`;
    const countEndpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(countQuery)}`;
    const countResult = await makeSalesforceRequest('GET', countEndpoint, accessToken, instanceUrl);

    const totalRecords = countResult.success ? countResult.data.totalSize : 0;
    const totalPages = Math.ceil(totalRecords / parsedPageSize);

    // Format the response
    const response = {
      data: result.data.records,
      metadata: {
        module,
        searchQuery: searchQuery || null,
        fields: selectedFields,
        availableFields: searchableFields
      },
      pagination: {
        currentPage: parsedPage,
        pageSize: parsedPageSize,
        totalRecords,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPreviousPage: parsedPage > 1
      }
    };

    res.status(200).json(formatResponse(response));
  } catch (error) {
    console.error('Error in searchSalesforce:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status
    });
    res.status(500).json(formatResponse('Failed to search Salesforce', 500, false));
  }
};

export const searchByIdentifier = async (req, res) => {
  try {
    console.log('Searching by identifier with params:', req.query);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    const { objectType, identifier, searchField } = req.query;

    if (!objectType || !identifier) {
      return res.status(400).json(formatResponse({
        message: 'Missing required parameters',
        details: 'objectType and identifier are required',
        requiredParams: {
          objectType: 'The Salesforce object type (e.g., Account, Contact, etc.)',
          identifier: 'The search term to find the record',
          searchField: 'Optional field to search in (defaults to Name for most objects)'
        }
      }, 400, false));
    }

    // Define searchable fields for each object type
    const searchableFields = {
      'Account': ['Name', 'AccountNumber'],
      'Contact': ['FirstName', 'LastName', 'Email'],
      'Lead': ['FirstName', 'LastName', 'Company', 'Email'],
      'Opportunity': ['Name'],
      'Product2': ['Name', 'ProductCode'],
      'Pricebook2': ['Name'],
      'Case': ['CaseNumber', 'Subject'],
      'Note': ['Title'],
      'Task': ['Subject'],
      'Event': ['Subject'],
      'Campaign': ['Name'],
      'Order': ['OrderNumber'],
      'Quote': ['Name'],
      'Asset': ['Name', 'SerialNumber']
    };

    // Determine which field to search in
    let fieldToSearch = searchField;
    if (!fieldToSearch) {
      // Use default search field based on object type
      fieldToSearch = searchableFields[objectType]?.[0] || 'Name';
    }

    // Validate if the search field is valid for the object type
    if (!searchableFields[objectType]?.includes(fieldToSearch)) {
      return res.status(400).json(formatResponse({
        message: 'Invalid search field',
        details: `Field '${fieldToSearch}' is not searchable for ${objectType}`,
        validFields: searchableFields[objectType]
      }, 400, false));
    }

    // Construct SOQL query
    const soqlQuery = `SELECT Id, ${fieldToSearch} FROM ${objectType} WHERE ${fieldToSearch} LIKE '%${identifier}%' LIMIT 10`;
    console.log('SOQL Query:', soqlQuery);

    const endpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(soqlQuery)}`;
    const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);

    if (!result.success) {
      console.error('Search failed:', result.data);
      return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
    }

    if (!result.data.records || result.data.records.length === 0) {
      return res.status(404).json(formatResponse({
        message: 'No records found',
        details: `No ${objectType} records found matching '${identifier}' in field '${fieldToSearch}'`
      }, 404, false));
    }

    // Format the response
    const formattedResults = result.data.records.map(record => ({
      id: record.Id,
      [fieldToSearch]: record[fieldToSearch]
    }));

    console.log(`Found ${formattedResults.length} matching records`);
    res.status(200).json(formatResponse({
      objectType,
      searchField,
      totalResults: formattedResults.length,
      results: formattedResults
    }));
  } catch (error) {
    console.error('Error in searchByIdentifier:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse('Failed to search records', 500, false));
  }
};

////create-sales force user

export const createSalesforceUser = async (accessToken, instanceUrl, userData) => {
  try {
    const response = await axios.post(
      `${instanceUrl}/services/data/v57.0/sobjects/User`,
      userData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('User created:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating user:', error.response?.data || error.message);
    throw error;
  }
};



export const loginWithSalesforce = async (req, res) => {
  const { username, password, consumerKey, consumerSecret } = req.body;

  try {
    const response = await axios.post('https://login.salesforce.com/services/oauth2/token', null, {
      params: {
        grant_type: 'password',
        client_id: consumerKey,
        client_secret: consumerSecret,
        username,
        password,
      },
    });

    const { access_token, instance_url } = response.data;
    res.status(200).json({
      crmType: 'salesforce',
      accessToken: access_token,
      instanceUrl: instance_url,
    });
  } catch (error) {
    res.status(500).json(formatResponse(null, 'Login failed', 500));
  }
};


/////====Tasks=====///
export const getTasks = async (req, res) => await getAllRecords('Task', req, res);
export const getTaskById = async (req, res) => await getRecordById('Task', req, res);
export const createTask = async (req, res) => await createRecord('Task', req, res);
export const updateTask = async (req, res) => await updateRecord('Task', req, res);
export const deleteTask = async (req, res) => await deleteRecord('Task', req, res);

/////=====Events====///
export const getEvents = async (req, res) => await getAllRecords('Event', req, res);
export const getEventById = async (req, res) => await getRecordById('Event', req, res);
export const createEvent = async (req, res) => await createRecord('Event', req, res);
export const updateEvent = async (req, res) => await updateRecord('Event', req, res);
export const deleteEvent = async (req, res) => await deleteRecord('Event', req, res);

////=====Leads======////
export const getLeads = async (req, res) => await getAllRecords('Lead', req, res);
export const getLeadById = async (req, res) => await getRecordById('Lead', req, res);
export const createLead = async (req, res) => {
  try {
    console.log('Starting createLead request with body:', req.body);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Missing authentication:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Validate required fields
    const requiredFields = ['LastName', 'Company', 'Email'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json(formatResponse(
        `Missing required fields: ${missingFields.join(', ')}`,
        400,
        false
      ));
    }

    // Prepare lead data with default values
    const leadData = {
      LastName: req.body.LastName,
      Company: req.body.Company,
      Email: req.body.Email,
      FirstName: req.body.FirstName || '',
      Phone: req.body.Phone || '',
      Status: req.body.Status || 'New',
      LeadSource: req.body.LeadSource || 'Web',
      Industry: req.body.Industry || '',
      Description: req.body.Description || ''
    };

    console.log('Creating lead with data:', leadData);
    const createEndpoint = `/services/data/v59.0/sobjects/Lead`;
    console.log('Making Salesforce request to:', createEndpoint);
    
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, leadData);

    if (!createResult.success) {
      console.error('Failed to create lead:', createResult);
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    console.log('Successfully created lead:', { id: createResult.data.id });

    // Fetch the created lead
    const fetchEndpoint = `/services/data/v59.0/sobjects/Lead/${createResult.data.id}`;
    console.log('Fetching created lead from:', fetchEndpoint);
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      console.error('Failed to fetch created lead:', fetchResult);
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    console.log('Successfully fetched created lead');
    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createLead:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse('Failed to create lead', 500, false));
  }
};

export const updateLead = async (req, res) => await updateRecord('Lead', req, res);
export const deleteLead = async (req, res) => await deleteRecord('Lead', req, res);

///====Contacts====///
export const getContacts = async (req, res) => await getAllRecords('Contact', req, res);
export const getContactById = async (req, res) => await getRecordById('Contact', req, res);
export const createContact = async (req, res) => await createRecord('Contact', req, res);
export const updateContact = async (req, res) => await updateRecord('Contact', req, res);
export const deleteContact = async (req, res) => await deleteRecord('Contact', req, res);

/////====Accounts=====///
export const getAccounts = async (req, res) => await getAllRecords('Account', req, res);
export const getAccountById = async (req, res) => await getRecordById('Account', req, res);
export const createAccount = async (req, res) => await createRecord('Account', req, res);
export const updateAccount = async (req, res) => await updateRecord('Account', req, res);
export const deleteAccount = async (req, res) => await deleteRecord('Account', req, res);

/////====Opportunities=====///
export const getOpportunities = async (req, res) => await getAllRecords('Opportunity', req, res);
export const getOpportunityById = async (req, res) => await getRecordById('Opportunity', req, res);
export const createOpportunity = async (req, res) => await createRecord('Opportunity', req, res);
export const updateOpportunity = async (req, res) => await updateRecord('Opportunity', req, res);
export const deleteOpportunity = async (req, res) => await deleteRecord('Opportunity', req, res);

/////====Notes=====///
export const getNotes = async (req, res) => await getAllRecords('Note', req, res);
export const getNoteById = async (req, res) => await getRecordById('Note', req, res);
export const createNote = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    const { Title, Body, ParentId } = req.body;

    if (!Title || !Body || !ParentId) {
      return res.status(400).json(formatResponse('Title, Body, and ParentId are required', 400, false));
    }

    // Create the Note record
    const noteData = {
      Title: Title,
      Body: Body,
      ParentId: ParentId
    };

    const noteEndpoint = `/services/data/v59.0/sobjects/Note`;
    const noteResult = await makeSalesforceRequest('POST', noteEndpoint, accessToken, instanceUrl, noteData);

    if (!noteResult.success) {
      return res.status(noteResult.status || 500).json(formatResponse(noteResult.data, noteResult.status, false));
    }

    // Fetch the created note
    const fetchEndpoint = `/services/data/v59.0/sobjects/Note/${noteResult.data.id}`;
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createNote:', error.message);
    res.status(500).json(formatResponse('Failed to create note', 500, false));
  }
};

export const updateNote = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    const { id } = req.params;
    const { Title, Body } = req.body;

    // Prepare the update data
    const updateData = {};
    if (Title) updateData.Title = Title;
    if (Body) updateData.Body = Body;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json(formatResponse('No valid fields provided for update', 400, false));
    }

    const endpoint = `/services/data/v59.0/sobjects/Note/${id}`;
    const updateResult = await makeSalesforceRequest('PATCH', endpoint, accessToken, instanceUrl, updateData);

    if (!updateResult.success) {
      return res.status(updateResult.status || 500).json(formatResponse(updateResult.data, updateResult.status, false));
    }

    // Fetch the updated note
    const fetchEndpoint = `/services/data/v59.0/sobjects/Note/${id}`;
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    res.status(200).json(formatResponse(fetchResult.data, 200));
  } catch (error) {
    console.error('Error in updateNote:', error.message);
    res.status(500).json(formatResponse('Failed to update note', 500, false));
  }
};

export const deleteNote = async (req, res) => await deleteRecord('Note', req, res);

/////====Products=====///
export const getProducts = async (req, res) => await getAllRecords('Product2', req, res);
export const getProductById = async (req, res) => await getRecordById('Product2', req, res);
export const createProduct = async (req, res) => {
  try {
    console.log('Starting createProduct request with body:', req.body);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Missing authentication:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Validate required fields
    const requiredFields = ['Name'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json(formatResponse(
        `Missing required fields: ${missingFields.join(', ')}`,
        400,
        false
      ));
    }

    // Prepare product data with default values
    const productData = {
      Name: req.body.Name,
      ProductCode: req.body.ProductCode || '',
      Description: req.body.Description || '',
      Family: req.body.Family || 'Other',
      IsActive: req.body.IsActive !== undefined ? req.body.IsActive : true,
      DisplayUrl: req.body.DisplayUrl || '',
      QuantityUnitOfMeasure: req.body.QuantityUnitOfMeasure || 'Each',
      StockKeepingUnit: req.body.StockKeepingUnit || ''
    };

    console.log('Creating product with data:', productData);
    const createEndpoint = `/services/data/v59.0/sobjects/Product2`;
    console.log('Making Salesforce request to:', createEndpoint);
    
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, productData);

    if (!createResult.success) {
      console.error('Failed to create product:', createResult);
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    console.log('Successfully created product:', { id: createResult.data.id });

    // Fetch the created product
    const fetchEndpoint = `/services/data/v59.0/sobjects/Product2/${createResult.data.id}`;
    console.log('Fetching created product from:', fetchEndpoint);
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      console.error('Failed to fetch created product:', fetchResult);
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    // If pricebook entry is provided, create it
    if (req.body.PricebookId && req.body.UnitPrice) {
      try {
        const pricebookEntryData = {
          Pricebook2Id: req.body.PricebookId,
          Product2Id: createResult.data.id,
          UnitPrice: req.body.UnitPrice,
          IsActive: true
        };

        console.log('Creating pricebook entry with data:', pricebookEntryData);
        const pricebookEntryEndpoint = `/services/data/v59.0/sobjects/PricebookEntry`;
        const pricebookEntryResult = await makeSalesforceRequest('POST', pricebookEntryEndpoint, accessToken, instanceUrl, pricebookEntryData);

        if (pricebookEntryResult.success) {
          console.log('Successfully created pricebook entry:', { id: pricebookEntryResult.data.id });
          fetchResult.data.PricebookEntry = pricebookEntryResult.data;
        } else {
          console.error('Failed to create pricebook entry:', pricebookError);
        }
      } catch (pricebookError) {
        console.error('Error creating pricebook entry:', pricebookError);
        // Continue with the response even if pricebook entry creation fails
      }
    }

    console.log('Successfully fetched created product');
    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createProduct:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse('Failed to create product', 500, false));
  }
};

export const updateProduct = async (req, res) => await updateRecord('Product2', req, res);
export const deleteProduct = async (req, res) => await deleteRecord('Product2', req, res);

/////====Price Books=====///
export const getPriceBooks = async (req, res) => await getAllRecords('Pricebook2', req, res);
export const getPriceBookById = async (req, res) => await getRecordById('Pricebook2', req, res);
export const createPriceBook = async (req, res) => await createRecord('Pricebook2', req, res);
export const updatePriceBook = async (req, res) => await updateRecord('Pricebook2', req, res);
export const deletePriceBook = async (req, res) => await deleteRecord('Pricebook2', req, res);

/////====Opportunity Products=====///
export const getOpportunityProducts = async (req, res) => await getAllRecords('OpportunityLineItem', req, res);
export const getOpportunityProductById = async (req, res) => await getRecordById('OpportunityLineItem', req, res);
export const createOpportunityProduct = async (req, res) => await createRecord('OpportunityLineItem', req, res);
export const updateOpportunityProduct = async (req, res) => await updateRecord('OpportunityLineItem', req, res);
export const deleteOpportunityProduct = async (req, res) => await deleteRecord('OpportunityLineItem', req, res);

/////====Quotes=====///
export const getQuotes = async (req, res) => await getAllRecords('Quote', req, res);
export const getQuoteById = async (req, res) => await getRecordById('Quote', req, res);
export const createQuote = async (req, res) => {
  try {
    console.log('Starting createQuote request with body:', req.body);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // First, check if Quote object is accessible
    console.log('Checking Quote object accessibility...');
    const accessibilityCheck = await checkObjectAccessibility(accessToken, instanceUrl, 'Quote');
    console.log('Quote accessibility check result:', accessibilityCheck);

    if (!accessibilityCheck.exists) {
      console.error('Quote object does not exist or is not accessible');
      return res.status(400).json(formatResponse({
        message: 'Quote object is not available in your Salesforce org',
        details: 'Please ensure you have a Salesforce subscription that includes Quotes functionality',
        resolution: [
          'Upgrade to Salesforce Professional, Enterprise, or Unlimited Edition',
          'Enable Quotes in your Salesforce org',
          'Contact your Salesforce administrator for assistance'
        ]
      }, 400, false));
    }

    // Validate required fields
    const requiredFields = ['Name', 'OpportunityId'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json(formatResponse({
        message: 'Missing required fields',
        details: `Required fields missing: ${missingFields.join(', ')}`,
        requiredFields: {
          Name: 'Quote name (string)',
          OpportunityId: 'Associated Opportunity ID (string)',
          Status: 'Quote status (Draft, In Review, Approved, Sent, Accepted, Denied) - optional, defaults to Draft'
        }
      }, 400, false));
    }

    // Validate Status value if provided
    const validStatuses = ['Draft', 'In Review', 'Approved', 'Sent', 'Accepted', 'Denied'];
    const status = req.body.Status || 'Draft';
    if (!validStatuses.includes(status)) {
      console.error('Invalid Status value:', status);
      return res.status(400).json(formatResponse({
        message: 'Invalid Status value',
        details: `Status must be one of: ${validStatuses.join(', ')}`,
        providedValue: status
      }, 400, false));
    }

    // Check if Opportunity exists and is accessible
    const opportunityEndpoint = `/services/data/v59.0/sobjects/Opportunity/${req.body.OpportunityId}`;
    const opportunityResult = await makeSalesforceRequest('GET', opportunityEndpoint, accessToken, instanceUrl);
    
    if (!opportunityResult.success) {
      console.error('Failed to verify Opportunity:', opportunityResult);
      return res.status(400).json(formatResponse({
        message: 'Invalid Opportunity ID',
        details: 'The specified Opportunity does not exist or is not accessible',
        providedValue: req.body.OpportunityId
      }, 400, false));
    }

    // Prepare quote data with only core fields that are guaranteed to exist
    const quoteData = {
      Name: req.body.Name,
      OpportunityId: req.body.OpportunityId,
      Status: status
    };

    // Add optional fields only if provided
    if (req.body.ExpirationDate) {
      quoteData.ExpirationDate = req.body.ExpirationDate;
    }
    
    if (req.body.Description) {
      quoteData.Description = req.body.Description;
    }

    // Add billing address fields if provided
    if (req.body.BillingStreet) quoteData.BillingStreet = req.body.BillingStreet;
    if (req.body.BillingCity) quoteData.BillingCity = req.body.BillingCity;
    if (req.body.BillingState) quoteData.BillingState = req.body.BillingState;
    if (req.body.BillingPostalCode) quoteData.BillingPostalCode = req.body.BillingPostalCode;
    if (req.body.BillingCountry) quoteData.BillingCountry = req.body.BillingCountry;

    // Add shipping address fields if provided
    if (req.body.ShippingStreet) quoteData.ShippingStreet = req.body.ShippingStreet;
    if (req.body.ShippingCity) quoteData.ShippingCity = req.body.ShippingCity;
    if (req.body.ShippingState) quoteData.ShippingState = req.body.ShippingState;
    if (req.body.ShippingPostalCode) quoteData.ShippingPostalCode = req.body.ShippingPostalCode;
    if (req.body.ShippingCountry) quoteData.ShippingCountry = req.body.ShippingCountry;

    // Add other optional fields if provided
    if (req.body.Pricebook2Id) quoteData.Pricebook2Id = req.body.Pricebook2Id;
    if (req.body.ShippingHandling !== undefined) quoteData.ShippingHandling = req.body.ShippingHandling;
    if (req.body.Tax !== undefined) quoteData.Tax = req.body.Tax;
    if (req.body.Discount !== undefined) quoteData.Discount = req.body.Discount;

    console.log('Creating quote with data:', quoteData);
    const createEndpoint = `/services/data/v59.0/sobjects/Quote`;
    console.log('Making Salesforce request to:', createEndpoint);
    
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, quoteData);

    if (!createResult.success) {
      console.error('Failed to create quote:', createResult);
      
      // Handle specific Salesforce error codes
      if (createResult.data && Array.isArray(createResult.data)) {
        const error = createResult.data[0];
        if (error.errorCode === 'CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY') {
          return res.status(400).json(formatResponse({
            message: 'Quote creation failed',
            details: 'You do not have permission to create Quotes or Quotes functionality is not enabled in your org',
            errorCode: error.errorCode,
            resolution: [
              'Enable Quotes in your Salesforce org',
              'Grant Quote creation permissions to your user profile',
              'Contact your Salesforce administrator for assistance'
            ]
          }, 400, false));
        }
        
        if (error.errorCode === 'INVALID_FIELD') {
          return res.status(400).json(formatResponse({
            message: 'Invalid field in quote data',
            details: error.message,
            errorCode: error.errorCode,
            resolution: [
              'Check that all fields exist in your Quote object',
              'Remove any custom fields that may not be available',
              'Contact your Salesforce administrator to verify field availability'
            ]
          }, 400, false));
        }
      }
      
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    console.log('Successfully created quote:', { id: createResult.data.id });

    // Fetch the created quote
    const fetchEndpoint = `/services/data/v59.0/sobjects/Quote/${createResult.data.id}`;
    console.log('Fetching created quote from:', fetchEndpoint);
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      console.error('Failed to fetch created quote:', fetchResult);
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    console.log('Successfully fetched created quote');
    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createQuote:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse({
      message: 'Failed to create quote',
      details: error.message,
      errorCode: error.response?.data?.errorCode || 'UNKNOWN_ERROR'
    }, 500, false));
  }
};

export const updateQuote = async (req, res) => await updateRecord('Quote', req, res);
export const deleteQuote = async (req, res) => await deleteRecord('Quote', req, res);

/////====Campaigns=====///
export const getCampaigns = async (req, res) => await getAllRecords('Campaign', req, res);
export const getCampaignById = async (req, res) => await getRecordById('Campaign', req, res);
export const createCampaign = async (req, res) => {
  try {
    console.log('Starting createCampaign request with body:', req.body);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // First, check if Campaign object is accessible
    console.log('Checking Campaign object accessibility...');
    const accessibilityCheck = await checkObjectAccessibility(accessToken, instanceUrl, 'Campaign');
    console.log('Campaign accessibility check result:', accessibilityCheck);

    if (!accessibilityCheck.exists) {
      console.error('Campaign object does not exist or is not accessible');
      return res.status(400).json(formatResponse({
        message: 'Campaign object is not available in your Salesforce org',
        details: 'Please ensure Campaigns are enabled in your Salesforce org and you have the necessary permissions'
      }, 400, false));
    }

    if (!accessibilityCheck.createable) {
      console.error('User does not have permission to create Campaigns');
      return res.status(403).json(formatResponse({
        message: 'You do not have permission to create Campaigns',
        details: 'Please contact your Salesforce administrator to grant Campaign creation permissions'
      }, 403, false));
    }

    // Validate required fields
    const requiredFields = ['Name', 'Status', 'Type'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json(formatResponse({
        message: 'Missing required fields',
        details: `Required fields missing: ${missingFields.join(', ')}`,
        requiredFields: {
          Name: 'Campaign name (string)',
          Status: 'Campaign status (Planned, In Progress, Completed, Aborted)',
          Type: 'Campaign type (Email, Social, Webinar, etc.)'
        }
      }, 400, false));
    }

    // Validate field values
    const validStatuses = ['Planned', 'In Progress', 'Completed', 'Aborted'];
    if (!validStatuses.includes(req.body.Status)) {
      console.error('Invalid Status value:', req.body.Status);
      return res.status(400).json(formatResponse({
        message: 'Invalid Status value',
        details: `Status must be one of: ${validStatuses.join(', ')}`,
        providedValue: req.body.Status
      }, 400, false));
    }

    // Prepare campaign data with default values and validation
    const campaignData = {
      Name: req.body.Name,
      Status: req.body.Status,
      Type: req.body.Type,
      StartDate: req.body.StartDate || new Date().toISOString().split('T')[0],
      EndDate: req.body.EndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      Description: req.body.Description || '',
      BudgetedCost: req.body.BudgetedCost || 0,
      ActualCost: req.body.ActualCost || 0,
      IsActive: req.body.IsActive !== undefined ? req.body.IsActive : true,
      ExpectedRevenue: req.body.ExpectedRevenue || 0,
      NumberSent: req.body.NumberSent || 0
    };

    console.log('Creating campaign with data:', campaignData);
    const createEndpoint = `/services/data/v59.0/sobjects/Campaign`;
    console.log('Making Salesforce request to:', createEndpoint);
    
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, campaignData);

    if (!createResult.success) {
      console.error('Failed to create campaign:', createResult);
      
      // Handle specific Salesforce error codes
      if (createResult.data && Array.isArray(createResult.data)) {
        const error = createResult.data[0];
        if (error.errorCode === 'CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY') {
          return res.status(400).json(formatResponse({
            message: 'Campaign creation failed',
            details: 'You do not have permission to create Campaigns or Campaigns are not enabled in your org',
            errorCode: error.errorCode,
            resolution: [
              'Enable Campaigns in your Salesforce org',
              'Grant Campaign creation permissions to your user profile',
              'Contact your Salesforce administrator for assistance'
            ]
          }, 400, false));
        }
      }
      
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    console.log('Successfully created campaign:', { id: createResult.data.id });

    // Fetch the created campaign
    const fetchEndpoint = `/services/data/v59.0/sobjects/Campaign/${createResult.data.id}`;
    console.log('Fetching created campaign from:', fetchEndpoint);
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      console.error('Failed to fetch created campaign:', fetchResult);
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    console.log('Successfully fetched created campaign');
    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createCampaign:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse({
      message: 'Failed to create campaign',
      details: error.message,
      errorCode: error.response?.data?.errorCode || 'UNKNOWN_ERROR'
    }, 500, false));
  }
};

export const updateCampaign = async (req, res) => await updateRecord('Campaign', req, res);
export const deleteCampaign = async (req, res) => await deleteRecord('Campaign', req, res);

/////====Campaign Members=====///
export const getCampaignMembers = async (req, res) => await getAllRecords('CampaignMember', req, res);
export const getCampaignMemberById = async (req, res) => await getRecordById('CampaignMember', req, res);
export const createCampaignMember = async (req, res) => await createRecord('CampaignMember', req, res);
export const updateCampaignMember = async (req, res) => await updateRecord('CampaignMember', req, res);
export const deleteCampaignMember = async (req, res) => await deleteRecord('CampaignMember', req, res);

/////====Orders=====///
export const getOrders = async (req, res) => await getAllRecords('Order', req, res);
export const getOrderById = async (req, res) => await getRecordById('Order', req, res);
export const createOrder = async (req, res) => {
  try {
    console.log('Starting createOrder request with body:', req.body);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // If AccountId is not provided but accountName is, search for the account
    if (!req.body.AccountId && req.body.accountName) {
      console.log('Searching for account by name:', req.body.accountName);
      const searchEndpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(
        `SELECT Id, Name FROM Account WHERE Name LIKE '%${req.body.accountName}%' LIMIT 1`
      )}`;
      
      const searchResult = await makeSalesforceRequest('GET', searchEndpoint, accessToken, instanceUrl);
      
      if (!searchResult.success || !searchResult.data.records.length) {
        return res.status(400).json(formatResponse({
          message: 'Account not found',
          details: `No account found with name containing '${req.body.accountName}'`,
          resolution: [
            'Search for the correct account name using /search/identifier endpoint',
            'Create the account first if it doesn\'t exist',
            'Provide the correct AccountId directly'
          ]
        }, 400, false));
      }

      // Use the found account ID
      req.body.AccountId = searchResult.data.records[0].Id;
      console.log('Found account ID:', req.body.AccountId);
    }

    // Validate required fields
    const requiredFields = ['AccountId', 'EffectiveDate'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json(formatResponse({
        message: 'Missing required fields',
        details: `Required fields missing: ${missingFields.join(', ')}`,
        requiredFields: {
          AccountId: 'Account ID (string) or accountName (string)',
          EffectiveDate: 'Order effective date (YYYY-MM-DD)'
        }
      }, 400, false));
    }

    // Prepare order data with default values
    const orderData = {
      AccountId: req.body.AccountId,
      EffectiveDate: req.body.EffectiveDate,
      Status: req.body.Status || 'Draft',
      Description: req.body.Description || '',
      BillingStreet: req.body.BillingStreet || '',
      BillingCity: req.body.BillingCity || '',
      BillingState: req.body.BillingState || '',
      BillingPostalCode: req.body.BillingPostalCode || '',
      BillingCountry: req.body.BillingCountry || '',
      ShippingStreet: req.body.ShippingStreet || '',
      ShippingCity: req.body.ShippingCity || '',
      ShippingState: req.body.ShippingState || '',
      ShippingPostalCode: req.body.ShippingPostalCode || '',
      ShippingCountry: req.body.ShippingCountry || '',
      Pricebook2Id: req.body.Pricebook2Id || null
    };

    console.log('Creating order with data:', orderData);
    const createEndpoint = `/services/data/v59.0/sobjects/Order`;
    console.log('Making Salesforce request to:', createEndpoint);
    
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, orderData);

    if (!createResult.success) {
      console.error('Failed to create order:', createResult);
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    console.log('Successfully created order:', { id: createResult.data.id });

    // Fetch the created order
    const fetchEndpoint = `/services/data/v59.0/sobjects/Order/${createResult.data.id}`;
    console.log('Fetching created order from:', fetchEndpoint);
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      console.error('Failed to fetch created order:', fetchResult);
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    console.log('Successfully fetched created order');
    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createOrder:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse('Failed to create order', 500, false));
  }
};
export const updateOrder = async (req, res) => await updateRecord('Order', req, res);
export const deleteOrder = async (req, res) => await deleteRecord('Order', req, res);

/////====Cases=====///
export const getCases = async (req, res) => await getAllRecords('Case', req, res);
export const getCaseById = async (req, res) => await getRecordById('Case', req, res);
export const createCase = async (req, res) => await createRecord('Case', req, res);
export const updateCase = async (req, res) => await updateRecord('Case', req, res);
export const deleteCase = async (req, res) => await deleteRecord('Case', req, res);

// Custom Object Controllers
export const getCustomObjects = async (req, res) => await getAllRecords('CustomObject__c', req, res);
export const getCustomObjectById = async (req, res) => await getRecordById('CustomObject__c', req, res);
export const createCustomObject = async (req, res) => await createRecord('CustomObject__c', req, res);
export const updateCustomObject = async (req, res) => await updateRecord('CustomObject__c', req, res);
export const deleteCustomObject = async (req, res) => await deleteRecord('CustomObject__c', req, res);

// Dummy data for Postman testing
export const dummyData = {
  // ... existing code ...

  // Campaign Dummy Data
  campaign: {
    "Name": "Q2 2024 Enterprise Campaign", // Required
    "Status": "Planned", // Required (Values: Planned, In Progress, Completed, Aborted)
    "Type": "Email", // Required (Values: Email, Social, Webinar, etc.)
    "StartDate": "2024-04-01", // Required (YYYY-MM-DD)
    "EndDate": "2024-06-30", // Required (YYYY-MM-DD)
    "Description": "Q2 enterprise marketing campaign", // Optional
    "BudgetedCost": 50000.00, // Optional
    "ActualCost": 0.00, // Optional
    "IsActive": true, // Required
    "CampaignMemberRecordTypeId": "012a3000004EQkRAAW", // Optional (if using record types)
    "ParentId": null, // Optional (if this is a child campaign)
    "ExpectedRevenue": 100000.00, // Optional
    "NumberSent": 0, // Optional
    "NumberOfLeads": 0, // Optional
    "NumberOfContacts": 0, // Optional
    "NumberOfResponses": 0, // Optional
    "NumberOfOpportunities": 0, // Optional
    "NumberOfWonOpportunities": 0, // Optional
    "AmountWonOpportunities": 0.00, // Optional
    "NumberOfConvertedLeads": 0, // Optional
    "NumberOfConvertedContacts": 0, // Optional
    "NumberOfConvertedOpportunities": 0, // Optional
    "NumberOfConvertedWonOpportunities": 0, // Optional
    "AmountConvertedWonOpportunities": 0.00, // Optional
    "NumberOfConvertedLeadsToOpportunities": 0, // Optional
    "NumberOfConvertedContactsToOpportunities": 0, // Optional
    "NumberOfConvertedLeadsToWonOpportunities": 0, // Optional
    "NumberOfConvertedContactsToWonOpportunities": 0, // Optional
    "AmountConvertedLeadsToWonOpportunities": 0.00, // Optional
    "AmountConvertedContactsToWonOpportunities": 0.00 // Optional
  }
};

// Service Territory Controllers
export const getServiceTerritories = async (req, res) => {
  try {
    console.log('Fetching Service Territories...');
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Define fields to select for ServiceTerritory
    const fields = 'Id, Name, OperatingHoursId, Description, IsActive, Address, City, State, Country, PostalCode, Latitude, Longitude';
    const query = `SELECT ${fields} FROM ServiceTerritory WHERE IsActive = true`;
    console.log('SOQL Query:', query);

    const endpoint = `/services/data/v59.0/query?q=${encodeURIComponent(query)}`;
    console.log('Making request to:', endpoint);

    const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);
    console.log('API Response:', JSON.stringify(result, null, 2));

    if (!result.success) {
      console.error('Failed to fetch service territories:', result.data);
      return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
    }

    if (!result.data.records || result.data.records.length === 0) {
      console.log('No service territories found');
      return res.status(404).json(formatResponse('No service territories found', 404, false));
    }

    console.log(`Successfully fetched ${result.data.records.length} service territories`);
    res.status(200).json(formatResponse(result.data.records));
  } catch (error) {
    console.error('Error in getServiceTerritories:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse('Failed to fetch service territories', 500, false));
  }
};

export const getServiceTerritoryById = async (req, res) => {
  try {
    console.log('Fetching Service Territory by ID:', req.params.id);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    const endpoint = `/services/data/v59.0/sobjects/ServiceTerritory/${req.params.id}`;
    console.log('Making request to:', endpoint);

    const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);
    console.log('API Response:', JSON.stringify(result, null, 2));

    if (!result.success) {
      console.error('Failed to fetch service territory:', result.data);
      return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
    }

    console.log('Successfully fetched service territory');
    res.status(200).json(formatResponse(result.data));
  } catch (error) {
    console.error('Error in getServiceTerritoryById:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse('Failed to fetch service territory', 500, false));
  }
};

export const createServiceTerritory = async (req, res) => {
  try {
    console.log('Creating Service Territory with data:', req.body);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Validate required fields
    const requiredFields = ['Name', 'OperatingHoursId'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json(formatResponse(
        `Missing required fields: ${missingFields.join(', ')}`,
        400,
        false
      ));
    }

    // Prepare territory data with default values
    const territoryData = {
      Name: req.body.Name,
      OperatingHoursId: req.body.OperatingHoursId,
      Description: req.body.Description || '',
      IsActive: req.body.IsActive !== undefined ? req.body.IsActive : true,
      Address: req.body.Address || '',
      City: req.body.City || '',
      State: req.body.State || '',
      Country: req.body.Country || '',
      PostalCode: req.body.PostalCode || '',
      Latitude: req.body.Latitude || null,
      Longitude: req.body.Longitude || null
    };

    console.log('Creating territory with data:', territoryData);
    const createEndpoint = `/services/data/v59.0/sobjects/ServiceTerritory`;
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, territoryData);

    if (!createResult.success) {
      console.error('Failed to create service territory:', createResult.data);
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    // Fetch the created territory
    const fetchEndpoint = `/services/data/v59.0/sobjects/ServiceTerritory/${createResult.data.id}`;
    console.log('Fetching created territory from:', fetchEndpoint);
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      console.error('Failed to fetch created territory:', fetchResult.data);
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    console.log('Successfully created and fetched service territory');
    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createServiceTerritory:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse('Failed to create service territory', 500, false));
  }
};

export const updateServiceTerritory = async (req, res) => {
  try {
    console.log('Updating Service Territory:', req.params.id);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    if (Object.keys(req.body).length === 0) {
      console.error('No update data provided');
      return res.status(400).json(formatResponse('No update data provided', 400, false));
    }

    const updateEndpoint = `/services/data/v59.0/sobjects/ServiceTerritory/${req.params.id}`;
    console.log('Making update request to:', updateEndpoint);
    console.log('Update data:', req.body);

    const updateResult = await makeSalesforceRequest('PATCH', updateEndpoint, accessToken, instanceUrl, req.body);

    if (!updateResult.success) {
      console.error('Failed to update service territory:', updateResult.data);
      return res.status(updateResult.status || 500).json(formatResponse(updateResult.data, updateResult.status, false));
    }

    // Fetch the updated territory
    const fetchEndpoint = `/services/data/v59.0/sobjects/ServiceTerritory/${req.params.id}`;
    console.log('Fetching updated territory from:', fetchEndpoint);
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      console.error('Failed to fetch updated territory:', fetchResult.data);
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    console.log('Successfully updated and fetched service territory');
    res.status(200).json(formatResponse(fetchResult.data, 200));
  } catch (error) {
    console.error('Error in updateServiceTerritory:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse('Failed to update service territory', 500, false));
  }
};

export const deleteServiceTerritory = async (req, res) => {
  try {
    console.log('Deleting Service Territory:', req.params.id);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    const endpoint = `/services/data/v59.0/sobjects/ServiceTerritory/${req.params.id}`;
    console.log('Making delete request to:', endpoint);

    const result = await makeSalesforceRequest('DELETE', endpoint, accessToken, instanceUrl);

    if (!result.success) {
      console.error('Failed to delete service territory:', result.data);
      return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
    }

    console.log('Successfully deleted service territory');
    res.status(200).json(formatResponse('Service territory deleted successfully'));
  } catch (error) {
    console.error('Error in deleteServiceTerritory:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse('Failed to delete service territory', 500, false));
  }
};

// Invoice Controllers
export const getInvoices = async (req, res) => await getAllRecords('Invoice__c', req, res);
export const getInvoiceById = async (req, res) => await getRecordById('Invoice__c', req, res);
export const createInvoice = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Validate required fields
    const requiredFields = ['AccountId', 'InvoiceDate', 'DueDate'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json(formatResponse(
        `Missing required fields: ${missingFields.join(', ')}`,
        400,
        false
      ));
    }

    const invoiceData = {
      AccountId: req.body.AccountId,
      InvoiceDate: req.body.InvoiceDate,
      DueDate: req.body.DueDate,
      Status: req.body.Status || 'Draft',
      TotalAmount: req.body.TotalAmount || 0,
      Description: req.body.Description || '',
      ReferenceNumber: req.body.ReferenceNumber || ''
    };

    const createEndpoint = `/services/data/v59.0/sobjects/Invoice__c`;
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, invoiceData);

    if (!createResult.success) {
      console.error('Failed to create invoice:', createResult);
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    // Fetch the created invoice
    const fetchEndpoint = `/services/data/v59.0/sobjects/Invoice__c/${createResult.data.id}`;
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createInvoice:', error);
    res.status(500).json(formatResponse('Failed to create invoice', 500, false));
  }
};
export const updateInvoice = async (req, res) => await updateRecord('Invoice__c', req, res);
export const deleteInvoice = async (req, res) => await deleteRecord('Invoice__c', req, res);

// Pipeline/Forecast Item Controllers
export const getForecastItems = async (req, res) => await getAllRecords('ForecastItem', req, res);
export const getForecastItemById = async (req, res) => await getRecordById('ForecastItem', req, res);
export const createForecastItem = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Validate required fields
    const requiredFields = ['ForecastCategoryName', 'ForecastItemDate', 'OpportunityId'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json(formatResponse(
        `Missing required fields: ${missingFields.join(', ')}`,
        400,
        false
      ));
    }

    const forecastData = {
      ForecastCategoryName: req.body.ForecastCategoryName,
      ForecastItemDate: req.body.ForecastItemDate,
      OpportunityId: req.body.OpportunityId,
      Amount: req.body.Amount || 0,
      ProductFamily: req.body.ProductFamily || '',
      ProductId: req.body.ProductId || null
    };

    const createEndpoint = `/services/data/v59.0/sobjects/ForecastItem`;
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, forecastData);

    if (!createResult.success) {
      console.error('Failed to create forecast item:', createResult);
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    // Fetch the created forecast item
    const fetchEndpoint = `/services/data/v59.0/sobjects/ForecastItem/${createResult.data.id}`;
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createForecastItem:', error);
    res.status(500).json(formatResponse('Failed to create forecast item', 500, false));
  }
};
export const updateForecastItem = async (req, res) => await updateRecord('ForecastItem', req, res);
export const deleteForecastItem = async (req, res) => await deleteRecord('ForecastItem', req, res);

// Competitor Controllers
export const getCompetitors = async (req, res) => await getAllRecords('Competitor__c', req, res);
export const getCompetitorById = async (req, res) => await getRecordById('Competitor__c', req, res);
export const createCompetitor = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Validate required fields
    const requiredFields = ['Name', 'OpportunityId'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json(formatResponse(
        `Missing required fields: ${missingFields.join(', ')}`,
        400,
        false
      ));
    }

    const competitorData = {
      Name: req.body.Name,
      OpportunityId: req.body.OpportunityId,
      Strengths: req.body.Strengths || '',
      Weaknesses: req.body.Weaknesses || '',
      Description: req.body.Description || ''
    };

    const createEndpoint = `/services/data/v59.0/sobjects/Competitor__c`;
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, competitorData);

    if (!createResult.success) {
      console.error('Failed to create competitor:', createResult);
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    // Fetch the created competitor
    const fetchEndpoint = `/services/data/v59.0/sobjects/Competitor__c/${createResult.data.id}`;
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createCompetitor:', error);
    res.status(500).json(formatResponse('Failed to create competitor', 500, false));
  }
};
export const updateCompetitor = async (req, res) => await updateRecord('Competitor__c', req, res);
export const deleteCompetitor = async (req, res) => await deleteRecord('Competitor__c', req, res);

// Service Appointment Controllers
export const getServiceAppointments = async (req, res) => await getAllRecords('ServiceAppointment', req, res);
export const getServiceAppointmentById = async (req, res) => await getRecordById('ServiceAppointment', req, res);
export const createServiceAppointment = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Validate required fields
    const requiredFields = ['ParentRecordId', 'EarliestStartTime', 'DueDate'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json(formatResponse(
        `Missing required fields: ${missingFields.join(', ')}`,
        400,
        false
      ));
    }

    const appointmentData = {
      ParentRecordId: req.body.ParentRecordId,
      EarliestStartTime: req.body.EarliestStartTime,
      DueDate: req.body.DueDate,
      Status: req.body.Status || 'None',
      Description: req.body.Description || '',
      ServiceTerritoryId: req.body.ServiceTerritoryId || null,
      ServiceResourceId: req.body.ServiceResourceId || null
    };

    const createEndpoint = `/services/data/v59.0/sobjects/ServiceAppointment`;
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, appointmentData);

    if (!createResult.success) {
      console.error('Failed to create service appointment:', createResult);
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    // Fetch the created service appointment
    const fetchEndpoint = `/services/data/v59.0/sobjects/ServiceAppointment/${createResult.data.id}`;
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createServiceAppointment:', error);
    res.status(500).json(formatResponse('Failed to create service appointment', 500, false));
  }
};
export const updateServiceAppointment = async (req, res) => await updateRecord('ServiceAppointment', req, res);
export const deleteServiceAppointment = async (req, res) => await deleteRecord('ServiceAppointment', req, res);

// Customer Asset Controllers
export const getCustomerAssets = async (req, res) => await getAllRecords('Asset', req, res);
export const getCustomerAssetById = async (req, res) => await getRecordById('Asset', req, res);
export const createCustomerAsset = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Validate required fields
    const requiredFields = ['Name', 'AccountId', 'Product2Id'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json(formatResponse(
        `Missing required fields: ${missingFields.join(', ')}`,
        400,
        false
      ));
    }

    const assetData = {
      Name: req.body.Name,
      AccountId: req.body.AccountId,
      Product2Id: req.body.Product2Id,
      Status: req.body.Status || 'Purchased',
      PurchaseDate: req.body.PurchaseDate || new Date().toISOString().split('T')[0],
      Description: req.body.Description || '',
      SerialNumber: req.body.SerialNumber || '',
      InstallDate: req.body.InstallDate || null
    };

    const createEndpoint = `/services/data/v59.0/sobjects/Asset`;
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, assetData);

    if (!createResult.success) {
      console.error('Failed to create customer asset:', createResult);
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    // Fetch the created asset
    const fetchEndpoint = `/services/data/v59.0/sobjects/Asset/${createResult.data.id}`;
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createCustomerAsset:', error);
    res.status(500).json(formatResponse('Failed to create customer asset', 500, false));
  }
};
export const updateCustomerAsset = async (req, res) => await updateRecord('Asset', req, res);
export const deleteCustomerAsset = async (req, res) => await deleteRecord('Asset', req, res);

// Knowledge Article Controllers
export const getKnowledgeArticles = async (req, res) => await getAllRecords('KnowledgeArticleVersion', req, res);
export const getKnowledgeArticleById = async (req, res) => await getRecordById('KnowledgeArticleVersion', req, res);
export const createKnowledgeArticle = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Validate required fields
    const requiredFields = ['Title', 'UrlName', 'Language'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json(formatResponse(
        `Missing required fields: ${missingFields.join(', ')}`,
        400,
        false
      ));
    }

    const articleData = {
      Title: req.body.Title,
      UrlName: req.body.UrlName,
      Language: req.body.Language,
      PublishStatus: req.body.PublishStatus || 'Draft',
      Summary: req.body.Summary || '',
      Body: req.body.Body || '',
      IsVisibleInPkb: req.body.IsVisibleInPkb || false,
      IsVisibleInCsp: req.body.IsVisibleInCsp || false
    };

    const createEndpoint = `/services/data/v59.0/sobjects/KnowledgeArticleVersion`;
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, articleData);

    if (!createResult.success) {
      console.error('Failed to create knowledge article:', createResult);
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    // Fetch the created article
    const fetchEndpoint = `/services/data/v59.0/sobjects/KnowledgeArticleVersion/${createResult.data.id}`;
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createKnowledgeArticle:', error);
    res.status(500).json(formatResponse('Failed to create knowledge article', 500, false));
  }
};
export const updateKnowledgeArticle = async (req, res) => await updateRecord('KnowledgeArticleVersion', req, res);
export const deleteKnowledgeArticle = async (req, res) => await deleteRecord('KnowledgeArticleVersion', req, res);

export const checkObjectsAccessibility = async (req, res) => {
  try {
    console.log('Checking objects accessibility...');
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // List of objects to check
    const objectsToCheck = [
      'ServiceTerritory',
      'ForecastItem',
      'ServiceAppointment',
      'Asset',
      'KnowledgeArticleVersion'
    ];

    const results = {};
    for (const objectName of objectsToCheck) {
      console.log(`Checking accessibility for ${objectName}...`);
      const accessibility = await checkObjectAccessibility(accessToken, instanceUrl, objectName);
      results[objectName] = accessibility;
    }

    console.log('Accessibility check completed');
    res.status(200).json(formatResponse(results));
  } catch (error) {
    console.error('Error in checkObjectsAccessibility:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse('Failed to check objects accessibility', 500, false));
  }
};

export const createOperatingHours = async (req, res) => {
  try {
    console.log('Starting createOperatingHours request with body:', req.body);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // First, check if OperatingHours object is accessible
    console.log('Checking OperatingHours object accessibility...');
    const accessibilityCheck = await checkObjectAccessibility(accessToken, instanceUrl, 'OperatingHours');
    console.log('OperatingHours accessibility check result:', accessibilityCheck);

    if (!accessibilityCheck.exists) {
      console.error('OperatingHours object does not exist or is not accessible');
      return res.status(400).json(formatResponse({
        message: 'OperatingHours object is not available in your Salesforce org',
        details: 'Please ensure you have a Salesforce Field Service subscription',
        resolution: [
          'Upgrade to Salesforce Field Service',
          'Enable Field Service in your Salesforce org',
          'Contact your Salesforce administrator for assistance'
        ]
      }, 400, false));
    }

    // Validate required fields
    const requiredFields = ['Name', 'TimeZone'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json(formatResponse({
        message: 'Missing required fields',
        details: `Required fields missing: ${missingFields.join(', ')}`,
        requiredFields: {
          Name: 'Operating hours name (string)',
          TimeZone: 'Timezone (e.g., America/New_York)'
        }
      }, 400, false));
    }

    // Prepare operating hours data
    const operatingHoursData = {
      Name: req.body.Name,
      TimeZone: req.body.TimeZone,
      Description: req.body.Description || '',
      IsActive: req.body.IsActive !== undefined ? req.body.IsActive : true
    };

    console.log('Creating operating hours with data:', operatingHoursData);
    const createEndpoint = `/services/data/v59.0/sobjects/OperatingHours`;
    console.log('Making Salesforce request to:', createEndpoint);
    
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, operatingHoursData);

    if (!createResult.success) {
      console.error('Failed to create operating hours:', createResult);
      
      // Handle specific Salesforce error codes
      if (createResult.data && Array.isArray(createResult.data)) {
        const error = createResult.data[0];
        if (error.errorCode === 'CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY') {
          return res.status(400).json(formatResponse({
            message: 'Operating hours creation failed',
            details: 'You do not have permission to create Operating Hours or Field Service is not enabled in your org',
            errorCode: error.errorCode,
            resolution: [
              'Enable Field Service in your Salesforce org',
              'Grant Operating Hours creation permissions to your user profile',
              'Contact your Salesforce administrator for assistance'
            ]
          }, 400, false));
        }
      }
      
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    console.log('Successfully created operating hours:', { id: createResult.data.id });

    // Fetch the created operating hours
    const fetchEndpoint = `/services/data/v59.0/sobjects/OperatingHours/${createResult.data.id}`;
    console.log('Fetching created operating hours from:', fetchEndpoint);
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      console.error('Failed to fetch created operating hours:', fetchResult);
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    console.log('Successfully fetched created operating hours');
    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createOperatingHours:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse({
      message: 'Failed to create operating hours',
      details: error.message,
      errorCode: error.response?.data?.errorCode || 'UNKNOWN_ERROR'
    }, 500, false));
  }
};

/////====Goals=====///
export const getGoals = async (req, res) => {
  try {
    console.log('Fetching Goals...');
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // First, check if Goal object is accessible
    console.log('Checking Goal object accessibility...');
    const accessibilityCheck = await checkObjectAccessibility(accessToken, instanceUrl, 'Goal');
    console.log('Goal accessibility check result:', accessibilityCheck);

    if (!accessibilityCheck.exists) {
      console.error('Goal object does not exist or is not accessible');
      return res.status(400).json(formatResponse({
        message: 'Goal object is not available in your Salesforce org',
        details: 'Please ensure you have a Salesforce subscription that includes Goals functionality',
        resolution: [
          'Upgrade to Salesforce Professional, Enterprise, or Unlimited Edition',
          'Enable Goals in your Salesforce org',
          'Contact your Salesforce administrator for assistance'
        ]
      }, 400, false));
    }

    const { page = 1, limit = 10, ...filters } = req.query;
    const fields = 'Id, Name, StartDate, EndDate, Status, Type, TargetValue, CurrentValue, Progress, OwnerId, Description';
    let soqlQuery = `SELECT ${fields} FROM Goal`;

    if (Object.keys(filters).length > 0) {
      const filterConditions = Object.entries(filters)
        .map(([key, value]) => `${key} = '${value}'`)
        .join(' AND ');
      soqlQuery += ` WHERE ${filterConditions}`;
    }

    const offset = (page - 1) * limit;
    soqlQuery += ` ORDER BY CreatedDate DESC LIMIT ${limit} OFFSET ${offset}`;

    const endpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(soqlQuery)}`;
    const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);

    if (!result.success) {
      console.error('Failed to fetch goals:', result.data);
      return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
    }

    console.log(`Successfully fetched ${result.data.records.length} goals`);
    res.status(200).json(formatResponse({
      totalResults: result.data.totalSize,
      page: parseInt(page),
      limit: parseInt(limit),
      data: result.data.records
    }));
  } catch (error) {
    console.error('Error in getGoals:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse('Failed to fetch goals', 500, false));
  }
};

export const getGoalById = async (req, res) => {
  try {
    console.log('Fetching Goal by ID:', req.params.id);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    const endpoint = `/services/data/v59.0/sobjects/Goal/${req.params.id}`;
    const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);

    if (!result.success) {
      console.error('Failed to fetch goal:', result.data);
      return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
    }

    console.log('Successfully fetched goal');
    res.status(200).json(formatResponse(result.data));
  } catch (error) {
    console.error('Error in getGoalById:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse('Failed to fetch goal', 500, false));
  }
};

export const createGoal = async (req, res) => {
  try {
    console.log('Starting createGoal request with body:', req.body);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // First, check if Goal object is accessible
    console.log('Checking Goal object accessibility...');
    const accessibilityCheck = await checkObjectAccessibility(accessToken, instanceUrl, 'Goal');
    console.log('Goal accessibility check result:', accessibilityCheck);

    if (!accessibilityCheck.exists) {
      console.error('Goal object does not exist or is not accessible');
      return res.status(400).json(formatResponse({
        message: 'Goal object is not available in your Salesforce org',
        details: 'Please ensure you have a Salesforce subscription that includes Goals functionality',
        resolution: [
          'Upgrade to Salesforce Professional, Enterprise, or Unlimited Edition',
          'Enable Goals in your Salesforce org',
          'Contact your Salesforce administrator for assistance'
        ]
      }, 400, false));
    }

    // Validate required fields
    const requiredFields = ['Name', 'StartDate', 'EndDate', 'Type', 'TargetValue'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json(formatResponse({
        message: 'Missing required fields',
        details: `Required fields missing: ${missingFields.join(', ')}`,
        requiredFields: {
          Name: 'Goal name (string)',
          StartDate: 'Start date (YYYY-MM-DD)',
          EndDate: 'End date (YYYY-MM-DD)',
          Type: 'Goal type (Number, Currency, etc.)',
          TargetValue: 'Target value (number)'
        }
      }, 400, false));
    }

    // Validate dates
    const startDate = new Date(req.body.StartDate);
    const endDate = new Date(req.body.EndDate);
    
    if (startDate >= endDate) {
      console.error('Invalid date range:', { startDate, endDate });
      return res.status(400).json(formatResponse({
        message: 'Invalid date range',
        details: 'End date must be after start date'
      }, 400, false));
    }

    // Prepare goal data with default values
    const goalData = {
      Name: req.body.Name,
      StartDate: req.body.StartDate,
      EndDate: req.body.EndDate,
      Type: req.body.Type,
      TargetValue: req.body.TargetValue,
      Status: req.body.Status || 'Not Started',
      CurrentValue: req.body.CurrentValue || 0,
      Progress: req.body.Progress || 0,
      OwnerId: req.body.OwnerId || null,
      Description: req.body.Description || ''
    };

    console.log('Creating goal with data:', goalData);
    const createEndpoint = `/services/data/v59.0/sobjects/Goal`;
    console.log('Making Salesforce request to:', createEndpoint);
    
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, goalData);

    if (!createResult.success) {
      console.error('Failed to create goal:', createResult);
      
      // Handle specific Salesforce error codes
      if (createResult.data && Array.isArray(createResult.data)) {
        const error = createResult.data[0];
        if (error.errorCode === 'CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY') {
          return res.status(400).json(formatResponse({
            message: 'Goal creation failed',
            details: 'You do not have permission to create Goals or Goals functionality is not enabled in your org',
            errorCode: error.errorCode,
            resolution: [
              'Enable Goals in your Salesforce org',
              'Grant Goal creation permissions to your user profile',
              'Contact your Salesforce administrator for assistance'
            ]
          }, 400, false));
        }
      }
      
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    console.log('Successfully created goal:', { id: createResult.data.id });

    // Fetch the created goal
    const fetchEndpoint = `/services/data/v59.0/sobjects/Goal/${createResult.data.id}`;
    console.log('Fetching created goal from:', fetchEndpoint);
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      console.error('Failed to fetch created goal:', fetchResult);
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    console.log('Successfully fetched created goal');
    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error('Error in createGoal:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse({
      message: 'Failed to create goal',
      details: error.message,
      errorCode: error.response?.data?.errorCode || 'UNKNOWN_ERROR'
    }, 500, false));
  }
};

export const updateGoal = async (req, res) => {
  try {
    console.log('Updating Goal:', req.params.id);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    if (Object.keys(req.body).length === 0) {
      console.error('No update data provided');
      return res.status(400).json(formatResponse('No update data provided', 400, false));
    }

    // Validate dates if both are provided
    if (req.body.StartDate && req.body.EndDate) {
      const startDate = new Date(req.body.StartDate);
      const endDate = new Date(req.body.EndDate);
      
      if (startDate >= endDate) {
        console.error('Invalid date range:', { startDate, endDate });
        return res.status(400).json(formatResponse({
          message: 'Invalid date range',
          details: 'End date must be after start date'
        }, 400, false));
      }
    }

    const updateEndpoint = `/services/data/v59.0/sobjects/Goal/${req.params.id}`;
    console.log('Making update request to:', updateEndpoint);
    console.log('Update data:', req.body);

    const updateResult = await makeSalesforceRequest('PATCH', updateEndpoint, accessToken, instanceUrl, req.body);

    if (!updateResult.success) {
      console.error('Failed to update goal:', updateResult.data);
      return res.status(updateResult.status || 500).json(formatResponse(updateResult.data, updateResult.status, false));
    }

    // Fetch the updated goal
    const fetchEndpoint = `/services/data/v59.0/sobjects/Goal/${req.params.id}`;
    console.log('Fetching updated goal from:', fetchEndpoint);
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      console.error('Failed to fetch updated goal:', fetchResult.data);
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    console.log('Successfully updated and fetched goal');
    res.status(200).json(formatResponse(fetchResult.data, 200));
  } catch (error) {
    console.error('Error in updateGoal:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse('Failed to update goal', 500, false));
  }
};

export const deleteGoal = async (req, res) => {
  try {
    console.log('Deleting Goal:', req.params.id);
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    const endpoint = `/services/data/v59.0/sobjects/Goal/${req.params.id}`;
    console.log('Making delete request to:', endpoint);

    const result = await makeSalesforceRequest('DELETE', endpoint, accessToken, instanceUrl);

    if (!result.success) {
      console.error('Failed to delete goal:', result.data);
      return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
    }

    console.log('Successfully deleted goal');
    res.status(200).json(formatResponse('Goal deleted successfully'));
  } catch (error) {
    console.error('Error in deleteGoal:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json(formatResponse('Failed to delete goal', 500, false));
  }
};

// Search functions for different object IDs
export const searchAccountId = async (req, res) => {
  try {
    const { searchQuery } = req.query;
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    let query = 'SELECT Id, Name, Phone, Website, Industry, Type, BillingCity, BillingCountry FROM Account';
    
    if (searchQuery) {
      query += ` WHERE Name LIKE '%${searchQuery}%' 
                OR Phone LIKE '%${searchQuery}%'
                OR Website LIKE '%${searchQuery}%'
                OR Industry LIKE '%${searchQuery}%'
                OR Type LIKE '%${searchQuery}%'
                OR BillingCity LIKE '%${searchQuery}%'
                OR BillingCountry LIKE '%${searchQuery}%'`;
    }
    
    query += ' LIMIT 10';

    const endpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(query)}`;
    const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);

    if (!result.success) {
      return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
    }

    if (!result.data.records.length) {
      return res.status(404).json(formatResponse({
        message: 'No accounts found',
        details: searchQuery ? 'Try searching with different criteria' : 'No accounts exist in the system'
      }, 404, false));
    }

    res.status(200).json(formatResponse({
      totalResults: result.data.records.length,
      results: result.data.records.map(record => ({
        id: record.Id,
        name: record.Name,
        phone: record.Phone,
        website: record.Website,
        industry: record.Industry,
        type: record.Type,
        billingCity: record.BillingCity,
        billingCountry: record.BillingCountry
      }))
    }));
  } catch (error) {
    console.error('Error in searchAccountId:', error);
    res.status(500).json(formatResponse('Failed to search accounts', 500, false));
  }
};

export const searchContactId = async (req, res) => {
  try {
    const { searchQuery } = req.query;
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    let query = 'SELECT Id, FirstName, LastName, Email, Phone, Title, Department, AccountId FROM Contact';
    
    if (searchQuery) {
      query += ` WHERE FirstName LIKE '%${searchQuery}%'
                OR LastName LIKE '%${searchQuery}%'
                OR Email LIKE '%${searchQuery}%'
                OR Phone LIKE '%${searchQuery}%'
                OR Title LIKE '%${searchQuery}%'
                OR Department LIKE '%${searchQuery}%'`;
    }
    
    query += ' LIMIT 10';

    const endpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(query)}`;
    const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);

    if (!result.success) {
      return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
    }

    if (!result.data.records.length) {
      return res.status(404).json(formatResponse({
        message: 'No contacts found',
        details: searchQuery ? 'Try searching with different criteria' : 'No contacts exist in the system'
      }, 404, false));
    }

    res.status(200).json(formatResponse({
      totalResults: result.data.records.length,
      results: result.data.records.map(record => ({
        id: record.Id,
        firstName: record.FirstName,
        lastName: record.LastName,
        email: record.Email,
        phone: record.Phone,
        title: record.Title,
        department: record.Department,
        accountId: record.AccountId
      }))
    }));
  } catch (error) {
    console.error('Error in searchContactId:', error);
    res.status(500).json(formatResponse('Failed to search contacts', 500, false));
  }
};

export const searchOpportunityId = async (req, res) => {
  try {
    const { searchQuery } = req.query;
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    let query = 'SELECT Id, Name, AccountId, StageName, CloseDate, Amount, Type, LeadSource FROM Opportunity';
    
    if (searchQuery) {
      query += ` WHERE Name LIKE '%${searchQuery}%'
                OR StageName LIKE '%${searchQuery}%'
                OR Type LIKE '%${searchQuery}%'
                OR LeadSource LIKE '%${searchQuery}%'`;
    }
    
    query += ' LIMIT 10';

    const endpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(query)}`;
    const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);

    if (!result.success) {
      return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
    }

    if (!result.data.records.length) {
      return res.status(404).json(formatResponse({
        message: 'No opportunities found',
        details: searchQuery ? 'Try searching with different criteria' : 'No opportunities exist in the system'
      }, 404, false));
    }

    res.status(200).json(formatResponse({
      totalResults: result.data.records.length,
      results: result.data.records.map(record => ({
        id: record.Id,
        name: record.Name,
        accountId: record.AccountId,
        stageName: record.StageName,
        closeDate: record.CloseDate,
        amount: record.Amount,
        type: record.Type,
        leadSource: record.LeadSource
      }))
    }));
  } catch (error) {
    console.error('Error in searchOpportunityId:', error);
    res.status(500).json(formatResponse('Failed to search opportunities', 500, false));
  }
};

export const searchProductId = async (req, res) => {
  try {
    const { searchQuery } = req.query;
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    let query = 'SELECT Id, Name, ProductCode, Family, IsActive, Description, DisplayUrl FROM Product2';
    
    if (searchQuery) {
      query += ` WHERE Name LIKE '%${searchQuery}%'
                OR ProductCode LIKE '%${searchQuery}%'
                OR Family LIKE '%${searchQuery}%'
                OR Description LIKE '%${searchQuery}%'`;
    }
    
    query += ' LIMIT 10';

    const endpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(query)}`;
    const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);

    if (!result.success) {
      return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
    }

    if (!result.data.records.length) {
      return res.status(404).json(formatResponse({
        message: 'No products found',
        details: searchQuery ? 'Try searching with different criteria' : 'No products exist in the system'
      }, 404, false));
    }

    res.status(200).json(formatResponse({
      totalResults: result.data.records.length,
      results: result.data.records.map(record => ({
        id: record.Id,
        name: record.Name,
        productCode: record.ProductCode,
        family: record.Family,
        isActive: record.IsActive,
        description: record.Description,
        displayUrl: record.DisplayUrl
      }))
    }));
  } catch (error) {
    console.error('Error in searchProductId:', error);
    res.status(500).json(formatResponse('Failed to search products', 500, false));
  }
};

// Alternative goal management using GoalAssignment object
export const getGoalsAlternative = async (req, res) => {
  try {
    console.log('Fetching Goals using Goal Assignment object...');
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      console.error('Authentication missing:', { accessToken: !!accessToken, instanceUrl: !!instanceUrl });
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // First, check if Goal object is accessible
    console.log('Checking Goal object accessibility...');
    const goalAccessibility = await checkObjectAccessibility(accessToken, instanceUrl, 'Goal');
    
    if (goalAccessibility.exists) {
      // Use standard Goal object
      return getGoals(req, res);
    }

    // Check for Goal Assignment object that exists in the org
    console.log('Checking Goal Assignment object accessibility...');
    const goalAssignmentAccessibility = await checkObjectAccessibility(accessToken, instanceUrl, 'GoalAssignment');
    
    if (goalAssignmentAccessibility.exists && goalAssignmentAccessibility.accessible) {
      console.log('Using GoalAssignment object for goal management');
      
      const { page = 1, limit = 10, ...filters } = req.query;
      
      // Use only basic fields that exist on GoalAssignment
      let soqlQuery = `SELECT Id, Name, OwnerId, CreatedDate, LastModifiedDate FROM GoalAssignment`;
      
      // Add user filters if provided
      if (Object.keys(filters).length > 0) {
        const userFilters = Object.entries(filters)
          .map(([key, value]) => `${key} = '${value}'`)
          .join(' AND ');
        soqlQuery += ` WHERE ${userFilters}`;
      }

      const offset = (page - 1) * limit;
      soqlQuery += ` ORDER BY CreatedDate DESC LIMIT ${limit} OFFSET ${offset}`;

      const endpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(soqlQuery)}`;
      const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);

      if (!result.success) {
        console.error('Failed to query GoalAssignment:', result);
        return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
      }

      // Map the results to goal-like structure
      const mappedData = result.data.records.map(record => ({
        Id: record.Id,
        Name: record.Name,
        OwnerId: record.OwnerId,
        Type: 'Goal Assignment',
        CreatedDate: record.CreatedDate,
        LastModifiedDate: record.LastModifiedDate,
        Status: 'Active', // Default status since field doesn't exist
        Progress: 0, // Default progress since field doesn't exist
        TargetValue: null, // Default target value since field doesn't exist
        CurrentValue: null // Default current value since field doesn't exist
      }));

      return res.status(200).json(formatResponse({
        totalResults: result.data.totalSize,
        page: parseInt(page),
        limit: parseInt(limit),
        data: mappedData,
        objectUsed: 'GoalAssignment',
        description: 'Goal assignments from Salesforce',
        note: 'Using GoalAssignment object for goal management (basic fields only)'
      }));
    }

    // Check for standard objects that can serve as goal alternatives if GoalAssignment is not available
    const standardAlternatives = [
      {
        object: 'Opportunity',
        description: 'Sales opportunities as goals',
        filter: "(Type = 'Goal' OR Type = 'Target' OR StageName LIKE '%Goal%' OR Name LIKE '%Goal%' OR Name LIKE '%Target%')",
        fields: 'Id, Name, Amount, CloseDate, StageName, Probability, Description, Type, OwnerId, CreatedDate',
        mapping: {
          'Id': 'Id',
          'Name': 'Name',
          'Amount': 'TargetValue',
          'CloseDate': 'EndDate',
          'StageName': 'Status',
          'Probability': 'Progress',
          'Description': 'Description',
          'Type': 'Type',
          'OwnerId': 'OwnerId'
        }
      },
      {
        object: 'Task',
        description: 'Tasks as goal milestones',
        filter: "(Type = 'Goal' OR Type = 'Target' OR Subject LIKE '%Goal%' OR Subject LIKE '%Target%' OR Subject LIKE '%Objective%')",
        fields: 'Id, Subject, Description, Status, Priority, ActivityDate, OwnerId, CreatedDate',
        mapping: {
          'Id': 'Id',
          'Subject': 'Name',
          'ActivityDate': 'EndDate',
          'Status': 'Status',
          'Description': 'Description',
          'Priority': 'Priority',
          'OwnerId': 'OwnerId'
        }
      },
      {
        object: 'Campaign',
        description: 'Marketing campaigns as goals',
        filter: "(Type = 'Goal' OR Type = 'Target' OR Name LIKE '%Goal%' OR Name LIKE '%Target%')",
        fields: 'Id, Name, Description, Status, StartDate, EndDate, ExpectedRevenue, ActualCost, OwnerId, CreatedDate',
        mapping: {
          'Id': 'Id',
          'Name': 'Name',
          'ExpectedRevenue': 'TargetValue',
          'ActualCost': 'CurrentValue',
          'StartDate': 'StartDate',
          'EndDate': 'EndDate',
          'Status': 'Status',
          'Description': 'Description',
          'OwnerId': 'OwnerId'
        }
      }
    ];

    // Try each alternative until we find one that works
    for (const alternative of standardAlternatives) {
      try {
        const accessibility = await checkObjectAccessibility(accessToken, instanceUrl, alternative.object);
        
        if (accessibility.exists && accessibility.accessible) {
          console.log(`Using ${alternative.object} as goal alternative`);
          
          const { page = 1, limit = 10, ...filters } = req.query;
          
          let soqlQuery = `SELECT ${alternative.fields} FROM ${alternative.object}`;
          
          // Add the filter for goal-like records
          soqlQuery += ` WHERE ${alternative.filter}`;
          
          // Add user filters if provided
          if (Object.keys(filters).length > 0) {
            const userFilters = Object.entries(filters)
              .map(([key, value]) => `${key} = '${value}'`)
              .join(' AND ');
            soqlQuery += ` AND (${userFilters})`;
          }

          const offset = (page - 1) * limit;
          soqlQuery += ` ORDER BY CreatedDate DESC LIMIT ${limit} OFFSET ${offset}`;

          const endpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(soqlQuery)}`;
          const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);

          if (!result.success) {
            console.log(`Failed to query ${alternative.object}, trying next alternative...`);
            continue;
          }

          // Map the results to goal-like structure
          const mappedData = result.data.records.map(record => {
            const mapped = {};
            Object.entries(alternative.mapping).forEach(([sourceField, targetField]) => {
              mapped[targetField] = record[sourceField];
            });
            
            // Add some goal-specific calculated fields
            if (alternative.object === 'Opportunity') {
              mapped.Progress = record.Probability || 0;
              mapped.Type = record.Type || 'Sales Goal';
            } else if (alternative.object === 'Task') {
              mapped.TargetValue = null;
              mapped.Progress = record.Status === 'Completed' ? 100 : 0;
              mapped.Type = 'Task Goal';
            } else if (alternative.object === 'Campaign') {
              mapped.Progress = record.ExpectedRevenue && record.ActualCost ? 
                Math.round((record.ActualCost / record.ExpectedRevenue) * 100) : 0;
              mapped.Type = 'Campaign Goal';
            }
            
            return mapped;
          });

          return res.status(200).json(formatResponse({
            totalResults: result.data.totalSize,
            page: parseInt(page),
            limit: parseInt(limit),
            data: mappedData,
            objectUsed: alternative.object,
            description: alternative.description,
            note: `Using ${alternative.object} as goal alternative since Goal object is not available`
          }));
        }
      } catch (error) {
        console.log(`Error checking ${alternative.object}:`, error.message);
        continue;
      }
    }

    // If no alternatives work, return empty result with guidance
    return res.status(200).json(formatResponse({
      totalResults: 0,
      page: 1,
      limit: parseInt(req.query.limit || 10),
      data: [],
      objectUsed: 'none',
      note: 'No suitable objects found for goal management',
      suggestions: [
        'Create Goal Assignments using GoalAssignment object (basic fields only)',
        'Create Opportunities with Type = "Goal"',
        'Create Tasks with Subject containing "Goal" or "Target"',
        'Create Campaigns with Type = "Goal"',
        'Upgrade Salesforce edition to access Goal object'
      ]
    }));

  } catch (error) {
    console.error('Error in getGoalsAlternative:', error);
    res.status(500).json(formatResponse('Failed to fetch goals using alternative methods', 500, false));
  }
};

export const getGoalAlternativeById = async (req, res) => {
  try {
    console.log('Fetching Goal by ID using alternative objects...');
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];
    const { id } = req.params;

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    if (!id) {
      return res.status(400).json(formatResponse('Goal ID is required', 400, false));
    }

    // First, check if Goal object is accessible
    const goalAccessibility = await checkObjectAccessibility(accessToken, instanceUrl, 'Goal');
    
    if (goalAccessibility.exists) {
      return getGoalById(req, res);
    }

    // Try GoalAssignment first
    const goalAssignmentAccessibility = await checkObjectAccessibility(accessToken, instanceUrl, 'GoalAssignment');
    
    if (goalAssignmentAccessibility.exists && goalAssignmentAccessibility.accessible) {
      const endpoint = `/services/data/v59.0/sobjects/GoalAssignment/${id}`;
      const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);

      if (result.success) {
        const mappedData = {
          Id: result.data.Id,
          Name: result.data.Name,
          OwnerId: result.data.OwnerId,
          Type: 'Goal Assignment',
          CreatedDate: result.data.CreatedDate,
          LastModifiedDate: result.data.LastModifiedDate,
          Status: 'Active', // Default since field doesn't exist
          Progress: 0, // Default since field doesn't exist
          TargetValue: null, // Default since field doesn't exist
          CurrentValue: null // Default since field doesn't exist
        };

        return res.status(200).json(formatResponse({
          data: mappedData,
          objectUsed: 'GoalAssignment',
          note: 'Retrieved from GoalAssignment object (basic fields only)'
        }));
      }
    }

    // Try other alternatives
    const alternatives = ['Opportunity', 'Task', 'Campaign'];
    
    for (const objectType of alternatives) {
      try {
        const accessibility = await checkObjectAccessibility(accessToken, instanceUrl, objectType);
        
        if (accessibility.exists && accessibility.accessible) {
          const endpoint = `/services/data/v59.0/sobjects/${objectType}/${id}`;
          const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);

          if (result.success) {
            let mappedData = {
              Id: result.data.Id,
              Type: `${objectType} Goal`
            };

            if (objectType === 'Opportunity') {
              mappedData = {
                ...mappedData,
                Name: result.data.Name,
                TargetValue: result.data.Amount,
                EndDate: result.data.CloseDate,
                Status: result.data.StageName,
                Progress: result.data.Probability || 0,
                Description: result.data.Description,
                OwnerId: result.data.OwnerId
              };
            } else if (objectType === 'Task') {
              mappedData = {
                ...mappedData,
                Name: result.data.Subject,
                EndDate: result.data.ActivityDate,
                Status: result.data.Status,
                Progress: result.data.Status === 'Completed' ? 100 : 0,
                Description: result.data.Description,
                Priority: result.data.Priority,
                OwnerId: result.data.OwnerId
              };
            } else if (objectType === 'Campaign') {
              mappedData = {
                ...mappedData,
                Name: result.data.Name,
                TargetValue: result.data.ExpectedRevenue,
                CurrentValue: result.data.ActualCost,
                StartDate: result.data.StartDate,
                EndDate: result.data.EndDate,
                Status: result.data.Status,
                Progress: result.data.ExpectedRevenue && result.data.ActualCost ? 
                  Math.round((result.data.ActualCost / result.data.ExpectedRevenue) * 100) : 0,
                Description: result.data.Description,
                OwnerId: result.data.OwnerId
              };
            }

            return res.status(200).json(formatResponse({
              data: mappedData,
              objectUsed: objectType,
              note: `Retrieved from ${objectType} object`
            }));
          }
        }
      } catch (error) {
        console.log(`Error checking ${objectType}:`, error.message);
        continue;
      }
    }

    return res.status(404).json(formatResponse('Goal not found in any available objects', 404, false));

  } catch (error) {
    console.error('Error in getGoalAlternativeById:', error);
    res.status(500).json(formatResponse('Failed to fetch goal by ID', 500, false));
  }
};

export const createGoalAlternative = async (req, res) => {
  try {
    console.log('Creating Goal using Goal Assignment object...');
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Check if standard Goal object is available
    const goalAccessibility = await checkObjectAccessibility(accessToken, instanceUrl, 'Goal');
    
    if (goalAccessibility.exists && goalAccessibility.createable) {
      return createGoal(req, res);
    }

    // Check if GoalAssignment object is available
    const goalAssignmentAccessibility = await checkObjectAccessibility(accessToken, instanceUrl, 'GoalAssignment');
    
    if (goalAssignmentAccessibility.exists && goalAssignmentAccessibility.createable) {
      console.log('Checking GoalAssignment field permissions...');
      
      // Try to get field metadata to check permissions
      try {
        const describeEndpoint = `/services/data/v59.0/sobjects/GoalAssignment/describe`;
        const describeResult = await makeSalesforceRequest('GET', describeEndpoint, accessToken, instanceUrl);
        
        if (describeResult.success) {
          const nameField = describeResult.data.fields.find(field => field.name === 'Name');
          
          if (!nameField || !nameField.createable || !nameField.updateable) {
            console.log('GoalAssignment Name field is not writable, skipping to alternatives...');
          } else {
            console.log('Creating goal using GoalAssignment object...');
            
            // Validate required fields for goal assignment creation
            const requiredFields = ['Name'];
            const missingFields = requiredFields.filter(field => !req.body[field]);
            
            if (missingFields.length > 0) {
              return res.status(400).json(formatResponse({
                message: 'Missing required fields for goal creation',
                details: `Required fields missing: ${missingFields.join(', ')}`,
                requiredFields: {
                  Name: 'Goal name (string) - REQUIRED'
                },
                note: 'GoalAssignment object only supports basic fields: Name, OwnerId'
              }, 400, false));
            }

            // Prepare goal assignment data with only the Name field (most basic)
            const goalAssignmentData = {
              Name: req.body.Name
            };

            console.log('GoalAssignment data to create:', goalAssignmentData);

            const createEndpoint = `/services/data/v59.0/sobjects/GoalAssignment`;
            const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, goalAssignmentData);

            if (createResult.success) {
              return res.status(201).json(formatResponse({
                id: createResult.data.id,
                objectUsed: 'GoalAssignment',
                note: 'Goal created as Goal Assignment (basic fields only)',
                goalData: {
                  Id: createResult.data.id,
                  Name: req.body.Name,
                  Type: 'Goal Assignment',
                  Status: 'Active', // Default
                  Progress: 0, // Default
                  TargetValue: null, // Not supported
                  CurrentValue: null // Not supported
                },
                originalData: goalAssignmentData,
                limitations: 'GoalAssignment object only supports Name field. Other fields like Status, Progress, TargetValue are not available.'
              }, 201));
            } else {
              console.log('Failed to create goal using GoalAssignment (permission issue):', createResult);
            }
          }
        }
      } catch (describeError) {
        console.log('Could not describe GoalAssignment object, skipping to alternatives...');
      }
    }

    // Validate required fields for goal creation
    const requiredFields = ['Name'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json(formatResponse({
        message: 'Missing required fields for goal creation',
        details: `Required fields missing: ${missingFields.join(', ')}`,
        requiredFields: {
          Name: 'Goal name (string)',
          TargetValue: 'Target value/amount (number) - optional',
          EndDate: 'Target end date (YYYY-MM-DD) - optional',
          Description: 'Goal description (string) - optional'
        }
      }, 400, false));
    }

    // Try standard object alternatives in order of preference
    const alternatives = [
      {
        object: 'Opportunity',
        data: {
          Name: `[GOAL] ${req.body.Name}`,
          Amount: req.body.TargetValue || 0,
          CloseDate: req.body.EndDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          StageName: req.body.Status || 'Prospecting',
          Type: 'Goal',
          Probability: req.body.Progress || 0,
          Description: req.body.Description ? `Goal: ${req.body.Description}` : 'Created as goal alternative'
        },
        note: 'Goal created as Opportunity (GoalAssignment permissions insufficient)'
      },
      {
        object: 'Task',
        data: {
          Subject: `[GOAL] ${req.body.Name}`,
          Description: req.body.Description ? `Goal: ${req.body.Description}` : 'Created as goal alternative',
          Status: req.body.Status || 'Not Started',
          Priority: req.body.Priority || 'Normal',
          ActivityDate: req.body.EndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          Type: 'Goal'
        },
        note: 'Goal created as Task (GoalAssignment permissions insufficient)'
      },
      {
        object: 'Campaign',
        data: {
          Name: `[GOAL] ${req.body.Name}`,
          Description: req.body.Description ? `Goal: ${req.body.Description}` : 'Created as goal alternative',
          Status: req.body.Status || 'Planned',
          Type: 'Goal',
          StartDate: new Date().toISOString().split('T')[0],
          EndDate: req.body.EndDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          ExpectedRevenue: req.body.TargetValue || 0,
          IsActive: true
        },
        note: 'Goal created as Campaign (GoalAssignment permissions insufficient)'
      }
    ];

    // Try each alternative until one works
    for (const alternative of alternatives) {
      try {
        const accessibility = await checkObjectAccessibility(accessToken, instanceUrl, alternative.object);
        
        if (accessibility.exists && accessibility.createable) {
          console.log(`Creating goal using ${alternative.object}...`);
          
          const createEndpoint = `/services/data/v59.0/sobjects/${alternative.object}`;
          const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, alternative.data);

          if (createResult.success) {
            return res.status(201).json(formatResponse({
              id: createResult.data.id,
              objectUsed: alternative.object,
              note: alternative.note,
              goalData: {
                Id: createResult.data.id,
                Name: req.body.Name,
                TargetValue: req.body.TargetValue,
                EndDate: req.body.EndDate,
                Status: req.body.Status,
                Description: req.body.Description,
                Type: 'Goal'
              },
              originalData: alternative.data,
              permissionNote: 'GoalAssignment object exists but Name field is not writable with current permissions'
            }, 201));
          } else {
            console.log(`Failed to create goal using ${alternative.object}, trying next...`);
            continue;
          }
        }
      } catch (error) {
        console.log(`Error creating goal with ${alternative.object}:`, error.message);
        continue;
      }
    }

    // If all alternatives fail
    return res.status(400).json(formatResponse({
      message: 'Unable to create goal using any available objects',
      details: 'GoalAssignment object exists but has insufficient permissions. Alternative objects (Opportunity, Task, Campaign) are also not available for goal creation',
      permissionIssue: 'GoalAssignment Name field is not writable with current user permissions',
      suggestions: [
        'Contact your Salesforce administrator to grant write permissions to GoalAssignment object',
        'Request access to create Opportunities, Tasks, or Campaigns',
        'Check field-level security settings for GoalAssignment.Name field',
        'Upgrade Salesforce edition to access Goal object'
      ]
    }, 400, false));

  } catch (error) {
    console.error('Error in createGoalAlternative:', error);
    res.status(500).json(formatResponse('Failed to create goal using alternative methods', 500, false));
  }
};

export const updateGoalAlternative = async (req, res) => {
  try {
    console.log('Updating Goal using alternative objects...');
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];
    const { id } = req.params;

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    if (!id) {
      return res.status(400).json(formatResponse('Goal ID is required', 400, false));
    }

    // First, check if Goal object is accessible
    const goalAccessibility = await checkObjectAccessibility(accessToken, instanceUrl, 'Goal');
    
    if (goalAccessibility.exists) {
      return updateGoal(req, res);
    }

    // Try GoalAssignment first
    const goalAssignmentAccessibility = await checkObjectAccessibility(accessToken, instanceUrl, 'GoalAssignment');
    
    if (goalAssignmentAccessibility.exists && goalAssignmentAccessibility.updateable) {
      // Prepare update data for GoalAssignment (only Name field is supported)
      const updateData = {};
      
      if (req.body.Name) {
        updateData.Name = req.body.Name;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json(formatResponse({
          message: 'No valid fields to update',
          note: 'GoalAssignment object only supports updating the Name field',
          supportedFields: ['Name']
        }, 400, false));
      }

      const updateEndpoint = `/services/data/v59.0/sobjects/GoalAssignment/${id}`;
      const updateResult = await makeSalesforceRequest('PATCH', updateEndpoint, accessToken, instanceUrl, updateData);

      if (updateResult.success) {
        // Fetch the updated record
        const fetchEndpoint = `/services/data/v59.0/sobjects/GoalAssignment/${id}`;
        const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

        if (fetchResult.success) {
          const mappedData = {
            Id: fetchResult.data.Id,
            Name: fetchResult.data.Name,
            OwnerId: fetchResult.data.OwnerId,
            Type: 'Goal Assignment',
            LastModifiedDate: fetchResult.data.LastModifiedDate,
            Status: 'Active', // Default since field doesn't exist
            Progress: 0, // Default since field doesn't exist
            TargetValue: null, // Default since field doesn't exist
            CurrentValue: null // Default since field doesn't exist
          };

          return res.status(200).json(formatResponse({
            data: mappedData,
            objectUsed: 'GoalAssignment',
            note: 'Goal updated in GoalAssignment object (Name field only)',
            limitations: 'GoalAssignment object only supports Name field updates'
          }));
        }

        return res.status(200).json(formatResponse({
          id: id,
          objectUsed: 'GoalAssignment',
          note: 'Goal updated successfully in GoalAssignment object (Name field only)'
        }));
      }
    }

    // Try other alternatives
    const alternatives = [
      {
        object: 'Opportunity',
        mapping: {
          Name: 'Name',
          TargetValue: 'Amount',
          EndDate: 'CloseDate',
          Status: 'StageName',
          Progress: 'Probability',
          Description: 'Description'
        }
      },
      {
        object: 'Task',
        mapping: {
          Name: 'Subject',
          EndDate: 'ActivityDate',
          Status: 'Status',
          Description: 'Description',
          Priority: 'Priority'
        }
      },
      {
        object: 'Campaign',
        mapping: {
          Name: 'Name',
          TargetValue: 'ExpectedRevenue',
          CurrentValue: 'ActualCost',
          EndDate: 'EndDate',
          Status: 'Status',
          Description: 'Description'
        }
      }
    ];

    for (const alternative of alternatives) {
      try {
        const accessibility = await checkObjectAccessibility(accessToken, instanceUrl, alternative.object);
        
        if (accessibility.exists && accessibility.updateable) {
          // Map the request body to the alternative object fields
          const updateData = {};
          Object.entries(req.body).forEach(([key, value]) => {
            if (alternative.mapping[key]) {
              updateData[alternative.mapping[key]] = value;
            }
          });

          if (Object.keys(updateData).length === 0) {
            continue;
          }

          const updateEndpoint = `/services/data/v59.0/sobjects/${alternative.object}/${id}`;
          const updateResult = await makeSalesforceRequest('PATCH', updateEndpoint, accessToken, instanceUrl, updateData);

          if (updateResult.success) {
            return res.status(200).json(formatResponse({
              id: id,
              objectUsed: alternative.object,
              note: `Goal updated successfully in ${alternative.object} object`,
              updatedFields: updateData
            }));
          }
        }
      } catch (error) {
        console.log(`Error updating ${alternative.object}:`, error.message);
        continue;
      }
    }

    return res.status(404).json(formatResponse('Goal not found or cannot be updated in any available objects', 404, false));

  } catch (error) {
    console.error('Error in updateGoalAlternative:', error);
    res.status(500).json(formatResponse('Failed to update goal', 500, false));
  }
};

export const deleteGoalAlternative = async (req, res) => {
  try {
    console.log('Deleting Goal using alternative objects...');
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];
    const { id } = req.params;

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    if (!id) {
      return res.status(400).json(formatResponse('Goal ID is required', 400, false));
    }

    // First, check if Goal object is accessible
    const goalAccessibility = await checkObjectAccessibility(accessToken, instanceUrl, 'Goal');
    
    if (goalAccessibility.exists) {
      return deleteGoal(req, res);
    }

    // Try GoalAssignment first
    const goalAssignmentAccessibility = await checkObjectAccessibility(accessToken, instanceUrl, 'GoalAssignment');
    
    if (goalAssignmentAccessibility.exists && goalAssignmentAccessibility.deleteable) {
      const deleteEndpoint = `/services/data/v59.0/sobjects/GoalAssignment/${id}`;
      const deleteResult = await makeSalesforceRequest('DELETE', deleteEndpoint, accessToken, instanceUrl);

      if (deleteResult.success) {
        return res.status(200).json(formatResponse({
          id: id,
          objectUsed: 'GoalAssignment',
          note: 'Goal deleted successfully from GoalAssignment object'
        }));
      }
    }

    // Try other alternatives
    const alternatives = ['Opportunity', 'Task', 'Campaign'];
    
    for (const objectType of alternatives) {
      try {
        const accessibility = await checkObjectAccessibility(accessToken, instanceUrl, objectType);
        
        if (accessibility.exists && accessibility.deleteable) {
          const deleteEndpoint = `/services/data/v59.0/sobjects/${objectType}/${id}`;
          const deleteResult = await makeSalesforceRequest('DELETE', deleteEndpoint, accessToken, instanceUrl);

          if (deleteResult.success) {
            return res.status(200).json(formatResponse({
              id: id,
              objectUsed: objectType,
              note: `Goal deleted successfully from ${objectType} object`
            }));
          }
        }
      } catch (error) {
        console.log(`Error deleting from ${objectType}:`, error.message);
        continue;
      }
    }

    return res.status(404).json(formatResponse('Goal not found or cannot be deleted from any available objects', 404, false));

  } catch (error) {
    console.error('Error in deleteGoalAlternative:', error);
    res.status(500).json(formatResponse('Failed to delete goal', 500, false));
  }
};

// Function to check what standard goal-related objects are available
export const checkGoalAvailability = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Only check standard Salesforce objects
    const standardObjectsToCheck = [
      'Goal',
      'Opportunity',
      'Task',
      'Campaign',
      'Event',
      'Case'
    ];

    const results = {};
    for (const objectName of standardObjectsToCheck) {
      const accessibility = await checkObjectAccessibility(accessToken, instanceUrl, objectName);
      results[objectName] = {
        exists: accessibility.exists,
        accessible: accessibility.accessible,
        createable: accessibility.createable,
        updateable: accessibility.updateable,
        deleteable: accessibility.deleteable,
        label: accessibility.label
      };
    }

    // Determine the best option for goal management using only standard objects
    let recommendation = 'No suitable standard objects found for goal management';
    let recommendedObject = null;
    let alternativeOptions = [];

    if (results.Goal?.exists && results.Goal?.createable) {
      recommendation = 'Use standard Goal object';
      recommendedObject = 'Goal';
    } else {
      // Check alternatives in order of preference
      if (results.Opportunity?.exists && results.Opportunity?.createable) {
        alternativeOptions.push({
          object: 'Opportunity',
          reason: 'Best for sales-related goals with monetary targets',
          usage: 'Create opportunities with Type = "Goal"'
        });
      }
      
      if (results.Task?.exists && results.Task?.createable) {
        alternativeOptions.push({
          object: 'Task',
          reason: 'Good for milestone-based goals and action items',
          usage: 'Create tasks with Subject containing "Goal"'
        });
      }
      
      if (results.Campaign?.exists && results.Campaign?.createable) {
        alternativeOptions.push({
          object: 'Campaign',
          reason: 'Suitable for marketing and engagement goals',
          usage: 'Create campaigns with Type = "Goal"'
        });
      }

      if (alternativeOptions.length > 0) {
        recommendation = `Use ${alternativeOptions[0].object} as goal alternative`;
        recommendedObject = alternativeOptions[0].object;
      }
    }

    res.status(200).json(formatResponse({
      objectAvailability: results,
      recommendation,
      recommendedObject,
      alternativeOptions,
      solutions: {
        immediate: 'Use /api/salesforce/goals/alternative endpoints',
        longTerm: 'Upgrade Salesforce edition to include Goals functionality'
      },
      usageExamples: {
        opportunityAsGoal: {
          endpoint: 'POST /api/salesforce/goals/alternative/create',
          body: {
            Name: 'Q1 Sales Target',
            TargetValue: 100000,
            EndDate: '2024-03-31',
            Status: 'In Progress',
            Description: 'First quarter sales goal'
          }
        },
        taskAsGoal: {
          endpoint: 'POST /api/salesforce/goals/alternative/create',
          body: {
            Name: 'Complete Training Program',
            EndDate: '2024-02-15',
            Status: 'Not Started',
            Description: 'Complete all required training modules'
          }
        }
      },
      upgradeInstructions: [
        '1. Contact your Salesforce account manager',
        '2. Upgrade to Professional, Enterprise, or Unlimited Edition',
        '3. Enable Goals functionality in Setup',
        '4. Configure goal settings and permissions'
      ]
    }));

  } catch (error) {
    console.error('Error in checkGoalAvailability:', error);
    res.status(500).json(formatResponse('Failed to check goal availability', 500, false));
  }
};

// Simple test endpoint to verify Salesforce connection
export const testSalesforceConnection = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Test basic connection
    const orgEndpoint = '/services/data/v59.0/sobjects';
    const result = await makeSalesforceRequest('GET', orgEndpoint, accessToken, instanceUrl);

    if (!result.success) {
      return res.status(result.status || 500).json(formatResponse({
        message: 'Failed to connect to Salesforce',
        error: result.data
      }, result.status, false));
    }

    // Get basic org info
    const orgInfoEndpoint = '/services/data/v59.0/';
    const orgInfo = await makeSalesforceRequest('GET', orgInfoEndpoint, accessToken, instanceUrl);

    const availableObjects = result.data.sobjects
      .filter(obj => obj.createable || obj.queryable)
      .slice(0, 20) // Limit to first 20 for readability
      .map(obj => ({
        name: obj.name,
        label: obj.label,
        createable: obj.createable,
        queryable: obj.queryable,
        updateable: obj.updateable,
        deletable: obj.deletable
      }));

    res.status(200).json(formatResponse({
      connection: 'successful',
      instanceUrl,
      apiVersion: orgInfo.success ? orgInfo.data.version : 'v59.0',
      totalObjects: result.data.sobjects.length,
      sampleObjects: availableObjects,
      goalObjectAvailable: result.data.sobjects.some(obj => obj.name === 'Goal'),
      recommendations: {
        useAlternativeEndpoints: '/api/salesforce/goals/alternative',
        checkAvailability: '/api/salesforce/goals/check-availability',
        createCustomGoalObject: 'Setup > Object Manager > Create > Custom Object'
      }
    }));

  } catch (error) {
    console.error('Error in testSalesforceConnection:', error);
    res.status(500).json(formatResponse('Failed to test Salesforce connection', 500, false));
  }
};

