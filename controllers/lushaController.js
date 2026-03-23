import axios from 'axios';
import asyncHandler from 'express-async-handler';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

// Mock data for testing
const mockContacts = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    company: 'Tech Corp',
    title: 'Software Engineer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    phone: '+1987654321',
    company: 'Innovate Inc',
    title: 'Product Manager',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Lusha API Configuration
const LUSHA_API_BASE_URL = 'https://api.lusha.com/v1';
const LUSHA_OAUTH_URL = 'https://api.lusha.com/oauth2';

// Initialize Lusha API client
const lushaApi = axios.create({
  baseURL: LUSHA_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// OAuth state management
const oauthStates = new Map();

// Generate secure random state
const generateState = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Add API key to all requests
lushaApi.interceptors.request.use((config) => {
  const accessToken = req.session?.lushaAccessToken;
  if (!accessToken) {
    console.warn('Lusha access token is not configured');
    return config;
  }
  config.headers['Authorization'] = `Bearer ${accessToken}`;
  return config;
});

// Error handling middleware
const handleLushaError = (error) => {
  if (error.response) {
    throw {
      status: error.response.status,
      message: error.response.data?.message || 'Lusha API error',
      details: error.response.data
    };
  } else if (error.request) {
    throw {
      status: 503,
      message: 'No response received from Lusha API',
      details: error.request
    };
  } else {
    throw {
      status: 500,
      message: 'Error setting up Lusha API request',
      details: error.message
    };
  }
};

// Rate limiting configuration
export const lushaRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later'
});

// OAuth Functions

