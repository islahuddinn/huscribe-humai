import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

export const logRequest = (requestId, method, url, params = {}, body = {}) => {
    logger.info({
        requestId,
        method,
        url,
        params,
        body,
        timestamp: new Date().toISOString()
    });
};

export const logResponse = (requestId, status, data) => {
    logger.info({
        requestId,
        status,
        data,
        timestamp: new Date().toISOString()
    });
};

export const logError = (requestId, error, context = {}) => {
    logger.error({
        requestId,
        error: {
            message: error.message,
            stack: error.stack,
            response: error.response?.data,
            status: error.response?.status
        },
        context,
        timestamp: new Date().toISOString()
    });
};

export default logger; 