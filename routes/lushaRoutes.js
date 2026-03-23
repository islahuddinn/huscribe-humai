import express from 'express';
import {
  createContact,
  getContact,
  updateContact,
  deleteContact,
  searchContacts,
  getUsageStats,
  lushaRateLimiter,
  initiateOAuth,
  handleOAuthCallback,
  refreshAccessToken,
  getCompanyInfo,
  getPersonInfo,
  bulkCreateContacts,
  exportContacts,
  getAllContacts,
  updateMultipleContacts,
  deleteMultipleContacts,
  getContactHistory,
  getContactActivities,
  getContactTags,
  addContactTags,
  removeContactTags,
  getContactNotes,
  addContactNote,
  updateContactNote,
  deleteContactNote,
  getContactCustomFields,
  updateContactCustomFields,
  getContactRelationships,
  addContactRelationship,
  removeContactRelationship
} from '../controllers/lushaController.js';

const router = express.Router();

// Apply rate limiting to all Lusha routes
router.use(lushaRateLimiter);

// OAuth routes
router.get('/oauth/initiate', initiateOAuth);
router.get('/oauth/callback', handleOAuthCallback);
router.post('/oauth/refresh', refreshAccessToken);

// Contact routes
router.get('/contacts', getAllContacts);
router.post('/contacts/create', createContact);
router.get('/contacts/:id', getContact);
router.put('/contacts/:id', updateContact);
router.delete('/contacts/:id', deleteContact);
router.get('/contacts/search', searchContacts);
router.post('/contacts/bulk', bulkCreateContacts);
router.put('/contacts/bulk', updateMultipleContacts);
router.delete('/contacts/bulk', deleteMultipleContacts);
router.get('/contacts/export', exportContacts);

// Contact history and activities
router.get('/contacts/:id/history', getContactHistory);
router.get('/contacts/:id/activities', getContactActivities);

// Contact tags
router.get('/contacts/:id/tags', getContactTags);
router.post('/contacts/:id/tags', addContactTags);
router.delete('/contacts/:id/tags', removeContactTags);

// Contact notes
router.get('/contacts/:id/notes', getContactNotes);
router.post('/contacts/:id/notes', addContactNote);
router.put('/contacts/:id/notes/:noteId', updateContactNote);
router.delete('/contacts/:id/notes/:noteId', deleteContactNote);

// Contact custom fields
router.get('/contacts/:id/custom-fields', getContactCustomFields);
router.put('/contacts/:id/custom-fields', updateContactCustomFields);

// Contact relationships
router.get('/contacts/:id/relationships', getContactRelationships);
router.post('/contacts/:id/relationships', addContactRelationship);
router.delete('/contacts/:id/relationships/:relationshipId', removeContactRelationship);

// Company and Person routes
router.get('/company', getCompanyInfo);
router.get('/person', getPersonInfo);

// Usage statistics
router.get('/usage', getUsageStats);

export default router;
