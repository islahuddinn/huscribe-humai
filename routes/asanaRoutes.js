import express from 'express';
import {
  getToken,
  createTask,
  getTask,
  updateTask,
  deleteTask,
  getAllTasks,
  createProject,
  getAllProjects,
  getProject,
  updateProject,
  deleteProject,
  createTeam,
  getAllTeams,
  getTeam,
  updateTeam,
  deleteTeam,
  createWorkspace,
  getAllWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  createUser,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  createSection,
  getAllSections,
  getSection,
  updateSection,
  deleteSection,
  createMultipleResources,
  getAuthUrl,
  handleOAuthCallback,
  refreshAccessToken,
  getTokenInfo,
  revokeAccess
} from '../controllers/asanaController.js';

const router = express.Router();

////---Auth
router.post('/access-token', getToken);

/////----OAuth Routes
router.get('/oauth/auth', getAuthUrl);
router.get('/oauth/callback', handleOAuthCallback);
router.post('/oauth/refresh', refreshAccessToken);
router.get('/oauth/token-info', getTokenInfo);
router.post('/oauth/revoke', revokeAccess);

/////----projects
router.post('/projects/create', createProject);
router.get('/projects', getAllProjects);
router.get('/projects/:id', getProject);
router.put('/projects/:id', updateProject);
router.delete('/projects/:id', deleteProject);

//////--- Task
router.post('/tasks/create', createTask);
router.get('/tasks', getAllTasks);
router.get('/tasks/:id', getTask);
router.put('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);

////-----teams
router.post('/teams/create', createTeam);
router.get('/teams', getAllTeams);
router.get('/teams/:id', getTeam);
router.put('/teams/:id', updateTeam);
router.delete('/teams/:id', deleteTeam);

////-----workspace
router.post('/workspaces/create', createWorkspace);
router.get('/workspaces', getAllWorkspaces);
router.get('/workspaces/:id', getWorkspace);
router.put('/workspaces/:id', updateWorkspace);
router.delete('/workspaces/:id', deleteWorkspace);

////----users
router.post('/users/create', createUser);
router.get('/users', getAllUsers);
router.get('/users/:id', getUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

////----sections
router.post('/sections/create', createSection);
router.get('/sections', getAllSections);
router.get('/sections/:id', getSection);
router.put('/sections/:id', updateSection);
router.delete('/sections/:id', deleteSection);

router.post('/create-multiple', createMultipleResources);

export default router;