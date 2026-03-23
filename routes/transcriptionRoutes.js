import express from 'express';
import {
    createTranscription,
    getTranscriptions,
    getTranscriptionById,
    updateTranscription,
    deleteTranscription
} from '../controllers/transcriptionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .post(protect, createTranscription)
    .get(protect, getTranscriptions);

router.route('/:id')
    .get(protect, getTranscriptionById)
    .put(protect, updateTranscription)
    .delete(protect, deleteTranscription);

export default router; 