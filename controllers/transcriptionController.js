import asyncHandler from 'express-async-handler';
import Transcription from '../models/transcriptionModel.js';
import Meeting from '../models/meetingModel.js';
import VoiceMemo from '../models/voiceMemoModel.js';

// @desc    Create a new transcription
// @route   POST /api/transcriptions
// @access  Private
const createTranscription = asyncHandler(async (req, res) => {
    const {
        meeting_id,
        memo_id,
        transcribed_text,
        language
    } = req.body;

    // Validate that either meeting_id or memo_id is provided, but not both
    if ((meeting_id && memo_id) || (!meeting_id && !memo_id)) {
        res.status(400);
        throw new Error('Either meeting_id or memo_id must be provided, but not both');
    }

    // Verify that the referenced meeting or memo exists and belongs to the user
    if (meeting_id) {
        const meeting = await Meeting.findById(meeting_id);
        if (!meeting || meeting.user_id.toString() !== req.user._id.toString()) {
            res.status(404);
            throw new Error('Meeting not found or unauthorized');
        }
    }

    if (memo_id) {
        const memo = await VoiceMemo.findById(memo_id);
        if (!memo || memo.user_id.toString() !== req.user._id.toString()) {
            res.status(404);
            throw new Error('Voice memo not found or unauthorized');
        }
    }

    const transcription = await Transcription.create({
        meeting_id,
        memo_id,
        transcribed_text,
        language,
        user_id: req.user._id,
    });

    if (transcription) {
        res.status(201).json(transcription);
    } else {
        res.status(400);
        throw new Error('Invalid transcription data');
    }
});

// @desc    Get all transcriptions
// @route   GET /api/transcriptions
// @access  Private
const getTranscriptions = asyncHandler(async (req, res) => {
    const transcriptions = await Transcription.find({ user_id: req.user._id })
        .populate('meeting_id', 'title platform')
        .populate('memo_id', 'voice_url text')
        .populate('user_id', 'name email')
        .sort({ createdAt: -1 }); // Most recent first
    res.json(transcriptions);
});

// @desc    Get transcription by ID
// @route   GET /api/transcriptions/:id
// @access  Private
const getTranscriptionById = asyncHandler(async (req, res) => {
    const transcription = await Transcription.findById(req.params.id)
        .populate('meeting_id', 'title platform')
        .populate('memo_id', 'voice_url text')
        .populate('user_id', 'name email');

    if (transcription) {
        // Check if the transcription belongs to the user
        if (transcription.user_id._id.toString() !== req.user._id.toString()) {
            res.status(401);
            throw new Error('Not authorized to access this transcription');
        }
        res.json(transcription);
    } else {
        res.status(404);
        throw new Error('Transcription not found');
    }
});

// @desc    Update transcription
// @route   PUT /api/transcriptions/:id
// @access  Private
const updateTranscription = asyncHandler(async (req, res) => {
    const transcription = await Transcription.findById(req.params.id);

    if (transcription) {
        if (transcription.user_id.toString() !== req.user._id.toString()) {
            res.status(401);
            throw new Error('Not authorized to update this transcription');
        }

        // Don't allow changing the meeting_id or memo_id after creation
        if (req.body.meeting_id || req.body.memo_id) {
            res.status(400);
            throw new Error('Cannot change meeting_id or memo_id after creation');
        }

        transcription.transcribed_text = req.body.transcribed_text || transcription.transcribed_text;
        transcription.language = req.body.language || transcription.language;
        transcription.status = req.body.status || transcription.status;

        const updatedTranscription = await transcription.save();
        res.json(updatedTranscription);
    } else {
        res.status(404);
        throw new Error('Transcription not found');
    }
});

// @desc    Delete transcription
// @route   DELETE /api/transcriptions/:id
// @access  Private
const deleteTranscription = asyncHandler(async (req, res) => {
    const transcription = await Transcription.findById(req.params.id);

    if (transcription) {
        if (transcription.user_id.toString() !== req.user._id.toString()) {
            res.status(401);
            throw new Error('Not authorized to delete this transcription');
        }

        await transcription.deleteOne();
        res.json({ message: 'Transcription removed' });
    } else {
        res.status(404);
        throw new Error('Transcription not found');
    }
});

export {
    createTranscription,
    getTranscriptions,
    getTranscriptionById,
    updateTranscription,
    deleteTranscription
}; 