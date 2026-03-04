import { RevenueCatService } from '../revenuecat.service';

const originalFetch = globalThis.fetch;

describe('RevenueCatService', () => {
  let service: RevenueCatService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REVENUECAT_SECRET_API_KEY = 'test-secret-key';
    service = new RevenueCatService();
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getCustomerInfo', () => {
    it('returns customer info from API', async () => {
      const mockResponse = {
        request_date: '2024-01-01',
        request_date_ms: 0,
        subscriber: {
          entitlements: {},
          first_seen: '',
          last_seen: '',
          management_url: null,
          non_subscriptions: {},
          original_app_user_id: 'user-1',
          other_purchases: {},
          subscriptions: {},
        },
      };

      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.getCustomerInfo('user-1');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.revenuecat.com/v1/subscribers/user-1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-secret-key',
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('throws on API error', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('User not found'),
      });

      await expect(service.getCustomerInfo('user-1')).rejects.toThrow(
        'RevenueCat API error',
      );
    });
  });

  describe('cancelSubscription', () => {
    it('throws when no active subscription', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            request_date: '',
            request_date_ms: 0,
            subscriber: { subscriptions: {}, entitlements: {} },
          }),
      });

      await expect(
        service.cancelSubscription('user-1', 'product_123'),
      ).rejects.toThrow('No active subscription found');
    });

    it('calls cancel endpoint when subscription exists', async () => {
      (globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              request_date: '',
              request_date_ms: 0,
              subscriber: {
                entitlements: {},
                subscriptions: {
                  product_123: { unsubscribe_detected_at: null },
                },
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

      await service.cancelSubscription('user-1', 'product_123');

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(globalThis.fetch).toHaveBeenLastCalledWith(
        'https://api.revenuecat.com/v1/subscribers/user-1/subscriptions/product_123/cancel',
        expect.objectContaining({
          method: 'POST',
          body: '{}',
        }),
      );
    });
  });

  describe('updateSubscription', () => {
    it('calls update endpoint with body', async () => {
      const mockResponse = {
        request_date: '',
        request_date_ms: 0,
        subscriber: {},
      };
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.updateSubscription('user-1', 'product_123', {
        expiresDate: '2025-01-01T00:00:00.000Z',
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.revenuecat.com/v1/subscribers/user-1/subscriptions/product_123',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ expiresDate: '2025-01-01T00:00:00.000Z' }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
