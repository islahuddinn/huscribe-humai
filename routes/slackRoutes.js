import { Router } from 'express';
import { slackController, validateSlackRequest } from '../controllers/slackController.js';

const router = Router();

router.get('/install', slackController.initiateSlackOAuth);
router.get('/oauth', slackController.handleSlackOAuth);

router.post('/events', validateSlackRequest, slackController.handleSlackEvents);

router.post('/interactions', validateSlackRequest, slackController.handleSlackInteractions);

router.post('/test', slackController.testSlackIntegration);

router.get('/test-connection', slackController.testBotConnection);

export default router;