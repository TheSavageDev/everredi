import { NotificationsService } from '../notifications.service';
import { createFirebaseServiceMock } from '../../../test/utils/firebase-service.mock';

describe('NotificationsService', () => {
  const firebaseServiceMock = createFirebaseServiceMock();

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    (firebaseServiceMock._clearAll as jest.Mock)();
    service = new NotificationsService(firebaseServiceMock as any);
  });

  it('retrieves notifications for a user', async () => {
    // Setup mock data
    (firebaseServiceMock._setMockData as jest.Mock)(
      'users/user-1/notifications',
      [
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'expiration',
          title: 'Test',
          message: 'Test message',
          isRead: false,
          createdAt: {} as any,
        },
      ],
    );

    const notifications = await service.getNotifications('user-1');
    expect(Array.isArray(notifications)).toBe(true);
    expect(firebaseServiceMock.getSubcollection).toHaveBeenCalledWith(
      'users',
      'user-1',
      'notifications',
      expect.objectContaining({
        orderBy: { field: 'createdAt', direction: 'desc' },
        limit: 100,
      }),
    );
  });
});
