import mongoose from 'mongoose';

const summarizationSchema = mongoose.Schema(
    {
        transcription_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Transcription',
            required: false
        },
        type: {
            type: String,
            required: true,
            enum: ['memo', 'meeting']
        },
        leads: {
            type: String,
            required: false
        },
        task: {
            type: String,
            required: false
        },
        key_points: [{
            type: String,
            required: false
        }],
        status: {
            type: String,
            required: true,
            enum: ['pending', 'confirmed', 'rejected'],
            default: 'pending'
        },
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User'
        },
        // Salesforce related fields
        salesforce_record_id: {
            type: String,
            required: false
        },
        salesforce_sync_status: {
            type: String,
            enum: ['pending', 'synced', 'failed'],
            default: 'pending'
        },
        salesforce_last_sync: {
            type: Date,
            required: false
        },
        salesforce_error: {
            type: String,
            required: false
        }
    },
    {
        timestamps: true,
    }
);

const Summarization = mongoose.model('Summarization', summarizationSchema);

export default Summarization; 