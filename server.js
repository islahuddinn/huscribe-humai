import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import connectDb from "./db.js";
import bodyParser from "body-parser";
import cors from "cors";
import engines from "consolidate";
import cookieParser from 'cookie-parser';
import { protect } from "./middleware/authMiddleware.js"
import http from 'http';
import "dotenv/config";
import session from 'express-session';
import passport from "passport";
// import setupSocket from './socket/socketHandler.js';
dotenv.config({
    path: process.env.NODE_ENV === 'production'
        ? '.env.production'
        : '.env'
});
import path from 'path';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);
console.log('directory-name 👉️', __dirname);

const app = express();

app.engine("ejs", engines.ejs);
app.set("views", "./views");
app.set("view engine", "ejs");

// Imported Routes
import userRoutes from "./routes/userRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import promptRoutes from "./routes/promptRoutes.js";
import paymentRoutes from './routes/paymentRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import planRoutes from './routes/planRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import meetingRoutes from './routes/meetingRoutes.js';
import voiceMemoRoutes from './routes/voiceMemoRoutes.js';
import transcriptionRoutes from './routes/transcriptionRoutes.js';
import summarizationRoutes from './routes/summarizationRoutes.js';
import salesforceAuthRoutes from './routes/salesforceAuthRoutes.js';
import objectRoutes from './routes/objectRoutes.js';
import zohoRoutes from './routes/zohoRoutes.js';
import salesForceRoutes from './routes/salesForceRoutes.js';
import hubSpotRoutes from './routes/hubSpotRoutes.js';
import microsoftDynamicRoutes from './routes/microsoftDynemicRoutes.js';
import asanaRoutes from './routes/asanaRoutes.js';
import trelloRoutes from './routes/trelloRoutes.js';
import slackRoutes from './routes/slackRoutes.js';
import microsoftBookingRoutes from './routes/microsoftBookingRoutes.js';
import microsoftAuthRoutes from './routes/microsoftAuthRoutes.js';
import mondayRoutes from './routes/mondayRoutes.js';
import doodleRoutes from './routes/doodleRoutes.js';
import calendlyRoutes from './routes/calendlyRoutes.js';
import microsoftTeamsRoutes from './routes/microsoftTeamsRoutes.js';
import mailchimpRoutes from './routes/mailchimpRoutes.js';
import apolloRoutes from './routes/apolloRoutes.js';
import chilipiperRoutes from './routes/chiliPiperRoutes.js';
import linkedinSalesNavRoutes from './routes/linkedinSalesNavRoutes.js';
import acuityRoutes from './routes/acuityRoutes.js';
import freshSalesRoutes from './routes/freshSalesRoutes.js';
import clickupRoutes from './routes/clickupRoutes.js';
import lushaRoutes from './routes/lushaRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import adminRoutes from './routes/adminPanel/adminRoutes.js';
import crmRoutes from './routes/crmRoutes.js';

// DB function called
connectDb();

// Webhook route must be before bodyParser to get raw body for Stripe signature verification

// Mount webhook routes first (before any body parsers)
app.use('/api/webhooks', webhookRoutes);

// Create a conditional middleware for raw body parsing
const conditionalBodyParser = (req, res, next) => {
    if (req.originalUrl === '/api/webhooks/stripe') {
        next();
    } else {
        bodyParser.json()(req, res, next);
    }
};

// Middlewares
app.use(conditionalBodyParser);
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
// Ensure trello-power-up directory is served directly
app.use('/trello-power-up', express.static(path.join(__dirname, "public/trello-power-up")));
app.use("/api/files", express.static(path.join(__dirname, "/upload")));

// Set EJS as templating engine
app.set("view engine", "ejs");
app.use(passport.initialize());

// CORS Configuration
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-salesforce-token',
        'x-sf-access-token',
        'x-sf-refresh-token'
    ],
    exposedHeaders: [
        'X-SF-Access-Token',
        'X-SF-Refresh-Token'
    ]
}));

// Add this middleware to handle preflight requests
app.options('*', cors());

// Session configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'your-secret-key_1231124788576893',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax',
        httpOnly: true
    }
};

// Add this middleware to set secure headers
app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-salesforce-token');
    next();
});

// Move trust proxy setting before routes
app.set('trust proxy', 1);
app.enable('trust proxy');

// Ensure cookie parser is configured before routes
app.use(cookieParser(process.env.JWT_SECRET));

// Configure session middleware
app.use(session(sessionConfig));

