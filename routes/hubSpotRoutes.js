import express from 'express';
import {
  createContact,
  getAllContacts,
  updateContact,
  deleteContact,
  createDeal,
  getDeal,
  updateDeal,
  deleteDeal,
  getContactById,
  getAllDeals,
  retrievAccessToken,
  createTask,
  getAllTasks,
  updateTask,
  deleteTask,
  getTaskById,
  searchHubSpot,
  createCompany,
  getCompany,
  getAllCompanies,
  updateCompany,
  deleteCompany,
  createTicket,
  getAllTickets,
  getTicket,
  updateTicket,
  deleteTicket,
  // OAuth related imports
  initiateOAuth,
  oauthCallback,
  getTokenInfo,
  deleteUserTokens,
  refreshToken,
  getAccessToken,
  // Forms
  getForms,
  getFormById,
  // Meetings
  getMeetings,
  createMeeting,
  // Pipelines
  getPipelines,
  createPipeline,
  // Properties
  getProperties,
  createProperty,
  // Workflows
  getWorkflows,
  enrollInWorkflow,
  // Analytics
  getAnalytics,
  // Custom Objects
  getCustomObjects,
  createCustomObject,
  // Quotes
  createQuote,
  getQuote,
  getAllQuotes,
  updateQuote,
  deleteQuote,
  getQuoteProperties,
  // Products
  createProduct,
  getProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
  getProductProperties,
  // Lists
  createList,
  getAllLists,
  getListById,
  updateList,
  deleteList,
  addMembersToList,
  removeMembersFromList,
  // Playbooks
  createPlaybook,
  getAllPlaybooks,
  getPlaybookById,
  updatePlaybook,
  deletePlaybook,
  // Templates
  createTemplate,
  getAllTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  // Snippets
  createSnippet,
  getAllSnippets,
  getSnippetById,
  updateSnippet,
  deleteSnippet,
  // Emails
  createEmail,
  getEmailById,
  updateEmail,
  deleteEmail,
  searchEmails,
  createNote,
  getAllNotes,
  getNoteById,
  updateNote,
  deleteNote,
  searchObjectIds,
  // Campaign and Order alternatives
  createCampaign,
  getAllCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  // Call functions
  createCall,
  getCallById,
  updateCall,
  deleteCall,
  searchCalls,
  getCallProperties,
  batchCalls,
  createLead,
  getAllLeads,
  getLeadById,
  updateLead,
  deleteLead
} from '../controllers/hubSpotController.js';

const router = express.Router();

// Middleware to handle authentication errors

////===OAuth Routes=====///
router.get('/oauth/init', initiateOAuth);
router.get('/oauth/callback', oauthCallback);
router.get('/oauth/token-info', getTokenInfo);
router.get('/oauth/refresh', refreshToken);
// router.post('/oauth/refresh', refreshToken);
router.delete('/oauth/logout', deleteUserTokens);

////===Auth=====///
router.get('/retrive-access-token', retrievAccessToken)
router.get('/search', searchHubSpot)
///// Contact Routes
router.post('/contacts/create',  createContact);
router.get('/contacts/',  getAllContacts);
router.get('/contacts/:id',  getContactById);
router.put('/contacts/:contactId', updateContact);
router.delete('/contacts/:id', deleteContact);

///// Deal Routes
router.post('/deals/create', createDeal);
router.get('/deals/:dealId', getDeal);
router.get('/deals/', getAllDeals);
router.put('/deals/:dealId',  updateDeal);
router.delete('/deals/:dealId', deleteDeal);

////tasks
router.post('/tasks/create', createTask);
router.get('/tasks/:id', getTaskById);
router.get('/tasks/',  getAllTasks);
router.put('/tasks/:taskId', updateTask);
router.delete('/tasks/:id', deleteTask);


///// Company Routes
router.post('/companies/create', createCompany);
router.get('/companies/:companyId', getCompany);
router.get('/companies/',  getAllCompanies);
router.put('/companies/:companyId', updateCompany);
router.delete('/companies/:companyId', deleteCompany);

///// Ticket Routes
router.post('/tickets/create', createTicket);
router.get('/tickets/:ticketId',  getTicket);
router.get('/tickets/',  getAllTickets);
router.put('/tickets/:ticketId',  updateTicket);
router.delete('/tickets/:ticketId',  deleteTicket);

/////====Forms====////
router.get('/forms', getForms);
router.get('/forms/:formId', getFormById);

