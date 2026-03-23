# 📋 DYNAMICS 365 SALES SETUP GUIDE

## 🎯 **OVERVIEW**

This guide provides complete setup instructions for Dynamics 365 Sales environment with proper security roles and permissions to create actual sales objects (products, opportunities, quotes, campaigns, sales orders, invoices) without permission errors.

---

## 🏢 **ENVIRONMENT SETUP**

### **Step 1: Verify Sales Environment**
Since you have a separate Sales environment, ensure you're targeting the correct one:

1. **Power Platform Admin Center**: https://admin.powerplatform.microsoft.com/
2. **Select your Sales environment** (not the default environment)
3. **Verify Dynamics 365 Sales Hub is installed**:
   - Go to **Resources** → **Dynamics 365 apps**
   - Confirm **Dynamics 365 Sales Hub** is installed and enabled

### **Step 2: Update Environment Configuration**
Update your `.env` file to target the Sales environment:

```env
# Your Sales Environment URL (replace with actual URL)
DYNAMICS_CRM_URL=https://your-sales-org.crm4.dynamics.com

# Your existing OAuth configuration
MD_CLIENT_ID=your_client_id
MD_CLIENT_SECRET=your_client_secret
TENANT_ID=your_tenant_id
MD_REDIRECT_URI=your_redirect_uri
```

---

## 👥 **USER LICENSING REQUIREMENTS**

### **Required Licenses for Sales Objects**

| Entity Type | Required License | Alternative License |
|-------------|------------------|-------------------|
| **Product** | Dynamics 365 Sales Enterprise | Dynamics 365 Sales Professional |
| **Opportunity** | Dynamics 365 Sales Enterprise | Dynamics 365 Sales Professional |
| **Quote** | Dynamics 365 Sales Enterprise | Dynamics 365 Sales Professional |
| **Sales Order** | Dynamics 365 Sales Enterprise | Dynamics 365 Sales Professional |
| **Invoice** | Dynamics 365 Sales Enterprise | Dynamics 365 Sales Professional |
| **Campaign** | Dynamics 365 Sales Enterprise | Dynamics 365 Marketing |

### **License Assignment Steps**
1. **Microsoft 365 Admin Center**: https://admin.microsoft.com/
2. **Users** → **Active users**
3. **Select the user** → **Licenses and apps**
4. **Assign**: Dynamics 365 Sales Enterprise (or Professional)
5. **Save changes**

---

## 🔐 **SECURITY ROLES & PERMISSIONS**

### **Required Security Roles for Sales Objects**

#### **1. Sales Manager Role** (Recommended for Full Access)
**Permissions Required:**
```
Entity: Product
- Create: Organization
- Read: Organization  
- Write: Organization
- Delete: Organization
- Append: Organization
- Append To: Organization

Entity: Opportunity
- Create: Business Unit
- Read: Business Unit
- Write: Business Unit
- Delete: Business Unit
- Append: Business Unit
- Append To: Business Unit

Entity: Quote
- Create: Business Unit
- Read: Business Unit
- Write: Business Unit
- Delete: Business Unit
- Append: Business Unit
- Append To: Business Unit

Entity: Sales Order
- Create: Business Unit
- Read: Business Unit
- Write: Business Unit
- Delete: Business Unit
- Append: Business Unit
- Append To: Business Unit

Entity: Invoice
- Create: Business Unit
- Read: Business Unit
- Write: Business Unit
- Delete: Business Unit
- Append: Business Unit
- Append To: Business Unit

Entity: Campaign
- Create: Business Unit
- Read: Business Unit
- Write: Business Unit
- Delete: Business Unit
- Append: Business Unit
- Append To: Business Unit
```

#### **2. Salesperson Role** (Standard Sales User)
**Permissions Required:**
```
Entity: Product
- Create: User
- Read: Business Unit
- Write: User
- Delete: User
- Append: User
- Append To: User

Entity: Opportunity
- Create: User
- Read: Business Unit
- Write: User
- Delete: User
- Append: User
- Append To: User

Entity: Quote
- Create: User
- Read: Business Unit
- Write: User
- Delete: User
- Append: User
- Append To: User

Entity: Sales Order
- Create: User
- Read: Business Unit
- Write: User
- Delete: User
- Append: User
- Append To: User

Entity: Invoice
- Create: User
- Read: Business Unit
- Write: User
- Delete: User
- Append: User
- Append To: User
```

