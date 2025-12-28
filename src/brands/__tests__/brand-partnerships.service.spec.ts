import {
  BrandPartnershipsService,
  BrandPartnership,
} from '../brand-partnerships.service';
import { Timestamp } from 'firebase-admin/firestore';
import { createFirebaseServiceMock } from '../../../test/utils/firebase-service.mock';

describe('BrandPartnershipsService', () => {
  const firebaseServiceMock = createFirebaseServiceMock();
  let service: BrandPartnershipsService;

  beforeEach(() => {
    jest.clearAllMocks();
    (firebaseServiceMock._clearAll as jest.Mock)();
    service = new BrandPartnershipsService(firebaseServiceMock as any);
  });

  describe('getActivePartnerships', () => {
    it('should return active partnerships', async () => {
      const now = Timestamp.now();
      const partnership1: BrandPartnership = {
        id: '1',
        brandName: 'Test Brand',
        isActive: true,
        partnershipType: 'featured',
        priority: 10,
        startDate: Timestamp.fromMillis(now.toMillis() - 1000),
        createdAt: now,
        updatedAt: now,
      };

      (firebaseServiceMock._setMockData as jest.Mock)('brandPartnerships', [
        partnership1,
      ]);

      const result = await service.getActivePartnerships();

      expect(firebaseServiceMock.getCollection).toHaveBeenCalledWith(
        'brandPartnerships',
        expect.objectContaining({
          where: expect.arrayContaining([
            { field: 'isActive', operator: '==', value: true },
            { field: 'startDate', operator: '<=', value: expect.anything() },
          ]),
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].brandName).toBe('Test Brand');
    });

    it('should filter out expired partnerships', async () => {
      const now = Timestamp.now();
      const expiredPartnership: BrandPartnership = {
        id: '1',
        brandName: 'Expired Brand',
        isActive: true,
        partnershipType: 'featured',
        priority: 10,
        startDate: Timestamp.fromMillis(now.toMillis() - 2000),
        endDate: Timestamp.fromMillis(now.toMillis() - 1000), // Expired
        createdAt: now,
        updatedAt: now,
      };

      (firebaseServiceMock._setMockData as jest.Mock)('brandPartnerships', [
        expiredPartnership,
      ]);

      const result = await service.getActivePartnerships();

      // Service filters out expired partnerships in memory
      expect(result).toHaveLength(0);
    });

    it('should filter by categoryIds when provided', async () => {
      const now = Timestamp.now();
      const partnership1: BrandPartnership = {
        id: '1',
        brandName: 'Category Brand',
        isActive: true,
        partnershipType: 'featured',
        priority: 10,
        startDate: Timestamp.fromMillis(now.toMillis() - 1000),
        categoryIds: ['cat1', 'cat2'],
        createdAt: now,
        updatedAt: now,
      };

      const partnership2: BrandPartnership = {
        id: '2',
        brandName: 'Other Brand',
        isActive: true,
        partnershipType: 'featured',
        priority: 10,
        startDate: Timestamp.fromMillis(now.toMillis() - 1000),
        categoryIds: ['cat3'],
        createdAt: now,
        updatedAt: now,
      };

      (firebaseServiceMock._setMockData as jest.Mock)('brandPartnerships', [
        partnership1,
        partnership2,
      ]);

      const result = await service.getActivePartnerships(['cat1']);

      expect(result).toHaveLength(1);
      expect(result[0].brandName).toBe('Category Brand');
    });

    it('should sort by priority and partnership type', async () => {
      const now = Timestamp.now();
      const partnership1: BrandPartnership = {
        id: '1',
        brandName: 'Low Priority',
        isActive: true,
        partnershipType: 'recommended',
        priority: 5,
        startDate: Timestamp.fromMillis(now.toMillis() - 1000),
        createdAt: now,
        updatedAt: now,
      };

      const partnership2: BrandPartnership = {
        id: '2',
        brandName: 'High Priority',
        isActive: true,
        partnershipType: 'featured',
        priority: 10,
        startDate: Timestamp.fromMillis(now.toMillis() - 1000),
        createdAt: now,
        updatedAt: now,
      };

      (firebaseServiceMock._setMockData as jest.Mock)('brandPartnerships', [
        partnership1,
        partnership2,
      ]);

      const result = await service.getActivePartnerships();

      expect(result).toHaveLength(2);
      expect(result[0].brandName).toBe('High Priority');
      expect(result[1].brandName).toBe('Low Priority');
    });
  });

  describe('getAllPartnerships', () => {
    it('should return all partnerships ordered by priority and name', async () => {
      const now = Timestamp.now();
      const partnership1: BrandPartnership = {
        id: '1',
        brandName: 'Brand A',
        isActive: true,
        partnershipType: 'featured',
        priority: 10,
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      (firebaseServiceMock._setMockData as jest.Mock)('brandPartnerships', [
        partnership1,
      ]);

      const result = await service.getAllPartnerships();

      expect(firebaseServiceMock.getCollection).toHaveBeenCalledWith(
        'brandPartnerships',
        expect.objectContaining({
          orderBy: { field: 'priority', direction: 'desc' },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getPartnership', () => {
    it('should return partnership by id', async () => {
      const now = Timestamp.now();
      const partnership: BrandPartnership = {
        id: '1',
        brandName: 'Test Brand',
        isActive: true,
        partnershipType: 'featured',
        priority: 10,
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      (firebaseServiceMock._setMockDocument as jest.Mock)(
        'brandPartnerships/1',
        partnership,
      );

      const result = await service.getPartnership('1');

      expect(firebaseServiceMock.getDocument).toHaveBeenCalledWith(
        'brandPartnerships',
        '1',
      );
      expect(result).toBeDefined();
      expect(result?.brandName).toBe('Test Brand');
    });

    it('should return null if partnership not found', async () => {
      const result = await service.getPartnership('nonexistent');

      expect(firebaseServiceMock.getDocument).toHaveBeenCalledWith(
        'brandPartnerships',
        'nonexistent',
      );
      expect(result).toBeNull();
    });
  });

  describe('createPartnership', () => {
    it('should create a new partnership', async () => {
      const now = Timestamp.now();
      const partnershipData = {
        brandName: 'New Brand',
        isActive: true,
        partnershipType: 'featured' as const,
        priority: 10,
        startDate: now,
      };

      const result = await service.createPartnership(partnershipData);

      expect(firebaseServiceMock.addDocument).toHaveBeenCalledWith(
        'brandPartnerships',
        expect.objectContaining({
          ...partnershipData,
          createdAt: expect.anything(),
          updatedAt: expect.anything(),
        }),
      );
      expect(result).toBeDefined();
      expect(result.brandName).toBe('New Brand');
    });
  });

  describe('updatePartnership', () => {
    it('should update an existing partnership', async () => {
      const now = Timestamp.now();
      const existingPartnership: BrandPartnership = {
        id: '1',
        brandName: 'Old Brand',
        isActive: true,
        partnershipType: 'featured',
        priority: 10,
        startDate: now,
        createdAt: now,
        updatedAt: now,
      };

      (firebaseServiceMock._setMockDocument as jest.Mock)(
        'brandPartnerships/1',
        existingPartnership,
      );

      const updates = {
        brandName: 'Updated Brand',
        priority: 15,
      };

      await service.updatePartnership('1', updates);

      expect(firebaseServiceMock.updateDocument).toHaveBeenCalledWith(
        'brandPartnerships',
        '1',
        expect.objectContaining({
          ...updates,
          updatedAt: expect.anything(),
        }),
      );
    });

    it('should throw NotFoundException if partnership not found', async () => {
      await expect(
        service.updatePartnership('nonexistent', { brandName: 'New' }),
      ).rejects.toThrow();
    });
  });

  describe('deletePartnership', () => {
    it('should delete a partnership', async () => {
      await service.deletePartnership('1');

      expect(firebaseServiceMock.deleteDocument).toHaveBeenCalledWith(
        'brandPartnerships',
        '1',
      );
    });

    it('should throw NotFoundException if partnership not found', async () => {
      // FirebaseService will throw if document doesn't exist
      (firebaseServiceMock.deleteDocument as jest.Mock).mockRejectedValue(
        new Error('Document not found'),
      );

      await expect(service.deletePartnership('nonexistent')).rejects.toThrow();
    });
  });
});
