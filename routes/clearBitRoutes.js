import express from 'express';
import {
  enrichPersonByEmail,
  enrichCompanyByDomain,
  bulkEnrichCompanies,
  verifyEmail,
  getCompanyLogo,
  clearbitRateLimiter
} from '../controllers/clearBitController.js';

const router = express.Router();

// Apply rate limiting to all ClearBit routes
router.use(clearbitRateLimiter);

// Person enrichment routes
router.post('/person/enrich', enrichPersonByEmail);

// Company enrichment routes
router.post('/company/enrich', enrichCompanyByDomain);
router.post('/company/bulk-enrich', bulkEnrichCompanies);
router.get('/company/logo', getCompanyLogo);

// Email verification route
router.post('/email/verify', verifyEmail);

export default router;
