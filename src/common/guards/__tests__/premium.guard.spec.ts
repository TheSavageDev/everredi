import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PremiumGuard } from '../premium.guard';
import { UsersService } from '../../../users/users.service';

describe('PremiumGuard', () => {
  let guard: PremiumGuard;
  let reflector: jest.Mocked<Partial<Reflector>>;
  let usersService: jest.Mocked<Partial<UsersService>>;

  const createMockContext = (user?: { uid: string }): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };
    usersService = {
      getSubscriptionStatus: jest.fn().mockResolvedValue({
        isPremium: true,
        tier: 'premium',
        status: 'active',
      }),
    };
    guard = new PremiumGuard(
      reflector as Reflector,
      usersService as UsersService,
    );
  });

  it('returns true when route is not premium', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    const context = createMockContext({ uid: 'user-1' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(usersService.getSubscriptionStatus).not.toHaveBeenCalled();
  });

  it('throws when user is missing on premium route', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    const context = createMockContext(undefined);

    const err = await guard.canActivate(context).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).response).toMatchObject({
      code: 'AUTH_REQUIRED',
    });
  });

  it('throws when user is not premium', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    (usersService.getSubscriptionStatus as jest.Mock).mockResolvedValue({
      isPremium: false,
      tier: 'free',
      status: 'active',
    });
    const context = createMockContext({ uid: 'user-1' });

    const err = await guard.canActivate(context).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).response).toMatchObject({
      code: 'PREMIUM_REQUIRED',
    });
  });

  it('returns true when user is premium', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    const context = createMockContext({ uid: 'user-1' });

    const result = await guard.canActivate(context);

    expect(usersService.getSubscriptionStatus).toHaveBeenCalledWith('user-1');
    expect(result).toBe(true);
  });
});
