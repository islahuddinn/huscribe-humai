// import { App } from '@slack/bolt';
import crypto from 'crypto';
import dotenv from 'dotenv';
import pkg from '@slack/bolt';
const { App } = pkg;
import { WebClient } from '@slack/web-api';

dotenv.config();

// COMMENTED OUT: Slack initialization causing port conflict
// const initializeSlackApp = async () => {
//   const slackApp = new App({
//     signingSecret: process.env.SLACK_SIGNING_SECRET,
//     token: process.env.SLACK_BOT_TOKEN,  // Only provide token for single workspace
//   });
//   
//   try {
//     await slackApp.start(process.env.SLACK_PORT || 3001);
//     console.log('⚡️ Bolt app is running!');
//     return slackApp;
//   } catch (error) {
//     console.error('Failed to start Slack app:', error);
//     throw error;
//   }
// }

// COMMENTED OUT: Remove socketMode and appToken as they're not needed for standard HTTP
// const slackApp = await initializeSlackApp().catch(error => {
//   console.error('Failed to initialize Slack app:', error);
//   process.exit(1);
// });

// Temporary placeholder for slackApp when disabled
const slackApp = null;

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

export const validateSlackRequest = (req, res, next) => {
  const signature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];
  
  // Check if the request is too old (more than 5 minutes)
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - (60 * 5);
  if (timestamp < fiveMinutesAgo) {
    return res.status(401).json({ error: 'Request is too old' });
  }

  const body = JSON.stringify(req.body);
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET)
    .update(baseString)
    .digest('hex');
  
  const calculatedSignature = `v0=${hmac}`;
  
  if (calculatedSignature !== signature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
};

export const slackController = {

//////======Handle Slack OAuth redirect

  initiateSlackOAuth: async (req, res) => {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    const scope = 'chat:write,channels:read'; // Add all scopes you need

    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${redirectUri}`;
    res.redirect(authUrl);
  },

  handleSlackOAuth: async (req, res) => {
    try {
      const { code } = req.query;
      
      if (!code) {
        return res.status(400).json({ error: 'Missing code parameter' });
      }

      console.log('Received code:', code); // Debug log

      const result = await slackClient.oauth.v2.access({
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code: code,
        redirect_uri: process.env.SLACK_REDIRECT_URI
      });

      console.log('OAuth success:', result); // Debug log

      // Store the tokens securely
      const botToken = result.access_token;
      // Save botToken to your database here if needed

      res.redirect('/oauth-success'); // Or your success page
    } catch (error) {
      console.error('Detailed OAuth error:', error);
      res.status(500).json({ error: 'OAuth failed', details: error.message });
    }
  },

/////======Handle Slack events (message, reactions, etc)

  handleSlackEvents: async (req, res) => {
    try {
      if (!slackApp) {
        return res.status(503).json({ error: 'Slack app is disabled' });
      }
      await slackApp.processEvent(req, res);
    } catch (error) {
      res.status(500).json({ error: 'Event processing failed' });
    }
  },

//////===Send message to Slack channel

  sendSlackMessage: async (channel, text, blocks = []) => {
    try {
      if (!slackApp) {
        throw new Error('Slack app is disabled');
      }
      return await slackApp.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel,
        text,
        blocks,
      });
    } catch (error) {
      console.error('Slack message error:', error);
      throw error;
    }
  },

/////===Handle Slack interactions (buttons, modals)

  handleSlackInteractions: async (req, res) => {
    try {
      if (!slackApp) {
        return res.status(503).json({ error: 'Slack app is disabled' });
      }
      await slackApp.processAction(req, res);
    } catch (error) {
      res.status(500).json({ error: 'Interaction failed' });
    }
  },

  // Test endpoint for Postman
  testSlackIntegration: async (req, res) => {
    try {
      // Test sending a message
      const result = await slackClient.chat.postMessage({
        channel: 'channel-id', // Replace with your channel ID
        text: 'Test message from Postman'
      });
      
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  testBotConnection: async (req, res) => {
    try {
      // Test the bot connection
      const result = await slackClient.auth.test();
      res.json({
        success: true,
        botName: result.user,
        teamName: result.team,
        botId: result.user_id
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};
