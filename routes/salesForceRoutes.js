import express from 'express';
import {
  // Basic CRUD operations
  getTasks, getTaskById, createTask, updateTask, deleteTask,
  getEvents, getEventById, createEvent, updateEvent, deleteEvent,
  getLeads, getLeadById, createLead, updateLead, deleteLead,
  getContacts, getContactById, createContact, updateContact, deleteContact,
  getAccounts, getAccountById, createAccount, updateAccount, deleteAccount,
  getOpportunities, getOpportunityById, createOpportunity, updateOpportunity, deleteOpportunity,
  getNotes, getNoteById, createNote, updateNote, deleteNote,
  getProducts, getProductById, createProduct, updateProduct, deleteProduct,
  getPriceBooks, getPriceBookById, createPriceBook, updatePriceBook, deletePriceBook,
  getOpportunityProducts, getOpportunityProductById, createOpportunityProduct, updateOpportunityProduct, deleteOpportunityProduct,
  getQuotes, getQuoteById, createQuote, updateQuote, deleteQuote,
  getCampaigns, getCampaignById, createCampaign, updateCampaign, deleteCampaign,
  getCampaignMembers, getCampaignMemberById, createCampaignMember, updateCampaignMember, deleteCampaignMember,
  getOrders, getOrderById, createOrder, updateOrder, deleteOrder,
  getCases, getCaseById, createCase, updateCase, deleteCase,
  
  // Extended functionality
  getInvoices, getInvoiceById, createInvoice, updateInvoice, deleteInvoice,
  getForecastItems, getForecastItemById, createForecastItem, updateForecastItem, deleteForecastItem,
  getCompetitors, getCompetitorById, createCompetitor, updateCompetitor, deleteCompetitor,
  getServiceAppointments, getServiceAppointmentById, createServiceAppointment, updateServiceAppointment, deleteServiceAppointment,
  getCustomerAssets, getCustomerAssetById, createCustomerAsset, updateCustomerAsset, deleteCustomerAsset,
  getKnowledgeArticles, getKnowledgeArticleById, createKnowledgeArticle, updateKnowledgeArticle, deleteKnowledgeArticle,
  
  // Service Territory
  createOperatingHours,
  getServiceTerritories, getServiceTerritoryById, createServiceTerritory, updateServiceTerritory, deleteServiceTerritory,
  
  // Search and Auth
  searchSalesforce,
  getCustomObjects,
  getCustomObjectById,
  createCustomObject,
  updateCustomObject,
  deleteCustomObject,
  /// testing
  checkObjectsAccessibility,
  getGoals, getGoalById, createGoal, updateGoal, deleteGoal,
  // Alternative goal management
  getGoalsAlternative, createGoalAlternative, checkGoalAvailability, testSalesforceConnection,
  searchByIdentifier,
  searchAccountId,
  searchContactId,
  searchOpportunityId,
  searchProductId,
  getGoalAlternativeById,
  updateGoalAlternative,
  deleteGoalAlternative,
} from '../controllers/salesForceController.js';
import {
  salesforceoAuth,
  oauthCallback
} from '../controllers/salesforceAuthController.js';
import { 
  logCall,
  getCallLogs,
  logEmail,
  getEmailLogs
} from '../controllers/salesforceActivityController.js';

const router = express.Router();

// OAuth Routes
router.get('/oauth', salesforceoAuth);
router.get('/oauth/callback', oauthCallback);

// Search Route
router.route('/search').get(searchSalesforce);
router.get('/search/identifier', searchByIdentifier);

// ID Search Routes
router.get('/search/account-id', searchAccountId);
router.get('/search/contact-id', searchContactId);
router.get('/search/opportunity-id', searchOpportunityId);
router.get('/search/product-id', searchProductId);

