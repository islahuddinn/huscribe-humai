# Multi-Tenant Dynamics 365 Integration Setup Guide

## Overview
This guide will help you configure your Dynamics 365 integration to work with any user who has a Microsoft Dynamics 365 account.

## Step 1: Azure AD App Registration Configuration

### 1.1 Navigate to Azure Portal
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Find your existing app registration

### 1.2 Configure Multi-Tenant Support
In your app registration:

**Authentication Settings:**
```
Supported account types: 
☑️ Accounts in any organizational directory (Any Azure AD directory - Multitenant)

Redirect URIs:
- Web: http://localhost:3000/api/dynamics/callback
- Web: https://yourdomain.com/api/dynamics/callback (if deployed)
```

**API Permissions:**
```
Microsoft APIs:
☑️ Dynamics CRM (user_impersonation) - Delegated
☑️ Microsoft Graph (User.Read) - Delegated  
☑️ Microsoft Graph (offline_access) - Delegated

Status: ✅ Grant admin consent for your organization
```

### 1.3 App Registration Manifest
Ensure these settings in the manifest:
```json
{
  "signInAudience": "AzureADMultipleOrgs",
  "accessTokenAcceptedVersion": 2
}
```

## Step 2: Environment Variables Configuration

Create/update your `.env` file:

```env
# Microsoft Dynamics 365 Multi-Tenant Configuration
MD_CLIENT_ID=your-client-id-from-azure-portal
MD_CLIENT_SECRET=your-client-secret-from-azure-portal

# CRITICAL: Use 'common' for multi-tenant support
TENANT_ID=common

# Dynamics 365 Configuration (will be discovered dynamically)
DYNAMICS_CRM_URL=https://your-default-org.crm.dynamics.com

# Redirect URI (must match Azure AD app registration)
MD_REDIRECT_URI=http://localhost:3000/api/dynamics/callback

# Frontend URL (for web redirects)
MD_FRONTEND_URL=http://localhost:3000

# Server Configuration
PORT=3000
NODE_ENV=development
```

## Step 3: Test Multi-Tenant Authentication

### 3.1 Test Authentication Flow
```bash
# Start your server
npm start

# Test authentication endpoint
curl http://localhost:3000/api/dynamics/auth/initiate
```

### 3.2 Test with Different Users
1. Open browser in incognito mode
2. Navigate to: `http://localhost:3000/api/dynamics/auth/initiate`
3. Login with different Microsoft accounts
4. Verify each user gets their own access token

## Step 4: Dynamic Organization Discovery

### 4.1 Discover User's Organizations
After authentication, discover user's Dynamics 365 organizations:

```javascript
// GET /api/dynamics/organizations/discover
// Headers: Authorization: Bearer <access_token>
```

### 4.2 Set User-Specific Environment
Use the discovered organization URL for API calls:

```javascript
// Add custom environment header to requests
headers: {
  'Authorization': 'Bearer <access_token>',
  'X-Environment-URL': 'https://user-org.crm.dynamics.com'
}
```

## Step 5: Updated Authentication Flow

### 5.1 Frontend Implementation
```javascript
// Initiate authentication
window.location.href = '/api/dynamics/auth/initiate';

// Handle callback (will receive tokens)
// Parse URL parameters for access_token, refresh_token, etc.
```

### 5.2 Backend API Usage
```javascript
// Create entity with user-specific environment
const response = await fetch('/api/dynamics/entity/contact', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userAccessToken}`,
    'X-Environment-URL': userOrganizationUrl,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    firstname: 'John',
    lastname: 'Doe',
    emailaddress1: 'john@example.com'
  })
});
```

## Step 6: Error Handling for Multi-Tenant

### 6.1 Common Issues and Solutions

**Issue: "AADSTS90002: Tenant not found"**
```
Solution: Ensure TENANT_ID=common in .env file
```

**Issue: "User has no access to Dynamics 365"**
```
Solution: Use organization discovery endpoint to find user's accessible environments
```

**Issue: "Token refresh fails"**
```
Solution: Ensure consistent tenant usage in auth and refresh flows
```

## Step 7: Testing Multi-Tenant Setup

### 7.1 Test Tenant Configuration
```bash
curl -X GET "http://localhost:3000/api/dynamics/config/check-tenant"
```

### 7.2 Test User Capabilities
```bash
curl -X GET "http://localhost:3000/api/dynamics/user/sales-capabilities" \
  -H "Authorization: Bearer <user_access_token>"
```

### 7.3 Test Organization Discovery
```bash
curl -X GET "http://localhost:3000/api/dynamics/organizations/discover" \
  -H "Authorization: Bearer <user_access_token>"
```

## Step 8: Production Deployment Considerations

### 8.1 Update Redirect URIs
Add production URLs to Azure AD app registration:
```
https://yourproductiondomain.com/api/dynamics/callback
```

### 8.2 Environment Variables for Production
```env
MD_REDIRECT_URI=https://yourproductiondomain.com/api/dynamics/callback
MD_FRONTEND_URL=https://yourproductiondomain.com
DYNAMICS_CRM_URL=https://default-org.crm.dynamics.com
```

## Step 9: User Onboarding Flow

### 9.1 New User Registration
1. User clicks "Login with Microsoft"
2. Redirected to Microsoft login
3. User consents to permissions
4. System discovers user's Dynamics 365 organizations
5. User selects their organization (if multiple)
6. System stores user's organization URL
7. User can now create/manage entities

### 9.2 Returning User Flow
1. User provides stored access token
2. System validates token
3. System uses stored organization URL
4. User can immediately access their data

## Troubleshooting

### Common Error Messages and Solutions

**"Invalid client credentials"**
- Check MD_CLIENT_ID and MD_CLIENT_SECRET
- Verify client secret hasn't expired

**"Redirect URI mismatch"**
- Ensure MD_REDIRECT_URI matches Azure AD app registration
- Check for trailing slashes and protocol (http vs https)

**"User cannot access any organizations"**
- User needs Dynamics 365 license
- User must be added to at least one Dynamics 365 organization

**"Entity not found"**
- User's organization may not have required apps installed
- Use /environment/identify-sales to find correct environment

## Next Steps

1. Update your .env file with the configuration above
2. Restart your application
3. Test with multiple Microsoft accounts
4. Implement organization discovery in your frontend
5. Add error handling for different user scenarios

## Support Endpoints

Your application now includes these helpful endpoints:

- `GET /api/dynamics/config/check-tenant` - Verify tenant configuration
- `GET /api/dynamics/organizations/discover` - Find user's organizations
- `GET /api/dynamics/user/sales-capabilities` - Check user permissions
- `GET /api/dynamics/environment/identify-sales` - Find Sales environment
- `GET /api/dynamics/setup/sales-environment` - Quick setup guide

Use these endpoints to diagnose and resolve any multi-tenant issues. 