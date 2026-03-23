import express from "express";
import {
  // Authentication routes
  initiateAuth,
  initiateAuthForSpecificEnvironment,
  handleCallback,
  checkToken,
  getToken,
  refreshToken,
  logout,
  validateD365Token,

  // Dynamic entity operations
  createEntity,
  getEntities,
  getEntityById,
  updateEntity,
  deleteEntity,
  searchEntities,

  // Legacy compatibility endpoints (for backward compatibility)
  createContact,
  getContacts,
  updateContact,
  deleteContact,
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  createDeal,
  getDeals,
  getDealById,
  updateDeal,
  deleteDeal,
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  createAccount,
  getAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  createCase,
  getCases,
  createProduct,
  getProducts,
  createQuote,
  getQuotes,
  createOrder,
  getOrders,
  createSalesOrder,
  createInvoice,
  getInvoices,
  createCampaign,
  getCampaigns,
  createGoal,
  getGoals,
  getGoalById,
  updateGoal,
  deleteGoal,

  // Utility endpoints
  searchCRM,
  testConnection,
  checkAvailableEntities,
  checkEntityPermissions,
  getAllEntities,
  checkUserAccess,
  discoverInstanceUrl,
  checkUserSetup,
  addUserToOrganization,
  testEntityDiscovery,

  // Organization diagnosis endpoints
  discoverUserOrgs,
  validateCurrentOrg,
  diagnoseAccessIssue,
  discoverOrgFromToken,
  testMultipleOrgs,

  // Environment and entity discovery endpoints
  discoverAvailableEntitySets,
  checkEntityAvailability,
  analyzeEnvironment,
  checkSalesHubStatus,

  // Enhanced testing and validation endpoints
  testEntityCreation,
  getEntityCreationGuide,

  // Additional entity controllers
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  createMeeting,
  getMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
  getCaseById,
  updateCase,
  deleteCase,
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
  createPhoneCall,
  getPhoneCalls,
  getPhoneCallById,
  updatePhoneCall,
  deletePhoneCall,
  createCall,
  getCalls,
  getCallById,
  updateCall,
  deleteCall,
  createEmail,
  getEmails,
  getEmailById,
  updateEmail,
  deleteEmail,
  getSalesOrderById,
  updateSalesOrder,
  deleteSalesOrder,
  getOrderById,
  updateOrder,
  deleteOrder,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,

  // Sales environment identification
  identifySalesEnvironment,
  
  // Opportunity controllers
  createOpportunity,
  getOpportunities,
  getOpportunityById,
  updateOpportunity,
  deleteOpportunity,
  getCurrentEnvironment,
  checkTokenDetails,
  quickSalesEnvironmentSetup,
  checkTenantConfiguration,
  checkUserSalesCapabilities,

  // Goal helper functions
  getAvailableMetrics,
  createDefaultMetric,

  // Enhanced search functionality - consolidated into searchCRM
  
  // Organization switching
  switchOrganization,
  
  // Direct instance URL connection
  connectToInstanceUrl,
  
  // Switch to discovered instance
  switchToInstance,
  
  // Test instance URL mapping
  testInstanceUrlMapping,
  
  // Diagnose user permissions
  diagnoseUserPermissions,
  
  // Get permission guide
  getPermissionGuide,
  
  // Enhanced multi-tenant functionality
  detectUserSubscription,
  createEntityWithLicenseCheck,
} from '../controllers/microsoftDynemicController.js';

const router = express.Router();

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// Basic authentication (Microsoft Graph only, then discover Dynamics 365 organizations)
router.get('/auth/initiate', initiateAuth);

// Authentication for specific Dynamics 365 environment (for users with known environment URL)
router.get('/auth/initiate-environment', initiateAuthForSpecificEnvironment);

// OAuth callback handler
router.get('/callback', handleCallback);


router.get('/auth/token', checkToken, getToken);


router.post('/auth/refresh', refreshToken);


router.get('/auth/logout', logout);

// ==========================================
// DYNAMIC ENTITY OPERATIONS
// ==========================================


router.post('/entity/:entityType', checkToken, createEntity);


router.get('/entity/:entityType', checkToken, getEntities);


router.get('/entity/:entityType/:id', checkToken, getEntityById);


router.put('/entity/:entityType/:id', checkToken, updateEntity);


router.delete('/entity/:entityType/:id', checkToken, deleteEntity);


// Entity search route removed - use /search endpoint instead

// ==========================================
// SEARCH AND UTILITY ROUTES
// ==========================================

router.get('/search', checkToken, searchCRM);

router.get('/test-connection', checkToken, testConnection);

router.get('/entities/available', checkToken, checkAvailableEntities);

router.get('/entities/all', checkToken, getAllEntities);

router.get('/entity/:entityName/permissions', checkToken, checkEntityPermissions);


router.get('/user/access', checkToken, checkUserAccess);


router.get('/instance/discover', checkToken, discoverInstanceUrl);


router.get('/user/setup', checkToken, checkUserSetup);


