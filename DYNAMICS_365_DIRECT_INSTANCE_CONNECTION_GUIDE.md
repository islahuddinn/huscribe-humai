# Dynamics 365 Direct Instance Connection Guide

## Overview
This guide explains the enhanced Dynamics 365 authentication flow that now automatically discovers your instances/environments during the initial authentication step. 

**✨ NEW**: Authentication now includes automatic instance discovery! You get your Dynamics 365 tokens and available instances in one step.

**🔄 Environment URL = Instance URL**: These terms are used interchangeably throughout the system.

## When to Use This Approach
- You know your exact Dynamics 365 instance URL
- Organization discovery is failing or returning no results
- You want to connect directly to a specific D365 environment
- You have a multi-tenant setup where discovery doesn't work correctly

## Prerequisites
- Valid Microsoft Graph access token (from `/auth/initiate` + `/callback`)
- Your Dynamics 365 instance URL (e.g., `https://org4cfb2bc0.crm15.dynamics.com`)
- Refresh token from initial authentication

## Step 1: Initial Authentication (Now with Automatic Instance Discovery!)
The authentication flow now automatically discovers your Dynamics 365 instances/environments:

```bash
# 1. Get auth URL
GET /api/dynamics/auth/initiate

# 2. User visits the returned URL and completes OAuth
# 3. Handle the callback (now includes automatic instance discovery)
GET /api/dynamics/callback?code=AUTH_CODE&state=...
```

### Example Response (with discovered instances):
```json
{
  "status": 200,
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": "f3e8d9cc-9af5-4eb5-a800-2dd8b4b565cc",
      "userPrincipalName": "salhuddin@Humaifzco.onmicrosoft.com",
      "displayName": "slahuddin na"
    },
    "graphTokens": {
      "accessToken": "eyJ0eXAi...",
      "refreshToken": "1.AU8AB_LbZJlG..."
    },
    "dynamicsTokens": {
      "accessToken": "eyJ0eXAi...",
      "refreshToken": "1.AU8AB_LbZJlG...",
      "organizationUrl": "https://org4cfb2bc0.crm15.dynamics.com"
    },
    "dynamics365": {
      "hasAccess": true,
      "instancesCount": 2,
      "availableInstances": [
        {
          "friendlyName": "ORG4CFB2BC0",
          "environmentName": "org4cfb2bc0",
          "instanceUrl": "https://org4cfb2bc0.crm15.dynamics.com",
          "region": "15",
          "state": "Active",
          "discoveryMethod": "TenantInference"
        },
        {
          "friendlyName": "HUMAIFZCO-DEV",
          "environmentName": "humaifzco-dev", 
          "instanceUrl": "https://humaifzco-dev.crm15.dynamics.com",
          "region": "15",
          "state": "Active",
          "discoveryMethod": "GlobalDiscovery"
        }
      ],
      "selectedInstance": {
        "friendlyName": "ORG4CFB2BC0",
        "environmentName": "org4cfb2bc0",
        "instanceUrl": "https://org4cfb2bc0.crm15.dynamics.com"
      },
      "hasDynamicsToken": true,
      "nextSteps": [
        "Use the dynamicsTokens.accessToken for CRM operations",
        "Use X-Instance-URL header: https://org4cfb2bc0.crm15.dynamics.com",
        "Multiple instances available - use /auth/switch-organization to switch",
        "Instance URL is your environment URL for all CRM operations"
      ]
    }
  }
}
```

🎉 **You're ready to go!** The authentication now includes your Dynamics 365 token AND discovered instances/environments!

## Step 2: Direct Connection (Optional - only if discovery fails)

If automatic discovery doesn't find your instances, use the direct connection endpoint:

```bash
POST /api/dynamics/auth/connect-instance
Content-Type: application/json

{
  "instanceUrl": "https://org4cfb2bc0.crm15.dynamics.com",
  "refreshToken": "YOUR_REFRESH_TOKEN_FROM_STEP_1"
}
```

### Example Response:
```json
{
  "status": 200,
  "success": true,
  "message": "Connected to Dynamics 365 instance successfully",
  "data": {
    "instanceUrl": "https://org4cfb2bc0.crm15.dynamics.com",
    "dynamicsTokens": {
      "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiI...",
      "refreshToken": "1.AU8AB_LbZJlG7UKZMlQrTuXQ2Zs0gP...",
      "expiresIn": 3600,
      "tokenType": "Bearer",
      "scope": "https://org4cfb2bc0.crm15.dynamics.com/.default"
    },
    "organization": {
      "friendlyName": "ORG4CFB2BC0",
      "uniqueName": "org4cfb2bc0",
      "apiUrl": "https://org4cfb2bc0.crm15.dynamics.com",
      "region": "15",
      "version": "9.2",
      "state": "Active"
    },
    "connectionDetails": {
      "connected": true,
      "instanceUrl": "https://org4cfb2bc0.crm15.dynamics.com",
      "userId": "f3e8d9cc-9af5-4eb5-a800-2dd8b4b565cc",
      "organizationId": "64dbf207-4699-42ed-9932-542b4ee5d0d9"
    },
    "instructions": [
      "Instance connection successful!",
      "Use the dynamicsTokens.accessToken for all CRM operations",
      "Include X-Instance-URL header with this instance URL in all requests",
      "You can now create/read/update/delete entities in this Dynamics 365 instance"
    ],
    "headerExample": {
      "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiI...",
      "X-Instance-URL": "https://org4cfb2bc0.crm15.dynamics.com",
      "Content-Type": "application/json"
    }
  }
}
```

