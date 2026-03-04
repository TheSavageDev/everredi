import { TenantsService } from '../tenants.service';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';

describe('TenantsService', () => {
  let service: TenantsService;
  const supabaseMock = createSupabaseClientMock();

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();
    service = new TenantsService(supabaseMock as any);
  });

  describe('getOrCreatePersonalTenant', () => {
    it('returns existing personal tenant when found', async () => {
      (supabaseMock._setMockData as jest.Mock)('tenants', [
        {
          id: 'tenant-1',
          type: 'personal',
          name: 'My Workspace',
          owner_user_id: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const result = await service.getOrCreatePersonalTenant('user-1');

      expect(result.id).toBe('tenant-1');
      expect(result.type).toBe('personal');
      expect(result.ownerUserId).toBe('user-1');
    });

    it('returns mock tenant when table does not exist (schema error)', async () => {
      (supabaseMock.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '42P01', message: 'relation "tenants" does not exist' },
        }),
      });

      const result = await service.getOrCreatePersonalTenant('user-1');

      expect(result.id).toBe('user-1');
      expect(result.type).toBe('personal');
      expect(result.name).toBe('Personal Workspace');
    });
  });
});
