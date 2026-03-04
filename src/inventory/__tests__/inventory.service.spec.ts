import { InventoryService } from '../inventory.service';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';
import { UsersService } from '../../users/users.service';
import { TenantsService } from '../../tenants/tenants.service';

describe('InventoryService', () => {
  let service: InventoryService;
  const supabaseMock = createSupabaseClientMock();
  let usersService: jest.Mocked<Partial<UsersService>>;
  let tenantsService: jest.Mocked<Partial<TenantsService>>;

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();
    usersService = {};
    tenantsService = {
      getUserDefaultTenant: jest.fn().mockResolvedValue({
        id: 'tenant-1',
        type: 'personal',
        name: 'Personal',
        ownerUserId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getUserTenants: jest.fn().mockResolvedValue([]),
    };
    service = new InventoryService(
      supabaseMock as any,
      usersService as UsersService,
      tenantsService as TenantsService,
      undefined,
      undefined,
    );
  });

  describe('getInventoryItemsPaginated', () => {
    it('returns paginated items for user tenants', async () => {
      (supabaseMock._setMockData as jest.Mock)('inventory_items', [
        {
          id: 'inv-1',
          user_id: 'user-1',
          tenant_id: 'tenant-1',
          supply_name: 'Bandage',
          location_id: 'loc-1',
          actual_quantity: 5,
          status: 'complete',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      (supabaseMock._setMockData as jest.Mock)('kits', []);

      const result = await service.getInventoryItemsPaginated('user-1', 1, 10);

      expect(tenantsService.getUserDefaultTenant).toHaveBeenCalledWith('user-1');
      expect(tenantsService.getUserTenants).toHaveBeenCalledWith('user-1');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].supplyName).toBe('Bandage');
      expect(result.page).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('throws when supabase returns error', async () => {
      (supabaseMock.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB error' },
        }),
      });

      await expect(
        service.getInventoryItemsPaginated('user-1', 1, 10),
      ).rejects.toThrow('Failed to get inventory items');
    });
  });
});
