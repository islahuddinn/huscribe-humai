import axios from 'axios';
import { 
  makeCrmRequest, 
  discoverEntityDetails, 
  getWorkingEntityDetails,
  discoverEntityWithLicensing,
  validateEntityRequiredFields,
  createEntityWithValidation
} from '../config/microsoftDynemicConfig.js';

// Entity-specific required fields and validation rules
const ENTITY_FIELD_MAPPINGS = {
  contact: {
    required: [],
    recommended: ['firstname', 'lastname', 'emailaddress1'],
    readonly: ['contactid', 'fullname', 'createdon', 'modifiedon'],
    searchFields: ['firstname', 'lastname', 'fullname', 'emailaddress1', 'telephone1']
  },
  lead: {
    required: ['subject'],
    recommended: ['firstname', 'lastname', 'companyname', 'emailaddress1'],
    readonly: ['leadid', 'fullname', 'createdon', 'modifiedon'],
    searchFields: ['subject', 'firstname', 'lastname', 'fullname', 'companyname', 'emailaddress1']
  },
  account: {
    required: ['name'],
    recommended: ['name', 'telephone1', 'emailaddress1'],
    readonly: ['accountid', 'createdon', 'modifiedon'],
    searchFields: ['name', 'telephone1', 'emailaddress1', 'websiteurl']
  },
  opportunity: {
    required: ['name'],
    recommended: ['name', 'estimatedvalue', 'estimatedclosedate'],
    readonly: ['opportunityid', 'createdon', 'modifiedon'],
    searchFields: ['name', 'description']
  },
  task: {
    required: ['subject'],
    recommended: ['subject', 'description', 'scheduledend'],
    readonly: ['activityid', 'createdon', 'modifiedon'],
    searchFields: ['subject', 'description']
  },
  appointment: {
    required: ['subject'],
    recommended: ['subject', 'scheduledstart', 'scheduledend'],
    readonly: ['activityid', 'createdon', 'modifiedon'],
    searchFields: ['subject', 'description']
  },
  incident: {
    required: ['title'],
    recommended: ['title', 'description'],
    readonly: ['incidentid', 'ticketnumber', 'createdon', 'modifiedon'],
    searchFields: ['title', 'ticketnumber', 'description']
  },
  product: {
    required: ['name'],
    recommended: ['name', 'price', 'description'],
    readonly: ['productid', 'createdon', 'modifiedon'],
    searchFields: ['name', 'productnumber', 'description']
  },
  quote: {
    required: ['name'],
    recommended: ['name', 'totalamount'],
    readonly: ['quoteid', 'quotenumber', 'createdon', 'modifiedon'],
    searchFields: ['name', 'quotenumber', 'description']
  },
  salesorder: {
    required: ['name'],
    recommended: ['name', 'totalamount'],
    readonly: ['salesorderid', 'ordernumber', 'createdon', 'modifiedon'],
    searchFields: ['name', 'ordernumber', 'description']
  },
  invoice: {
    required: ['name'],
    recommended: ['name', 'totalamount'],  
    readonly: ['invoiceid', 'invoicenumber', 'createdon', 'modifiedon'],
    searchFields: ['name', 'invoicenumber', 'description']
  },
  campaign: {
    required: ['name'],
    recommended: ['name', 'description'],
    readonly: ['campaignid', 'createdon', 'modifiedon'],
    searchFields: ['name', 'description']
  },
  annotation: {
    required: ['subject'],
    recommended: ['subject', 'notetext'],
    readonly: ['annotationid', 'createdon', 'modifiedon'],
    searchFields: ['subject', 'notetext']
  },
  email: {
    required: ['subject'],
    recommended: ['subject', 'description'],
    readonly: ['activityid', 'createdon', 'modifiedon'],
    searchFields: ['subject', 'description']
  },
  phonecall: {
    required: ['subject'],
    recommended: ['subject', 'description', 'phonenumber'],
    readonly: ['activityid', 'createdon', 'modifiedon'],
    searchFields: ['subject', 'description', 'phonenumber']
  },
  salesorder: {
    required: ['name'],
    recommended: ['name', 'totalamount'],
    readonly: ['salesorderid', 'ordernumber', 'createdon', 'modifiedon'],
    searchFields: ['name', 'ordernumber', 'description']
  }
};

