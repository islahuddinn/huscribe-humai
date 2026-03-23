import express from 'express';
import {
    createObject,
    getObjects,
    getObjectById,
    updateObject,
    deleteObject,
    createBulkObjects,
    compositeOperation,
    postToChatter,
    deleteChatterPost,
    getChatterPost,
    getAllChatterPosts,
    convertLead,
    updateChatterPost
} from '../controllers/objectController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .post(protect, createObject)
    .get(protect, getObjects);

router.route('/bulk')
    .post(protect, createBulkObjects);

router.route('/composite')
    .post(protect, compositeOperation);

router.route('/chatter')
    .post(protect, postToChatter)
    .get(protect, getAllChatterPosts);

router.route('/chatter/:id')
    .get(protect, getChatterPost)
    .delete(protect, deleteChatterPost)
    .put(protect, updateChatterPost);

router.route('/lead/:id/convert')
    .post(protect, convertLead);

router.route('/:id')
    .get(protect, getObjectById)
    .put(protect, updateObject)
    .delete(protect, deleteObject);

export default router; 