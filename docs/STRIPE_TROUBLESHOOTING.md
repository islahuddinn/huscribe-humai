# Stripe Customer Troubleshooting Guide

## Common Issues and Solutions

### 1. "No such customer" Error

**Error Message**: `No such customer: 'cus_XXXXXXXXXX'`

**Cause**: This error occurs when:
- The customer was deleted from Stripe
- You're using a different Stripe environment (test vs live)
- The customer was created in a different Stripe account

**Solution**:

#### Automatic Fix (Recommended)
Run the cleanup script to automatically identify and fix all invalid customer IDs:

```bash
npm run stripe:cleanup
# or
node scripts/cleanupStripeCustomers.js
```

#### Manual Fix
1. **Identify the affected user**:
   ```bash
   # Check the error logs to find the customer ID
   # Example: cus_S6VZ3Zuzce1flI
   ```

2. **Clean the user's Stripe data**:
   ```javascript
   // In MongoDB shell or script
   db.users.updateOne(
     { stripeCustomerId: "cus_S6VZ3Zuzce1flI" },
     {
       $set: {
         stripeCustomerId: null,
         stripeSubscriptionId: null,
         subscriptionStatus: "inactive",
         subscriptionEndsAt: null
       }
     }
   )
   ```

### 2. Subscription Creation Failures

**Improved Error Handling**: The payment controller now automatically handles invalid customer IDs by:
1. Validating existing customer IDs before use
2. Creating new customers if the existing ID is invalid
3. Logging the issue for monitoring

### 3. Prevention Measures

#### Environment Consistency
Ensure you're using the correct Stripe keys for your environment:

```env
# .env file
STRIPE_SECRET_KEY=sk_test_... # for test environment
# or
STRIPE_SECRET_KEY=sk_live_... # for production environment
```

#### Regular Cleanup
Run the cleanup script periodically:

```bash
# Add to your deployment script or run monthly
npm run stripe:cleanup
```

## Scripts Available

### 1. Stripe Customer Cleanup
```bash
npm run stripe:cleanup
```
- Identifies users with invalid Stripe customer IDs
- Automatically cleans up invalid references
- Provides detailed reporting

### 2. Admin Creation
```bash
npm run admin:create
```
- Creates admin users for system management

## Monitoring and Logging

### Error Patterns to Watch
1. `StripeInvalidRequestError: No such customer`
2. `resource_missing` error codes
3. Subscription creation failures

### Log Analysis
Check your application logs for:
```
Invalid customer ID cus_XXXXXXXXXX for user email@example.com, creating new customer
```

## Best Practices

### 1. Customer ID Validation
Always validate customer IDs before using them in Stripe operations:

```javascript
try {
  await stripe.customers.retrieve(customerId);
} catch (error) {
  if (error.code === 'resource_missing') {
    // Handle invalid customer ID
    // Create new customer or clean up data
  }
}
```

### 2. Error Handling
Implement robust error handling for Stripe operations:

```javascript
try {
  const subscription = await stripe.subscriptions.create(data);
} catch (error) {
  console.error('Stripe error:', error.code, error.message);
  // Handle specific error types
}
```

### 3. Data Consistency
Regularly audit your database for:
- Orphaned Stripe customer IDs
- Inconsistent subscription statuses
- Missing payment records

## Recovery Procedures

### If Multiple Users Are Affected
1. **Run the cleanup script**:
   ```bash
   npm run stripe:cleanup
   ```

2. **Check the results**:
   - Review the cleanup summary
   - Verify affected users can create new subscriptions

3. **Monitor for 24-48 hours**:
   - Watch for similar errors
   - Ensure subscription creation works normally

### If the Issue Persists
1. **Check Stripe Dashboard**:
   - Verify you're in the correct environment
   - Check for any account-level issues

2. **Review Environment Variables**:
   - Ensure correct Stripe keys are being used
   - Verify webhook endpoints if applicable

3. **Contact Support**:
   - Provide error logs
   - Include customer IDs that are failing
   - Mention cleanup steps already taken

## Quick Reference

| Issue | Command | Description |
|-------|---------|-------------|
| Invalid customer IDs | `npm run stripe:cleanup` | Clean all invalid customer references |
| Create admin user | `npm run admin:create` | Create system admin for management |
| Check logs | Check application logs | Look for Stripe error patterns |

## Environment Variables Required

```env
STRIPE_SECRET_KEY=sk_test_... # or sk_live_...
MONGO_URI=mongodb://...
```

## Support

If you continue to experience issues after following this guide:
1. Run the cleanup script
2. Check the troubleshooting steps
3. Review the error logs
4. Contact the development team with specific error details 