import asyncHandler from 'express-async-handler';
import axios from 'axios';

///////==== Doodle API configuration
const doodleConfig = {
    baseURL: process.env.DOODLE_API_BASE_URL,
    headers: {
        'Authorization': `Bearer ${process.env.DOODLE_API_KEY}`,
        'Content-Type': 'application/json'
    }
};

////////==== Auth Controllers
export const authorizeDoodle = asyncHandler(async (req, res) => {
    const authUrl = `${process.env.DOODLE_AUTH_URL}?client_id=${process.env.DOODLE_CLIENT_ID}&redirect_uri=${process.env.DOODLE_REDIRECT_URI}&response_type=code&scope=email calendar`;
    res.redirect(authUrl);
});

export const doodleCallback = asyncHandler(async (req, res) => {
    const { code } = req.query;
    
    try {
        const tokenResponse = await axios.post(process.env.DOODLE_TOKEN_URL, {
            client_id: process.env.DOODLE_CLIENT_ID,
            client_secret: process.env.DOODLE_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.DOODLE_REDIRECT_URI
        });

        // Store tokens in user session or database
        // Update user's doodle integration status

        res.redirect('/dashboard');
    } catch (error) {
        res.status(400).json({ message: 'Auth failed', error: error.message });
    }
});

//////==== Poll Controllers
export const createPoll = asyncHandler(async (req, res) => {
    const { title, description, type, options, participants } = req.body;
    
    const response = await axios.post(`${doodleConfig.baseURL}/polls`, {
        title,
        description,
        type,
        options,
        participants
    }, doodleConfig);

    res.status(201).json(response.data);
});

export const getPoll = asyncHandler(async (req, res) => {
    const { pollId } = req.params;
    
    const response = await axios.get(`${doodleConfig.baseURL}/polls/${pollId}`, doodleConfig);
    
    res.json(response.data);
});

export const getAllPolls = asyncHandler(async (req, res) => {
    const response = await axios.get(`${doodleConfig.baseURL}/polls`, doodleConfig);
    
    res.json(response.data);
});

export const updatePoll = asyncHandler(async (req, res) => {
    const { pollId } = req.params;
    const updateData = req.body;
    
    const response = await axios.put(`${doodleConfig.baseURL}/polls/${pollId}`, updateData, doodleConfig);
    
    res.json(response.data);
});

export const deletePoll = asyncHandler(async (req, res) => {
    const { pollId } = req.params;
    
    await axios.delete(`${doodleConfig.baseURL}/polls/${pollId}`, doodleConfig);
    
    res.json({ message: 'Poll deleted successfully' });
});

///////==== Participant Controllers
export const addParticipant = asyncHandler(async (req, res) => {
    const { pollId } = req.params;
    const { name, email, preferences } = req.body;
    
    const response = await axios.post(`${doodleConfig.baseURL}/polls/${pollId}/participants`, {
        name,
        email,
        preferences
    }, doodleConfig);
    
    res.status(201).json(response.data);
});

export const removeParticipant = asyncHandler(async (req, res) => {
    const { pollId, participantId } = req.params;
    
    await axios.delete(`${doodleConfig.baseURL}/polls/${pollId}/participants/${participantId}`, doodleConfig);
    
    res.json({ message: 'Participant removed successfully' });
});

export const getParticipants = asyncHandler(async (req, res) => {
    const { pollId } = req.params;
    
    const response = await axios.get(`${doodleConfig.baseURL}/polls/${pollId}/participants`, doodleConfig);
    
    res.json(response.data);
});

//////===== Meeting Controllers
export const createMeeting = asyncHandler(async (req, res) => {
    const { title, duration, location, participants, timeOptions } = req.body;
    
    const response = await axios.post(`${doodleConfig.baseURL}/meetings`, {
        title,
        duration,
        location,
        participants,
        timeOptions
    }, doodleConfig);
    
    res.status(201).json(response.data);
});

export const getMeeting = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    
    const response = await axios.get(`${doodleConfig.baseURL}/meetings/${meetingId}`, doodleConfig);
    
    res.json(response.data);
});

export const getAllMeetings = asyncHandler(async (req, res) => {
    const response = await axios.get(`${doodleConfig.baseURL}/meetings`, doodleConfig);
    
    res.json(response.data);
});

export const updateMeeting = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const updateData = req.body;
    
    const response = await axios.put(`${doodleConfig.baseURL}/meetings/${meetingId}`, updateData, doodleConfig);
    
    res.json(response.data);
});

export const deleteMeeting = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    
    await axios.delete(`${doodleConfig.baseURL}/meetings/${meetingId}`, doodleConfig);
    
    res.json({ message: 'Meeting deleted successfully' });
});

/////===== Calendar Integration
export const syncCalendar = asyncHandler(async (req, res) => {
    const { calendarId, events } = req.body;
    
    const response = await axios.post(`${doodleConfig.baseURL}/calendar/sync`, {
        calendarId,
        events
    }, doodleConfig);
    
    res.json(response.data);
});
