import express from 'express';
import {
  createCall,
  getAllCalls,
  getCallById,
  updateCall,
  deleteCall,
  logCallOutcome
} from '../controllers/zohoCallsController.js';

const router = express.Router();

// All routes are protected with authentication middleware

// Calls Routes
router.route('/')
  .get(getAllCalls)
  .post(createCall);

router.route('/:id')
  .get(getCallById)
  .put(updateCall)
  .delete(deleteCall);

// Additional route for logging call outcome
router.route('/:id/outcome')
  .post(logCallOutcome);

export default router; 