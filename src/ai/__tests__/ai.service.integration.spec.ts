import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AiService } from '../ai.service';
import { UsersService } from '../../users/users.service';
import type { firestore } from 'firebase-admin';
import { FIRESTORE } from '../../config/firebase.provider';

describe('AiService (integration)', () => {
  let moduleRef: TestingModule;
  let service: AiService;

  const firestoreMock = {
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({
            size: 0,
            docs: [],
          }),
          add: jest.fn().mockResolvedValue({
            id: 'rec-1',
            get: jest.fn().mockResolvedValue({
              id: 'rec-1',
              data: () => ({
                userId: 'user-1',
                recommendedItems: [],
              }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as firestore.Firestore;

  const usersServiceMock: Partial<UsersService> = {
    getUserById: jest.fn().mockResolvedValue({
      id: 'user-1',
      firebaseUid: 'user-1',
      email: 'test@example.com',
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
      createdAt: {} as firestore.Timestamp,
      updatedAt: {} as firestore.Timestamp,
      isActive: true,
    }),
  };

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        AiService,
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: FIRESTORE,
          useValue: firestoreMock,
        },
      ],
    }).compile();

    service = moduleRef.get(AiService);
  });

  it('checks usage limit for a user', async () => {
    const result = await service.checkUsageLimit('user-1');
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
  });
});
