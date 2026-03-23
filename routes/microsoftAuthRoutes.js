import express from 'express';
import {
    getLoginUrl,
    handleCallback,
    refreshToken
} from '../controllers/microsoftAuthController.js';

const router = express.Router();

router.get('/login', getLoginUrl);
router.get('/callback', handleCallback);
router.post('/refresh-token', refreshToken);

export default router; 