import axios from 'axios';
import { refreshAccessToken, handleZohoApiError } from '../utils/zohoUtils.js';

// Enhanced Zoho authentication middleware
export const zohoAuthMiddleware = async (req, res, next) => {
  try {
    console.log('=== Zoho Auth Middleware ===');
    
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: false,
        crmType: 'zoho',
        error: 'Access token is missing or invalid',
        code: 'MISSING_ACCESS_TOKEN',
        solution: 'Provide a valid access token in the Authorization header: Bearer <token>'
      });
    }
    
    const accessToken = authHeader.split(' ')[1];
    console.log('Access token found:', accessToken.substring(0, 10) + '...');
    
    // Test the token with a lightweight API call
    try {
      const testResponse = await axios.get('https://www.zohoapis.com/crm/v2/settings/modules', {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log('Token validation successful');
      
      // Store token info in request for later use
      req.zohoToken = {
        access_token: accessToken,
        validated: true,
        modules_count: testResponse.data.modules?.length || 0
      };
      
      // Token is valid, continue with the request
      next();
      
    } catch (tokenError) {
      console.log('Token validation failed:', tokenError.response?.status);
      
      if (tokenError.response?.status === 401) {
        // Token is invalid/expired, try to refresh if refresh token is provided
        const refreshToken = req.headers['x-zoho-refresh-token'] || 
                            req.headers['x-refresh-token'] ||
                            req.body?.refresh_token ||
                            req.query?.refresh_token;
        
        if (refreshToken) {
          try {
            console.log('Attempting automatic token refresh...');
            const newTokenData = await refreshAccessToken(refreshToken);
            
            // Set the new token in the response headers
            res.setHeader('X-New-Access-Token', newTokenData.access_token);
            res.setHeader('X-Token-Refreshed', 'true');
            res.setHeader('X-Token-Expires-In', newTokenData.expires_in);
            
            // Update the request headers for this request
            req.headers['authorization'] = `Bearer ${newTokenData.access_token}`;
            
            // Store new token info in request
            req.zohoToken = {
              access_token: newTokenData.access_token,
              validated: true,
              refreshed: true,
              expires_in: newTokenData.expires_in
            };
            
            console.log('Token refreshed successfully, continuing with request');
            next();
            
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError.message);
            return res.status(401).json({
              status: false,
              crmType: 'zoho',
              error: 'Token expired and refresh failed',
              code: 'TOKEN_REFRESH_FAILED',
              details: refreshError.message,
              solution: 'Re-authenticate the user: GET /api/zoho/auth/url?platform=web'
            });
          }
        } else {
          return res.status(401).json({
            status: false,
            crmType: 'zoho',
            error: 'Access token is invalid or expired',
            code: 'INVALID_ACCESS_TOKEN',
            solution: 'Provide a refresh token in x-zoho-refresh-token header or use POST /api/zoho/auth/refresh'
          });
        }
      } else {
        // Other error, use enhanced error handling
        return handleZohoApiError(tokenError, res, 'token validation');
      }
    }
    
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(500).json({
      status: false,
      crmType: 'zoho',
      error: 'Authentication middleware failed',
      code: 'AUTH_MIDDLEWARE_ERROR',
      details: error.message
    });
  }
};

// Optional middleware for endpoints that don't require authentication
export const optionalZohoAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided, continue without authentication
    req.zohoToken = null;
    return next();
  }
  
  // Token provided, validate it
  return zohoAuthMiddleware(req, res, next);
};

// Legacy support - keep the old function name
export const protect = zohoAuthMiddleware; 