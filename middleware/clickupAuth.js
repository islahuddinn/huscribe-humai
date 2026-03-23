import axios from 'axios';

export const validateClickUpToken = async (req, res, next) => {
    const requestId = Date.now().toString();
    const accessToken = req.headers.authorization;

    if (!accessToken) {
        return res.status(401).json({
            error: 'Access token is required',
            requestId
        });
    }

    try {
        // Verify token by making a simple API call
        await axios.get('https://api.clickup.com/api/v2/user', {
            headers: {
                'Authorization': accessToken
            }
        });

        // Add token to request for use in controllers
        req.clickupToken = accessToken;
        next();
    } catch (error) {
        console.error(`[${requestId}] Token validation error:`, error.message);
        
        if (error.response?.status === 401) {
            return res.status(401).json({
                error: 'Invalid or expired access token',
                requestId
            });
        }

        return res.status(500).json({
            error: 'Failed to validate access token',
            details: error.message,
            requestId
        });
    }
}; 

// export const validateClickUpToken = async (req) => {
//     try {
//         // First try to get token from authorization header
//     const authHeader = req.headers.authorization;
//         if (authHeader && authHeader.startsWith('Bearer ')) {
//             const token = authHeader.substring(7);
//             return token;
//         }

//         // Then try to get from query parameters
//         const tokenFromQuery = req.query.access_token;
//         if (tokenFromQuery) {
//             return tokenFromQuery;
//         }

//         // Finally try to get from body
//         const tokenFromBody = req.body.access_token;
//         if (tokenFromBody) {
//             return tokenFromBody;
//         }

//         // If no token found, try to get from oauthTokenStore using portal ID
//         const portalId = req.query.portalId || req.body.portalId;
//         if (portalId) {
//             const tokenData = oauthTokenStore.get(portalId.toString());
//             if (tokenData) {
//                 // Check if token needs refresh
//                 if (tokenData.expiresAt <= Date.now()) {
//                     try {
//                         const newTokens = await refreshOAuthToken(tokenData.refreshToken);
//                         oauthTokenStore.set(portalId.toString(), {
//                             ...tokenData,
//                             accessToken: newTokens.access_token,
//                             refreshToken: newTokens.refresh_token,
//                             expiresAt: Date.now() + (newTokens.expires_in * 1000)
//                         });
//                         return newTokens.access_token;
//                     } catch (error) {
//                         console.error('Error refreshing token:', error);
//                         throw { 
//                             status: 401, 
//                             message: 'Token expired and refresh failed. Please re-authenticate.' 
//                         };
//                     }
//                 }
//                 return tokenData.accessToken;
//             }
//         }

//         // If no token found anywhere, throw error
//         throw { 
//             status: 401, 
//             message: 'No access token found. Please authenticate with HubSpot first.' 
//         };
//     } catch (error) {
//         console.error('Error in getAccessToken:', error.message);
//         throw error;
//     }
// };