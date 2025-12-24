import {
  BrandPartnershipsService,
  BrandPartnership,
} from '../brand-partnerships.service';
import { Timestamp } from 'firebase-admin/firestore';

describe('BrandPartnershipsService', () => {
  let firestoreMock: any;
  let mockCollectionRef: any;
  let mockDocRef: any;
  let service: BrandPartnershipsService;

  beforeEach(() => {
    // Create a mock document reference
    mockDocRef = {
      id: 'doc-id',
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    // Create a mock collection reference
    mockCollectionRef = {
      doc: jest.fn((id?: string) => {
        if (id) {
          mockDocRef.id = id;
        }
        return mockDocRef;
      }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      }),
    };

    firestoreMock = {
      collection: jest.fn((name: string) => {
        if (name === 'brandPartnerships') {
          return mockCollectionRef;
        }
        return mockCollectionRef;
      }),
    };

    jest.clearAllMocks();
    service = new BrandPartnershipsService(firestoreMock);
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

      // Mock the query chain: collection().where().where().get()
      const queryMock = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [
            {
              id: '1',
              data: () => partnership1,
            },
          ],
        }),
      };

      // Override the collection to return a queryable mock
      firestoreMock.collection = jest.fn(() => queryMock);

      const result = await service.getActivePartnerships();

      expect(firestoreMock.collection).toHaveBeenCalledWith(
        'brandPartnerships',
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

      const queryMock = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [
            {
              id: '1',
              data: () => expiredPartnership,
            },
          ],
        }),
      };

      firestoreMock.collection = jest.fn(() => queryMock);

      const result = await service.getActivePartnerships();

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

      const queryMock = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [
            { id: '1', data: () => partnership1 },
            { id: '2', data: () => partnership2 },
          ],
        }),
      };

      firestoreMock.collection = jest.fn(() => queryMock);

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

      const queryMock = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [
            { id: '1', data: () => partnership1 },
            { id: '2', data: () => partnership2 },
          ],
        }),
      };

      firestoreMock.collection = jest.fn(() => queryMock);

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

      const collectionMock = {
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [
            {
              id: '1',
              data: () => partnership1,
            },
          ],
        }),
      };

      firestoreMock.collection = jest.fn(() => collectionMock);

      const result = await service.getAllPartnerships();

      expect(firestoreMock.collection).toHaveBeenCalledWith(
        'brandPartnerships',
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

      const docRef = mockCollectionRef.doc('1');
      (docRef.get as jest.Mock) = jest.fn().mockResolvedValue({
        exists: true,
        data: () => partnership,
      });

      const result = await service.getPartnership('1');

      expect(firestoreMock.collection).toHaveBeenCalledWith(
        'brandPartnerships',
      );
      expect(mockCollectionRef.doc).toHaveBeenCalledWith('1');
      expect(result).toBeDefined();
      expect(result?.brandName).toBe('Test Brand');
    });

    it('should return null if partnership not found', async () => {
      const docRef = mockCollectionRef.doc('nonexistent');
      (docRef.get as jest.Mock) = jest.fn().mockResolvedValue({
        exists: false,
      });

      const result = await service.getPartnership('nonexistent');

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

      const newDocRef = mockCollectionRef.doc();
      newDocRef.id = 'new-id';
      (newDocRef.set as jest.Mock) = jest.fn().mockResolvedValue(undefined);
      (newDocRef.get as jest.Mock) = jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          ...partnershipData,
          createdAt: now,
          updatedAt: now,
        }),
      });

      const result = await service.createPartnership(partnershipData);

      expect(firestoreMock.collection).toHaveBeenCalledWith(
        'brandPartnerships',
      );
      expect(mockCollectionRef.doc).toHaveBeenCalled();
      expect(newDocRef.set).toHaveBeenCalled();
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

      const docRef = mockCollectionRef.doc('1');
      (docRef.get as jest.Mock) = jest
        .fn()
        .mockResolvedValueOnce({
          exists: true,
          data: () => existingPartnership,
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ ...existingPartnership, brandName: 'Updated Brand' }),
        });
      (docRef.update as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      const updates = {
        brandName: 'Updated Brand',
        priority: 15,
      };

      await service.updatePartnership('1', updates);

      expect(mockCollectionRef.doc).toHaveBeenCalledWith('1');
      expect(docRef.get).toHaveBeenCalled();
      expect(docRef.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if partnership not found', async () => {
      const docRef = mockCollectionRef.doc('nonexistent');
      (docRef.get as jest.Mock) = jest.fn().mockResolvedValue({
        exists: false,
      });

      await expect(
        service.updatePartnership('nonexistent', { brandName: 'New' }),
      ).rejects.toThrow();
    });
  });

  describe('deletePartnership', () => {
    it('should delete a partnership', async () => {
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

      const docRef = mockCollectionRef.doc('1');
      (docRef.get as jest.Mock) = jest.fn().mockResolvedValue({
        exists: true,
        data: () => partnership,
      });
      (docRef.delete as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      await service.deletePartnership('1');

      expect(mockCollectionRef.doc).toHaveBeenCalledWith('1');
      expect(docRef.get).toHaveBeenCalled();
      expect(docRef.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if partnership not found', async () => {
      const docRef = mockCollectionRef.doc('nonexistent');
      (docRef.get as jest.Mock) = jest.fn().mockResolvedValue({
        exists: false,
      });

      await expect(service.deletePartnership('nonexistent')).rejects.toThrow();
    });
  });
});
