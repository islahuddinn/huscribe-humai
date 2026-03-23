import mongoose from 'mongoose';

const voiceMemoSchema = mongoose.Schema(
    {
        voice_url: {
            type: String,
        },
        text: {
            type: String,
            required: false,
        },
        file_url: {
            type: String,
            required: false,
        },
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User'
        },
        duration: {
            type: Number, 
            required: false,
        },
        memoType:{
            type: String
        },
        instruction:{
            type: String
        },
        status: {
            type: String,
            enum: ['processing', 'completed', 'failed'],
            default: 'processing'
        }
    },
    {
        timestamps: true,
    }
);

const VoiceMemo = mongoose.model('VoiceMemo', voiceMemoSchema);

export default VoiceMemo; 