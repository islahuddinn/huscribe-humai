import asyncHandler from 'express-async-handler';
import Summarization from '../models/summarizationModel.js';
import Transcription from '../models/transcriptionModel.js';
import { createSalesforceConnection, upsertSalesforceRecord } from '../config/salesforceConfig.js';

// @desc    Create a new summarization
// @route   POST /api/summarizations
// @access  Private
const createSummarization = asyncHandler(async (req, res) => {
    console.log('Creating summarization with data:', req.body);
    console.log('User from request:', req.user);

    if (!req.user) {
        res.status(401);
        throw new Error('Not authenticated');
    }

    const {
        transcription_id,
        type,
        leads,
        task,
        key_points,
        salesforce
    } = req.body;

    try {
        let salesforceRecordId = null;
        let salesforceSyncStatus = 'pending';
        let salesforceError = null;

        // First try to sync with Salesforce if credentials are provided
        if (salesforce?.access_token && salesforce?.instance_url) {
            try {
                console.log('Attempting Salesforce sync...');
                const conn = await createSalesforceConnection(salesforce.access_token, salesforce.instance_url);

                // Check if REST API is enabled
                try {
                    const limits = await conn.limits();
                    console.log('Salesforce API limits:', limits);
                } catch (apiError) {
                    throw new Error('Salesforce REST API is not enabled for this organization');
                }

                // Get transcription text if transcription_id exists
                let transcribedText = '';
                if (transcription_id) {
                    const transcription = await Transcription.findById(transcription_id);
                    transcribedText = transcription ? transcription.transcribed_text : '';
                }

                const sfData = {
                    external_id: `summary_${Date.now()}`,
                    Summary_Text__c: transcribedText,
                    Key_Points__c: Array.isArray(key_points) ? key_points.join('\n') : key_points,
                    Leads__c: leads,
                    Tasks__c: task,
                    Status__c: 'pending',
                    Type__c: type
                };

                const sfResponse = await upsertSalesforceRecord(conn, sfData);
                console.log('Salesforce sync successful:', sfResponse);

                salesforceRecordId = sfResponse.id;
                salesforceSyncStatus = 'synced';
            } catch (error) {
                console.error('Salesforce sync failed:', error);
                salesforceSyncStatus = 'failed';
                salesforceError = error.message;

                // If error indicates missing object/fields, provide clear message
                if (error.message.includes('not found in Salesforce') || error.message.includes('Missing required fields')) {
                    salesforceError = 'Salesforce setup incomplete. Please ensure the Meeting_Summary__c object and all required fields are created in Salesforce.';
                }

                // If Salesforce sync is required, throw error
                if (process.env.REQUIRE_SALESFORCE_SYNC === 'true') {
                    throw error;
                }
            }
        }

        // Create the summarization in MongoDB
        const summarization = await Summarization.create({
            transcription_id: transcription_id || null,
            type,
            leads,
            task,
            key_points: key_points || [],
            user_id: req.user._id,
            status: 'pending',
            salesforce_record_id: salesforceRecordId,
            salesforce_sync_status: salesforceSyncStatus,
            salesforce_error: salesforceError
        });

        console.log('Created summarization:', summarization);

        res.status(201).json({
            success: true,
            message: 'Summarization created successfully',
            data: summarization
        });
    } catch (error) {
        console.error('Error creating summarization:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Failed to create summarization'
        });
    }
});

// @desc    Get all summarizations
// @route   GET /api/summarizations
// @access  Private
const getSummarizations = asyncHandler(async (req, res) => {
    const summarizations = await Summarization.find({ user_id: req.user._id })
        .populate('transcription_id', 'transcribed_text language')
        .populate('user_id', 'name email')
        .sort({ createdAt: -1 }); // Most recent first

    res.json({
        success: true,
        message: 'Summarizations retrieved successfully',
        data: summarizations
    });
});

// @desc    Get summarization by ID
// @route   GET /api/summarizations/:id
// @access  Private
const getSummarizationById = asyncHandler(async (req, res) => {
    const summarization = await Summarization.findById(req.params.id)
        .populate('transcription_id', 'transcribed_text language')
        .populate('user_id', 'name email');

    if (summarization) {
        // Check if the summarization belongs to the user
        if (summarization.user_id._id.toString() !== req.user._id.toString()) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this summarization'
            });
        }
        res.json({
            success: true,
            message: 'Summarization retrieved successfully',
            data: summarization
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'Summarization not found'
        });
    }
});

// @desc    Update summarization
// @route   PUT /api/summarizations/:id
// @access  Private
const updateSummarization = asyncHandler(async (req, res) => {
    const summarization = await Summarization.findById(req.params.id);

    if (summarization) {
        if (summarization.user_id.toString() !== req.user._id.toString()) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to update this summarization'
            });
        }

        // Don't allow changing the transcription_id after creation
        if (req.body.transcription_id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot change transcription_id after creation'
            });
        }

        summarization.type = req.body.type || summarization.type;
        summarization.leads = req.body.leads || summarization.leads;
        summarization.task = req.body.task || summarization.task;
        summarization.key_points = req.body.key_points || summarization.key_points;
        summarization.status = req.body.status || summarization.status;

        // If Salesforce credentials are provided and we have a Salesforce record ID, update in Salesforce
        if (req.body.salesforce_access_token && req.body.salesforce_instance_url && summarization.salesforce_record_id) {
            try {
                const conn = await createSalesforceConnection(req.body.salesforce_access_token, req.body.salesforce_instance_url);

                const transcription = await Transcription.findById(summarization.transcription_id);
                const sfData = {
                    transcribed_text: transcription?.transcribed_text,
                    key_points: summarization.key_points,
                    leads: summarization.leads,
                    task: summarization.task,
                    status: summarization.status,
                    type: summarization.type
                };

                await upsertSalesforceRecord(conn, sfData);

                summarization.salesforce_sync_status = 'synced';
                summarization.salesforce_last_sync = new Date();
                summarization.salesforce_error = null;
            } catch (error) {
                summarization.salesforce_sync_status = 'failed';
                summarization.salesforce_error = error.message;
                console.error('Salesforce sync failed:', error);
            }
        }

        const updatedSummarization = await summarization.save();
        res.json({
            success: true,
            message: 'Summarization updated successfully',
            data: updatedSummarization
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'Summarization not found'
        });
    }
});

// @desc    Delete summarization
// @route   DELETE /api/summarizations/:id
// @access  Private
const deleteSummarization = asyncHandler(async (req, res) => {
    const summarization = await Summarization.findById(req.params.id);

    if (summarization) {
        if (summarization.user_id.toString() !== req.user._id.toString()) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to delete this summarization'
            });
        }

        await summarization.deleteOne();
        res.json({
            success: true,
            message: 'Summarization deleted successfully'
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'Summarization not found'
        });
    }
});

// @desc    Get summarization by transcription ID
// @route   GET /api/summarizations/transcription/:transcriptionId
// @access  Private
const getSummarizationByTranscriptionId = asyncHandler(async (req, res) => {
    const summarization = await Summarization.findOne({
        transcription_id: req.params.transcriptionId,
        user_id: req.user._id
    })
        .populate('transcription_id', 'transcribed_text language')
        .populate('user_id', 'name email');

    if (summarization) {
        res.json({
            success: true,
            message: 'Summarization retrieved successfully',
            data: summarization
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'Summarization not found for this transcription'
        });
    }
});

export {
    createSummarization,
    getSummarizations,
    getSummarizationById,
    updateSummarization,
    deleteSummarization,
    getSummarizationByTranscriptionId
}; 