import { FactoryProvider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  initializeFirebase,
  getFirebaseAdmin,
  getFirestore,
  getAuth,
} from './firebase.config';

const logger = new Logger('FirebaseProvider');

export const FIREBASE_ADMIN = 'FIREBASE_ADMIN';
export const FIRESTORE = 'FIRESTORE';
export const FIREBASE_AUTH = 'FIREBASE_AUTH';

export const firebaseAdminProvider: FactoryProvider = {
  provide: FIREBASE_ADMIN,
  useFactory: (configService: ConfigService) => {
    try {
      initializeFirebase(configService);
      return getFirebaseAdmin();
    } catch (error) {
      logger.error(
        'Failed to initialize Firebase Admin:',
        error instanceof Error ? error.stack : String(error),
      );
      throw error; // Re-throw to prevent app from starting with broken Firebase
    }
  },
  inject: [ConfigService],
};

export const firestoreProvider: FactoryProvider = {
  provide: FIRESTORE,
  useFactory: (configService: ConfigService) => {
    try {
      // Ensure Firebase is initialized before getting Firestore
      initializeFirebase(configService);
      // Pass ConfigService to getFirestore() to ensure proper environment variable access
      return getFirestore(configService);
    } catch (error) {
      logger.error(
        'Failed to initialize Firestore:',
        error instanceof Error ? error.stack : String(error),
      );
      throw error; // Re-throw to prevent app from starting with broken Firestore
    }
  },
  inject: [ConfigService],
};

export const firebaseAuthProvider: FactoryProvider = {
  provide: FIREBASE_AUTH,
  useFactory: (configService: ConfigService) => {
    try {
      // Ensure Firebase is initialized before getting Auth
      initializeFirebase(configService);
      return getAuth();
    } catch (error) {
      logger.error(
        'Failed to initialize Firebase Auth:',
        error instanceof Error ? error.stack : String(error),
      );
      throw error; // Re-throw to prevent app from starting with broken Auth
    }
  },
  inject: [ConfigService],
};
