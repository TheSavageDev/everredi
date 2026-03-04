import { UserCategoriesService } from '../user-categories.service';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';
import { UsersService } from '../../users/users.service';

describe('UserCategoriesService', () => {
  let service: UserCategoriesService;
  const supabaseMock = createSupabaseClientMock();
  const usersService = {} as UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();
    service = new UserCategoriesService(supabaseMock as any, usersService);
  });

  it('getUserCategories returns categories for user', async () => {
    (supabaseMock._setMockData as jest.Mock)('user_categories', [
      {
        id: 'cat-1',
        user_id: 'user-1',
        name: 'First Aid',
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    const result = await service.getUserCategories('user-1');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('First Aid');
    expect(result[0].userId).toBe('user-1');
  });

  it('getUserCategory returns null when not found', async () => {
    (supabaseMock._setMockData as jest.Mock)('user_categories', []);

    const result = await service.getUserCategory('user-1', 'missing');

    expect(result).toBeNull();
  });
});
