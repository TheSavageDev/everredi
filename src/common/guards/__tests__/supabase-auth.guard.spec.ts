import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from '../supabase-auth.guard';

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;
  let supabaseMock: { auth: { getUser: jest.Mock } };

  const createMockContext = (headers: Record<string, string>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          method: 'GET',
          url: '/test',
          ip: '127.0.0.1',
        }),
      }),
    } as any;
  };

  beforeEach(() => {
    supabaseMock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'uid-1',
              email: 'test@example.com',
              user_metadata: {},
            },
          },
          error: null,
        }),
      },
    };
    guard = new SupabaseAuthGuard(supabaseMock as any);
  });

  it('throws when no authorization header', async () => {
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('No token provided');
  });

  it('throws when authorization is not Bearer', async () => {
    const context = createMockContext({
      authorization: 'Basic xyz',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('sets request.user and returns true when token is valid', async () => {
    const request = { headers: { authorization: 'Bearer valid-token' }, method: 'GET', url: '/test', ip: '127.0.0.1' };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;

    const result = await guard.canActivate(context);

    expect(supabaseMock.auth.getUser).toHaveBeenCalledWith('valid-token');
    expect(request.user).toEqual(
      expect.objectContaining({
        uid: 'uid-1',
        email: 'test@example.com',
      }),
    );
    expect(result).toBe(true);
  });

  it('throws when getUser returns error', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    });
    const context = createMockContext({ authorization: 'Bearer bad-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