router.post('/user/add-to-organization', checkToken, addUserToOrganization);


router.get('/test-discovery/:entityType', checkToken, testEntityDiscovery);


router.get('/organizations/discover', checkToken, discoverUserOrgs);


router.get('/organizations/validate-current', checkToken, validateCurrentOrg);


router.get('/diagnose/access-issue', checkToken, diagnoseAccessIssue);


router.get('/organizations/discover-from-token', checkToken, discoverOrgFromToken);


router.post('/organizations/test-multiple', checkToken, testMultipleOrgs);


router.get('/environment/entity-sets', checkToken, discoverAvailableEntitySets);


router.get('/environment/check-entity/:entityType', checkToken, checkEntityAvailability);


router.get('/environment/analyze', checkToken, analyzeEnvironment);

router.get('/environment/sales-hub-status', checkToken, checkSalesHubStatus);

// ==========================================
// LEGACY COMPATIBILITY ROUTES
// ==========================================

// Contact routes (backward compatibility)
router.post('/contacts/create', checkToken, createContact);
router.get('/contacts', checkToken, getContacts);
router.put('/contacts/:id', checkToken, updateContact);
router.delete('/contacts/:id', checkToken, deleteContact);

// Lead routes (backward compatibility)
router.post('/leads/create', checkToken, createLead);
router.get('/leads', checkToken, getLeads);
router.get('/leads/:id', checkToken, getLeadById);
router.put('/leads/:id', checkToken, updateLead);
router.delete('/leads/:id', checkToken, deleteLead);

// Deal/Opportunity routes (backward compatibility)
router.post('/deals/create', checkToken, createDeal);
router.get('/deals', checkToken, getDeals);
router.get('/deals/:id', checkToken, getDealById);
router.put('/deals/:id', checkToken, updateDeal);
router.delete('/deals/:id', checkToken, deleteDeal);

// Task routes (backward compatibility)
router.post('/tasks/create', checkToken, createTask);
router.get('/tasks', checkToken, getTasks);
router.get('/tasks/:id', checkToken, getTaskById);
router.put('/tasks/:id', checkToken, updateTask);
router.delete('/tasks/:id', checkToken, deleteTask);

// Account routes (backward compatibility)
router.post('/accounts/create', checkToken, createAccount);
router.get('/accounts', checkToken, getAccounts);
router.get('/accounts/:id', checkToken, getAccountById);
router.put('/accounts/:id', checkToken, updateAccount);
router.delete('/accounts/:id', checkToken, deleteAccount);

// Case routes (backward compatibility)
router.post('/cases/create', checkToken, createCase);
router.get('/cases', checkToken, getCases);

// Product routes (backward compatibility)
router.post('/products/create', checkToken, createProduct);
router.get('/products', checkToken, getProducts);

// Quote routes (backward compatibility)
router.post('/quotes/create', checkToken, createQuote);
router.get('/quotes', checkToken, getQuotes);

// Order routes (backward compatibility)
router.post('/orders/create', checkToken, createOrder);
router.get('/orders', checkToken, getOrders);

// Sales order routes (backward compatibility)
router.post('/salesorders/create', checkToken, createSalesOrder);
router.get('/salesorders', checkToken, getOrders);

// Invoice routes (backward compatibility)
router.post('/invoices/create', checkToken, createInvoice);
router.get('/invoices', checkToken, getInvoices);

// Campaign routes (backward compatibility)
router.post('/campaigns/create', checkToken, createCampaign);
router.get('/campaigns', checkToken, getCampaigns);

// Goal routes (backward compatibility)
router.post('/goals/create', checkToken, createGoal);
router.get('/goals', checkToken, getGoals);
router.get('/goals/:id', checkToken, getGoalById);
router.put('/goals/:id', checkToken, updateGoal);
router.delete('/goals/:id', checkToken, deleteGoal);

// ==========================================
// ADDITIONAL ENTITY ROUTES
// ==========================================

/**
 * Additional entity routes for objects that might be available in your Dynamics 365 environment.
 * These entities require specific licenses/apps to be enabled:
 * 
 * ✅ COMMONLY AVAILABLE:
 * - Appointments/Meetings (calendar events)
 * - Notes (annotations attached to records)
 * - Cases (customer service incidents) 
 * - Phone Calls (activity records)
 * - Emails (activity records)
 * 
 * ⚠️ REQUIRES SPECIFIC APPS:
 * - Sales Orders (requires Sales Hub)
 * - Invoices (requires Sales Hub)
 */

// Appointment routes
router.post('/appointments/create', checkToken, createAppointment);
router.get('/appointments', checkToken, getAppointments);
router.get('/appointments/:id', checkToken, getAppointmentById);
router.put('/appointments/:id', checkToken, updateAppointment);
router.delete('/appointments/:id', checkToken, deleteAppointment);

// Meeting routes (alias for appointments)
router.post('/meetings/create', checkToken, createMeeting);
router.get('/meetings', checkToken, getMeetings);
router.get('/meetings/:id', checkToken, getMeetingById);
router.put('/meetings/:id', checkToken, updateMeeting);
router.delete('/meetings/:id', checkToken, deleteMeeting);

