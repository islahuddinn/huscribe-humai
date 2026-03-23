const mongoose = require('mongoose');

const chiliPiperSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    routerName: {
        type: String,
        required: true,
        trim: true
    },
    meetingId: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
        default: 'scheduled'
    },
    attendees: [{
        email: {
            type: String,
            required: true
        },
        name: String,
        role: String
    }],
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    meetingDetails: {
        conferenceUrl: String,
        location: String,
        notes: String,
        calendarEventId: String,
        calendarProvider: String
    },
    metadata: {
        type: Map,
        of: String
    },
    integrationSettings: {
        webhookUrl: String,
        webhookSecret: {
            type: String,
            select: false
        }
    },
    lastSyncedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for better query performance
chiliPiperSchema.index({ userId: 1, meetingId: 1 });
chiliPiperSchema.index({ startTime: 1 });
chiliPiperSchema.index({ 'attendees.email': 1 });

// Pre-save middleware to ensure endTime is after startTime
chiliPiperSchema.pre('save', function(next) {
    if (this.endTime <= this.startTime) {
        next(new Error('End time must be after start time'));
    }
    next();
});

// Instance method to check if meeting is upcoming
chiliPiperSchema.methods.isUpcoming = function() {
    return this.startTime > new Date();
};

// Static method to find conflicting meetings
chiliPiperSchema.statics.findConflicts = async function(userId, startTime, endTime) {
    return this.find({
        userId,
        $or: [
            { startTime: { $lt: endTime, $gte: startTime } },
            { endTime: { $gt: startTime, $lte: endTime } }
        ]
    });
};

const ChiliPiper = mongoose.model('ChiliPiper', chiliPiperSchema);
module.exports = ChiliPiper; 