#### **3. System Administrator Role** (For Setup/Testing)
- **Full access** to all entities
- **Can create and modify** security roles
- **Can assign licenses** and manage users

---

## ⚙️ **SECURITY ROLE ASSIGNMENT STEPS**

### **Method 1: Power Platform Admin Center (Recommended)**

1. **Go to Power Platform Admin Center**: https://admin.powerplatform.microsoft.com/
2. **Select your Sales environment**
3. **Settings** → **Users + permissions** → **Security roles**
4. **Create new role** or **modify existing role**:

#### **Creating Custom Sales Role:**
```
Role Name: "Sales Enterprise User"
Description: "Full access to Sales entities for API creation"

Core Records Tab:
- Account: Business Unit level (Create, Read, Write, Delete, Append, Append To)
- Contact: Business Unit level (Create, Read, Write, Delete, Append, Append To)
- Lead: Business Unit level (Create, Read, Write, Delete, Append, Append To)

Sales Tab:
- Opportunity: Business Unit level (Create, Read, Write, Delete, Append, Append To)
- Product: Organization level (Create, Read, Write, Delete, Append, Append To)
- Quote: Business Unit level (Create, Read, Write, Delete, Append, Append To)
- Order: Business Unit level (Create, Read, Write, Delete, Append, Append To)
- Invoice: Business Unit level (Create, Read, Write, Delete, Append, Append To)

Marketing Tab:
- Campaign: Business Unit level (Create, Read, Write, Delete, Append, Append To)

Service Tab:
- Case: Business Unit level (Create, Read, Write, Delete, Append, Append To)

Customization Tab:
- Entity: User level (Read)
- Field: User level (Read)
```

5. **Save the role**
6. **Assign to users**:
   - **Users + permissions** → **Users**
   - **Select user** → **Manage security roles**
   - **Add**: Sales Enterprise User + Basic User
   - **Save**

### **Method 2: Dynamics 365 Web Interface**

1. **Open Dynamics 365 Sales Hub**: https://your-sales-org.crm4.dynamics.com/
2. **Settings** → **Security** → **Security Roles**
3. **New** → Create role with above permissions
4. **Users** → **Select user** → **Manage Roles**
5. **Add the new role**

---

## 🧪 **TESTING & VALIDATION**

### **Step 1: Test User Permissions**

   ```bash
# Test connection
GET /api/dynamics/test-connection
Authorization: Bearer YOUR_ACCESS_TOKEN
   ```

### **Step 2: Test Product Creation**

   ```bash
POST /api/dynamics/entity/product
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "Premium Enterprise Software License",
  "productnumber": "PESL-2025-001",
  "description": "Annual enterprise software license with premium support",
  "standardcost": 999.99,
  "currentcost": 1299.99,
  "validfromdate": "2025-01-01",
  "validtodate": "2025-12-31"
}
```

### **Step 3: Test Opportunity Creation**

```bash
POST /api/dynamics/entity/opportunity
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "Enterprise Software Deal - Q1 2025",
  "description": "Annual enterprise software license renewal",
  "estimatedvalue": 75000,
  "estimatedclosedate": "2025-03-31",
  "closeprobability": 80
}
```

### **Step 4: Test Quote Creation**

   ```bash
POST /api/dynamics/entity/quote
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "Enterprise Software Quote - Q1 2025",
  "description": "Annual enterprise software license quote",
  "totalamount": 75000,
  "effectivefrom": "2025-01-01T00:00:00Z",
  "effectiveto": "2025-12-31T23:59:59Z"
}
```

### **Step 5: Test Campaign Creation**

   ```bash
POST /api/dynamics/entity/campaign
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "Q1 2025 Software License Campaign",
  "description": "Enterprise software license promotion",
  "budgetedcost": 15000,
  "actualstart": "2025-01-01T00:00:00Z",
  "actualend": "2025-03-31T23:59:59Z"
}
```

### **Step 6: Test Sales Order Creation**

   ```bash
POST /api/dynamics/entity/salesorder
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "Enterprise Software Order - Q1 2025",
  "description": "Annual enterprise software license order",
  "ordernumber": "ESO-2025-001",
  "requestdeliveryby": "2025-02-15"
}
```

