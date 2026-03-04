import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from '../admin.guard';
import { UsersService } from '../../../users/users.service';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let usersService: jest.Mocked<Partial<UsersService>>;

  const createMockContext = (user?: { uid: string }): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  };

  beforeEach(() => {
    usersService = {
      isAdminUser: jest.fn().mockResolvedValue(true),
    };
    guard = new AdminGuard(usersService as UsersService);
  });

  it('throws when user is missing', async () => {
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

  it('throws when user has no uid', async () => {
    const context = createMockContext({} as any);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('throws when user is not admin', async () => {
    (usersService.isAdminUser as jest.Mock).mockResolvedValue(false);
    const context = createMockContext({ uid: 'user-1' });

    const err = await guard.canActivate(context).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).response).toMatchObject({
      code: 'ADMIN_REQUIRED',
    });
  });

  it('returns true when user is admin', async () => {
    const context = createMockContext({ uid: 'admin-1' });

    const result = await guard.canActivate(context);

    expect(usersService.isAdminUser).toHaveBeenCalledWith('admin-1');
    expect(result).toBe(true);
  });
});
