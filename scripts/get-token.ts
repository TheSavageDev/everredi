#!/usr/bin/env node

/**
 * Helper script to get a Firebase ID token for testing
 *
 * This script helps you get a valid Firebase ID token for use with test-system.ts
 *
 * Usage:
 * 1. Sign in to the web app
 * 2. Open browser console
 * 3. Run: await firebase.auth().currentUser.getIdToken()
 * 4. Copy the token
 *
 * Or use this script with Firebase Admin SDK (requires service account)
 */

import * as admin from 'firebase-admin';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

async function getTokenForUser(email: string) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    console.error('❌ Missing Firebase credentials in .env');
    console.error(
      '   Required: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL',
    );
    process.exit(1);
  }

  try {
    // Initialize Firebase Admin
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail,
        } as admin.ServiceAccount),
      });
    }

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`✅ Found user: ${userRecord.email} (${userRecord.uid})`);

    // Create a custom token
    const customToken = await admin.auth().createCustomToken(userRecord.uid);
    console.log('\n📝 Custom Token (use this with Firebase Auth client):');
    console.log(customToken);
    console.log(
      '\n⚠️  Note: You still need to exchange this for an ID token using Firebase Auth client',
    );
    console.log(
      '   The easiest way is to sign in via the web app and get the token from browser console',
    );
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.error(`❌ User with email ${email} not found`);
      console.error('   Make sure the user has signed up at least once');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.log('Usage: npm run get-token <email>');
  console.log('Example: npm run get-token test@example.com');
  console.log('\nNote: This creates a custom token. For an ID token:');
  console.log('1. Sign in to the web app');
  console.log('2. Open browser console');
  console.log('3. Run: await firebase.auth().currentUser.getIdToken()');
  console.log('4. Copy the token and use it as TEST_AUTH_TOKEN');
  process.exit(1);
}

getTokenForUser(email)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
