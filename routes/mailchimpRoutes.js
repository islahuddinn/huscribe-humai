import express from 'express';
import {
  subscribeToList,
  getSubscriber,
  updateSubscriber,
  deleteSubscriber,
  getLists,
} from '../controllers/mailchimpController.js';

const router = express.Router();

// Apply middleware to all routes

// Mailchimp routes
router.post('/subscribe', subscribeToList);
router.get('/subscriber/:email', getSubscriber);
router.put('/subscriber/:email', updateSubscriber);
router.delete('/subscriber/:email', deleteSubscriber);
router.get('/lists', getLists);

export default router; 