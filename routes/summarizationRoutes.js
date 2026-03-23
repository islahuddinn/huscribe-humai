import express from 'express';
import {
    createSummarization,
    getSummarizations,
    getSummarizationById,
    updateSummarization,
    deleteSummarization,
    getSummarizationByTranscriptionId
} from '../controllers/summarizationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .post(protect, createSummarization)
    .get(protect, getSummarizations);

router.route('/transcription/:transcriptionId')
    .get(protect, getSummarizationByTranscriptionId);

router.route('/:id')
    .get(protect, getSummarizationById)
    .put(protect, updateSummarization)
    .delete(protect, deleteSummarization);

export default router; 