// Routes
app.use("/api/users", userRoutes);
app.use("/api/users/account", accountRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/prompts", promptRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payments/coupons', couponRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/voice-memos', voiceMemoRoutes);
app.use('/api/transcriptions', transcriptionRoutes);
app.use('/api/summarizations', summarizationRoutes);
app.use('/api/auth/salesforce', salesforceAuthRoutes);
app.use('/api/salesforce', salesForceRoutes);
app.use('/api/objects', objectRoutes);
app.use('/api/zoho', zohoRoutes);
app.use('/api/hubspot', hubSpotRoutes);
app.use('/api/dynamic', microsoftDynamicRoutes);
app.use('/api/asana', asanaRoutes);
app.use('/api/trello', trelloRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/bookings', microsoftBookingRoutes);
app.use('/api/auth/microsoft', microsoftAuthRoutes);
app.use('/api/monday', mondayRoutes);
app.use('/api/doodle', doodleRoutes);
app.use('/api/calendly', calendlyRoutes);
app.use('/api/apollo', apolloRoutes);
app.use('/api/chilipiper', chilipiperRoutes);
app.use('/api/acuity', acuityRoutes);
app.use('/api/teams', microsoftTeamsRoutes);
app.use('/api/mailchimp', mailchimpRoutes);
app.use('/api/linkedin', linkedinSalesNavRoutes);
app.use('/api/freshsales', freshSalesRoutes);
app.use('/api/clickup', clickupRoutes);
app.use('/api/lusha', lushaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/crm', crmRoutes);

// Test route for Calendly
app.get('/test-calendly', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'test-calendly.html'));
});

// Testing Routes for /api
app.get("/", (req, res) => {
    res.json({ message: "Hello World" });
});

// Enhanced port configuration with automatic fallback
import PortManager from './scripts/portManager.js';
const portManager = new PortManager();

const PORT = process.env.PORT || 5001;
const FALLBACK_PORTS = [5001, 5002, 5003, 5004, 5005];

const server = http.createServer(app);

// Setup Socket.IO
// const io = setupSocket(server);

// // Make io available throughout the app  
// app.set('socketio', io);

// Enhanced server startup with port conflict handling
const startServer = async (port = PORT) => {
  return new Promise((resolve, reject) => {
    const serverInstance = server.listen(port, () => {
      console.log(`🚀 Server successfully started on Port ${port}`);
      console.log(`🔗 Health Check: http://localhost:${port}/`);
      resolve(serverInstance);
    });

    serverInstance.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`❌ Port ${port} is already in use`);
        reject(error);
      } else {
        console.error(`❌ Server error:`, error.message);
        reject(error);
      }
    });
  });
};

// Try to start server with enhanced port management
const initializeServer = async () => {
  console.log(`🔄 Starting server with enhanced port management...`);
  
  // First, check for zombie Node processes
  const nodeProcesses = await portManager.getNodeProcesses();
  if (nodeProcesses.length > 0) {
    console.log(`⚠️  Found ${nodeProcesses.length} existing Node.js process(es). These might be blocking ports.`);
    console.log(`💡 Run 'npm run port:clean' to clean up or 'npm run port:check' for detailed report`);
  }
  
  // Try to find the best available port
  try {
    const availablePort = await portManager.findAvailablePort(PORT);
    await startServer(availablePort);
    return;
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      console.log(`❌ Port selection failed, falling back to manual search...`);
      
      // Fallback: Try each port manually
      for (const port of FALLBACK_PORTS) {
        try {
          await startServer(port);
          return; // Success - exit the function
        } catch (err) {
          if (err.code === 'EADDRINUSE') {
            console.log(`⚠️  Port ${port} is busy, trying next port...`);
            continue; // Try next port
          } else {
            console.error(`💥 Critical server error:`, err.message);
            process.exit(1);
          }
        }
      }
      
      // If we get here, all ports failed
      console.error(`💥 Could not start server on any of the following ports: ${FALLBACK_PORTS.join(', ')}`);
      console.error(`💡 Solutions:`);
      console.error(`   1. Run 'npm run port:clean' to kill zombie processes`);
      console.error(`   2. Run 'npm run port:check' for detailed port report`);
      console.error(`   3. Restart your computer to clear all processes`);
      process.exit(1);
    } else {
      console.error(`💥 Critical server error:`, error.message);
      process.exit(1);
    }
  }
};

// Start the server with enhanced error handling
initializeServer().catch((error) => {
  console.error('💥 Failed to initialize server:', error.message);
  process.exit(1);
});