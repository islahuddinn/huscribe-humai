# API Documentation

## Authentication
All API endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Chatter Feed Endpoints

### Post to Chatter Feed
**POST** `/api/objects/chatter`

Create a new post in the Salesforce Chatter Feed.

Request Body:
```json
{
    "parentId": "string",    // ID of the parent record (required)
    "body": "string",        // Content of the post (required)
    "title": "string",       // Optional title for the post
    "isRichText": boolean    // Optional, defaults to false
}
```

Response:
```json
{
    "success": true,
    "data": {
        "feedItem": {
            "id": "string",
            "type": "TextPost",
            "body": "string",
            "title": "string",
            "isRichText": boolean,
            "createdDate": "datetime"
        },
        "object": {
            // Local object data
        }
    }
}
```

### Update Chatter Post
**PUT** `/api/objects/chatter/:id`

Update an existing Chatter Feed post.

Parameters:
- `id`: The ID of the Chatter Feed post to update

Request Body:
```json
{
    "body": "string",        // New content for the post (optional)
    "title": "string",       // New title for the post (optional)
    "isRichText": boolean    // Optional
}
```

Response:
```json
{
    "success": true,
    "data": {
        "feedItem": {
            "id": "string",
            "type": "TextPost",
            "body": "string",
            "title": "string",
            "isRichText": boolean,
            "lastModifiedDate": "datetime"
        },
        "object": {
            // Local object data
        }
    }
}
```

### Get Chatter Post
**GET** `/api/objects/chatter/:id`

Retrieve a specific Chatter Feed post.

Parameters:
- `id`: The ID of the Chatter Feed post

Response:
```json
{
    "success": true,
    "data": {
        "feedItem": {
            "id": "string",
            "type": "TextPost",
            "body": "string",
            "title": "string",
            "isRichText": boolean,
            "createdDate": "datetime"
        }
    }
}
```

### Get All Chatter Posts
**GET** `/api/objects/chatter`

Retrieve all Chatter Feed posts.

Query Parameters:
- `parentId` (optional): Filter posts by parent record ID
- `page` (optional): Page number for pagination
- `limit` (optional): Number of items per page

Response:
```json
{
    "success": true,
    "data": {
        "feedItems": [
            {
                "id": "string",
                "type": "TextPost",
                "body": "string",
                "title": "string",
                "isRichText": boolean,
                "createdDate": "datetime"
            }
        ],
        "totalCount": number,
        "page": number,
        "totalPages": number
    }
}
```

### Delete Chatter Post
**DELETE** `/api/objects/chatter/:id`

Delete a Chatter Feed post.

Parameters:
- `id`: The ID of the Chatter Feed post to delete

Response:
```json
{
    "success": true,
    "message": "Chatter post deleted successfully"
}
```

## Lead Conversion Endpoint

### Convert Lead
**POST** `/api/objects/lead/:id/convert`

Convert a Lead to Account, Contact, and Opportunity.

Parameters:
- `id`: The ID of the Lead to convert

Request Body:
```json
{
    "convertedStatus": "string",           // Required: The status to set the lead to after conversion
    "accountId": "string",                 // Optional: ID of existing account to use
    "contactId": "string",                 // Optional: ID of existing contact to use
    "opportunityName": "string",           // Optional: Name for the new opportunity
    "overwriteLeadSource": boolean,        // Optional: Whether to overwrite the lead source
    "createOpportunity": boolean,          // Optional: Whether to create an opportunity
    "sendNotificationEmail": boolean       // Optional: Whether to send notification email
}
```

Response:
```json
{
    "success": true,
    "data": {
        "accountId": "string",
        "contactId": "string",
        "leadId": "string",
        "opportunityId": "string"
    }
}
```

Error Responses:
- `400 Bad Request`: Invalid input parameters
- `401 Unauthorized`: Invalid or missing authentication token
- `404 Not Found`: Lead or related record not found
- `500 Internal Server Error`: Server-side error

## Object Update Endpoint

### Update Object
**PUT** `/api/objects/:id`

Update an existing Salesforce object.

Parameters:
- `id`: The ID of the object to update

Request Body:
```json
{
    "objectType": "string",      // Required: Type of object (Account, Contact, Lead, etc.)
    "data": {                    // Required: Object containing fields to update
        "field1": "value1",
        "field2": "value2"
        // ... any valid fields for the object type
    }
}
```

Response:
```json
{
    "success": true,
    "data": {
        "id": "string",
        "type": "string",
        "salesforce_id": "string",
        "sync_status": "string",
        "updatedAt": "datetime",
        // ... updated object data
    }
}
```

Error Responses:
- `400 Bad Request`: Invalid input parameters or object type
- `401 Unauthorized`: Invalid or missing authentication token
- `404 Not Found`: Object not found
- `500 Internal Server Error`: Server-side error

## Object Retrieval Endpoints

### Get Objects by Type
**GET** `/api/objects`

Retrieve all objects of a specific type from Salesforce.

Query Parameters:
- `objectType` (required): Type of object to retrieve (Account, Contact, Lead, etc.)
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 10)
- `sort` (optional): Field to sort by (default: 'createdAt')
- `order` (optional): Sort order ('asc' or 'desc', default: 'desc')
- `filter` (optional): JSON string containing filter criteria

Example Request:
```
GET /api/objects?objectType=Lead&page=1&limit=20&sort=createdAt&order=desc
```

Response:
```json
{
    "success": true,
    "data": {
        "items": [
            {
                "id": "string",
                "salesforce_id": "string",
                "type": "string",
                "sync_status": "string",
                "data": {
                    // Object specific fields based on type
                    "field1": "value1",
                    "field2": "value2"
                },
                "createdAt": "datetime",
                "updatedAt": "datetime"
            }
        ],
        "pagination": {
            "totalItems": number,
            "currentPage": number,
            "totalPages": number,
            "limit": number
        }
    }
}
```

Example with Filters:
```
GET /api/objects?objectType=Account&filter={"Industry":"Technology","Type":"Customer"}
```

Response with Filtered Results:
```json
{
    "success": true,
    "data": {
        "items": [
            {
                "id": "string",
                "salesforce_id": "string",
                "type": "Account",
                "sync_status": "string",
                "data": {
                    "Name": "Tech Corp",
                    "Industry": "Technology",
                    "Type": "Customer"
                    // ... other Account fields
                },
                "createdAt": "datetime",
                "updatedAt": "datetime"
            }
        ],
        "pagination": {
            "totalItems": number,
            "currentPage": number,
            "totalPages": number,
            "limit": number
        }
    }
}
```

Error Responses:
- `400 Bad Request`: Missing or invalid objectType parameter
- `401 Unauthorized`: Invalid or missing authentication token
- `500 Internal Server Error`: Server-side error 