# Microsoft Dynamics 365 Authentication Token Fix

## Issue Summary

**Problem**: After initial authentication, users receive a Microsoft Graph token (`"aud": "https://graph.microsoft.com"`) instead of a Dynamics 365 token (`"aud": "https://your-org.crm.dynamics.com"`). This causes 401 authentication errors when trying to use Dynamics 365 endpoints.

**Root Cause**: The default authentication flow was requesting Microsoft Graph permissions only, which provides a token that cannot access Dynamics 365 APIs.

## Solution

### ✅ Fixed Authentication Flow

The system now automatically detects if you have a Dynamics 365 environment configured and requests the appropriate permissions during initial authentication.

### 🔧 Changes Made

1. **Enhanced Token Validation**
   - Now accepts both Microsoft Graph and Dynamics 365 tokens
   - More flexible claim validation
   - Better error messages

2. **Improved Authentication Flow**
   - Auto-detects Dynamics 365 environment
   - Requests correct permissions from the start
   - Handles user info retrieval for both token types

3. **New Authentication Endpoint**
   - Added `/api/dynamics/auth/initiate-dynamics` for direct Dynamics 365 authentication

## 🚀 How to Use

### Option 1: Known Environment (Recommended for configured systems)
```bash
# Use when you have DYNAMICS_CRM_URL configured in .env
GET /api/dynamics/auth/initiate-dynamics
```

### Option 2: Dynamic Discovery (Recommended for any Dynamics 365 subscription)
```bash
# Step 1: Discover available environments
GET /api/dynamics/auth/initiate-discover

# Step 2: After callback, exchange token for specific environment
POST /api/dynamics/auth/exchange-environment
Content-Type: application/json

{
  "environment_url": "https://your-org.crm.dynamics.com",
  "refresh_token": "your_refresh_token_from_step_1"
}
```

### Option 3: Automatic Detection (Legacy)
```bash
# Use the standard endpoint - works for configured environments
GET /api/dynamics/auth/initiate
```

### Option 4: Basic Graph Authentication (for development)
```bash
# Explicitly request only Microsoft Graph permissions
GET /api/dynamics/auth/initiate?dynamics_access=false
```

## 🔍 Token Comparison

### ❌ Before (Microsoft Graph Token)
```json
{
  "aud": "https://graph.microsoft.com",
  "iss": "https://sts.windows.net/64dbf207-4699-42ed-9932-542b4ee5d0d9/",
  "scp": "User.Read profile openid email"
}
```

### ✅ After (Dynamics 365 Token)
```json
{
  "aud": "https://org4cfb2bc0.crm15.dynamics.com",
  "iss": "https://sts.windows.net/64dbf207-4699-42ed-9932-542b4ee5d0d9/", 
  "scp": "user_impersonation"
}
```

## 🛠️ Environment Configuration

Ensure your `.env` file has the correct Dynamics 365 environment URL:

```bash
# Your Dynamics 365 environment URL
DYNAMICS_CRM_URL=https://your-org.crm15.dynamics.com

# Azure AD app registration details
MD_CLIENT_ID=your-client-id
MD_CLIENT_SECRET=your-client-secret
TENANT_ID=common  # Use 'common' for multi-tenant support
```

## 🧪 Testing the Fix

1. **Clear existing tokens** (if any)
2. **Authenticate using the standard endpoint**:
   ```bash
   GET /api/dynamics/auth/initiate
   ```
3. **Complete the OAuth flow**
4. **Test any Dynamics 365 endpoint**:
   ```bash
   POST /api/dynamics/leads/create
   Authorization: Bearer YOUR_TOKEN
   Content-Type: application/json
   
   {
     "subject": "Test Lead",
     "firstname": "John",
     "lastname": "Doe"
   }
   ```

## 🔄 If You Still Get 401 Errors

1. **Check your token audience**:
   ```bash
   GET /api/dynamics/check-token
   Authorization: Bearer YOUR_TOKEN
   ```

2. **Use the refresh endpoint** (this often fixes the token):
   ```bash
   POST /api/dynamics/auth/refresh
   Content-Type: application/json
   
   {
     "refresh_token": "YOUR_REFRESH_TOKEN"
   }
   ```

3. **Re-authenticate with explicit Dynamics access**:
   ```bash
   GET /api/dynamics/auth/initiate-dynamics
   ```

## 📝 Key Improvements

- ✅ **Auto-detection**: Automatically requests Dynamics 365 permissions when environment is configured
- ✅ **Flexible validation**: Accepts both Graph and Dynamics tokens
- ✅ **Better error handling**: Clear error messages with solutions
- ✅ **Multiple issuers**: Supports various Microsoft token issuers
- ✅ **User info handling**: Properly retrieves user info for both token types

## 🎯 Best Practices

1. **Use the standard auth endpoint** - it now automatically detects your setup
2. **Keep your refresh tokens** - they can be used to get the correct token type
3. **Check token audience** if you encounter issues
4. **Use environment-specific authentication** if you have multiple Dynamics 365 environments

## 🆘 Troubleshooting

| Error | Solution |
|-------|----------|
| `"aud": "https://graph.microsoft.com"` | Use `/auth/initiate-dynamics` or refresh token |
| `401 Authentication failed` | Check token audience and refresh if needed |
| `Token missing claims` | Re-authenticate with proper permissions |
| `Invalid token issuer` | Token validation now accepts multiple Microsoft issuers |

Your authentication should now work seamlessly from the initial login! 🎉 