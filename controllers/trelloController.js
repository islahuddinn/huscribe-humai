import axios from 'axios';
import crypto from 'crypto'

// import { tokenStore } from './authController.js';

const trelloBaseUrl = 'https://api.trello.com/1';


import 'dotenv/config';
import qs from 'querystring';
 
// In-memory token store (use database in production)
// const tokenStore = {
//   accessToken: null
// };

// export const initiateOAuth = (req, res) => {
//   const authUrl = `https://trello.com/1/authorize?${qs.stringify({
//     response_type: 'token',
//     client_id: process.env.TRELLO_CLIENT_ID,
//     redirect_uri: process.env.TRELLO_CALLBACK_URL,
//     scope: 'read,write,account',
//     expiration: 'never',  
//     name: 'MyTrelloIntegration'
//   })}`;

//   res.redirect(authUrl);
// };

// export const handleCallback = (req, res) => {
//   res.send(`
//     <html>
//       <script type="module">
//         const token = new URLSearchParams(window.location.hash.substring(1)).get('token');
//         fetch('/auth/store-token', {
//           method: 'POST',
//           headers: {'Content-Type': 'application/json'},
//           body: JSON.stringify({ token })
//         }).then(() => window.close());
//       </script>
//     </html>
//   `);
// };

export const storeToken = (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'No token provided' });
  
  tokenStore.accessToken = token;
  res.json({ success: true });
};

export const getAccessToken = (req, res) => {
  if (!tokenStore.accessToken) {
    return res.status(404).json({ error: 'No token available' });
  }
  res.json({ token: tokenStore.accessToken });
};

///// O auth approach 2

// In-memory storage (use database in production)


// Configure logging
const log = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => process.env.DEBUG && console.log('[DEBUG]', ...args)
};

// Validate environment variables on startup
const validateEnv = () => {
  const requiredVars = ['TRELLO_CLIENT_ID', 'TRELLO_CLIENT_SECRET', 'TRELLO_CALLBACK_URL'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length) {
    log.error('Missing environment variables:', missing.join(', '));
    process.exit(1);
  }
};
validateEnv();

// State management with expiration (15 minutes)
const stateStore = new Map();

const generateState = () => {
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('hex');
  
  stateStore.set(state, {
    codeVerifier,
    createdAt: Date.now()
  });
  
  return state;
};

const validateState = (state) => {
  const stateData = stateStore.get(state);
  if (!stateData) return false;
  
  // Cleanup expired states
  stateStore.forEach((value, key) => {
    if (Date.now() - value.createdAt > 900000) {
      stateStore.delete(key);
    }
  });
  
  return !!stateData;
};

export const initiateOAuth = (req, res) => {
  try {    
    const authParams = {
      expiration: 'never',
      scope: 'read,write,account',
      response_type: 'token',
      name: 'Trello',
      key: process.env.TRELLO_API_KEY || process.env.TRELLO_CLIENT_ID,
      return_url: process.env.TRELLO_CALLBACK_URL,
    };

    const authUrl = `https://trello.com/1/authorize?${qs.stringify(authParams)}`;
    
    log.info('Generated authorization URL:', authUrl);
    log.info('Initiating authentication flow for API key:', process.env.TRELLO_API_KEY || process.env.TRELLO_CLIENT_ID);

    res.redirect(authUrl);
  } catch (error) {
    log.error('Initiation error:', error);
    res.status(500).json({ 
      error: 'Authentication initialization failed',
      details: error.message 
    });
  }
};

