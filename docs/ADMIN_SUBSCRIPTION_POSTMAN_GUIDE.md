# Admin Subscription API - Postman Setup Guide

## Quick Import

1. Download the collection file: `docs/Admin_Subscription_API.postman_collection.json`
2. Open Postman
3. Click "Import" → "Upload Files" → Select the downloaded JSON file
4. The collection will be imported with all endpoints and environment variables

## Collection Structure

### 📁 Authentication
- **Admin Login**: Get admin JWT token for API access

### 📁 Create Subscription
- **Create New Subscription**: Create subscription with basic parameters
- **Create Subscription with Trial**: Create subscription with trial period

### 📁 Get Subscriptions
- **Get All Subscriptions**: Retrieve all subscriptions with pagination
- **Get Subscriptions with Filters**: Advanced filtering and sorting
- **Get Subscription by User ID**: Get specific user's subscription details

### 📁 Update Subscription
- **Update Subscription Details**: Modify subscription parameters
- **Change Subscription Plan**: Update user's plan

### 📁 Subscription Actions
- **Cancel Subscription**: Cancel with optional immediate effect
- **Reactivate Subscription**: Restore cancelled subscriptions
- **Extend Subscription**: Add days to subscription period

### 📁 Quota Management
- **Update User Quota**: Modify voice/meeting limits
- **Reset User Usage**: Reset usage counters
- **Add Bonus Quota**: Grant additional quota

### 📁 Analytics & Reports
- **Get Subscription Statistics**: Comprehensive analytics
- **Get Expiring Subscriptions**: Find subscriptions expiring soon

### 📁 Helper Endpoints
- **Get All Users**: Retrieve user IDs for testing
- **Get All Plans**: Retrieve plan IDs for testing

### 📁 Error Testing
- Various endpoints to test error handling scenarios

## Environment Variables

