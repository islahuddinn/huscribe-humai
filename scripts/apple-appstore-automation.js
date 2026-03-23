import jwt from 'jsonwebtoken';
import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

class AppleAppStoreAutomation {
    constructor() {
        this.keyId = process.env.APPLE_KEY_ID;
        this.issuerId = process.env.APPLE_ISSUER_ID;
        this.privateKeyPath = process.env.APPLE_PRIVATE_KEY_PATH;
        this.bundleId = process.env.APPLE_BUNDLE_ID;
        this.baseUrl = 'https://api.appstoreconnect.apple.com/v1';
        this.token = null;
        this.tokenExpiry = null;
    }

    generateToken() {
        try {
            const privateKey = fs.readFileSync(this.privateKeyPath, 'utf8');
            const now = Math.floor(Date.now() / 1000);
            
            const payload = {
                iss: this.issuerId,
                exp: now + 1200, // 20 minutes
                aud: 'appstoreconnect-v1',
                iat: now
            };

            const header = {
                alg: 'ES256',
                kid: this.keyId,
                typ: 'JWT'
            };

            this.token = jwt.sign(payload, privateKey, { 
                algorithm: 'ES256',
                header: header
            });
            
            this.tokenExpiry = now + 1200;
            console.log('✅ Apple App Store Connect token generated');
            
        } catch (error) {
            console.error('❌ Failed to generate Apple token:', error.message);
            throw error;
        }
    }

