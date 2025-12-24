import { NotificationsService } from '../notifications.service';
import type { firestore } from 'firebase-admin';

describe('NotificationsService', () => {
  const firestoreMock: Partial<firestore.Firestore> = {
    collection: jest.fn().mockReturnThis() as any,
    doc: jest.fn().mockReturnThis() as any,
    where: jest.fn().mockReturnThis() as any,
    orderBy: jest.fn().mockReturnThis() as any,
    limit: jest.fn().mockReturnThis() as any,
    get: jest.fn().mockResolvedValue({
      docs: [],
    }) as any,
    update: jest.fn().mockResolvedValue(undefined) as any,
  };

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(firestoreMock as any);
  });

  it('retrieves notifications for a user', async () => {
    const notifications = await service.getNotifications('user-1');
    expect(Array.isArray(notifications)).toBe(true);
  });
});
