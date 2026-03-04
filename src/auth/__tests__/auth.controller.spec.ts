import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;

  beforeEach(() => {
    authService = {
      createOrUpdateUser: jest.fn().mockResolvedValue({
        id: 'uid-1',
        email: 'test@example.com',
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
      }),
    };
    controller = new AuthController(authService as AuthService);
  });

  it('calls authService and returns success with user data', async () => {
    const req = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
    };
    const result = await controller.createOrUpdateUser(
      { uid: 'uid-1', email: 'test@example.com', name: 'Test' },
      req as any,
    );

    expect(authService.createOrUpdateUser).toHaveBeenCalledWith(
      'uid-1',
      'test@example.com',
      'Test',
    );
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.message).toContain('created or updated');
  });
});
