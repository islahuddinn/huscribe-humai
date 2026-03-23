import asyncHandler from 'express-async-handler';
import Calendly from '../models/calendlyModel.js';
import axios from 'axios';
import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';

const CALENDLY_AUTH_BASE_URL = 'https://auth.calendly.com';
const CALENDLY_API_BASE_URL = 'https://api.calendly.com';

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Initiate Calendly OAuth flow
// @route   GET /api/calendly/auth
// @access  Public
const initiateCalendlyAuth = asyncHandler(async (req, res) => {
    // Using only the default scope which includes all necessary permissions
    const authUrl = `${CALENDLY_AUTH_BASE_URL}/oauth/authorize?` +
        `client_id=${process.env.CALENDLY_CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(process.env.CALENDLY_REDIRECT_URI)}` +
        `&scope=default`;

    console.log('Generated Auth URL:', authUrl);
    res.json({ authUrl });
});

// @desc    Handle Calendly OAuth callback
// @route   GET /api/calendly/callback
// @access  Public
const handleCalendlyCallback = asyncHandler(async (req, res) => {
    const { code } = req.query;

    if (!code) {
        res.status(400);
        throw new Error('Authorization code is required');
    }

    try {
        // Exchange code for tokens
        const tokenResponse = await axios.post(`${CALENDLY_AUTH_BASE_URL}/oauth/token`, {
            client_id: process.env.CALENDLY_CLIENT_ID,
            client_secret: process.env.CALENDLY_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.CALENDLY_REDIRECT_URI
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const { access_token, refresh_token } = tokenResponse.data;

        // Get user details from Calendly
        const userResponse = await axios.get(`${CALENDLY_API_BASE_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        const calendlyUser = userResponse.data.resource;

        // Find or create a temporary user if not logged in
        let userId;
        let isNewUser = false;

        if (req.user && req.user._id) {
            // If user is logged in, use their ID
            userId = req.user._id;
        } else {
            // Check if user exists with this email
            let existingUser = await User.findOne({ email: calendlyUser.email });

            if (existingUser) {
                // Use existing user
                userId = existingUser._id;
            } else {
                // Create new temporary user
                const tempUser = await User.create({
                    first_name: calendlyUser.name.split(' ')[0],
                    last_name: calendlyUser.name.split(' ').slice(1).join(' '),
                    email: calendlyUser.email,
                    password: Math.random().toString(36).slice(-8), // Random temporary password
                    isTemporary: true
                });
                userId = tempUser._id;
                isNewUser = true;
            }
        }

        // Check if user already exists in Calendly profiles
        let calendlyProfile = await Calendly.findOne({ calendlyUserId: calendlyUser.uri });

        if (calendlyProfile) {
            // Update existing profile
            calendlyProfile.userId = userId; // Ensure userId is set
            calendlyProfile.accessToken = access_token;
            calendlyProfile.refreshToken = refresh_token;
            calendlyProfile.email = calendlyUser.email;
            calendlyProfile.name = calendlyUser.name;
            calendlyProfile.organization = calendlyUser.current_organization;
            await calendlyProfile.save();
        } else {
            // Create new profile
            calendlyProfile = await Calendly.create({
                userId: userId,
                calendlyUserId: calendlyUser.uri,
                accessToken: access_token,
                refreshToken: refresh_token,
                email: calendlyUser.email,
                name: calendlyUser.name,
                organization: calendlyUser.current_organization
            });
        }

        // Return success response with all necessary tokens
        res.json({
            success: true,
            data: {
                user: {
                    _id: userId,
                    email: calendlyUser.email,
                    first_name: calendlyUser.name.split(' ')[0],
                    last_name: calendlyUser.name.split(' ').slice(1).join(' '),
                    isTemporary: isNewUser
                },
                calendly: {
                    calendlyUserId: calendlyProfile.calendlyUserId,
                    email: calendlyProfile.email,
                    name: calendlyProfile.name,
                    organization: calendlyProfile.organization,
                    accessToken: access_token,
                    refreshToken: refresh_token
                },
                token: generateToken(userId), // JWT token for authentication
                isNewUser: isNewUser,
                message: isNewUser ? 'New user account created with Calendly integration' : 'Existing user account connected with Calendly'
            }
        });

    } catch (error) {
        console.error('Calendly auth error:', error.response?.data || error.message);
        res.status(500);
        throw new Error('Failed to authenticate with Calendly: ' + (error.response?.data?.message || error.message));
    }
});

// @desc    Get current user's Calendly profile
// @route   GET /api/calendly/me
// @access  Private
const getCurrentUser = asyncHandler(async (req, res) => {
    try {
        // Check if user exists in request
        if (!req.user || !req.user._id) {
            res.status(401);
            throw new Error('Not authorized, no token or invalid token');
        }

        console.log('Looking for Calendly profile for user:', req.user._id);

        const calendlyProfile = await Calendly.findOne({ userId: req.user._id });
        console.log('Found Calendly profile:', calendlyProfile);

        if (!calendlyProfile) {
            res.status(404);
            throw new Error('Calendly profile not found. Please connect your Calendly account first.');
        }

        // Get fresh user data from Calendly API
        try {
            const userResponse = await axios.get(`${CALENDLY_API_BASE_URL}/users/me`, {
                headers: {
                    'Authorization': `Bearer ${calendlyProfile.accessToken}`
                }
            });

            const calendlyUser = userResponse.data.resource;

            // Update local profile with latest data
            calendlyProfile.name = calendlyUser.name;
            calendlyProfile.email = calendlyUser.email;
            calendlyProfile.organization = calendlyUser.current_organization;
            await calendlyProfile.save();

            res.json({
                success: true,
                data: {
                    calendlyUserId: calendlyProfile.calendlyUserId,
                    email: calendlyProfile.email,
                    name: calendlyProfile.name,
                    organization: calendlyProfile.organization,
                    accessToken: calendlyProfile.accessToken,
                    userId: req.user._id
                }
            });
        } catch (calendlyError) {
            // If Calendly API call fails, return local data
            console.error('Error fetching fresh Calendly data:', calendlyError.message);
            res.json({
                success: true,
                data: {
                    calendlyUserId: calendlyProfile.calendlyUserId,
                    email: calendlyProfile.email,
                    name: calendlyProfile.name,
                    organization: calendlyProfile.organization,
                    accessToken: calendlyProfile.accessToken,
                    userId: req.user._id
                },
                warning: 'Using cached data - could not fetch latest from Calendly'
            });
        }
    } catch (error) {
        console.error('Error in getCurrentUser:', error);
        res.status(error.status || 500);
        throw new Error(error.message || 'Failed to get Calendly profile');
    }
});

// @desc    Disconnect Calendly integration
// @route   DELETE /api/calendly/disconnect
// @access  Private
const disconnectCalendly = asyncHandler(async (req, res) => {
    const calendlyProfile = await Calendly.findOneAndDelete({ userId: req.user._id });

    if (!calendlyProfile) {
        res.status(404);
        throw new Error('Calendly profile not found');
    }

    res.json({
        success: true,
        message: 'Calendly disconnected successfully'
    });
});

// @desc    Get user's scheduling link
// @route   GET /api/calendly/scheduling-link
// @access  Private
const getSchedulingLink = asyncHandler(async (req, res) => {
    const calendlyProfile = await Calendly.findOne({ userId: req.user._id });

    if (!calendlyProfile) {
        res.status(404);
        throw new Error('Calendly profile not found');
    }

    try {
        // First get the user's URI from their profile
        const userUri = calendlyProfile.calendlyUserId;

        // Then fetch their event types (scheduling links)
        const response = await axios.get(`${CALENDLY_API_BASE_URL}/event_types`, {
            headers: {
                'Authorization': `Bearer ${calendlyProfile.accessToken}`
            },
            params: {
                user: userUri
            }
        });

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Calendly API error:', error.response?.data || error.message);
        res.status(500);
        throw new Error('Failed to fetch scheduling link');
    }
});

// @desc    Get user's scheduled events
// @route   GET /api/calendly/events
// @access  Private
const getScheduledEvents = asyncHandler(async (req, res) => {
    const calendlyProfile = await Calendly.findOne({ userId: req.user._id });

    if (!calendlyProfile) {
        res.status(404);
        throw new Error('Calendly profile not found');
    }

    try {
        const response = await axios.get(`${CALENDLY_API_BASE_URL}/scheduled_events`, {
            headers: {
                'Authorization': `Bearer ${calendlyProfile.accessToken}`
            },
            params: {
                user: calendlyProfile.calendlyUserId,
                count: 10
            }
        });

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Calendly API error:', error.response?.data || error.message);
        res.status(500);
        throw new Error('Failed to fetch scheduled events');
    }
});

// @desc    Create scheduling link with parameters
// @route   POST /api/calendly/create-scheduling-link
// @access  Private
const createSchedulingLink = asyncHandler(async (req, res) => {
    const calendlyProfile = await Calendly.findOne({ userId: req.user._id });

    if (!calendlyProfile) {
        res.status(404);
        throw new Error('Calendly profile not found');
    }

    try {
        const {
            eventTypeSlug,
            inviteeEmail,
            name,
            date,
            duration
        } = req.body;

        if (!eventTypeSlug) {
            res.status(400);
            throw new Error('Event type slug is required');
        }

        // First get the event type details
        const eventTypesResponse = await axios.get(`${CALENDLY_API_BASE_URL}/event_types`, {
            headers: {
                'Authorization': `Bearer ${calendlyProfile.accessToken}`
            },
            params: {
                user: calendlyProfile.calendlyUserId
            }
        });

        // Find the event type that matches the slug
        const eventType = eventTypesResponse.data.collection.find(
            event => event.slug === eventTypeSlug
        );

        if (!eventType) {
            res.status(404);
            throw new Error('Event type not found');
        }

        // Create scheduling link
        const schedulingResponse = await axios.post(
            `${CALENDLY_API_BASE_URL}/scheduling_links`,
            {
                max_event_count: 1,
                owner: eventType.uri,
                owner_type: "EventType",
                ...(inviteeEmail && { email: inviteeEmail }),
                ...(name && { name: name }),
                ...(date && { date: date }),
                ...(duration && { duration: duration })
            },
            {
                headers: {
                    'Authorization': `Bearer ${calendlyProfile.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            data: schedulingResponse.data
        });
    } catch (error) {
        console.error('Calendly API error:', error.response?.data || error.message);
        res.status(500);
        throw new Error('Failed to create scheduling link: ' + (error.response?.data?.message || error.message));
    }
});

// @desc    Get available time slots
// @route   GET /api/calendly/available-times
// @access  Private
const getAvailableTimes = asyncHandler(async (req, res) => {
    const calendlyProfile = await Calendly.findOne({ userId: req.user._id });

    if (!calendlyProfile) {
        res.status(404);
        throw new Error('Calendly profile not found');
    }

    try {
        const { eventTypeUri, days = 7 } = req.query;

        if (!eventTypeUri) {
            res.status(400);
            throw new Error('Event type URI is required');
        }

        console.log('Attempting to connect to Calendly API...');
        console.log('Access Token:', calendlyProfile.accessToken ? 'Present' : 'Missing');
        console.log('User ID:', calendlyProfile.calendlyUserId);
        console.log('Organization:', calendlyProfile.organization);
        console.log('Event Type URI received:', eventTypeUri);

        // Function to test connectivity
        const testConnectivity = async (domain) => {
            try {
                const testResponse = await axios.get(`https://${domain}`, {
                    timeout: 5000 // 5 second timeout
                });
                return true;
            } catch (error) {
                if (error.code === 'ENOTFOUND') {
                    console.error(`DNS resolution failed for ${domain}`);
                    return false;
                }
                // If we get any other error, the domain is reachable
                return true;
            }
        };

        // Test connectivity to Calendly domains
        const authDomainReachable = await testConnectivity('auth.calendly.com');
        const apiDomainReachable = await testConnectivity('api.calendly.com');

        if (!authDomainReachable || !apiDomainReachable) {
            res.status(503);
            throw new Error(
                'Cannot connect to Calendly servers. Please check your internet connection and try again. ' +
                'If you are using a proxy or firewall, ensure that calendly.com domains are accessible.'
            );
        }

        // Try to refresh token with better error handling
        try {
            const refreshResponse = await axios.post(`${CALENDLY_AUTH_BASE_URL}/oauth/token`, {
                client_id: process.env.CALENDLY_CLIENT_ID,
                client_secret: process.env.CALENDLY_CLIENT_SECRET,
                refresh_token: calendlyProfile.refreshToken,
                grant_type: 'refresh_token'
            }, {
                timeout: 10000, // 10 second timeout
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Update the profile with new tokens
            calendlyProfile.accessToken = refreshResponse.data.access_token;
            calendlyProfile.refreshToken = refreshResponse.data.refresh_token;
            await calendlyProfile.save();

            console.log('Token refreshed successfully');
        } catch (refreshError) {
            console.error('Error refreshing token:', refreshError);
            
            if (refreshError.code === 'ENOTFOUND') {
                res.status(503);
                throw new Error(
                    'Cannot connect to Calendly authentication servers. ' +
                    'Please check your internet connection and try again.'
                );
            } else if (refreshError.code === 'ECONNREFUSED') {
                res.status(503);
                throw new Error(
                    'Connection to Calendly servers was refused. ' +
                    'This might be due to firewall settings or proxy configuration.'
                );
            } else if (refreshError.code === 'ETIMEDOUT') {
                res.status(503);
                throw new Error(
                    'Connection to Calendly servers timed out. ' +
                    'Please check your internet connection and try again.'
                );
            } else {
                res.status(401);
                throw new Error(
                    'Failed to refresh authentication token. ' +
                    'Please try reconnecting your Calendly account.'
                );
            }
        }

        // First verify the user's access
        const userResponse = await axios.get(`${CALENDLY_API_BASE_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${calendlyProfile.accessToken}`
            }
        });

        console.log('User verification successful:', userResponse.data.resource);

        // Get event types without organization filter first
        const eventTypesResponse = await axios.get(`${CALENDLY_API_BASE_URL}/event_types`, {
            headers: {
                'Authorization': `Bearer ${calendlyProfile.accessToken}`
            },
            params: {
                user: calendlyProfile.calendlyUserId,
                active: true
            }
        });

        if (!eventTypesResponse.data.collection || eventTypesResponse.data.collection.length === 0) {
            console.log('No event types found, trying with organization...');
            // Try with organization if no event types found
            const orgEventTypesResponse = await axios.get(`${CALENDLY_API_BASE_URL}/event_types`, {
                headers: {
                    'Authorization': `Bearer ${calendlyProfile.accessToken}`
                },
                params: {
                    organization: calendlyProfile.organization,
                    active: true
                }
            });
            
            if (!orgEventTypesResponse.data.collection || orgEventTypesResponse.data.collection.length === 0) {
                res.status(404);
                throw new Error('No event types found in your account. Please create an event type first.');
            }
            
            eventTypesResponse.data = orgEventTypesResponse.data;
        }

        console.log('Successfully retrieved event types');
        console.log('Available event types:', eventTypesResponse.data.collection.map(et => ({
            slug: et.slug,
            uri: et.uri,
            name: et.name,
            scheduling_url: et.scheduling_url
        })));

        // Extract the identifier from the provided URI
        let eventTypeIdentifier;
        if (eventTypeUri.includes('/')) {
            // If it's a full URI, get the last part
            eventTypeIdentifier = eventTypeUri.split('/').pop();
        } else {
            // If it's just a slug or UUID
            eventTypeIdentifier = eventTypeUri;
        }

        console.log('Looking for event type with identifier:', eventTypeIdentifier);

        // Find the matching event type with more flexible matching
        const eventType = eventTypesResponse.data.collection.find(event => {
            const matchSlug = event.slug === eventTypeIdentifier;
            const matchUri = event.uri.includes(eventTypeIdentifier);
            const matchSchedulingUrl = event.scheduling_url && (
                event.scheduling_url.includes(eventTypeIdentifier) ||
                event.scheduling_url.includes(encodeURIComponent(eventTypeIdentifier))
            );
            
            console.log('Matching against event type:', {
                eventSlug: event.slug,
                eventUri: event.uri,
                eventSchedulingUrl: event.scheduling_url,
                matchSlug,
                matchUri,
                matchSchedulingUrl
            });
            
            return matchSlug || matchUri || matchSchedulingUrl;
        });

        if (!eventType) {
            res.status(404);
            throw new Error(`Event type not found. Available event types: ${eventTypesResponse.data.collection.map(et => `${et.name} (${et.slug})`).join(', ')}`);
        }

        console.log('Found matching event type:', {
            name: eventType.name,
            slug: eventType.slug,
            uri: eventType.uri,
            scheduling_url: eventType.scheduling_url
        });

        const now = new Date();
        const startTime = new Date(now.getTime() + 30 * 60000); // 30 minutes from now
        const endTime = new Date(now.getTime() + (parseInt(days) * 24 * 60 * 60000)); // X days from now

        console.log('Fetching availability for time range:', {
            start: startTime.toISOString(),
            end: endTime.toISOString(),
            eventTypeUri: eventType.uri
        });

        const availabilityResponse = await axios.get(`${CALENDLY_API_BASE_URL}/event_type_available_times`, {
            headers: {
                'Authorization': `Bearer ${calendlyProfile.accessToken}`
            },
            params: {
                event_type: eventType.uri,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString()
            }
        });

        console.log('Successfully retrieved availability');

        const availableTimes = availabilityResponse.data.available_times || [];
        console.log(`Found ${availableTimes.length} available time slots`);

        res.json({
            success: true,
            data: {
                eventType: {
                    uri: eventType.uri,
                    slug: eventType.slug,
                    name: eventType.name,
                    duration: eventType.duration,
                    scheduling_url: eventType.scheduling_url
                },
                availableTimes: availableTimes,
                timeRange: {
                    start: startTime.toISOString(),
                    end: endTime.toISOString()
                }
            }
        });
    } catch (error) {
        console.error('Detailed error:', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            stack: error.stack
        });

        // Enhanced error handling
        if (error.code === 'ENOTFOUND') {
            res.status(503);
            throw new Error(
                'Cannot connect to Calendly servers. Please check:\n' +
                '1. Your internet connection is working\n' +
                '2. You can access calendly.com in your browser\n' +
                '3. Your firewall or proxy settings allow access to Calendly domains'
            );
        } else if (error.code === 'ECONNREFUSED') {
            res.status(503);
            throw new Error('Connection to Calendly servers was refused. Please check your network settings.');
        } else if (error.code === 'ETIMEDOUT') {
            res.status(503);
            throw new Error('Connection to Calendly servers timed out. Please try again.');
        } else if (error.response?.status === 401) {
            res.status(401);
            throw new Error('Calendly authentication failed. Please reconnect your Calendly account.');
        } else if (error.response?.status === 403) {
            res.status(403);
            throw new Error('Access denied. Please check your Calendly permissions.');
        }

        res.status(error.response?.status || 500);
        throw new Error('Failed to fetch available times: ' + (error.response?.data?.message || error.message));
    }
});

// @desc    Book a meeting
// @route   POST /api/calendly/book-meeting
// @access  Private
const bookMeeting = asyncHandler(async (req, res) => {
    const calendlyProfile = await Calendly.findOne({ userId: req.user._id });

    if (!calendlyProfile) {
        res.status(404);
        throw new Error('Calendly profile not found');
    }

    try {
        const {
            eventTypeUri,
            startTime,
            email,
            name,
            guests = [],
            questions = {}
        } = req.body;

        if (!eventTypeUri || !startTime || !email || !name) {
            res.status(400);
            throw new Error('Event type URI, start time, email, and name are required');
        }

        // Validate and format the start time
        const now = new Date();
        const requestedStartTime = new Date(startTime);

        // Add 30 minutes buffer to current time
        const minimumStartTime = new Date(now.getTime() + 30 * 60000);

        if (isNaN(requestedStartTime.getTime())) {
            res.status(400);
            throw new Error('Invalid start time format. Please use ISO 8601 format (e.g., 2024-03-21T15:00:00Z)');
        }

        if (requestedStartTime <= minimumStartTime) {
            res.status(400);
            throw new Error(`Start time must be at least 30 minutes in the future. Current time: ${now.toISOString()}, Earliest possible time: ${minimumStartTime.toISOString()}`);
        }

        // Round to next 15-minute interval
        const minutes = requestedStartTime.getMinutes();
        const roundedMinutes = Math.ceil(minutes / 15) * 15;
        requestedStartTime.setMinutes(roundedMinutes, 0, 0);

        // Get event types to find the correct URI
        const eventTypesResponse = await axios.get(`${CALENDLY_API_BASE_URL}/event_types`, {
            headers: {
                'Authorization': `Bearer ${calendlyProfile.accessToken}`
            },
            params: {
                user: calendlyProfile.calendlyUserId
            }
        });

        // Find the matching event type
        const eventType = eventTypesResponse.data.collection.find(event => {
            return event.uri === eventTypeUri ||
                event.scheduling_url === eventTypeUri ||
                eventTypeUri.includes(event.slug);
        });

        if (!eventType) {
            res.status(404);
            throw new Error('Event type not found. Please provide a valid event type URI or scheduling URL');
        }

        // Check availability for the specific time slot
        const availabilityResponse = await axios.get(`${CALENDLY_API_BASE_URL}/event_type_available_times`, {
            headers: {
                'Authorization': `Bearer ${calendlyProfile.accessToken}`
            },
            params: {
                event_type: eventType.uri,
                start_time: requestedStartTime.toISOString(),
                end_time: new Date(requestedStartTime.getTime() + 24 * 60 * 60000).toISOString() // Look 24 hours ahead
            }
        });

        const availableTimes = availabilityResponse.data.available_times || [];
        const isTimeAvailable = availableTimes.some(time => new Date(time).getTime() === requestedStartTime.getTime());

        if (!isTimeAvailable) {
            const nextAvailableTime = availableTimes[0];
            res.status(400);
            throw new Error(
                'The requested time slot is not available. ' +
                (nextAvailableTime ?
                    `Next available time: ${nextAvailableTime}` :
                    'No available times in the next 24 hours.')
            );
        }

        // Create the scheduling payload
        const schedulingPayload = {
            first_name: name.split(' ')[0],
            last_name: name.split(' ').slice(1).join(' ') || '',
            email: email,
            event_type: eventType.uri,
            start_time: requestedStartTime.toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            guests: guests.map(guest => ({ email: guest })),
            questions_and_responses: Object.entries(questions).map(([question, answer]) => ({
                question,
                answer
            }))
        };

        console.log('Scheduling payload:', JSON.stringify(schedulingPayload, null, 2));

        // Schedule the event
        const schedulingResponse = await axios.post(
            `${CALENDLY_API_BASE_URL}/scheduled_events`,
            schedulingPayload,
            {
                headers: {
                    'Authorization': `Bearer ${calendlyProfile.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            data: {
                event: schedulingResponse.data,
                scheduledTime: requestedStartTime.toISOString(),
                message: 'Meeting scheduled successfully'
            }
        });
    } catch (error) {
        console.error('Calendly API error:', error.response?.data || error.message);

        if (error.response?.data?.details) {
            const details = error.response.data.details;
            const messages = details.map(detail => `${detail.parameter}: ${detail.message}`).join(', ');
            res.status(400);
            throw new Error(`Validation error: ${messages}`);
        }

        res.status(500);
        throw new Error('Failed to book meeting: ' + (error.response?.data?.message || error.message));
    }
});

// @desc    Create a new Calendly event type
// @route   POST /api/calendly/event-types
// @access  Private
const createEventType = asyncHandler(async (req, res) => {
    try {
        const calendlyProfile = await Calendly.findOne({ userId: req.user._id });
        
        if (!calendlyProfile) {
            res.status(404);
            throw new Error('Calendly profile not found. Please connect your Calendly account first.');
        }

        // First, get user details
        const userResponse = await axios.get(`${CALENDLY_API_BASE_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${calendlyProfile.accessToken}`
            }
        });

        const userData = userResponse.data.resource;
        console.log('User Data:', userData);

        const {
            name,
            slug,
            description,
            duration,
            color,
            kind = "solo",
            type = "StandardEventType"
        } = req.body;

        // Validate required fields
        if (!name || !slug || !duration) {
            res.status(400);
            throw new Error('Please provide name, slug, and duration for the event type');
        }

        // Create event type data according to Calendly's API specification
        const eventTypeData = {
            name,
            slug,
            color: color || "#0088cc",
            description: description || "",
            length: parseInt(duration),
            type: "StandardEventType",
            kind: "solo",
            pooling_type: "round_robin",
            active: true,
            scheduling_method: "instant",
            minimum_scheduling_notice: {
                type: "minutes",
                value: 30
            }
        };

        console.log('Creating event type with data:', JSON.stringify(eventTypeData, null, 2));

        // Get the user UUID from the URI
        const userUuid = userData.uri.split('/').pop();

        // Create the event type using the user's endpoint
        const response = await axios.post(
            `${CALENDLY_API_BASE_URL}/users/${userUuid}/event_types`,
            eventTypeData,
            {
                headers: {
                    'Authorization': `Bearer ${calendlyProfile.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(201).json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('Error creating Calendly event type:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            try {
                // Try to refresh the token
                const refreshResponse = await axios.post(`${CALENDLY_AUTH_BASE_URL}/oauth/token`, {
                    client_id: process.env.CALENDLY_CLIENT_ID,
                    client_secret: process.env.CALENDLY_CLIENT_SECRET,
                    refresh_token: calendlyProfile.refreshToken,
                    grant_type: 'refresh_token'
                });

                calendlyProfile.accessToken = refreshResponse.data.access_token;
                calendlyProfile.refreshToken = refreshResponse.data.refresh_token;
                await calendlyProfile.save();

                res.status(401).json({
                    success: false,
                    message: 'Token refreshed. Please try your request again.'
                });
                return;
            } catch (refreshError) {
                console.error('Error refreshing token:', refreshError);
                res.status(401);
                throw new Error('Authentication failed. Please reconnect your Calendly account.');
            }
        }

        if (error.response?.status === 404) {
            res.status(404);
            throw new Error('Unable to create event type. Please ensure you have the correct permissions in your Calendly account.');
        } else if (error.response?.status === 403) {
            res.status(403);
            throw new Error('Access denied. Your Calendly account may not have permission to create event types.');
        } else if (error.response?.data?.details) {
            const details = error.response.data.details;
            const messages = details.map(detail => `${detail.parameter}: ${detail.message}`).join(', ');
            res.status(400);
            throw new Error(`Validation error: ${messages}`);
        }

        res.status(error.response?.status || 500);
        throw new Error(error.response?.data?.message || 'Failed to create Calendly event type');
    }
});

// @desc    Refresh Calendly access token
// @route   POST /api/calendly/refresh-token
// @access  Private
const refreshAccessToken = asyncHandler(async (req, res) => {
    const calendlyProfile = await Calendly.findOne({ userId: req.user._id });

    if (!calendlyProfile) {
        res.status(404);
        throw new Error('Calendly profile not found. Please connect your Calendly account first.');
    }

    try {
        const response = await axios.post(`${CALENDLY_AUTH_BASE_URL}/oauth/token`, {
            client_id: process.env.CALENDLY_CLIENT_ID,
            client_secret: process.env.CALENDLY_CLIENT_SECRET,
            refresh_token: calendlyProfile.refreshToken,
            grant_type: 'refresh_token'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const { access_token, refresh_token } = response.data;

        // Update the profile with the new tokens
        calendlyProfile.accessToken = access_token;
        calendlyProfile.refreshToken = refresh_token;
        await calendlyProfile.save();

        res.json({
            success: true,
            data: {
                accessToken: access_token,
                refreshToken: refresh_token
            }
        });
    } catch (error) {
        console.error('Error refreshing access token:', error.response?.data || error.message);
        res.status(500);
        throw new Error('Failed to refresh access token: ' + (error.response?.data?.message || error.message));
    }
});

// @desc    Add available times to event type
// @route   POST /api/calendly/event-types/:eventTypeId/available-times
// @access  Private
const addEventTypeAvailability = asyncHandler(async (req, res) => {
    try {
        const calendlyProfile = await Calendly.findOne({ userId: req.user._id });
        
        if (!calendlyProfile) {
            res.status(404);
            throw new Error('Calendly profile not found. Please connect your Calendly account first.');
        }

        const { eventTypeId } = req.params;
        const { 
            rules,
            intervals,
            timezone = "UTC"
        } = req.body;

        // Validate required fields
        if (!rules || !Array.isArray(rules) || rules.length === 0) {
            res.status(400);
            throw new Error('Please provide at least one availability rule');
        }

        // Format the availability rules
        const availabilityRules = rules.map(rule => ({
            type: "wday",
            wday: rule.dayOfWeek,
            intervals: rule.intervals.map(interval => ({
                from: interval.from,
                to: interval.to
            }))
        }));

        const availabilityData = {
            user: calendlyProfile.calendlyUserId,
            timezone: timezone,
            rules: availabilityRules
        };

        console.log('Setting availability with data:', JSON.stringify(availabilityData, null, 2));

        // Set the availability using Calendly's API
        const response = await axios.post(
            `${CALENDLY_API_BASE_URL}/event_types/${eventTypeId}/user_availability_schedules`,
            availabilityData,
            {
                headers: {
                    'Authorization': `Bearer ${calendlyProfile.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(201).json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('Error setting event type availability:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            try {
                // Try to refresh the token
                const refreshResponse = await axios.post(`${CALENDLY_AUTH_BASE_URL}/oauth/token`, {
                    client_id: process.env.CALENDLY_CLIENT_ID,
                    client_secret: process.env.CALENDLY_CLIENT_SECRET,
                    refresh_token: calendlyProfile.refreshToken,
                    grant_type: 'refresh_token'
                });

                calendlyProfile.accessToken = refreshResponse.data.access_token;
                calendlyProfile.refreshToken = refreshResponse.data.refresh_token;
                await calendlyProfile.save();

                res.status(401).json({
                    success: false,
                    message: 'Token refreshed. Please try your request again.'
                });
                return;
            } catch (refreshError) {
                console.error('Error refreshing token:', refreshError);
                res.status(401);
                throw new Error('Authentication failed. Please reconnect your Calendly account.');
            }
        }

        if (error.response?.status === 404) {
            res.status(404);
            throw new Error('Event type not found or you do not have permission to modify it.');
        } else if (error.response?.status === 403) {
            res.status(403);
            throw new Error('Access denied. You may not have permission to modify this event type.');
        } else if (error.response?.data?.details) {
            const details = error.response.data.details;
            const messages = details.map(detail => `${detail.parameter}: ${detail.message}`).join(', ');
            res.status(400);
            throw new Error(`Validation error: ${messages}`);
        }

        res.status(error.response?.status || 500);
        throw new Error(error.response?.data?.message || 'Failed to set event type availability');
    }
});

export {
    initiateCalendlyAuth,
    handleCalendlyCallback,
    getCurrentUser,
    disconnectCalendly,
    getSchedulingLink,
    getScheduledEvents,
    createSchedulingLink,
    bookMeeting,
    getAvailableTimes,
    createEventType,
    refreshAccessToken,
    addEventTypeAvailability
}; 