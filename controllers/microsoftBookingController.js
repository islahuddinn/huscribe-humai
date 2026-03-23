import { ConfidentialClientApplication } from '@azure/msal-node';
import axios from 'axios';
import asyncHandler from 'express-async-handler';

/////== Microsoft Graph API base URL
const GRAPH_API_ENDPOINT = 'https://graph.microsoft.com/v1.0';

//////==== Helper function to get Microsoft Graph API access token
const getMicrosoftGraphToken = async () => {
    if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET || !process.env.MICROSOFT_TENANT_ID) {
        throw new Error('Missing required Microsoft credentials in environment variables');
    }

    const msalConfig = {
        auth: {
            clientId: process.env.MICROSOFT_CLIENT_ID,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
            authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`
        }
    };

    const cca = new ConfidentialClientApplication(msalConfig);
    
    try {
        const result = await cca.acquireTokenByClientCredential({
            scopes: ['https://graph.microsoft.com/.default']
        });
        
        if (!result || !result.accessToken) {
            throw new Error('Failed to acquire access token');
        }
        
        return result.accessToken;
    } catch (error) {
        console.error('Token acquisition error:', error);
        throw new Error(`Error acquiring token: ${error.message}`);
    }
};

///////===== Get all booking businesses with detailed information
export const getBookingBusinesses = asyncHandler(async (req, res) => {
    try {
        const token = await getMicrosoftGraphToken();
        
        console.log('Making request to Microsoft Bookings API...');
        const response = await axios.get(`${GRAPH_API_ENDPOINT}/solutions/bookingBusinesses`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        //// Format the response to show important details
        const formattedBusinesses = response.data.value.map(business => ({
            id: business.id,
            displayName: business.displayName,
            businessType: business.businessType,
            phone: business.phone,
            email: business.email,
            websiteUrl: business.websiteUrl,
            defaultCurrencyIso: business.defaultCurrencyIso,
            isPublished: business.isPublished
        }));

        console.log('Found businesses:', formattedBusinesses.length);
        res.json({
            count: formattedBusinesses.length,
            businesses: formattedBusinesses
        });
    } catch (error) {
        console.error('Booking businesses error:', error.response?.data || error.message);
        
        if (error.response?.status === 403) {
            res.status(403).json({
                error: 'Permission denied',
                message: 'Your application might not have the correct permissions or Bookings might not be enabled for your organization',
                details: error.response.data,
                help: 'Please ensure you have Microsoft Bookings enabled in your Microsoft 365 subscription and proper permissions are granted in Azure AD'
            });
        } else {
            res.status(error.response?.status || 500).json({
                error: 'Error fetching booking businesses',
                details: error.response?.data || error.message
            });
        }
    }
});

//////====    Get all appointments with optional filtering
export const getBookingAppointments = asyncHandler(async (req, res) => {
    try {
        const { businessId, startDate, endDate, status } = req.query;
        const token = await getMicrosoftGraphToken();
        
        let url = `${GRAPH_API_ENDPOINT}/solutions/bookingBusinesses/${businessId}/appointments`;
        
        const params = new URLSearchParams();
        if (startDate && endDate) {
            params.append('$filter', `start/dateTime ge '${startDate}' and end/dateTime le '${endDate}'`);
        }
        if (status) {
            params.append('$filter', `status eq '${status}'`);
        }
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const formattedAppointments = response.data.value.map(apt => ({
            id: apt.id,
            subject: apt.subject,
            startTime: apt.start.dateTime,
            endTime: apt.end.dateTime,
            status: apt.status,
            customerName: apt.customerName,
            customerEmail: apt.customerEmailAddress,
            serviceId: apt.serviceId,
            serviceName: apt.serviceName,
            staffMemberIds: apt.staffMemberIds
        }));

        res.json(formattedAppointments);
    } catch (error) {
        console.error('Error fetching appointments:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Error fetching appointments',
            details: error.response?.data || error.message
        });
    }
});

////===== Get a single appointment by ID
export const getBookingAppointmentById = asyncHandler(async (req, res) => {
    try {
        const { businessId, appointmentId } = req.params;
        const token = await getMicrosoftGraphToken();

        const response = await axios.get(
            `${GRAPH_API_ENDPOINT}/solutions/bookingBusinesses/${businessId}/appointments/${appointmentId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            error: 'Error fetching appointment',
            details: error.response?.data || error.message
        });
    }
});

////==== Get appointments dashboard summary
export const getAppointmentsDashboard = asyncHandler(async (req, res) => {
    try {
        const { businessId } = req.query;
        const token = await getMicrosoftGraphToken();

        const today = new Date();
        const startOfDay = new Date(today.setHours(0,0,0,0)).toISOString();
        const endOfDay = new Date(today.setHours(23,59,59,999)).toISOString();

        const todayResponse = await axios.get(
            `${GRAPH_API_ENDPOINT}/solutions/bookingBusinesses/${businessId}/appointments?$filter=start/dateTime ge '${startOfDay}' and end/dateTime le '${endOfDay}'`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const appointments = todayResponse.data.value;
        const summary = {
            totalAppointmentsToday: appointments.length,
            upcomingToday: appointments.filter(apt => new Date(apt.start.dateTime) > new Date()).length,
            completedToday: appointments.filter(apt => apt.status === 'completed').length,
            cancelledToday: appointments.filter(apt => apt.status === 'cancelled').length,
            appointmentsToday: appointments.map(apt => ({
                id: apt.id,
                subject: apt.subject,
                startTime: apt.start.dateTime,
                endTime: apt.end.dateTime,
                status: apt.status,
                customerName: apt.customerName
            }))
        };

        res.json(summary);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            error: 'Error fetching dashboard data',
            details: error.response?.data || error.message
        });
    }
});

