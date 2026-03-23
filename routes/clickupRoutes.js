import express from 'express';
import {
    getAuthUrl,
    handleCallback,
    refreshAccessToken,
    revokeAccess,
    getUser,
    getTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    getTeamById,
    getSpaces,
    createSpace,
    updateSpace,
    deleteSpace,
    getSpaceById,
    getFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    getFolderById,
    getLists,
    createList,
    updateList,
    deleteList,
    getListById,
    getTasks,
    createTask,
    updateTask,
    deleteTask,
    getTasksByUsername,
    searchClickUp
} from '../controllers/clickupController.js';
import { validateClickUpToken } from '../middleware/clickupAuth.js';

const router = express.Router();

// OAuth routes
router.get('/auth', getAuthUrl);
router.get('/callback', handleCallback);
router.post('/refresh-token', refreshAccessToken);
router.post('/revoke', revokeAccess);

// User routes
router.get('/user', validateClickUpToken, getUser); //working   

// Team routes
router.get('/teams', validateClickUpToken, getTeams); //not working
router.get('/teams/:teamId', validateClickUpToken, getTeamById); //working
router.post('/teams/create', validateClickUpToken, createTeam); //not working
router.put('/teams/:teamId', validateClickUpToken, updateTeam); //not working
router.delete('/teams/:teamId', validateClickUpToken, deleteTeam);

// Space routes
router.get('/spaces', validateClickUpToken, getSpaces);
router.get('/spaces/:spaceId', validateClickUpToken, getSpaceById); //working
router.get('/teams/:teamId/spaces', validateClickUpToken, getSpaces); //working
router.post('/spaces/create', validateClickUpToken, createSpace); //not working
router.post('/teams/:teamId/spaces', validateClickUpToken, createSpace); // Add new route for creating space within team
router.put('/spaces/:spaceId', validateClickUpToken, updateSpace);
router.delete('/spaces/:spaceId', validateClickUpToken, deleteSpace);

// Folder routes
router.get('/folders', validateClickUpToken, getFolders);
router.get('/folders/:folderId', validateClickUpToken, getFolderById);
router.get('/spaces/:spaceId/folders', validateClickUpToken, getFolders);
router.post('/folders/create', validateClickUpToken, createFolder);
router.post('/spaces/:spaceId/folders', validateClickUpToken, createFolder); // Add new route for creating folder within space
router.put('/folders/:folderId', validateClickUpToken, updateFolder);
router.delete('/folders/:folderId', validateClickUpToken, deleteFolder);

// List routes
router.get('/lists', validateClickUpToken, getLists);
router.get('/lists/:listId', validateClickUpToken, getListById);
router.get('/folders/:folderId/lists', validateClickUpToken, getLists);
router.post('/lists/create', validateClickUpToken, createList);
router.post('/folders/:folderId/lists', validateClickUpToken, createList); // Add new route for creating list within folder
router.put('/lists/:listId', validateClickUpToken, updateList);
router.delete('/lists/:listId', validateClickUpToken, deleteList);

// Search route
router.get('/search', validateClickUpToken, searchClickUp);

// Task routes
router.get('/tasks', validateClickUpToken, getTasks);
router.get('/tasks/:taskId', validateClickUpToken, getTasks);
router.get('/lists/:listId/tasks', validateClickUpToken, getTasks);
router.get('/tasks/user/:username', validateClickUpToken, getTasksByUsername); // Add new route for getting tasks by username
router.post('/tasks/create', validateClickUpToken, createTask);
router.post('/lists/:listId/tasks', validateClickUpToken, createTask);
router.put('/tasks/:taskId', validateClickUpToken, updateTask);
router.delete('/tasks/:taskId', validateClickUpToken, deleteTask);

export default router;
