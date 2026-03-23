import axios from 'axios';


export const makeSalesforceRequest = async (method, endpoint, accessToken, instanceUrl, data = {}) => {
  try {
    const response = await axios({
      method,
      url: `${instanceUrl}${endpoint}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data,
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Salesforce API Error:', error.response?.data || error.message);
    return {
      success: false,
      status: error.response?.status || 500,
      data: error.response?.data || error.message,
    };
  }
};

export const formatResponse = (data, status = 200, success = true) => {
  return {
    crmType: 'salesforce',
    status,
    success,
    data,
  };
};


export const getAllRecords = async (entity, req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    const { page = 1, limit = 10, ...filters } = req.query;

    let fields;
    switch (entity) {
      case 'Lead':
        fields = 'Id, FirstName, LastName, Company, Email, Phone, Status, Industry, Rating, LeadSource';
        break;
      case 'Contact':
        fields = 'Id, FirstName, LastName, Email, Phone, AccountId, Title, Department';
        break;
      case 'Event':
        fields = 'Id, Subject, StartDateTime, EndDateTime, Location, Description, WhoId, WhatId, IsAllDayEvent';
        break;
      case 'Account':
        fields = 'Id, Name, Industry, Phone, Website';
        break;
      case 'Task':
        fields = 'Id, Subject, Status, Priority, Description';
        break;
      case 'Opportunity':
        fields = 'Id, Name, AccountId, Amount, CloseDate, StageName, Probability, Type, LeadSource, Description';
        break;
      case 'Note':
        fields = 'Id, Title, Body, ParentId, CreatedDate, LastModifiedDate';
        break;
      case 'Product2':
        fields = 'Id, Name, ProductCode, Description, Family, IsActive';
        break;
      case 'Pricebook2':
        fields = 'Id, Name, Description, IsActive, IsStandard';
        break;
      case 'OpportunityLineItem':
        fields = 'Id, OpportunityId, PricebookEntryId, Quantity, UnitPrice, TotalPrice, Description';
        break;
      case 'Quote':
        fields = 'Id, Name, OpportunityId, ExpirationDate, Status, Description, GrandTotal';
        break;
      case 'Campaign':
        fields = 'Id, Name, Status, Type, StartDate, EndDate, Description, BudgetedCost, ActualCost';
        break;
      case 'CampaignMember':
        fields = 'Id, CampaignId, LeadId, ContactId, Status, HasResponded';
        break;
      case 'Order':
        fields = 'Id, AccountId, OpportunityId, Status, EffectiveDate, TotalAmount';
        break;
      case 'Case':
        fields = 'Id, CaseNumber, AccountId, ContactId, Status, Priority, Subject, Description, Origin';
        break;
      default:
        fields = 'Id, Name';
    }

    let soqlQuery = `SELECT ${fields} FROM ${entity}`;

    if (Object.keys(filters).length > 0) {
      const filterConditions = Object.entries(filters)
        .map(([key, value]) => `${key} = '${value}'`)
        .join(' AND ');
      soqlQuery += ` WHERE ${filterConditions}`;
    }

    const offset = (page - 1) * limit;
    soqlQuery += ` LIMIT ${limit} OFFSET ${offset}`;

    const endpoint = `/services/data/v59.0/query/?q=${encodeURIComponent(soqlQuery)}`;
    const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);

    if (!result.success) {
      return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
    }

    res.status(200).json(
      formatResponse({
        totalResults: result.data.totalSize,
        page: parseInt(page),
        limit: parseInt(limit),
        data: result.data.records,
      })
    );
  } catch (error) {
    console.error(`Error in getAllRecords for ${entity}:`, error.message);
    res.status(500).json(formatResponse('Failed to fetch records', 500, false));
  }
};

export const getRecordById = async (entity, req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    const { id } = req.params;
    const endpoint = `/services/data/v59.0/sobjects/${entity}/${id}`;
    const result = await makeSalesforceRequest('GET', endpoint, accessToken, instanceUrl);

    if (!result.success) {
      return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
    }

    res.status(200).json(formatResponse(result.data));
  } catch (error) {
    console.error(`Error in getRecordById for ${entity}:`, error.message);
    res.status(500).json(formatResponse('Failed to fetch record', 500, false));
  }
};

export const createRecord = async (entity, req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    // Add default values for required fields based on entity type
    const defaultValues = {
      'Task': {
        Subject: 'Default Task Subject',
        Status: 'Not Started',
        Priority: 'Normal',
        ActivityDate: new Date().toISOString().split('T')[0]
      },
      'Contact': {
        LastName: 'Default Last Name',
        Email: 'email is required',
        Phone: '0000000000'
      },
      'Lead': {
        LastName: 'Default Last Name',
        Company: 'Default Company',
        Status: 'New',
        Email: 'email is required',
        Phone: '0000000000'
      },
      'Account': {
        Name: 'Default Account Name',
        Phone: '0000000000',
        Website: 'www.default.com'
      },
      'Opportunity': {
        Name: 'Default Opportunity Name',
        StageName: 'Prospecting',
        CloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        Amount: 0
      },
      'Note': {
        Title: 'Default Note Title',
        Body: 'Default Note Body',
        ParentId: req.body.ParentId || null
      },
      'Event': {
        Subject: 'Default Event Subject',
        StartDateTime: new Date().toISOString(),
        EndDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        IsAllDayEvent: false
      },
      'Case': {
        Subject: 'Default Case Subject',
        Status: 'New',
        Origin: 'Web',
        Priority: 'Medium'
      },
      'Product2': {
        Name: 'Default Product Name',
        ProductCode: 'DEFAULT-001',
        IsActive: true,
        Family: 'Other'
      },
      'Pricebook2': {
        Name: 'Default Price Book',
        IsActive: true
      },
      'Quote': {
        Name: 'Default Quote Name',
        Status: 'Draft',
        ExpirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      'Campaign': {
        Name: 'Default Campaign Name',
        Status: 'Planned',
        Type: 'Other',
        StartDate: new Date().toISOString().split('T')[0],
        EndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        IsActive: true
      },
      'CampaignMember': {
        Status: 'Sent'
      },
      'Order': {
        Status: 'Draft',
        EffectiveDate: new Date().toISOString().split('T')[0]
      },
      // New objects
      'ServiceTerritory': {
        Name: 'Default Territory',
        DeveloperName: 'Default_Territory',
        Territory2ModelId: '0MGa3000004EQkRAAW',
        Description: 'Default territory description'
      },
      'Invoice__c': {
        AccountId: '001a3000004EQkRAAW',
        Status: 'Draft',
        InvoiceDate: new Date().toISOString().split('T')[0],
        DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        TotalAmount: 0.00
      },
      'ForecastItem': {
        ForecastCategoryName: 'Pipeline',
        ForecastItemDate: new Date().toISOString().split('T')[0],
        Amount: 0.00,
        OpportunityId: '006a3000004EQkRAAW'
      },
      'Competitor__c': {
        Name: 'Default Competitor',
        Strengths: 'Default strengths',
        Weaknesses: 'Default weaknesses',
        OpportunityId: '006a3000004EQkRAAW'
      },
      'ServiceAppointment': {
        ParentRecordId: '001a3000004EQkRAAW',
        EarliestStartTime: new Date().toISOString(),
        DueDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        Status: 'None',
        Description: 'Default service appointment'
      },
      'Asset': {
        Name: 'Default Asset',
        AccountId: '001a3000004EQkRAAW',
        Product2Id: '01ta3000004EQkRAAW',
        Status: 'Purchased',
        PurchaseDate: new Date().toISOString().split('T')[0],
        Description: 'Default asset description'
      },
      'KnowledgeArticleVersion': {
        Title: 'Default Article',
        UrlName: 'default-article',
        Language: 'en_US',
        PublishStatus: 'Draft',
        Summary: 'Default article summary',
        Body: 'Default article body'
      },
      'CustomObject__c': {
        Name: 'Default Custom Object',
        Description: 'Default custom object description'
      }
    };

    // Merge provided data with default values
    const recordData = {
      ...defaultValues[entity],
      ...req.body
    };

    const createEndpoint = `/services/data/v59.0/sobjects/${entity}/`;
    const createResult = await makeSalesforceRequest('POST', createEndpoint, accessToken, instanceUrl, recordData);

    if (!createResult.success) {
      return res.status(createResult.status || 500).json(formatResponse(createResult.data, createResult.status, false));
    }

    const fetchEndpoint = `/services/data/v59.0/sobjects/${entity}/${createResult.data.id}`;
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    res.status(201).json(formatResponse(fetchResult.data, 201));
  } catch (error) {
    console.error(`Error in createRecord for ${entity}:`, error.message);
    res.status(500).json(formatResponse('Failed to create record', 500, false));
  }
};

export const updateRecord = async (entity, req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    const { id } = req.params;
    const endpoint = `/services/data/v59.0/sobjects/${entity}/${id}`;
    const updateResult = await makeSalesforceRequest('PATCH', endpoint, accessToken, instanceUrl, req.body);

    if (!updateResult.success) {
      return res.status(updateResult.status || 500).json(formatResponse(updateResult.data, updateResult.status, false));
    }

    // Fetch the updated record
    const fetchEndpoint = `/services/data/v59.0/sobjects/${entity}/${id}`;
    const fetchResult = await makeSalesforceRequest('GET', fetchEndpoint, accessToken, instanceUrl);

    if (!fetchResult.success) {
      return res.status(fetchResult.status || 500).json(formatResponse(fetchResult.data, fetchResult.status, false));
    }

    res.status(200).json(formatResponse(fetchResult.data, 200));
  } catch (error) {
    console.error(`Error in updateRecord for ${entity}:`, error.message);
    res.status(500).json(formatResponse('Failed to update record', 500, false));
  }
};

export const deleteRecord = async (entity, req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

    const { id } = req.params;
    const endpoint = `/services/data/v59.0/sobjects/${entity}/${id}`;
    const result = await makeSalesforceRequest('DELETE', endpoint, accessToken, instanceUrl);

    if (!result.success) {
      return res.status(result.status || 500).json(formatResponse(result.data, result.status, false));
    }

    res.status(200).json(formatResponse('Record deleted successfully'));
  } catch (error) {
    console.error(`Error in deleteRecord for ${entity}:`, error.message);
    res.status(500).json(formatResponse('Failed to delete record', 500, false));
  }
};

export const checkObjectAccessibility = async (accessToken, instanceUrl, objectName) => {
  try {
    // First, check if the object exists and is accessible
    const describeEndpoint = `/services/data/v59.0/sobjects/${objectName}/describe`;
    const result = await makeSalesforceRequest('GET', describeEndpoint, accessToken, instanceUrl);

    if (!result.success) {
      return {
        exists: false,
        accessible: false,
        createable: false,
        updateable: false,
        deleteable: false,
        error: result.data
      };
    }

    // If we get here, the object exists and is accessible
    return {
      exists: true,
      accessible: true,
      createable: result.data.createable,
      updateable: result.data.updateable,
      deleteable: result.data.deletable,
      label: result.data.label,
      name: result.data.name,
      fields: result.data.fields.map(field => ({
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.nillable === false,
        createable: field.createable,
        updateable: field.updateable
      }))
    };
  } catch (error) {
    console.error(`Error checking accessibility for ${objectName}:`, error);
    return {
      exists: false,
      accessible: false,
      createable: false,
      updateable: false,
      deleteable: false,
      error: error.message
    };
  }
};