////===== Create new appointment
export const createBookingAppointment = asyncHandler(async (req, res) => {
    try {
        const { businessId } = req.query;
        const appointmentDetails = req.body;
        const token = await getMicrosoftGraphToken();
        
        const response = await axios.post(
            `${GRAPH_API_ENDPOINT}/solutions/bookingBusinesses/${businessId}/appointments`,
            appointmentDetails,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        res.status(201).json(response.data);
    } catch (error) {
        res.status(500);
        throw new Error('Error creating appointment: ' + error.message);
    }
});

//////===== Update appointment
export const updateBookingAppointment = asyncHandler(async (req, res) => {
    try {
        const { businessId } = req.query;
        const { appointmentId } = req.params;
        const updateDetails = req.body;
        const token = await getMicrosoftGraphToken();

        const response = await axios.patch(
            `${GRAPH_API_ENDPOINT}/solutions/bookingBusinesses/${businessId}/appointments/${appointmentId}`,
            updateDetails,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        res.json(response.data);
    } catch (error) {
        res.status(500);
        throw new Error('Error updating appointment: ' + error.message);
    }
});

//////==== Delete appointment
export const deleteBookingAppointment = asyncHandler(async (req, res) => {
    try {
        const { businessId } = req.query;
        const { appointmentId } = req.params;
        const token = await getMicrosoftGraphToken();

        await axios.delete(
            `${GRAPH_API_ENDPOINT}/solutions/bookingBusinesses/${businessId}/appointments/${appointmentId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        res.status(204).send();
    } catch (error) {
        res.status(500);
        throw new Error('Error deleting appointment: ' + error.message);
    }
});

//////==== Get all customers
export const getBookingCustomers = asyncHandler(async (req, res) => {
    try {
        const { businessId } = req.query;
        
        if (!businessId) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'businessId is required'
            });
        }

        const token = await getMicrosoftGraphToken();
        
        const response = await axios.get(
            `${GRAPH_API_ENDPOINT}/solutions/bookingBusinesses/${businessId}/customers`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Format customer data for better readability
        const customers = response.data.value.map(customer => ({
            id: customer.id,
            displayName: customer.displayName,
            emailAddress: customer.emailAddress,
            phone: customer.phone,
            addresses: customer.addresses
        }));

        res.json({
            count: customers.length,
            customers
        });
    } catch (error) {
        console.error('Customer fetch error:', error.response?.data);
        
        if (error.response?.status === 404) {
            res.status(404).json({
                error: 'Business not found',
                message: 'The specified booking business was not found',
                details: error.response.data
            });
        } else {
            res.status(error.response?.status || 500).json({
                error: 'Error fetching customers',
                message: error.response?.data?.error?.message || error.message
            });
        }
    }
});

//////==== Get all services
export const getBookingServices = asyncHandler(async (req, res) => {
    try {
        const { businessId } = req.query;
        
        if (!businessId) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'businessId is required'
            });
        }

        const token = await getMicrosoftGraphToken();
        
        const response = await axios.get(
            `${GRAPH_API_ENDPOINT}/solutions/bookingBusinesses/${businessId}/services`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Format service data for better readability
        const services = response.data.value.map(service => ({
            id: service.id,
            displayName: service.displayName,
            duration: service.defaultDuration,
            price: service.price,
            description: service.description,
            isHiddenFromCustomers: service.isHiddenFromCustomers
        }));

        res.json({
            count: services.length,
            services
        });
    } catch (error) {
        console.error('Services fetch error:', error.response?.data);
        
        if (error.response?.status === 404) {
            res.status(404).json({
                error: 'Business not found',
                message: 'The specified booking business was not found',
                details: error.response.data
            });
        } else {
            res.status(error.response?.status || 500).json({
                error: 'Error fetching services',
                message: error.response?.data?.error?.message || error.message
            });
        }
    }
});

///////===== Get all staff members
export const getBookingStaff = asyncHandler(async (req, res) => {
    try {
        const { businessId } = req.query;
        
        if (!businessId) {
            return res.status(400).json({
                error: 'Missing parameter',
                message: 'businessId is required'
            });
        }

        const token = await getMicrosoftGraphToken();
        
        const response = await axios.get(
            `${GRAPH_API_ENDPOINT}/solutions/bookingBusinesses/${businessId}/staffMembers`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Format staff data for better readability
        const staffMembers = response.data.value.map(staff => ({
            id: staff.id,
            displayName: staff.displayName,
            emailAddress: staff.emailAddress,
            role: staff.role,
            useBusinessHours: staff.useBusinessHours,
            availabilityIsAffectedByPersonalCalendar: staff.availabilityIsAffectedByPersonalCalendar
        }));

        res.json({
            count: staffMembers.length,
            staffMembers
        });
    } catch (error) {
        console.error('Staff fetch error:', error.response?.data);
        
        if (error.response?.status === 404) {
            res.status(404).json({
                error: 'Business not found',
                message: 'The specified booking business was not found',
                details: error.response.data
            });
        } else {
            res.status(error.response?.status || 500).json({
                error: 'Error fetching staff members',
                message: error.response?.data?.error?.message || error.message
            });
        }
    }
});

//// Add this new function to test token acquisition
export const testAuth = asyncHandler(async (req, res) => {
    try {
        const token = await getMicrosoftGraphToken();
        res.json({
            message: 'Token acquired successfully',
            tokenPreview: `${token.substring(0, 10)}...${token.substring(token.length - 10)}`
        });
    } catch (error) {
        console.error('Auth test error:', error);
        res.status(500).json({
            error: 'Authentication test failed',
            message: error.message
        });
    }
});

// Update the diagnostic check to test Bookings API directly
export const diagnosticCheck = asyncHandler(async (req, res) => {
    try {
        const token = await getMicrosoftGraphToken();
        
        // First, check the token
        console.log('Token acquired:', token.substring(0, 20) + '...');
        
        // Decode the JWT token to see the permissions
        const tokenParts = token.split('.');
        const tokenPayload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        
        // Check Bookings API directly instead of /me
        const response = await axios.get('https://graph.microsoft.com/v1.0/solutions/bookingBusinesses', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({
            tokenInfo: {
                scopes: tokenPayload.roles || tokenPayload.scp, // Check roles for app permissions
                exp: new Date(tokenPayload.exp * 1000).toISOString(),
                appid: tokenPayload.appid
            },
            bookingsCheck: response.data
        });
    } catch (error) {
        console.error('Diagnostic check error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Diagnostic check failed',
            message: error.message,
            details: error.response?.data,
            tokenInfo: error.config?.headers?.Authorization ? {
                tokenPreview: error.config.headers.Authorization.substring(0, 50) + '...'
            } : 'No token info available'
        });
    }
});

// Add a new function to get detailed business information
export const getBookingBusinessDetails = asyncHandler(async (req, res) => {
    try {
        const { businessId } = req.params;
        const token = await getMicrosoftGraphToken();
        
        const response = await axios.get(`${GRAPH_API_ENDPOINT}/solutions/bookingBusinesses/${businessId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // Format the response with detailed information
        const businessDetails = {
            id: response.data.id,
            displayName: response.data.displayName,
            businessType: response.data.businessType,
            phone: response.data.phone,
            email: response.data.email,
            websiteUrl: response.data.websiteUrl,
            defaultCurrencyIso: response.data.defaultCurrencyIso,
            isPublished: response.data.isPublished,
            address: response.data.address,
            schedules: response.data.schedules,
            businessHours: response.data.businessHours
        };

        res.json(businessDetails);
    } catch (error) {
        console.error('Error fetching business details:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Error fetching business details',
            details: error.response?.data || error.message
        });
    }
});

// Create a new booking business (requires delegated permissions)
export const createBookingBusiness = asyncHandler(async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.session.msalTokens?.accessToken) {
            return res.status(401).json({
                error: 'Authentication required',
                loginUrl: '/api/auth/microsoft/login'
            });
        }

        const {
            displayName,
            email,
            phone,
            address,
            businessType = "standard",
            defaultCurrencyIso = "USD"
        } = req.body;

        // Validate required fields
        if (!displayName || !email) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'displayName and email are required'
            });
        }

        const businessData = {
            displayName,
            email,
            businessType,
            phone: phone || "",
            defaultCurrencyIso,
            address: address || {
                street: "",
                city: "",
                state: "",
                countryOrRegion: "US",
                postalCode: ""
            }
        };

        const response = await axios.post(
            'https://graph.microsoft.com/beta/solutions/bookingBusinesses',
            businessData,
            {
                headers: {
                    'Authorization': `Bearer ${req.session.msalTokens.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(201).json({
            message: 'Booking business created successfully',
            business: response.data
        });

    } catch (error) {
        console.error('Error creating booking business:', error.response?.data);
        res.status(error.response?.status || 500).json({
            error: 'Error creating booking business',
            details: error.response?.data || error.message
        });
    }
});

// Publish a booking business
export const publishBookingBusiness = asyncHandler(async (req, res) => {
    try {
        const { businessId } = req.params;
        const token = await getMicrosoftGraphToken();

        await axios.post(
            `${GRAPH_API_ENDPOINT}/solutions/bookingBusinesses/${businessId}/publish`,
            {},
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            message: 'Booking business published successfully',
            businessId
        });
    } catch (error) {
        console.error('Error publishing booking business:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Error publishing booking business',
            details: error.response?.data || error.message
        });
    }
});
