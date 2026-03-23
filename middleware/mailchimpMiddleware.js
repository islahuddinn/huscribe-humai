import rateLimit from 'express-rate-limit';
import { protect } from './authMiddleware.js';

// Rate limiting for Mailchimp API
export const mailchimpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

// Validate Mailchimp configuration
export const validateMailchimpConfig = (req, res, next) => {
  if (!process.env.MAILCHIMP_API_KEY || !process.env.MAILCHIMP_SERVER_PREFIX || !process.env.MAILCHIMP_LIST_ID) {
    return res.status(500).json({
      success: false,
      error: 'Mailchimp configuration is missing. Please check your environment variables.'
    });
  }
  next();
};

// Combine all middleware
export const mailchimpMiddleware = [
  protect, // Ensure user is authenticated
  mailchimpRateLimiter, // Apply rate limiting
  validateMailchimpConfig // Validate configuration
]; 