| Variable | Description | Auto-Set |
|----------|-------------|----------|
| `base_url` | API base URL (http://localhost:3002) | ✅ |
| `admin_token` | Admin JWT token | ✅ (from login) |
| `user_id` | User ID for testing | ✅ (from user list) |
| `plan_id` | Plan ID for testing | ✅ (from plan list) |

## Testing Workflow

### 1. Start Your Server
```bash
npm start
# or
node server.js
```

### 2. Admin Authentication
1. Run **Authentication → Admin Login**
2. The admin token will be automatically saved to `{{admin_token}}`
3. Verify token is set in environment variables

### 3. Get Required IDs
1. Run **Helper Endpoints → Get All Users** to populate `{{user_id}}`
2. Run **Helper Endpoints → Get All Plans** to populate `{{plan_id}}`
3. Check environment variables are populated

### 4. Test Subscription Creation
1. Run **Create Subscription → Create New Subscription**
2. Try **Create Subscription → Create Subscription with Trial**
3. Verify responses and check database

### 5. Test Subscription Management
1. **Get Subscriptions → Get All Subscriptions**
2. **Get Subscriptions → Get Subscription by User ID**
3. **Update Subscription → Update Subscription Details**

### 6. Test Subscription Actions
1. **Subscription Actions → Cancel Subscription**
2. **Subscription Actions → Reactivate Subscription**
3. **Subscription Actions → Extend Subscription**

### 7. Test Quota Management
1. **Quota Management → Update User Quota**
2. **Quota Management → Reset User Usage**
3. **Quota Management → Add Bonus Quota**

### 8. Test Analytics
1. **Analytics & Reports → Get Subscription Statistics**
2. **Analytics & Reports → Get Expiring Subscriptions**

### 9. Error Testing
1. Run all requests in **Error Testing** folder
2. Verify proper error responses

## Manual Configuration

If auto-configuration fails, manually set these variables:

### Environment Variables Setup
1. Click the eye icon (👁️) next to environment name
2. Add/edit variables:
   - `base_url`: `http://localhost:3002`
   - `admin_token`: (get from login response)
   - `user_id`: (get from user list)
   - `plan_id`: (get from plan list)

### Getting Admin Token Manually
```json
POST {{base_url}}/api/admin/auth/login
{
  "email": "admin@huscribe.com",
  "password": "Admin123!"
}
```
Copy the `token` from response to `{{admin_token}}`

### Getting User ID Manually
```json
GET {{base_url}}/api/users/getUsers
Authorization: Bearer {{admin_token}}
```
Copy any user's `_id` to `{{user_id}}`

### Getting Plan ID Manually
```json
GET {{base_url}}/api/plans
Authorization: Bearer {{admin_token}}
```
Copy any plan's `_id` to `{{plan_id}}`

## Expected Responses

### Successful Subscription Creation
```json
{
  "success": true,
  "message": "Subscription created successfully",
  "data": {
    "subscription": {
      "userId": "64a7b8c9d1e2f3a4b5c6d7e8",
      "currentPlan": "64a7b8c9d1e2f3a4b5c6d7e9",
      "subscriptionStatus": "active",
      "subscriptionEndsAt": "2024-12-31T23:59:59.000Z",
      "additionalVoices": 10,
      "additionalMeetings": 5
    }
  }
}
```

### Subscription Statistics
```json
{
  "success": true,
  "data": {
    "subscriptionStats": {
      "total": 150,
      "active": 120,
      "cancelled": 20,
      "expired": 10
    },
    "trialStats": {
      "total": 45,
      "active": 30,
      "expired": 15
    },
    "planDistribution": [
      {
        "_id": "Basic",
        "count": 80,
        "percentage": 53.33
      }
    ]
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "User ID and Plan ID are required",
  "statusCode": 400
}
```

### Authentication Error
```json
{
  "success": false,
  "message": "Access denied. Admin token required.",
  "statusCode": 401
}
```

## Troubleshooting

### Token Issues
- **Problem**: 401 Unauthorized errors
- **Solution**: Re-run admin login and check token is saved
- **Check**: Environment variables tab for `admin_token`

### User/Plan ID Issues
- **Problem**: "User not found" or "Plan not found" errors
- **Solution**: Run helper endpoints to get valid IDs
- **Check**: Verify IDs exist in database

### Server Connection Issues
- **Problem**: Connection refused errors
- **Solution**: Ensure server is running on port 3002
- **Check**: `npm start` or `node server.js`

### Environment Variable Issues
- **Problem**: Variables not auto-setting
- **Solution**: Manually set variables in environment
- **Check**: Scripts in collection's "Tests" tab

### Database Issues
- **Problem**: MongoDB connection errors
- **Solution**: Check MongoDB connection and environment variables
- **Check**: Server logs for database connection status

## Testing Checklist

### Pre-Testing
- [ ] Server is running
- [ ] MongoDB is connected
- [ ] Admin user exists in database
- [ ] At least one plan exists in database
- [ ] At least one regular user exists

### Authentication
- [ ] Admin login successful
- [ ] Token auto-saved to environment
- [ ] Token works for protected endpoints

### CRUD Operations
- [ ] Create subscription works
- [ ] Get all subscriptions works
- [ ] Get subscription by user ID works
- [ ] Update subscription works

### Subscription Actions
- [ ] Cancel subscription works
- [ ] Reactivate subscription works
- [ ] Extend subscription works

### Quota Management
- [ ] Update quota works
- [ ] Reset usage works
- [ ] Add bonus quota works

### Analytics
- [ ] Statistics endpoint works
- [ ] Expiring subscriptions endpoint works

### Error Handling
- [ ] Missing fields return 400
- [ ] Invalid IDs return 404
- [ ] Unauthorized access returns 401
- [ ] Server errors return 500

## Security Notes

⚠️ **Important Security Considerations:**

1. **Admin Access**: Only use admin credentials in development
2. **Token Security**: Admin tokens have full system access
3. **Data Modification**: Subscription changes affect billing
4. **User Privacy**: Handle user data according to privacy policies
5. **Testing Environment**: Use test data only

## API Rate Limits

- No rate limits in development
- Production may have rate limiting
- Monitor response times for performance

## Related Endpoints

- User Management: `/api/users/*`
- Plan Management: `/api/plans/*`
- Payment Processing: `/api/payments/*`
- Admin Dashboard: `/api/admin/dashboard/*`

## Support

If you encounter issues:

1. Check server logs for detailed error messages
2. Verify database connection and data integrity
3. Ensure all required environment variables are set
4. Test with minimal data first
5. Check API documentation for required fields

For additional help, refer to:
- `docs/ADMIN_SUBSCRIPTION_API.md` - Complete API documentation
- Server logs for debugging information
- Database directly for data verification

---

**Last Updated**: January 2024  
**API Version**: 1.0  
**Postman Collection Version**: 1.0 