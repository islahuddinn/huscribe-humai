import express from 'express';
import axios from 'axios';
import {
  createLead,
  updateLead,
  getLeadById,
  getAllLeads,
  deleteLead,
  createContact,
  updateContact,
  getContactById,
  getAllContacts,
  deleteContact,
  createTask,
  updateTask,
  getTaskById,
  getAllTasks,
  deleteTask,
  createMeeting,
  updateMeeting,
  getMeetingById,
  getAllMeetings,
  deleteMeeting,
  searchAllModules,
  getModuleFields,
  createAccount,
  updateAccount,
  getAccountById,
  getAllAccounts,
  deleteAccount,
  createCampaign,
  updateCampaign,
  getCampaignById,
  getAllCampaigns,
  deleteCampaign,
  createCampaignMember,
  updateCampaignMember,
  getCampaignMemberById,
  getAllCampaignMembers,
  deleteCampaignMember,
  createNote,
  updateNote,
  getNoteById,
  getAllNotes,
  deleteNote,
  bulkCreate,
  // Deals
  getAllDeals,
  createDeal,   
  getDealById,
  updateDeal,
  deleteDeal,
  // Products
  getAllProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  // Price Books
  getAllPriceBooks,
  createPriceBook,
  getPriceBookById,
  updatePriceBook,
  deletePriceBook,
  // Quotes
  getAllQuotes,
  createQuote,
  getQuoteById,
  updateQuote,
  deleteQuote,
  // Sales Orders
  getAllSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
  // Invoices
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  searchIds,
  searchProducts,
  // New imports for Cases/Tickets
  createCase,
  updateCase,
  getCaseById,
  getAllCases,
  deleteCase,
  // New imports for Emails
  sendEmail,
  createEmail,
  createEmailActivity,
  getEmailById,
  getAllEmails,
  deleteEmail,
  // New imports for Calls
  createCall,
  updateCall,
  getCallById,
  getAllCalls,
  deleteCall
} from '../controllers/zohoController.js';

import {
  getAccessToken,
  revokeToken,
  getAuthUrl,
  handleOAuthCallback,
  refreshToken,
  validateToken,
  diagnostics,
  checkScopes
} from '../controllers/zohoAuthController.js'

const router = express.Router();
// const validateAccessToken = (req, res, next) => {
//   const authHeader = req.headers['authorization'];
//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return res.status(401).json({ error: 'Access token is missing or invalid' });
//   }
//   next();
// };

///  ==Auth
router.get('/auth/url', getAuthUrl);
router.get('/auth/callback', handleOAuthCallback);
router.get('/access-token', getAccessToken);
router.post('/access-token', getAccessToken);
router.post('/auth/refresh', refreshToken);
router.post('/auth/validate', validateToken);
router.post('/auth/check-scopes', checkScopes);
router.get('/auth/diagnostics', diagnostics);
router.post('/auth/diagnostics', diagnostics);
router.post('/revoke-token', revokeToken);

