# 🚀 DYNAMICS 365 SALES INTEGRATION

## ⚡ SOLUTION for 403 Permission Errors

**Problem:** Getting 403 errors when creating products, opportunities, quotes?
**Solution:** Proper security roles and permissions configuration!

### **Key Requirements:**
- ✅ Dynamics 365 Sales Enterprise license
- ✅ Proper security roles assigned
- ✅ Correct Sales environment configuration
- ✅ Business Unit permissions

### **Quick Test:**
```bash
POST /api/dynamics/entity/product
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "Test Product",
  "productnumber": "TEST-001",
  "description": "Test product creation"
}
```

📖 **Complete Setup Guide:** See `DYNAMICS_365_SETUP_GUIDE.md` for detailed configuration.

---

# Installation & Setup

## Quick Start Commands

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Or with Yarn:
```bash
yarn install
yarn start
```

**Links:**
- Build: https://huscribe-backend-112929028022.us-central1.run.app
- API Docs: https://docs.google.com/document/d/1sr3ar6RPNdyeOVpAYMl7Ka439CHQ4NRW2jBsfOsNrFg/edit?tab=t.0

# Dynamics 365 Sales Environment Configuration

Based on your Power Platform admin center, you have multiple environments including a dedicated **Sales** environment where your Dynamics 365 Sales Hub is installed. Here's how to properly configure your application to target the correct environment:

## 🏢 Your Environment Setup

From your Power Platform admin center, you have:

1. **Sales** - Trial (subscription-based) - ✅ This is where your Sales entities are configured
2. **Mohamed Al Bazaz's Environment** - Developer
3. **Humai FZCO (default)** - Default

## 🎯 Step 1: Identify Your Sales Environment URL

First, run this API endpoint to identify which environment contains your Sales Hub:

```bash
GET /api/dynamics/environment/identify-sales
Authorization: Bearer YOUR_ACCESS_TOKEN
```

This will analyze all your environments and identify which one has the Sales entities available.

## 🔧 Step 2: Update Your Environment Configuration

Once you identify the correct Sales environment URL, update your `.env` file:

```env
# Replace with your actual Sales environment URL
DYNAMICS_CRM_URL=https://your-sales-org.crm4.dynamics.com

# Your existing configuration
MD_CLIENT_ID=your_client_id
MD_CLIENT_SECRET=your_client_secret
TENANT_ID=your_tenant_id
MD_REDIRECT_URI=your_redirect_uri
MD_FRONTEND_URL=your_frontend_url
```

## 🏗️ Step 3: Environment-Specific URL Format

Based on your UAE region, your Sales environment URL will likely be in one of these formats:

```
# United Arab Emirates (Middle East region)
https://[your-org-name].crm4.dynamics.com

# Alternative formats depending on your specific setup
https://[your-org-name].crm.dynamics.com
https://[your-org-name].crm5.dynamics.com
```

## 🧪 Step 4: Test Your Configuration

After updating your `.env` file, test your configuration:

### Test Connection
```bash
GET /api/dynamics/test-connection
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Test Sales Hub Status
```bash
GET /api/dynamics/environment/sales-hub-status
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Test Entity Creation
```bash
POST /api/dynamics/entity/lead/test
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "subject": "Test Lead",
  "firstname": "John",
  "lastname": "Doe",
  "companyname": "Test Company",
  "emailaddress1": "john@test.com"
}
```

## 🚀 Step 5: Using Environment-Specific Operations

If you need to work with multiple environments, you can now specify the environment URL in your API calls:

### Create Entity in Specific Environment
```bash
POST /api/dynamics/entity/lead
Authorization: Bearer YOUR_ACCESS_TOKEN
X-Environment-URL: https://your-sales-org.crm4.dynamics.com
Content-Type: application/json

{
  "subject": "New Lead",
  "firstname": "Jane",
  "lastname": "Smith",
  "companyname": "Acme Corp"
}
```

## 🔍 Step 6: Troubleshooting Common Issues

### Issue 1: Entity Not Found
If you get "entity not found" errors for sales entities:
1. Verify you're targeting the Sales environment
2. Check that Sales Hub is installed in that environment
3. Ensure your user has access to that environment

### Issue 2: Permission Denied
If you get permission errors:
1. Check your user has the appropriate security roles
2. Verify you have a Dynamics 365 Sales license
3. Ensure the user is added to the Sales environment