### **Step 7: Test Invoice Creation**

   ```bash
POST /api/dynamics/entity/invoice
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "Enterprise Software Invoice - Q1 2025",
  "description": "Annual enterprise software license invoice",
  "invoicenumber": "ESI-2025-001",
  "duedate": "2025-02-28"
}
```

---

## 🚨 **TROUBLESHOOTING COMMON ISSUES**

### **Issue 1: 403 Forbidden - Insufficient Permissions**

**Cause**: User lacks proper security role or permissions
**Solution**: 
1. Verify user has Sales Enterprise license
2. Check security role assignment (Sales Manager or custom role)
3. Ensure user is in correct Business Unit
4. Verify environment has Sales Hub installed

### **Issue 2: Entity Not Found**

**Cause**: Targeting wrong environment or Sales Hub not installed
**Solution**:
1. Verify `DYNAMICS_CRM_URL` points to Sales environment
2. Check Sales Hub installation in Power Platform Admin Center
3. Ensure user has access to the Sales environment

### **Issue 3: Invalid Field Errors**

**Cause**: Field names or data formats incorrect
**Solution**:
1. Use correct field names (e.g., `estimatedclosedate` not `closedate`)
2. Format dates properly (YYYY-MM-DD for date fields)
3. Ensure numeric fields are numbers, not strings

### **Issue 4: Business Unit Access**

**Cause**: User in wrong Business Unit or lacks Business Unit permissions
**Solution**:
1. Add user to root Business Unit
2. Grant Business Unit level permissions for sales entities
3. Check Business Unit hierarchy and access

---

## 📋 **SECURITY ROLE CHECKLIST**

### **For Sales Users:**
- [ ] Dynamics 365 Sales Enterprise license assigned
- [ ] Sales Manager or Salesperson role assigned
- [ ] Basic User role assigned (required)
- [ ] Business Unit assignment correct
- [ ] User enabled in Dynamics 365
- [ ] Access to Sales environment granted

### **For Administrators:**
- [ ] System Administrator role assigned
- [ ] Can create and modify security roles
- [ ] Can assign licenses and manage users
- [ ] Full access to all environments

### **For API Access:**
- [ ] Azure AD app registration configured
- [ ] Proper OAuth scopes granted
- [ ] API permissions configured
- [ ] User consent provided

---

## 🎯 **EXPECTED RESULTS**

After proper setup, you should get:

### **Successful Product Creation:**
```json
{
  "success": true,
  "data": {
    "id": "12345678-1234-1234-1234-123456789012",
    "entityType": "product",
    "data": {
      "productid": "12345678-1234-1234-1234-123456789012",
      "name": "Premium Enterprise Software License",
      "productnumber": "PESL-2025-001",
      "standardcost": 999.99,
      "currentcost": 1299.99
    }
  },
  "message": "Product created successfully"
}
```

### **Successful Opportunity Creation:**
```json
{
  "success": true,
  "data": {
    "id": "87654321-4321-4321-4321-210987654321",
    "entityType": "opportunity",
    "data": {
      "opportunityid": "87654321-4321-4321-4321-210987654321",
      "name": "Enterprise Software Deal - Q1 2025",
      "estimatedvalue": 75000,
      "closeprobability": 80
    }
  },
  "message": "Opportunity created successfully"
}
```

---

## 🔄 **MAINTENANCE & UPDATES**

### **Regular Tasks:**
1. **Monitor license usage** in Microsoft 365 Admin Center
2. **Review security roles** quarterly
3. **Update user permissions** as needed
4. **Test API endpoints** after Dynamics 365 updates

### **When Adding New Users:**
1. Assign Dynamics 365 Sales Enterprise license
2. Add to appropriate Business Unit
3. Assign Sales security role + Basic User role
4. Test entity creation to verify access
5. Provide API access if needed

---

## 📞 **SUPPORT & ESCALATION**

### **For Permission Issues:**
1. **Check license assignment** in Microsoft 365 Admin Center
2. **Verify security roles** in Power Platform Admin Center
3. **Test in Dynamics 365 web interface** first
4. **Contact Microsoft Support** if issues persist

### **For API Issues:**
1. **Test with Postman** or similar tool
2. **Check Azure AD app registration**
3. **Verify OAuth token validity**
4. **Review API logs** for detailed errors

---

This guide ensures you can create actual sales objects (products, opportunities, quotes, campaigns, sales orders, invoices) without any permission errors by properly configuring security roles and permissions in your Dynamics 365 Sales environment. 