// Field validation patterns
const FIELD_PATTERNS = { 
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\+]?[1-9][\d]{0,15}$/,
  url: /^https?:\/\/.+/
};

// Standard entity templates with common fields
const ENTITY_TEMPLATES = {
  contact: {
    firstname: { type: 'string', maxLength: 50, required: true },
    lastname: { type: 'string', maxLength: 50, required: true },
    emailaddress1: { type: 'email', maxLength: 100 },
    telephone1: { type: 'phone', maxLength: 50 },
    mobilephone: { type: 'phone', maxLength: 50 },
    jobtitle: { type: 'string', maxLength: 100 },
    department: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 2000 },
    address1_line1: { type: 'string', maxLength: 250 },
    address1_city: { type: 'string', maxLength: 80 },
    address1_stateorprovince: { type: 'string', maxLength: 50 },
    address1_postalcode: { type: 'string', maxLength: 20 },
    address1_country: { type: 'string', maxLength: 80 }
  },
  lead: {
    firstname: { type: 'string', maxLength: 50 },
    lastname: { type: 'string', maxLength: 50, required: true },
    companyname: { type: 'string', maxLength: 100, required: true },
    emailaddress1: { type: 'email', maxLength: 100 },
    telephone1: { type: 'phone', maxLength: 50 },
    mobilephone: { type: 'phone', maxLength: 50 },
    jobtitle: { type: 'string', maxLength: 100 },
    industrycode: { type: 'number' },
    description: { type: 'string', maxLength: 2000 },
    address1_line1: { type: 'string', maxLength: 250 },
    address1_city: { type: 'string', maxLength: 80 },
    address1_stateorprovince: { type: 'string', maxLength: 50 },
    address1_postalcode: { type: 'string', maxLength: 20 }
  },
  account: {
    name: { type: 'string', maxLength: 160, required: true },
    emailaddress1: { type: 'email', maxLength: 100 },
    telephone1: { type: 'phone', maxLength: 50 },
    websiteurl: { type: 'url', maxLength: 200 },
    industrycode: { type: 'number' },
    numberofemployees: { type: 'number' },
    revenue: { type: 'money' },
    description: { type: 'string', maxLength: 2000 },
    address1_line1: { type: 'string', maxLength: 250 },
    address1_city: { type: 'string', maxLength: 80 },
    address1_stateorprovince: { type: 'string', maxLength: 50 },
    address1_postalcode: { type: 'string', maxLength: 20 },
    address1_country: { type: 'string', maxLength: 80 }
  },
  opportunity: {
    name: { type: 'string', maxLength: 300, required: true },
    estimatedvalue: { type: 'money' },
    estimatedclosedate: { type: 'date' },
    description: { type: 'string', maxLength: 2000 },
    stepname: { type: 'string', maxLength: 100 }
  },
  task: {
    subject: { type: 'string', maxLength: 200, required: true },
    description: { type: 'string', maxLength: 2000 },
    scheduledstart: { type: 'datetime' },
    scheduledend: { type: 'datetime' },
    prioritycode: { type: 'number', default: 1 },
    category: { type: 'string', maxLength: 250 },
    subcategory: { type: 'string', maxLength: 250 }
  },
  appointment: {
    subject: { type: 'string', maxLength: 200, required: true },
    description: { type: 'string', maxLength: 2000 },
    scheduledstart: { type: 'datetime', required: true },
    scheduledend: { type: 'datetime', required: true },
    location: { type: 'string', maxLength: 200 },
    prioritycode: { type: 'number', default: 1 }
  },
  incident: { // case
    title: { type: 'string', maxLength: 200, required: true },
    description: { type: 'string', maxLength: 2000 },
    prioritycode: { type: 'number', default: 2 },
    caseorigincode: { type: 'number', default: 1 }
  },
  product: {
    name: { type: 'string', maxLength: 100, required: true },
    productnumber: { type: 'string', maxLength: 100 }, // Not required - auto-generated if not provided
    description: { type: 'string', maxLength: 2000 },
    standardcost: { type: 'money' },
    currentcost: { type: 'money' },
    listprice: { type: 'money' },
    price: { type: 'money' },
    validfromdate: { type: 'date' },
    validtodate: { type: 'date' },
    suppliername: { type: 'string', maxLength: 100 },
    vendorname: { type: 'string', maxLength: 100 },
    vendorpartnumber: { type: 'string', maxLength: 100 },
    size: { type: 'string', maxLength: 100 },
    producturl: { type: 'url', maxLength: 255 },
    stockweight: { type: 'number' },
    stockvolume: { type: 'number' },
    quantityonhand: { type: 'number' },
    // REQUIRED unit schedule fields
    _defaultuomscheduleid_value: { type: 'guid', required: true, description: 'Default Unit Schedule ID (auto-set)' },
    _defaultuomid_value: { type: 'guid', required: true, description: 'Default Unit of Measure ID (auto-set)' },
    // Additional product fields
    productstructure: { type: 'number', default: 1, description: '1=Product, 2=Product Bundle, 3=Product Kit' },
    producttypecode: { type: 'number', default: 1, description: '1=Sales Inventory, 2=Miscellaneous Charges, 3=Services, 4=Flat Fees' },
    quantitydecimal: { type: 'number', default: 2, description: 'Number of decimal places for quantity' },
    isstockitem: { type: 'boolean', default: false },
    iskit: { type: 'boolean', default: false },
    msdyn_gdproptout: { type: 'boolean', default: false },
    isreparented: { type: 'boolean', default: false }
  },
  annotation: { // note
    subject: { type: 'string', maxLength: 500, required: true },
    notetext: { type: 'string', maxLength: 100000 },
    filename: { type: 'string', maxLength: 255 },
    langid: { type: 'string', transform: 'toString' },
    isdocument: { type: 'boolean' }
  },
  email: {
    subject: { type: 'string', maxLength: 200, required: true },
    description: { type: 'string', maxLength: 2000 },
    prioritycode: { type: 'number', default: 1 },
    directioncode: { type: 'boolean' },
    statecode: { type: 'number', default: 0 },
    statuscode: { type: 'number', default: 1 }
  },
  phonecall: {
    subject: { type: 'string', maxLength: 200, required: true },
    description: { type: 'string', maxLength: 2000 },
    scheduledstart: { type: 'datetime' },
    scheduledend: { type: 'datetime' },
    prioritycode: { type: 'number', default: 1 },
    directioncode: { type: 'boolean' },
    phonenumber: { type: 'string', maxLength: 50 }
  },
  salesorder: {
    name: { type: 'string', maxLength: 300, required: true },
    description: { type: 'string', maxLength: 2000 },
    totalamount: { type: 'money' },
    ordernumber: { type: 'string', maxLength: 100 }
  }
};

