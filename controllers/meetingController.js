import asyncHandler from 'express-async-handler';
import Meeting from '../models/meetingModel.js';
import axios from 'axios';
import { zoomConfig, googleMeetConfig } from '../config/meetingConfig.js';
import { google } from 'googleapis';

// @desc    Create a new meeting
// @route   POST /api/meetings
// @access  Private
const createMeeting = asyncHandler(async (req, res) => {
    const {
        title,
        description,
        platform,
        recorded_url,
        user_id
    } = req.body;

    const meeting = await Meeting.create({
        title,
        description,
        platform,
        recorded_url,
        user_id: req.user._id || user_id,
    });

    if (meeting) {
        res.status(201).json(meeting);
    } else {
        res.status(400);
        throw new Error('Invalid meeting data');
    }
});

// @desc    Get all meetings
// @route   GET /api/meetings
// @access  Private
const getMeetings = asyncHandler(async (req, res) => {
    const meetings = await Meeting.find({ user_id: req.user._id })
        .populate('user_id', 'name email')
    res.json(meetings);
});

// @desc    Get meeting by ID
// @route   GET /api/meetings/:id
// @access  Private
const getMeetingById = asyncHandler(async (req, res) => {
    const meeting = await Meeting.findById(req.params.id)
        .populate('user_id', 'name email')

    if (meeting) {
        res.json(meeting);
    } else {
        res.status(404);
        throw new Error('Meeting not found');
    }
});

// @desc    Update meeting
// @route   PUT /api/meetings/:id
// @access  Private
const updateMeeting = asyncHandler(async (req, res) => {
    const meeting = await Meeting.findById(req.params.id);

    if (meeting) {
        if (meeting.user_id.toString() !== req.user._id.toString()) {
            res.status(401);
            throw new Error('Not authorized to update this meeting');
        }

        meeting.title = req.body.title || meeting.title;
        meeting.description = req.body.description || meeting.description;
        meeting.platform = req.body.platform || meeting.platform;
        meeting.recorded_url = req.body.recorded_url || meeting.recorded_url;

        meeting.user_id = req.body.user_id || meeting.user_id;
        meeting.status = req.body.status || meeting.status;

        const updatedMeeting = await meeting.save();
        res.json(updatedMeeting);
    } else {
        res.status(404);
        throw new Error('Meeting not found');
    }
});

// @desc    Delete meeting
// @route   DELETE /api/meetings/:id
// @access  Private
const deleteMeeting = asyncHandler(async (req, res) => {
    const meeting = await Meeting.findById(req.params.id);

    if (meeting) {
        if (meeting.user_id.toString() !== req.user._id.toString()) {
            res.status(401);
            throw new Error('Not authorized to delete this meeting');
        }

        await meeting.deleteOne();
        res.json({ message: 'Meeting removed' });
    } else {
        res.status(404);
        throw new Error('Meeting not found');
    }
});

// @desc    Handle meeting recording webhook
// @route   POST /api/meetings/recording-webhook
// @access  Public
const handleRecordingWebhook = asyncHandler(async (req, res) => {
    try {
        console.log('Received webhook payload:', JSON.stringify(req.body, null, 2));
        const { payload } = req.body;

        // Verify this is a recording completion event
        if (payload.event === 'recording.completed') {
            console.log('Processing recording completed event');

            // Find the meeting using the Zoom meeting ID
            const meeting = await Meeting.findOne({
                platform_meeting_id: payload.payload.object.id
            });

            if (meeting) {
                console.log('Found matching meeting:', meeting._id);

                // Get recording files
                const recordings = payload.payload.object.recording_files;
                const mp4Recording = recordings.find(file => file.file_type === 'MP4');

                if (mp4Recording) {
                    // Update meeting with recording URL
                    meeting.recorded_url = mp4Recording.download_url;
                    meeting.status = 'completed';
                    await meeting.save();

                    console.log('Updated meeting with recording URL:', mp4Recording.download_url);
                } else {
                    console.log('No MP4 recording found in webhook payload');
                }
            } else {
                console.log('No matching meeting found for Zoom meeting ID:', payload.payload.object.id);
            }
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error processing recording webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing recording webhook',
            error: error.message
        });
    }
});

