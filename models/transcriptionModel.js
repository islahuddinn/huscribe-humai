import mongoose from 'mongoose';

const transcriptionSchema = mongoose.Schema(
    {
        meeting_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Meeting',
            required: function () {
                return !this.memo_id; // Required if memo_id is not present
            }
        },
        memo_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'VoiceMemo',
            required: function () {
                return !this.meeting_id; // Required if meeting_id is not present
            }
        },
        transcribed_text: {
            type: String,
            required: true,
        },
        language: {
            type: String,
            required: true,
            enum: ['english', 'arabic'],
            default: 'english'
        },
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User'
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

// Middleware to validate that either meeting_id or memo_id is present, but not both
transcriptionSchema.pre('save', function (next) {
    if ((this.meeting_id && this.memo_id) || (!this.meeting_id && !this.memo_id)) {
        next(new Error('Either meeting_id or memo_id must be provided, but not both'));
    }
    next();
});

const Transcription = mongoose.model('Transcription', transcriptionSchema);

export default Transcription; 