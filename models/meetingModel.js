import mongoose from 'mongoose';

const meetingSchema = mongoose.Schema(
    {
        title: {
            type: String,
        },
        description: {
            type: String,
        },
        platform: {
            type: String,
            required: true,
            enum: ['zoom', 'googlemeet'],
        },
        recorded_url: {
            type: String,
            required: false,
        },
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
            default: 'scheduled'
        }
    },
    {
        timestamps: true,
    }
);

const Meeting = mongoose.model('Meeting', meetingSchema);

export default Meeting; 