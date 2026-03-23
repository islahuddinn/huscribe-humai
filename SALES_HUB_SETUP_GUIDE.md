# Dynamics 365 Sales Hub Setup Guide

## Overview
This guide will help you set up Dynamics 365 Sales Hub to enable sales objects like salesorder, lead, opportunity, product, quote, invoice, etc.

## Prerequisites
Based on your screenshots, you have:
- ✅ Dynamics 365 Sales Premium licenses (4/25 assigned)
- ✅ Microsoft 365 admin access
- ✅ Power Platform admin access

## Step-by-Step Setup

### Step 1: Access Power Platform Admin Center

1. Go to **https://admin.powerplatform.microsoft.com/**
2. Sign in with your admin account (salahuddin@Humafzco.onmicrosoft.com)
3. Click on **"Environments"** in the left navigation

### Step 2: Create or Configure Dynamics 365 Environment

#### Option A: Create New Environment (Recommended)
1. Click **"+ New"** to create a new environment
2. Fill in the details:
   - **Name**: `Sales Hub Production` (or your preferred name)
   - **Type**: `Production` (for live use) or `Sandbox` (for testing)
   - **Region**: Choose your region
   - **Purpose**: `Production` or `Developer`
3. Under **"Create a database for this environment"**: Select **"Yes"**
4. Database settings:
   - **Language**: English
   - **Currency**: Your preferred currency
   - **Enable Dynamics 365 apps**: **"Yes"**
   - **Automatically deploy these apps**: Select **"Dynamics 365 Sales"**
5. Click **"Save"**

#### Option B: Configure Existing Environment
1. Click on your existing environment
2. Go to **"Resources"** → **"Dynamics 365 apps"**
3. Click **"Install app"**
4. Select **"Dynamics 365 Sales Hub"**

### Step 3: Install Required Apps

In your environment, install these apps:
- **Dynamics 365 Sales Hub** (Primary app)
- **Dynamics 365 Sales Professional** (if available)
- **Microsoft Sales Copilot** (for AI features)

### Step 4: Assign User Licenses

1. Go to **Microsoft 365 admin center** (admin.microsoft.com)
2. Navigate to **"Users"** → **"Active users"**
3. Select users who need Sales Hub access
4. Click **"Manage product licenses"**
5. Assign these licenses:
   - ✅ **Dynamics 365 Sales Premium**
   - ✅ **Dynamics 365 for Sales (Embedded)**
   - ✅ **Microsoft Sales Copilot Premium & Trial**
   - ✅ **Power Apps for Dynamics 365**
   - ✅ **Power Automate for Dynamics 365**

### Step 5: Access Sales Hub

1. Go to **https://dynamics.microsoft.com/**
2. Sign in with your account
3. You should see **"Sales Hub"** in your available apps
4. Click on **"Sales Hub"** to launch it
5. **IMPORTANT**: Copy the URL from your browser address bar
   - Example: `https://org12345678.crm.dynamics.com/main.aspx?appid=...`
   - Your base URL is: `https://org12345678.crm.dynamics.com`

### Step 6: Configure Your Application

Create a `.env` file in your project root with these variables:

```env
# Microsoft Dynamics 365 Configuration
MD_CLIENT_ID=your-azure-app-client-id
MD_CLIENT_SECRET=your-azure-app-client-secret
TENANT_ID=your-tenant-id

# Dynamics 365 Organization URL (from Step 5)
DYNAMICS_CRM_URL=https://your-org.crm.dynamics.com

# Redirect URI
MD_REDIRECT_URI=http://localhost:3000/api/microsoft-dynamics/callback

# Optional
MD_FRONTEND_URL=http://localhost:3000
PORT=3000
NODE_ENV=development
```

### Step 7: Test Your Setup

Run this command to test your configuration:

```bash
npm start
```

Then test these endpoints:

1. **Authentication**: `GET /api/microsoft-dynamics/auth/initiate`
2. **Test Connection**: `GET /api/microsoft-dynamics/test-connection`
3. **Check Available Entities**: `GET /api/microsoft-dynamics/entities/available`

### Step 8: Verify Sales Entities

After setup, you should be able to create these sales objects:

#### Core Sales Entities ✅
- **Leads**: `/api/microsoft-dynamics/entity/lead`
- **Opportunities**: `/api/microsoft-dynamics/entity/opportunity`
- **Accounts**: `/api/microsoft-dynamics/entity/account`
- **Contacts**: `/api/microsoft-dynamics/entity/contact`

#### Sales Process Entities ✅
- **Products**: `/api/microsoft-dynamics/entity/product`
- **Quotes**: `/api/microsoft-dynamics/entity/quote`
- **Sales Orders**: `/api/microsoft-dynamics/entity/salesorder`
- **Invoices**: `/api/microsoft-dynamics/entity/invoice`

#### Activity Entities ✅
- **Tasks**: `/api/microsoft-dynamics/entity/task`
- **Appointments**: `/api/microsoft-dynamics/entity/appointment`
- **Phone Calls**: `/api/microsoft-dynamics/entity/phonecall`
- **Emails**: `/api/microsoft-dynamics/entity/email`

## Troubleshooting

### Common Issues

1. **"Entity not found" errors**
   - Solution: Ensure Sales Hub is fully installed and configured
   - Check: Go to Power Platform admin center → Your environment → Dynamics 365 apps

2. **Permission denied errors**
   - Solution: Verify user has proper licenses assigned
   - Check: Microsoft 365 admin center → Users → Licenses

3. **Authentication issues**
   - Solution: Verify Azure AD app registration
   - Check: Azure Portal → App registrations → Your app → API permissions

### Verification Commands

Test your setup with these API calls:

```bash
# Test environment analysis
GET /api/microsoft-dynamics/environment/analyze

# Test specific entity availability
GET /api/microsoft-dynamics/environment/check-entity/salesorder
GET /api/microsoft-dynamics/environment/check-entity/opportunity
GET /api/microsoft-dynamics/environment/check-entity/lead

# Discover available entity sets
GET /api/microsoft-dynamics/environment/entity-sets
```

## Expected Results

After successful setup, you should see:

```json
{
  "analysis": {
    "environmentType": "Dynamics 365 Sales Hub",
    "workingEntitiesCount": 15,
    "missingEntitiesCount": 0
  },
  "workingEntities": [
    "contact", "account", "lead", "opportunity", 
    "product", "quote", "salesorder", "invoice",
    "task", "appointment", "phonecall", "email",
    "annotation", "campaign", "incident"
  ]
}
```

## Next Steps

1. Complete the setup following steps 1-6
2. Update your `.env` file with the correct `DYNAMICS_CRM_URL`
3. Test the endpoints to verify everything works
4. Start creating sales objects through your API

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Use the diagnostic endpoints to identify problems
3. Verify your licenses and permissions
4. Contact Microsoft support for Dynamics 365 specific issues 