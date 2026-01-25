import { NotificationsService } from '../notifications.service';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';

describe('NotificationsService', () => {
  const supabaseMock = createSupabaseClientMock();
  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();
    service = new NotificationsService(supabaseMock);
  });

  it('retrieves notifications for a user', async () => {
    // Setup mock data
    (supabaseMock._setMockData as jest.Mock)('notifications', [
      {
        id: 'notif-1',
        user_id: 'user-1',
        type: 'expiration',
        title: 'Test',
        message: 'Test message',
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ]);

    const notifications = await service.getNotifications('user-1');
    expect(Array.isArray(notifications)).toBe(true);
    expect(notifications.length).toBe(1);
  });
});
