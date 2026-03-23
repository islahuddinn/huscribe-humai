# Fix for "invalid_client" Error in Microsoft Dynamics 365 Integration

## Problem
You're getting this error when trying to authenticate:
```json
{
  "status": 400,
  "success": false,
  "error": "Azure AD authentication error: invalid_client",
  "errorCode": "AZURE_AD_ERROR"
}
```

## Root Cause
The `invalid_client` error occurs when:
1. **Client Secret is expired or invalid**
2. **Client ID doesn't match the secret**
3. **Azure AD app registration has authentication issues**
4. **Multi-tenant configuration is incorrect**

## Step-by-Step Fix

### Step 1: Verify Azure AD App Registration

Go to [Azure Portal](https://portal.azure.com) → App Registrations → Your App

#### 1.1 Check Application Overview
```
✅ Application (client) ID: f180349b-1320-418b-a4b2-6a39af836224
✅ Directory (tenant) ID: Should show your tenant
✅ Supported account types: Multitenant
```

#### 1.2 Authentication Settings
Navigate to **Authentication** tab:
```
✅ Supported account types: 
   "Accounts in any organizational directory (Any Azure AD directory - Multitenant)"

✅ Redirect URIs:
   Platform: Web
   URI: https://huscribe-backend-112929028022.us-central1.run.app/api/dynamic/callback

✅ Advanced settings:
   ☑️ Access tokens (used for implicit flows)
   ☑️ ID tokens (used for implicit and hybrid flows)
```

#### 1.3 Generate New Client Secret
Navigate to **Certificates & secrets** tab:
```
1. Click "+ New client secret"
2. Description: "Huscribe Multi-Tenant Secret"
3. Expires: 24 months
4. Click "Add"
5. COPY THE SECRET VALUE IMMEDIATELY (you won't see it again)
```

### Step 2: Update Environment Variables

Update your `.env` file:
```env
# Multi-Tenant Configuration - Updated Credentials
MD_CLIENT_ID=f180349b-1320-418b-a4b2-6a39af836224
MD_CLIENT_SECRET=your-new-secret-value-from-step-1.3
TENANT_ID=common
MD_REDIRECT_URI=https://huscribe-backend-112929028022.us-central1.run.app/api/dynamic/callback
DYNAMICS_CRM_URL=https://org4cfb2bc0.crm15.dynamics.com
```

### Step 3: API Permissions Configuration

Navigate to **API permissions** tab:
```
✅ Microsoft APIs → Dynamics CRM:
   - user_impersonation (Delegated) ✅ Granted

✅ Microsoft APIs → Microsoft Graph:
   - User.Read (Delegated) ✅ Granted
   - offline_access (Delegated) ✅ Granted

✅ Admin consent status: ✅ Granted for [Your Organization]
```

If permissions are not granted:
1. Click "Grant admin consent for [Your Organization]"
2. Confirm the consent

### Step 4: App Registration Manifest

Navigate to **Manifest** tab and verify:
```json
{
  "signInAudience": "AzureADMultipleOrgs",
  "accessTokenAcceptedVersion": 2,
  "oauth2RequirePostResponse": false,
  "oauth2AllowImplicitFlow": true,
  "oauth2AllowIdTokenImplicitFlow": true
}
```

If any values are wrong, update them and click **Save**.

### Step 5: Test Configuration

1. **Restart your application** after updating `.env`
2. **Clear browser cache/cookies**
3. **Test with this updated URL:**

```
https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=f180349b-1320-418b-a4b2-6a39af836224&response_type=code&redirect_uri=https%3A%2F%2Fhuscribe-backend-112929028022.us-central1.run.app%2Fapi%2Fdynamic%2Fcallback&scope=openid+profile+email+offline_access+https%3A%2F%2Forg4cfb2bc0.crm15.dynamics.com%2F.default&state=test_fixed&response_mode=query&prompt=select_account
```

### Step 6: Multi-Account Testing

After the fix:

1. **Test in incognito/private browser**
2. **Try different Microsoft accounts:**
   - Personal Microsoft accounts (if app supports them)
   - Work/School accounts from different organizations
   - Accounts with Dynamics 365 access

3. **Expected behavior:**
   - Each user should authenticate successfully
   - Each user should see their own organizations
   - Each user should be able to create entities in their environment

## Common Additional Issues

### Issue A: "AADSTS65005: Invalid resource"
**Fix:** Update scope in authentication URL:
```
scope=openid+profile+email+offline_access+https://graph.microsoft.com/.default
```

### Issue B: "AADSTS70011: Invalid scope"
**Fix:** Ensure Dynamics CRM permissions are properly granted in Azure AD.

### Issue C: Still getting "invalid_client"
**Troubleshooting steps:**
1. Verify client ID and secret are exactly copied (no extra spaces)
2. Ensure client secret hasn't expired
3. Try creating a completely new client secret
4. Check if app registration is in the correct Azure AD tenant

## Testing Commands

After making changes, test with:

```bash
# 1. Restart your server
npm start

# 2. Test configuration
curl -X GET "http://localhost:3000/api/dynamics/config/check-tenant"

# 3. Test authentication URL generation
node test-multi-tenant.js
```

## Success Indicators

✅ **Authentication works:** User gets redirected to callback URL with auth code  
✅ **Token exchange works:** Server successfully exchanges code for access token  
✅ **Multi-tenant works:** Different users can authenticate with different accounts  
✅ **Entity creation works:** Users can create entities in their own Dynamics 365 environments

## Emergency Fallback

If still failing, create a **completely new Azure AD app registration:**

1. Azure Portal → App Registrations → + New registration
2. Name: "Huscribe Backend v2"
3. Supported account types: "Accounts in any organizational directory"
4. Redirect URI: Your current callback URL
5. Register and configure as above
6. Update `.env` with new client ID and secret

This ensures no legacy configuration issues interfere with authentication. 