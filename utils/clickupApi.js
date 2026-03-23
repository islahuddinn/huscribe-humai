import axios from 'axios';
import { logRequest, logResponse, logError } from './logger.js';

// Update base URL to match ClickUp API documentation exactly
const BASE_URL = 'https://api.clickup.com/api/v2';

class ClickUpApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'ClickUpApiError';
        this.status = status;
        this.data = data;
    }
}

const handleApiError = (error, requestId) => {
    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        logError(requestId, error, {
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers,
            url: error.config?.url,
            method: error.config?.method,
            baseURL: error.config?.baseURL,
            requestData: error.config?.data
        });
        throw new ClickUpApiError(
            error.response.data?.message || 'ClickUp API Error',
            error.response.status,
            error.response.data
        );
    } else if (error.request) {
        // The request was made but no response was received
        logError(requestId, error, {
            request: error.request,
            url: error.config?.url,
            method: error.config?.method,
            baseURL: error.config?.baseURL,
            requestData: error.config?.data
        });
        throw new ClickUpApiError(
            'No response received from ClickUp API',
            500,
            { error: 'No response received' }
        );
    } else {
        // Something happened in setting up the request that triggered an Error
        logError(requestId, error, {
            message: error.message,
            url: error.config?.url,
            method: error.config?.method,
            baseURL: error.config?.baseURL,
            requestData: error.config?.data
        });
        throw new ClickUpApiError(
            'Error setting up request to ClickUp API',
            500,
            { error: error.message }
        );
    }
};

const formatEndpoint = (endpoint) => {
    // Remove leading and trailing slashes
    endpoint = endpoint.replace(/^\/+|\/+$/g, '');
    return `/${endpoint}`;
};

const createAxiosInstance = (token) => {
    return axios.create({
        baseURL: BASE_URL,
        headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
        },
        validateStatus: function (status) {
            return status >= 200 && status < 500; // Accept all status codes less than 500
        }
    });
};

export const clickupApi = {
    async get(endpoint, token, params = {}, requestId) {
        try {
            const formattedEndpoint = formatEndpoint(endpoint);
            const axiosInstance = createAxiosInstance(token);
            
            logRequest(requestId, 'GET', `${BASE_URL}${formattedEndpoint}`, params, {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                }
            });
            
            const response = await axiosInstance.get(formattedEndpoint, { params });

            logResponse(requestId, response.status, response.data);
            return response.data;
        } catch (error) {
            handleApiError(error, requestId);
        }
    },

    async post(endpoint, token, data = {}, requestId) {
        try {
            const formattedEndpoint = formatEndpoint(endpoint);
            const axiosInstance = createAxiosInstance(token);
            
            // Log the complete request details
            logRequest(requestId, 'POST', `${BASE_URL}${formattedEndpoint}`, {}, {
                data,
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                endpoint: formattedEndpoint,
                baseURL: BASE_URL
            });
            
            // Make the request
            const response = await axiosInstance.post(formattedEndpoint, data);

            // Check if the response is an error HTML
            if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
                throw new ClickUpApiError(
                    'Invalid API response',
                    response.status,
                    response.data
                );
            }

            // Log the complete response
            logResponse(requestId, response.status, {
                data: response.data,
                headers: response.headers,
                config: {
                    url: response.config.url,
                    method: response.config.method,
                    baseURL: response.config.baseURL
                }
            });

            return response.data;
        } catch (error) {
            handleApiError(error, requestId);
        }
    },

    async put(endpoint, token, data = {}, requestId) {
        try {
            const formattedEndpoint = formatEndpoint(endpoint);
            const axiosInstance = createAxiosInstance(token);
            
            logRequest(requestId, 'PUT', `${BASE_URL}${formattedEndpoint}`, {}, {
                data,
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                }
            });
            
            const response = await axiosInstance.put(formattedEndpoint, data);

            logResponse(requestId, response.status, response.data);
            return response.data;
        } catch (error) {
            handleApiError(error, requestId);
        }
    },

    async delete(endpoint, token, requestId) {
        try {
            const formattedEndpoint = formatEndpoint(endpoint);
            const axiosInstance = createAxiosInstance(token);
            
            logRequest(requestId, 'DELETE', `${BASE_URL}${formattedEndpoint}`, {}, {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                }
            });
            
            const response = await axiosInstance.delete(formattedEndpoint);

            logResponse(requestId, response.status, response.data);
            return response.data;
        } catch (error) {
            handleApiError(error, requestId);
        }
    }
}; 