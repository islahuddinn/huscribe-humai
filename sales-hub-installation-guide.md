# Sales Hub Installation Guide - Dependency Resolution

## 🚨 Error: Missing Dependencies for Sales Hub Installation

**Error Code**: -2147188685  
**Issue**: Sales Hub requires foundational sales entities that are missing from your environment.

## 📋 Required Installation Order

### Step 1: Install Core Sales Foundation
**Go to Power Platform Admin Center → Environments → [Your Environment] → Dynamics 365 apps**

Install these solutions **IN ORDER**:

1. **Dynamics 365 Sales, Enterprise Edition** (Base)
   - This provides: salesorder, invoice, quote entities
   - Wait for installation to complete (15-30 minutes)

2. **Dynamics 365 Product Management** 
   - This provides: productsubstitute, productpricelevel entities
   - Wait for installation to complete (10-15 minutes)

3. **Dynamics 365 Sales Hub** (Final)
   - This is the UI and advanced features
   - Should install without dependency errors

### Step 2: Verify Installation
After each step, verify entities are available:

```bash
# Test with your diagnostic script
node diagnose-user-access.js
```

## 🔧 Alternative Solutions

### Option A: Use Different Environment
If you have multiple environments, try installing in a fresh environment:

1. Power Platform Admin Center → Environments
2. Create new environment with "Enable Dynamics 365 apps" checked
3. Install Sales solutions in the new environment
4. Update your .env to point to new environment

### Option B: Environment Reset (Last Resort)
If dependencies are corrupted:

1. Power Platform Admin Center → Environments → [Environment] → Settings
2. Consider environment reset (⚠️ **WARNING**: This deletes all data)
3. Reinstall solutions in correct order

## 📊 Environment Types and Sales Support

| Environment Type | Sales Hub Support | Required Actions |
|------------------|-------------------|------------------|
| **Default** | ❌ Limited | Install Sales foundation first |
| **Sales** | ✅ Full | Should work out of box |
| **Custom** | ⚠️ Depends | Check existing solutions |

## 🧪 Testing After Installation

### Test 1: Check Entity Availability
```javascript
// Update token in diagnose-user-access.js and run:
node diagnose-user-access.js
```

### Test 2: Manual Entity Test
```bash
# Test specific entities after installation
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5001/api/dynamic/environment/check-entity/salesorder"

curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5001/api/dynamic/environment/check-entity/invoice"
```

### Test 3: Sales Object Creation
```bash
# Test lead creation
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Test Lead","firstname":"John","lastname":"Doe"}' \
  "http://localhost:5001/api/dynamic/entity/lead"
```

## 🎯 Expected Results After Fix

Your diagnostic script should show:
- ✅ **Sales Hub Access**: YES
- ✅ **Overall Status**: FULL_SALES_ACCESS
- ✅ **Available Sales Entities**: 6/6 (100%)
- ✅ **Sales Environment Score**: 100%

## 🆘 If Installation Still Fails

### Contact Microsoft Support
- **Correlation ID**: `1f37c221-2900-4e9a-847a-565cd34a5cc1`
- **Error Code**: `-2147188685`
- **Issue**: Dependency resolution failure during Sales Hub installation

### Provide These Details:
1. Environment ID and region
2. Existing installed solutions
3. User license types
4. Installation sequence attempted

## 📞 Next Steps

1. **Try Option A first** (install prerequisites)
2. **Test with diagnostic script** after each installation
3. **Contact support** if dependency errors persist
4. **Consider new environment** if current one is corrupted

## 🔗 Useful Links

- [Power Platform Admin Center](https://admin.powerplatform.microsoft.com/)
- [Dynamics 365 Licensing Guide](https://docs.microsoft.com/dynamics365/licensing/)
- [Solution Dependencies Documentation](https://docs.microsoft.com/power-platform/admin/solution-concepts-alm) 