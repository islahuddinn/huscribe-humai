# Multi-Tenant Dynamics 365 CRM Integration Testing Guide

This guide will help you test the enhanced multi-tenant Dynamics 365 CRM integration that supports different subscription types and automatic permission detection.

## Prerequisites

1. **Azure App Registration** configured for multi-tenant access
2. **Multiple Dynamics 365 environments** with different subscription types (trial, professional, enterprise)
3. **Test accounts** with different license types
4. **Environment variables** properly configured

## Environment Setup

### 1. Configure Environment Variables

```bash
# Core Configuration
MD_CLIENT_ID=your-azure-app-client-id
MD_CLIENT_SECRET=your-azure-app-client-secret
TENANT_ID=common  # Use 'common' for multi-tenant support
MD_REDIRECT_URI=http://localhost:3000/api/dynamics/callback
MD_FRONTEND_URL=http://localhost:3000

# Initial Dynamics URL (will be dynamically overridden)
DYNAMICS_CRM_URL=https://org4cfb2bc0.crm15.dynamics.com
```

### 2. Verify Azure App Registration Settings

- **Account Types**: Multi-tenant (Accounts in any organizational directory)
- **API Permissions Required**:
  - `Microsoft Graph` → `User.Read` (Delegated)
  - `Microsoft Graph` → `Organization.Read.All` (Delegated)  
  - `Dynamics CRM` → `user_impersonation` (Delegated)
  - `PowerApps Service` → `User` (Delegated)

## Step-by-Step Testing Instructions

### Phase 1: Initial Setup and Authentication

#### Step 1: Start Your Server
```bash
npm start
```

#### Step 2: Test Basic Authentication (Multi-tenant)
```bash
# Navigate to this URL in your browser
http://localhost:3000/api/dynamics/auth/initiate?platform=web
```

**What happens**: System redirects to Microsoft login, supports any organizational account

#### Step 3: Verify Callback Processing
After login, check console logs for:
- ✅ User info retrieved
- ✅ Organization discovery
- ✅ Environment detection
- ✅ Token generation

### Phase 2: Subscription Detection Testing

#### Test with Trial Account

```bash
# After authentication, test subscription detection
curl -X GET "http://localhost:3000/api/dynamics/subscription/detect" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response for Trial Account**:
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "user-id",
      "isTrialUser": true
    },
    "subscription": {
      "subscriptionType": "basic",
      "capabilities": {
        "canCreateContacts": true,
        "canCreateLeads": false,
        "hasSalesHub": false
      }
    },
    "recommendations": [
      {
        "type": "upgrade",
        "title": "Consider Sales Hub License",
        "priority": "high"
      }
    ]
  }
}
```

### Phase 3: Entity Creation Testing

#### Test 1: Create Contact (Should Work for All Subscriptions)

```bash
curl -X POST "http://localhost:3000/api/dynamics/entity-licensed/contact" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "John",
    "lastname": "Doe",
    "emailaddress1": "john.doe@example.com"
  }'
```

**Expected**: ✅ Success (available in all subscriptions)

#### Test 2: Create Lead (May Fail for Trial/Basic)

```bash
curl -X POST "http://localhost:3000/api/dynamics/entity-licensed/lead" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "Jane",
    "lastname": "Smith",
    "companyname": "Test Company",
    "subject": "Test Lead"
  }'
```

**Expected for Trial**: ❌ 402 Payment Required with upgrade guidance
**Expected for Sales License**: ✅ Success

### Phase 4: Multi-Environment Testing

#### Discover Available Environments

```bash
curl -X GET "http://localhost:3000/api/dynamics/organizations/discover" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Connect to Specific Environment

```bash
curl -X POST "http://localhost:3000/api/dynamics/auth/connect-instance" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceUrl": "https://your-specific-org.crm.dynamics.com",
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

### Phase 5: Error Handling Validation

#### Test Permission Denied Scenario

```bash
# Test with limited permissions user
curl -X POST "http://localhost:3000/api/dynamics/entity-licensed/contact" \
  -H "Authorization: Bearer LIMITED_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstname": "Test", "lastname": "User"}'
```