// @desc    Start a Zoom meeting
// @route   POST /api/meetings/zoom/start
// @access  Private
const startZoomMeeting = asyncHandler(async (req, res) => {
    try {
        const { topic, duration, start_time } = req.body;

        if (!topic) {
            res.status(400);
            throw new Error('Meeting topic is required');
        }

        // Get Zoom access token using Server-to-Server OAuth
        const tokenUrl = 'https://zoom.us/oauth/token';

        // Ensure credentials are properly formatted without any whitespace
        const clientId = process.env.ZOOM_CLIENT_ID.replace(/\s/g, '');
        const clientSecret = process.env.ZOOM_CLIENT_SECRET.replace(/\s/g, '');
        const accountId = process.env.ZOOM_ACCOUNT_ID.replace(/\s/g, '');

        console.log('Attempting Zoom authentication with:', {
            accountId: accountId,
            clientIdLength: clientId.length,
            clientSecretLength: clientSecret.length
        });

        try {
            // Create authentication string
            const authBuffer = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

            // First get the access token
            const tokenResponse = await axios({
                method: 'POST',
                url: tokenUrl,
                headers: {
                    'Authorization': `Basic ${authBuffer}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: new URLSearchParams({
                    'grant_type': 'account_credentials',
                    'account_id': accountId
                }).toString()
            });

            if (!tokenResponse.data.access_token) {
                throw new Error('No access token received from Zoom');
            }

            const accessToken = tokenResponse.data.access_token;

            // Create Zoom meeting directly
            console.log('Creating Zoom meeting with token...');

            const meetingData = {
                topic: topic,
                type: 1, // Instant meeting
                settings: {
                    host_video: true,
                    participant_video: true,
                    join_before_host: true,
                    mute_upon_entry: true,
                    auto_recording: 'cloud', // Automatically start recording
                    audio_recording: true,
                    recording_disclaimer: true,
                    cloud_recording: true,
                    recording_authentication_required: false
                }
            };

            if (duration) meetingData.duration = duration;
            if (start_time) {
                meetingData.type = 2; // Scheduled meeting
                meetingData.start_time = start_time;
            }

            // Create meeting using /users/me endpoint
            const meetingResponse = await axios({
                method: 'POST',
                url: 'https://api.zoom.us/v2/users/me/meetings',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                data: meetingData
            });

            console.log('Zoom meeting created successfully');

            // Create meeting record in our database
            const meeting = await Meeting.create({
                title: topic,
                description: meetingResponse.data.agenda || '',
                platform: 'zoom',
                user_id: req.user._id,
                status: 'scheduled',
                recorded_url: '', // Will be updated when recording is ready
                platform_meeting_id: meetingResponse.data.id // Store Zoom meeting ID for webhook matching
            });

            res.status(201).json({
                success: true,
                meeting: meeting,
                zoomMeeting: {
                    id: meetingResponse.data.id,
                    join_url: meetingResponse.data.join_url,
                    start_url: meetingResponse.data.start_url,
                    password: meetingResponse.data.password,
                    host_email: meetingResponse.data.host_email,
                    duration: meetingResponse.data.duration,
                    start_time: meetingResponse.data.start_time
                }
            });
        } catch (tokenError) {
            console.error('Zoom API Error Details:', {
                message: tokenError.message,
                response: {
                    status: tokenError.response?.status,
                    data: tokenError.response?.data,
                    headers: tokenError.response?.headers
                },
                request: {
                    url: tokenError.config?.url,
                    method: tokenError.config?.method,
                    data: tokenError.config?.data,
                    headers: {
                        ...tokenError.config?.headers,
                        'Authorization': '[REDACTED]'
                    }
                }
            });
            throw tokenError;
        }
    } catch (error) {
        console.error('Zoom API Error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });

        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || error.message || 'Error creating Zoom meeting',
            details: error.response?.data
        });
    }
});

// @desc    Start a Google Meet meeting
// @route   POST /api/meetings/google/start
// @access  Private
const startGoogleMeet = asyncHandler(async (req, res) => {
    try {
        const { title, startTime, duration } = req.body;

        // Initialize Google Calendar API
        const oauth2Client = new google.auth.OAuth2(
            googleMeetConfig.clientId,
            googleMeetConfig.clientSecret,
            googleMeetConfig.redirectUri
        );

        // Set credentials (implement token management separately)
        oauth2Client.setCredentials({
            access_token: req.user.googleAccessToken
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Create Google Calendar event with Meet
        const event = await calendar.events.insert({
            calendarId: 'primary',
            conferenceDataVersion: 1,
            requestBody: {
                summary: title,
                start: {
                    dateTime: startTime,
                },
                end: {
                    dateTime: new Date(new Date(startTime).getTime() + duration * 60000).toISOString(),
                },
                conferenceData: {
                    createRequest: {
                        requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                }
            }
        });

        // Create meeting record in our database
        const meeting = await Meeting.create({
            title,
            platform: 'googlemeet',
            user_id: req.user._id,
            status: 'scheduled',
            recorded_url: event.data.hangoutLink
        });

        res.status(201).json({
            success: true,
            meeting: meeting,
            googleMeet: event.data
        });
    } catch (error) {
        res.status(error.response?.status || 500);
        throw new Error(error.response?.data?.message || 'Error creating Google Meet');
    }
});

export {
    createMeeting,
    getMeetings,
    getMeetingById,
    updateMeeting,
    deleteMeeting,
    startZoomMeeting,
    startGoogleMeet,
    handleRecordingWebhook
}; 