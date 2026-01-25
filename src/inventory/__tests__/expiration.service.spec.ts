import { ExpirationService } from '../expiration.service';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';

describe('ExpirationService', () => {
  const supabaseMock = createSupabaseClientMock();
  let service: ExpirationService;

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();
    service = new ExpirationService(supabaseMock);
  });

  it('returns empty list when there are no expiring items', async () => {
    // Mock empty inventory items
    (supabaseMock._setMockData as jest.Mock)('inventory_items', []);
    
    const items = await service.getExpiringItemsByThreshold('user-1', [30]);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(0);
  });

  it('performs bulk update of expiration dates', async () => {
    const updates = [
      { itemId: 'item-1', expirationDate: new Date() },
      { itemId: 'item-2', expirationDate: new Date() },
    ];

    // Setup mock documents
    (supabaseMock._setMockDocument as jest.Mock)('inventory_items', 'item-1', {
      id: 'item-1',
      status: 'active',
      user_id: 'user-1',
    });
    (supabaseMock._setMockDocument as jest.Mock)('inventory_items', 'item-2', {
      id: 'item-2',
      status: 'active',
      user_id: 'user-1',
    });

    await service.bulkUpdateExpirationDates('user-1', updates);

    // Verify update was called
    expect(supabaseMock.from).toHaveBeenCalledWith('inventory_items');
  });
});
