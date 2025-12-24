import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import {
  FIREBASE_ADMIN,
  FIRESTORE,
  FIREBASE_AUTH,
} from '../../src/config/firebase.provider';
import { UsersService } from '../../src/users/users.service';
import { TEST_USER_EMAIL, TEST_USER_ID } from './test-auth';

export interface TestAppContext {
  app: INestApplication;
  close: () => Promise<void>;
}

export async function createTestingApp(): Promise<TestAppContext> {
  const firebaseAuthMock = {
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      name: 'Test User',
    }),
  };

  const firestoreMock = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({
      size: 0,
      docs: [],
      exists: false,
      data: () => ({}),
      id: 'doc-id',
    }),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue({
      id: 'doc-id',
      get: jest.fn().mockResolvedValue({
        id: 'doc-id',
        data: () => ({}),
      }),
    }),
  };

  const usersServiceMock: Partial<UsersService> = {
    createOrUpdateUser: jest
      .fn()
      .mockImplementation(
        async (firebaseUid: string, email: string, displayName?: string) => ({
          id: firebaseUid,
          firebaseUid,
          email,
          displayName,
          subscriptionTier: 'free',
          subscriptionStatus: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
        }),
      ),
    getUserById: jest.fn().mockResolvedValue({
      id: TEST_USER_ID,
      firebaseUid: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    }),
    updateUser: jest.fn().mockResolvedValue({
      id: TEST_USER_ID,
      firebaseUid: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    }),
    getSubscriptionStatus: jest.fn().mockResolvedValue({
      tier: 'free',
      status: 'active',
      expiresAt: undefined,
    }),
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(FIREBASE_ADMIN)
    .useValue({})
    .overrideProvider(FIRESTORE)
    .useValue(firestoreMock)
    .overrideProvider(FIREBASE_AUTH)
    .useValue(firebaseAuthMock)
    .overrideProvider(UsersService)
    .useValue(usersServiceMock)
    .compile();

  const app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  await app.init();

  return {
    app,
    close: () => app.close(),
  };
}
