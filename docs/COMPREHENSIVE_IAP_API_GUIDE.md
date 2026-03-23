# Comprehensive A-Z IAP API Documentation

## Table of Contents
- [Authentication](#authentication)
- [Base URLs & Headers](#base-urls--headers)
- [Create Subscription](#create-subscription)
- [Cancel Subscription](#cancel-subscription)
- [Get Subscription Details](#get-subscription-details)
- [Get Mobile Plans](#get-mobile-plans)
- [Restore Purchases (iOS)](#restore-purchases-ios)
- [Usage Tracking](#usage-tracking)
- [Error Handling](#error-handling)
- [Platform-Specific Examples](#platform-specific-examples)
- [Testing Guide](#testing-guide)
- [Troubleshooting](#troubleshooting)

---

## Authentication

All API endpoints require JWT authentication via Bearer token.

### Get Authentication Token
```http
POST /api/users/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "userpassword"
}
```

**Response:**
```json
{
  "status": "ok",
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "user_id",
      "email": "user@example.com",
      "name": "User Name"
    }
  }
}
```

---

## Base URLs & Headers

### Base URL
```
Production: https://api.huscribe.com
Development: http://localhost:5000
```

### Required Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## Create Subscription

### Endpoint
```http
POST /api/payments/create-subscription
```

### Universal Request Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `planId` | String | ✅ | MongoDB ObjectId of the subscription plan |
| `paymentType` | String | ✅ | Payment method: `stripe`, `apple_iap`, `google_play` |

### Platform-Specific Parameters

#### Stripe (Web)
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `paymentMethodId` | String | ✅ | Stripe payment method ID |
| `couponCode` | String | ❌ | Optional coupon code |

#### Apple IAP (iOS)
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `receiptData` | String | ✅ | Base64 encoded receipt data |
| `transactionId` | String | ✅ | Apple transaction identifier |

#### Google Play (Android)
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `purchaseToken` | String | ✅ | Google Play purchase token |
| `orderId` | String | ✅ | Google Play order identifier |

### Examples

#### Stripe Subscription
```http
POST /api/payments/create-subscription
Authorization: Bearer <token>
Content-Type: application/json

{
  "planId": "64f8a1b2c3d4e5f6a7b8c9d0",
  "paymentType": "stripe",
  "paymentMethodId": "pm_1234567890abcdef",
  "couponCode": "SAVE20"
}
```

#### Apple IAP Subscription
```http
POST /api/payments/create-subscription
Authorization: Bearer <token>
Content-Type: application/json

{
  "planId": "64f8a1b2c3d4e5f6a7b8c9d0",
  "paymentType": "apple_iap",
  "receiptData": "ewoJInNpZ25hdHVyZSIgPSAiQW...",
  "transactionId": "1000000123456789"
}
```

#### Google Play Subscription
```http
POST /api/payments/create-subscription
Authorization: Bearer <token>
Content-Type: application/json

{
  "planId": "64f8a1b2c3d4e5f6a7b8c9d0",
  "paymentType": "google_play",
  "purchaseToken": "abcdefghijklmnopqrstuvwxyz.AO-J1OzX...",
  "orderId": "GPA.1234-5678-9012-34567"
}
```

### Success Response
```json
{
  "status": "ok",
  "message": "Subscription activated successfully",
  "data": {
    "subscriptionId": "sub_1234567890",
    "status": "active",
    "plan": "BASIC",
    "subscriptionEndsAt": "2024-02-15T10:30:00.000Z",
    "remainingVoices": 25,
    "remainingMeetings": 8,
    "appliedCoupon": {
      "code": "SAVE20",
      "discountPercentage": 20
    },
    "clientSecret": "pi_1234567890_secret_abc123" // Stripe only
  }
}
```

### Error Responses
```json
// Invalid receipt/token
{
  "status": "error",
  "message": "Invalid Apple receipt",
  "details": "Receipt validation failed"
}

// Duplicate transaction
{
  "status": "error",
  "message": "Transaction already processed"
}

// Plan not available for platform
{
  "status": "error",
  "message": "This plan is not available for iOS purchases"
}
```

---

## Cancel Subscription

### Endpoint
```http
POST /api/payments/cancel-subscription/:subscriptionId
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `subscriptionId` | String | ✅ | Subscription ID to cancel |

### Example
```http
POST /api/payments/cancel-subscription/sub_1234567890
Authorization: Bearer <token>
```

### Success Response
```json
{
  "message": "Subscription cancelled successfully. You can continue using your current plan until the end of the billing period.",
  "endsAt": "2024-02-15T10:30:00.000Z",
  "status": "cancelled",
  "canUseUntil": "2024-02-15T10:30:00.000Z",
  "remainingDays": 15
}
```

---

## Get Subscription Details

### Endpoint
```http
GET /api/payments/subscription/:userId?
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | String | ❌ | User ID (optional, defaults to authenticated user) |

### Example
```http
GET /api/payments/subscription
Authorization: Bearer <token>
```

### Success Response
```json
{
  "plan": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "name": "BASIC",
    "description": "Basic plan with essential features",
    "price": {
      "amount": 999,
      "currency": "usd"
    },
    "features": {
      "voicesPerMonth": 25,
      "meetingsPerMonth": 8
    }
  },
  "status": "active",
  "endsAt": "2024-02-15T10:30:00.000Z",
  "trialEndsAt": null,
  "usage": {
    "voicesUsed": 5,
    "meetingsUsed": 2,
    "lastResetDate": "2024-01-15T10:30:00.000Z"
  },
  "isEnding": false,
  "remainingDays": null,
  "subscriptionId": "sub_1234567890"
}
```

---

## Get Plans List

### Endpoint


### Examples
```http
# Get all plans, eith for web, android or IoS
GET /api/plans

### Success Response
```json
{
  "status": "ok",
  "message": "Plans retrieved successfully",
  "data": {
    "plans": [
      {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "name": "BASIC",
        "description": "Basic plan with essential features",
        "price": {
          "amount": 999,
          "currency": "usd"
        },
        "features": {
          "voicesPerMonth": 25,
          "meetingsPerMonth": 8
        },
        "appleProductId": "com.huscribe.basic.monthly",
        "googleProductId": "basic_monthly_subscription"
      },
      {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
        "name": "STANDARD",
        "description": "Standard plan with advanced features",
        "price": {
          "amount": 1999,
          "currency": "usd"
        },
        "features": {
          "voicesPerMonth": 100,
          "meetingsPerMonth": 25
        },
        "appleProductId": "com.huscribe.standard.monthly",
        "googleProductId": "standard_monthly_subscription"
      }
    ],
    "platform": "ios"
  }
}
```

---

## Restore Purchases (iOS)

### Endpoint
```http
POST /api/payments/restore-purchases
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `receiptData` | String | ✅ | Base64 encoded receipt data |

### Example
```http
POST /api/payments/restore-purchases
Authorization: Bearer <token>
Content-Type: application/json

{
  "receiptData": "ewoJInNpZ25hdHVyZSIgPSAiQW..."
}
```

### Success Response
```json
{
  "status": "ok",
  "message": "Purchases restored successfully",
  "data": {
    "hasActiveSubscription": true,
    "subscriptionEndsAt": 1640995200000
  }
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Invalid receipt",
  "details": "Apple validation failed with status: 21002"
}
```

---

## Usage Tracking

### Increment Voice Usage
```http
POST /api/payments/usage/voice
Authorization: Bearer <token>
```

### Increment Meeting Usage
```http
POST /api/payments/usage/meeting
Authorization: Bearer <token>
```

### Check Feature Access
```http
GET /api/payments/feature/:featureName
Authorization: Bearer <token>
```

### Examples
```http
# Track voice usage
POST /api/payments/usage/voice
Authorization: Bearer <token>

# Track meeting usage
POST /api/payments/usage/meeting
Authorization: Bearer <token>

# Check voice feature access
GET /api/payments/feature/voice
Authorization: Bearer <token>
```

### Success Responses
```json
// Usage increment
{
  "message": "Voice usage incremented successfully",
  "remainingVoices": 24,
  "totalUsed": 1
}

// Feature access check
{
  "hasAccess": true,
  "remaining": 24,
  "limit": 25,
  "resetDate": "2024-02-01T00:00:00.000Z"
}
```

---

## Error Handling

### HTTP Status Codes
| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created (subscription) |
| `400` | Bad Request |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not Found |
| `409` | Conflict (duplicate transaction) |
| `500` | Internal Server Error |

### Common Error Responses
```json
// Authentication error
{
  "status": "error",
  "message": "User authentication required"
}

// Validation error
{
  "status": "error",
  "message": "Receipt data and transaction ID are required for Apple IAP"
}

// Plan not found
{
  "status": "error",
  "message": "User or plan not found"
}

// Platform compatibility error
{
  "status": "error",
  "message": "This plan is not available for iOS purchases"
}

// Duplicate transaction
{
  "status": "error",
  "message": "Transaction already processed"
}

// Receipt validation error
{
  "status": "error",
  "message": "Invalid Apple receipt",
  "details": "Apple validation failed with status: 21002"
}
```

---

## Platform-Specific Examples

### Complete iOS Flow
```javascript
// 1. Get available plans
const plansResponse = await fetch('/api/payments/mobile-plans?platform=ios', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const plans = await plansResponse.json();

// 2. Make purchase through iOS IAP
// (This happens in your iOS app using StoreKit)

// 3. Validate purchase with backend
const subscriptionResponse = await fetch('/api/payments/create-subscription', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    planId: selectedPlan._id,
    paymentType: 'apple_iap',
    receiptData: base64ReceiptData,
    transactionId: appleTransactionId
  })
});

// 4. Handle response
const result = await subscriptionResponse.json();
if (result.status === 'ok') {
  console.log('Subscription activated:', result.data);
}
```

### Complete Android Flow
```javascript
// 1. Get available plans
const plansResponse = await fetch('/api/payments/mobile-plans?platform=android', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const plans = await plansResponse.json();

// 2. Make purchase through Google Play Billing
// (This happens in your Android app using Google Play Billing Library)

// 3. Validate purchase with backend
const subscriptionResponse = await fetch('/api/payments/create-subscription', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    planId: selectedPlan._id,
    paymentType: 'google_play',
    purchaseToken: googlePurchaseToken,
    orderId: googleOrderId
  })
});

// 4. Handle response
const result = await subscriptionResponse.json();
if (result.status === 'ok') {
  console.log('Subscription activated:', result.data);
}
```

### Complete Web Flow
```javascript
// 1. Get available plans
const plansResponse = await fetch('/api/payments/mobile-plans', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const plans = await plansResponse.json();

// 2. Create Stripe payment method
// (Using Stripe.js in your web app)

// 3. Create subscription
const subscriptionResponse = await fetch('/api/payments/create-subscription', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    planId: selectedPlan._id,
    paymentType: 'stripe',
    paymentMethodId: stripePaymentMethodId,
    couponCode: 'SAVE20' // optional
  })
});

// 4. Handle response and confirm payment if needed
const result = await subscriptionResponse.json();
if (result.data.clientSecret) {
  // Confirm payment with Stripe
  const { error } = await stripe.confirmCardPayment(result.data.clientSecret);
}
```

---

## Testing Guide

### Test Environment Setup
```bash
# Set environment variables for testing
export NODE_ENV=development
export APPLE_SHARED_SECRET=your_sandbox_shared_secret
export GOOGLE_SERVICE_ACCOUNT_KEY=your_test_service_account
```

### Apple Sandbox Testing
1. Create sandbox test accounts in App Store Connect
2. Use test devices with sandbox accounts signed in
3. Use sandbox receipt data for testing

```javascript
// Example sandbox receipt validation
const testReceipt = "ewoJInNpZ25hdHVyZSIgPSAiQW..."; // Sandbox receipt
const response = await fetch('/api/payments/create-subscription', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    planId: "test_plan_id",
    paymentType: 'apple_iap',
    receiptData: testReceipt,
    transactionId: "1000000123456789"
  })
});
```

### Google Play Testing
1. Upload app to internal testing track
2. Add test accounts to internal testing
3. Use test purchase tokens

```javascript
// Example test purchase validation
const testPurchaseToken = "abcdefghijklmnopqrstuvwxyz.AO-J1OzX...";
const response = await fetch('/api/payments/create-subscription', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    planId: "test_plan_id",
    paymentType: 'google_play',
    purchaseToken: testPurchaseToken,
    orderId: "GPA.1234-5678-9012-34567"
  })
});
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Apple Receipt Validation Fails
**Problem:** `Invalid Apple receipt` error
**Solutions:**
- Verify `APPLE_SHARED_SECRET` is correct
- Check receipt is base64 encoded
- Ensure using correct environment (sandbox vs production)
- Verify receipt is from your app's bundle ID

#### 2. Google Play Validation Fails
**Problem:** `Invalid Google Play purchase` error
**Solutions:**
- Check service account has proper permissions
- Verify `GOOGLE_PACKAGE_NAME` matches your app
- Ensure purchase token is valid and not expired
- Check service account key is properly formatted JSON

#### 3. Duplicate Transaction Error
**Problem:** `Transaction already processed` error
**Solutions:**
- Check if transaction was already processed
- Implement proper transaction ID tracking in your app
- Use unique transaction IDs for each purchase

#### 4. Plan Not Available Error
**Problem:** `This plan is not available for [platform] purchases`
**Solutions:**
- Verify plan has correct platform flags set
- Check plan has `appleProductId` or `googleProductId` set
- Ensure plan is active (`isActive: true`)

#### 5. Authentication Errors
**Problem:** `User authentication required` error
**Solutions:**
- Check JWT token is valid and not expired
- Verify `Authorization` header format: `Bearer <token>`
- Ensure user exists and is active

### Debug Mode
Enable debug logging by setting:
```bash
export DEBUG=true
export LOG_LEVEL=debug
```

### Health Check Endpoint
```http
GET /api/payments/health
```

Response:
```json
{
  "status": "ok",
  "services": {
    "stripe": "connected",
    "apple": "configured",
    "google": "configured",
    "database": "connected"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Rate Limits

| Endpoint | Rate Limit | Window |
|----------|------------|---------|
| `/api/payments/create-subscription` | 10 requests | 1 minute |
| `/api/payments/mobile-plans` | 100 requests | 1 minute |
| `/api/payments/restore-purchases` | 5 requests | 1 minute |
| All other endpoints | 60 requests | 1 minute |

---

## Webhooks

### Stripe Webhooks
```http
POST /api/payments/webhook
Content-Type: application/json
Stripe-Signature: t=1234567890,v1=signature
```

### Google Play Real-time Developer Notifications
Configure in Google Play Console to receive subscription status updates.

---

## SDK Examples

### iOS (Swift)
```swift
// Example iOS integration
import StoreKit

func purchaseSubscription(productId: String) {
    // 1. Get product from App Store
    // 2. Make purchase
    // 3. Validate with backend
    
    let receiptURL = Bundle.main.appStoreReceiptURL
    let receiptData = try? Data(contentsOf: receiptURL!)
    let base64Receipt = receiptData?.base64EncodedString()
    
    // Send to backend
    validatePurchase(receiptData: base64Receipt, transactionId: transaction.transactionIdentifier)
}
```

### Android (Kotlin)
```kotlin
// Example Android integration
private fun purchaseSubscription(productId: String) {
    // 1. Connect to Google Play Billing
    // 2. Make purchase
    // 3. Validate with backend
    
    billingClient.launchBillingFlow(activity, billingFlowParams)
}

private fun handlePurchase(purchase: Purchase) {
    // Validate with backend
    validatePurchase(purchase.purchaseToken, purchase.orderId)
}
```

---

This comprehensive guide covers all aspects of the IAP API implementation. For additional support, refer to the platform-specific setup guides and troubleshooting sections. 