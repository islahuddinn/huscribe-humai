# Enhanced Zoho CRM Search API Guide

## Overview

The Enhanced Search API provides powerful and flexible search capabilities across all Zoho CRM modules. It supports searching by any field, returning all records when no search query is provided, and multi-module searches.

## Features

- **Dynamic Field Search**: Search across any field in any module
- **Multi-Module Search**: Search across multiple modules simultaneously
- **Flexible Query Options**: Support for custom fields, pagination, and filtering
- **Fallback Mechanisms**: Automatic fallback to local search if API search fails
- **Comprehensive Error Handling**: Detailed error messages and troubleshooting guides

## API Endpoints

### 1. Enhanced Search (Primary Endpoint)

```
GET /api/zoho/search
```

#### Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `module` | string | Yes* | Module to search in | `Leads`, `Contacts`, `Accounts` |
| `searchQuery` | string | No | Search term (if empty, returns all records) | `john@example.com`, `New York`, `Software` |
| `searchFields` | string | No | Comma-separated list of fields to search | `First_Name,Last_Name,Email` |
| `page` | integer | No | Page number (default: 1) | `1`, `2`, `3` |
| `per_page` | integer | No | Records per page (default: 200, max: 200) | `50`, `100`, `200` |
| `multiModule` | boolean | No | Enable multi-module search | `true`, `false` |
| `modules` | string | No | Comma-separated modules for multi-module search | `Leads,Contacts,Accounts` |

*Required unless `multiModule=true`

#### Examples

##### Search in specific module with query
```bash
GET /api/zoho/search?module=Leads&searchQuery=john
```

##### Get all records from a module (no search query)
```bash
GET /api/zoho/search?module=Leads
```

##### Search specific fields
```bash
GET /api/zoho/search?module=Contacts&searchQuery=software&searchFields=Company,Industry,Description
```

##### Multi-module search
```bash
GET /api/zoho/search?multiModule=true&searchQuery=john&modules=Leads,Contacts,Accounts
```

##### Paginated search
```bash
GET /api/zoho/search?module=Leads&searchQuery=manager&page=2&per_page=50
```

### 2. Module-Specific Search (Convenience Endpoint)

```
GET /api/zoho/search/{module}
```

#### Examples
```bash
GET /api/zoho/search/Leads?searchQuery=john
GET /api/zoho/search/Contacts?searchQuery=manager&searchFields=Title,Department
```

### 3. Get Module Fields

```
GET /api/zoho/fields/{module}
```

Returns all available fields for a module, categorized by searchable, required, and all fields.

#### Example
```bash
GET /api/zoho/fields/Leads
```

#### Response
```json
{
  "status": 200,
  "success": true,
  "crmType": "zoho",
  "module": "Leads",
  "fields": {
    "searchable": [
      {
        "api_name": "First_Name",
        "field_label": "First Name",
        "data_type": "text",
        "required": false
      }
    ],
    "all": [...],
    "required": [...]
  },
  "summary": {
    "total": 45,
    "searchable": 25,
    "required": 8
  }
}
```

## Supported Modules

The enhanced search works with all Zoho CRM modules, including:

- **Leads**: `First_Name`, `Last_Name`, `Email`, `Phone`, `Company`, `Industry`, `Lead_Status`, `Description`, `City`, `State`, `Country`, etc.
- **Contacts**: `First_Name`, `Last_Name`, `Email`, `Phone`, `Account_Name`, `Title`, `Department`, `Mailing_City`, `Description`, etc.
- **Accounts**: `Account_Name`, `Phone`, `Website`, `Industry`, `Type`, `Billing_City`, `Billing_Country`, `Description`, etc.
- **Deals**: `Deal_Name`, `Stage`, `Amount`, `Expected_Revenue`, `Type`, `Description`, `Next_Step`, etc.
- **Products**: `Product_Name`, `Product_Code`, `Description`, `Category`, `Manufacturer`, `Vendor_Name`, etc.
- **Tasks**: `Subject`, `Status`, `Priority`, `Description`, etc.
- **Events**: `Subject`, `Location`, `Description`, `Status`, `Priority`, etc.
- **Campaigns**: `Campaign_Name`, `Type`, `Status`, `Description`, etc.
- **Cases**: `Subject`, `Description`, `Status`, `Priority`, `Type`, `Origin`, etc.
- **Quotes**: `Subject`, `Quote_Stage`, `Terms_and_Conditions`, `Description`, etc.
- **And many more...**

## Response Format

### Single Module Search Response

