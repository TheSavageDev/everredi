import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AiService } from '../ai.service';
import { UsersService } from '../../users/users.service';
import type { firestore } from 'firebase-admin';
import { FIRESTORE } from '../../config/firebase.provider';

describe('AiService (integration)', () => {
  let moduleRef: TestingModule;
  let service: AiService;

  const firestoreMock: Partial<firestore.Firestore> = {
    collection: jest.fn().mockReturnThis() as any,
    doc: jest.fn().mockReturnThis() as any,
    where: jest.fn().mockReturnThis() as any,
    orderBy: jest.fn().mockReturnThis() as any,
    limit: jest.fn().mockReturnThis() as any,
    get: jest.fn().mockResolvedValue({
      size: 0,
      docs: [],
    }) as any,
    add: jest.fn().mockResolvedValue({
      id: 'rec-1',
      get: jest.fn().mockResolvedValue({
        id: 'rec-1',
        data: () => ({
          userId: 'user-1',
          recommendedItems: [],
        }),
      }),
    }) as any,
  };

  const usersServiceMock: Partial<UsersService> = {
    getUserById: jest.fn().mockResolvedValue({
      id: 'user-1',
      firebaseUid: 'user-1',
      email: 'test@example.com',
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
      createdAt: {} as any,
      updatedAt: {} as any,
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
