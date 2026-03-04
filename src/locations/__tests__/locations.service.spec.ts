import { LocationsService } from '../locations.service';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';
import { UsersService } from '../../users/users.service';

describe('LocationsService', () => {
  let service: LocationsService;
  const supabaseMock = createSupabaseClientMock();
  let usersService: jest.Mocked<Partial<UsersService>>;

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();
    usersService = {};
    service = new LocationsService(supabaseMock as any, usersService as UsersService);
  });

  describe('getLocations', () => {
    it('returns locations for user', async () => {
      (supabaseMock._setMockData as jest.Mock)('locations', [
        {
          id: 'loc-1',
          user_id: 'user-1',
          name: 'Home',
          location_type: 'home',
          is_primary: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const result = await service.getLocations('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('loc-1');
      expect(result[0].name).toBe('Home');
      expect(result[0].locationType).toBe('home');
    });

    it('returns empty array when no locations', async () => {
      (supabaseMock._setMockData as jest.Mock)('locations', []);

      const result = await service.getLocations('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getLocation', () => {
    it('returns location when found', async () => {
      (supabaseMock._setMockData as jest.Mock)('locations', [
        {
          id: 'loc-1',
          user_id: 'user-1',
          name: 'Office',
          location_type: 'office',
          is_primary: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const result = await service.getLocation('user-1', 'loc-1');

      expect(result.id).toBe('loc-1');
      expect(result.name).toBe('Office');
    });

    it('throws NotFoundException when not found', async () => {
      (supabaseMock._setMockData as jest.Mock)('locations', []);

      await expect(
        service.getLocation('user-1', 'loc-missing'),
      ).rejects.toThrow('Location not found');
    });
  });
});
