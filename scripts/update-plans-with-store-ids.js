import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Plan from '../models/planModel.js';

dotenv.config();

// Product ID mappings for different plans
const PRODUCT_ID_MAPPINGS = {
    // Basic Plans (Free - $0)
    'BASIC': {
        appleProductId: null,
        googleProductId: null,
        platforms: {
            web: true,
            ios: false,
            android: false
        }
    },
    'Basic': {
        appleProductId: null,
        googleProductId: null,
        platforms: {
            web: true,
            ios: false,
            android: false
        }
    },
    'basic': {
        appleProductId: null,
        googleProductId: null,
        platforms: {
            web: true,
            ios: false,
            android: false
        }
    },
    
    // Standard Plans ($0.49)
    'STANDARD': {
        appleProductId: 'com.huscribe.standard.monthly',
        googleProductId: 'standard-monthly-subscription',
        platforms: {
            web: true,
            ios: true,
            android: true
        }
    },
    'Standard': {
        appleProductId: 'com.huscribe.standard.monthly',
        googleProductId: 'standard-monthly-subscription',
        platforms: {
            web: true,
            ios: true,
            android: true
        }
    },
    'standard': {
        appleProductId: 'com.huscribe.standard.monthly',
        googleProductId: 'standard-monthly-subscription',
        platforms: {
            web: true,
            ios: true,
            android: true
        }
    },
    
    // Pro Plans ($0.99)
    'PRO': {
        appleProductId: 'com.huscribe.pro.monthly',
        googleProductId: 'pro-monthly-subscription',
        platforms: {
            web: true,
            ios: true,
            android: true
        }
    },
    'Pro': {
        appleProductId: 'com.huscribe.pro.monthly',
        googleProductId: 'pro-monthly-subscription',
        platforms: {
            web: true,
            ios: true,
            android: true
        }
    },
    'pro': {
        appleProductId: 'com.huscribe.pro.monthly',
        googleProductId: 'pro-monthly-subscription',
        platforms: {
            web: true,
            ios: true,
            android: true
        }
    },
    
    // Free Plans (legacy naming)
    'FREE': {
        appleProductId: null,
        googleProductId: null,
        platforms: {
            web: true,
            ios: false,
            android: false
        }
    },
    'Free': {
        appleProductId: null,
        googleProductId: null,
        platforms: {
            web: true,
            ios: false,
            android: false
        }
    },
    'free': {
        appleProductId: null,
        googleProductId: null,
        platforms: {
            web: true,
            ios: false,
            android: false
        }
    }
};

// Alternative mapping based on price ranges (fallback)
const PRICE_BASED_MAPPINGS = {
    // $0 - Basic (Free)
    0: {
        appleProductId: null,
        googleProductId: null,
        platforms: {
            web: true,
            ios: false,
            android: false
        }
    },
    // $0.01-$0.50 - Standard
    49: {
        appleProductId: 'com.huscribe.standard.monthly',
        googleProductId: 'standard-monthly-subscription',
        platforms: {
            web: true,
            ios: true,
            android: true
        }
    },
    // $0.51+ - Pro
    99: {
        appleProductId: 'com.huscribe.pro.monthly',
        googleProductId: 'pro-monthly-subscription',
        platforms: {
            web: true,
            ios: true,
            android: true
        }
    }
};

class PlanStoreIdUpdater {
    constructor() {
        this.updatedCount = 0;
        this.skippedCount = 0;
        this.errorCount = 0;
        this.results = [];
    }

