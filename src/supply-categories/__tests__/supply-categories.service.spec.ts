import { SupplyCategoriesService } from '../supply-categories.service';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';

describe('SupplyCategoriesService', () => {
  let service: SupplyCategoriesService;
  const supabaseMock = createSupabaseClientMock();

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();
    service = new SupplyCategoriesService(supabaseMock as any);
  });

  describe('getCategories', () => {
    it('returns active categories ordered by sort_order', async () => {
      (supabaseMock._setMockData as jest.Mock)('supply_categories', [
        {
          id: 'cat-1',
          name: 'First',
          is_active: true,
          sort_order: 0,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const result = await service.getCategories();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('First');
      expect(result[0].sortOrder).toBe(0);
    });
  });

  describe('getCategory', () => {
    it('returns category when found', async () => {
      (supabaseMock._setMockData as jest.Mock)('supply_categories', [
        {
          id: 'cat-1',
          name: 'Test',
          sort_order: 0,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const result = await service.getCategory('cat-1');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Test');
    });

    it('returns null when not found', async () => {
      (supabaseMock._setMockData as jest.Mock)('supply_categories', []);

      const result = await service.getCategory('cat-missing');

      expect(result).toBeNull();
    });
  });
});
