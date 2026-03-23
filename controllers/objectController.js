import Object from '../models/objectModel.js';
import asyncHandler from 'express-async-handler';
import { createSalesforceConnection } from '../config/salesforceConfig.js';
import axios from 'axios';

// Valid fields for each Salesforce object type
const VALID_FIELDS = {
    Account: [
        'Name',
        'Industry',
        'Type',
        'Phone',
        'Website',
        'BillingStreet',
        'BillingCity',
        'BillingState',
        'BillingPostalCode',
        'BillingCountry',
        'Description'
    ],
    Campaign: [
        'Name',           // Required: Name of the campaign
        'Type',          // Type of campaign (Email, Webinar, etc.)
        'Status',        // Status of campaign (Planned, In Progress, Completed, etc.)
        'StartDate',     // Start date of the campaign
        'EndDate',       // End date of the campaign
        'Description',   // Campaign description
        'IsActive',      // Whether the campaign is active
        'BudgetedCost',  // Budgeted cost of the campaign
        'ActualCost',    // Actual cost of the campaign
        'ExpectedRevenue', // Expected revenue from the campaign
        'OwnerId'        // Owner of the campaign
    ],
    Contact: [
        'FirstName',
        'LastName',
        'Email',
        'Phone',
        'Title',
        'Department',
        'MailingStreet',
        'MailingCity',
        'MailingState',
        'MailingPostalCode',
        'MailingCountry',
        'Description'
    ],
    Lead: [
        'FirstName',
        'LastName',
        'Company',
        'Email',
        'Phone',
        'Title',
        'Industry',
        'Status',
        'Street',
        'City',
        'State',
        'PostalCode',
        'Country',
        'Description'
    ],
    CampaignMember: [
        'CampaignId',     // Required: ID of the campaign
        'ContactId',      // Required (if no LeadId): ID of the contact
        'LeadId',         // Required (if no ContactId): ID of the lead
        'Status',         // Campaign member status
        'HasResponded',   // Whether the member has responded
        'FirstRespondedDate', // Date of first response
        'Type'           // Type of campaign member
    ],
    Event: [
        'Subject',
        'Description',
        'Location',
        'WhoId',  // Related Contact or Lead
        'WhatId',  // Related Account or other object
        'StartDateTime',  // Required field for Event
        'EndDateTime',    // Required field for Event
        'IsAllDayEvent'
    ],
    Task: [
        'Subject',
        'Description',
        'Status',
        'Priority',
        'ActivityDate',  // This is the field for DueDate in Salesforce
        'WhoId',  // Related Contact or Lead
        'WhatId',  // Related Account or other object
        'IsReminderSet',
        'ReminderDateTime'
    ],
    Note: [
        'Title',
        'Body',
        'ParentId',  // ID of the parent record (Account, Contact, Lead, etc.)
        'IsPrivate'
    ],
    Attachment: [
        'Name',           // Name of the file
        'Body',          // Base64-encoded file content
        'ContentType',   // MIME type of the file
        'ParentId',      // ID of the parent record
        'Description',   // Optional description of the attachment
        'IsPrivate'     // Whether the attachment is private
    ],
    Opportunity: [
        'Name',
        'StageName',
        'CloseDate'
    ],
    ChatterFeedItem: [
        'ParentId',      // ID of the record to post to
        'Body',          // The text content of the post
        'Title',         // Optional title for the post
        'Type',          // The type of feed item (TextPost, LinkPost, etc.)
        'IsRichText'     // Whether the post contains rich text formatting
    ]
};
// Default values for required fields
const DEFAULT_VALUES = {
    Lead: {
        Status: 'Open' // Default Lead Status
    },
    Event: {
        IsAllDayEvent: false    // Default to not all-day event
    },
    Task: {
        Status: 'Not Started',  // Default Task Status
        Priority: 'Normal'      // Default Task Priority
    },
    Opportunity: {
        StageName: 'Prospecting',  // Default Stage
        CloseDate: () => {
            const date = new Date();
            date.setMonth(date.getMonth() + 1);  // Default to 1 month from now
            return date.toISOString().split('T')[0];
        }
    }
};

// Utility function to ensure required fields
const ensureRequiredFields = (data, objectType) => {
    const defaults = DEFAULT_VALUES[objectType] || {};
    return {
        ...defaults,
        ...data
    };
};

// Utility function to filter invalid fields
const filterValidFields = (data, objectType) => {
    console.log(`Incoming ${objectType} data:`, data); // Debug log

    // Return empty object if data is null or not an object
    if (!data || typeof data !== 'object') {
        console.log(`Invalid data for ${objectType}:`, data);
        return {};
    }

    // If data is coming from MongoDB, convert to plain object
    const plainData = data.toObject ? data.toObject() : data;

    const validFields = VALID_FIELDS[objectType];
    if (!validFields) {
        console.log(`No valid fields defined for ${objectType}`);
        return {};
    }

    const filteredData = {};

    try {
        // Ensure we're working with a plain object
        const dataToProcess = typeof plainData === 'object' ? plainData : {};

        // Filter valid fields
        for (const key in dataToProcess) {
            if (validFields.includes(key) && dataToProcess[key] !== undefined && dataToProcess[key] !== null) {
                filteredData[key] = dataToProcess[key];
            }
        }

        // Add default values for required fields if they're missing
        const dataWithDefaults = ensureRequiredFields(filteredData, objectType);

        console.log(`Filtered ${objectType} data:`, dataWithDefaults); // Debug log
        return dataWithDefaults;
    } catch (error) {
        console.error('Error filtering fields:', error);
        return {};
    }
};

// Update cookie settings for ngrok compatibility
const setCookies = (res, { access_token, refresh_token }) => {
    const isProduction = process.env.NODE_ENV === 'production';

    // Common cookie options
    const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
    };

    console.log('Setting cookies with options:', {
        ...cookieOptions,
        environment: process.env.NODE_ENV,
        tokens: {
            access: access_token ? 'present' : 'missing',
            refresh: refresh_token ? 'present' : 'missing'
        }
    });

    // Set cookies
    if (access_token) {
        res.cookie('sf_access_token', access_token, cookieOptions);
    }

    if (refresh_token) {
        res.cookie('sf_refresh_token', refresh_token, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
    }
};