/**
 * Validate entity data before operations
 */
export const validateEntityData = (entityType, data, operation = 'create') => {
  console.log(`🔍 Validating ${operation} data for entity: ${entityType}`, {
    providedFields: Object.keys(data || {}),
    fieldCount: Object.keys(data || {}).length
  });

  if (!data || typeof data !== 'object') {
    throw new Error(`Invalid data provided for ${entityType}. Expected object, got ${typeof data}`);
  }

  const fieldMapping = ENTITY_FIELD_MAPPINGS[entityType.toLowerCase()];
  if (!fieldMapping) {
    console.log(`⚠️ No field mapping found for ${entityType}, using basic validation`);
    return { isValid: true, warnings: [`No specific validation rules for ${entityType}`] };
  }

  const errors = [];
  const warnings = [];
  const providedFields = Object.keys(data);

  // Check required fields (only for create operations)
  if (operation === 'create' && fieldMapping.required) {
    fieldMapping.required.forEach(field => {
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
        errors.push(`Required field '${field}' is missing or empty`);
      }
    });
  }

  // Check for readonly fields in update operations
  if (operation === 'update' && fieldMapping.readonly) {
    fieldMapping.readonly.forEach(field => {
      if (data.hasOwnProperty(field)) {
        warnings.push(`Field '${field}' is readonly and will be ignored`);
        delete data[field];
      }
    });
  }

  // Recommendations
  if (operation === 'create' && fieldMapping.recommended) {
    fieldMapping.recommended.forEach(field => {
      if (!data[field]) {
        warnings.push(`Recommended field '${field}' is not provided`);
      }
    });
  }

  // Apply field transformations based on entity template
  const entityTemplate = ENTITY_TEMPLATES[entityType.toLowerCase()];
  if (entityTemplate) {
    Object.keys(data).forEach(fieldName => {
      const fieldConfig = entityTemplate[fieldName];
      if (fieldConfig && fieldConfig.transform) {
        const originalValue = data[fieldName];
        
        if (fieldConfig.transform === 'toString' && typeof originalValue !== 'string') {
          data[fieldName] = String(originalValue);
          console.log(`🔄 Transformed field '${fieldName}' from ${typeof originalValue} to string: ${originalValue} -> "${data[fieldName]}"`);
        }
      }
    });
  }

  console.log(`📋 Validation results for ${entityType}:`, {
    errors: errors.length,
    warnings: warnings.length,
    validatedFields: providedFields.length
  });

  if (errors.length > 0) {
    throw new Error(`Validation failed for ${entityType}: ${errors.join(', ')}`);
  }

  return {
    isValid: true,
    warnings,
    cleanedData: data
  };
};