export const handleCallback = async (req, res) => {
  try {
    // For token-based auth, Trello will redirect with token in the fragment
    res.send(`
      <html>
        <body>
          <h3>Authorizing with Trello...</h3>
          <script>
            // Extract token from URL fragment
            const token = new URLSearchParams(window.location.hash.substring(1)).get('token');
            if (token) {
              document.body.innerHTML = '<h3>Authorization successful!</h3><p>Token: ' + token + '</p>';
              // In a real app, you'd send this token to your backend
            } else {
              document.body.innerHTML = '<h3>Error: No token received from Trello</h3>';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    log.error('Callback error:', error);
    res.status(500).send(`<html><body><h3>Authorization Error</h3><p>${error.message}</p></body></html>`);
  }
};

export const refreshToken = async (req, res) => {
  const { refresh_token } = req.body;
  
  try {
    const response = await axios.post(
      'https://trello.com/1/OAuthGetAccessToken',
      qs.stringify({
        client_id: process.env.TRELLO_CLIENT_ID,
        client_secret: process.env.TRELLO_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    
    res.json(response.data);
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const getUserInfo = async (req, res) => {
  try {
    const response = await axios.get(
      'https://api.trello.com/1/members/me',
      { params: { access_token: req.query.access_token } }
    );
    res.json(response.data);
  } catch (error) {
    res.status(401).json({ error: 'Invalid access token' });
  }
};

const trelloApi = axios.create({
  baseURL: trelloBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

trelloApi.interceptors.request.use((config) => {
  const apiKey = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (apiKey && token) {
    config.params = {
      ...config.params,
      key: apiKey,
      token,
    };
  }
  return config;
});

/////=== Get Access Token
export const getToken = async (req, res) => {
  try {
    const token = process.env.TRELLO_TOKEN;
    res.status(200).json({
      status: 200,
      success: true,
      data: { token },
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      success: false,
      message: error.message,
    });
  }
};


/////==== Get All Boards (with pagination)
export const getAllBoards = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const response = await trelloApi.get('/members/me/boards', {
      params: {
        page,
        limit,
      },
    });

    res.status(200).json({
      status: 200,
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error('Error fetching boards:', error.response?.data || error.message);
    res.status(500).json({
      status: 500,
      success: false,
      message: error.response?.data?.message || error.message,
    });
  }
};

/////==== Get a Single Board by ID
export const getBoardById = async (req, res) => {
  try {
    const { id } = req.params;

    const response = await trelloApi.get(`/boards/${id}`);

    res.status(200).json({
      status: 200,
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error('Error fetching board:', error.response?.data || error.message);
    res.status(500).json({
      status: 500,
      success: false,
      message: error.response?.data?.message || error.message,
    });
  }
};

/////==== Update a Board
export const updateBoard = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, desc } = req.body;

    if (!name && !desc) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'At least one field (name or desc) is required',
      });
    }

    const response = await trelloApi.put(`/boards/${id}`, null, {
      params: {
        name,
        desc,
      },
    });

    res.status(200).json({
      status: 200,
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error('Error updating board:', error.response?.data || error.message);
    res.status(500).json({
      status: 500,
      success: false,
      message: error.response?.data?.message || error.message,
    });
  }
};

/////==== Delete a Board
export const deleteBoard = async (req, res) => {
  try {
    const { id } = req.params;

    await trelloApi.delete(`/boards/${id}`);

    res.status(204).json({
      status: 204,
      success: true,
      message: 'Board deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting board:', error.response?.data || error.message);
    res.status(500).json({
      status: 500,
      success: false,
      message: error.response?.data?.message || error.message,
    });
  }
};

const makeTrelloRequest = async (method, endpoint, data = {}) => {
  try {
    const response = await axios({
      method,
      url: `${trelloBaseUrl}${endpoint}`,
      params: {
        key: process.env.TRELLO_CLIENT_ID,
        token: tokenStore.accessToken,
        ...data
      },
      data: method !== 'get' ? data : {}
    });
    return response.data;
  } catch (error) {
    throw new Error(`Trello API Error: ${error.response?.data || error.message}`);
  }
};

///////=====Create Board
export const createBoard = async (req, res) => {
  try {
    const { name, defaultLists = true } = req.body;
    const board = await makeTrelloRequest('post', '/boards', {
      name,
      defaultLists
    });
    res.json(board);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getBoard = async (req, res) => {
  try {
    const { boardId } = req.params;
    const board = await makeTrelloRequest('get', `/boards/${boardId}`);
    res.json(board);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//////=====Create List
export const createList = async (req, res) => {
  try {
    const { boardId, name } = req.body;
    const list = await makeTrelloRequest('post', '/lists', {
      idBoard: boardId,
      name
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getListsOnBoard = async (req, res) => {
  try {
    const { boardId } = req.params;
    const lists = await makeTrelloRequest('get', `/boards/${boardId}/lists`);
    res.json(lists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

///////====Create Card
export const createCard = async (req, res) => {
  try {
    const { listId, name, desc } = req.body;
    const card = await makeTrelloRequest('post', '/cards', {
      idList: listId,
      name,
      desc
    });
    res.json(card);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateCard = async (req, res) => {
  try {
    const { cardId } = req.params;
    const updates = req.body;
    const card = await makeTrelloRequest('put', `/cards/${cardId}`, updates);
    res.json(card);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCard = async (req, res) => {
  try {
    const { cardId } = req.params;
    await makeTrelloRequest('delete', `/cards/${cardId}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Advanced Operations
export const addCommentToCard = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { text } = req.body;
    const comment = await makeTrelloRequest('post', `/cards/${cardId}/actions/comments`, { text });
    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getBoardCards = async (req, res) => {
  try {
    const { boardId } = req.params;
    const cards = await makeTrelloRequest('get', `/boards/${boardId}/cards`);
    res.json(cards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getListCards = async (req, res) => {
  try {
    const { listId } = req.params;
    const cards = await makeTrelloRequest('get', `/lists/${listId}/cards`);
    res.json(cards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getApiKey = async (req, res) => {
  try {
    const apiKey = process.env.TRELLO_API_KEY || process.env.TRELLO_CLIENT_ID;
    
    if (!apiKey) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Trello API key not configured',
      });
    }
    
    res.status(200).json({
      status: 200,
      success: true,
      key: apiKey,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      success: false,
      message: error.message,
    });
  }
};

/**
 * Create multiple Trello objects (boards, lists, cards) in a single request
 * Allows users to create any combination of boards, lists, and cards
 * 
 * Request body format:
 * {
 *   "boards": [
 *     { "name": "Board 1", "defaultLists": true },
 *     { "name": "Board 2", "defaultLists": false }
 *   ],
 *   "lists": [
 *     { "boardId": "board_id_1", "name": "List 1" },
 *     { "boardId": "board_id_2", "name": "List 2" }
 *   ],
 *   "cards": [
 *     { "listId": "list_id_1", "name": "Card 1", "desc": "Description" },
 *     { "listId": "list_id_2", "name": "Card 2", "desc": "Description" }
 *   ]
 * }
 */
export const createTrelloObjects = async (req, res) => {
  try {
    const { boards = [], lists = [], cards = [] } = req.body;
    const results = {
      boards: [],
      lists: [],
      cards: [],
      errors: []
    };

    // Create boards if provided
    if (boards.length > 0) {
      for (const board of boards) {
        try {
          const { name, defaultLists = true } = board;
          if (!name) {
            results.errors.push({ type: 'board', error: 'Board name is required' });
            continue;
          }
          
          const createdBoard = await makeTrelloRequest('post', '/boards', {
            name,
            defaultLists
          });
          
          results.boards.push(createdBoard);
        } catch (error) {
          results.errors.push({ type: 'board', error: error.message });
        }
      }
    }

    // Create lists if provided
    if (lists.length > 0) {
      for (const list of lists) {
        try {
          const { boardId, name } = list;
          if (!boardId || !name) {
            results.errors.push({ type: 'list', error: 'Board ID and list name are required' });
            continue;
          }
          
          const createdList = await makeTrelloRequest('post', '/lists', {
            idBoard: boardId,
            name
          });
          
          results.lists.push(createdList);
        } catch (error) {
          results.errors.push({ type: 'list', error: error.message });
        }
      }
    }

    // Create cards if provided
    if (cards.length > 0) {
      for (const card of cards) {
        try {
          const { listId, name, desc = '' } = card;
          if (!listId || !name) {
            results.errors.push({ type: 'card', error: 'List ID and card name are required' });
            continue;
          }
          
          const createdCard = await makeTrelloRequest('post', '/cards', {
            idList: listId,
            name,
            desc
          });
          
          results.cards.push(createdCard);
        } catch (error) {
          results.errors.push({ type: 'card', error: error.message });
        }
      }
    }

    // Check if any objects were created successfully
    const hasSuccess = results.boards.length > 0 || results.lists.length > 0 || results.cards.length > 0;
    
    if (!hasSuccess && results.errors.length > 0) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Failed to create any Trello objects',
        errors: results.errors
      });
    }

    // Return success response with created objects and any errors
    res.status(201).json({
      status: 201,
      success: true,
      message: 'Trello objects created successfully',
      data: {
        boards: results.boards,
        lists: results.lists,
        cards: results.cards
      },
      errors: results.errors.length > 0 ? results.errors : undefined
    });
  } catch (error) {
    console.error('Error creating Trello objects:', error);
    res.status(500).json({
      status: 500,
      success: false,
      message: error.message || 'Failed to create Trello objects'
    });
  }
};