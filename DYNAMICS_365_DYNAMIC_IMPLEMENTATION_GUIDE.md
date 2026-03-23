# Dynamics 365 Dynamic Integration Implementation Guide

## Overview
This implementation makes your Dynamics 365 integration work dynamically for any user with a Dynamics 365 subscription. The system now follows a proper authentication flow that discovers and connects to user's specific D365 organizations.

## How It Works

### 1. Phase-Based Authentication
- **Phase 1**: User authenticates with Microsoft Graph (basic permissions)
- **Phase 2**: System discovers user's available Dynamics 365 organizations
- **Phase 3**: System gets organization-specific Dynamics 365 tokens
- **Phase 4**: User can create/manage entities in their D365 environment

### 2. Dynamic Organization Discovery
- Automatically finds all D365 organizations user has access to
- Auto-selects the first organization (user can switch later)
- Provides organization-specific access tokens

## Implementation Steps

### 1. Authentication Flow

**Start Authentication:**
```
GET /api/dynamics/auth/initiate
```

**Handle Callback:**
The callback will return:
```json
{
  "user": { "id": "...", "email": "..." },
  "graphTokens": { "accessToken": "...", "refreshToken": "..." },
  "dynamicsTokens": { 
    "accessToken": "...", 
    "organizationUrl": "https://yourorg.crm.dynamics.com" 
  },
  "dynamics365": {
    "hasAccess": true,
    "selectedOrganization": { "friendlyName": "...", "apiUrl": "..." },
    "availableOrganizations": [...]
  }
}
```

### 2. Making CRM API Calls

**Required Headers:**
```
Authorization: Bearer {dynamicsTokens.accessToken}
X-Organization-URL: {selectedOrganization.apiUrl}
```

**Example - Create Contact:**
```javascript
fetch('/api/dynamics/entity/contact', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + dynamicsTokens.accessToken,
    'X-Organization-URL': selectedOrganization.apiUrl,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    firstname: 'John',
    lastname: 'Doe',
    emailaddress1: 'john@example.com'
  })
})
```

### 3. Switching Organizations

**Switch to Different Organization:**
```javascript
fetch('/api/dynamics/auth/switch-organization', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    organizationUrl: 'https://anotherorg.crm.dynamics.com',
    refreshToken: graphTokens.refreshToken
  })
})
```

## Key Features

### ✅ Works for Any D365 User
- No hardcoded environment URLs
- Discovers user's organizations automatically
- Supports multi-tenant scenarios

### ✅ Proper Token Management
- Separate Graph and Dynamics tokens
- Organization-specific access tokens
- Proper token refresh mechanism

### ✅ Dynamic Entity Operations
- All CRUD operations work dynamically
- Proper organization URL handling
- Real-time organization switching

## Error Handling

### Common Scenarios
1. **No D365 License**: Returns available organizations as empty array
2. **Invalid Organization URL**: Returns validation error with suggestions
3. **Token Expired**: Use refresh token to get new tokens
4. **Missing Headers**: Clear error messages with required headers

## Testing Your Implementation

### 1. Test Authentication
```bash
# Start auth flow
curl http://localhost:3000/api/dynamics/auth/initiate

# Check callback response for proper tokens and organization data
```

### 2. Test Entity Creation
```bash
# Create contact with organization URL
curl -X POST http://localhost:3000/api/dynamics/entity/contact \
  -H "Authorization: Bearer YOUR_DYNAMICS_TOKEN" \
  -H "X-Organization-URL: https://yourorg.crm.dynamics.com" \
  -H "Content-Type: application/json" \
  -d '{"firstname": "Test", "lastname": "User", "emailaddress1": "test@example.com"}'
```

### 3. Test Organization Switching
```bash
# Switch to different organization
curl -X POST http://localhost:3000/api/dynamics/auth/switch-organization \
  -H "Content-Type: application/json" \
  -d '{"organizationUrl": "https://anotherorg.crm.dynamics.com", "refreshToken": "YOUR_REFRESH_TOKEN"}'
```

## Benefits

1. **Universal Compatibility**: Works with any D365 user/organization
2. **No Configuration Required**: Discovers environments automatically  
3. **Multi-Organization Support**: Switch between organizations seamlessly
4. **Proper Security**: Organization-specific tokens and permissions
5. **Better Error Handling**: Clear messages for common issues

## Migration Notes

If you have existing code, update it to:
1. Use the new authentication flow
2. Include `X-Organization-URL` header in requests
3. Use organization-specific tokens instead of generic ones
4. Handle organization discovery in your UI 