/**
 * Create entity with enhanced validation and licensing checks
 */
export const createEntityDynamic = async (entityType, data, accessToken, options = {}) => {
  try {
    const { organizationUrl, customCrmUrl, fallbackStrategy = 'none' } = options;
    
    // Use organizationUrl as priority, fall back to customCrmUrl for backward compatibility
    const targetCrmUrl = organizationUrl || customCrmUrl;
    
    console.log(`🚀 Creating ${entityType} entity dynamically:`, {
      entityType,
      fieldCount: Object.keys(data).length,
      organizationUrl: targetCrmUrl,
      fallbackStrategy,
      timestamp: new Date().toISOString()
    });

    // Validate that organization URL is provided
    if (!targetCrmUrl) {
      throw new Error('Organization URL is required for dynamic entity creation. Provide organizationUrl in options.');
    }

    // Validate entity data first
    const validation = await validateEntityData(entityType, data);
    if (!validation.isValid) {
      throw new Error(`VALIDATION_ERROR: ${validation.error}`);
    }

    // Enhanced entity creation with licensing checks
    try {
      const entityInfo = await discoverEntityWithLicensing(entityType, accessToken, targetCrmUrl);
      
      // Import and use the updated prepareEntityData from config
      const { prepareEntityData } = await import('../config/microsoftDynemicConfig.js');
      
      // Prepare enhanced data with entity-specific defaults including customer linking for incidents
      const enhancedData = await prepareEntityData(entityType, data, accessToken, targetCrmUrl);
      
      console.log(`✨ Enhanced data prepared for ${entityType}:`, {
        originalFields: Object.keys(data).length,
        enhancedFields: Object.keys(enhancedData).length,
        addedDefaults: Object.keys(enhancedData).filter(k => !data.hasOwnProperty(k))
      });

      // Create the entity using the provided organization URL
      const result = await makeCrmRequest(
        'POST',
        `${entityInfo.entitySetName}`,
        accessToken,
        enhancedData,
        targetCrmUrl
      );

      // Extract ID from response headers
      const entityId = result['@odata.id']?.match(/\((.+)\)/)?.[1] || 
                     result[entityInfo.primaryIdField] || 
                     'unknown';

      console.log(`✅ ${entityInfo.displayName} created successfully:`, {
        id: entityId,
        entityType: entityInfo.logicalName,
        environment: customCrmUrl || 'default'
      });

    return {
      success: true,
        id: entityId,
        entityType: entityInfo.logicalName,
        entitySetName: entityInfo.entitySetName,
        displayName: entityInfo.displayName,
        data: enhancedData,
        licenseRequired: entityInfo.licenseRequired,
        environment: customCrmUrl || process.env.DYNAMICS_CRM_URL,
        created: new Date().toISOString()
      };

    } catch (creationError) {
      console.error(`❌ Direct creation failed for ${entityType}:`, creationError.message);
      
      // NO FALLBACK STRATEGY - throw error for sales entities
      if (isSalesEntity(entityType)) {
        console.error(`❌ Sales entity ${entityType} creation failed - no fallback allowed`);
        throw new Error(`Sales entity '${entityType}' creation failed: ${creationError.message}. Use the correct Sales environment or install Dynamics 365 Sales Hub.`);
      }
      
      // Only allow fallback for non-sales entities if explicitly requested
      if (fallbackStrategy === 'auto' && !isSalesEntity(entityType)) {
        console.log(`🔄 Attempting fallback creation for non-sales entity: ${entityType}`);
        return await createWithFallbackStrategy(entityType, data, accessToken, customCrmUrl);
      }
      
      throw creationError;
    }

  } catch (error) {
    console.error(`❌ Entity creation failed for ${entityType}:`, {
      error: error.message,
      entityType,
      timestamp: new Date().toISOString()
    });
    
    throw new Error(`Failed to create ${entityType}: ${error.message}`);
  }
};