// Tasks Routes
router.get('/tasks', getTasks);
router.get('/tasks/:id', getTaskById);
router.post('/tasks/create', createTask);
router.patch('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);

// Events Routes
router.get('/events', getEvents);
router.get('/events/:id', getEventById);
router.post('/events/create', createEvent);
router.patch('/events/:id', updateEvent);
router.delete('/events/:id', deleteEvent);

// Leads Routes
router.get('/leads', getLeads);
router.get('/leads/:id', getLeadById);
router.post('/leads/create', createLead);
router.patch('/leads/:id', updateLead);
router.delete('/leads/:id', deleteLead);

// Contacts Routes
router.get('/contacts', getContacts);
router.get('/contacts/:id', getContactById);
router.post('/contacts/create', createContact);
router.patch('/contacts/:id', updateContact);
router.delete('/contacts/:id', deleteContact);

// Accounts Routes
router.get('/accounts', getAccounts);
router.get('/accounts/:id', getAccountById);
router.post('/accounts/create', createAccount);
router.patch('/accounts/:id', updateAccount);
router.delete('/accounts/:id', deleteAccount);

// Opportunities Routes
router.get('/opportunities', getOpportunities);
router.get('/opportunities/:id', getOpportunityById);
router.post('/opportunities/create', createOpportunity);
router.patch('/opportunities/:id', updateOpportunity);
router.delete('/opportunities/:id', deleteOpportunity);

// Notes Routes
router.get('/notes', getNotes);
router.get('/notes/:id', getNoteById);
router.post('/notes/create', createNote);
router.patch('/notes/:id', updateNote);
router.delete('/notes/:id', deleteNote);

// Products Routes
router.get('/products', getProducts);
router.get('/products/:id', getProductById);
router.post('/products/create', createProduct);
router.patch('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

// Price Books Routes
router.get('/pricebooks', getPriceBooks);
router.get('/pricebooks/:id', getPriceBookById);
router.post('/pricebooks/create', createPriceBook);
router.patch('/pricebooks/:id', updatePriceBook);
router.delete('/pricebooks/:id', deletePriceBook);

// Opportunity Products Routes
router.get('/opportunity-products', getOpportunityProducts);
router.get('/opportunity-products/:id', getOpportunityProductById);
router.post('/opportunity-products/create', createOpportunityProduct);
router.patch('/opportunity-products/:id', updateOpportunityProduct);
router.delete('/opportunity-products/:id', deleteOpportunityProduct);

// Quotes Routes
router.get('/quotes', getQuotes);
router.get('/quotes/:id', getQuoteById);
router.post('/quotes/create', createQuote);
router.patch('/quotes/:id', updateQuote);
router.delete('/quotes/:id', deleteQuote);

// Campaigns Routes
router.get('/campaigns', getCampaigns);
router.get('/campaigns/:id', getCampaignById);
router.post('/campaigns/create', createCampaign);
router.patch('/campaigns/:id', updateCampaign);
router.delete('/campaigns/:id', deleteCampaign);
router.post('/campaigns', createCampaign);

// Campaign Members Routes
router.get('/campaign-members', getCampaignMembers);
router.get('/campaign-members/:id', getCampaignMemberById);
router.post('/campaign-members/create', createCampaignMember);
router.patch('/campaign-members/:id', updateCampaignMember);
router.delete('/campaign-members/:id', deleteCampaignMember);

// Orders Routes
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);
router.post('/orders/create', createOrder);
router.patch('/orders/:id', updateOrder);
router.delete('/orders/:id', deleteOrder);

// Cases Routes
router.get('/cases', getCases);
router.get('/cases/:id', getCaseById);
router.post('/cases/create', createCase);
router.patch('/cases/:id', updateCase);
router.delete('/cases/:id', deleteCase);

// Invoice Routes
router.get('/invoices', getInvoices);
router.get('/invoices/:id', getInvoiceById);
router.post('/invoices/create', createInvoice);
router.patch('/invoices/:id', updateInvoice);
router.delete('/invoices/:id', deleteInvoice);

// Pipeline/Forecast Item Routes
router.get('/forecast-items', getForecastItems);
router.get('/forecast-items/:id', getForecastItemById);
router.post('/forecast-items/create', createForecastItem);
router.patch('/forecast-items/:id', updateForecastItem);
router.delete('/forecast-items/:id', deleteForecastItem);

// Competitor Routes
router.get('/competitors', getCompetitors);
router.get('/competitors/:id', getCompetitorById);
router.post('/competitors/create', createCompetitor);
router.patch('/competitors/:id', updateCompetitor);
router.delete('/competitors/:id', deleteCompetitor);

// Service Appointment Routes
router.get('/service-appointments', getServiceAppointments);
router.get('/service-appointments/:id', getServiceAppointmentById);
router.post('/service-appointments/create', createServiceAppointment);
router.patch('/service-appointments/:id', updateServiceAppointment);
router.delete('/service-appointments/:id', deleteServiceAppointment);

// Customer Asset Routes
router.get('/customer-assets', getCustomerAssets);
router.get('/customer-assets/:id', getCustomerAssetById);
router.post('/customer-assets/create', createCustomerAsset);
router.patch('/customer-assets/:id', updateCustomerAsset);
router.delete('/customer-assets/:id', deleteCustomerAsset);

// Knowledge Article Routes
router.get('/knowledge-articles', getKnowledgeArticles);
router.get('/knowledge-articles/:id', getKnowledgeArticleById);
router.post('/knowledge-articles/create', createKnowledgeArticle);
router.patch('/knowledge-articles/:id', updateKnowledgeArticle);
router.delete('/knowledge-articles/:id', deleteKnowledgeArticle);

// Activity Routes
router.post("/activities-call/log-call/create",logCall)
router.get('/activities-call/call-logs/:entityId', getCallLogs);
router.post('/activities-email/create',logEmail);
router.get('/activities-email/email-logs/:entityId', getEmailLogs); 
// Custom Object Routes
router.get('/custom-objects', getCustomObjects);
router.get('/custom-objects/:id', getCustomObjectById);
router.post('/custom-objects/create', createCustomObject);
router.patch('/custom-objects/:id', updateCustomObject);
router.delete('/custom-objects/:id', deleteCustomObject);

// Service Territory Routes
router.get('/service-territories', getServiceTerritories);
router.get('/service-territories/:id', getServiceTerritoryById);
router.post('/service-territories/create', createServiceTerritory);
router.patch('/service-territories/:id', updateServiceTerritory);
router.delete('/service-territories/:id', deleteServiceTerritory);

// Add this with the other routes
router.get('/check-objects-accessibility', checkObjectsAccessibility);

router.post('/operating-hours/create', createOperatingHours);

// Goals Routes 
router.get('/goals', getGoals);
router.get('/goals/:id', getGoalById);
router.post('/goals/create', createGoal);
router.patch('/goals/:id', updateGoal);
router.delete('/goals/:id', deleteGoal);

// Alternative goal management
router.get('/goals-alternative', getGoalsAlternative);
router.get('/goals-alternative/:id', getGoalAlternativeById);
router.post('/goals-alternative/create', createGoalAlternative);
router.put('/goals-alternative/:id', updateGoalAlternative);
router.patch('/goals-alternative/:id', updateGoalAlternative);
router.delete('/goals-alternative/:id', deleteGoalAlternative);
router.get('/goals-alternative/check-availability', checkGoalAvailability);
router.get('/goals-alternative/test-connection', testSalesforceConnection);

export default router;