// Update getSalesforceConnection with header-based token handling
const getSalesforceConnection = async (req, res) => {
    console.log('Incoming request details:', {
        cookies: req.cookies,
        headers: {
            ...req.headers,
            authorization: req.headers.authorization ? 'present' : 'missing',
            'x-sf-access-token': req.headers['x-sf-access-token'] ? 'present' : 'missing'
        },
        user: req.user ? {
            id: req.user._id,
            hasSalesforceInfo: !!req.user.salesforce_info
        } : 'missing'
    });

    // Try to get token from headers first, then cookies, then user object
    const accessToken =
        req.headers['x-sf-access-token'] ||
        req.cookies.sf_access_token ||
        req.user?.salesforce_info?.access_token;

    if (!accessToken) {
        console.error('No Salesforce access token found in any source');
        throw new Error('Salesforce access token not found. Please re-authenticate with Salesforce.');
    }

    try {
        const conn = await createSalesforceConnection(accessToken, req.user.salesforce_info.instance_url);
        return conn;
    } catch (error) {
        console.error('Salesforce connection error:', error);

        if (error.message.includes('INVALID_SESSION_ID') || error.message.includes('Session expired')) {
            // Try to get refresh token from headers first, then cookies, then user object
            const refreshToken =
                req.headers['x-sf-refresh-token'] ||
                req.cookies.sf_refresh_token ||
                req.user?.salesforce_info?.refresh_token;

            if (!refreshToken) {
                console.error('No refresh token found');
                throw new Error('No refresh token available. Please re-authenticate with Salesforce.');
            }

            try {
                console.log('Attempting to refresh token...');
                const response = await axios.post(process.env.SF_LOGIN_URL + '/services/oauth2/token', null, {
                    params: {
                        grant_type: 'refresh_token',
                        client_id: process.env.SF_CLIENT_ID,
                        client_secret: process.env.SF_CLIENT_SECRET,
                        refresh_token: refreshToken
                    },
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                const { access_token, refresh_token } = response.data;

                // Store new tokens in user object
                if (req.user) {
                    req.user.salesforce_info.access_token = access_token;
                    req.user.salesforce_info.refresh_token = refresh_token;
                    await req.user.save();
                }

                // Set response headers with new tokens
                res.set('X-SF-Access-Token', access_token);
                res.set('X-SF-Refresh-Token', refresh_token);

                const conn = await createSalesforceConnection(access_token, req.user.salesforce_info.instance_url);
                return conn;
            } catch (refreshError) {
                console.error('Token refresh error:', refreshError);
                throw new Error('Failed to refresh Salesforce token. Please re-authenticate.');
            }
        }
        throw error;
    }
};

// Utility function to transform task data for Salesforce
const transformTaskData = (taskData) => {
    const transformed = { ...taskData };

    // Map DueDate to ActivityDate if present
    if (transformed.DueDate) {
        transformed.ActivityDate = transformed.DueDate;
        delete transformed.DueDate;
    }

    return transformed;
};

// Utility function to transform note data for Salesforce
const transformNoteData = (noteData) => {
    const transformed = { ...noteData };
    return transformed;
};

// Utility function to transform attachment data for Salesforce
const transformAttachmentData = (attachmentData) => {
    const transformed = { ...attachmentData };

    // Ensure Body is base64 encoded if it's not already
    if (transformed.Body && !transformed.Body.startsWith('base64,')) {
        transformed.Body = Buffer.from(transformed.Body).toString('base64');
    }

    return transformed;
};

// Utility function to check if a string is base64 encoded
const isBase64 = (str) => {
    try {
        return Buffer.from(str, 'base64').toString('base64') === str;
    } catch (err) {
        return false;
    }
};

// Utility function to sync with Salesforce
const syncWithSalesforce = async (conn, operation, objectType, data) => {
    try {
        // For delete operations, only need the ID
        if (operation === 'delete') {
            if (!data || !data.id) {
                throw new Error('ID is required for delete operation');
            }
            // Use REST API for deletion
            await conn.request({
                method: 'DELETE',
                url: `/services/data/v57.0/sobjects/${objectType}/${data.id}`,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return { success: true };
        }

        // Transform task data if needed
        const transformedData = objectType === 'Task' ? transformTaskData(data) : data;

        // For create/update operations, filter and validate fields
        const validData = filterValidFields(transformedData, objectType);

        // Log the data for debugging
        console.log(`Filtered ${objectType} data:`, validData);

        // Check if required fields are present for create/update
        if (operation === 'create' || operation === 'update') {
            if (objectType === 'Account' && !validData.Name) {
                throw new Error('Account Name is required');
            }
            if (objectType === 'Contact' && !validData.LastName) {
                throw new Error('Contact LastName is required');
            }
            if (objectType === 'Lead' && (!validData.LastName || !validData.Company)) {
                throw new Error('Lead LastName and Company are required');
            }
            if (objectType === 'Event' && (!validData.Subject || !validData.StartDateTime)) {
                throw new Error('Event Subject and StartDateTime are required');
            }
            if (objectType === 'Task' && !validData.Subject) {
                throw new Error('Task Subject is required');
            }
        }

        // Common headers for create/update operations
        const headers = {
            'Content-Type': 'application/json',
            'Sforce-Duplicate-Rule-Header': 'allowSave=true'  // Allow duplicate records
        };

        // For create/update operations
        switch (operation) {
            case 'create':
                try {
                    // Create new record
                    const createResponse = await conn.request({
                        method: 'POST',
                        url: `/services/data/v57.0/sobjects/${objectType}`,
                        headers,
                        body: JSON.stringify(validData)
                    });
                    return { id: createResponse.id, ...createResponse };
                } catch (error) {
                    if (error.errorCode === 'DUPLICATES_DETECTED' && error.data?.duplicateResult?.allowSave) {
                        // If duplicate is detected but saving is allowed, proceed with creation
                        const createResponse = await conn.request({
                            method: 'POST',
                            url: `/services/data/v57.0/sobjects/${objectType}`,
                            headers: {
                                ...headers,
                                'Sforce-Duplicate-Rule-Header': 'allowSave=true'
                            },
                            body: JSON.stringify(validData)
                        });
                        return { id: createResponse.id, ...createResponse };
                    }
                    throw error;
                }

            case 'update':
                if (!data.Id) {
                    throw new Error('Id is required for update operation');
                }
                validData.Id = data.Id; // Ensure ID is included for update
                // Use REST API for update
                await conn.request({
                    method: 'PATCH',
                    url: `/services/data/v57.0/sobjects/${objectType}/${data.Id}`,
                    headers,
                    body: JSON.stringify(validData)
                });
                return { success: true, id: data.Id };

            default:
                throw new Error('Invalid operation');
        }
    } catch (error) {
        console.error(`Salesforce ${operation} error for ${objectType}:`, error);
        throw error;
    }
};

// @desc    Create a new object
// @route   POST /api/objects
// @access  Private
const createObject = asyncHandler(async (req, res) => {
    const { transcription_id, status, account, contact, lead, event, task, note, attachment, opportunity, campaignMember, campaign } = req.body;

    console.log('Received create object request:', {
        transcription_id,
        status,
        account,
        contact,
        lead,
        event,
        task,
        note,
        attachment: attachment ? { ...attachment, Body: 'BINARY_DATA_NOT_LOGGED' } : null,
        opportunity,
        campaignMember,
        campaign
    });

    // Validate campaign data if provided
    if (campaign) {
        if (!campaign.Name || typeof campaign.Name !== 'string') {
            res.status(400);
            throw new Error('Campaign Name is required and must be a string');
        }
    }

    // Validate campaign member data if provided
    if (campaignMember) {
        if (!campaignMember.CampaignId) {
            res.status(400);
            throw new Error('CampaignId is required for campaign member');
        }
        if (!campaignMember.ContactId && !campaignMember.LeadId) {
            res.status(400);
            throw new Error('Either ContactId or LeadId is required for campaign member');
        }
        if (campaignMember.ContactId && campaignMember.LeadId) {
            res.status(400);
            throw new Error('Cannot specify both ContactId and LeadId for campaign member');
        }
    }

    // Validate account data if provided
    if (account && (!account.Name || typeof account.Name !== 'string')) {
        res.status(400);
        throw new Error('Account Name is required and must be a string');
    }

    // Validate contact data if provided
    if (contact && (!contact.LastName || typeof contact.LastName !== 'string')) {
        res.status(400);
        throw new Error('Contact LastName is required and must be a string');
    }

    // Validate lead data if provided
    if (lead && (!lead.LastName || !lead.Company || typeof lead.LastName !== 'string' || typeof lead.Company !== 'string')) {
        res.status(400);
        throw new Error('Lead LastName and Company are required and must be strings');
    }

    // Validate event data if provided
    if (event) {
        if (!event.Subject || typeof event.Subject !== 'string') {
            res.status(400);
            throw new Error('Event Subject is required and must be a string');
        }
        if (!event.StartDateTime || !event.EndDateTime) {
            res.status(400);
            throw new Error('Event StartDateTime and EndDateTime are required');
        }
        // Validate that EndDateTime is after StartDateTime
        if (new Date(event.EndDateTime) <= new Date(event.StartDateTime)) {
            res.status(400);
            throw new Error('Event EndDateTime must be after StartDateTime');
        }
    }

    // Validate task data if provided
    if (task) {
        if (!task.Subject || typeof task.Subject !== 'string') {
            res.status(400);
            throw new Error('Task Subject is required and must be a string');
        }
        if (task.DueDate && new Date(task.DueDate) < new Date()) {
            res.status(400);
            throw new Error('Task DueDate cannot be in the past');
        }
    }

    // Validate note data if provided
    if (note && (!note.Title || !note.Body)) {
        res.status(400);
        throw new Error('Note Title and Body are required');
    }

    // Validate attachment data if provided
    if (attachment) {
        if (!attachment.Name || !attachment.Body || !attachment.ContentType) {
            res.status(400);
            throw new Error('Attachment Name, Body, and ContentType are required');
        }

        // Validate file size (max 25MB for Salesforce)
        const base64Size = Buffer.from(attachment.Body, 'base64').length;
        if (base64Size > 25 * 1024 * 1024) { // 25MB in bytes
            res.status(400);
            throw new Error('Attachment size must be less than 25MB');
        }
    }

    // Validate opportunity data if provided
    if (opportunity) {
        if (!opportunity.Name || typeof opportunity.Name !== 'string') {
            res.status(400);
            throw new Error('Opportunity Name is required and must be a string');
        }
        if (!opportunity.StageName) {
            res.status(400);
            throw new Error('Opportunity StageName is required');
        }
        if (!opportunity.CloseDate) {
            res.status(400);
            throw new Error('Opportunity CloseDate is required');
        }
    }

    const object = await Object.create({
        transcription_id,
        status,
        campaign: campaign ? {
            ...campaign,
            sync_status: 'pending',
            salesforce_id: null
        } : null,
        account: account ? {
            ...account,
            sync_status: 'pending',
            salesforce_id: null
        } : null,
        contact: contact ? {
            ...contact,
            sync_status: 'pending',
            salesforce_id: null
        } : null,
        lead: lead ? {
            ...lead,
            sync_status: 'pending',
            salesforce_id: null
        } : null,
        event: event ? {
            ...event,
            sync_status: 'pending',
            salesforce_id: null
        } : null,
        task: task ? {
            ...task,
            sync_status: 'pending',
            salesforce_id: null
        } : null,
        note: note ? {
            ...note,
            sync_status: 'pending',
            salesforce_id: null
        } : null,
        attachment: attachment ? {
            ...attachment,
            sync_status: 'pending',
            salesforce_id: null
        } : null,
        opportunity: opportunity ? {
            ...opportunity,
            sync_status: 'pending',
            salesforce_id: null
        } : null,
        campaignMember: campaignMember ? {
            ...campaignMember,
            sync_status: 'pending',
            salesforce_id: null
        } : null
    });

    if (object) {
        try {
            const conn = await getSalesforceConnection(req, res);
            let accountId = null;
            let contactId = null;
            let leadId = null;
            let opportunityId = null;
            let campaignId = null;

            // First create Campaign if provided
            if (campaign) {
                try {
                    const result = await syncWithSalesforce(conn, 'create', 'Campaign', campaign);
                    campaignId = result.id;
                    object.campaign = {
                        ...object.campaign,
                        salesforce_id: campaignId,
                        sync_status: 'synced'
                    };
                    object.markModified('campaign');
                } catch (error) {
                    console.error('Campaign creation error:', error);
                    throw error;
                }
            }

            // First create Account, Contact, and Lead to get their IDs
            if (account) {
                const result = await syncWithSalesforce(conn, 'create', 'Account', account);
                accountId = result.id;
                object.account = {
                    ...object.account,
                    salesforce_id: accountId,
                    sync_status: 'synced'
                };
                object.markModified('account');
            }

            if (contact) {
                const result = await syncWithSalesforce(conn, 'create', 'Contact', contact);
                contactId = result.id;
                object.contact = {
                    ...object.contact,
                    salesforce_id: contactId,
                    sync_status: 'synced'
                };
                object.markModified('contact');
            }

            if (lead) {
                const result = await syncWithSalesforce(conn, 'create', 'Lead', lead);
                leadId = result.id;
                object.lead = {
                    ...object.lead,
                    salesforce_id: leadId,
                    sync_status: 'synced'
                };
                object.markModified('lead');
            }

            if (event) {
                // Add relationships to the event
                const eventData = { ...event };
                if (accountId) {
                    eventData.WhatId = accountId;
                }
                if (contactId) {
                    eventData.WhoId = contactId;
                } else if (leadId) {
                    eventData.WhoId = leadId;
                }

                const result = await syncWithSalesforce(conn, 'create', 'Event', eventData);
                object.event = {
                    ...object.event,
                    salesforce_id: result.id,
                    sync_status: 'synced'
                };
                object.markModified('event');
            }

            if (task) {
                // Add relationships to the task
                const taskData = { ...task };
                if (accountId) {
                    taskData.WhatId = accountId;
                }
                if (contactId) {
                    taskData.WhoId = contactId;
                } else if (leadId) {
                    taskData.WhoId = leadId;
                }

                const result = await syncWithSalesforce(conn, 'create', 'Task', taskData);
                object.task = {
                    ...object.task,
                    salesforce_id: result.id,
                    sync_status: 'synced'
                };
                object.markModified('task');
            }

            // Handle Note sync
            if (note) {
                const noteData = { ...note };

                // Link note to the appropriate parent record
                if (accountId) {
                    noteData.ParentId = accountId;
                } else if (contactId) {
                    noteData.ParentId = contactId;
                } else if (leadId) {
                    noteData.ParentId = leadId;
                }

                if (!noteData.ParentId) {
                    throw new Error('Note requires a parent record (Account, Contact, or Lead)');
                }

                const result = await syncWithSalesforce(conn, 'create', 'Note', noteData);
                object.note = {
                    ...object.note,
                    salesforce_id: result.id,
                    sync_status: 'synced'
                };
                object.markModified('note');
            }

            // Handle Attachment sync
            if (attachment) {
                const attachmentData = transformAttachmentData(attachment);

                // Link attachment to the appropriate parent record
                if (accountId) {
                    attachmentData.ParentId = accountId;
                } else if (contactId) {
                    attachmentData.ParentId = contactId;
                } else if (leadId) {
                    attachmentData.ParentId = leadId;
                }

                if (!attachmentData.ParentId) {
                    throw new Error('Attachment requires a parent record (Account, Contact, or Lead)');
                }

                const result = await syncWithSalesforce(conn, 'create', 'Attachment', attachmentData);

                object.attachment = {
                    ...object.attachment,
                    salesforce_id: result.id,
                    sync_status: 'synced'
                };
                object.markModified('attachment');
            }

            // Create Opportunity and link it to Account if exists
            if (opportunity) {
                const opportunityData = { ...opportunity };
                if (accountId) {
                    opportunityData.AccountId = accountId;
                }
                const result = await syncWithSalesforce(conn, 'create', 'Opportunity', opportunityData);
                opportunityId = result.id;
                object.opportunity = {
                    ...object.opportunity,
                    salesforce_id: opportunityId,
                    sync_status: 'synced'
                };
                object.markModified('opportunity');
            }

            // Handle Campaign Member sync
            if (req.body.campaignMember) {
                try {
                    // Validate required fields
                    if (!req.body.campaignMember.CampaignId) {
                        throw new Error('CampaignId is required for campaign member');
                    }
                    if (!req.body.campaignMember.ContactId && !req.body.campaignMember.LeadId) {
                        throw new Error('Either ContactId or LeadId is required for campaign member');
                    }

                    // Prepare campaign member data - exclude HasResponded as it's read-only
                    const campaignMemberData = {
                        CampaignId: req.body.campaignMember.CampaignId,
                        Status: req.body.campaignMember.Status || 'Sent'
                    };

                    // Add either ContactId or LeadId
                    if (req.body.campaignMember.ContactId) {
                        campaignMemberData.ContactId = req.body.campaignMember.ContactId;
                    } else if (req.body.campaignMember.LeadId) {
                        campaignMemberData.LeadId = req.body.campaignMember.LeadId;
                    }

                    console.log('Creating campaign member with data:', campaignMemberData);

                    // Create campaign member in Salesforce
                    const result = await conn.sobject('CampaignMember').create(campaignMemberData);

                    if (!result.success) {
                        throw new Error(`Failed to create campaign member: ${result.errors.join(', ')}`);
                    }

                    object.campaignMember = {
                        ...req.body.campaignMember,
                        salesforce_id: result.id,
                        sync_status: 'synced'
                    };
                    object.markModified('campaignMember');
                    console.log('Campaign member created successfully:', result);
                } catch (error) {
                    console.error('Campaign Member creation error:', error);
                    object.campaignMember = {
                        ...req.body.campaignMember,
                        sync_status: 'failed',
                        error: error.message
                    };
                    object.markModified('campaignMember');
                    throw error;
                }
            }

            object.status = 'synced';
            await object.save();
        } catch (error) {
            console.error('Salesforce sync error:', error);
            object.status = 'sync_failed';
            if (campaign) object.campaign.sync_status = 'failed';
            if (account) object.account.sync_status = 'failed';
            if (contact) object.contact.sync_status = 'failed';
            if (lead) object.lead.sync_status = 'failed';
            if (event) object.event.sync_status = 'failed';
            if (task) object.task.sync_status = 'failed';
            if (note) object.note.sync_status = 'failed';
            if (attachment) object.attachment.sync_status = 'failed';
            if (opportunity) object.opportunity.sync_status = 'failed';
            if (campaignMember) object.campaignMember.sync_status = 'failed';
            await object.save();

            if (error.message.includes('Please re-authenticate')) {
                res.status(401);
                throw new Error('Salesforce authentication expired. Please re-authenticate with Salesforce.');
            } else {
                res.status(500);
                throw new Error(`Failed to sync with Salesforce: ${error.message}`);
            }
        }

        // Don't send back the binary data in the response
        if (object.attachment && object.attachment.Body) {
            object.attachment.Body = 'BINARY_DATA_NOT_RETURNED';
        }

        res.status(201).json({
            data: {
                ...object.toObject(),
                campaign: object.campaign,
                campaignMember: object.campaignMember
            },
            status: 'synced'
        });
    } else {
        res.status(400);
        throw new Error('Invalid object data');
    }
});

// @desc    Get all objects by type
// @route   GET /api/objects
// @access  Private
const getObjects = asyncHandler(async (req, res) => {
    const { objectType, page = 1, limit = 10, sort = 'createdAt', order = 'desc', filter } = req.query;

    if (!objectType) {
        res.status(400);
        throw new Error('objectType parameter is required');
    }

    // Validate object type
    const validObjectTypes = ['Account', 'Contact', 'Lead', 'Opportunity', 'Campaign', 'CampaignMember', 'Event', 'Task', 'Note', 'Attachment'];
    if (!validObjectTypes.includes(objectType)) {
        res.status(400);
        throw new Error('Invalid object type');
    }

    // Convert objectType to lowercase for MongoDB field name
    const objectField = objectType.toLowerCase();

    // Create the query to only fetch objects where the specified type is not null
    const query = {
        [`${objectField}`]: { $ne: null }
    };

    // Add additional filters if provided
    if (filter) {
        try {
            const filterObj = JSON.parse(filter);
            Object.keys(filterObj).forEach(key => {
                query[`${objectField}.data.${key}`] = filterObj[key];
            });
        } catch (error) {
            res.status(400);
            throw new Error('Invalid filter format');
        }
    }

    try {
        // Calculate skip value for pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get total count for pagination
        const totalItems = await Object.countDocuments(query);

        // Get paginated and sorted results
        const items = await Object.find(query)
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select(`${objectField} createdAt updatedAt`);  // Only select relevant fields

        // Transform the results to match the expected format
        const transformedItems = items.map(item => ({
            id: item._id,
            salesforce_id: item[objectField].salesforce_id,
            type: objectType,
            sync_status: item[objectField].sync_status,
            data: item[objectField].data || {},
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        }));

        res.json({
            success: true,
            data: {
                items: transformedItems,
                pagination: {
                    totalItems,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalItems / parseInt(limit)),
                    limit: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching objects:', error);
        res.status(500);
        throw new Error('Failed to fetch objects');
    }
});

// @desc    Get object by ID
// @route   GET /api/objects/:id
// @access  Private
const getObjectById = asyncHandler(async (req, res) => {
    const object = await Object.findById(req.params.id).populate('transcription_id');

    if (object) {
        res.json(object);
    } else {
        res.status(404);
        throw new Error('Object not found');
    }
});

// @desc    Update object
// @route   PUT /api/objects/:id
// @access  Private
const updateObject = asyncHandler(async (req, res) => {
    const object = await Object.findById(req.params.id);

    if (!object) {
        res.status(404);
        throw new Error('Object not found');
    }

    // Update local object with new data first
    if (req.body.account) {
        object.account = {
            ...(object.account || {}),  // Keep existing data if any
            ...req.body.account,
            sync_status: 'pending',
            salesforce_id: object.account?.salesforce_id || null  // Preserve existing salesforce_id if any
        };
        object.markModified('account');
    }

    if (req.body.contact) {
        object.contact = {
            ...(object.contact || {}),  // Keep existing data if any
            ...req.body.contact,
            sync_status: 'pending',
            salesforce_id: object.contact?.salesforce_id || null  // Preserve existing salesforce_id if any
        };
        object.markModified('contact');
    }

    if (req.body.lead) {
        object.lead = {
            ...(object.lead || {}),  // Keep existing data if any
            ...req.body.lead,
            sync_status: 'pending',
            salesforce_id: object.lead?.salesforce_id || null  // Preserve existing salesforce_id if any
        };
        object.markModified('lead');
    }

    if (req.body.event) {
        // Validate event data
        if (!req.body.event.Subject || typeof req.body.event.Subject !== 'string') {
            res.status(400);
            throw new Error('Event Subject is required and must be a string');
        }
        if (!req.body.event.StartDateTime || !req.body.event.EndDateTime) {
            res.status(400);
            throw new Error('Event StartDateTime and EndDateTime are required');
        }
        if (new Date(req.body.event.EndDateTime) <= new Date(req.body.event.StartDateTime)) {
            res.status(400);
            throw new Error('Event EndDateTime must be after StartDateTime');
        }

        object.event = {
            ...(object.event || {}),  // Keep existing data if any
            ...req.body.event,
            sync_status: 'pending',
            salesforce_id: object.event?.salesforce_id || null  // Preserve existing salesforce_id if any
        };
        object.markModified('event');
    }

    if (req.body.task) {
        // Validate task data
        if (!req.body.task.Subject || typeof req.body.task.Subject !== 'string') {
            res.status(400);
            throw new Error('Task Subject is required and must be a string');
        }
        if (req.body.task.DueDate && new Date(req.body.task.DueDate) < new Date()) {
            res.status(400);
            throw new Error('Task DueDate cannot be in the past');
        }

        object.task = {
            ...(object.task || {}),  // Keep existing data if any
            ...req.body.task,
            sync_status: 'pending',
            salesforce_id: object.task?.salesforce_id || null  // Preserve existing salesforce_id if any
        };
        object.markModified('task');
    }

    if (req.body.note) {
        // Validate note data
        if (!req.body.note.Title || !req.body.note.Body) {
            res.status(400);
            throw new Error('Note Title and Body are required');
        }

        object.note = {
            ...(object.note || {}),
            ...req.body.note,
            sync_status: 'pending',
            salesforce_id: object.note?.salesforce_id || null
        };
        object.markModified('note');
    }

    if (req.body.attachment) {
        // Validate attachment data
        if (!req.body.attachment.Name || !req.body.attachment.Body || !req.body.attachment.ContentType) {
            res.status(400);
            throw new Error('Attachment Name, Body, and ContentType are required');
        }

        object.attachment = {
            ...(object.attachment || {}),
            ...req.body.attachment,
            sync_status: 'pending',
            salesforce_id: object.attachment?.salesforce_id || null
        };
        object.markModified('attachment');
    }

    // Update Opportunity if provided
    if (req.body.opportunity) {
        // Validate opportunity data
        if (!req.body.opportunity.Name || typeof req.body.opportunity.Name !== 'string') {
            res.status(400);
            throw new Error('Opportunity Name is required and must be a string');
        }
        if (req.body.opportunity.StageName === '') {
            res.status(400);
            throw new Error('Opportunity StageName cannot be empty');
        }

        object.opportunity = {
            ...(object.opportunity || {}),
            ...req.body.opportunity,
            sync_status: 'pending',
            salesforce_id: object.opportunity?.salesforce_id || null
        };
        object.markModified('opportunity');
    }

    // Update status if any changes were made
    if (req.body.account || req.body.contact || req.body.lead || req.body.event || req.body.task || req.body.note || req.body.attachment || req.body.opportunity) {
        object.status = 'pending';
    }

    try {
        const conn = await getSalesforceConnection(req, res);
        let hasUpdates = false;

        // Handle Account sync
        if (req.body.account) {
            try {
                if (object.account.salesforce_id) {
                    // Update existing Salesforce account
                    await conn.sobject('Account')
                        .update({
                            Id: object.account.salesforce_id,
                            ...filterValidFields(req.body.account, 'Account')
                        });
                } else {
                    // Create new Salesforce account
                    const result = await syncWithSalesforce(conn, 'create', 'Account', req.body.account);
                    object.account.salesforce_id = result.id;
                }
                object.account.sync_status = 'synced';
                hasUpdates = true;
            } catch (error) {
                if (error.message.includes('NOT_FOUND') || error.message.includes('INVALID_ID_FIELD')) {
                    const result = await syncWithSalesforce(conn, 'create', 'Account', req.body.account);
                    object.account.salesforce_id = result.id;
                    object.account.sync_status = 'synced';
                    hasUpdates = true;
                } else {
                    throw error;
                }
            }
        }

        // Handle Event sync
        if (req.body.event) {
            try {
                const eventData = filterValidFields(req.body.event, 'Event');

                // If we have a related Account, add it to the event
                if (object.account?.salesforce_id) {
                    eventData.WhatId = object.account.salesforce_id;
                }

                if (object.event.salesforce_id) {
                    // Update existing Salesforce event
                    await conn.sobject('Event')
                        .update({
                            Id: object.event.salesforce_id,
                            ...eventData
                        });
                } else {
                    // Create new Salesforce event
                    const result = await conn.sobject('Event')
                        .create(eventData);
                    object.event.salesforce_id = result.id;
                }
                object.event.sync_status = 'synced';
                hasUpdates = true;
            } catch (error) {
                if (error.message.includes('NOT_FOUND') || error.message.includes('INVALID_ID_FIELD')) {
                    const eventData = filterValidFields(req.body.event, 'Event');
                    if (object.account?.salesforce_id) {
                        eventData.WhatId = object.account.salesforce_id;
                    }
                    const result = await conn.sobject('Event')
                        .create(eventData);
                    object.event.salesforce_id = result.id;
                    object.event.sync_status = 'synced';
                    hasUpdates = true;
                } else {
                    throw error;
                }
            }
        }

        // Handle Task sync
        if (req.body.task) {
            try {
                // Transform task data for Salesforce
                const taskData = transformTaskData(req.body.task);
                const validTaskData = filterValidFields(taskData, 'Task');

                // If we have a related Account, add it to the task
                if (object.account?.salesforce_id) {
                    validTaskData.WhatId = object.account.salesforce_id;
                }

                if (object.task?.salesforce_id) {
                    // Update existing Salesforce task
                    console.log('Updating existing task with ID:', object.task.salesforce_id);
                    validTaskData.Id = object.task.salesforce_id; // Add ID for update
                    await conn.sobject('Task')
                        .update(validTaskData);

                    object.task = {
                        ...object.task,
                        ...req.body.task,
                        salesforce_id: object.task.salesforce_id,
                        sync_status: 'synced'
                    };
                } else {
                    // Create new Salesforce task
                    console.log('Creating new task');
                    const result = await conn.sobject('Task')
                        .create(validTaskData);

                    object.task = {
                        ...req.body.task,
                        salesforce_id: result.id,
                        sync_status: 'synced'
                    };
                }
                object.markModified('task');
                hasUpdates = true;
            } catch (error) {
                console.error('Task sync error:', error);
                if (error.message.includes('NOT_FOUND') || error.message.includes('INVALID_ID_FIELD')) {
                    // If task not found, create a new one
                    console.log('Task not found, creating new one');
                    const taskData = transformTaskData(req.body.task);
                    const validTaskData = filterValidFields(taskData, 'Task');
                    if (object.account?.salesforce_id) {
                        validTaskData.WhatId = object.account.salesforce_id;
                    }
                    const result = await conn.sobject('Task')
                        .create(validTaskData);

                    object.task = {
                        ...req.body.task,
                        salesforce_id: result.id,
                        sync_status: 'synced'
                    };
                    object.markModified('task');
                    hasUpdates = true;
                } else {
                    throw error;
                }
            }
        }

        // Handle Note sync
        if (req.body.note) {
            try {
                const noteData = filterValidFields(req.body.note, 'Note');

                // Ensure note has a parent record
                if (!noteData.ParentId) {
                    if (object.account?.salesforce_id) {
                        noteData.ParentId = object.account.salesforce_id;
                    } else if (object.contact?.salesforce_id) {
                        noteData.ParentId = object.contact.salesforce_id;
                    } else if (object.lead?.salesforce_id) {
                        noteData.ParentId = object.lead.salesforce_id;
                    }
                }

                if (object.note?.salesforce_id) {
                    // Update existing Salesforce note
                    noteData.Id = object.note.salesforce_id;
                    await conn.sobject('Note').update(noteData);
                } else {
                    // Create new Salesforce note
                    const result = await conn.sobject('Note').create(noteData);
                    object.note.salesforce_id = result.id;
                }
                object.note.sync_status = 'synced';
                hasUpdates = true;
            } catch (error) {
                if (error.message.includes('NOT_FOUND') || error.message.includes('INVALID_ID_FIELD')) {
                    // Create new note if update fails
                    const noteData = filterValidFields(req.body.note, 'Note');
                    if (object.account?.salesforce_id) {
                        noteData.ParentId = object.account.salesforce_id;
                    } else if (object.contact?.salesforce_id) {
                        noteData.ParentId = object.contact.salesforce_id;
                    } else if (object.lead?.salesforce_id) {
                        noteData.ParentId = object.lead.salesforce_id;
                    }
                    const result = await conn.sobject('Note').create(noteData);
                    object.note = {
                        ...req.body.note,
                        salesforce_id: result.id,
                        sync_status: 'synced'
                    };
                    object.markModified('note');
                    hasUpdates = true;
                } else {
                    throw error;
                }
            }
        }

        // Handle Attachment sync
        if (req.body.attachment) {
            try {
                const attachmentData = transformAttachmentData(req.body.attachment);

                // Ensure attachment has a parent record
                if (!attachmentData.ParentId) {
                    if (object.account?.salesforce_id) {
                        attachmentData.ParentId = object.account.salesforce_id;
                    } else if (object.contact?.salesforce_id) {
                        attachmentData.ParentId = object.contact.salesforce_id;
                    } else if (object.lead?.salesforce_id) {
                        attachmentData.ParentId = object.lead.salesforce_id;
                    }
                }

                // Note: Salesforce doesn't allow updating existing attachments
                // So we always create a new one
                const result = await conn.sobject('Attachment').create(attachmentData);
                object.attachment = {
                    ...req.body.attachment,
                    salesforce_id: result.id,
                    sync_status: 'synced'
                };
                object.markModified('attachment');
                hasUpdates = true;
            } catch (error) {
                console.error('Attachment sync error:', error);
                throw error;
            }
        }

        // Handle Opportunity sync
        if (req.body.opportunity) {
            try {
                const opportunityData = filterValidFields(req.body.opportunity, 'Opportunity');

                if (object.opportunity?.salesforce_id) {
                    // Update existing Salesforce opportunity
                    await conn.sobject('Opportunity')
                        .update({
                            Id: object.opportunity.salesforce_id,
                            ...opportunityData
                        });
                } else {
                    // Create new Salesforce opportunity
                    if (object.account?.salesforce_id) {
                        opportunityData.AccountId = object.account.salesforce_id;
                    }
                    const result = await conn.sobject('Opportunity')
                        .create(opportunityData);
                    object.opportunity.salesforce_id = result.id;
                }
                object.opportunity.sync_status = 'synced';
                hasUpdates = true;
            } catch (error) {
                if (error.message.includes('NOT_FOUND') || error.message.includes('INVALID_ID_FIELD')) {
                    // Create new opportunity if update fails
                    const opportunityData = filterValidFields(req.body.opportunity, 'Opportunity');
                    if (object.account?.salesforce_id) {
                        opportunityData.AccountId = object.account.salesforce_id;
                    }
                    const result = await conn.sobject('Opportunity')
                        .create(opportunityData);
                    object.opportunity = {
                        ...req.body.opportunity,
                        salesforce_id: result.id,
                        sync_status: 'synced'
                    };
                    object.markModified('opportunity');
                    hasUpdates = true;
                } else {
                    throw error;
                }
            }
        }

        // Handle Campaign sync
        if (req.body.campaign) {
            try {
                const campaignData = filterValidFields(req.body.campaign, 'Campaign');

                if (object.campaign?.salesforce_id) {
                    // Update existing Salesforce campaign
                    await conn.sobject('Campaign')
                        .update({
                            Id: object.campaign.salesforce_id,
                            ...campaignData
                        });
                } else {
                    // Create new Salesforce campaign
                    const result = await conn.sobject('Campaign')
                        .create(campaignData);
                    object.campaign = {
                        ...req.body.campaign,
                        salesforce_id: result.id,
                        sync_status: 'synced'
                    };
                }
                object.campaign.sync_status = 'synced';
                object.markModified('campaign');
                hasUpdates = true;
            } catch (error) {
                console.error('Campaign sync error:', error);
                if (error.message.includes('NOT_FOUND') || error.message.includes('INVALID_ID_FIELD')) {
                    // Create new campaign if update fails
                    const campaignData = filterValidFields(req.body.campaign, 'Campaign');
                    const result = await conn.sobject('Campaign')
                        .create(campaignData);
                    object.campaign = {
                        ...req.body.campaign,
                        salesforce_id: result.id,
                        sync_status: 'synced'
                    };
                    object.markModified('campaign');
                    hasUpdates = true;
                } else {
                    throw error;
                }
            }
        }

        // Handle Campaign Member sync
        if (req.body.campaignMember) {
            try {
                // Validate required fields
                if (!req.body.campaignMember.CampaignId) {
                    throw new Error('CampaignId is required for campaign member');
                }
                if (!req.body.campaignMember.ContactId && !req.body.campaignMember.LeadId) {
                    throw new Error('Either ContactId or LeadId is required for campaign member');
                }

                // Prepare campaign member data - exclude HasResponded as it's read-only
                const campaignMemberData = {
                    CampaignId: req.body.campaignMember.CampaignId,
                    Status: req.body.campaignMember.Status || 'Sent'
                };

                // Add either ContactId or LeadId
                if (req.body.campaignMember.ContactId) {
                    campaignMemberData.ContactId = req.body.campaignMember.ContactId;
                } else if (req.body.campaignMember.LeadId) {
                    campaignMemberData.LeadId = req.body.campaignMember.LeadId;
                }

                console.log('Creating campaign member with data:', campaignMemberData);

                // Create campaign member in Salesforce
                const result = await conn.sobject('CampaignMember').create(campaignMemberData);

                if (!result.success) {
                    throw new Error(`Failed to create campaign member: ${result.errors.join(', ')}`);
                }

                object.campaignMember = {
                    ...req.body.campaignMember,
                    salesforce_id: result.id,
                    sync_status: 'synced'
                };
                object.markModified('campaignMember');
                console.log('Campaign member created successfully:', result);
            } catch (error) {
                console.error('Campaign Member creation error:', error);
                object.campaignMember = {
                    ...req.body.campaignMember,
                    sync_status: 'failed',
                    error: error.message
                };
                object.markModified('campaignMember');
                throw error;
            }
        }

        if (hasUpdates) {
            object.status = 'synced';
        }

    } catch (error) {
        console.error('Salesforce sync error:', error);

        // Update sync status for failed objects
        if (req.body.account) {
            object.account.sync_status = 'failed';
        }
        if (req.body.contact) {
            object.contact.sync_status = 'failed';
        }
        if (req.body.lead) {
            object.lead.sync_status = 'failed';
        }
        if (req.body.event) {
            object.event.sync_status = 'failed';
        }
        if (req.body.task) {
            object.task.sync_status = 'failed';
        }
        if (req.body.note) {
            object.note.sync_status = 'failed';
        }
        if (req.body.attachment) {
            object.attachment.sync_status = 'failed';
        }
        if (req.body.opportunity) {
            object.opportunity.sync_status = 'failed';
        }
        if (req.body.campaignMember) {
            object.campaignMember.sync_status = 'failed';
        }
        object.status = 'sync_failed';

        // Check if it's an authentication error
        if (error.message.includes('Please re-authenticate')) {
            await object.save();  // Save the failed status
            res.status(401);
            throw new Error('Salesforce authentication expired. Please re-authenticate with Salesforce.');
        } else {
            // Save the failed status but continue with the response
            await object.save();
            res.status(500);
            throw new Error(`Failed to sync with Salesforce: ${error.message}`);
        }
    }

    // Don't send back the binary data in the response
    if (object.attachment && object.attachment.Body) {
        object.attachment.Body = 'BINARY_DATA_NOT_RETURNED';
    }

    const updatedObject = await object.save();
    res.json(updatedObject);
});

// @desc    Delete object
// @route   DELETE /api/objects/:id
// @access  Private
const deleteObject = asyncHandler(async (req, res) => {
    const object = await Object.findById(req.params.id);
    const objectType = req.query.type; // 'account', 'contact', 'lead', 'event', 'task', 'opportunity', 'campaign', or 'campaignMember'

    if (!object) {
        res.status(404);
        throw new Error('Object not found');
    }

    // Validate object type
    if (!objectType || !['account', 'contact', 'lead', 'event', 'task', 'opportunity', 'campaign', 'campaignMember'].includes(objectType.toLowerCase())) {
        res.status(400);
        throw new Error('Please specify a valid object type to delete (account, contact, lead, event, task, opportunity, campaign, or campaignMember)');
    }

    let deletionErrors = [];
    let salesforceSuccess = true;

    // Sync deletion with Salesforce only for the specified object type
    try {
        console.log('Attempting to connect to Salesforce for deletion...');
        const conn = await getSalesforceConnection(req, res);

        const capitalizedType = objectType.charAt(0).toUpperCase() + objectType.slice(1).toLowerCase();

        // Only attempt deletion if the specified object exists and has a Salesforce ID
        if (object[objectType] && object[objectType].salesforce_id) {
            try {
                console.log(`Attempting to delete ${capitalizedType} with Salesforce ID: ${object[objectType].salesforce_id}`);
                await conn.request({
                    method: 'DELETE',
                    url: `/services/data/v57.0/sobjects/${capitalizedType}/${object[objectType].salesforce_id}`,
                });
                console.log(`${capitalizedType} deleted successfully from Salesforce`);

                // Clear only the specified object data after successful deletion
                object[objectType] = null;
                object.markModified(objectType);
                await object.save();
            } catch (error) {
                console.error(`Error deleting ${capitalizedType} from Salesforce:`, error);
                console.error('Full error details:', JSON.stringify(error, null, 2));
                deletionErrors.push(`${capitalizedType}: ${error.message}`);
                salesforceSuccess = false;
            }
        } else {
            res.status(404);
            throw new Error(`No ${capitalizedType} found with Salesforce ID in this record`);
        }

    } catch (error) {
        console.error('Salesforce connection error:', error);
        console.error('Full connection error details:', JSON.stringify(error, null, 2));
        deletionErrors.push(`Connection: ${error.message}`);
        salesforceSuccess = false;

        // Check if it's an authentication error
        if (error.message.includes('Please re-authenticate')) {
            res.status(401);
            throw new Error('Salesforce authentication expired. Please re-authenticate with Salesforce.');
        }

        // If it's not an auth error, throw the original error
        throw error;
    }

    // Return appropriate response based on deletion results
    if (!salesforceSuccess) {
        res.status(207).json({
            message: `Failed to delete ${objectType} from Salesforce`,
            salesforceErrors: deletionErrors,
            deletedFromSalesforce: false,
            details: {
                [objectType]: object[objectType]?.salesforce_id
            }
        });
    } else {
        res.json({
            message: `${objectType} removed successfully from Salesforce`,
            deletedFromSalesforce: true,
            details: {
                [objectType]: object[objectType]?.salesforce_id
            }
        });
    }
});

// @desc    Create bulk objects (Accounts, Contacts, Leads, or Events)
// @route   POST /api/objects/bulk
// @access  Private
const createBulkObjects = asyncHandler(async (req, res) => {
    const { objects } = req.body;

    if (!Array.isArray(objects) || objects.length === 0) {
        res.status(400);
        throw new Error('Please provide an array of objects to create');
    }

    // Maximum number of records to process in one request
    const MAX_BULK_RECORDS = 200;
    if (objects.length > MAX_BULK_RECORDS) {
        res.status(400);
        throw new Error(`Cannot process more than ${MAX_BULK_RECORDS} records at once`);
    }

    const results = {
        successful: [],
        failed: []
    };

    try {
        // Get Salesforce connection once for all operations
        const conn = await getSalesforceConnection(req, res);

        // Process all objects in parallel
        await Promise.all(objects.map(async (obj) => {
            const { transcription_id, status, account, contact, lead, event, opportunity, campaignMember } = obj;

            try {
                // Validate the object data
                if (account && (!account.Name || typeof account.Name !== 'string')) {
                    throw new Error('Account Name is required and must be a string');
                }
                if (contact && (!contact.LastName || typeof contact.LastName !== 'string')) {
                    throw new Error('Contact LastName is required and must be a string');
                }
                if (lead && (!lead.LastName || !lead.Company || typeof lead.LastName !== 'string' || typeof lead.Company !== 'string')) {
                    throw new Error('Lead LastName and Company are required and must be strings');
                }
                if (event && (!event.Subject || !event.StartDateTime)) {
                    throw new Error('Event Subject and StartDateTime are required');
                }

                // Create object in our database
                const dbObject = await Object.create({
                    transcription_id,
                    status,
                    account: account ? { ...account, sync_status: 'pending' } : null,
                    contact: contact ? { ...contact, sync_status: 'pending' } : null,
                    lead: lead ? { ...lead, sync_status: 'pending' } : null,
                    event: event ? { ...event, sync_status: 'pending' } : null,
                    opportunity: opportunity ? { ...opportunity, sync_status: 'pending' } : null,
                    campaignMember: campaignMember ? { ...campaignMember, sync_status: 'pending' } : null
                });

                // Sync with Salesforce
                if (account) {
                    const result = await syncWithSalesforce(conn, 'create', 'Account', account);
                    dbObject.account.salesforce_id = result.id;
                    dbObject.account.sync_status = 'synced';
                }
                if (contact) {
                    const result = await syncWithSalesforce(conn, 'create', 'Contact', contact);
                    dbObject.contact.salesforce_id = result.id;
                    dbObject.contact.sync_status = 'synced';
                }
                if (lead) {
                    const result = await syncWithSalesforce(conn, 'create', 'Lead', lead);
                    dbObject.lead.salesforce_id = result.id;
                    dbObject.lead.sync_status = 'synced';
                }
                if (event) {
                    const result = await syncWithSalesforce(conn, 'create', 'Event', event);
                    dbObject.event.salesforce_id = result.id;
                    dbObject.event.sync_status = 'synced';
                }
                if (opportunity) {
                    const result = await syncWithSalesforce(conn, 'create', 'Opportunity', opportunity);
                    dbObject.opportunity.salesforce_id = result.id;
                    dbObject.opportunity.sync_status = 'synced';
                }
                if (campaignMember) {
                    const result = await syncWithSalesforce(conn, 'create', 'CampaignMember', campaignMember);
                    dbObject.campaignMember = {
                        ...campaignMember,
                        salesforce_id: result.id,
                        sync_status: 'synced'
                    };
                    dbObject.markModified('campaignMember');
                }

                await dbObject.save();
                results.successful.push({
                    _id: dbObject._id,
                    account: dbObject.account,
                    contact: dbObject.contact,
                    lead: dbObject.lead,
                    event: dbObject.event,
                    opportunity: dbObject.opportunity,
                    campaignMember: dbObject.campaignMember
                });

            } catch (error) {
                results.failed.push({
                    object: obj,
                    error: error.message
                });
            }
        }));

        res.status(201).json({
            message: 'Bulk operation completed',
            total: objects.length,
            successful: results.successful.length,
            failed: results.failed.length,
            results
        });

    } catch (error) {
        // Handle Salesforce authentication errors
        if (error.message.includes('Please re-authenticate')) {
            res.status(401);
            throw new Error('Salesforce authentication expired. Please re-authenticate with Salesforce.');
        }

        res.status(500);
        throw new Error(`Bulk operation failed: ${error.message}`);
    }
});

// @desc    Execute multiple operations in a single request using Salesforce Composite API
// @route   POST /api/objects/composite
// @access  Private
const compositeOperation = asyncHandler(async (req, res) => {
    const { operations } = req.body;

    if (!Array.isArray(operations)) {
        res.status(400);
        throw new Error('Operations must be an array');
    }

    if (operations.length === 0) {
        res.status(400);
        throw new Error('At least one operation is required');
    }

    if (operations.length > 25) {
        res.status(400);
        throw new Error('Maximum 25 operations allowed in one composite request');
    }

    try {
        const conn = await getSalesforceConnection(req, res);

        // Prepare composite request
        const compositeRequest = operations.map((op, index) => {
            const { method, object, data, referenceId } = op;

            if (!method || !object || !data) {
                throw new Error(`Invalid operation at index ${index}. Method, object, and data are required.`);
            }

            // Transform data based on object type
            let transformedData = { ...data };
            if (object === 'Task') {
                transformedData = transformTaskData(data);
            } else if (object === 'Note') {
                transformedData = transformNoteData(data);
            } else if (object === 'Attachment') {
                transformedData = transformAttachmentData(data);
            }

            // Handle ParentId references
            if (transformedData.ParentId && typeof transformedData.ParentId === 'string' && transformedData.ParentId.startsWith('@{')) {
                // Keep the reference as is for Salesforce to resolve
                console.log(`Found ParentId reference: ${transformedData.ParentId}`);
            }

            // Filter valid fields
            const validData = filterValidFields(transformedData, object);

            // Basic validation for required fields
            if (object === 'Account' && !validData.Name) {
                throw new Error(`Account Name is required for operation ${index}`);
            }
            if (object === 'Contact' && !validData.LastName) {
                throw new Error(`Contact LastName is required for operation ${index}`);
            }
            if (object === 'Lead' && (!validData.LastName || !validData.Company)) {
                throw new Error(`Lead LastName and Company are required for operation ${index}`);
            }

            // Prepare the request object without httpHeaders
            return {
                method: method.toUpperCase(),
                url: `/services/data/v57.0/sobjects/${object}`,
                referenceId: referenceId || `ref${index}`,
                body: validData
            };
        });

        console.log('Sending composite request:', JSON.stringify(compositeRequest, null, 2));

        // Execute composite request with content type in the main request
        const compositeResponse = await conn.request({
            method: 'POST',
            url: '/services/data/v57.0/composite',
            headers: {
                'Content-Type': 'application/json',
                'Sforce-Call-Options': 'client=huscribe-backend'
            },
            body: JSON.stringify({
                allOrNone: false,
                compositeRequest
            })
        });

        console.log('Received composite response:', JSON.stringify(compositeResponse, null, 2));

        // Process responses and create/update local records
        const results = [];
        for (let i = 0; i < operations.length; i++) {
            const operation = operations[i];
            const response = compositeResponse.compositeResponse[i];
            const isSuccess = response.httpStatusCode >= 200 && response.httpStatusCode < 300;

            // Extract Salesforce error messages if present
            const errorMessages = [];
            if (!isSuccess && response.body && Array.isArray(response.body)) {
                response.body.forEach(error => {
                    if (error.message) {
                        errorMessages.push(error.message);
                    }
                });
            }

            // Create or update local record
            let localRecord = {
                status: isSuccess ? 'synced' : 'sync_failed',
                [operation.object.toLowerCase()]: {
                    ...operation.data,
                    salesforce_id: isSuccess ? response.body.id : null,
                    sync_status: isSuccess ? 'synced' : 'failed'
                }
            };

            // If it's an attachment, don't return the binary data
            if (operation.object === 'Attachment' && localRecord.attachment) {
                localRecord.attachment.Body = 'BINARY_DATA_NOT_RETURNED';
            }

            // Save to database
            const savedRecord = await Object.create(localRecord);

            results.push({
                referenceId: operation.referenceId || `ref${i}`,
                success: isSuccess,
                statusCode: response.httpStatusCode,
                record: savedRecord,
                salesforceId: isSuccess ? response.body.id : null,
                errors: errorMessages.length > 0 ? errorMessages : response.body?.errors || []
            });
        }

        // Check if any operations succeeded
        const hasSuccesses = results.some(result => result.success);
        const allFailed = results.every(result => !result.success);

        if (allFailed) {
            res.status(400);
            return res.json({
                success: false,
                message: 'All operations failed',
                results
            });
        }

        res.status(hasSuccesses ? 200 : 207).json({
            success: hasSuccesses,
            message: hasSuccesses ?
                (results.every(r => r.success) ? 'All operations succeeded' : 'Some operations succeeded')
                : 'All operations failed',
            results
        });

    } catch (error) {
        console.error('Composite operation error:', error);

        if (error.message.includes('Please re-authenticate')) {
            res.status(401);
            throw new Error('Salesforce authentication expired. Please re-authenticate with Salesforce.');
        } else {
            res.status(500);
            throw new Error(`Composite operation failed: ${error.message}`);
        }
    }
});

// @desc    Post to Chatter Feed
// @route   POST /api/objects/chatter
// @access  Private
const postToChatter = asyncHandler(async (req, res) => {
    const { parentId, body, title, type = 'TextPost', isRichText = false } = req.body;

    if (!parentId || !body) {
        res.status(400);
        throw new Error('ParentId and Body are required for Chatter posts');
    }

    try {
        const conn = await getSalesforceConnection(req, res);

        // Prepare the feed item data
        const feedItemData = filterValidFields({
            ParentId: parentId,
            Body: body,
            Title: title,
            Type: type,
            IsRichText: isRichText
        }, 'ChatterFeedItem');

        // Create the Chatter feed post
        const result = await conn.request({
            method: 'POST',
            url: '/services/data/v57.0/sobjects/FeedItem',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(feedItemData)
        });

        // Fetch the created feed item to get complete data
        const feedItem = await conn.request({
            method: 'GET',
            url: `/services/data/v57.0/sobjects/FeedItem/${result.id}`,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Create a record in our database
        const object = await Object.create({
            status: 'synced',
            chatterFeed: {
                ...feedItemData,
                salesforce_id: result.id,
                sync_status: 'synced'
            }
        });

        res.status(201).json({
            success: true,
            data: {
                salesforce_id: result.id,
                mongodb_id: object._id,
                feedItem: {
                    ...feedItem,
                    Body: body,
                    ParentId: parentId,
                    Title: title,
                    Type: type,
                    IsRichText: isRichText,
                    CreatedDate: feedItem.CreatedDate,
                    LastModifiedDate: feedItem.LastModifiedDate,
                    CreatedById: feedItem.CreatedById,
                    LastModifiedById: feedItem.LastModifiedById
                },
                object: object.toObject()
            }
        });

    } catch (error) {
        console.error('Chatter post error:', error);

        if (error.message.includes('Please re-authenticate')) {
            res.status(401);
            throw new Error('Salesforce authentication expired. Please re-authenticate with Salesforce.');
        }

        res.status(500);
        throw new Error(`Failed to post to Chatter: ${error.message}`);
    }
});

// @desc    Get all Chatter Feed posts
// @route   GET /api/objects/chatter
// @access  Private
const getAllChatterPosts = asyncHandler(async (req, res) => {
    try {
        const conn = await getSalesforceConnection(req, res);

        // Get query parameters for filtering
        const { parentId, createdById, type } = req.query;

        // Build the SOQL query with correct fields
        let query = 'SELECT Id, ParentId, Body, Title, Type, IsRichText, CreatedDate FROM FeedItem';

        // Add WHERE clause conditions if filters are provided
        const conditions = [];
        if (parentId) conditions.push(`ParentId = '${parentId}'`);
        if (createdById) conditions.push(`CreatedById = '${createdById}'`);
        if (type) conditions.push(`Type = '${type}'`);

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        // Add ORDER BY clause to get newest posts first
        query += ' ORDER BY CreatedDate DESC LIMIT 100';

        // Execute the query
        const result = await conn.query(query);

        // Get corresponding MongoDB records
        const mongoRecords = await Object.find({
            'chatterFeed.salesforce_id': { $in: result.records.map(record => record.Id) }
        });

        // Map Salesforce records with MongoDB records
        const enhancedRecords = result.records.map(record => {
            const mongoRecord = mongoRecords.find(
                mr => mr.chatterFeed && mr.chatterFeed.salesforce_id === record.Id
            );
            return {
                salesforce_id: record.Id,
                mongodb_id: mongoRecord ? mongoRecord._id : null,
                feedItem: record,
                object: mongoRecord ? mongoRecord.toObject() : null
            };
        });

        res.json({
            success: true,
            total: result.totalSize,
            data: enhancedRecords
        });

    } catch (error) {
        console.error('Get all Chatter posts error:', error);

        if (error.message.includes('Please re-authenticate')) {
            res.status(401);
            throw new Error('Salesforce authentication expired. Please re-authenticate with Salesforce.');
        }

        res.status(500);
        throw new Error(`Failed to get Chatter posts: ${error.message}`);
    }
});

// @desc    Delete a Chatter Feed post
// @route   DELETE /api/objects/chatter/:id
// @access  Private
const deleteChatterPost = asyncHandler(async (req, res) => {
    const feedItemId = req.params.id;

    if (!feedItemId) {
        res.status(400);
        throw new Error('Feed Item ID is required');
    }

    try {
        const conn = await getSalesforceConnection(req, res);

        // Delete the Chatter feed post
        await conn.request({
            method: 'DELETE',
            url: `/services/data/v57.0/sobjects/FeedItem/${feedItemId}`,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Find and update the local record
        const object = await Object.findOne({ 'chatterFeed.salesforce_id': feedItemId });
        if (object) {
            object.chatterFeed = null;
            object.markModified('chatterFeed');
            await object.save();
        }

        res.json({
            success: true,
            message: 'Chatter post deleted successfully'
        });

    } catch (error) {
        console.error('Chatter post deletion error:', error);

        if (error.message.includes('Please re-authenticate')) {
            res.status(401);
            throw new Error('Salesforce authentication expired. Please re-authenticate with Salesforce.');
        }

        if (error.errorCode === 'NOT_FOUND' || error.errorCode === 'INVALID_ID_FIELD') {
            res.status(404);
            throw new Error('Chatter post not found');
        }

        res.status(500);
        throw new Error(`Failed to delete Chatter post: ${error.message}`);
    }
});

// @desc    Get a Chatter Feed post
// @route   GET /api/objects/chatter/:id
// @access  Private
const getChatterPost = asyncHandler(async (req, res) => {
    const feedItemId = req.params.id;

    if (!feedItemId) {
        res.status(400);
        throw new Error('Feed Item ID is required');
    }

    try {
        const conn = await getSalesforceConnection(req, res);

        // Fetch the feed item
        const feedItem = await conn.request({
            method: 'GET',
            url: `/services/data/v57.0/sobjects/FeedItem/${feedItemId}`,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Find the local record
        const object = await Object.findOne({ 'chatterFeed.salesforce_id': feedItemId });

        res.json({
            success: true,
            data: {
                feedItem,
                object: object ? object.toObject() : null
            }
        });

    } catch (error) {
        console.error('Chatter post fetch error:', error);

        if (error.message.includes('Please re-authenticate')) {
            res.status(401);
            throw new Error('Salesforce authentication expired. Please re-authenticate with Salesforce.');
        }

        if (error.errorCode === 'NOT_FOUND' || error.errorCode === 'INVALID_ID_FIELD') {
            res.status(404);
            throw new Error('Chatter post not found');
        }

        res.status(500);
        throw new Error(`Failed to fetch Chatter post: ${error.message}`);
    }
});

// @desc    Convert Lead to Account/Contact/Opportunity
// @route   POST /api/objects/lead/:id/convert
// @access  Private
const convertLead = asyncHandler(async (req, res) => {
    const leadId = req.params.id;
    const {
        convertedStatus = 'Closed - Converted', // Updated default status
        accountId,
        contactId,
        createOpportunity = true,
        opportunityName,
        overwriteLeadSource = false,
        sendNotificationEmail = false
    } = req.body;

    if (!leadId) {
        res.status(400);
        throw new Error('Lead ID is required');
    }

    try {
        // First verify the lead exists in our database
        const localLead = await Object.findOne({ 'lead.salesforce_id': leadId });
        if (!localLead || !localLead.lead) {
            res.status(404);
            throw new Error('Lead not found in local database');
        }

        const conn = await getSalesforceConnection(req, res);

        // Debug: Check lead status and conversion status options
        console.log('Checking lead details and conversion options...');
        const [lead, statusOptions] = await Promise.all([
            conn.sobject('Lead').retrieve(leadId),
            conn.query("SELECT MasterLabel, IsConverted FROM LeadStatus")
        ]);

        console.log('Lead details:', {
            Id: lead.Id,
            Status: lead.Status,
            IsConverted: lead.IsConverted
        });
        console.log('Available statuses:', statusOptions.records.map(s => ({
            status: s.MasterLabel,
            isConverted: s.IsConverted
        })));

        if (lead.IsConverted) {
            res.status(400);
            throw new Error('Lead is already converted');
        }

        // Validate conversion status
        const validConversionStatus = statusOptions.records.find(
            s => s.MasterLabel === convertedStatus && s.IsConverted
        );
        if (!validConversionStatus) {
            res.status(400);
            throw new Error(`Invalid conversion status. Must be one of: ${statusOptions.records
                .filter(s => s.IsConverted)
                .map(s => s.MasterLabel)
                .join(', ')
                }`);
        }

        // Execute lead conversion by creating related objects and updating lead
        console.log('Starting lead conversion process...');

        try {
            // First verify the lead exists and get its details
            console.log('Verifying lead...');
            const leadDetails = await conn.sobject('Lead').retrieve(leadId);
            console.log('Lead details:', leadDetails);

            if (!leadDetails) {
                res.status(404);
                throw new Error('Lead not found in Salesforce');
            }

            if (leadDetails.IsConverted) {
                res.status(400);
                throw new Error('Lead is already converted');
            }

            // First create the Account if one doesn't exist
            console.log('Creating/Getting Account...');
            let accountId;
            if (leadDetails.Company) {
                // Check for existing account with same name
                const existingAccounts = await conn.query(`
                    SELECT Id FROM Account WHERE Name = '${leadDetails.Company}' LIMIT 1
                `);
                if (existingAccounts.records.length > 0) {
                    accountId = existingAccounts.records[0].Id;
                    console.log('Using existing account:', accountId);
                }
            }

            if (!accountId) {
                const accountResult = await conn.sobject('Account').create({
                    Name: leadDetails.Company || 'Converted Lead Account',
                    Phone: leadDetails.Phone,
                    Website: leadDetails.Website,
                    Industry: leadDetails.Industry
                });
                accountId = accountResult.id;
                console.log('Created new account:', accountId);
            }

            // Check for existing contacts
            console.log('Creating/Getting Contact...');
            let contactId;
            if (leadDetails.Email || (leadDetails.FirstName && leadDetails.LastName)) {
                // Build the query conditions
                const conditions = [];
                if (leadDetails.Email) {
                    conditions.push(`Email = '${leadDetails.Email}'`);
                }
                if (leadDetails.FirstName && leadDetails.LastName) {
                    conditions.push(`(FirstName = '${leadDetails.FirstName}' AND LastName = '${leadDetails.LastName}')`);
                }

                const existingContacts = await conn.query(`
                    SELECT Id, AccountId 
                    FROM Contact 
                    WHERE ${conditions.join(' OR ')}
                    LIMIT 1
                `);

                if (existingContacts.records.length > 0) {
                    contactId = existingContacts.records[0].Id;
                    console.log('Using existing contact:', contactId);

                    // Update contact's account if needed
                    if (existingContacts.records[0].AccountId !== accountId) {
                        await conn.sobject('Contact').update({
                            Id: contactId,
                            AccountId: accountId
                        });
                        console.log('Updated existing contact with new account');
                    }
                }
            }

            if (!contactId) {
                try {
                    console.log('Attempting to create new contact...');
                    const contactResult = await conn.sobject('Contact').create({
                        AccountId: accountId,
                        FirstName: leadDetails.FirstName,
                        LastName: leadDetails.LastName || 'Unknown',
                        Email: leadDetails.Email,
                        Phone: leadDetails.Phone,
                        Title: leadDetails.Title
                    });
                    contactId = contactResult.id;
                    console.log('Created new contact:', contactId);
                } catch (error) {
                    if (error.errorCode === 'DUPLICATES_DETECTED') {
                        console.log('Duplicate contact detected, full error:', JSON.stringify(error, null, 2));

                        // Try to get duplicate record details from the error
                        const duplicateResult = error.data?.duplicateResult;
                        console.log('Duplicate result:', JSON.stringify(duplicateResult, null, 2));

                        // Query for the duplicate contact
                        const queryParts = [];
                        if (leadDetails.Email) {
                            queryParts.push(`Email = '${leadDetails.Email.replace(/'/g, "\\'")}'`);
                        }
                        if (leadDetails.Phone) {
                            queryParts.push(`Phone = '${leadDetails.Phone.replace(/'/g, "\\'")}'`);
                        }
                        if (leadDetails.FirstName && leadDetails.LastName) {
                            queryParts.push(`(FirstName = '${leadDetails.FirstName.replace(/'/g, "\\'")}' AND LastName = '${leadDetails.LastName.replace(/'/g, "\\'")}')`);
                        }

                        if (queryParts.length === 0) {
                            throw new Error('No criteria available to find duplicate contact');
                        }

                        const query = `
                            SELECT Id, AccountId, FirstName, LastName, Email, Phone
                            FROM Contact 
                            WHERE ${queryParts.join(' OR ')}
                            ORDER BY CreatedDate DESC
                            LIMIT 1
                        `;
                        console.log('Searching for duplicate contact with query:', query);

                        const searchResult = await conn.query(query);
                        console.log('Search result:', JSON.stringify(searchResult, null, 2));

                        if (searchResult.records.length > 0) {
                            contactId = searchResult.records[0].Id;
                            console.log('Found duplicate contact:', contactId);

                            // Update account if needed
                            if (searchResult.records[0].AccountId !== accountId) {
                                await conn.sobject('Contact').update({
                                    Id: contactId,
                                    AccountId: accountId
                                });
                                console.log('Updated duplicate contact account');
                            }
                        } else {
                            // If no duplicate found, create new contact with duplicate rules disabled
                            console.log('No duplicate found, creating new contact with duplicate rules disabled');

                            // Use raw REST API call to bypass duplicate rules
                            const newContact = await conn.request({
                                method: 'POST',
                                url: '/services/data/v57.0/sobjects/Contact',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Sforce-Duplicate-Rule-Header': 'allowSave=true'
                                },
                                body: JSON.stringify({
                                    AccountId: accountId,
                                    FirstName: leadDetails.FirstName,
                                    LastName: leadDetails.LastName || 'Unknown',
                                    Email: leadDetails.Email,
                                    Phone: leadDetails.Phone,
                                    Title: leadDetails.Title
                                })
                            });

                            if (!newContact.success) {
                                throw new Error(`Failed to create contact: ${JSON.stringify(newContact.errors)}`);
                            }

                            contactId = newContact.id;
                            console.log('Created new contact with duplicate rules disabled:', contactId);
                        }
                    } else {
                        throw error;
                    }
                }
            }

            if (!contactId) {
                throw new Error('Failed to create or find a contact');
            }

            // Create Opportunity if requested
            let opportunityId = null;
            if (createOpportunity) {
                console.log('Creating Opportunity...');
                const opportunityResult = await conn.sobject('Opportunity').create({
                    AccountId: accountId,
                    Name: opportunityName || `${leadDetails.Company || 'New'} - Opportunity`,
                    StageName: 'Prospecting',
                    CloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                });
                opportunityId = opportunityResult.id;
                console.log('Created Opportunity:', opportunityId);
            }

            // Now convert the lead using DML
            console.log('Converting lead...');
            const result = await conn.request({
                method: 'POST',
                url: `/services/data/v57.0/sobjects/Lead/${leadId}/convertLead`,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    accountId: accountId,
                    contactId: contactId,
                    convertedStatus: convertedStatus,
                    doNotCreateOpportunity: !createOpportunity,
                    opportunityId: opportunityId,
                    overwriteLeadSource: true,
                    ownerId: leadDetails.OwnerId
                })
            });

            console.log('Conversion result:', result);

            const convertedData = {
                accountId: accountId,
                contactId: contactId,
                opportunityId: opportunityId,
                success: true
            };

            // Update local record
            localLead.lead.sync_status = 'converted';
            localLead.lead.convertedData = convertedData;

            // Update related objects in local database
            localLead.account = {
                salesforce_id: convertedData.accountId,
                sync_status: 'synced'
            };
            localLead.contact = {
                salesforce_id: convertedData.contactId,
                sync_status: 'synced'
            };
            if (convertedData.opportunityId) {
                localLead.opportunity = {
                    salesforce_id: convertedData.opportunityId,
                    sync_status: 'synced'
                };
            }
            await localLead.save();

            res.json({
                success: true,
                data: convertedData
            });

        } catch (error) {
            console.error('Lead conversion error:', error);
            throw error;
        }

    } catch (error) {
        console.error('Lead conversion error:', error);

        if (error.message.includes('Please re-authenticate')) {
            res.status(401);
            throw new Error('Salesforce authentication expired. Please re-authenticate.');
        }

        if (error.errorCode === 'NOT_FOUND' || error.message.includes('not found')) {
            res.status(404);
            throw new Error(`Lead not found: ${error.message}`);
        }

        if (error.errorCode === 'INVALID_STATUS') {
            res.status(400);
            throw new Error(`Invalid converted status: ${error.message}`);
        }

        if (error.errorCode === 'ENTITY_IS_DELETED') {
            res.status(400);
            throw new Error('This lead has been deleted and cannot be converted');
        }

        if (error.errorCode === 'ALREADY_CONVERTED') {
            res.status(400);
            throw new Error('This lead has already been converted');
        }

        res.status(error.statusCode || 500);
        throw new Error(`Failed to convert lead: ${error.message}`);
    }
});

// @desc    Update a Chatter Feed post
// @route   PUT /api/objects/chatter/:id
// @access  Private
const updateChatterPost = asyncHandler(async (req, res) => {
    const feedItemId = req.params.id;
    const { body, title, isRichText } = req.body;

    if (!feedItemId) {
        res.status(400);
        throw new Error('Feed Item ID is required');
    }

    if (!body && !title) {
        res.status(400);
        throw new Error('At least one field (body or title) is required for update');
    }

    try {
        const conn = await getSalesforceConnection(req, res);

        // Prepare the update data
        const updateData = {};
        if (body) updateData.Body = body;
        if (title) updateData.Title = title;
        if (isRichText !== undefined) updateData.IsRichText = isRichText;

        // Update the Chatter feed post
        await conn.request({
            method: 'PATCH',
            url: `/services/data/v57.0/sobjects/FeedItem/${feedItemId}`,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        // Fetch the updated feed item
        const updatedFeedItem = await conn.request({
            method: 'GET',
            url: `/services/data/v57.0/sobjects/FeedItem/${feedItemId}`,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Update the local record
        const object = await Object.findOne({ 'chatterFeed.salesforce_id': feedItemId });
        if (object) {
            object.chatterFeed = {
                ...object.chatterFeed,
                ...updateData,
                sync_status: 'synced'
            };
            object.markModified('chatterFeed');
            await object.save();
        }

        res.json({
            success: true,
            data: {
                feedItem: updatedFeedItem,
                object: object ? object.toObject() : null
            }
        });

    } catch (error) {
        console.error('Chatter post update error:', error);

        if (error.message.includes('Please re-authenticate')) {
            res.status(401);
            throw new Error('Salesforce authentication expired. Please re-authenticate with Salesforce.');
        }

        if (error.errorCode === 'NOT_FOUND' || error.errorCode === 'INVALID_ID_FIELD') {
            res.status(404);
            throw new Error('Chatter post not found');
        }

        res.status(500);
        throw new Error(`Failed to update Chatter post: ${error.message}`);
    }
});

export {
    createObject,
    getObjects,
    getObjectById,
    updateObject,
    deleteObject,
    createBulkObjects,
    compositeOperation,
    postToChatter,
    deleteChatterPost,
    getChatterPost,
    getAllChatterPosts,
    convertLead,
    updateChatterPost  // Add this export
}; 