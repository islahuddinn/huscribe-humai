# 🚀 Huscribe CRM Complete Setup Guide

## ✅ Current Status
- ✅ Corteza running on port 18080
- ✅ Huscribe server running on port 5001
- ✅ CRM provisioning API ready
- ✅ MongoDB connected
- ⚠️ Corteza web interface needs initial setup

## 📋 Environment Variables (Already Added)
```env
CORTEZA_BASE_URL=http://localhost:18080
CORTEZA_CLIENT_ID=449250236440576001
CORTEZA_CLIENT_SECRET=my_ultra_secure_secret_a_quick_brown_fox
CORTEZA_ADMIN_EMAIL=admin@huscribe.com
CORTEZA_ADMIN_PASSWORD=admin123
CRM_BASE_URL=http://localhost:18080
```

## 🐳 Docker Commands

### Start Everything
```bash
cd corteza-setup
docker-compose up -d
```

### Check Status
```bash
docker-compose ps
```

### View Logs
```bash
docker-compose logs corteza-server  
docker-compose logs corteza-postgres
docker-compose logs corteza-redis
```

### Stop Everything
```bash
docker-compose down
```

### Restart (if needed)
```bash
docker-compose down
docker-compose up -d
```

## 🌐 Access URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Corteza Web** | http://loca lhost:18080 | Main Corteza interface |
| **Corteza Auth** | http://localhost:18080/auth | Login page |
| **Huscribe API** | http://localhost:5001 | Your backend server |
| **CRM Status** | http://localhost:5001/api/crm/system/status | CRM system health |

## 🔧 Initial Corteza Setup

### Option 1: Web Interface Setup
1. Open browser: http://localhost:18080
2. If you see a setup wizard, follow it
3. Create admin user:
   - Email: `admin@huscribe.com`
   - Password: `admin123`

### Option 2: Manual Setup (if web interface shows 404)
The 404 on Corteza web interface is normal for fresh installations. You can:

1. **Try the auth endpoint**: http://localhost:18080/auth
2. **Use the API directly** through Postman (see below)
3. **Corteza will auto-configure** when you make your first API call

## 📡 Testing with Postman

### 1. Import Collection
- Import the file: `Huscribe-CRM-Postman-Collection.json`
- Set environment variables:
  - `base_url`: `http://localhost:5001`
  - `corteza_url`: `http://localhost:18080`

### 2. Test Sequence

#### Step 1: Check System Health
```
GET http://localhost:5001/api/crm/system/status
```
**Expected**: 401 Unauthorized (endpoint exists, needs auth)

#### Step 2: Create User Account
```
POST http://localhost:5001/api/auth/signup
{
  "email": "test@huscribe.com",
  "password": "password123",
  "name": "Test User",
  "companyName": "Test Company"
}
```

#### Step 3: Login
```
POST http://localhost:5001/api/auth/login
{
  "email": "test@huscribe.com",
  "password": "password123"
}
```
**Copy the JWT token** from response and add to Authorization header

#### Step 4: Provision CRM Tenant
```
POST http://localhost:5001/api/crm/provision
Authorization: Bearer YOUR_JWT_TOKEN
{
  "companyName": "Test Company CRM",
  "slug": "test-company-crm",
  "plan": "startup",
  "infrastructure": "shared"
}
```

#### Step 5: Check Tenant Status
```
GET http://localhost:5001/api/crm/tenant/TENANT_ID/status
Authorization: Bearer YOUR_JWT_TOKEN
```

## 🔍 Troubleshooting

### Corteza 404 Error
This is **normal** for fresh installations. The CRM system will work through API calls even if the web interface shows 404.

### Docker Issues
```bash
# Check container status
docker-compose ps

# Restart if needed
docker-compose down && docker-compose up -d

# Check logs for errors
docker-compose logs corteza-server
```

### Server Issues
```bash
# Check if server is running
curl http://localhost:5001/

# Restart server
node server.js
```

## 🎯 Quick Test Commands

### Test Corteza Health
```bash
curl http://localhost:18080/version
```

### Test Huscribe Server
```bash
curl http://localhost:5001/
```

### Test CRM Endpoint (should return 401)
```bash
curl http://localhost:5001/api/crm/system/status
```

## 📊 Expected Results

✅ **Working Setup Indicators:**
- Corteza containers running (healthy)
- Huscribe server responds on port 5001
- CRM endpoints return 401 (unauthorized) - this means they exist
- MongoDB connection successful

⚠️ **Normal Issues:**
- Corteza web interface 404 (normal for fresh install)
- CRM endpoints requiring authentication

❌ **Real Problems:**
- Containers not starting
- Server not responding
- Database connection errors

## 🚀 Next Steps After Setup

1. **Test API with Postman** using the provided collection
2. **Create your first CRM tenant** through the API
3. **Access tenant data** through Corteza API
4. **Build your frontend** using the CRM SDK

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Run the test script: `node test-complete-setup.js`
3. Check Docker logs: `docker-compose logs`

---

**🎉 Your CRM system is ready for testing!** 