// Debug route to check available modules
router.get('/modules', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token is missing or invalid' });
    }
    const accessToken = authHeader.split(' ')[1];
    
    const response = await axios.get(
      'https://www.zohoapis.com/crm/v2/settings/modules',
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      modules: response.data.modules.map(m => ({
        name: m.module_name,
        api_name: m.api_name,
        status: m.status,
        sequence_number: m.sequence_number
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

/// ==Leads
router.post('/leads/create', createLead);
router.put('/leads/:id', updateLead);
router.get('/leads/:id', getLeadById);
router.get('/leads', getAllLeads);
router.delete('/leads/:id', deleteLead);

//// Contacts
router.post('/contacts/create', createContact);
router.put('/contacts/:id', updateContact);
router.get('/contacts/:id', getContactById);
router.get('/contacts', getAllContacts);
router.delete('/contacts/:id', deleteContact);

//// Tasks
router.post('/tasks/create', createTask);
router.put('/tasks/:id', updateTask);
router.get('/tasks/:id', getTaskById);
router.get('/tasks', getAllTasks);
router.delete('/tasks/:id', deleteTask);

///// Meetings
router.post('/meetings/create', createMeeting);
router.put('/meetings/:id', updateMeeting);
router.get('/meetings/:id', getMeetingById);
router.get('/meetings', getAllMeetings);
router.delete('/meetings/:id', deleteMeeting);

////=====Enhanced searching====
router.get('/search', searchAllModules);
router.get('/search/advanced', searchAllModules); // Alias for enhanced search
router.get('/search/:module', async (req, res) => {
  // Convenience route for module-specific search
  req.query.module = req.params.module;
  await searchAllModules(req, res);
});

// Get available fields for a module (helpful for knowing what to search)
router.get('/fields/:module', getModuleFields);

//// Accounts
router.post('/accounts/create', createAccount);
router.put('/accounts/:id', updateAccount);
router.get('/accounts/:id', getAccountById);
router.get('/accounts', getAllAccounts);
router.delete('/accounts/:id', deleteAccount);

//// Campaigns
router.post('/campaigns/create', createCampaign);
router.put('/campaigns/:id', updateCampaign);
router.get('/campaigns/:id', getCampaignById);
router.get('/campaigns', getAllCampaigns);
router.delete('/campaigns/:id', deleteCampaign);

//// Campaign Members
router.post('/campaign-members/create', createCampaignMember);
router.put('/campaign-members/:id', updateCampaignMember);
router.get('/campaign-members/:id', getCampaignMemberById);
router.get('/campaign-members', getAllCampaignMembers);
router.delete('/campaign-members/:id', deleteCampaignMember);

//// Notes
router.post('/notes/create', createNote);
router.put('/notes/:id', updateNote);
router.get('/notes/:id', getNoteById);
router.get('/notes', getAllNotes);
router.delete('/notes/:id', deleteNote);

//// Cases/Tickets Routes
router.post('/cases/create', createCase);
router.put('/cases/:id', updateCase);
router.get('/cases/:id', getCaseById);
router.get('/cases', getAllCases);
router.delete('/cases/:id', deleteCase);

//// Emails Routes
router.post('/emails/send', sendEmail);         // Enhanced email sending with multiple methods
router.post('/emails/create', createEmail);     // Simple email creation
router.post('/emails/activity', createEmailActivity); // Alternative: Create as task activity
router.get('/emails/:id', getEmailById);
router.get('/emails', getAllEmails);
router.delete('/emails/:id', deleteEmail);

//// Calls Routes
router.post('/calls/create', createCall);
router.put('/calls/:id', updateCall);
router.get('/calls/:id', getCallById);
router.get('/calls', getAllCalls);
router.delete('/calls/:id', deleteCall);

//// Bulk Creation
router.post('/create-multiple', bulkCreate);

// Deals Routes

router.post('/deals/create', createDeal);
router.get('/deals', getAllDeals);
router.route('/deals/:id')
  .get(getDealById)
  .put(updateDeal)
  .delete(deleteDeal);

// Products Routes
router.post('/products/create', createProduct);
router.get('/products', getAllProducts);
router.route('/products/:id')
  .get(getProductById)
  .put(updateProduct)
  .delete(deleteProduct);


// Price Books Routes
router.post('/price-books/create', createPriceBook);
router.get('/price-books', getAllPriceBooks);
router.route('/price-books/:id')
  .get(getPriceBookById)
  .put(updatePriceBook)
  .delete(deletePriceBook);

// Quotes Routes
router.post('/quotes/create', createQuote);
router.get('/quotes', getAllQuotes);
router.route('/quotes/:id')
  .get(getQuoteById)
  .put(updateQuote)
  .delete(deleteQuote);

// Sales Orders Routes
router.post('/sales-orders/create', createSalesOrder);
router.get('/sales-orders', getAllSalesOrders);
router.route('/sales-orders/:id')
  .get(getSalesOrderById)
  .put(updateSalesOrder)
  .delete(deleteSalesOrder);

// Invoices Routes
router.post('/invoices/create', createInvoice);
router.get('/invoices', getAllInvoices);
router.route('/invoices/:id')
  .get(getInvoiceById)
  .put(updateInvoice)
  .delete(deleteInvoice);

  ////===search ids
router.get('/search/ids', searchIds);
router.get('/search/products', searchProducts);

export default router;