// Helper function to check if entity is a sales entity
const isSalesEntity = (entityType) => {
  const salesEntities = ['lead', 'opportunity', 'product', 'quote', 'invoice', 'salesorder'];
  return salesEntities.includes(entityType.toLowerCase());
};

// Enhanced fallback strategy for sales entities
const createWithFallbackStrategy = async (entityType, data, accessToken, customCrmUrl) => {
  console.log(`🎯 Executing fallback strategy for ${entityType}...`);
  
  const fallbackMappings = {
    lead: {
      targetEntity: 'contact',
      transformation: (leadData) => ({
        firstname: leadData.firstname,
        lastname: leadData.lastname,
        emailaddress1: leadData.emailaddress1,
        telephone1: leadData.telephone1,
        mobilephone: leadData.mobilephone,
        jobtitle: leadData.jobtitle,
        description: `LEAD: ${leadData.subject || 'Lead from API'}\n` +
                    `Company: ${leadData.companyname || 'Not specified'}\n` +
                    `Source: ${leadData.leadsourcecode ? getSourceName(leadData.leadsourcecode) : 'Web'}\n` +
                    `Description: ${leadData.description || ''}`,
        address1_city: leadData.city,
        address1_stateorprovince: leadData.state,
        address1_country: leadData.country,
        websiteurl: leadData.websiteurl
      })
    },
    opportunity: {
      targetEntity: 'task',
      transformation: (dealData) => ({
        subject: `DEAL: ${dealData.name}`,
        description: `Deal/Opportunity: ${dealData.name}\n` +
                    `Estimated Value: ${dealData.estimatedvalue || 'Not specified'}\n` +
                    `Close Date: ${dealData.estimatedclosedate || 'Not specified'}\n` +
                    `Stage: ${dealData.stepname || 'Qualify'}\n` +
                    `Description: ${dealData.description || ''}`,
        scheduledstart: new Date().toISOString(),
        scheduledend: dealData.estimatedclosedate ? 
          new Date(dealData.estimatedclosedate).toISOString() : 
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        prioritycode: dealData.estimatedvalue > 10000 ? 2 : 1,
        statecode: 0,
        statuscode: 2
      })
    },
    product: {
      targetEntity: 'annotation',
      transformation: (productData) => ({
        subject: `PRODUCT: ${productData.name}`,
        notetext: `Product Information:\n` +
                 `Name: ${productData.name}\n` +
                 `Product Number: ${productData.productnumber || generateProductNumber(productData.name)}\n` +
                 `Price: ${productData.price || 'Not specified'}\n` +
                 `Cost: ${productData.standardcost || 'Not specified'}\n` +
                 `Description: ${productData.description || ''}\n` +
                 `Valid From: ${productData.validfromdate || 'Not specified'}\n` +
                 `Valid To: ${productData.validtodate || 'Not specified'}`,
        filename: `product_${productData.name.replace(/[^a-zA-Z0-9]/g, '_')}.txt`,
        isdocument: false
      })
    }
  };

  const fallback = fallbackMappings[entityType];
  if (!fallback) {
    throw new Error(`No fallback strategy available for ${entityType}`);
  }

  const transformedData = fallback.transformation(data);
  
  console.log(`🔄 Transformed ${entityType} data for ${fallback.targetEntity}:`, {
    originalEntity: entityType,
    targetEntity: fallback.targetEntity,
    fieldsTransformed: Object.keys(transformedData).length
  });

  // Create using the fallback entity
  const result = await createEntityDynamic(fallback.targetEntity, transformedData, accessToken, {
    customCrmUrl,
    fallbackStrategy: 'none' // Prevent recursive fallback
  });

  return {
    ...result,
    originalRequest: entityType,
    fallbackUsed: fallback.targetEntity,
    fallbackReason: `${entityType} entity not available in environment`,
    recommendation: `Enable Dynamics 365 Sales Hub for native ${entityType} functionality`,
    note: `${entityType} information stored in ${fallback.targetEntity} entity`
  };
};

