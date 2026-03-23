import express from 'express';
import {
    testApiKey,
    searchOrganizations,
    searchPeople,
    enrichOrganization,
    verifyEmail,
    enrichPerson,
    getPersonById,
    getContactInfo,
    getAccountInfo,
    createSequence,
    getSequenceDetails,
    bulkEnrichOrganizations,
    getAuthorizationUrl,
    handleCallback,
    refreshAccessToken,
    revokeAccessToken,
    validateAccessToken
} from '../controllers/appolloController.js';

const router = express.Router();

// OAuth routes
router.get('/oauth/authorize', getAuthorizationUrl);
router.get('/oauth/callback', handleCallback);
router.post('/oauth/refresh', refreshAccessToken);
router.post('/oauth/revoke', revokeAccessToken);

// API key and account routes
router.get('/test', testApiKey);
router.get('/account', getAccountInfo);

// Organization routes
router.post('/organizations/search', searchOrganizations);
router.post('/organizations/enrich', enrichOrganization);
router.post('/organizations/bulk-enrich', bulkEnrichOrganizations);

// People routes
router.post('/people/search', searchPeople);
router.post('/people/match', enrichPerson);
router.get('/people/:id', getPersonById);
router.get('/people/:person_id/contact', getContactInfo);

// Email routes
router.post('/emails/verify', verifyEmail);

// Sequence routes (outreach)
router.post('/sequences', createSequence);
router.get('/sequences/:id', getSequenceDetails);

export default router;
