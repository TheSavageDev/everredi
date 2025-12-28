import { ExpirationService } from '../expiration.service';
import { Timestamp } from 'firebase-admin/firestore';
import { createFirebaseServiceMock } from '../../../test/utils/firebase-service.mock';

describe('ExpirationService', () => {
  const firebaseServiceMock = createFirebaseServiceMock();

  let service: ExpirationService;

  beforeEach(() => {
    jest.clearAllMocks();
    (firebaseServiceMock._clearAll as jest.Mock)();
    service = new ExpirationService(firebaseServiceMock as any);
  });

  it('returns empty list when there are no expiring items', async () => {
    const items = await service.getExpiringItemsByThreshold('user-1', [30]);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(0);
  });

  it('performs bulk update of expiration dates', async () => {
    const updates = [
      { itemId: 'item-1', expirationDate: Timestamp.now() },
      { itemId: 'item-2', expirationDate: Timestamp.now() },
    ];

    // Setup mock documents
    (firebaseServiceMock._setMockDocument as jest.Mock)(
      'users/user-1/inventoryItems/item-1',
      { id: 'item-1', status: 'active' },
    );
    (firebaseServiceMock._setMockDocument as jest.Mock)(
      'users/user-1/inventoryItems/item-2',
      { id: 'item-2', status: 'active' },
    );

    await service.bulkUpdateExpirationDates('user-1', updates);

    expect(firebaseServiceMock.createBatch).toHaveBeenCalled();
    const batch = (firebaseServiceMock.createBatch as jest.Mock).mock.results[0]
      .value;
    expect(batch.update).toHaveBeenCalledTimes(updates.length);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});
