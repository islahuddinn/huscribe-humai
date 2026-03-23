import asyncHandler from 'express-async-handler';
import axios from 'axios';

/**
 * @desc    Log a call in Salesforce
 * @route   POST /api/salesforce/activities/log-call
 * @access  Private
 */
const logCall = asyncHandler(async (req, res) => {
    try {
        const { 
            subject, 
            description, 
            callDurationInSeconds, 
            callType, // Inbound, Outbound
            callDisposition, // Completed, No Answer, Left Message, etc.
            relatedToId, // WhatId - Account, Opportunity, etc.
            contactId, // WhoId - Contact/Lead ID
            callDateTime,
            status = 'Completed'
        } = req.body;

        // Validate required fields
        if (!subject) {
            return res.status(400).json({
                crmType: 'salesforce',
                status: 400,
                success: false,
                message: 'Subject is required for call logging'
            });
        }

        // // Get the Salesforce session data
        // const salesforceSession = req.session.salesforce;
        // if (!salesforceSession || !salesforceSession.accessToken || !salesforceSession.instanceUrl) {
        //     return res.status(401).json({
        //         crmType: 'salesforce',
        //         status: 401,
        //         success: false,
        //         message: 'Salesforce session not found or expired'
        //     });
        // }

           const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

        // Build Task object for call logging
        const taskData = {
            Subject: subject,
            Description: description,
            TaskSubtype: 'Call',
            CallDurationInSeconds: callDurationInSeconds || 0,
            CallType: callType || 'Outbound',
            CallDisposition: callDisposition,
            Status: status,
            ActivityDate: callDateTime ? new Date(callDateTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        };

        // Add WhatId (related to) if provided
        if (relatedToId) {
            taskData.WhatId = relatedToId;
        }

        // Add WhoId (contact/lead) if provided
        if (contactId) {
            taskData.WhoId = contactId;
        }

        // Make API call to create Task
        const response = await axios.post(
            `${instanceUrl}/services/data/v57.0/sobjects/Task`,
            taskData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data && response.data.success) {
            return res.status(201).json({
                crmType: 'salesforce',
                status: 201,
                success: true,
                data: {
                    id: response.data.id,
                    message: 'Call logged successfully'
                }
            });
        } else {
            throw new Error('Failed to log call in Salesforce');
        }
    } catch (error) {
        console.error('Error logging call in Salesforce:', error);
        return res.status(error.response?.status || 500).json({
            crmType: 'salesforce',
            status: error.response?.status || 500,
            success: false,
            data: error.response?.data || { message: error.message }
        });
    }
});

/**
 * @desc    Get call logs from Salesforce for a specific entity
 * @route   GET /api/salesforce/activities/call-logs/:entityId
 * @access  Private
 */
const getCallLogs = asyncHandler(async (req, res) => {
    try {
        const { entityId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        if (!entityId) {
            return res.status(400).json({
                crmType: 'salesforce',
                status: 400,
                success: false,
                message: 'Entity ID is required'
            });
        }

        // Get the Salesforce session data
    const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }

        // Query for call logs related to the entity
        // This query gets Tasks with TaskSubtype = 'Call' for either WhatId or WhoId
        const query = encodeURIComponent(
            `SELECT Id, Subject, Description, Status, ActivityDate, CallDurationInSeconds, CallType, CallDisposition, WhoId, WhatId, CreatedDate, LastModifiedDate FROM Task WHERE TaskSubtype = 'Call' AND (WhatId = '${entityId}' OR WhoId = '${entityId}') ORDER BY ActivityDate DESC, CreatedDate DESC LIMIT ${limit} OFFSET ${offset}`
        );

        const response = await axios.get(
            `${instanceUrl}/services/data/v57.0/query?q=${query}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return res.status(200).json({
            crmType: 'salesforce',
            status: 200,
            success: true,
            data: response.data.records || [],
            totalSize: response.data.totalSize || 0,
            done: response.data.done
        });
    } catch (error) {
        console.error('Error fetching call logs from Salesforce:', error);
        return res.status(error.response?.status || 500).json({
            crmType: 'salesforce',
            status: error.response?.status || 500,
            success: false,
            data: error.response?.data || { message: error.message }
        });
    }
});

/**
 * @desc    Log an email in Salesforce
 * @route   POST /api/salesforce/activities/log-email
 * @access  Private
 */
const logEmail = asyncHandler(async (req, res) => {
    try {
        const { 
            subject, 
            htmlBody,
            textBody,
            toAddress,
            fromAddress,
            ccAddress,
            bccAddress,
            relatedToId, // WhatId - Account, Opportunity, etc.
            contactId, // WhoId - Contact/Lead ID
            status = 'Completed',
            emailDate,
            direction = 'Outbound' // Inbound or Outbound
        } = req.body;

        // Validate required fields
        if (!subject || (!htmlBody && !textBody)) {
            return res.status(400).json({
                crmType: 'salesforce',
                status: 400,
                success: false,
                message: 'Subject and email body (HTML or text) are required'
            });
        }

   const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }
        // There are two approaches:
        // 1. Create a Task with TaskSubtype = 'Email' (simpler but less data)
        // 2. Create an EmailMessage (more data but requires Email-to-Case to be enabled)
        
        // Approach 1: Using Task object
        const taskData = {
            Subject: subject,
            Description: textBody || htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML tags for plain text
            TaskSubtype: 'Email',
            Status: status,
            ActivityDate: emailDate ? new Date(emailDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        };

        // Add WhatId (related to) if provided
        if (relatedToId) {
            taskData.WhatId = relatedToId;
        }

        // Add WhoId (contact/lead) if provided
        if (contactId) {
            taskData.WhoId = contactId;
        }

        // Make API call to create Task
        const response = await axios.post(
            `${instanceUrl}/services/data/v57.0/sobjects/Task`,
            taskData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data && response.data.success) {
            return res.status(201).json({
                crmType: 'salesforce',
                status: 201,
                success: true,
                data: {
                    id: response.data.id,
                    message: 'Email logged successfully'
                }
            });
        } else {
            throw new Error('Failed to log email in Salesforce');
        }
    } catch (error) {
        console.error('Error logging email in Salesforce:', error);
        return res.status(error.response?.status || 500).json({
            crmType: 'salesforce',
            status: error.response?.status || 500,
            success: false,
            data: error.response?.data || { message: error.message }
        });
    }
});

/**
 * @desc    Get email activities from Salesforce for a specific entity
 * @route   GET /api/salesforce/activities/email-logs/:entityId
 * @access  Private
 */
const getEmailLogs = asyncHandler(async (req, res) => {
    try {
        const { entityId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        if (!entityId) {
            return res.status(400).json({
                crmType: 'salesforce',
                status: 400,
                success: false,
                message: 'Entity ID is required'
            });
        }

   const accessToken = req.headers.authorization?.split(' ')[1];
    const instanceUrl = req.headers['instance-url'];

    if (!accessToken || !instanceUrl) {
      return res.status(401).json(formatResponse('Access token or instance URL is missing', 401, false));
    }
        // Query for email logs related to the entity
        const query = encodeURIComponent(
            `SELECT Id, Subject, Description, Status, ActivityDate, WhoId, WhatId, CreatedDate, LastModifiedDate FROM Task WHERE TaskSubtype = 'Email' AND (WhatId = '${entityId}' OR WhoId = '${entityId}') ORDER BY ActivityDate DESC, CreatedDate DESC LIMIT ${limit} OFFSET ${offset}`
        );

        const response = await axios.get(
            `${instanceUrl}/services/data/v57.0/query?q=${query}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return res.status(200).json({
            crmType: 'salesforce',
            status: 200,
            success: true,
            data: response.data.records || [],
            totalSize: response.data.totalSize || 0,
            done: response.data.done
        });
    } catch (error) {
        console.error('Error fetching email logs from Salesforce:', error);
        return res.status(error.response?.status || 500).json({
            crmType: 'salesforce',
            status: error.response?.status || 500,
            success: false,
            data: error.response?.data || { message: error.message }
        });
    }
});

export {
    logCall,
    getCallLogs,
    logEmail,
    getEmailLogs
}; 