import { ConfigService } from '@nestjs/config';
import { Injectable, Logger, FactoryProvider } from '@nestjs/common';
import { credential } from 'firebase-admin';
import {
  initializeApp,
  applicationDefault,
  getApps,
  getApp,
  App,
} from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getRemoteConfig, RemoteConfig } from 'firebase-admin/remote-config';
import * as fs from 'fs';
import * as path from 'path';

export const FIREBASE_ADMIN = 'FIREBASE_ADMIN';
export const FIRESTORE = 'FIRESTORE';
export const FIREBASE_AUTH = 'FIREBASE_AUTH';

@Injectable()
export class FirebaseApp {
  private app: App;
  private readonly logger = new Logger(FirebaseApp.name);

  constructor(private readonly config: ConfigService) {
    this.initialize();
  }

  private initialize(): void {
    // Check if Firebase is already initialized
    if (getApps().length > 0) {
      this.app = getApp();
      this.logger.log('✅ Using existing Firebase Admin SDK instance');
      return;
    }

    try {
      const projectId =
        this.config.get<string>('FIREBASE_PROJECT_ID') ||
        this.config.get<string>('GOOGLE_CLOUD_PROJECT');

      if (!projectId) {
        throw new Error(
          'FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT must be set',
        );
      }

      // Check if running on GCP (Cloud Run, GCE, etc.)
      const isGCP = !!(
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT ||
        process.env.K_SERVICE || // Cloud Run sets this
        process.env.K_REVISION // Cloud Run sets this
      );

      let credentialToUse: any;

      // Check if dev-everredi.json exists locally
      const devCredentialPath = path.resolve('./dev-everredi.json');
      const devFileExists = fs.existsSync(devCredentialPath);

      if (devFileExists) {
        // Use local dev file if it exists
        this.logger.log(
          `🔐 Using local development credentials from ${devCredentialPath}`,
        );
        credentialToUse = credential.cert(devCredentialPath);
      } else if (isGCP) {
        // On GCP, use Application Default Credentials (ADC)
        this.logger.log(
          '🔐 Using Application Default Credentials (GCP environment detected)',
        );
        credentialToUse = applicationDefault();
      } else {
        // Fallback to environment variables for local development
        const privateKey = this.config
          .get<string>('FIREBASE_PRIVATE_KEY')
          ?.replace(/\\n/g, '\n');
        const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');

        if (privateKey && clientEmail) {
          this.logger.log('🔐 Using credentials from environment variables');
          credentialToUse = credential.cert({
            projectId,
            privateKey,
            clientEmail,
          });
        } else {
          // Last resort: try applicationDefault (might work if ADC is configured locally)
          this.logger.warn(
            '⚠️  No local credentials found. Attempting to use Application Default Credentials...',
          );
          credentialToUse = applicationDefault();
        }
      }

      const databaseId =
        this.config.get<string>('FIREBASE_DATABASE_ID') || '(default)';

      this.app = initializeApp({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        credential: credentialToUse,
        projectId,
        databaseURL: `https://${projectId}.firebaseio.com`,
      });

      this.logger.log(
        `✅ Firebase Admin SDK initialized successfully for project: ${projectId} (database: ${databaseId})`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Failed to initialize Firebase Admin SDK:',
        error instanceof Error ? error.stack : String(error),
      );
      throw error; // Re-throw to prevent app from starting with broken Firebase
    }
  }

  getApp(): App {
    if (!this.app) {
      throw new Error(
        'Firebase Admin SDK not initialized. Check your environment variables.',
      );
    }
    return this.app;
  }

  getAuth(): Auth {
    if (!this.app) {
      throw new Error(
        'Firebase Admin SDK not initialized. Check your environment variables.',
      );
    }
    return getAuth(this.app);
  }

  firestore(databaseId?: string): Firestore {
    if (!this.app) {
      throw new Error(
        'Firebase Admin SDK not initialized. Check your environment variables.',
      );
    }

    // Use provided databaseId, or get from config, or default to '(default)'
    const dbId =
      databaseId ||
      this.config.get<string>('FIREBASE_DATABASE_ID') ||
      '(default)';

    if (dbId === '(default)') {
      return getFirestore(this.app);
    }

    // For named Firestore databases, use the app.firestore(databaseId) method
    // Type assertion needed: Firebase Admin SDK supports named databases but types are incomplete
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
    return (this.app as any).firestore(dbId);
  }

  remoteConfig(): RemoteConfig {
    if (!this.app) {
      throw new Error(
        'Firebase Admin SDK not initialized. Check your environment variables.',
      );
    }
    return getRemoteConfig(this.app);
  }
}

// Factory providers for token-based injection
export const firestoreProvider: FactoryProvider = {
  provide: FIRESTORE,
  useFactory: (firebaseApp: FirebaseApp, configService: ConfigService) => {
    const databaseId = configService.get<string>('FIREBASE_DATABASE_ID');
    return firebaseApp.firestore(databaseId);
  },
  inject: [FirebaseApp, ConfigService],
};

export const firebaseAuthProvider: FactoryProvider = {
  provide: FIREBASE_AUTH,
  useFactory: (firebaseApp: FirebaseApp) => {
    return firebaseApp.getAuth();
  },
  inject: [FirebaseApp],
};
