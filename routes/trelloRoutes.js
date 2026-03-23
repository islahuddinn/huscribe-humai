import express from 'express';
import * as trelloController from '../controllers/trelloController.js';

const router = express.Router();

// OAuth routes
router.get('/auth', trelloController.initiateOAuth);
router.get('/callback', trelloController.handleCallback);
router.post('/refresh-token', trelloController.refreshToken);

// Power-Up API routes
router.get('/api-key', trelloController.getApiKey);

// Board operations
router.get('/boards', trelloController.getAllBoards);
router.get('/boards/:id', trelloController.getBoardById);
router.post('/boards', trelloController.createBoard);
router.put('/boards/:id', trelloController.updateBoard);
router.delete('/boards/:id', trelloController.deleteBoard);

// List operations
router.post('/lists', trelloController.createList);
router.get('/boards/:boardId/lists', trelloController.getListsOnBoard);

// Card operations
router.post('/cards', trelloController.createCard);
router.put('/cards/:cardId', trelloController.updateCard);
router.delete('/cards/:cardId', trelloController.deleteCard);
router.post('/cards/:cardId/comments', trelloController.addCommentToCard);
router.get('/boards/:boardId/cards', trelloController.getBoardCards);
router.get('/lists/:listId/cards', trelloController.getListCards);

// Bulk creation operations
router.post('/create-objects', trelloController.createTrelloObjects);

export default router;