```json
{
  "status": 200,
  "success": true,
  "crmType": "zoho",
  "searchType": "single-module",
  "module": "Leads",
  "searchQuery": "john",
  "searchFields": ["First_Name", "Last_Name", "Email", "Company"],
  "page": 1,
  "per_page": 200,
  "data": [
    {
      "id": "123456789",
      "First_Name": "John",
      "Last_Name": "Doe",
      "Email": "john.doe@example.com",
      "Company": "Tech Corp"
    }
  ],
  "total": 1,
  "hasMore": false,
  "searchMethod": "api",
  "metadata": {
    "recordsReturned": 1,
    "isSearching": true,
    "pagination": {
      "currentPage": 1,
      "recordsPerPage": 200,
      "hasMoreRecords": false
    }
  }
}
```

### Multi-Module Search Response

```json
{
  "status": 200,
  "success": true,
  "crmType": "zoho",
  "searchType": "multi-module",
  "searchQuery": "john",
  "modules": ["Leads", "Contacts"],
  "results": [
    {
      "module": "Leads",
      "success": true,
      "data": [...],
      "total": 5
    },
    {
      "module": "Contacts",
      "success": true,
      "data": [...],
      "total": 3
    }
  ],
  "totalModules": 2,
  "successfulModules": 2
}
```

## Search Capabilities

### Field Types Supported
- **Text Fields**: First_Name, Last_Name, Company, Description
- **Email Fields**: Email, Secondary_Email
- **Phone Fields**: Phone, Mobile, Fax
- **Address Fields**: Street, City, State, Country, Zip_Code
- **Lookup Fields**: Account_Name, Contact_Name
- **Picklist Fields**: Industry, Lead_Status, Stage
- **Date Fields**: Created_Time, Modified_Time
- **Number Fields**: Annual_Revenue, Amount

### Search Operators
The enhanced search automatically uses multiple operators:
- **Contains**: Partial match anywhere in the field
- **Starts With**: Match at the beginning of the field
- **Equals**: Exact match

### Fallback Mechanism
If the API search fails, the system automatically falls back to:
1. Fetch all records from the module
2. Perform local filtering based on the search query
3. Return filtered results with `searchMethod: "local_fallback"`

## Error Handling

The API provides detailed, actionable error responses to help quickly identify and resolve issues.

### Error Response Format

All error responses follow this consistent format:

```json
{
  "success": false,
  "status": 400,
  "error": {
    "code": "ZOHO_ERROR_CODE",
    "message": "Human-readable error message",
    "category": "Error Category",
    "details": {
      // Context-specific error details
    },
    "solutions": [
      "Step-by-step solutions to resolve the error"
    ],
    "timestamp": "2024-03-20T10:30:00.000Z",
    "requestId": "zoho-1234567890-abc123"
  }
}
```

### Common Error Types

#### 1. Authentication Errors (401)
```json
{
  "success": false,
  "status": 401,
  "error": {
    "code": "ZOHO_AUTH_ERROR",
    "message": "Authentication failed or token expired",
    "category": "Authentication",
    "details": {
      "zoho_error": "INVALID_TOKEN",
      "context": "search"
    },
    "solutions": [
      "Refresh your access token using POST /api/zoho/auth/refresh",
      "Re-authenticate using GET /api/zoho/auth/url",
      "Check if your token has the required scopes"
    ],
    "timestamp": "2024-03-20T10:30:00.000Z",
    "requestId": "zoho-1234567890-abc123"
  }
}
```

#### 2. Permission Errors (403)
```json
{
  "success": false,
  "status": 403,
  "error": {
    "code": "ZOHO_PERMISSION_ERROR",
    "message": "Insufficient permissions for this operation",
    "category": "Authorization",
    "details": {
      "required_scopes": [
        "ZohoCRM.modules.ALL",
        "ZohoCRM.settings.ALL"
      ]
    },
    "solutions": [
      "Ensure your token has the required module permissions",
      "Check module access in Zoho CRM settings",
      "Request necessary permissions from your Zoho CRM administrator"
    ]
  }
}
```

#### 3. Module Configuration Errors (400)
```json
{
  "success": false,
  "status": 400,
  "error": {
    "code": "ZOHO_MODULE_ERROR",
    "message": "Invalid or unsupported module specified",
    "category": "Module Configuration",
    "details": {
      "module": "InvalidModule",
      "context": "search",
      "available_endpoints": {
        "list_modules": "GET /api/zoho/modules",
        "module_fields": "GET /api/zoho/fields/{module}",
        "search_guide": "See documentation for supported modules"
      }
    },
    "solutions": [
      "Verify the module name is correct",
      "Check if the module exists in your Zoho CRM setup",
      "Use GET /api/zoho/modules to list available modules"
    ]
  }
}
```

