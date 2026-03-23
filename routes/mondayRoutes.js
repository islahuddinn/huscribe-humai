import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    authenticateMonday,
    getMondayCallback,
    getBoards,
    createBoard,
    updateBoard,
    deleteBoard,
    getItems,
    createItem,
    updateItem,
    deleteItem,
    getColumns,
    createColumn,
    updateColumn,
    deleteColumn,
    getGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    getUsers,
    getWorkspaces,
    performBatchOperations
} from '../controllers/mondayController.js';

const router = express.Router();

/////=== Auth routes
router.get('/auth', authenticateMonday);
router.get('/callback', getMondayCallback);

///===multiple objects create
router.post('/boards/multy-create', performBatchOperations);


/////=== Board routes
router.get('/boards', getBoards);
router.post('/boards/create', createBoard);
router.put('/boards/:id', updateBoard);
router.delete('/boards/:id',  deleteBoard);

////=== Item routes
router.get('/boards/:boardId/items', getItems);
router.post('/boards/:boardId/items', createItem);
router.put('/boards/:boardId/items/:itemId', protect, updateItem);
router.delete('/boards/:boardId/items/:itemId', protect, deleteItem);

////=== Column routes
router.get('/boards/:boardId/columns', protect, getColumns);
router.post('/boards/:boardId/columns', protect, createColumn);
router.put('/boards/:boardId/columns/:columnId', protect, updateColumn);
router.delete('/boards/:boardId/columns/:columnId', protect, deleteColumn);

////=== Group routes
router.get('/boards/:boardId/groups', protect, getGroups);
router.post('/boards/:boardId/groups', protect, createGroup);
router.put('/boards/:boardId/groups/:groupId', protect, updateGroup);
router.delete('/boards/:boardId/groups/:groupId', protect, deleteGroup);

////=== User routes
router.get('/users', protect, getUsers);

////=== Workspace routes
router.get('/workspaces', protect, getWorkspaces);

export default router;
