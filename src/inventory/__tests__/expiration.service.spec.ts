import { ExpirationService } from '../expiration.service';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

describe('ExpirationService', () => {
  const batchMock = {
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  const firestoreMock: Partial<firestore.Firestore> = {
    collection: jest.fn().mockReturnThis() as any,
    doc: jest.fn().mockReturnThis() as any,
    where: jest.fn().mockReturnThis() as any,
    orderBy: jest.fn().mockReturnThis() as any,
    limit: jest.fn().mockReturnThis() as any,
    get: jest.fn().mockResolvedValue({
      docs: [],
    }) as any,
    batch: jest.fn(() => batchMock) as any,
  };

  let service: ExpirationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExpirationService(firestoreMock as any);
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

    await service.bulkUpdateExpirationDates('user-1', updates);

    expect(firestoreMock.batch).toHaveBeenCalled();
    expect(batchMock.update).toHaveBeenCalledTimes(updates.length);
    expect(batchMock.commit).toHaveBeenCalledTimes(1);
  });
});
