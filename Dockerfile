# Use Node.js LTS version
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Set production environment and Salesforce configuration
ENV NODE_ENV=production \
    SF_LOGIN_URL=https://login.salesforce.com \
    SF_REDIRECT_URI=https://ai-voice2-crm.vercel.app/dashboard \
    SF_CLIENT_ID=your_sf_client_id \
    SF_CLIENT_SECRET=your_sf_client_secret

# Expose the port the app runs on
EXPOSE 8080

# Start the application
CMD ["node", "server.js"]