### Issue 3: Wrong Environment
If entities work but data isn't where expected:
1. You might be targeting the wrong environment
2. Use the identify-sales endpoint to confirm the correct URL
3. Check the Power Platform admin center for environment details

## 📋 Complete Configuration Checklist

- [ ] Run `/environment/identify-sales` endpoint
- [ ] Update `DYNAMICS_CRM_URL` in `.env` file
- [ ] Restart your application
- [ ] Test connection with `/test-connection`
- [ ] Verify Sales Hub status with `/environment/sales-hub-status`
- [ ] Test creating a lead with `/entity/lead/test`
- [ ] Create actual entities to confirm everything works

## 🎯 Expected Results

After proper configuration, you should be able to:

✅ Create leads, opportunities, products, quotes, invoices, and sales orders
✅ All sales entities work without fallback strategies
✅ Full Sales Hub functionality is available
✅ Entity creation returns actual Dynamics 365 IDs

## 🆘 If You Still Have Issues

If you continue to have problems after following these steps:

1. **Check Environment URL**: Visit https://dynamics.microsoft.com/ and sign in to see your actual environment URL
2. **Verify Licensing**: Ensure you have Dynamics 365 Sales Hub license
3. **Contact Support**: Provide the output from the identify-sales endpoint for detailed analysis

## 🔄 Dynamic Environment Switching

Your application now supports dynamic environment switching. This means you can:
- Target different environments for different operations
- Test across multiple environments
- Gradually migrate from one environment to another

The system will automatically detect the best environment for each entity type and provide clear guidance on configuration.

# 🚀 Complete Sales Entity Testing Guide

## **Step 1: Identify Your Sales Environment**

First, run this endpoint to find your Sales environment:

```bash
GET /api/dynamics/setup/sales-environment
Authorization: Bearer YOUR_ACCESS_TOKEN
```

This will tell you:
- Your current environment URL
- Available Sales environments  
- Recommended environment URL
- Setup instructions

## **Step 2: Update Your Environment (if needed)**

If the endpoint recommends a different URL, update your `.env` file:

```env
DYNAMICS_CRM_URL=https://your-sales-env.crm.dynamics.com
```

Then restart your application.

## **Step 3: Test All Sales Entities**

### **🎯 1. CREATE LEAD**

**Endpoint:** `POST /api/dynamics/entity/lead`

**Minimal Lead:**
```json
{
  "subject": "Interested in software solutions",
  "firstname": "John",
  "lastname": "Doe"
}
```

**Complete Lead:**
```json
{
  "subject": "Enterprise Software Solution Inquiry",
  "firstname": "John",
  "lastname": "Doe",
  "companyname": "Tech Innovations Inc",
  "emailaddress1": "john.doe@techinnovations.com",
  "telephone1": "+1-555-0123",
  "mobilephone": "+1-555-0124",
  "jobtitle": "IT Director",
  "websiteurl": "https://techinnovations.com",
  "description": "Lead from website contact form - interested in enterprise CRM solution",
  "industrycode": 1,
  "leadsourcecode": 1,
  "leadqualitycode": 3,
  "revenue": 500000,
  "numberofemployees": 150,
  "address1_line1": "123 Business Street",
  "address1_city": "Tech City",
  "address1_stateorprovince": "CA",
  "address1_postalcode": "90210",
  "address1_country": "USA"
}
```

### **💰 2. CREATE DEAL/OPPORTUNITY**

**Endpoint:** `POST /api/dynamics/entity/opportunity`

**Minimal Opportunity:**
```json
{
  "name": "Software License Deal"
}
```

**Complete Opportunity (FIXED FORMAT):**
```json
{
  "name": "Tech Innovations Inc - Annual Software License",
  "description": "Annual enterprise software license renewal with additional modules and premium support",
  "estimatedvalue": 75000,
  "estimatedclosedate": "2024-12-31",
  "closeprobability": 75,
  "stepname": "Proposal/Price Quote",
  "prioritycode": 1
}
```

**⚠️ IMPORTANT for Opportunities:**
- `estimatedclosedate` must be in `YYYY-MM-DD` format (date only)
- `closeprobability` is a number between 0-100
- `estimatedvalue` must be a number, not string
- Many fields from the original example are not standard Dynamics 365 fields

### **📦 3. CREATE PRODUCT**

**Endpoint:** `POST /api/dynamics/entity/product`

**Minimal Product:**
```json
{
  "name": "Enterprise Software License"
}
```

