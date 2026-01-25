import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AiService } from '../ai.service';
import { UsersService } from '../../users/users.service';
import { SUPABASE } from '../../config/supabase.provider';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('AiService (integration)', () => {
  let moduleRef: TestingModule;
  let service: AiService;

  const supabaseMock = {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            count: 0,
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  const usersServiceMock: Partial<UsersService> = {
    getUserById: jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
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
          provide: SUPABASE,
          useValue: supabaseMock,
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