## Step 3: Use Dynamics 365 APIs (Same as before!)

You can immediately use all the CRM endpoints with the proper headers:

### Create an Entity
```bash
POST /api/dynamics/entity/contact
Authorization: Bearer YOUR_DYNAMICS_ACCESS_TOKEN
X-Instance-URL: https://org4cfb2bc0.crm15.dynamics.com
Content-Type: application/json

{
  "firstname": "John",
  "lastname": "Doe",
  "emailaddress1": "john.doe@example.com"
}
```

### Get Entities
```bash
GET /api/dynamics/entity/contact
Authorization: Bearer YOUR_DYNAMICS_ACCESS_TOKEN
X-Instance-URL: https://org4cfb2bc0.crm15.dynamics.com
```

### Update an Entity
```bash
PUT /api/dynamics/entity/contact/CONTACT_ID
Authorization: Bearer YOUR_DYNAMICS_ACCESS_TOKEN
X-Instance-URL: https://org4cfb2bc0.crm15.dynamics.com
Content-Type: application/json

{
  "mobilephone": "+1-555-0123"
}
```

## Header Requirements

**IMPORTANT**: All CRM operations now use `X-Instance-URL` instead of `X-Organization-URL`:

| Header | Required | Description | Example |
|--------|----------|-------------|---------|
| `Authorization` | ✅ | Dynamics 365 access token (NOT Graph token) | `Bearer eyJ0eXAi...` |
| `X-Instance-URL` | ✅ | Your D365 instance URL | `https://org4cfb2bc0.crm15.dynamics.com` |
| `Content-Type` | ✅ (for POST/PUT) | JSON content type | `application/json` |

## Common Instance URL Formats

Your instance URL typically follows one of these patterns:

- **Global**: `https://yourorg.crm.dynamics.com`
- **North America**: `https://yourorg.crm.dynamics.com`
- **South America**: `https://yourorg.crm2.dynamics.com`
- **Canada**: `https://yourorg.crm3.dynamics.com`
- **Europe/Africa/Middle East**: `https://yourorg.crm4.dynamics.com`
- **Asia Pacific**: `https://yourorg.crm5.dynamics.com`
- **Australia**: `https://yourorg.crm6.dynamics.com`
- **Japan**: `https://yourorg.crm7.dynamics.com`
- **India**: `https://yourorg.crm8.dynamics.com`
- **United Kingdom**: `https://yourorg.crm11.dynamics.com`
- **France**: `https://yourorg.crm12.dynamics.com`
- **United Arab Emirates**: `https://yourorg.crm15.dynamics.com`

## Troubleshooting

### Error: "Invalid instance URL or insufficient permissions"
- Verify your instance URL is correct
- Ensure you have permissions for this D365 organization
- Check if your user is licensed for Dynamics 365

### Error: "Refresh token has expired"
- Re-authenticate using `/auth/initiate` to get a new refresh token
- Refresh tokens typically expire after 90 days of inactivity

### Error: "Instance URL is required"
- Make sure you're including the `X-Instance-URL` header in all requests
- Use the exact URL returned from the connect-instance endpoint

## Complete Example Flow

```bash
# 1. Initial authentication
curl -X GET "https://yourapi.com/api/dynamics/auth/initiate"
# Response includes authUrl - user visits and completes OAuth

# 2. Handle callback (automatic or manual)
# Response includes graphTokens.refreshToken

# 3. Connect to instance
curl -X POST "https://yourapi.com/api/dynamics/auth/connect-instance" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceUrl": "https://org4cfb2bc0.crm15.dynamics.com",
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'

# 4. Create a contact
curl -X POST "https://yourapi.com/api/dynamics/entity/contact" \
  -H "Authorization: Bearer YOUR_DYNAMICS_TOKEN" \
  -H "X-Instance-URL: https://org4cfb2bc0.crm15.dynamics.com" \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "John",
    "lastname": "Doe",
    "emailaddress1": "john.doe@example.com"
  }'
```

## Benefits of Direct Connection

1. **Reliability**: Bypasses organization discovery issues
2. **Speed**: Direct connection without additional API calls
3. **Control**: Explicitly specify which instance to use
4. **Multi-tenant friendly**: Works with complex tenant setups
5. **Simpler**: No need to handle organization selection

## Migration from Organization Discovery

If you were previously using organization discovery, simply:

1. Replace `X-Organization-URL` headers with `X-Instance-URL`
2. Use the `/auth/connect-instance` endpoint instead of relying on callback organization discovery
3. Store the instance URL and use it consistently across requests

Your existing entity operation code remains the same, just update the headers! 