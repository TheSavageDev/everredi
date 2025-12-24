import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  initializeFirebase,
  getFirebaseAdmin,
  getFirestore,
  getAuth,
} from './firebase.config';

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
      console.error('Failed to initialize Firebase Admin:', error);
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
      return getFirestore();
    } catch (error) {
      console.error('Failed to initialize Firestore:', error);
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
      console.error('Failed to initialize Firebase Auth:', error);
      throw error; // Re-throw to prevent app from starting with broken Auth
    }
  },
  inject: [ConfigService],
};
