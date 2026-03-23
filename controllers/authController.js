import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { AppError } from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';

import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import passport from "passport";

dotenv.config();

// Protect routes middleware
export const protect = catchAsync(async (req, res, next) => {
    // 1) Get token from header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // For testing: if token is "admin", grant access
    if (token === "admin") {
        req.user = { _id: "admin", isAdmin: true };
        return next();
    }

    try {
        // 2) Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3) Check if user still exists
        const user = await User.findById(decoded.id);
        if (!user) {
            return next(new AppError('The user belonging to this token no longer exists.', 401));
        }

        // Grant access to protected route
        req.user = user;
        next();
    } catch (error) {
        return next(new AppError('Invalid token. Please log in again.', 401));
    }
});

// Restrict to specific roles
export const restrictTo = (...roles) => {
    return (req, res, next) => {
        // For testing purposes, if user is "admin", grant admin access
        if (req.user && (req.user._id === "admin" || req.user.isAdmin)) {
            return next();
        }

        // Check if user has admin role
        if (!req.user || !req.user.isAdmin) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }

        next();
    };
}; 

////login with google

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});

export const googleAuth = catchAsync(async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        status: "error",
        message: "Unauthorized: No user information from Google" 
      });
    }

    const { id, displayName, emails, name } = req.user;
    const email = emails?.[0]?.value;
    const [firstName, lastName] = displayName.split(' ');

    // Verify email validity (using your existing Hunter integration)
    const isEmailValid = await verifyEmailWithHunter(email);
    if (!isEmailValid) {
      return res.status(400).json({
        message: "Invalid email address from Google",
        status: "error"
      });
    }

    // Check for existing user
    let user = await User.findOne({
      $or: [
        { email },
        { googleId: id }
      ]
    });

    let accountType = 'old';
    const isNewUser = !user;

    if (!user) {
      // Create new user
      user = new User({
        email,
        first_name: name?.givenName || firstName,
        last_name: name?.familyName || lastName,
        googleId: id,
        verified: 1, // Google-verified emails are considered verified
        registration_method: 'google'
      });
      await user.save();
      accountType = 'new';
    } else {
      // Update existing user if needed
      if (!user.googleId) {
        user.googleId = id;
        await user.save();
      }
      
      // Ensure verification status
      if (user.verified !== 1) {
        user.verified = 1;
        await user.save();
      }
    }

    // Generate token using your existing utility
    const token = generateToken(user._id);
    user.token = token;
    await user.save();

    // Prepare user data response
    const userData = {
      user: {
        ...user.toObject(),
      },
      token
    };

    res.status(isNewUser ? 201 : 200).json({
      message: "Google authentication successful",
      status: "ok",
      data: userData,
      account_type: accountType
    });

  } catch (error) {
    console.error("Google Auth Error:", error);
    
    // Handle duplicate email error
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({
        status: "error",
        message: "Email already exists with different authentication method"
      });
    }

    res.status(500).json({
      status: "error",
      message: error.message || "Internal server error"
    });
  }
});