// Initialize OAuth flow
export const initiateOAuth = asyncHandler(async (req, res) => {
  try {
    const state = generateState();
    const redirectUri = process.env.LUSHA_REDIRECT_URI;
    
    oauthStates.set(state, {
      timestamp: Date.now(),
      redirectUri
    });

    const authUrl = `${LUSHA_OAUTH_URL}/authorize?` + new URLSearchParams({
      client_id: process.env.LUSHA_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      scope: 'contacts:read contacts:write company:read person:read'
    });

    res.status(200).json({
      success: true,
      data: { authUrl }
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// OAuth callback handler
export const handleOAuthCallback = asyncHandler(async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      throw { status: 400, message: 'Missing required OAuth parameters' };
    }

    const stateData = oauthStates.get(state);
    if (!stateData) {
      throw { status: 400, message: 'Invalid state parameter' };
    }

    // Clean up used state
    oauthStates.delete(state);

    const tokenResponse = await axios.post(`${LUSHA_OAUTH_URL}/token`, {
      client_id: process.env.LUSHA_CLIENT_ID,
      client_secret: process.env.LUSHA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: stateData.redirectUri
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Store tokens securely (implement your secure storage solution)
    req.session.lushaAccessToken = access_token;
    req.session.lushaRefreshToken = refresh_token;
    req.session.lushaTokenExpiry = Date.now() + (expires_in * 1000);

    res.status(200).json({
      success: true,
      message: 'OAuth authentication successful'
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Refresh access token
export const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const refreshToken = req.session?.lushaRefreshToken;
    if (!refreshToken) {
      throw { status: 401, message: 'No refresh token available' };
    }

    const response = await axios.post(`${LUSHA_OAUTH_URL}/token`, {
      client_id: process.env.LUSHA_CLIENT_ID,
      client_secret: process.env.LUSHA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    const { access_token, refresh_token, expires_in } = response.data;

    req.session.lushaAccessToken = access_token;
    req.session.lushaRefreshToken = refresh_token;
    req.session.lushaTokenExpiry = Date.now() + (expires_in * 1000);

    res.status(200).json({
      success: true,
      message: 'Access token refreshed successfully'
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Enhanced Contact Operations

// Create a new contact
export const createContact = asyncHandler(async (req, res) => {
  try {
    const { firstName, lastName, email, phone, company, title } = req.body;
    
    if (!email && !phone) {
      throw { status: 400, message: 'Either email or phone is required' };
    }

    const response = await lushaApi.post('/contacts', {
      firstName,
      lastName,
      email,
      phone,
      company,
      title
    });

    res.status(201).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Get contact by ID
export const getContact = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const response = await lushaApi.get(`/contacts/${id}`);
    
    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Update contact
export const updateContact = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const response = await lushaApi.put(`/contacts/${id}`, updateData);

    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Delete contact
export const deleteContact = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    await lushaApi.delete(`/contacts/${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Search contacts with enhanced filtering
export const searchContacts = asyncHandler(async (req, res) => {
  try {
    const { 
      query, 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      filters = {}
    } = req.query;
    
    if (!query) {
      throw { status: 400, message: 'Search query is required' };
    }

    const response = await lushaApi.get('/contacts/search', {
      params: {
        q: query,
        page,
        limit,
        sort_by: sortBy,
        sort_order: sortOrder,
        ...filters
      }
    });

    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Get API usage statistics
export const getUsageStats = asyncHandler(async (req, res) => {
  try {
    const response = await lushaApi.get('/usage');
    
    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Additional Lusha Features

// Get company information
export const getCompanyInfo = asyncHandler(async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) {
      throw { status: 400, message: 'Company domain is required' };
    }

    const response = await lushaApi.get(`/company/${domain}`);
    
    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Get person information
export const getPersonInfo = asyncHandler(async (req, res) => {
  try {
    const { email, phone } = req.query;
    if (!email && !phone) {
      throw { status: 400, message: 'Either email or phone is required' };
    }

    const response = await lushaApi.get('/person', {
      params: { email, phone }
    });
    
    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Bulk contact operations
export const bulkCreateContacts = asyncHandler(async (req, res) => {
  try {
    const { contacts } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      throw { status: 400, message: 'Contacts array is required' };
    }

    const response = await lushaApi.post('/contacts/bulk', { contacts });
    
    res.status(201).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Export contacts
export const exportContacts = asyncHandler(async (req, res) => {
  try {
    const { format = 'json', filters = {} } = req.query;
    
    const response = await lushaApi.get('/contacts/export', {
      params: { format, ...filters },
      responseType: 'stream'
    });
    
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=contacts.${format}`);
    
    response.data.pipe(res);
  } catch (error) {
    handleLushaError(error);
  }
});

// Additional CRUD Operations

// Get all contacts with pagination and filtering
export const getAllContacts = asyncHandler(async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      filters = {}
    } = req.query;

    const response = await lushaApi.get('/contacts', {
      params: {
        page,
        limit,
        sort_by: sortBy,
        sort_order: sortOrder,
        ...filters
      }
    });

    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Update multiple contacts
export const updateMultipleContacts = asyncHandler(async (req, res) => {
  try {
    const { contacts } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      throw { status: 400, message: 'Contacts array is required' };
    }

    const response = await lushaApi.put('/contacts/bulk', { contacts });
    
    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Delete multiple contacts
export const deleteMultipleContacts = asyncHandler(async (req, res) => {
  try {
    const { contactIds } = req.body;
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      throw { status: 400, message: 'Contact IDs array is required' };
    }

    await lushaApi.delete('/contacts/bulk', { data: { contactIds } });
    
    res.status(200).json({
      success: true,
      message: 'Contacts deleted successfully'
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Get contact history
export const getContactHistory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const response = await lushaApi.get(`/contacts/${id}/history`);
    
    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Get contact activities
export const getContactActivities = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, type } = req.query;
    
    const response = await lushaApi.get(`/contacts/${id}/activities`, {
      params: { startDate, endDate, type }
    });
    
    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Get contact tags
export const getContactTags = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const response = await lushaApi.get(`/contacts/${id}/tags`);
    
    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Add tags to contact
export const addContactTags = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;
    
    if (!Array.isArray(tags) || tags.length === 0) {
      throw { status: 400, message: 'Tags array is required' };
    }

    const response = await lushaApi.post(`/contacts/${id}/tags`, { tags });
    
    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Remove tags from contact
export const removeContactTags = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;
    
    if (!Array.isArray(tags) || tags.length === 0) {
      throw { status: 400, message: 'Tags array is required' };
    }

    await lushaApi.delete(`/contacts/${id}/tags`, { data: { tags } });
    
    res.status(200).json({
      success: true,
      message: 'Tags removed successfully'
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Get contact notes
export const getContactNotes = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const response = await lushaApi.get(`/contacts/${id}/notes`);
    
    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Add note to contact
export const addContactNote = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content) {
      throw { status: 400, message: 'Note content is required' };
    }

    const response = await lushaApi.post(`/contacts/${id}/notes`, { content });
    
    res.status(201).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Update contact note
export const updateContactNote = asyncHandler(async (req, res) => {
  try {
    const { id, noteId } = req.params;
    const { content } = req.body;
    
    if (!content) {
      throw { status: 400, message: 'Note content is required' };
    }

    const response = await lushaApi.put(`/contacts/${id}/notes/${noteId}`, { content });
    
    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Delete contact note
export const deleteContactNote = asyncHandler(async (req, res) => {
  try {
    const { id, noteId } = req.params;
    await lushaApi.delete(`/contacts/${id}/notes/${noteId}`);
    
    res.status(200).json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Get contact custom fields
export const getContactCustomFields = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const response = await lushaApi.get(`/contacts/${id}/custom-fields`);
    
    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Update contact custom fields
export const updateContactCustomFields = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { customFields } = req.body;
    
    if (!customFields || typeof customFields !== 'object') {
      throw { status: 400, message: 'Custom fields object is required' };
    }

    const response = await lushaApi.put(`/contacts/${id}/custom-fields`, { customFields });
    
    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Get contact relationships
export const getContactRelationships = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const response = await lushaApi.get(`/contacts/${id}/relationships`);
    
    res.status(200).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Add contact relationship
export const addContactRelationship = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { relatedContactId, relationshipType } = req.body;
    
    if (!relatedContactId || !relationshipType) {
      throw { status: 400, message: 'Related contact ID and relationship type are required' };
    }

    const response = await lushaApi.post(`/contacts/${id}/relationships`, {
      relatedContactId,
      relationshipType
    });
    
    res.status(201).json({
      success: true,
      data: response.data
    });
  } catch (error) {
    handleLushaError(error);
  }
});

// Remove contact relationship
export const removeContactRelationship = asyncHandler(async (req, res) => {
  try {
    const { id, relationshipId } = req.params;
    await lushaApi.delete(`/contacts/${id}/relationships/${relationshipId}`);
    
    res.status(200).json({
      success: true,
      message: 'Relationship removed successfully'
    });
  } catch (error) {
    handleLushaError(error);
  }
});
