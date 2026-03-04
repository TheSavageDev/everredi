import { SuppliesService } from '../supplies.service';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';
import { SupplyCategoriesService } from '../../supply-categories/supply-categories.service';

describe('SuppliesService', () => {
  let service: SuppliesService;
  const supabaseMock = createSupabaseClientMock();
  let supplyCategoriesService: jest.Mocked<Partial<SupplyCategoriesService>>;

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();
    supplyCategoriesService = {
      getCategories: jest.fn().mockResolvedValue([
        { id: 'cat-1', name: 'Cat1', sortOrder: 0 },
      ]),
    };
    service = new SuppliesService(
      supabaseMock as any,
      supplyCategoriesService as SupplyCategoriesService,
    );
  });

  describe('getSupplies', () => {
    it('returns supplies filtered and sorted', async () => {
      (supabaseMock._setMockData as jest.Mock)('supplies', [
        {
          id: 'sup-1',
          name: 'Supply A',
          category_id: 'cat-1',
          is_active: true,
          unit_type: 'piece',
          osha_required: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const result = await service.getSupplies('user-1', true);

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Supply A');
      expect(result[0].categoryId).toBe('cat-1');
    });

    it('filters by categoryId when provided', async () => {
      (supabaseMock._setMockData as jest.Mock)('supplies', [
        {
          id: 'sup-1',
          name: 'Supply A',
          category_id: 'cat-1',
          is_active: true,
          unit_type: 'piece',
          osha_required: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      await service.getSupplies('user-1', true, 'cat-1');

      expect(supabaseMock.from).toHaveBeenCalledWith('supplies');
    });
  });
});
