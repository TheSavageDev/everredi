import { UsersService, User } from '../users.service';
import { Timestamp } from 'firebase-admin/firestore';

describe('UsersService', () => {
  const now = Timestamp.now();

  const firestoreMock = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  };

  let service: UsersService;

  const firebaseAuthMock = {} as unknown as auth.Auth;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(
      firestoreMock as unknown as firestore.Firestore,
      firebaseAuthMock,
    );
  });

  it('creates a new user when none exists', async () => {
    firestoreMock.get = jest.fn().mockResolvedValue({
      exists: false,
      data: () => null,
    });

    await service.createOrUpdateUser('uid', 'test@example.com', 'Test User');

    expect(firestoreMock.collection).toHaveBeenCalledWith('users');
    expect(firestoreMock.doc).toHaveBeenCalledWith('uid');
    expect(firestoreMock.set).toHaveBeenCalled();
  });

  it('updates an existing user when found', async () => {
    firestoreMock.get = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'uid',
        firebaseUid: 'uid',
        email: 'old@example.com',
        createdAt: now,
        updatedAt: now,
        isActive: true,
      }),
    });

    await service.createOrUpdateUser('uid', 'new@example.com', undefined);

    expect(firestoreMock.update).toHaveBeenCalled();
  });

  it('returns subscription status from user document', async () => {
    firestoreMock.get = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'uid',
        firebaseUid: 'uid',
        email: 'test@example.com',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: now,
        createdAt: now,
        updatedAt: now,
        isActive: true,
      }),
    });

    const status = await service.getSubscriptionStatus('uid');
    expect(status.tier).toBe('free');
    expect(status.status).toBe('active');
    expect(status.expiresAt).toBeDefined();
  });

  describe('applyReferralCode', () => {
    it('should successfully apply a valid referral code', async () => {
      const user: User = {
        id: 'user1',
        firebaseUid: 'user1',
        email: 'user1@example.com',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        createdAt: now,
        updatedAt: now,
        isActive: true,
      };

      const referrer: User = {
        id: 'referrer1',
        firebaseUid: 'referrer1',
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

      // Mock Firestore query for finding referrer
      firestoreMock.get = jest.fn().mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'referrer1',
            data: () => referrer,
          },
        ],
      });

      const result = await service.applyReferralCode('user1', 'REFCODE123');

      expect(result.success).toBe(true);
      expect(firestoreMock.update).toHaveBeenCalled();
    });

    it('should reject if user already has a referrer', async () => {
      const user: User = {
        id: 'user1',
        firebaseUid: 'user1',
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
        firebaseUid: 'user1',
        email: 'user1@example.com',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        createdAt: now,
        updatedAt: now,
        isActive: true,
      };

      jest.spyOn(service, 'getUserById').mockResolvedValue(user);

      firestoreMock.get = jest.fn().mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await service.applyReferralCode('user1', 'INVALID');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid');
    });

    it('should reject if user tries to use their own code', async () => {
      const user: User = {
        id: 'user1',
        firebaseUid: 'user1',
        email: 'user1@example.com',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        referralCode: 'MYCODE123',
        createdAt: now,
        updatedAt: now,
        isActive: true,
      };

      jest.spyOn(service, 'getUserById').mockResolvedValue(user);

      firestoreMock.get = jest.fn().mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'user1', // Same user
            data: () => user,
          },
        ],
      });

      const result = await service.applyReferralCode('user1', 'MYCODE123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('your own');
    });
  });

  describe('getReferralStats', () => {
    it('should return referral stats for a user', async () => {
      const user: User = {
        id: 'user1',
        firebaseUid: 'user1',
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

      // Mock referrals count query
      firestoreMock.get = jest.fn().mockResolvedValue({
        size: 3,
        docs: [],
      });

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