    async connectToDatabase() {
        try {
            mongoose.set('strictQuery', false);
            const conn = await mongoose.connect(process.env.MONGO_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            console.log('✅ Connected to MongoDB');
        } catch (error) {
            console.error('❌ Failed to connect to MongoDB:', error.message);
            throw error;
        }
    }

    async disconnectFromDatabase() {
        try {
            await mongoose.disconnect();
            console.log('✅ Disconnected from MongoDB');
        } catch (error) {
            console.error('❌ Failed to disconnect from MongoDB:', error.message);
        }
    }

    getProductIdsForPlan(plan) {
        // First try to match by plan name
        if (PRODUCT_ID_MAPPINGS[plan.name]) {
            return PRODUCT_ID_MAPPINGS[plan.name];
        }

        // Try to match by price if name doesn't match
        const priceInCents = plan.price?.amount || 0;
        
        // Find closest price match
        const priceKeys = Object.keys(PRICE_BASED_MAPPINGS).map(Number).sort((a, b) => a - b);
        let closestPrice = priceKeys[0];
        
        for (const price of priceKeys) {
            if (priceInCents >= price) {
                closestPrice = price;
            } else {
                break;
            }
        }

        return PRICE_BASED_MAPPINGS[closestPrice];
    }

    async updatePlan(plan, productIds, dryRun = false) {
        try {
            const updateData = {
                appleProductId: productIds.appleProductId,
                googleProductId: productIds.googleProductId,
                platforms: productIds.platforms
            };

            if (dryRun) {
                console.log(`[DRY RUN] Would update plan "${plan.name}" (${plan._id}):`);
                console.log(`  Apple Product ID: ${updateData.appleProductId || 'null'}`);
                console.log(`  Google Product ID: ${updateData.googleProductId || 'null'}`);
                console.log(`  Platforms: ${JSON.stringify(updateData.platforms)}`);
                return { success: true, dryRun: true };
            }

            const result = await Plan.findByIdAndUpdate(
                plan._id,
                { $set: updateData },
                { new: true }
            );

            if (result) {
                console.log(`✅ Updated plan "${plan.name}" (${plan._id})`);
                console.log(`  Apple Product ID: ${updateData.appleProductId || 'null'}`);
                console.log(`  Google Product ID: ${updateData.googleProductId || 'null'}`);
                console.log(`  Platforms: ${JSON.stringify(updateData.platforms)}`);
                
                this.updatedCount++;
                return { success: true, plan: result };
            } else {
                throw new Error('Plan not found after update');
            }

        } catch (error) {
            console.error(`❌ Failed to update plan "${plan.name}" (${plan._id}):`, error.message);
            this.errorCount++;
            return { success: false, error: error.message };
        }
    }

    async updateAllPlans(options = {}) {
        const { dryRun = false, force = false } = options;
        
        try {
            console.log(`🚀 ${dryRun ? 'DRY RUN: ' : ''}Starting plan store ID update...`);
            
            // Get all plans
            const plans = await Plan.find({});
            console.log(`📋 Found ${plans.length} plans to process`);

            if (plans.length === 0) {
                console.log('⚠️  No plans found in database');
                return;
            }

            for (const plan of plans) {
                console.log(`\n📦 Processing plan: "${plan.name}" (${plan._id})`);
                console.log(`  Current price: $${(plan.price?.amount || 0) / 100}`);
                console.log(`  Current Apple ID: ${plan.appleProductId || 'not set'}`);
                console.log(`  Current Google ID: ${plan.googleProductId || 'not set'}`);

                // Skip if already has store IDs and not forcing update
                if (!force && plan.appleProductId && plan.googleProductId) {
                    console.log(`⏭️  Skipping - already has store IDs (use --force to override)`);
                    this.skippedCount++;
                    continue;
                }

                // Get product IDs for this plan
                const productIds = this.getProductIdsForPlan(plan);
                
                if (!productIds) {
                    console.log(`⚠️  No product ID mapping found for plan "${plan.name}"`);
                    this.skippedCount++;
                    continue;
                }

                // Update the plan
                const result = await this.updatePlan(plan, productIds, dryRun);
                this.results.push({
                    planId: plan._id,
                    planName: plan.name,
                    result: result
                });
            }

            // Print summary
            this.printSummary(dryRun);

        } catch (error) {
            console.error('💥 Failed to update plans:', error.message);
            throw error;
        }
    }

    async updateSpecificPlan(planId, productIds, dryRun = false) {
        try {
            const plan = await Plan.findById(planId);
            
            if (!plan) {
                throw new Error(`Plan with ID ${planId} not found`);
            }

            console.log(`📦 Processing specific plan: "${plan.name}" (${plan._id})`);
            
            const result = await this.updatePlan(plan, productIds, dryRun);
            this.results.push({
                planId: plan._id,
                planName: plan.name,
                result: result
            });

            this.printSummary(dryRun);

        } catch (error) {
            console.error('💥 Failed to update specific plan:', error.message);
            throw error;
        }
    }

    printSummary(dryRun = false) {
        console.log(`\n📊 ${dryRun ? 'DRY RUN ' : ''}Summary:`);
        console.log(`  ✅ Updated: ${this.updatedCount}`);
        console.log(`  ⏭️  Skipped: ${this.skippedCount}`);
        console.log(`  ❌ Errors: ${this.errorCount}`);
        console.log(`  📋 Total processed: ${this.results.length}`);

        if (this.errorCount > 0) {
            console.log('\n❌ Plans with errors:');
            this.results
                .filter(r => !r.result.success)
                .forEach(r => {
                    console.log(`  - ${r.planName} (${r.planId}): ${r.result.error}`);
                });
        }

        if (dryRun) {
            console.log('\n💡 This was a dry run. Use --execute to apply changes.');
        }
    }

    async listCurrentPlans() {
        try {
            const plans = await Plan.find({});
            
            console.log(`📋 Current plans in database (${plans.length} total):\n`);
            
            plans.forEach((plan, index) => {
                console.log(`${index + 1}. "${plan.name}" (${plan._id})`);
                console.log(`   Price: $${(plan.price?.amount || 0) / 100}`);
                console.log(`   Apple Product ID: ${plan.appleProductId || 'not set'}`);
                console.log(`   Google Product ID: ${plan.googleProductId || 'not set'}`);
                
                // Handle platforms field safely
                let platformsDisplay = 'not set';
                if (plan.platforms) {
                    if (Array.isArray(plan.platforms)) {
                        platformsDisplay = plan.platforms.join(', ');
                    } else if (typeof plan.platforms === 'object') {
                        // Handle object format like { web: true, ios: false, android: false }
                        const activePlatforms = Object.keys(plan.platforms).filter(key => plan.platforms[key]);
                        platformsDisplay = activePlatforms.length > 0 ? activePlatforms.join(', ') : 'none active';
                    } else {
                        platformsDisplay = String(plan.platforms);
                    }
                }
                
                console.log(`   Platforms: ${platformsDisplay}`);
                console.log('');
            });

        } catch (error) {
            console.error('❌ Failed to list plans:', error.message);
            throw error;
        }
    }
}

// CLI interface
async function main() {
    console.log('🚀 Starting Plan Store ID Updater...');
    console.log('📍 Current working directory:', process.cwd());
    console.log('🔧 Node.js version:', process.version);
    console.log('📋 Command line arguments:', process.argv);
    
    const updater = new PlanStoreIdUpdater();
    
    try {
        console.log('🔌 Attempting to connect to database...');
        await updater.connectToDatabase();
        
        const command = process.argv[2];
        const flags = process.argv.slice(3);
        
        console.log(`📝 Command: ${command || 'none'}`);
        console.log(`🏁 Flags: ${flags.join(', ') || 'none'}`);
        
        const dryRun = !flags.includes('--execute');
        const force = flags.includes('--force');
        
        switch (command) {
            case 'list':
                console.log('📋 Executing list command...');
                await updater.listCurrentPlans();
                break;
                
            case 'update':
                console.log('🔄 Executing update command...');
                await updater.updateAllPlans({ dryRun, force });
                break;
                
            case 'update-plan': {
                console.log('🎯 Executing update-plan command...');
                const planId = flags.find(f => f.startsWith('--plan-id='))?.split('=')[1];
                const appleId = flags.find(f => f.startsWith('--apple-id='))?.split('=')[1];
                const googleId = flags.find(f => f.startsWith('--google-id='))?.split('=')[1];
                const platformsFlag = flags.find(f => f.startsWith('--platforms='))?.split('=')[1];
                
                if (!planId) {
                    console.error('❌ --plan-id is required for update-plan command');
                    process.exit(1);
                }
                
                // Handle platforms - convert from comma-separated string to object
                let platforms = {
                    web: true,
                    ios: true,
                    android: true
                };
                
                if (platformsFlag) {
                    const platformList = platformsFlag.split(',');
                    platforms = {
                        web: platformList.includes('web'),
                        ios: platformList.includes('ios'),
                        android: platformList.includes('android')
                    };
                }
                
                const productIds = {
                    appleProductId: appleId || null,
                    googleProductId: googleId || null,
                    platforms: platforms
                };
                
                await updater.updateSpecificPlan(planId, productIds, dryRun);
                break;
            }
                
            default:
                console.log('📖 Showing help...');
                console.log(`
🏪 Plan Store ID Updater

Usage:
  node scripts/update-plans-with-store-ids.js <command> [options]

Commands:
  list                    List all current plans and their store IDs
  update                  Update all plans with store IDs (dry run by default)
  update-plan             Update a specific plan with custom store IDs

Options:
  --execute              Actually perform the updates (default is dry run)
  --force                Update plans even if they already have store IDs
  --plan-id=<id>         Specific plan ID to update (for update-plan command)
  --apple-id=<id>        Apple product ID (for update-plan command)
  --google-id=<id>       Google product ID (for update-plan command)
  --platforms=<list>     Comma-separated platforms (for update-plan command)

Examples:
  # List all plans
  node scripts/update-plans-with-store-ids.js list

  # Dry run update (preview changes)
  node scripts/update-plans-with-store-ids.js update

  # Actually update all plans
  node scripts/update-plans-with-store-ids.js update --execute

  # Force update all plans (even if they have store IDs)
  node scripts/update-plans-with-store-ids.js update --execute --force

  # Update specific plan
  node scripts/update-plans-with-store-ids.js update-plan --plan-id=683fe59c1d1bb0eed61bfca2 --apple-id=com.huscribe.standard.monthly --google-id=standard_monthly --execute

Product ID Mappings (Based on Your Current Plans):
  BASIC (Free - $0.00)    → null / null (web only)
    • 25 voices/month, 8 meetings/month
    • Web platform only
  
  STANDARD ($0.49)        → com.huscribe.standard.monthly / standard-monthly-subscription
    • 60 voices/month, 1 meeting/month
    • iOS, Android, Web platforms
  
  PRO ($0.99)            → com.huscribe.pro.monthly / pro-monthly-subscription
    • Unlimited voices, 3 meetings/month
    • iOS, Android, Web platforms

Price-based fallback:
  $0.00                  → BASIC plan (web only)
  $0.01-$0.50           → STANDARD plan (all platforms)
  $0.51+                → PRO plan (all platforms)

Environment Variables Required:
  MONGO_URI           - MongoDB connection string

Note: This script will automatically map plans based on their name or price.
The BASIC plan is free and web-only, so it won't get mobile store IDs.
STANDARD and PRO plans will get both Apple and Google product IDs for mobile purchases.
                `);
        }
        
    } catch (error) {
        console.error('💥 Script failed:', error.message);
        process.exit(1);
    } finally {
        await updater.disconnectFromDatabase();
    }
}

// Export for use as module
export { PlanStoreIdUpdater, PRODUCT_ID_MAPPINGS, PRICE_BASED_MAPPINGS };

// Run CLI
main(); 