**Complete Product (FIXED FORMAT):**
```json
{
  "name": "Premium Software License by islahuddin",
  "productnumber": "PSL-2025-001",
  "description": "Annual software license with premium support",
  "standardcost": 999.99,
  "currentcost": 1299.99,
  "validfromdate": "2025-09-01",
  "validtodate": "2025-12-31"
}
```

**⚠️ IMPORTANT for Products:**
- Date fields MUST be in `YYYY-MM-DD` format (no time component)
- Do NOT use `2025-09-01T00:00:00Z` - use `2025-09-01` only
- Numeric fields must be numbers, not strings
- `validfromdate` and `validtodate` are optional but if used, must be date-only format

### **📋 4. CREATE QUOTE**

**Endpoint:** `POST /api/dynamics/entity/quote`

**Minimal Quote:**
```json
{
  "name": "Software License Quote"
}
```

**Complete Quote:**
```json
{
  "name": "Tech Innovations Inc - Enterprise Software Quote",
  "quotenumber": "QUO-2024-001",
  "description": "Annual enterprise software license quote with implementation and training services",
  "totalamount": 75000,
  "totaltax": 6750,
  "totallineitemamount": 68250,
  "freightamount": 0,
  "discountamount": 5000,
  "effectivefrom": "2024-01-01T00:00:00Z",
  "effectiveto": "2024-12-31T23:59:59Z",
  "requestdeliveryby": "2024-02-15",
  "paymenttermscode": 2,
  "freighttermscode": 1,
  "shippingmethodcode": 1,
  "willcall": false,
  "shipto_name": "Tech Innovations Inc",
  "shipto_line1": "123 Business Street",
  "shipto_city": "Tech City",
  "shipto_stateorprovince": "CA",
  "shipto_postalcode": "90210",
  "shipto_country": "USA",
  "billto_name": "Tech Innovations Inc",
  "billto_line1": "123 Business Street",
  "billto_city": "Tech City",
  "billto_stateorprovince": "CA",
  "billto_postalcode": "90210",
  "billto_country": "USA"
}
```

### **📦 5. CREATE SALES ORDER**

**Endpoint:** `POST /api/dynamics/entity/salesorder`

**Minimal Sales Order:**
```json
{
  "name": "Software License Order"
}
```

**Complete Sales Order:**
```json
{
  "name": "Tech Innovations Inc - Enterprise Software Order",
  "ordernumber": "ORD-2024-001",
  "description": "Annual enterprise software license order with implementation services",
  "totalamount": 75000,
  "totaltax": 6750,
  "totallineitemamount": 68250,
  "freightamount": 500,
  "discountamount": 5000,
  "requestdeliveryby": "2024-02-15",
  "paymenttermscode": 2,
  "freighttermscode": 1,
  "shippingmethodcode": 1,
  "willcall": false,
  "ispricelocked": true,
  "datefulfilled": "2024-02-10",
  "shipto_name": "Tech Innovations Inc",
  "shipto_line1": "123 Business Street",
  "shipto_city": "Tech City",
  "shipto_stateorprovince": "CA",
  "shipto_postalcode": "90210",
  "shipto_country": "USA",
  "billto_name": "Tech Innovations Inc",
  "billto_line1": "123 Business Street",
  "billto_city": "Tech City",
  "billto_stateorprovince": "CA",
  "billto_postalcode": "90210",
  "billto_country": "USA"
}
```

### **💳 6. CREATE INVOICE**

**Endpoint:** `POST /api/dynamics/entity/invoice`

**Minimal Invoice:**
```json
{
  "name": "Software License Invoice"
}
```

**Complete Invoice:**
```json
{
  "name": "Tech Innovations Inc - Enterprise Software Invoice",
  "invoicenumber": "INV-2024-001",
  "description": "Annual enterprise software license invoice for services rendered",
  "totalamount": 75000,
  "totaltax": 6750,
  "totallineitemamount": 68250,
  "freightamount": 500,
  "discountamount": 5000,
  "duedate": "2024-03-15",
  "paymenttermscode": 2,
  "ispricelocked": true,
  "billto_name": "Tech Innovations Inc",
  "billto_line1": "123 Business Street",
  "billto_city": "Tech City",
  "billto_stateorprovince": "CA",
  "billto_postalcode": "90210",
  "billto_country": "USA",
  "shipto_name": "Tech Innovations Inc",
  "shipto_line1": "123 Business Street",
  "shipto_city": "Tech City",
  "shipto_stateorprovince": "CA",
  "shipto_postalcode": "90210",
  "shipto_country": "USA"
}
```

