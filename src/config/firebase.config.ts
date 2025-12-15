import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

let isInitialized = false;
let firebaseAdminInstance: admin.app.App | null = null;

export function initializeFirebase(configService: ConfigService): void {
  if (admin.apps.length > 0) {
    firebaseAdminInstance = admin.app();
    isInitialized = true;
    return;
  }

  const projectId = configService.get<string>('FIREBASE_PROJECT_ID');
  const privateKey = configService
    .get<string>('FIREBASE_PRIVATE_KEY')
    ?.replace(/\\n/g, '\n');
  const clientEmail = configService.get<string>('FIREBASE_CLIENT_EMAIL');

  // Check if running on GCP (Cloud Run, GCE, etc.) - use Application Default Credentials
  const isGCP = !!(
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.K_SERVICE || // Cloud Run sets this
    process.env.K_REVISION // Cloud Run sets this
  );

  try {
    let credential: admin.credential.Credential;

    if (isGCP && projectId) {
      // On GCP, use Application Default Credentials (ADC)
      // The service account attached to Cloud Run will be used automatically
      console.log(
        '🔐 Using Application Default Credentials (GCP environment detected)',
      );
      credential = admin.credential.applicationDefault();
    } else if (projectId && privateKey && clientEmail) {
      // Local development or explicit credentials provided
      const serviceAccount = {
        projectId,
        privateKey,
        clientEmail,
      };
      credential = admin.credential.cert(
        serviceAccount as admin.ServiceAccount,
      );
    } else {
      console.warn(
        '⚠️  Firebase Admin SDK not initialized: Missing environment variables.\n' +
          '   Please set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in your .env file.\n' +
          '   The app will start but Firebase features will not work until configured.',
      );
      return;
    }

    const databaseId =
      configService.get<string>('FIREBASE_DATABASE_ID') || '(default)';

    firebaseAdminInstance = admin.initializeApp({
      credential,
      databaseURL: `https://${projectId}.firebaseio.com`,
    });
    isInitialized = true;

    console.log(
      `✅ Firebase Admin SDK initialized successfully for project: ${projectId} (database: ${databaseId})`,
    );
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
    console.warn('   Continuing without Firebase Admin SDK...');
  }
}

export function getFirebaseAdmin(): admin.app.App {
  if (!firebaseAdminInstance) {
    throw new Error(
      'Firebase Admin SDK not initialized. Check your environment variables.',
    );
  }
  return firebaseAdminInstance;
}

export function getFirestore(): admin.firestore.Firestore {
  if (!isInitialized || !firebaseAdminInstance) {
    throw new Error(
      'Firebase Admin SDK not initialized. Check your environment variables.',
    );
  }
  // Get database ID from environment or use default
  const databaseId = process.env.FIREBASE_DATABASE_ID || '(default)';
  // Note: Firebase Admin SDK v13+ supports multiple databases via app.firestore(databaseId)
  // For now, we use the default database. To use named databases, you may need to
  // initialize separate app instances or use a different approach based on SDK version.
  // The databaseId is logged for reference but currently uses default database.
  return admin.firestore(firebaseAdminInstance);
}

export function getAuth(): admin.auth.Auth {
  if (!isInitialized || !firebaseAdminInstance) {
    throw new Error(
      'Firebase Admin SDK not initialized. Check your environment variables.',
    );
  }
  return admin.auth();
}

// For backward compatibility
export const firebaseAdmin = admin;
