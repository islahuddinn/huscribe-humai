// config.js
import dotenv from 'dotenv';
dotenv.config(); // Make sure this is at the very top

const getFreshworksDomain = (apiUrl) => {
  if (!apiUrl) {
    console.error("[CONFIG] FRESHSALES_BASE_URL is undefined or empty.");
    return '';
  }
  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.hostname}`;
  } catch (e) {
    console.error("[CONFIG] Error parsing FRESHSALES_BASE_URL:", apiUrl, e);
    return '';
  }
};

const validateClientId = (clientId) => {
  if (!clientId) return false;
  // FreshSales client IDs typically start with 'fw_ext_'
  return clientId.startsWith('fw_ext_');
};

// const freshworksDomain = getFreshworksDomain(process.env.FRESHSALES_BASE_URL);
const freshworksDomain = "https://humai-ai-org.myfreshworks.com";
const clientId = process.env.FRESHSALES_CLIENT_ID?.trim();

// Validate client ID
if (!validateClientId(clientId)) {
  console.error("[CONFIG] Invalid FreshSales client ID format. Should start with 'fw_ext_'");
}

// Log configuration for debugging
console.log('[CONFIG] FreshSales Configuration:', {
  domain: freshworksDomain,
  clientId: clientId,
  clientIdValid: validateClientId(clientId),
  redirectUri: process.env.FRESHSALES_REDIRECT_URI,
  baseUrl: process.env.FRESHSALES_BASE_URL,
  scopes: 'contacts deals companies tasks appointments'
});

// Validate all required configuration
const validateConfig = () => {
  const required = {
    clientId: clientId,
    clientSecret: process.env.FRESHSALES_CLIENT_SECRET,
    redirectUri: process.env.FRESHSALES_REDIRECT_URI,
    baseUrl: process.env.FRESHSALES_BASE_URL
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error("[CONFIG] Missing required configuration:", missing);
    return false;
  }

  return true;
};

if (!validateConfig()) {
  console.error("[CONFIG] FreshSales configuration is incomplete. Please check your environment variables.");
}

export default {
  port: process.env.PORT || 5001,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3002',
  freshsales: {
    clientId: clientId,
    clientSecret: process.env.FRESHSALES_CLIENT_SECRET?.trim(),
    redirectUri: process.env.FRESHSALES_REDIRECT_URI?.trim(),
   authorizationUrl: 'https://humai-ai-org.myfreshworks.com/oauth/authorize',
    tokenUrl: 'https://humai-ai-org.myfreshworks.com/oauth/token',
    scopes: 'contacts deals companies tasks appointments',
    apiBaseUrl: `${freshworksDomain}/api`,
    domain: freshworksDomain
  },
  session: {
    secret: process.env.SESSION_SECRET || 'your-secret-key_1231124788576893',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
      httpOnly: true
    }
  }
};