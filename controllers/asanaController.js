import axios from 'axios';
import crypto from 'crypto';

// Constants
const ASANA_API_BASE_URL = 'https://app.asana.com/api/1.0';
const ASANA_AUTH_URL = 'https://app.asana.com/-/oauth_authorize';
const ASANA_TOKEN_URL = 'https://app.asana.com/-/oauth_token';

// Store for OAuth state and tokens (in production, use a proper database)
const oauthStateStore = new Map();
const oauthTokenStore = new Map();

// Create axios instance with default config
const asanaApi = axios.create({
  baseURL: ASANA_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for authentication
asanaApi.interceptors.request.use((config) => {
  const accessToken = req.headers.authorization?.split(' ')[1] || process.env.ASANA_ACCESS_TOKEN;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor for error handling
asanaApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorResponse = {
      status: error.response?.status || 500,
      message: error.response?.data?.errors?.[0]?.message || error.message,
      code: error.response?.data?.errors?.[0]?.code || 'UNKNOWN_ERROR',
      details: error.response?.data || {}
    };

    // Log error for debugging
    console.error('Asana API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: errorResponse.status,
      message: errorResponse.message,
      code: errorResponse.code
    });

    return Promise.reject(errorResponse);
  }
);

// Helper function for error responses
const errorResponse = (res, error) => {
  const status = error.status || 500;
  const message = error.message || 'Internal server error';
  const code = error.code || 'UNKNOWN_ERROR';

  res.status(status).json({
    status: false,
    error: {
      message,
      code,
      details: error.details || {}
    }
  });
};

// Helper function for success responses
const successResponse = (res, data, status = 200) => {
  res.status(status).json({
    status: true,
    data
  });
};

/**
 * Generate a secure random state parameter for OAuth
 */
const generateState = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Get the authorization URL for Asana OAuth
 */
export const getAuthUrl = (req, res) => {
  try {
    const { platform = 'web' } = req.query;
    
    // Generate and store state
    const state = generateState();
    oauthStateStore.set(state, {
      platform,
      timestamp: Date.now()
    });

    // Configure OAuth parameters
    const params = new URLSearchParams({
      client_id: process.env.ASANA_CLIENT_ID,
      redirect_uri: process.env.ASANA_REDIRECT_URI,
      response_type: 'code',
      state,
      scope: 'default'
    });

    const authUrl = `${ASANA_AUTH_URL}?${params.toString()}`;

    successResponse(res, {
      authUrl,
      state
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Handle OAuth callback from Asana
 */
export const handleOAuthCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // Check for OAuth errors
    if (error) {
      throw {
        status: 400,
        message: `Asana OAuth error: ${error}`,
        code: 'OAUTH_ERROR'
      };
    }

    // Validate state
    const stateData = oauthStateStore.get(state);
    if (!stateData) {
      throw {
        status: 400,
        message: 'Invalid state parameter',
        code: 'INVALID_STATE'
      };
    }

    // Clean up state
    oauthStateStore.delete(state);

    // Exchange code for tokens
    const tokenResponse = await axios.post(ASANA_TOKEN_URL, null, {
      params: {
        grant_type: 'authorization_code',
        client_id: process.env.ASANA_CLIENT_ID,
        client_secret: process.env.ASANA_CLIENT_SECRET,
        redirect_uri: process.env.ASANA_REDIRECT_URI,
        code
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, refresh_token, expires_in, data } = tokenResponse.data;

    // Get user information
    const userResponse = await axios.get(`${ASANA_API_BASE_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const userId = userResponse.data.data.gid;

    // Store tokens securely
    oauthTokenStore.set(userId, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (expires_in * 1000),
      userData: userResponse.data.data
    });

    // Handle response based on platform
    if (stateData.platform === 'android') {
      return successResponse(res, {
        access_token,
        refresh_token,
        expires_in,
        user: userResponse.data.data
      });
    }

    // For web platform, redirect to frontend
    const frontendUrl = `${process.env.FRONTEND_URL}/auth/asana?access_token=${access_token}&refresh_token=${refresh_token}&expires_in=${expires_in}&user_id=${userId}`;
    return res.redirect(frontendUrl);

  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      throw {
        status: 400,
        message: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      };
    }

    const response = await axios.post(ASANA_TOKEN_URL, null, {
      params: {
        grant_type: 'refresh_token',
        client_id: process.env.ASANA_CLIENT_ID,
        client_secret: process.env.ASANA_CLIENT_SECRET,
        refresh_token
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, refresh_token: new_refresh_token, expires_in } = response.data;

    successResponse(res, {
      access_token,
      refresh_token: new_refresh_token,
      expires_in
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get token information
 */
export const getTokenInfo = async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.id;

    if (!userId) {
      throw {
        status: 400,
        message: 'User ID is required',
        code: 'MISSING_USER_ID'
      };
    }

    const tokenData = oauthTokenStore.get(userId);

    if (!tokenData) {
      throw {
        status: 404,
        message: 'No token found for this user',
        code: 'TOKEN_NOT_FOUND'
      };
    }

    successResponse(res, {
      accessToken: tokenData.accessToken,
      expiresAt: tokenData.expiresAt,
      userData: tokenData.userData
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Revoke access token
 */
export const revokeAccess = async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.id;

    if (!userId) {
      throw {
        status: 400,
        message: 'User ID is required',
        code: 'MISSING_USER_ID'
      };
    }

    const tokenData = oauthTokenStore.get(userId);

    if (!tokenData) {
      throw {
        status: 404,
        message: 'No token found for this user',
        code: 'TOKEN_NOT_FOUND'
      };
    }

    // Revoke token with Asana
    await axios.post(`${ASANA_API_BASE_URL}/oauth/revoke`, null, {
      params: {
        token: tokenData.accessToken
      },
      headers: {
        'Authorization': `Bearer ${tokenData.accessToken}`
      }
    });

    // Remove token from store
    oauthTokenStore.delete(userId);

    successResponse(res, {
      message: 'Access revoked successfully'
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get Access Token
 */
export const getToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || process.env.ASANA_ACCESS_TOKEN;
    if (!token) {
      throw {
        status: 401,
        message: 'No access token provided',
        code: 'MISSING_TOKEN'
      };
    }
    successResponse(res, { token });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Create a Task
 */
export const createTask = async (req, res) => {
  try {
    const { workspace, projects, name, notes, assignee, due_on, due_at, parent, memberships } = req.body;

    if (!workspace || !projects || !name) {
      throw {
        status: 400,
        message: 'Missing required fields: workspace, projects, name',
        code: 'MISSING_REQUIRED_FIELDS'
      };
    }

    const projectsArray = Array.isArray(projects) ? projects : [projects];

    const response = await asanaApi.post('/tasks', {
      data: {
        workspace,
        projects: projectsArray,
        name,
        notes,
        assignee,
        due_on,
        due_at,
        parent,
        memberships
      }
    });

    successResponse(res, response.data.data, 201);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get All Tasks with Pagination and Filtering
 */
export const getAllTasks = async (req, res) => {
  try {
    const {
      workspace,
      assignee,
      project,
      section,
      completed_since,
      limit = 100,
      offset,
      opt_fields,
      opt_pretty
    } = req.query;

    if (!workspace && !project) {
      throw {
        status: 400,
        message: 'Missing required query parameters: workspace or project',
        code: 'MISSING_REQUIRED_PARAMS'
      };
    }

    const params = {
      limit,
      offset,
      opt_fields,
      opt_pretty
    };

    if (workspace) params.workspace = workspace;
    if (assignee) params.assignee = assignee;
    if (project) params.project = project;
    if (section) params.section = section;
    if (completed_since) params.completed_since = completed_since;

    const response = await asanaApi.get('/tasks', { params });

    successResponse(res, {
      data: response.data.data,
      total: response.data.data.length,
      next: response.data.next_page?.offset || null
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get a Single Task with Expanded Fields
 */
export const getTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { opt_fields, opt_pretty } = req.query;

    const response = await asanaApi.get(`/tasks/${id}`, {
      params: { opt_fields, opt_pretty }
    });

    successResponse(res, response.data.data);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Update a Task
 */
export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      notes,
      completed,
      assignee,
      due_on,
      due_at,
      parent,
      memberships,
      workspace
    } = req.body;

    if (!name && !notes && completed === undefined && !assignee && !due_on && !due_at && !parent && !memberships && !workspace) {
      throw {
        status: 400,
        message: 'At least one field is required for update',
        code: 'MISSING_UPDATE_FIELDS'
      };
    }

    const response = await asanaApi.put(`/tasks/${id}`, {
      data: {
        name,
        notes,
        completed,
        assignee,
        due_on,
        due_at,
        parent,
        memberships,
        workspace
      }
    });

    successResponse(res, response.data.data);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Delete a Task
 */
export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    await asanaApi.delete(`/tasks/${id}`);

    successResponse(res, null, 204);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Create a Project
 */
export const createProject = async (req, res) => {
  try {
    const {
      workspace,
      team,
      name,
      notes,
      color,
      default_view,
      due_date,
      start_on,
      owner,
      public: isPublic
    } = req.body;

    if (!workspace || !name) {
      throw {
        status: 400,
        message: 'Missing required fields: workspace, name',
        code: 'MISSING_REQUIRED_FIELDS'
      };
    }

    const response = await asanaApi.post('/projects', {
      data: {
        workspace,
        team,
        name,
        notes,
        color,
        default_view,
        due_date,
        start_on,
        owner,
        public: isPublic
      }
    });

    successResponse(res, response.data.data, 201);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get All Projects with Filtering
 */
export const getAllProjects = async (req, res) => {
  try {
    const {
      workspace,
      team,
      archived,
      limit = 100,
      offset,
      opt_fields,
      opt_pretty
    } = req.query;

    if (!workspace) {
      throw {
        status: 400,
        message: 'Missing required query parameter: workspace',
        code: 'MISSING_REQUIRED_PARAMS'
      };
    }

    const params = {
      workspace,
      team,
      archived,
      limit,
      offset,
      opt_fields,
      opt_pretty
    };

    const response = await asanaApi.get('/projects', { params });

    successResponse(res, {
      data: response.data.data,
      total: response.data.data.length,
      next: response.data.next_page?.offset || null
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Update a Project
 */
export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      notes,
      color,
      default_view,
      due_date,
      start_on,
      owner,
      public: isPublic,
      archived
    } = req.body;

    if (!name && !notes && !color && !default_view && !due_date && !start_on && !owner && isPublic === undefined && archived === undefined) {
      throw {
        status: 400,
        message: 'At least one field is required for update',
        code: 'MISSING_UPDATE_FIELDS'
      };
    }

    const response = await asanaApi.put(`/projects/${id}`, {
      data: {
        name,
        notes,
        color,
        default_view,
        due_date,
        start_on,
        owner,
        public: isPublic,
        archived
      }
    });

    successResponse(res, response.data.data);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Delete a Project
 */
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    await asanaApi.delete(`/projects/${id}`);

    successResponse(res, null, 204);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Create a Section
 */
export const createSection = async (req, res) => {
  try {
    const { project, name } = req.body;

    if (!project || !name) {
      throw {
        status: 400,
        message: 'Missing required fields: project, name',
        code: 'MISSING_REQUIRED_FIELDS'
      };
    }

    const response = await asanaApi.post(`/projects/${project}/sections`, {
      data: { name }
    });

    successResponse(res, response.data.data, 201);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get All Sections for a Project
 */
export const getAllSections = async (req, res) => {
  try {
    const { project } = req.query;

    if (!project) {
      throw {
        status: 400,
        message: 'Missing required query parameter: project',
        code: 'MISSING_REQUIRED_PARAMS'
      };
    }

    const response = await asanaApi.get(`/projects/${project}/sections`);

    successResponse(res, {
      data: response.data.data,
      total: response.data.data.length
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Update a Section
 */
export const updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      throw {
        status: 400,
        message: 'Missing required field: name',
        code: 'MISSING_REQUIRED_FIELDS'
      };
    }

    const response = await asanaApi.put(`/sections/${id}`, {
      data: { name }
    });

    successResponse(res, response.data.data);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Delete a Section
 */
export const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;

    await asanaApi.delete(`/sections/${id}`);

    successResponse(res, null, 204);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Create a Team
 */
export const createTeam = async (req, res) => {
  try {
    const { organization, name, description } = req.body;

    if (!organization || !name) {
      throw {
        status: 400,
        message: 'Missing required fields: organization, name',
        code: 'MISSING_REQUIRED_FIELDS'
      };
    }

    const response = await asanaApi.post('/teams', {
      data: {
        organization,
        name,
        description
      }
    });

    successResponse(res, response.data.data, 201);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get All Teams
 */
export const getAllTeams = async (req, res) => {
  try {
    const {
      organization,
      limit = 100,
      offset,
      opt_fields,
      opt_pretty
    } = req.query;

    if (!organization) {
      throw {
        status: 400,
        message: 'Missing required query parameter: organization',
        code: 'MISSING_REQUIRED_PARAMS'
      };
    }

    const params = {
      organization,
      limit,
      offset,
      opt_fields,
      opt_pretty
    };

    const response = await asanaApi.get('/teams', { params });

    successResponse(res, {
      data: response.data.data,
      total: response.data.data.length,
      next: response.data.next_page?.offset || null
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Update a Team
 */
export const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name && !description) {
      throw {
        status: 400,
        message: 'At least one field is required for update',
        code: 'MISSING_UPDATE_FIELDS'
      };
    }

    const response = await asanaApi.put(`/teams/${id}`, {
      data: {
        name,
        description
      }
    });

    successResponse(res, response.data.data);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Delete a Team
 */
export const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;

    await asanaApi.delete(`/teams/${id}`);

    successResponse(res, null, 204);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Create a Workspace
 */
export const createWorkspace = async (req, res) => {
  try {
    const { name, is_organization } = req.body;

    if (!name) {
      throw {
        status: 400,
        message: 'Missing required field: name',
        code: 'MISSING_REQUIRED_FIELDS'
      };
    }

    const response = await asanaApi.post('/workspaces', {
      data: {
        name,
        is_organization
      }
    });

    successResponse(res, response.data.data, 201);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get All Workspaces
 */
export const getAllWorkspaces = async (req, res) => {
  try {
    const { opt_fields, opt_pretty } = req.query;

    const response = await asanaApi.get('/workspaces', {
      params: { opt_fields, opt_pretty }
    });

    successResponse(res, {
      data: response.data.data,
      total: response.data.data.length
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Update a Workspace
 */
export const updateWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_organization } = req.body;

    if (!name && is_organization === undefined) {
      throw {
        status: 400,
        message: 'At least one field is required for update',
        code: 'MISSING_UPDATE_FIELDS'
      };
    }

    const response = await asanaApi.put(`/workspaces/${id}`, {
      data: {
        name,
        is_organization
      }
    });

    successResponse(res, response.data.data);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Delete a Workspace
 */
export const deleteWorkspace = async (req, res) => {
  try {
    const { id } = req.params;

    await asanaApi.delete(`/workspaces/${id}`);

    successResponse(res, null, 204);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Create Multiple Resources
 */
export const createMultipleResources = async (req, res) => {
  try {
    const { project, task, team, section } = req.body;
    const results = {};

    // Get existing workspaces first
    const workspacesResponse = await asanaApi.get('/workspaces');
    const defaultWorkspace = workspacesResponse.data.data[0]?.gid;

    if (!defaultWorkspace) {
      throw {
        status: 400,
        message: 'No workspace found. Please ensure you have at least one workspace.',
        code: 'NO_WORKSPACE_FOUND'
      };
    }

    // Handle Team Creation
    if (team) {
      try {
        const teamsResponse = await asanaApi.get('/teams', {
          params: { organization: defaultWorkspace }
        });
        
        const existingTeam = teamsResponse.data.data.find(t => t.name === team.name);
        
        if (existingTeam) {
          results.team = existingTeam;
        } else {
          const teamResponse = await asanaApi.post('/teams', {
            data: {
              organization: defaultWorkspace,
              name: team.name,
              description: team.description || ''
            }
          });
          results.team = teamResponse.data.data;
        }
      } catch (error) {
        results.team = {
          error: error.message,
          code: error.code
        };
      }
    }

    // Handle Project Creation
    if (project) {
      try {
        const projectData = {
          workspace: defaultWorkspace,
          name: project.name,
          notes: project.notes || ''
        };

        if (results.team?.gid) {
          projectData.team = results.team.gid;
        }

        const projectResponse = await asanaApi.post('/projects', {
          data: projectData
        });
        results.project = projectResponse.data.data;
      } catch (error) {
        results.project = {
          error: error.message,
          code: error.code
        };
      }
    }

    // Handle Task Creation
    if (task) {
      try {
        const taskData = {
          workspace: defaultWorkspace,
          name: task.name,
          notes: task.notes || ''
        };

        if (results.project?.gid) {
          taskData.projects = [results.project.gid];
        } else if (task.project) {
          taskData.projects = [task.project];
        }

        const taskResponse = await asanaApi.post('/tasks', {
          data: taskData
        });
        results.task = taskResponse.data.data;
      } catch (error) {
        results.task = {
          error: error.message,
          code: error.code
        };
      }
    }

    // Handle Section Creation
    if (section && (results.project?.gid || section.project)) {
      try {
        const projectId = results.project?.gid || section.project;
        const sectionResponse = await asanaApi.post(`/projects/${projectId}/sections`, {
          data: {
            name: section.name
          }
        });
        results.section = sectionResponse.data.data;
      } catch (error) {
        results.section = {
          error: error.message,
          code: error.code
        };
      }
    }

    // Check if any resources were created successfully
    const successfulCreations = Object.values(results).filter(r => !r.error);
    if (successfulCreations.length === 0) {
      throw {
        status: 400,
        message: 'No resources were created successfully',
        code: 'NO_RESOURCES_CREATED',
        details: results
      };
    }

    successResponse(res, results, 201);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Create a User
 */
export const createUser = async (req, res) => {
  try {
    const { workspace, name, email } = req.body;

    if (!workspace || !name || !email) {
      throw {
        status: 400,
        message: 'Missing required fields: workspace, name, email',
        code: 'MISSING_REQUIRED_FIELDS'
      };
    }

    const response = await asanaApi.post('/users', {
      data: {
        workspace,
        name,
        email
      }
    });

    successResponse(res, response.data.data, 201);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get a Single User
 */
export const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { opt_fields, opt_pretty } = req.query;

    const response = await asanaApi.get(`/users/${id}`, {
      params: { opt_fields, opt_pretty }
    });

    successResponse(res, response.data.data);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get All Users
 */
export const getAllUsers = async (req, res) => {
  try {
    const {
      workspace,
      limit = 100,
      offset,
      opt_fields,
      opt_pretty
    } = req.query;

    if (!workspace) {
      throw {
        status: 400,
        message: 'Missing required query parameter: workspace',
        code: 'MISSING_REQUIRED_PARAMS'
      };
    }

    const params = {
      workspace,
      limit,
      offset,
      opt_fields,
      opt_pretty
    };

    const response = await asanaApi.get('/users', { params });

    successResponse(res, {
      data: response.data.data,
      total: response.data.data.length,
      next: response.data.next_page?.offset || null
    });
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Update a User
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    if (!name && !email) {
      throw {
        status: 400,
        message: 'At least one field is required for update',
        code: 'MISSING_UPDATE_FIELDS'
      };
    }

    const response = await asanaApi.put(`/users/${id}`, {
      data: {
        name,
        email
      }
    });

    successResponse(res, response.data.data);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Delete a User
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await asanaApi.delete(`/users/${id}`);

    successResponse(res, null, 204);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get a Single Workspace
 */
export const getWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const { opt_fields, opt_pretty } = req.query;

    const response = await asanaApi.get(`/workspaces/${id}`, {
      params: { opt_fields, opt_pretty }
    });

    successResponse(res, response.data.data);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get a Single Project
 */
export const getProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { opt_fields, opt_pretty } = req.query;

    const response = await asanaApi.get(`/projects/${id}`, {
      params: { opt_fields, opt_pretty }
    });

    successResponse(res, response.data.data);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get a Single Team
 */
export const getTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { opt_fields, opt_pretty } = req.query;

    const response = await asanaApi.get(`/teams/${id}`, {
      params: { opt_fields, opt_pretty }
    });

    successResponse(res, response.data.data);
  } catch (error) {
    errorResponse(res, error);
  }
};

/**
 * Get a Single Section
 */
export const getSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { opt_fields, opt_pretty } = req.query;

    const response = await asanaApi.get(`/sections/${id}`, {
      params: { opt_fields, opt_pretty }
    });

    successResponse(res, response.data.data);
  } catch (error) {
    errorResponse(res, error);
  }
};
