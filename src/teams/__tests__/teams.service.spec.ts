import { TeamsService } from '../teams.service';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';
import { UsersService } from '../../users/users.service';

describe('TeamsService', () => {
  let service: TeamsService;
  const supabaseMock = createSupabaseClientMock();
  const usersService = {} as UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();
    service = new TeamsService(supabaseMock as any, usersService);
  });

  describe('getTeamsByUser', () => {
    it('returns teams where user is owner or member', async () => {
      (supabaseMock._setMockData as jest.Mock)('teams', [
        {
          id: 'team-1',
          name: 'Team A',
          owner_id: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      (supabaseMock._setMockData as jest.Mock)('team_members', []);

      const result = await service.getTeamsByUser('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Team A');
      expect(result[0].ownerId).toBe('user-1');
    });

    it('returns empty array when user has no teams', async () => {
      (supabaseMock._setMockData as jest.Mock)('teams', []);
      (supabaseMock._setMockData as jest.Mock)('team_members', []);

      const result = await service.getTeamsByUser('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getTeam', () => {
    it('returns team when found', async () => {
      (supabaseMock._setMockData as jest.Mock)('teams', [
        {
          id: 'team-1',
          name: 'Team A',
          owner_id: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const result = await service.getTeam('team-1');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Team A');
    });

    it('returns null when not found', async () => {
      (supabaseMock._setMockData as jest.Mock)('teams', []);

      const result = await service.getTeam('missing');

      expect(result).toBeNull();
    });
  });
});