### **📢 7. CREATE CAMPAIGN**

**Endpoint:** `POST /api/dynamics/entity/campaign`

**Minimal Campaign:**
```json
{
  "name": "Q1 Software Promotion"
}
```

**Complete Campaign (FIXED FORMAT):**
```json
{
  "name": "Q1 2024 Enterprise Software Promotion",
  "description": "Quarterly promotion campaign for enterprise software solutions targeting mid-market companies",
  "campaigncode": "Q1-2024-ENT",
  "actualstart": "2024-01-01T09:00:00Z",
  "actualend": "2024-03-31T17:00:00Z",
  "proposedstart": "2024-01-01T09:00:00Z",
  "proposedend": "2024-03-31T17:00:00Z",
  "budgetedcost": 50000,
  "actualcost": 45000,
  "expectedrevenue": 500000,
  "typecode": 1,
  "statuscode": 0,
  "statecode": 0,
  "objective": "Generate 100 qualified leads and close 20 new enterprise software deals",
  "message": "Transform your business with our enterprise CRM solution - 20% off for Q1 2024",
  "promotioncodename": "ENT20Q1",
  "expectedresponse": 5,
  "othercost": 5000,
  "istemplate": false
}
```

**⚠️ IMPORTANT for Campaigns:**
- Do NOT use `startdate` or `enddate` - use `actualstart` and `actualend`
- Date fields use full ISO format: `2024-01-01T09:00:00Z`
- Numeric fields must be numbers, not strings
- The system will automatically map common field variations

## **Step 4: Testing with Alternative Endpoints**

You can also use the legacy endpoints:

```bash
# Legacy endpoints (backward compatibility)
POST /api/dynamics/leads/create
POST /api/dynamics/deals/create  
POST /api/dynamics/products/create
POST /api/dynamics/quotes/create
POST /api/dynamics/salesorders/create
POST /api/dynamics/invoices/create
POST /api/dynamics/campaigns/create

# Direct opportunity endpoints
POST /api/dynamics/opportunities/create
```

## **Step 5: Validation and Testing**

### **Test with Dry Run:**
```bash
POST /api/dynamics/entity/lead/test?dryRun=true
```

### **Get Creation Guide:**
```bash
GET /api/dynamics/entity/lead/guide
```

### **Check Sales Hub Status:**
```bash
GET /api/dynamics/environment/sales-hub-status
```

## **Common Headers for All Requests:**

```bash
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

## **Troubleshooting:**

1. **Entity Not Available:** Run the Sales environment setup endpoint
2. **Permission Denied:** Check your user permissions in Dynamics 365
3. **Invalid Data:** Use the test endpoints with `?dryRun=true` first
4. **Wrong Environment:** Update your DYNAMICS_CRM_URL to point to Sales environment

All endpoints now automatically discover and use your Sales environment!

---

## **🔧 KEY FIXES IMPLEMENTED**

### **Date Format Issues RESOLVED:**
- ✅ **Products**: Date fields now use `YYYY-MM-DD` format only (no time component)
- ✅ **Opportunities**: `estimatedclosedate` uses date-only format
- ✅ **Campaigns**: Use correct field names (`actualstart` not `startdate`)
- ✅ **Quotes**: Proper datetime vs date-only field handling

### **Field Name Issues RESOLVED:**
- ✅ **Campaigns**: Fixed field mapping (`startdate` → `actualstart`, `enddate` → `actualend`)
- ✅ **Products**: Removed invalid fields, kept only supported ones
- ✅ **Opportunities**: Cleaned up to use only standard D365 fields

### **Data Type Issues RESOLVED:**
- ✅ **Numeric Fields**: All amounts are now proper numbers, not strings
- ✅ **Boolean Fields**: Proper boolean values where required
- ✅ **Date Fields**: Correct format for each entity type

### **Enhanced Error Handling:**
- ✅ **Validation**: Better field validation before API calls
- ✅ **Error Messages**: Clear guidance on data format issues
- ✅ **Automatic Cleanup**: System removes invalid fields automatically

### **Testing Your Fixes:**

Use your exact product data (now fixed):
```json
{
  "name": "Premium Software License by islahuddin",
  "productnumber": "PSL-2025-001", 
  "description": "Annual software license with premium support",
  "standardcost": 999.99,
  "currentcost": 1299.99,
  "validfromdate": "2025-09-01",
  "validtodate": "2025-12-31"
}
```

This should now work without the `Edm.Date` conversion error!

#   h u s c r i b e - h u m a i  
 