// Case routes (enhanced)
router.get('/cases/:id', checkToken, getCaseById);
router.put('/cases/:id', checkToken, updateCase);
router.delete('/cases/:id', checkToken, deleteCase);

// Note routes
router.post('/notes/create', checkToken, createNote);
router.get('/notes', checkToken, getNotes);
router.get('/notes/:id', checkToken, getNoteById);
router.put('/notes/:id', checkToken, updateNote);
router.delete('/notes/:id', checkToken, deleteNote);

// Phone call routes
router.post('/phonecalls/create', checkToken, createPhoneCall);
router.get('/phonecalls', checkToken, getPhoneCalls);
router.get('/phonecalls/:id', checkToken, getPhoneCallById);
router.put('/phonecalls/:id', checkToken, updatePhoneCall);
router.delete('/phonecalls/:id', checkToken, deletePhoneCall);

// Call routes (alias for phonecalls)
router.post('/calls/create', checkToken, createCall);
router.get('/calls', checkToken, getCalls);
router.get('/calls/:id', checkToken, getCallById);
router.put('/calls/:id', checkToken, updateCall);
router.delete('/calls/:id', checkToken, deleteCall);

// Email routes
router.post('/emails/create', checkToken, createEmail);
router.get('/emails', checkToken, getEmails);
router.get('/emails/:id', checkToken, getEmailById);
router.put('/emails/:id', checkToken, updateEmail);
router.delete('/emails/:id', checkToken, deleteEmail);

// Sales order routes (enhanced)
router.get('/salesorders/:id', checkToken, getSalesOrderById);
router.put('/salesorders/:id', checkToken, updateSalesOrder);
router.delete('/salesorders/:id', checkToken, deleteSalesOrder);

// Order routes (enhanced - alias for salesorders)
router.get('/orders/:id', checkToken, getOrderById);
router.put('/orders/:id', checkToken, updateOrder);
router.delete('/orders/:id', checkToken, deleteOrder);

// Invoice routes (enhanced)
router.get('/invoices/:id', checkToken, getInvoiceById);
router.put('/invoices/:id', checkToken, updateInvoice);
router.delete('/invoices/:id', checkToken, deleteInvoice);

// ==========================================
// ENHANCED TESTING AND VALIDATION ROUTES
// ==========================================

router.post('/entity/:entityType/test', checkToken, testEntityCreation);

router.get('/entity/:entityType/guide', checkToken, getEntityCreationGuide);

router.get('/environment/identify-sales', checkToken, identifySalesEnvironment);

router.get('/environment/sales-hub-status', checkToken, checkSalesHubStatus);

// ==========================================
// OPPORTUNITY ROUTES (Direct Entity Routes)
// ==========================================

// Opportunity routes
router.post('/opportunities/create', checkToken, createOpportunity);
router.get('/opportunities', checkToken, getOpportunities);
router.get('/opportunities/:id', checkToken, getOpportunityById);
router.put('/opportunities/:id', checkToken, updateOpportunity);
router.delete('/opportunities/:id', checkToken, deleteOpportunity);

// ==========================================
// ENVIRONMENT AND TOKEN UTILITY ROUTES
// ==========================================

// Update the environment route path
router.get('/get-environment-current', checkToken, getCurrentEnvironment);
router.get('/check-token', checkToken, checkTokenDetails);


router.get('/setup/sales-environment', checkToken, quickSalesEnvironmentSetup);

router.get('/config/check-tenant', checkTenantConfiguration);


router.get('/user/sales-capabilities', checkToken, checkUserSalesCapabilities);

// ==========================================
// GOAL HELPER ROUTES
// ========================================== 


router.get('/goals/metrics', checkToken, getAvailableMetrics);

router.post('/goals/create-default-metric', checkToken, createDefaultMetric);

// ==========================================
// ORGANIZATION SWITCHING ROUTE
// ==========================================

// Switch between organizations and get new Dynamics token
router.post('/auth/switch-organization', switchOrganization);

// Connect directly to a known Dynamics 365 instance URL
router.post('/auth/connect-instance', connectToInstanceUrl);

// Switch to a discovered instance/environment
router.post('/auth/switch-instance', switchToInstance);

// Test instance URL mapping
router.get('/test-instance-mapping', checkToken, testInstanceUrlMapping);

// Diagnose user permissions and capabilities
router.get('/diagnose-permissions', checkToken, diagnoseUserPermissions);

// Get comprehensive permission guide
router.get('/permission-guide', getPermissionGuide);

// ==========================================
// ENHANCED MULTI-TENANT DYNAMIC FEATURES
// ==========================================

// Detect user subscription type and capabilities
router.get('/subscription/detect', checkToken, detectUserSubscription);

// Create entity with license/subscription checking
router.post('/entity-licensed/:entityType', checkToken, createEntityWithLicenseCheck);

export default router;