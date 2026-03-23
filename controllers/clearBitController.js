import axios from 'axios';
import asyncHandler from 'express-async-handler';
import rateLimit from 'express-rate-limit';

// Initialize ClearBit API client
const CLEARBIT_API_BASE_URL = 'https://person.clearbit.com/v2';

const clearbitApi = axios.create({
  baseURL: CLEARBIT_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add API key to all requests
clearbitApi.interceptors.request.use((config) => {
  const apiKey = process.env.CLEARBIT_API_KEY;
  if (!apiKey) {
    throw new Error('ClearBit API key is not configured');
  }
  config.headers['Authorization'] = `Bearer ${apiKey}`;
  return config;
});

// Rate limiting configuration
export const clearbitRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

// Enrich person data by email
export const enrichPersonByEmail = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'Email is required'
      });
    }

    const response = await clearbitApi.get(`/combined/find?email=${encodeURIComponent(email)}`);
    
    return res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Error enriching person:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: 'Person enrichment failed',
      message: error.response?.data?.error || error.message
    });
  }
});

// Enrich company data by domain
export const enrichCompanyByDomain = asyncHandler(async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'Domain is required'
      });
    }

    const response = await clearbitApi.get(`/companies/find?domain=${encodeURIComponent(domain)}`);
    
    return res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Error enriching company:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: 'Company enrichment failed',
      message: error.response?.data?.error || error.message
    });
  }
});

// Bulk enrich companies
export const bulkEnrichCompanies = asyncHandler(async (req, res) => {
  try {
    const { domains } = req.body;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'Array of domains is required'
      });
    }

    // ClearBit doesn't have a direct bulk endpoint, so we'll process sequentially
    const results = await Promise.all(
      domains.map(async (domain) => {
        try {
          const response = await clearbitApi.get(`/companies/find?domain=${encodeURIComponent(domain)}`);
          return { domain, success: true, data: response.data };
        } catch (error) {
          return { domain, success: false, error: error.response?.data || error.message };
        }
      })
    );

    return res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error in bulk company enrichment:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: 'Bulk company enrichment failed',
      message: error.response?.data?.error || error.message
    });
  }
});

// Verify email
export const verifyEmail = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'Email is required'
      });
    }

    const response = await clearbitApi.get(`/disposable?email=${encodeURIComponent(email)}`);
    
    return res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Error verifying email:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: 'Email verification failed',
      message: error.response?.data?.error || error.message
    });
  }
});

// Get company logo
export const getCompanyLogo = asyncHandler(async (req, res) => {
  try {
    const { domain } = req.query;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'Domain is required'
      });
    }

    const response = await clearbitApi.get(`/logos/find?domain=${encodeURIComponent(domain)}`);
    
    return res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Error fetching company logo:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch company logo',
      message: error.response?.data?.error || error.message
    });
  }
});
