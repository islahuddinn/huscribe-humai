import express from 'express';
import multer from 'multer';
import {
    createVoiceMemo,
    getVoiceMemos,
    getVoiceMemoById,
    updateVoiceMemo,
    deleteVoiceMemo
} from '../controllers/voiceMemoController.js';
import { protect } from '../middleware/authMiddleware.js';

// Initialize multer
const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

const router = express.Router();

router.post(
    '/create',
    protect,
    // upload.fields([
    //     { name: 'voice_file', maxCount: 1 },
    //     { name: 'file_file', maxCount: 1 },
    // ]),
    createVoiceMemo
);

router.get('/', protect, getVoiceMemos);

router.route('/one')
    .get(protect, getVoiceMemoById)
    .put(protect, updateVoiceMemo)
    .delete(protect, deleteVoiceMemo);

export default router;