    getAuthHeaders() {
        const now = Math.floor(Date.now() / 1000);
        
        if (!this.token || now >= this.tokenExpiry - 60) {
            this.generateToken();
        }

        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    async getApp() {
        try {
            const response = await axios.get(`${this.baseUrl}/apps`, {
                headers: this.getAuthHeaders(),
                params: {
                    'filter[bundleId]': this.bundleId
                }
            });

            const apps = response.data.data;
            if (apps.length === 0) {
                throw new Error(`No app found with bundle ID: ${this.bundleId}`);
            }

            console.log(`✅ Found app: ${apps[0].attributes.name} (${apps[0].id})`);
            return apps[0];

        } catch (error) {
            console.error('❌ Failed to get app:', error.response?.data || error.message);
            throw error;
        }
    }

    async createInAppPurchase(appId, productConfig) {
        try {
            const { productId, name, description, price } = productConfig;

            const requestBody = {
                data: {
                    type: 'inAppPurchases',
                    attributes: {
                        productId: productId,
                        inAppPurchaseType: 'AUTO_RENEWABLE_SUBSCRIPTION',
                        name: name,
                        reviewNotes: `Subscription product for ${name}`
                    },
                    relationships: {
                        app: {
                            data: {
                                type: 'apps',
                                id: appId
                            }
                        }
                    }
                }
            };

            const response = await axios.post(
                `${this.baseUrl}/inAppPurchases`,
                requestBody,
                { headers: this.getAuthHeaders() }
            );

            console.log(`✅ Created in-app purchase: ${productId}`);
            
            // Create subscription price point
            await this.createSubscriptionPricePoint(response.data.data.id, price);
            
            return response.data.data;

        } catch (error) {
            console.error(`❌ Failed to create in-app purchase ${productConfig.productId}:`, 
                error.response?.data || error.message);
            throw error;
        }
    }

    async createSubscriptionPricePoint(inAppPurchaseId, price) {
        try {
            const requestBody = {
                data: {
                    type: 'subscriptionPricePoints',
                    attributes: {
                        customerPrice: price.toString(),
                        proceeds: (price * 0.7).toString() // Apple takes 30%
                    },
                    relationships: {
                        subscription: {
                            data: {
                                type: 'inAppPurchases',
                                id: inAppPurchaseId
                            }
                        },
                        territory: {
                            data: {
                                type: 'territories',
                                id: 'USA' // Default to USA
                            }
                        }
                    }
                }
            };

            const response = await axios.post(
                `${this.baseUrl}/subscriptionPricePoints`,
                requestBody,
                { headers: this.getAuthHeaders() }
            );

            console.log(`✅ Created price point for subscription: $${price}`);
            return response.data.data;

        } catch (error) {
            console.error('❌ Failed to create subscription price point:', 
                error.response?.data || error.message);
            throw error;
        }
    }

    async createSubscriptionGroup(appId, groupName) {
        try {
            const requestBody = {
                data: {
                    type: 'subscriptionGroups',
                    attributes: {
                        referenceName: groupName
                    },
                    relationships: {
                        app: {
                            data: {
                                type: 'apps',
                                id: appId
                            }
                        }
                    }
                }
            };

            const response = await axios.post(
                `${this.baseUrl}/subscriptionGroups`,
                requestBody,
                { headers: this.getAuthHeaders() }
            );

            console.log(`✅ Created subscription group: ${groupName}`);
            return response.data.data;

        } catch (error) {
            console.error(`❌ Failed to create subscription group ${groupName}:`, 
                error.response?.data || error.message);
            throw error;
        }
    }

    async listInAppPurchases(appId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/apps/${appId}/inAppPurchases`,
                { headers: this.getAuthHeaders() }
            );

            console.log('📋 Current in-app purchases:');
            response.data.data.forEach(iap => {
                console.log(`  - ${iap.attributes.productId}: ${iap.attributes.name} (${iap.attributes.inAppPurchaseType})`);
            });

            return response.data.data;

        } catch (error) {
            console.error('❌ Failed to list in-app purchases:', 
                error.response?.data || error.message);
            throw error;
        }
    }

    async deleteInAppPurchase(inAppPurchaseId) {
        try {
            await axios.delete(
                `${this.baseUrl}/inAppPurchases/${inAppPurchaseId}`,
                { headers: this.getAuthHeaders() }
            );

            console.log(`✅ Deleted in-app purchase: ${inAppPurchaseId}`);

        } catch (error) {
            console.error(`❌ Failed to delete in-app purchase ${inAppPurchaseId}:`, 
                error.response?.data || error.message);
            throw error;
        }
    }

    async batchCreateProducts(products) {
        console.log(`🚀 Creating ${products.length} in-app purchases...`);
        
        const app = await this.getApp();
        const results = [];

        for (const product of products) {
            try {
                const result = await this.createInAppPurchase(app.id, product);
                results.push({ success: true, productId: product.productId, data: result });
            } catch (error) {
                results.push({ 
                    success: false, 
                    productId: product.productId, 
                    error: error.response?.data?.errors?.[0]?.detail || error.message 
                });
            }
        }

        return results;
    }
}

// Default product configurations for Huscribe plans
const defaultProducts = [
    {
        productId: 'huscribe_basic_monthly',
        name: 'Huscribe Basic Plan',
        description: 'Basic plan with 25 voices and 8 meetings per month',
        price: 9.99
    },
    {
        productId: 'huscribe_standard_monthly',
        name: 'Huscribe Standard Plan',
        description: 'Standard plan with enhanced features',
        price: 19.99
    },
    {
        productId: 'huscribe_pro_monthly',
        name: 'Huscribe Pro Plan',
        description: 'Pro plan with unlimited features',
        price: 29.99
    }
];

// CLI interface
async function main() {
    const automation = new AppleAppStoreAutomation();
    
    try {
        const command = process.argv[2];
        
        switch (command) {
            case 'list': {
                const app = await automation.getApp();
                await automation.listInAppPurchases(app.id);
                break;
            }
                
            case 'create': {
                const productId = process.argv[3];
                if (productId) {
                    const product = defaultProducts.find(p => p.productId === productId);
                    if (product) {
                        const app = await automation.getApp();
                        await automation.createInAppPurchase(app.id, product);
                    } else {
                        console.error(`❌ Product ${productId} not found in default products`);
                    }
                } else {
                    console.log('🚀 Creating all default products...');
                    const results = await automation.batchCreateProducts(defaultProducts);
                    console.log('\n📊 Results:');
                    results.forEach(result => {
                        if (result.success) {
                            console.log(`  ✅ ${result.productId}: Created successfully`);
                        } else {
                            console.log(`  ❌ ${result.productId}: ${result.error}`);
                        }
                    });
                }
                break;
            }
                
            case 'create-group': {
                const groupName = process.argv[3] || 'Huscribe Subscriptions';
                const app = await automation.getApp();
                await automation.createSubscriptionGroup(app.id, groupName);
                break;
            }
                
            case 'delete': {
                const deleteProductId = process.argv[3];
                if (deleteProductId) {
                    // Note: This requires finding the internal ID first
                    console.log('❌ Delete functionality requires the internal Apple ID. Use App Store Connect manually.');
                } else {
                    console.error('❌ Please provide a product ID to delete');
                }
                break;
            }
                
            default:
                console.log(`
🍎 Apple App Store Connect Automation Tool

Usage:
  node scripts/apple-appstore-automation.js <command> [options]

Commands:
  list                    List all in-app purchases
  create [productId]      Create a specific product or all default products
  create-group [name]     Create a subscription group
  delete <productId>      Delete an in-app purchase (manual process)

Examples:
  node scripts/apple-appstore-automation.js list
  node scripts/apple-appstore-automation.js create
  node scripts/apple-appstore-automation.js create huscribe_basic_monthly
  node scripts/apple-appstore-automation.js create-group "Huscribe Plans"

Environment Variables Required:
  APPLE_KEY_ID              - App Store Connect API Key ID
  APPLE_ISSUER_ID           - App Store Connect Issuer ID
  APPLE_PRIVATE_KEY_PATH    - Path to .p8 private key file
  APPLE_BUNDLE_ID           - Your app's bundle identifier

Setup Instructions:
1. Create an API key in App Store Connect
2. Download the .p8 private key file
3. Set the environment variables
4. Run the script

Note: Products created via API still need manual configuration in App Store Connect
for localization, subscription duration, and review submission.
                `);
        }
        
    } catch (error) {
        console.error('💥 Script failed:', error.message);
        process.exit(1);
    }
}

// Export for use as module
export { AppleAppStoreAutomation, defaultProducts };

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
} 