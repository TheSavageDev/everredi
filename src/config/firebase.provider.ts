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
    initializeFirebase(configService);
    return getFirebaseAdmin();
  },
  inject: [ConfigService],
};

export const firestoreProvider: FactoryProvider = {
  provide: FIRESTORE,
  useFactory: (configService: ConfigService) => {
    // Ensure Firebase is initialized before getting Firestore
    initializeFirebase(configService);
    return getFirestore();
  },
  inject: [ConfigService],
};

export const firebaseAuthProvider: FactoryProvider = {
  provide: FIREBASE_AUTH,
  useFactory: (configService: ConfigService) => {
    // Ensure Firebase is initialized before getting Auth
    initializeFirebase(configService);
    return getAuth();
  },
  inject: [ConfigService],
};