**Expected Response**:
```json
{
  "success": false,
  "status": 403,
  "error": "Insufficient permissions to create contact",
  "details": {
    "solution": "Contact your system administrator to grant necessary permissions",
    "steps": [
      "Verify you have a valid Dynamics 365 license",
      "Check your security role assignments"
    ]
  }
}
```

## Testing Different Account Types

### 1. Trial Account Testing
- ✅ Should authenticate successfully
- ✅ Should detect "basic" subscription
- ✅ Should allow contact/account creation
- ❌ Should block lead/opportunity creation with upgrade guidance

### 2. Sales Professional Testing
- ✅ Should authenticate successfully
- ✅ Should detect "sales" subscription
- ✅ Should allow all sales entity creation
- ✅ Should provide sales-specific features

### 3. Enterprise Account Testing
- ✅ Should authenticate successfully
- ✅ Should detect "sales_enterprise" subscription
- ✅ Should allow goal/metric creation
- ✅ Should provide advanced analytics features

## Troubleshooting Guide

### Issue 1: "Instance URL is required" Error

**Cause**: No instance URL mapping for access token

**Solution**:
```bash
# Use connect-instance endpoint first
curl -X POST "http://localhost:3000/api/dynamics/auth/connect-instance" \
  -d '{"instanceUrl": "YOUR_INSTANCE_URL", "refreshToken": "YOUR_REFRESH_TOKEN"}'
```

### Issue 2: 403 Permission Errors

**Diagnosis**:
```bash
curl -X GET "http://localhost:3000/api/dynamics/diagnose-permissions" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Common Causes**:
1. User lacks Dynamics 365 license
2. Security role doesn't include entity permissions
3. Entity requires specific subscription (e.g., Sales Hub)

### Issue 3: Environment Discovery Fails

**Diagnosis**:
```bash
curl -X GET "http://localhost:3000/api/dynamics/environment/analyze" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Manual Testing Checklist

### Authentication Flow
- [ ] Multi-tenant login works
- [ ] Token generation successful
- [ ] Environment discovery completes
- [ ] Instance URL mapping created

### Subscription Detection
- [ ] Correctly identifies trial accounts
- [ ] Correctly identifies sales subscriptions
- [ ] Correctly identifies enterprise features
- [ ] Provides accurate capability assessment

### Entity Operations
- [ ] Contact creation works for all account types
- [ ] Lead creation blocked/allowed appropriately
- [ ] Opportunity creation blocked/allowed appropriately
- [ ] Error messages are helpful and actionable

### Multi-Environment Support
- [ ] Can discover multiple environments
- [ ] Can switch between environments
- [ ] Token mapping works per environment
- [ ] Capabilities detected per environment

### Error Handling
- [ ] Permission errors provide clear guidance
- [ ] License errors suggest upgrades
- [ ] Technical errors are user-friendly
- [ ] Fallback entities suggested when appropriate

## Performance Testing

### Load Testing
```bash
# Test multiple concurrent requests
for i in {1..10}; do
  curl -X POST "http://localhost:3000/api/dynamics/entity-licensed/contact" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"firstname\": \"Test$i\", \"lastname\": \"User$i\"}" &
done
```

### Memory Monitoring
```bash
# Monitor memory usage
watch -n 1 'ps aux | grep node | grep -v grep'
```

## Security Testing

### Token Validation
- [ ] Invalid tokens rejected
- [ ] Expired tokens refreshed
- [ ] Cross-tenant access prevented

### Data Protection
- [ ] Sensitive data not logged
- [ ] Tokens encrypted at rest
- [ ] API calls use HTTPS

## Expected Outcomes

### For Trial Accounts
- ✅ Authentication works
- ✅ Basic entities (contact, account) work
- ❌ Sales entities blocked with upgrade guidance
- ✅ Clear upgrade path provided

### For Full License Accounts
- ✅ All licensed entities work
- ✅ Advanced features available
- ✅ Multi-environment support
- ✅ Full functionality unlocked

### For All Account Types
- ✅ Graceful error handling
- ✅ Clear guidance messages
- ✅ Alternative suggestions provided
- ✅ Performance remains good

This testing approach ensures your enhanced multi-tenant integration works reliably across all Dynamics 365 subscription types and provides excellent user experience regardless of license limitations. 