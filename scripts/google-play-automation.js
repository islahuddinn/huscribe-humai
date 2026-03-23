import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

class GooglePlayAutomation {
    constructor() {
        this.packageName = process.env.GOOGLE_PACKAGE_NAME;
        this.serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
        this.androidPublisher = null;
        this.auth = null;
    }

    async initialize() {
        try {
            // Load service account credentials
            const serviceAccount = JSON.parse(
                fs.readFileSync(this.serviceAccountPath, 'utf8')
            );

            // Create JWT auth client
            this.auth = new google.auth.JWT(
                serviceAccount.client_email,
                null,
                serviceAccount.private_key,
                ['https://www.googleapis.com/auth/androidpublisher']
            );

            // Initialize Android Publisher API
            this.androidPublisher = google.androidpublisher({
                version: 'v3',
                auth: this.auth
            });

            console.log('✅ Google Play API initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Google Play API:', error.message);
            throw error;
        }
    }

    async createSubscriptionProduct(productConfig) {
        try {
            const { productId, title, description, price, currency, billingPeriod } = productConfig;

            // Create the subscription product
            const response = await this.androidPublisher.monetization.subscriptions.create({
                packageName: this.packageName,
                requestBody: {
                    productId: productId,
                    basePlans: [{
                        basePlanId: `${productId}-monthly`,
                        state: 'ACTIVE',
                        autoRenewing: true,
                        regionalConfigs: [{
                            regionCode: 'US',
                            price: {
                                priceMicros: price * 1000000, // Convert to micros
                                currency: currency.toUpperCase()
                            }
                        }],
                        offerTags: [],
                        otherRegionsConfig: {
                            usdPrice: {
                                priceMicros: price * 1000000,
                                currency: 'USD'
                            }
                        }
                    }],
                    listings: [{
                        languageCode: 'en-US',
                        title: title,
                        description: description
                    }],
                    archived: false
                }
            });

            console.log(`✅ Created subscription product: ${productId}`);
            return response.data;

        } catch (error) {
            console.error(`❌ Failed to create subscription product ${productConfig.productId}:`, error.message);
            throw error;
        }
    }

    async updateSubscriptionProduct(productId, updates) {
        try {
            const response = await this.androidPublisher.monetization.subscriptions.patch({
                packageName: this.packageName,
                productId: productId,
                requestBody: updates
            });

            console.log(`✅ Updated subscription product: ${productId}`);
            return response.data;

        } catch (error) {
            console.error(`❌ Failed to update subscription product ${productId}:`, error.message);
            throw error;
        }
    }

    async listSubscriptionProducts() {
        try {
            const response = await this.androidPublisher.monetization.subscriptions.list({
                packageName: this.packageName
            });

            console.log('📋 Current subscription products:');
            response.data.subscriptions?.forEach(sub => {
                console.log(`  - ${sub.productId}: ${sub.listings?.[0]?.title}`);
            });

            return response.data.subscriptions || [];

        } catch (error) {
            console.error('❌ Failed to list subscription products:', error.message);
            throw error;
        }
    }

    async deleteSubscriptionProduct(productId) {
        try {
            await this.androidPublisher.monetization.subscriptions.archive({
                packageName: this.packageName,
                productId: productId
            });

            console.log(`✅ Archived subscription product: ${productId}`);

        } catch (error) {
            console.error(`❌ Failed to archive subscription product ${productId}:`, error.message);
            throw error;
        }
    }

    async batchCreateProducts(products) {
        console.log(`🚀 Creating ${products.length} subscription products...`);
        
        const results = [];
        for (const product of products) {
            try {
                const result = await this.createSubscriptionProduct(product);
                results.push({ success: true, productId: product.productId, data: result });
            } catch (error) {
                results.push({ success: false, productId: product.productId, error: error.message });
            }
        }

        return results;
    }
}

// Default product configurations for Huscribe plans
const defaultProducts = [
    {
        productId: 'huscribe_basic_monthly',
        title: 'Huscribe Basic Plan',
        description: 'Basic plan with 25 voices and 8 meetings per month',
        price: 9.99,
        currency: 'USD',
        billingPeriod: 'MONTHLY'
    },
    {
        productId: 'huscribe_standard_monthly',
        title: 'Huscribe Standard Plan',
        description: 'Standard plan with enhanced features',
        price: 19.99,
        currency: 'USD',
        billingPeriod: 'MONTHLY'
    },
    {
        productId: 'huscribe_pro_monthly',
        title: 'Huscribe Pro Plan',
        description: 'Pro plan with unlimited features',
        price: 29.99,
        currency: 'USD',
        billingPeriod: 'MONTHLY'
    }
];

// CLI interface
async function main() {
    const automation = new GooglePlayAutomation();
    
    try {
        await automation.initialize();
        
        const command = process.argv[2];
        
        switch (command) {
            case 'list':
                await automation.listSubscriptionProducts();
                break;
                
            case 'create':
                const productId = process.argv[3];
                if (productId) {
                    const product = defaultProducts.find(p => p.productId === productId);
                    if (product) {
                        await automation.createSubscriptionProduct(product);
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
                
            case 'delete':
                const deleteProductId = process.argv[3];
                if (deleteProductId) {
                    await automation.deleteSubscriptionProduct(deleteProductId);
                } else {
                    console.error('❌ Please provide a product ID to delete');
                }
                break;
                
            default:
                console.log(`
🔧 Google Play Console Automation Tool

Usage:
  node scripts/google-play-automation.js <command> [options]

Commands:
  list                    List all subscription products
  create [productId]      Create a specific product or all default products
  delete <productId>      Archive a subscription product

Examples:
  node scripts/google-play-automation.js list
  node scripts/google-play-automation.js create
  node scripts/google-play-automation.js create huscribe_basic_monthly
  node scripts/google-play-automation.js delete huscribe_basic_monthly

Environment Variables Required:
  GOOGLE_PACKAGE_NAME           - Your app's package name
  GOOGLE_SERVICE_ACCOUNT_PATH   - Path to service account JSON file
                `);
        }
        
    } catch (error) {
        console.error('💥 Script failed:', error.message);
        process.exit(1);
    }
}

// Export for use as module
export { GooglePlayAutomation, defaultProducts };

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
} 