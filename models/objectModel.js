import mongoose from 'mongoose';

const objectSchema = mongoose.Schema(
    {
        transcription_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Transcription',
        },
        status: {
            type: String,
            enum: ['pending', 'synced', 'rejected', 'sync_failed'],
            default: 'pending',
            required: true
        },
        campaign: {
            type: mongoose.Schema.Types.Mixed,
            required: false,
            salesforce_id: String,
            sync_status: {
                type: String,
                enum: ['pending', 'synced', 'failed'],
                default: 'pending'
            }
        },
        account: {
            type: mongoose.Schema.Types.Mixed,
            required: false,
            salesforce_id: String,
            sync_status: {
                type: String,
                enum: ['pending', 'synced', 'failed'],
                default: 'pending'
            }
        },
        campaignMember: {
            type: mongoose.Schema.Types.Mixed,
            required: false,
            salesforce_id: String,
            sync_status: {
                type: String,
                enum: ['pending', 'synced', 'failed'],
                default: 'pending'
            }
        },
        opportunity: {
            type: mongoose.Schema.Types.Mixed,
            required: false,
            salesforce_id: String,
            sync_status: {
                type: String,
                enum: ['pending', 'synced', 'failed'],
                default: 'pending'
            }
        },
        contact: {
            type: mongoose.Schema.Types.Mixed,
            required: false,
            salesforce_id: String,
            sync_status: {
                type: String,
                enum: ['pending', 'synced', 'failed'],
                default: 'pending'
            }
        },
        lead: {
            type: mongoose.Schema.Types.Mixed,
            required: false,
            salesforce_id: String,
            sync_status: {
                type: String,
                enum: ['pending', 'synced', 'failed'],
                default: 'pending'
            }
        },
        event: {
            type: mongoose.Schema.Types.Mixed,
            required: false,
            salesforce_id: String,
            sync_status: {
                type: String,
                enum: ['pending', 'synced', 'failed'],
                default: 'pending'
            }
        },
        task: {
            type: mongoose.Schema.Types.Mixed,
            required: false,
            salesforce_id: String,
            sync_status: {
                type: String,
                enum: ['pending', 'synced', 'failed'],
                default: 'pending'
            }
        },
        note: {
            type: mongoose.Schema.Types.Mixed,
            required: false,
            salesforce_id: String,
            sync_status: {
                type: String,
                enum: ['pending', 'synced', 'failed'],
                default: 'pending'
            }
        },
        attachment: {
            type: mongoose.Schema.Types.Mixed,
            required: false,
            salesforce_id: String,
            sync_status: {
                type: String,
                enum: ['pending', 'synced', 'failed'],
                default: 'pending'
            }
        }
    },
    {
        timestamps: true,
    }
);

const Object = mongoose.model('Object', objectSchema);

export default Object; 