// Helper functions
const getSourceName = (sourceCode) => {
  const sources = { 1: 'Web', 2: 'Phone', 3: 'Email', 4: 'Referral' };
  return sources[sourceCode] || 'Unknown';
};

const generateProductNumber = (productName) => {
  const prefix = productName.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${timestamp}`;
};

// Enhanced data preparation with environment-specific defaults
const prepareEntityDataEnhanced = async (entityType, data) => {
  const enhancedData = { ...data };
  
  // Add entity-specific defaults based on type
  switch (entityType.toLowerCase()) {
    case 'lead':
      enhancedData.leadsourcecode = enhancedData.leadsourcecode || 1; // Web
      enhancedData.statuscode = enhancedData.statuscode || 1; // New
      enhancedData.leadqualitycode = enhancedData.leadqualitycode || 3; // Warm
      break;
      
    case 'opportunity':
      enhancedData.stepname = enhancedData.stepname || 'Qualify';
      enhancedData.statuscode = enhancedData.statuscode || 1; // In Progress
      if (!enhancedData.estimatedclosedate) {
        enhancedData.estimatedclosedate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      if (!enhancedData.closeprobability) {
        enhancedData.closeprobability = getDefaultProbability(enhancedData.stepname);
      }
      break;
      
    case 'product':
      console.log('🛠️ [Service] Preparing product data:', {
        originalFields: Object.keys(enhancedData),
        hasName: !!enhancedData.name,
        hasProductNumber: !!enhancedData.productnumber
      });
      
      // Set essential product defaults
      enhancedData.productstructure = enhancedData.productstructure || 1; // Product (not bundle/kit)
      enhancedData.producttypecode = enhancedData.producttypecode || 1; // Sales Inventory
      enhancedData.quantitydecimal = enhancedData.quantitydecimal || 2; // Decimal places
      enhancedData.isstockitem = enhancedData.isstockitem !== undefined ? enhancedData.isstockitem : false;
      enhancedData.iskit = enhancedData.iskit !== undefined ? enhancedData.iskit : false;
      enhancedData.msdyn_gdproptout = enhancedData.msdyn_gdproptout !== undefined ? enhancedData.msdyn_gdproptout : false;
      enhancedData.isreparented = enhancedData.isreparented !== undefined ? enhancedData.isreparented : false;
      
      // Auto-generate product number if not provided and we have a name
      if (!enhancedData.productnumber && enhancedData.name) {
        enhancedData.productnumber = generateProductNumber(enhancedData.name);
        console.log('🔧 [Service] Auto-generated product number:', enhancedData.productnumber);
      }
      
      // IMPORTANT: Check if unit schedule fields are still missing
      if (!enhancedData._defaultuomscheduleid_value || !enhancedData._defaultuomid_value) {
        console.log('⚠️ [Service] Unit schedule fields still missing - these are REQUIRED for product creation');
        console.log('💡 [Service] The config prepareEntityData should have set these fields');
      }
      
      console.log('✅ [Service] Product data preparation complete:', {
        finalFields: Object.keys(enhancedData),
        fieldCount: Object.keys(enhancedData).length,
        productStructure: enhancedData.productstructure,
        productTypeCode: enhancedData.producttypecode
      });
      break;
      
    case 'task':
      enhancedData.prioritycode = enhancedData.prioritycode || 1; // Normal
      enhancedData.statuscode = enhancedData.statuscode || 2; // Not Started
      break;
      
    case 'appointment':
      enhancedData.prioritycode = enhancedData.prioritycode || 1; // Normal
      enhancedData.statuscode = enhancedData.statuscode || 3; // Scheduled
      break;
      
    case 'incident':
      enhancedData.prioritycode = enhancedData.prioritycode || 2; // Normal
      enhancedData.caseorigincode = enhancedData.caseorigincode || 1; // Phone
      enhancedData.statuscode = enhancedData.statuscode || 1; // In Progress
      break;
  }
  
  return enhancedData;
};

const getDefaultProbability = (stage) => {
  const stageProbabilities = {
    'Qualify': 25,
    'Develop': 50,
    'Propose': 75,
    'Close': 90,
    'Won': 100,
    'Lost': 0
  };
  return stageProbabilities[stage] || 25;
};

/**
 * Get entities with enhanced filtering and pagination
 */
export const getEntitiesDynamic = async (entityType, accessToken, options = {}) => {
  console.log(`📋 Getting entities for: ${entityType}`, {
    options: {
      top: options.top,
      skip: options.skip,
      filter: options.filter ? 'Applied' : 'None',
      orderBy: options.orderBy || 'Default',
      select: options.select ? 'Custom' : 'All fields',
      hasOrganizationUrl: !!(options.organizationUrl || options.customCrmUrl)
    }
  });

  try {
    // Get organization URL from options (prioritize organizationUrl over customCrmUrl for backward compatibility)
    const organizationUrl = options.organizationUrl || options.customCrmUrl;
    
    // Step 1: Discover entity details
    const entityDetails = await discoverEntityDetails(entityType, accessToken, organizationUrl);
    console.log(`✅ Entity details found: ${entityDetails.logicalName} -> ${entityDetails.entitySetName}`);

    // Step 2: Build query parameters
    const queryParams = new URLSearchParams();
    
    if (options.top) queryParams.append('$top', options.top);
    if (options.skip) queryParams.append('$skip', options.skip);
    if (options.filter) queryParams.append('$filter', options.filter);
    if (options.orderBy) queryParams.append('$orderby', options.orderBy);
    if (options.select) queryParams.append('$select', options.select);
    if (options.count) queryParams.append('$count', 'true');

    const endpoint = queryParams.toString() ? 
      `${entityDetails.entitySetName}?${queryParams.toString()}` : 
      entityDetails.entitySetName;

    console.log(`📡 Making request to endpoint: ${endpoint} with organization URL: ${organizationUrl}`);

    // Step 3: Make the API call with organization URL
    const result = await makeCrmRequest('GET', endpoint, accessToken, null, organizationUrl);
    
    console.log(`✅ Successfully retrieved entities:`, {
      entityType: entityDetails.logicalName,
      recordCount: result.value?.length || 0,
      totalCount: result['@odata.count'] || 'Not requested',
      hasNextLink: !!result['@odata.nextLink']
    });

    return {
      entityType: entityDetails.logicalName,
      data: result.value || [],
      count: result['@odata.count'] || result.value?.length || 0,
      nextLink: result['@odata.nextLink'],
      metadata: {
        entitySetName: entityDetails.entitySetName,
        displayName: entityDetails.displayName
      }
    };

  } catch (error) {
    console.error(`❌ Failed to get entities for ${entityType}:`, error.message);
    throw new Error(`Failed to retrieve ${entityType} entities: ${error.message}`);
  }
};

/**
 * Update entity with validation
 */
export const updateEntityDynamic = async (entityType, entityId, entityData, accessToken, options = {}) => {
  console.log(`🔄 Starting entity update:`, {
    entityType,
    entityId,
    updateFields: Object.keys(entityData),
    fieldCount: Object.keys(entityData).length,
    hasOrganizationUrl: !!(options.organizationUrl || options.customCrmUrl)
  });

  try {
    // Get organization URL from options (prioritize organizationUrl over customCrmUrl for backward compatibility)
    const organizationUrl = options.organizationUrl || options.customCrmUrl;
    
    // Step 1: Discover entity details
    const entityDetails = await discoverEntityDetails(entityType, accessToken, organizationUrl);
    console.log(`✅ Entity details found for update: ${entityDetails.logicalName}`);

    // Step 2: Validate update data
    const validation = validateEntityData(entityDetails.logicalName, entityData, 'update');
    
    if (validation.warnings.length > 0) {
      console.log(`⚠️ Update validation warnings:`, validation.warnings);
    }

    // Step 3: Make the update API call
    const endpoint = `${entityDetails.entitySetName}(${entityId})`;
    console.log(`📡 Making PATCH request to: ${endpoint} with organization URL: ${organizationUrl}`);
    
    const result = await makeCrmRequest('PATCH', endpoint, accessToken, validation.cleanedData, organizationUrl);
    
    console.log(`✅ Entity update successful:`, {
      entityType: entityDetails.logicalName,
      entityId: entityId,
      updatedFields: Object.keys(validation.cleanedData)
    });

    return {
      success: true,
      entityType: entityDetails.logicalName,
      entityId: entityId,
      updatedFields: Object.keys(validation.cleanedData),
      warnings: validation.warnings
    };

  } catch (error) {
    console.error(`❌ Entity update failed:`, {
      entityType,
      entityId,
      error: error.message
    });
    
    throw new Error(`Failed to update ${entityType}: ${error.message}`);
  }
};

/**
 * Delete entity
 */
export const deleteEntityDynamic = async (entityType, entityId, accessToken, options = {}) => {
  console.log(`🗑️ Starting entity deletion:`, { 
    entityType, 
    entityId,
    hasOrganizationUrl: !!(options.organizationUrl || options.customCrmUrl)
  });

  try {
    // Get organization URL from options (prioritize organizationUrl over customCrmUrl for backward compatibility)
    const organizationUrl = options.organizationUrl || options.customCrmUrl;
    
    // Step 1: Discover entity details
    const entityDetails = await discoverEntityDetails(entityType, accessToken, organizationUrl);
    console.log(`✅ Entity details found for deletion: ${entityDetails.logicalName}`);

    // Step 2: Make the delete API call
    const endpoint = `${entityDetails.entitySetName}(${entityId})`;
    console.log(`📡 Making DELETE request to: ${endpoint} with organization URL: ${organizationUrl}`);
    
    await makeCrmRequest('DELETE', endpoint, accessToken, null, organizationUrl);
    
    console.log(`✅ Entity deletion successful:`, {
      entityType: entityDetails.logicalName,
      entityId: entityId
    });

    return {
      success: true,
      entityType: entityDetails.logicalName,
      entityId: entityId,
      message: `${entityDetails.displayName} deleted successfully`
    };

  } catch (error) {
    console.error(`❌ Entity deletion failed:`, {
      entityType,
      entityId,
      error: error.message
    });
    
    throw new Error(`Failed to delete ${entityType}: ${error.message}`);
  }
};

/**
 * Search entities with intelligent field matching
 */
export const searchEntitiesDynamic = async (entityType, searchTerm, accessToken, options = {}) => {
  console.log(`🔍 Starting entity search:`, {
    entityType,
    searchTerm,
    searchLength: searchTerm?.length || 0,
    options
  });

  try {
    // Step 1: Discover entity details
    const entityDetails = await discoverEntityDetails(entityType, accessToken);
    console.log(`✅ Entity details found for search: ${entityDetails.logicalName}`);

    // Step 2: Build search filter based on entity type
    const fieldMapping = ENTITY_FIELD_MAPPINGS[entityDetails.logicalName];
    const searchFields = fieldMapping?.searchFields || [entityDetails.primaryNameField];
    
    console.log(`📋 Using search fields:`, searchFields);

    // Build OData filter for search
    const filterConditions = searchFields.map(field => 
      `contains(${field},'${searchTerm.replace(/'/g, "''")}')`
    ).join(' or ');

    const queryParams = new URLSearchParams();
    queryParams.append('$filter', filterConditions);
    
    if (options.pageSize) queryParams.append('$top', options.pageSize);
    if (options.skip) queryParams.append('$skip', options.skip);
    queryParams.append('$count', 'true');

    const endpoint = `${entityDetails.entitySetName}?${queryParams.toString()}`;
    console.log(`📡 Making search request with filter: ${filterConditions}`);

    // Step 3: Make the API call
    const result = await makeCrmRequest('GET', endpoint, accessToken);
    
    console.log(`✅ Search completed:`, {
      entityType: entityDetails.logicalName,
      searchTerm,
      foundRecords: result.value?.length || 0,
      totalMatches: result['@odata.count'] || 0
    });

    return {
      entityType: entityDetails.logicalName,
      searchTerm,
      data: result.value || [],
      count: result['@odata.count'] || result.value?.length || 0,
      searchFields: searchFields,
      metadata: {
        entitySetName: entityDetails.entitySetName,
        displayName: entityDetails.displayName
      }
    };

  } catch (error) {
    console.error(`❌ Entity search failed:`, {
      entityType,
      searchTerm,
      error: error.message
    });
    
    throw new Error(`Search failed for ${entityType}: ${error.message}`);
  }
};

export { ENTITY_FIELD_MAPPINGS };
