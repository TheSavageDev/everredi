import {
  CustomFieldsService,
  CustomFieldDefinition,
} from '../custom-fields.service';
import { Timestamp } from 'firebase-admin/firestore';
import { NotFoundException } from '@nestjs/common';

describe('CustomFieldsService', () => {
  let firestoreMock: any;
  let service: CustomFieldsService;
  let mockSubcollectionRef: any;
  let mockFieldDoc: any;

  beforeEach(() => {
    // Create a mock document reference for custom fields
    mockFieldDoc = {
      id: 'field-id',
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    // Create a mock subcollection reference
    mockSubcollectionRef = {
      doc: jest.fn((id?: string) => {
        if (id) {
          mockFieldDoc.id = id;
        }
        return mockFieldDoc;
      }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [],
        empty: true,
        size: 0,
      }),
    };

    // Create a mock document reference that supports subcollections
    const mockUserDoc = {
      id: 'user-id',
      collection: jest.fn((subcollectionName: string) => {
        if (subcollectionName === 'customFields') {
          return mockSubcollectionRef;
        }
        return mockSubcollectionRef; // Default
      }),
      get: jest.fn(),
    };

    // Create a mock collection reference
    const mockCollectionRef = {
      doc: jest.fn((id: string) => {
        mockUserDoc.id = id;
        return mockUserDoc;
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
        if (name === 'users') {
          return mockCollectionRef;
        }
        return mockCollectionRef;
      }),
      batch: jest.fn().mockReturnValue({
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      }),
    };

    jest.clearAllMocks();
    service = new CustomFieldsService(firestoreMock);
  });

  describe('getCustomFields', () => {
    it('should return custom fields for a user', async () => {
      const now = Timestamp.now();
      const field1: CustomFieldDefinition = {
        id: '1',
        userId: 'user1',
        name: 'Field 1',
        type: 'text',
        required: false,
        order: 0,
        createdAt: now,
        updatedAt: now,
      };

      // Mock the get() call on the subcollection
      (mockSubcollectionRef.get as jest.Mock) = jest.fn().mockResolvedValue({
        docs: [
          {
            id: '1',
            data: () => field1,
          },
        ],
      });

      const result = await service.getCustomFields('user1');

      expect(firestoreMock.collection).toHaveBeenCalledWith('users');
      expect(mockSubcollectionRef.get).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Field 1');
    });

    it('should return empty array when no fields exist', async () => {
      (mockSubcollectionRef.get as jest.Mock) = jest.fn().mockResolvedValue({
        docs: [],
      });

      const result = await service.getCustomFields('user1');

      expect(result).toHaveLength(0);
    });
  });

  describe('createCustomField', () => {
    it('should create a new custom field', async () => {
      const now = Timestamp.now();
      const fieldData = {
        name: 'New Field',
        type: 'text' as const,
        required: false,
        order: 0,
      };

      // Mock getCustomFields to return empty array (no existing fields)
      jest.spyOn(service, 'getCustomFields').mockResolvedValue([]);

      // Mock the doc() call to return a new doc (no ID provided)
      const newFieldDoc = mockSubcollectionRef.doc();
      (newFieldDoc.set as jest.Mock) = jest.fn().mockResolvedValue(undefined);
      newFieldDoc.id = 'new-field-id';

      const result = await service.createCustomField('user1', fieldData);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Field');
      expect(result.userId).toBe('user1');
      expect(mockSubcollectionRef.doc).toHaveBeenCalled();
      expect(newFieldDoc.set).toHaveBeenCalled();
    });

    it('should auto-assign order when not provided', async () => {
      const now = Timestamp.now();
      const existingField: CustomFieldDefinition = {
        id: '1',
        userId: 'user1',
        name: 'Existing Field',
        type: 'text',
        required: false,
        order: 5,
        createdAt: now,
        updatedAt: now,
      };

      jest.spyOn(service, 'getCustomFields').mockResolvedValue([existingField]);

      const newFieldDoc = mockSubcollectionRef.doc();
      (newFieldDoc.set as jest.Mock) = jest.fn().mockResolvedValue(undefined);
      newFieldDoc.id = 'new-field-id';

      const fieldData = {
        name: 'New Field',
        type: 'text' as const,
        required: false,
      };

      const result = await service.createCustomField('user1', fieldData);

      expect(result.order).toBe(6); // maxOrder (5) + 1
    });
  });

  describe('updateCustomField', () => {
    it('should update an existing custom field', async () => {
      const now = Timestamp.now();
      const existingField: CustomFieldDefinition = {
        id: '1',
        userId: 'user1',
        name: 'Old Name',
        type: 'text',
        required: false,
        order: 0,
        createdAt: now,
        updatedAt: now,
      };

      const fieldDoc = mockSubcollectionRef.doc('1');
      (fieldDoc.get as jest.Mock) = jest
        .fn()
        .mockResolvedValueOnce({
          exists: true,
          data: () => existingField,
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ ...existingField, name: 'New Name' }),
        });
      (fieldDoc.update as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      const updates = {
        name: 'New Name',
      };

      const result = await service.updateCustomField('user1', '1', updates);

      expect(mockSubcollectionRef.doc).toHaveBeenCalledWith('1');
      expect(fieldDoc.get).toHaveBeenCalled();
      expect(fieldDoc.update).toHaveBeenCalled();
      expect(result.name).toBe('New Name');
    });

    it('should throw NotFoundException if field not found', async () => {
      const fieldDoc = mockSubcollectionRef.doc('nonexistent');
      (fieldDoc.get as jest.Mock) = jest.fn().mockResolvedValue({
        exists: false,
      });

      await expect(
        service.updateCustomField('user1', 'nonexistent', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCustomField', () => {
    it('should delete a custom field', async () => {
      const now = Timestamp.now();
      const field: CustomFieldDefinition = {
        id: '1',
        userId: 'user1',
        name: 'Field to Delete',
        type: 'text',
        required: false,
        order: 0,
        createdAt: now,
        updatedAt: now,
      };

      const fieldDoc = mockSubcollectionRef.doc('1');
      (fieldDoc.get as jest.Mock).mockResolvedValue({
        exists: true,
        data: () => field,
      });
      (fieldDoc.delete as jest.Mock).mockResolvedValue(undefined);

      await service.deleteCustomField('user1', '1');

      expect(mockSubcollectionRef.doc).toHaveBeenCalledWith('1');
      expect(fieldDoc.get).toHaveBeenCalled();
      expect(fieldDoc.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if field not found', async () => {
      const fieldDoc = mockSubcollectionRef.doc('nonexistent');
      (fieldDoc.get as jest.Mock) = jest.fn().mockResolvedValue({
        exists: false,
      });

      await expect(
        service.deleteCustomField('user1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorderFields', () => {
    it('should reorder fields using batch update', async () => {
      const batchMock = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };

      firestoreMock.batch = jest.fn().mockReturnValue(batchMock);

      const fieldIds = ['field1', 'field2', 'field3'];

      await service.reorderFields('user1', fieldIds);

      expect(firestoreMock.batch).toHaveBeenCalled();
      expect(batchMock.update).toHaveBeenCalledTimes(3);
      expect(batchMock.commit).toHaveBeenCalled();
    });
  });
});
