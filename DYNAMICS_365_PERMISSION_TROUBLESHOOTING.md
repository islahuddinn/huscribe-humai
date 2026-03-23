# Dynamics 365 Permission Troubleshooting Guide

## 🚨 Common Error: 403 - Insufficient Permissions

When you get a **403 Insufficient Permissions** error, it means the user account doesn't have the required permissions to perform the requested operation (like creating a contact).

### 🔍 Quick Diagnosis

Use these API endpoints to diagnose the issue:

```bash
# 1. Diagnose user permissions comprehensively
GET /api/dynamics/diagnose-permissions
Headers: 
  Authorization: Bearer YOUR_TOKEN
  X-Instance-URL: https://your-org.crm.dynamics.com

# 2. Get detailed permission guide
GET /api/dynamics/permission-guide

# 3. Test basic connection
GET /api/dynamics/test-connection
```

## 🛠️ Step-by-Step Solution

### Step 1: Verify User License

**Check if user has a Dynamics 365 license:**

1. Go to [Microsoft 365 Admin Center](https://admin.microsoft.com)
2. Navigate to **Users > Active users**
3. Find the user and check their licenses
4. Ensure they have one of:
   - Dynamics 365 Sales Professional/Enterprise
   - Dynamics 365 Customer Service
   - Dynamics 365 Team Members
   - Microsoft 365 Business Premium (limited D365 access)

### Step 2: Add User to Dynamics 365 Environment

**Add user to your Dynamics 365 organization:**

1. Go to [Power Platform Admin Center](https://admin.powerplatform.microsoft.com)
2. Select your environment
3. Go to **Settings > Users + permissions > Users**
4. Click **+ Add user**
5. Search and select the user
6. Assign appropriate **Security Role** (see options below)

### Step 3: Assign Correct Security Role

**Choose the appropriate security role:**

| Security Role | Access Level | Can Create Contacts | Use Case |
|---------------|--------------|-------------------|----------|
| **System Administrator** | Full access | ✅ Yes | Admins and power users |
| **Salesperson** | Sales entities | ✅ Yes | Sales team members |
| **Customer Service Representative** | Service entities | ✅ Yes | Support team |
| **Basic User** | Limited access | ⚠️ Limited | General business users |
| **Sales Manager** | Sales + management | ✅ Yes | Sales managers |

**To assign security roles:**

1. In Power Platform Admin Center > Environment > **Security roles**
2. Select a role (e.g., "Salesperson")
3. Click **Add people**
4. Select your users and **Add**

### Step 4: Configure Entity Permissions

**If users still can't create entities, check entity permissions:**

1. Go to **Security roles** in Power Platform Admin Center
2. Edit the user's security role
3. Navigate to **Core Records** tab
4. For **Contact** entity, ensure these permissions are checked:
   - ✅ **Create** - User level or higher
   - ✅ **Read** - User level or higher
   - ✅ **Write** - User level or higher

## 🎯 Entity-Specific Requirements

### Basic CRM Entities (Always Available)
- **Contact, Account, Task, Appointment, Note**
- Require: Basic D365 license + Security role with entity permissions

### Sales Hub Entities (Require Sales License)
- **Lead, Opportunity, Quote, Order, Invoice**
- Require: D365 Sales Hub license + Sales security role

### Customer Service Entities (Require Service License)
- **Case/Incident, Knowledge Article**
- Require: D365 Customer Service license + Service security role

## 🔧 Advanced Troubleshooting

### Check User Status in D365

```bash
# Use this endpoint to get detailed user information
GET /api/dynamics/diagnose-permissions
```

This will tell you:
- ✅ User's security roles
- ✅ Which entities they can access
- ✅ Specific permission levels
- ✅ Licensing status
- ✅ Recommended actions

### Test Entity Access Manually

```bash
# Test if user can read contacts
GET /api/dynamics/entity/contact
Headers: 
  Authorization: Bearer YOUR_TOKEN
  X-Instance-URL: https://your-org.crm.dynamics.com

# Test if user can create contacts
POST /api/dynamics/entity/contact
Headers: 
  Authorization: Bearer YOUR_TOKEN
  X-Instance-URL: https://your-org.crm.dynamics.com
Body: {
  "firstname": "Test",
  "lastname": "User"
}
```

## 🚀 Quick Fixes for Common Scenarios

### Scenario 1: New Employee Needs Basic CRM Access

```bash
1. Assign "Dynamics 365 Team Members" license
2. Add user to D365 environment
3. Assign "Basic User" or "Salesperson" security role
4. Test with: GET /api/dynamics/entity/contact
```

### Scenario 2: Sales Team Member Can't Create Leads

```bash
1. Ensure user has "Dynamics 365 Sales" license
2. Assign "Salesperson" security role
3. Verify Sales Hub apps are installed in environment
4. Test with: POST /api/dynamics/entity/lead
```

### Scenario 3: API Integration User Needs Full Access

```bash
1. Create a service user account
2. Assign "System Administrator" security role
3. Grant app registration permissions in Azure AD
4. Use application permissions instead of delegated
```

## 📋 Security Role Comparison

| Permission | Basic User | Salesperson | Customer Service Rep | System Admin |
|------------|------------|-------------|---------------------|--------------|
| Create Contact | User-level | Organization | Organization | Global |
| Create Account | User-level | Organization | User-level | Global |
| Create Lead | ❌ No | Organization | ❌ No | Global |
| Create Opportunity | ❌ No | Organization | ❌ No | Global |
| Create Case | ❌ No | ❌ No | Organization | Global |
| Admin Functions | ❌ No | ❌ No | ❌ No | Global |

## 🔗 Helpful Resources

- [Power Platform Admin Center](https://admin.powerplatform.microsoft.com) - Manage users and permissions
- [Microsoft 365 Admin Center](https://admin.microsoft.com) - Manage licenses
- [D365 Security Roles Documentation](https://docs.microsoft.com/en-us/power-platform/admin/security-roles-privileges)
- [D365 Licensing Guide](https://docs.microsoft.com/en-us/dynamics365/get-started/licensing-guide)

## 🆘 Still Need Help?

If you're still experiencing issues after following this guide:

1. **Use the diagnostic endpoint**: `GET /api/dynamics/diagnose-permissions`
2. **Check the permission guide**: `GET /api/dynamics/permission-guide`
3. **Contact your system administrator** with the diagnostic results
4. **Verify your Dynamics 365 environment is properly configured**

---

> **💡 Pro Tip**: Always test permissions with the actual user account that will be using the API. Admin accounts may have different permissions than regular user accounts. 