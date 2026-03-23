import jsforce from 'jsforce';
import * as dotenv from 'dotenv';
dotenv.config();

const SF_LOGIN_URL = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
const SF_CLIENT_ID = process.env.SF_CLIENT_ID;
const SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET;


export const salesforceConfig = {
  baseUrl: process.env.SF_LOGIN_URL   , //'https://your-salesforce-instance-url.com',
  accessToken: process.env.accessToken // 'your-access-token',
};

/**
 * Creates a Salesforce connection using the provided access token and instance URL.
 * @param {string} accessToken - The OAuth access token.
 * @param {string} instanceUrl - The Salesforce instance URL.
 * @returns {Promise<jsforce.Connection>} - A Salesforce connection object.
 */
const createSalesforceConnection = async (accessToken, instanceUrl) => {
    try {
        console.log('Creating Salesforce connection...');
        const conn = new jsforce.Connection({
            instanceUrl: instanceUrl,
            accessToken: accessToken,
            version: '57.0'
        });

        // Initialize metadata API
        conn.metadata.pollTimeout = 60000;
        conn.metadata.pollInterval = 5000;

        // Test connection
        await conn.identity();
        console.log('Salesforce connection successful');

        return conn;
    } catch (error) {
        console.error('Error creating Salesforce connection:', error);
        throw new Error(`Failed to connect to Salesforce: ${error.message}`);
    }
};

/**
 * Waits for metadata deployment to complete.
 * @param {jsforce.Connection} conn - The Salesforce connection object.
 * @param {object} result - The deployment result.
 * @param {number} maxAttempts - Maximum number of attempts to check deployment status.
 * @returns {Promise<boolean>} - True if deployment is successful, false otherwise.
 */