/////====Meetings====////
router.get('/meetings', getMeetings);
router.post('/meetings/create', createMeeting);

/////====Pipelines====////
router.get('/pipelines/:objectType', getPipelines);
router.post('/pipelines/:objectType/create', createPipeline);

/////====Properties====////
router.get('/properties/:objectType', getProperties);
router.post('/properties/:objectType/create', createProperty);

/////====Workflows====////
router.get('/workflows', getWorkflows);
router.post('/workflows/:workflowId/enroll', enrollInWorkflow);

/////====Analytics====////
router.get('/analytics', getAnalytics);

/////====Custom Objects====////
router.get('/custom-objects/:objectType', getCustomObjects);
router.post('/custom-objects/:objectType/create', createCustomObject);

/////====Quotes====////
router.post('/quotes/create', createQuote);
router.get('/quotes/properties', getQuoteProperties);
router.get('/quotes/:quoteId', getQuote);
router.get('/quotes', getAllQuotes);
router.put('/quotes/:quoteId', updateQuote);
router.delete('/quotes/:quoteId', deleteQuote);

/////====Products====////
router.post('/products/create', createProduct);
router.get('/products/properties', getProductProperties);
router.get('/products/:productId', getProduct);
router.get('/products', getAllProducts);
router.put('/products/:productId', updateProduct);
router.delete('/products/:productId', deleteProduct);

/////====Lists====////
router.post('/lists/create', createList);
router.get('/lists', getAllLists);
router.get('/lists/:listId', getListById);
router.put('/lists/:listId', updateList);
router.delete('/lists/:listId', deleteList);
router.post('/lists/:listId/members', addMembersToList);
router.delete('/lists/:listId/members', removeMembersFromList);

/////====Playbooks====////
router.post('/playbooks/create', createPlaybook);
router.get('/playbooks', getAllPlaybooks);
router.get('/playbooks/:playbookId', getPlaybookById);
router.put('/playbooks/:playbookId', updatePlaybook);
router.delete('/playbooks/:playbookId', deletePlaybook);

/////====Templates====////
router.post('/templates/create', createTemplate);
router.get('/templates', getAllTemplates);
router.get('/templates/:templateId', getTemplateById);
router.put('/templates/:templateId', updateTemplate);
router.delete('/templates/:templateId', deleteTemplate);


/////====Snippets====////
router.post('/snippets/create', createSnippet);
router.get('/snippets', getAllSnippets);
router.get('/snippets/:snippetId', getSnippetById);
router.put('/snippets/:snippetId', updateSnippet);
router.delete('/snippets/:snippetId', deleteSnippet);

/////====Emails====////
router.post('/emails/create', createEmail);
router.get('/emails/:emailId', getEmailById);
router.put('/emails/:emailId', updateEmail);
router.delete('/emails/:emailId', deleteEmail);
router.get('/emails/search', searchEmails);

/////====Notes====////
router.post('/notes/create', createNote);
router.get('/notes', getAllNotes);
router.get('/notes/:noteId', getNoteById);
router.put('/notes/:noteId', updateNote);
router.delete('/notes/:noteId', deleteNote);
 
/////====Search====////
router.get('/search/ids', searchObjectIds);

/////====Campaign Alternative (Marketing Email)====////
router.post('/campaigns/create', createCampaign); 
router.get('/campaigns', getAllCampaigns);
router.get('/campaigns/:campaignId', getCampaignById);
router.put('/campaigns/:campaignId', updateCampaign);
router.patch('/campaigns/:campaignId', updateCampaign);
router.delete('/campaigns/:campaignId', deleteCampaign);

/////====Order Alternative (Deal + Line Items)====////
router.post('/orders/create', createOrder);
router.get('/orders', getAllOrders);
router.get('/orders/:orderId', getOrderById);
router.put('/orders/:orderId', updateOrder);
router.patch('/orders/:orderId', updateOrder);
router.delete('/orders/:orderId', deleteOrder);

/////====Calls====////
router.post('/calls/create', createCall);
router.get('/calls/properties', getCallProperties);
router.get('/calls/:callId', getCallById);
router.put('/calls/:callId', updateCall);
router.delete('/calls/:callId', deleteCall);
router.post('/calls/search', searchCalls);
router.post('/calls/batch', batchCalls);

// Lead Routes
router.post('/leads/create', createLead);
router.get('/leads', getAllLeads);
router.get('/leads/:id', getLeadById);
router.put('/leads/:id', updateLead);
router.delete('/leads/:id', deleteLead);

export default router;