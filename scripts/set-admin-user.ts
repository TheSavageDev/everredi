#!/usr/bin/env node

/**
 * Script to set a user as admin
 * Usage: npm run set-admin <email>
 * Or: ts-node scripts/set-admin-user.ts <email>
 */

import * as admin from 'firebase-admin';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!projectId || !privateKey || !clientEmail) {
  console.error('❌ Missing required environment variables:');
  console.error(
    '   FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL',
  );
  process.exit(1);
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    privateKey,
    clientEmail,
  } as admin.ServiceAccount),
});

const firestore = admin.firestore();

async function setAdminUser(email: string) {
  try {
    // Find user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    const userId = userRecord.uid;

    // Update user document in Firestore
    const userRef = firestore.collection('users').doc(userId);
    await userRef.set(
      {
        isAdmin: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    console.log(`✅ User ${email} (${userId}) has been set as admin`);
    console.log(`   You can now access admin features with this account`);
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

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('❌ Usage: npm run set-admin <email>');
  console.error('   Example: npm run set-admin admin@example.com');
  process.exit(1);
}

setAdminUser(email)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
