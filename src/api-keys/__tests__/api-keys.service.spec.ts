import { ApiKeysService } from '../api-keys.service';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  const supabaseMock = createSupabaseClientMock();

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();
    service = new ApiKeysService(supabaseMock as any);
  });

  describe('getApiKeys', () => {
    it('returns api keys for user', async () => {
      (supabaseMock._setMockData as jest.Mock)('api_keys', [
        {
          id: 'key-1',
          user_id: 'user-1',
          name: 'My Key',
          key_hash: 'hash',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const result = await service.getApiKeys('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('My Key');
      expect(result[0].userId).toBe('user-1');
    });
  });

  describe('generateApiKey', () => {
    it('inserts and returns key', async () => {
      (supabaseMock._setMockData as jest.Mock)('api_keys', []);

      const result = await service.generateApiKey('user-1', 'New Key', 30);

      expect(result.key).toMatch(/^ek_/);
      expect(result.apiKey.name).toBe('New Key');
      expect(result.apiKey.userId).toBe('user-1');
      expect(supabaseMock.from).toHaveBeenCalledWith('api_keys');
    });
  });
});
