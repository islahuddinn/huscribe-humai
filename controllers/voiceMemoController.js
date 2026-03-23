import asyncHandler from 'express-async-handler';
import VoiceMemo from '../models/voiceMemoModel.js';
import User from '../models/userModel.js';
// import { bucket } from '../googleCloudStorage.js';
// import path from 'path';
// import { format } from 'util';
import mongoose from 'mongoose';
import paymentController from './paymentController.js';

// @desc    Create a new voice memo
// @route   POST /api/voice-memos
// @access  Private
// import { v2 as cloudinary } from 'cloudinary';

const createVoiceMemo = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.body.user_id;
  const {

    text,
    duration,
    memoType,
    voice_url,
    file_url
  } = req.body;

  try {
    // Get user and check subscription
    const user = await User.findById(userId).populate('currentPlan');
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Check if user has an active subscription or is in trial
    if (!user.hasActiveSubscription() && !user.isInTrial()) {
      res.status(403);
      throw new Error('Active subscription required');
    }
console.log('user',user)
    // Check voice usage limits
    if (user.usage.voicesUsed >= (user.currentPlan.features.voicesPerMonth === -1 ? 1000000 : user.currentPlan.features.voicesPerMonth)) {
      res.status(403);
      throw new Error('Monthly voice usage limit reached');
    }

    // Create the voice memo
    const voiceMemo = await VoiceMemo.create({
      user_id:userId,
      text,
      voice_url,
      duration,
      memoType,
      file_url
    });

    // Increment usage in both systems
    await user.incrementUsage('voice');
    await paymentController.updatePlanHistoryUsage(
      userId, 
      user.subscriptionId, 
      'voice'
    );

    res.status(201).json(voiceMemo);
  } catch (error) {
    console.error('Error creating voice memo:', error);
    res.status(error.status || 500).json({ message: error.message });
  }
});

// @desc    Get all voice memos
// @route   GET /api/voice-memos
// @access  Private

const getVoiceMemos = asyncHandler(async (req, res) => {
    const { text, duration, memoType, status, page = 1, limit = 10, user_id } = req.query;

    const filter = {};

    // Only allow admin or self to access voice memos
    if (user_id) {
        // If specific user_id is requested, check if current user is admin or the same user
        if (user_id !== req.user._id.toString() && !req.user.isAdmin) {
            res.status(401);
            throw new Error('Not authorized to access other users voice memos');
        }
        filter.user_id = user_id;
    } else {
        // If no specific user_id, show only current user's memos
        filter.user_id = req.user._id;
    }

    if (text) {
        filter.text = { $regex: text, $options: 'i' };
    }

    if (duration) {
        filter.duration = duration;
    }

    if (memoType) {
        filter.memoType = memoType;
    }

    if (status) {
        filter.status = status;
    }

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count of documents matching the filter
    const totalResults = await VoiceMemo.countDocuments(filter);

    // Get paginated results
    const voiceMemos = await VoiceMemo.find(filter)
        .populate('user_id', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    res.json({
        status: true,
        data: {
            voiceMemos,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalResults / parseInt(limit)),
                totalResults,
                resultsPerPage: parseInt(limit)
            }
        }
    });
});

// @desc    Get voice memo by ID
// @route   GET /api/voice-memos/:id
// @access  Private
const getVoiceMemoById = asyncHandler(async (req, res) => {
    const memoId = req.query.id
    const voiceMemo = await VoiceMemo.findById(memoId)
        .populate('user_id', 'name email');
    if (voiceMemo) {
        // Check if the voice memo belongs to the user
        if (voiceMemo.user_id._id.toString() !== req.user._id.toString()) {
            res.status(401);
            throw new Error('Not authorized to access this voice memo');
        }
        res.json({status:true , data:voiceMemo});
    } else {
        res.status(404);
        throw new Error('Voice memo not found');
    }
});

// @desc    Update voice memo
// @route   PUT /api/voice-memos/:id
// @access  Private
const updateVoiceMemo = asyncHandler(async (req, res) => {
    const memoId = req.query.id
    const voiceMemo = await VoiceMemo.findById(memoId);

    if (voiceMemo) {
        if (voiceMemo.user_id.toString() !== req.user._id.toString()) {
            res.status(401);
            throw new Error('Not authorized to update this voice memo');
        }

        voiceMemo.voice_url = req.body.voice_url || voiceMemo.voice_url;
        voiceMemo.text = req.body.text || voiceMemo.text;
        voiceMemo.file_url = req.body.file_url || voiceMemo.file_url;
        voiceMemo.duration = req.body.duration || voiceMemo.duration;
        voiceMemo.status = req.body.status || voiceMemo.status;
        voiceMemo.memoType = req.body.memoType || voiceMemo.memoType;

        const updatedVoiceMemo = await voiceMemo.save();
        res.json({status:true , data:updatedVoiceMemo});
    } else {
        res.status(404);
        throw new Error('Voice memo not found');
    }
});

// @desc    Delete voice memo
// @route   DELETE /api/voice-memos/:id
// @access  Private
const deleteVoiceMemo = asyncHandler(async (req, res) => {
    const memoId = req.query.id
    const voiceMemo = await VoiceMemo.findById(memoId);

    if (voiceMemo) {
        if (voiceMemo.user_id.toString() !== req.user._id.toString()) {
            res.status(401);
            throw new Error('Not authorized to delete this voice memo');
        }

        await voiceMemo.deleteOne();
        res.json({status:true , data:voiceMemo });
    } else {
        res.status(404);
        throw new Error('Voice memo not found');
    }
});

export {
    createVoiceMemo,
    getVoiceMemos,
    getVoiceMemoById,
    updateVoiceMemo,
    deleteVoiceMemo
}; 