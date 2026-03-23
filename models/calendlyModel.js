import mongoose from 'mongoose';

const calendlySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    calendlyUserId: {
        type: String,
        required: true,
        unique: true
    },
    accessToken: {
        type: String,
        required: true
    },
    refreshToken: {
        type: String,
        required: true
    },
    organization: {
        type: String
    },
    email: {
        type: String,
        required: true
    },
    name: String,
    tokenExpiresAt: Date,
    lastSync: Date
}, {
    timestamps: true
});

const Calendly = mongoose.model('Calendly', calendlySchema);
export default Calendly; 