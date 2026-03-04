import { UsersService, User } from '../users.service';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';
import { SUPABASE } from '../../config/supabase.provider';
import { RevenueCatService } from '../../subscriptions/revenuecat.service';

describe('UsersService', () => {
  const supabaseMock = createSupabaseClientMock();
  let service: UsersService;
  const now = new Date();

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();
    service = new UsersService(
      supabaseMock,
      undefined, // RevenueCatService is optional
    );
  });

  it('creates a new user when none exists', async () => {
    // Mock: user doesn't exist (empty table)
    // The service will first try to find the user with .single(), which will return error
    // Then it will create the user with .insert().select().single()
    // Then it will try to create a default location
    (supabaseMock._setMockData as jest.Mock)('users', []);
    (supabaseMock._setMockData as jest.Mock)('locations', []);

    const result = await service.createOrUpdateUser(
      'uid',
      'test@example.com',
      'Test User',
    );

    expect(supabaseMock.from).toHaveBeenCalledWith('users');
    expect(result).toBeDefined();
    expect(result.email).toBe('test@example.com');
  });

  it('updates an existing user when found', async () => {
    const existingUser = {
      id: 'uid',
      email: 'old@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    };

    // Mock: user exists
    const select = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const single = jest
      .fn()
      .mockResolvedValue({ data: existingUser, error: null });
    const update = jest.fn().mockReturnThis();

    (supabaseMock.from as jest.Mock).mockReturnValue({
      select,
      eq,
      single,
      update,
    });

    await service.createOrUpdateUser('uid', 'new@example.com', undefined);

    expect(supabaseMock.from).toHaveBeenCalledWith('users');
  });

  it('returns subscription status from user document', async () => {
    const userData = {
      id: 'uid',
      email: 'test@example.com',
      subscription_tier: 'free',
      subscription_status: 'active',
      subscription_expires_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    };

    // Mock getUserById
    (supabaseMock.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: userData, error: null }),
    });

    // Mock RevenueCat query (returns null - no RevenueCat data)
    const status = await service.getSubscriptionStatus('uid');
    expect(status.tier).toBe('free');
    expect(status.status).toBe('active');
    expect(status.expiresAt).toBeDefined();
  });

  describe('applyReferralCode', () => {
    it('should successfully apply a valid referral code', async () => {
      const user: User = {
        id: 'user1',
        email: 'user1@example.com',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        createdAt: now,
        updatedAt: now,
        isActive: true,
      };

      const referrer: User = {
        id: 'referrer1',
        email: 'referrer@example.com',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        referralCode: 'REFCODE123',
        createdAt: now,
        updatedAt: now,
        isActive: true,
      };

      // Mock getUserById for the user applying the code
      jest.spyOn(service, 'getUserById').mockResolvedValue(user);

      // Mock Supabase query for finding referrer
      (supabaseMock._setMockData as jest.Mock)('users', [
        {
          id: 'referrer1',
          referral_code: 'REFCODE123',
          referral_rewards: null,
        },
      ]);

      const result = await service.applyReferralCode('user1', 'REFCODE123');

      expect(result.success).toBe(true);
    });

    it('should reject if user already has a referrer', async () => {
      const user: User = {
        id: 'user1',
        email: 'user1@example.com',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        referredBy: 'someone-else',
        createdAt: now,
        updatedAt: now,
        isActive: true,
      };

      jest.spyOn(service, 'getUserById').mockResolvedValue(user);

      const result = await service.applyReferralCode('user1', 'REFCODE123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('already used');
    });

    it('should reject invalid referral code', async () => {
      const user: User = {
        id: 'user1',
        email: 'user1@example.com',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        createdAt: now,
        updatedAt: now,
        isActive: true,
      };

      jest.spyOn(service, 'getUserById').mockResolvedValue(user);

      // Mock Supabase query - no referrer found
      (supabaseMock._setMockData as jest.Mock)('users', []);

      const result = await service.applyReferralCode('user1', 'INVALID');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid');
    });

    it('should reject if user tries to use their own code', async () => {
      const user: User = {
        id: 'user1',
        email: 'user1@example.com',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        referralCode: 'MYCODE123',
        createdAt: now,
        updatedAt: now,
        isActive: true,
      };

      jest.spyOn(service, 'getUserById').mockResolvedValue(user);

      // Mock Supabase query - finds same user
      (supabaseMock._setMockData as jest.Mock)('users', [
        {
          id: 'user1', // Same user
          referral_code: 'MYCODE123',
        },
      ]);

      const result = await service.applyReferralCode('user1', 'MYCODE123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('your own');
    });
  });

  describe('getReferralStats', () => {
    it('should return referral stats for a user', async () => {
      const user: User = {
        id: 'user1',
        email: 'user1@example.com',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        referralCode: 'REFCODE123',
        referralRewards: {
          freeMonthsEarned: 2,
          lastRewardDate: now,
        },
        createdAt: now,
        updatedAt: now,
        isActive: true,
      };

      jest.spyOn(service, 'getUserById').mockResolvedValue(user);

      // Mock referrals count query - set up mock data with referred_by = 'user1'
      (supabaseMock._setMockData as jest.Mock)('users', [
        { id: 'ref1', referred_by: 'user1' },
        { id: 'ref2', referred_by: 'user1' },
        { id: 'ref3', referred_by: 'user1' },
      ]);

      const stats = await service.getReferralStats('user1');

      expect(stats.referralCode).toBe('REFCODE123');
      expect(stats.referralsCount).toBe(3);
      expect(stats.rewards?.freeMonthsEarned).toBe(2);
    });

    it('should throw error if user not found', async () => {
      jest.spyOn(service, 'getUserById').mockResolvedValue(null);

      await expect(service.getReferralStats('nonexistent')).rejects.toThrow(
        'User not found',
      );
    });
  });
});