#### 4. Field Configuration Errors (400)
```json
{
  "success": false,
  "status": 400,
  "error": {
    "code": "ZOHO_FIELD_ERROR",
    "message": "One or more invalid search fields specified",
    "category": "Field Configuration",
    "details": {
      "module": "Leads",
      "invalid_fields": ["InvalidField1", "InvalidField2"],
      "suggestion": "Use GET /api/zoho/fields/Leads to see available fields"
    },
    "solutions": [
      "Verify field names using GET /api/zoho/fields/{module}",
      "Check if the fields are searchable",
      "Ensure field names match the API names exactly"
    ]
  }
}
```

#### 5. Rate Limit Errors (429)
```json
{
  "success": false,
  "status": 429,
  "error": {
    "code": "ZOHO_RATE_LIMIT_ERROR",
    "message": "Rate limit exceeded for Zoho CRM API",
    "category": "Rate Limit",
    "details": {
      "retry_after": "60",
      "context": "search"
    },
    "solutions": [
      "Implement request throttling",
      "Use pagination to reduce request size",
      "Wait before retrying the request"
    ]
  }
}
```

#### 6. API Errors (500)
```json
{
  "success": false,
  "status": 500,
  "error": {
    "code": "ZOHO_API_ERROR",
    "message": "Zoho CRM service is currently unavailable",
    "category": "API",
    "details": {
      "http_status": 503,
      "context": "search"
    },
    "solutions": [
      "Check Zoho CRM API status",
      "Verify API rate limits",
      "Try the operation again later"
    ]
  }
}
```

### Error Handling Best Practices

1. **Always Check Error Category**
   - Error responses include a `category` field to help identify the type of error
   - Categories include: Authentication, Authorization, Module Configuration, Field Configuration, Search Operation, API, Rate Limit

2. **Follow Suggested Solutions**
   - Each error response includes actionable `solutions`
   - Solutions are ordered by likelihood of resolving the issue

3. **Use Request IDs for Support**
   - All error responses include a unique `requestId`
   - Reference this ID when reporting issues or seeking support

4. **Check Context-Specific Details**
   - The `details` object contains additional information specific to the error
   - Use this information for debugging and error resolution

5. **Implement Proper Retry Logic**
   - For rate limit errors (429), respect the `retry_after` header
   - For API errors (500), implement exponential backoff

6. **Monitor Error Patterns**
   - Use the `timestamp` field to track error occurrences
   - Look for patterns in error categories and codes

### Common Troubleshooting Steps

1. **Authentication Issues**
   ```bash
   # Refresh access token
   POST /api/zoho/auth/refresh
   
   # Get new authentication URL
   GET /api/zoho/auth/url
   ```

2. **Invalid Module/Field**
   ```bash
   # List available modules
   GET /api/zoho/modules
   
   # Get module fields
   GET /api/zoho/fields/{module}
   ```

3. **Search Issues**
   ```bash
   # Verify module exists
   GET /api/zoho/modules
   
   # Check searchable fields
   GET /api/zoho/fields/{module}
   
   # Try simplified search
   GET /api/zoho/search?module=Leads
   ```

## Authentication

All search endpoints require a valid Zoho CRM access token in the Authorization header:

```bash
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Rate Limits

- **API Search**: Subject to Zoho CRM API rate limits
- **Fallback Search**: May take longer for large datasets
- **Recommended**: Use pagination for large result sets

## Best Practices

1. **Use Specific Fields**: Specify `searchFields` for more targeted searches
2. **Implement Pagination**: Use `page` and `per_page` for large datasets
3. **Handle Fallbacks**: Check `searchMethod` in response to understand search type
4. **Cache Module Fields**: Cache field information to reduce API calls
5. **Error Handling**: Implement proper error handling for all scenarios

## Examples by Use Case

### Customer Search
```bash
# Search for customer by email across multiple modules
GET /api/zoho/search?multiModule=true&searchQuery=customer@example.com&modules=Leads,Contacts,Accounts
```

### Location-Based Search
```bash
# Find all leads from New York
GET /api/zoho/search?module=Leads&searchQuery=New York&searchFields=City,State,Mailing_City,Mailing_State
```

### Industry Analysis
```bash
# Get all accounts in software industry
GET /api/zoho/search?module=Accounts&searchQuery=Software&searchFields=Industry,Description
```

### Sales Pipeline
```bash
# Find high-value deals
GET /api/zoho/search?module=Deals&searchQuery=50000&searchFields=Amount,Expected_Revenue
```

This enhanced search API provides the flexibility and power needed for comprehensive CRM data exploration and analysis. 