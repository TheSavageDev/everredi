/**
 * Script to verify RevenueCat Firebase Extension setup
 * 
 * This script checks if:
 * 1. RevenueCat Firestore collections exist
 * 2. Sample user data is present in revenuecat_customers
 * 3. Entitlements are properly configured
 * 
 * Usage: npx ts-node scripts/verify-revenuecat-extension.ts [userId]
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : undefined;

  if (!serviceAccount && !process.env.FIREBASE_PROJECT_ID) {
    console.error('❌ Firebase not configured. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID');
    process.exit(1);
  }

  admin.initializeApp(
    serviceAccount
      ? { credential: admin.credential.cert(serviceAccount) }
      : { projectId: process.env.FIREBASE_PROJECT_ID },
  );
}

const firestore = admin.firestore();
const ENTITLEMENT_ID = 'everredi_pro';

async function verifyExtension(userId?: string) {
  console.log('🔍 Verifying RevenueCat Firebase Extension setup...\n');

  try {
    // Check if revenuecat_customers collection exists
    console.log('1. Checking revenuecat_customers collection...');
    const customersRef = firestore.collection('revenuecat_customers');
    const customersSnapshot = await customersRef.limit(1).get();

    if (customersSnapshot.empty) {
      console.log('   ⚠️  Collection exists but is empty');
      console.log('   💡 Make a purchase or wait for the extension to sync data\n');
    } else {
      console.log('   ✅ Collection exists and has data\n');
    }

    // If userId provided, check specific user
    if (userId) {
      console.log(`2. Checking user ${userId}...`);
      const userDoc = await customersRef.doc(userId).get();

      if (!userDoc.exists) {
        console.log('   ⚠️  User not found in revenuecat_customers');
        console.log('   💡 Ensure RevenueCat app_user_id matches Firebase Auth UID\n');
      } else {
        console.log('   ✅ User found in revenuecat_customers\n');

        const data = userDoc.data();
        console.log('3. Checking entitlements...');
        const entitlements = data?.entitlements || {};

        if (Object.keys(entitlements).length === 0) {
          console.log('   ⚠️  No entitlements found');
          console.log('   💡 User may not have an active subscription\n');
        } else {
          console.log(`   ✅ Found ${Object.keys(entitlements).length} entitlement(s):`);
          Object.entries(entitlements).forEach(([key, value]: [string, any]) => {
            const isActive = value.expires_date
              ? new Date(value.expires_date) > new Date()
              : true;
            const status = isActive ? '✅ Active' : '❌ Expired';
            console.log(`      - ${key}: ${status}`);
            if (value.expires_date) {
              console.log(`        Expires: ${new Date(value.expires_date).toISOString()}`);
            }
          });
          console.log();

          // Check for everredi_pro entitlement
          if (entitlements[ENTITLEMENT_ID]) {
            const entitlement = entitlements[ENTITLEMENT_ID];
            const isActive = entitlement.expires_date
              ? new Date(entitlement.expires_date) > new Date()
              : true;
            console.log(`4. Checking ${ENTITLEMENT_ID} entitlement...`);
            if (isActive) {
              console.log('   ✅ Premium entitlement is active\n');
            } else {
              console.log('   ❌ Premium entitlement is expired\n');
            }
          } else {
            console.log(`4. Checking ${ENTITLEMENT_ID} entitlement...`);
            console.log('   ⚠️  Premium entitlement not found\n');
          }
        }

        // Check subscriptions
        console.log('5. Checking subscriptions...');
        const subscriptions = data?.subscriptions || {};
        if (Object.keys(subscriptions).length === 0) {
          console.log('   ⚠️  No subscriptions found\n');
        } else {
          console.log(`   ✅ Found ${Object.keys(subscriptions).length} subscription(s)\n`);
        }
      }

      // Check user document sync
      console.log('6. Checking user document sync...');
      const userDocRef = firestore.collection('users').doc(userId);
      const userDocSnapshot = await userDocRef.get();

      if (!userDocSnapshot.exists) {
        console.log('   ⚠️  User document not found in users collection\n');
      } else {
        const userData = userDocSnapshot.data();
        const isPremium =
          userData?.subscriptionTier === 'premium' &&
          userData?.subscriptionStatus === 'active';
        console.log(
          `   ${isPremium ? '✅' : '⚠️'} User document shows: ${userData?.subscriptionTier || 'unknown'} / ${userData?.subscriptionStatus || 'unknown'}`,
        );
        if (isPremium) {
          console.log('   ✅ User document is synced with RevenueCat\n');
        } else {
          console.log('   💡 User document may need syncing (this happens automatically on next status check)\n');
        }
      }
    } else {
      console.log('2. No userId provided - skipping user-specific checks');
      console.log('   💡 Run with a userId to check specific user: npx ts-node scripts/verify-revenuecat-extension.ts <userId>\n');
    }

    // Check revenuecat_events collection
    console.log('7. Checking revenuecat_events collection...');
    const eventsRef = firestore.collection('revenuecat_events');
    const eventsSnapshot = await eventsRef.limit(1).get();

    if (eventsSnapshot.empty) {
      console.log('   ⚠️  Collection exists but is empty');
      console.log('   💡 Events will appear when purchases occur\n');
    } else {
      console.log('   ✅ Collection exists and has events\n');
    }

    console.log('✅ Verification complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Ensure the Firebase Extension is installed and configured');
    console.log('   2. Verify the webhook URL is set in RevenueCat dashboard');
    console.log('   3. Make a test purchase to verify data sync');
    console.log('   4. Check Cloud Functions logs if data is not syncing\n');
  } catch (error) {
    console.error('❌ Error during verification:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Get userId from command line args
const userId = process.argv[2];

verifyExtension(userId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