const waitForMetadataDeployment = async (conn, result, maxAttempts = 20) => {
    if (!result || !result.id) return;

    for (let i = 0; i < maxAttempts; i++) {
        try {
            const status = await conn.metadata.checkDeployStatus(result.id);
            if (status.done) {
                if (status.success) {
                    console.log('Deployment completed successfully');
                    return true;
                } else {
                    console.error('Deployment failed:', status.details);
                    return false;
                }
            }
            console.log(`Waiting for deployment... Attempt ${i + 1}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
            console.error('Error checking deployment status:', error);
        }
    }
    return false;
};

/**
 * Ensures that the custom object `Meeting_Summary__c` exists in the Salesforce org.
 * If it doesn't exist, it creates the object and required fields.
 * @param {jsforce.Connection} conn - The Salesforce connection object.
 * @returns {Promise<boolean>} - True if the object exists or was created successfully.
 */
const ensureCustomObjectExists = async (conn) => {
    try {
        // Try to describe the object first
        console.log('Checking if Meeting_Summary__c object exists...');
        const describeResult = await conn.sobject('Meeting_Summary__c').describe().catch(() => null);

        // If object doesn't exist, create it
        if (!describeResult) {
            console.log('Meeting_Summary__c object not found, creating it...');

            // Create custom object metadata
            const metadata = [{
                fullName: 'Meeting_Summary__c',
                label: 'Meeting Summary',
                pluralLabel: 'Meeting Summaries',
                nameField: {
                    type: 'Text',
                    label: 'Meeting Summary Name'
                },
                deploymentStatus: 'Deployed',
                sharingModel: 'ReadWrite',
                fields: [
                    {
                        fullName: 'External_Id__c',
                        label: 'External ID',
                        type: 'Text',
                        length: 255,
                        externalId: true,
                        unique: true
                    },
                    {
                        fullName: 'Summary_Text__c',
                        label: 'Summary Text',
                        type: 'LongTextArea',
                        length: 32768,
                        visibleLines: 3
                    },
                    {
                        fullName: 'Key_Points__c',
                        label: 'Key Points',
                        type: 'LongTextArea',
                        length: 32768,
                        visibleLines: 3
                    },
                    {
                        fullName: 'Leads__c',
                        label: 'Leads',
                        type: 'Text',
                        length: 255
                    },
                    {
                        fullName: 'Tasks__c',
                        label: 'Tasks',
                        type: 'Text',
                        length: 255
                    },
                    {
                        fullName: 'Status__c',
                        label: 'Status',
                        type: 'Picklist',
                        picklist: {
                            sorted: true,
                            picklistValues: [
                                { fullName: 'pending', default: true },
                                { fullName: 'completed' },
                                { fullName: 'failed' }
                            ]
                        }
                    },
                    {
                        fullName: 'Type__c',
                        label: 'Type',
                        type: 'Picklist',
                        picklist: {
                            sorted: true,
                            picklistValues: [
                                { fullName: 'meeting', default: true },
                                { fullName: 'call' },
                                { fullName: 'voice_memo' }
                            ]
                        }
                    }
                ]
            }];

            try {
                // Create the custom object with all fields
                console.log('Creating custom object and fields...');
                const createResult = await conn.metadata.create('CustomObject', metadata);
                console.log('Create result:', createResult);

                if (!createResult[0].success) {
                    throw new Error(`Failed to create custom object: ${createResult[0].errors.join(', ')}`);
                }

                // Wait for deployment
                await waitForMetadataDeployment(conn, createResult[0]);
            } catch (error) {
                console.error('Error creating custom object:', error);
                if (!error.message.includes('already exists')) {
                    throw error;
                }
            }
        }

        // Verify fields exist
        const finalDescribe = await conn.sobject('Meeting_Summary__c').describe();
        const fields = finalDescribe.fields.map(f => f.name);
        const requiredFields = [
            'External_Id__c', 'Summary_Text__c', 'Key_Points__c',
            'Leads__c', 'Tasks__c', 'Status__c', 'Type__c'
        ];

        const missingFields = requiredFields.filter(field => !fields.includes(field));
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        return true;
    } catch (error) {
        console.error('Error in ensureCustomObjectExists:', error);
        throw error;
    }
};

/**
 * Upserts a record in the `Meeting_Summary__c` object.
 * @param {jsforce.Connection} conn - The Salesforce connection object.
 * @param {object} data - The data to upsert.
 * @returns {Promise<object>} - The result of the upsert operation.
 */
const upsertSalesforceRecord = async (conn, data) => {
    try {
        console.log('Starting Salesforce record upsert...');
        console.log('Input data:', data);

        // Verify object exists with required fields
        await ensureCustomObjectExists(conn);

        // Create record
        const record = {
            Name: `Summary ${new Date().toISOString()}`,
            External_Id__c: data.external_id || `summary_${Date.now()}`,
            Summary_Text__c: data.Summary_Text__c || '',
            Key_Points__c: data.Key_Points__c || '',
            Leads__c: data.Leads__c || '',
            Tasks__c: data.Tasks__c || '',
            Status__c: data.Status__c || 'pending',
            Type__c: data.Type__c || 'meeting'
        };

        console.log('Prepared Salesforce record:', record);

        // Attempt upsert
        console.log('Attempting upsert operation...');
        const result = await conn.sobject('Meeting_Summary__c').upsert(record, 'External_Id__c');
        console.log('Upsert result:', result);

        return {
            success: true,
            id: result.id,
            created: result.created,
            external_id: record.External_Id__c
        };
    } catch (error) {
        console.error('Error in Salesforce operation:', error);
        throw error;
    }
};

/**
 * Updates a Salesforce record in the `Meeting_Summary__c` object.
 * @param {jsforce.Connection} conn - The Salesforce connection object.
 * @param {string} recordId - The ID of the record to update.
 * @param {object} data - The data to update.
 * @returns {Promise<object>} - The result of the update operation.
 */
const updateSalesforceRecord = async (conn, recordId, data) => {
    try {
        // First check if the Meeting_Summary__c object exists
        const describeResult = await conn.describe('Meeting_Summary__c').catch(() => null);
        if (!describeResult) {
            throw new Error('Meeting_Summary__c object does not exist in Salesforce. Please create the custom object first.');
        }

        if (!recordId) {
            throw new Error('Record ID is required for update');
        }

        // Create the record with field validation
        const record = {
            Id: recordId,
            Summary_Text__c: data.transcribed_text || '',
            Key_Points__c: Array.isArray(data.key_points) ? data.key_points.join('\n') : data.key_points || '',
            Leads__c: data.leads || '',
            Tasks__c: data.task || '',
            Status__c: data.status || 'pending',
            Type__c: data.type || 'meeting'
        };

        const response = await conn.sobject('Meeting_Summary__c').update(record);

        if (!response.success) {
            throw new Error(`Failed to update record: ${response.errors.join(', ')}`);
        }

        return response;
    } catch (error) {
        console.error('Error updating Salesforce record:', error);
        if (error.errorCode === 'NOT_FOUND') {
            throw new Error('The Meeting_Summary__c object or record does not exist in Salesforce.');
        } else if (error.errorCode === 'INVALID_FIELD') {
            throw new Error('One or more fields are invalid. Please ensure all required custom fields are created in Salesforce.');
        } else {
            throw error;
        }
    }
};

/**
 * Creates a Salesforce record in the `Meeting_Summary__c` object.
 * @param {jsforce.Connection} conn - The Salesforce connection object.
 * @param {object} data - The data to create.
 * @returns {Promise<object>} - The result of the create operation.
 */
const createSalesforceRecord = async (conn, data) => {
    try {
        // First check if the Meeting_Summary__c object exists
        const describeResult = await conn.describe('Meeting_Summary__c').catch(() => null);
        if (!describeResult) {
            throw new Error('Meeting_Summary__c object does not exist in Salesforce. Please create the custom object first.');
        }

        // Validate required fields
        if (!data.transcribed_text) {
            throw new Error('Summary Text is required');
        }

        // Create the record with field validation
        const record = {
            Summary_Text__c: data.transcribed_text || '',
            Key_Points__c: Array.isArray(data.key_points) ? data.key_points.join('\n') : data.key_points || '',
            Leads__c: data.leads || '',
            Tasks__c: data.task || '',
            Status__c: data.status || 'pending',
            Type__c: data.type || 'meeting'
        };

        const response = await conn.sobject('Meeting_Summary__c').create(record);

        if (!response.success) {
            throw new Error(`Failed to create record: ${response.errors.join(', ')}`);
        }

        return response;
    } catch (error) {
        console.error('Error creating Salesforce record:', error);
        if (error.errorCode === 'NOT_FOUND') {
            throw new Error('The Meeting_Summary__c object does not exist in Salesforce. Please ensure the custom object is created with all required fields.');
        } else if (error.errorCode === 'INVALID_FIELD') {
            throw new Error('One or more fields are invalid. Please ensure all required custom fields are created in Salesforce.');
        } else {
            throw error;
        }
    }
};

export {
    createSalesforceConnection,
    waitForMetadataDeployment,
    ensureCustomObjectExists,
    upsertSalesforceRecord,
    updateSalesforceRecord,
    createSalesforceRecord,
    SF_LOGIN_URL,
    SF_CLIENT_ID,
    SF_CLIENT_SECRET
};