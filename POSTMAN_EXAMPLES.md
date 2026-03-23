# Dynamics 365 CRM API - Postman JSON Examples

This document provides complete JSON body examples for creating entities in your Dynamics 365 CRM through the API.

## 🔗 **Base URL**
```
http://localhost:5001/api/dynamic
```

## 🔑 **Authentication Header**
```
Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
```

---

## ✅ **CORE ENTITIES (Usually Available)**

### 👤 **Contact**
```http
POST /api/dynamic/contacts/create
POST /api/dynamic/entity/contact
```

**JSON Body:**
```json
{
  "firstname": "John",
  "lastname": "Doe",
  "emailaddress1": "john.doe@example.com",
  "telephone1": "+1-555-0123",
  "mobilephone": "+1-555-0456",
  "jobtitle": "Software Engineer",
  "websiteurl": "https://johndoe.dev",
  "address1_line1": "123 Main Street",
  "address1_city": "New York",
  "address1_stateorprovince": "NY",
  "address1_postalcode": "10001",
  "address1_country": "USA",
  "description": "Senior software engineer with 5+ years of experience"
}
```

### 🏢 **Account (Company)**
```http
POST /api/dynamic/accounts/create
POST /api/dynamic/entity/account
```

**JSON Body:**
```json
{
  "name": "Acme Corporation",
  "websiteurl": "https://acme.com",
  "telephone1": "+1-555-0100",
  "emailaddress1": "info@acme.com",
  "address1_line1": "456 Corporate Blvd",
  "address1_city": "San Francisco",
  "address1_stateorprovince": "CA",
  "address1_postalcode": "94105",
  "address1_country": "USA",
  "description": "Leading technology solutions provider",
  "numberofemployees": 250,
  "revenue": 50000000
}
```

### ✅ **Task**
```http
POST /api/dynamic/tasks/create
POST /api/dynamic/entity/task
```

**JSON Body:**
```json
{
  "subject": "Follow up with potential client",
  "description": "Schedule a demo call with Acme Corporation",
  "scheduledstart": "2024-01-15T09:00:00Z",
  "scheduledend": "2024-01-15T10:00:00Z",
  "prioritycode": 2,
  "statecode": 0,
  "statuscode": 2
}
```

---

## 📅 **ACTIVITY ENTITIES (Often Available)**

### 📅 **Appointment (Meeting)**
```http
POST /api/dynamic/appointments/create
POST /api/dynamic/meetings/create
POST /api/dynamic/entity/appointment
```

**JSON Body:**
```json
{
  "subject": "Weekly Team Standup",
  "description": "Weekly team synchronization meeting",
  "scheduledstart": "2024-01-15T10:00:00Z",
  "scheduledend": "2024-01-15T11:00:00Z",
  "location": "Conference Room A",
  "prioritycode": 1,
  "statecode": 0,
  "statuscode": 1,
  "isalldayevent": false
}
```

### 📝 **Note (Annotation)**
```http
POST /api/dynamic/notes/create
POST /api/dynamic/entity/annotation
```

**JSON Body:**
```json
{
  "subject": "Meeting Notes - Client Requirements",
  "notetext": "Client discussed requirements for CRM integration and custom reporting dashboard",
  "isdocument": false
}
```

**⚠️ Important Note Field Types:**
- `langid`: Must be STRING, not integer: `"1033"` not `1033`
- `isdocument`: Must be boolean: `false` not `"false"`

**JSON Body with Optional Fields:**
```json
{
  "subject": "Meeting Notes - Client Requirements",
  "notetext": "Client discussed requirements for CRM integration and custom reporting dashboard",
  "isdocument": false,
  "langid": "1033"
}
```

### 📞 **Phone Call**
```http
POST /api/dynamic/phonecalls/create
POST /api/dynamic/calls/create
POST /api/dynamic/entity/phonecall
```

**JSON Body:**
```json
{
  "subject": "Sales follow-up call",
  "description": "Discussed pricing options with prospect",
  "scheduledstart": "2024-01-15T14:00:00Z",
  "scheduledend": "2024-01-15T14:30:00Z",
  "prioritycode": 1,
  "directioncode": true,
  "phonenumber": "+1-555-0123"
}
```

