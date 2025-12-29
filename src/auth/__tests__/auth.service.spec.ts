import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { Timestamp } from 'firebase-admin/firestore';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;

  beforeEach(() => {
    usersService = {
      createOrUpdateUser: jest.fn(),
    };

    service = new AuthService(usersService as UsersService);
  });

  it('delegates createOrUpdateUser to UsersService', async () => {
    const resultUser = {
      id: 'uid',
      firebaseUid: 'uid',
      email: 'test@example.com',
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isActive: true,
    };
    usersService.createOrUpdateUser = jest
      .fn()
      .mockResolvedValue(resultUser as any);

    const result = await service.createOrUpdateUser(
      'uid',
      'test@example.com',
      'Test User',
    );

    expect(usersService.createOrUpdateUser).toHaveBeenCalledWith(
      'uid',
      'test@example.com',
      'Test User',
    );
    expect(result).toBe(resultUser);
  });
});
