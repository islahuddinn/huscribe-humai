// FILE: authMiddleware.js
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';

const protect = asyncHandler(async (req, res, next) => {
  let token;
  console.log('Headers:', req.headers); // Debug log

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      console.log('Bearar Token:', token); // Debug log

      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not defined');
        res.status(500);
        throw new Error('Server configuration error');
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded token:', decoded); // Debug log

      // Get user from token
      const user = await User.findById(decoded.id).select('-password');
      console.log('Found user:', user); // Debug log

      if (!user) {
        console.error('User not found for token:', decoded);
        res.status(401);
        throw new Error('User not found');
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Auth error:', error);
      res.status(401);
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else {
        throw new Error('Not authenticated');
      }
    }
  } else if (!token) {
    console.error('No token provided in headers:', req.headers);
    res.status(401);
    throw new Error('Not authenticated - No token provided');
  }
});

const admin = async (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized as admin');
  }
};

export { protect, admin };