### 📧 **Email**
```http
POST /api/dynamic/emails/create
POST /api/dynamic/entity/email
```

**JSON Body:**
```json
{
  "subject": "Proposal for CRM Implementation",
  "description": "Please find attached our proposal for CRM solution",
  "prioritycode": 1,
  "directioncode": true,
  "statecode": 0,
  "statuscode": 1
}
```

**⚠️ Important Email Field Notes:**
- Dynamics 365 emails don't use `"to"` and `"from"` fields
- Use activity parties for recipients (complex relationship setup required)
- Email creation requires additional setup for sender/recipients
- Consider using simpler entities like Phone Call or Appointment for activity tracking

---

## 🎫 **SERVICE ENTITIES (Customer Service)**

### 🎫 **Case (Incident)**
```http
POST /api/dynamic/cases/create
POST /api/dynamic/entity/incident
```

**JSON Body:**
```json
{
  "title": "Email integration not working",
  "description": "Customer reports emails not syncing with CRM system",
  "caseorigincode": 1,
  "prioritycode": 2,
  "severitycode": 2,
  "casetypecode": 1,
  "statecode": 0,
  "statuscode": 1
}
```

---

## 💰 **SALES ENTITIES** ❌ **REQUIRES SALES HUB LICENSE - LIKELY NOT AVAILABLE**

### 🎯 **Lead** ❌ **REQUIRES SALES HUB**
```http
POST /api/dynamic/leads/create
POST /api/dynamic/entity/lead
```

**JSON Body:**
```json
{
  "firstname": "Jane",
  "lastname": "Smith",
  "companyname": "Tech Innovations LLC",
  "jobtitle": "CTO",
  "emailaddress1": "jane.smith@techinnovations.com",
  "telephone1": "+1-555-0200",
  "description": "Interested in CRM solution for 50+ users"
}
```

**💡 Alternative**: Use **Contact** entity instead - it works with basic licenses!

### 💼 **Opportunity (Deal)** ❌ **REQUIRES SALES HUB**
```http
POST /api/dynamic/deals/create
POST /api/dynamic/entity/opportunity
```

**JSON Body:**
```json
{
  "name": "CRM Implementation - Tech Innovations",
  "description": "Complete CRM implementation project",
  "estimatedvalue": 75000,
  "estimatedclosedate": "2024-03-15",
  "probabilitycode": 3
}
```

**💡 Alternative**: Use **Task** or **Appointment** entities to track project milestones!

### 📋 **Sales Order** ⚠️ **REQUIRES SALES HUB LICENSE**
```http
POST /api/dynamic/salesorders/create
POST /api/dynamic/orders/create
POST /api/dynamic/entity/salesorder
```

**JSON Body:**
```json
{
  "name": "Sales Order - Tech Solutions Package",
  "description": "Complete CRM implementation with training and support",
  "totalamount": 125000,
  "pricelevelid": "standard-price-list"
}
```

**❌ IMPORTANT - Sales Order Limitations:**
- **Requires Dynamics 365 Sales Hub license** - Most basic licenses DON'T include this
- Will return 404 error if Sales Hub not enabled
- **Alternative**: Use **Tasks** or **Appointments** to track sales activities
- **Check first**: Run `/environment/analyze` to see what's available in your environment

---

## 🧪 **Testing Endpoints**

### 🔍 **Check What's Available**
```http
GET /api/dynamic/environment/analyze
```
*This will tell you which entities work in your environment*

### 🔗 **Test Connection**
```http
GET /api/dynamic/test-connection
```
*Test your authentication*

---

## 📝 **Quick Tips**

1. **Start Simple**: Use basic required fields first, then add more details
2. **Check Availability**: Use `/environment/analyze` to see what entities work
3. **Date Format**: Always use ISO format: `"2024-01-15T10:00:00Z"`
4. **Test Order**: Try Contact → Account → Task → Appointment → Case
5. **Authentication**: Get fresh token from `/auth/initiate` if expired

**Most Likely to Work**: Contact, Account, Task, Appointment, Note, Case 