import {
  CustomFieldsService,
  CustomFieldDefinition,
} from '../custom-fields.service';
import { Timestamp } from 'firebase-admin/firestore';
import { NotFoundException } from '@nestjs/common';
import { createFirebaseServiceMock } from '../../../test/utils/firebase-service.mock';

describe('CustomFieldsService', () => {
  const firebaseServiceMock = createFirebaseServiceMock();
  let service: CustomFieldsService;

  beforeEach(() => {
    jest.clearAllMocks();
    (firebaseServiceMock._clearAll as jest.Mock)();
    service = new CustomFieldsService(firebaseServiceMock as any);
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

      (firebaseServiceMock._setMockData as jest.Mock)(
        'users/user1/customFields',
        [field1],
      );

      const result = await service.getCustomFields('user1');

      expect(firebaseServiceMock.getSubcollection).toHaveBeenCalledWith(
        'users',
        'user1',
        'customFields',
        expect.objectContaining({
          orderBy: { field: 'order', direction: 'asc' },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Field 1');
    });

    it('should return empty array when no fields exist', async () => {
      const result = await service.getCustomFields('user1');

      expect(result).toHaveLength(0);
    });
  });

  describe('createCustomField', () => {
    it('should create a new custom field', async () => {
      const fieldData = {
        name: 'New Field',
        type: 'text' as const,
        required: false,
        order: 0,
      };

      // Mock getCustomFields to return empty array (no existing fields)
      jest.spyOn(service, 'getCustomFields').mockResolvedValue([]);

      const result = await service.createCustomField('user1', fieldData);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Field');
      expect(result.userId).toBe('user1');
      expect(firebaseServiceMock.addSubcollectionDocument).toHaveBeenCalledWith(
        'users',
        'user1',
        'customFields',
        expect.objectContaining({
          ...fieldData,
          userId: 'user1',
          createdAt: expect.anything(),
          updatedAt: expect.anything(),
        }),
      );
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

      (firebaseServiceMock._setMockDocument as jest.Mock)(
        'users/user1/customFields/1',
        existingField,
      );

      const updates = {
        name: 'New Name',
      };

      const result = await service.updateCustomField('user1', '1', updates);

      expect(
        firebaseServiceMock.updateSubcollectionDocument,
      ).toHaveBeenCalledWith(
        'users',
        'user1',
        'customFields',
        '1',
        expect.objectContaining({
          ...updates,
          updatedAt: expect.anything(),
        }),
      );
      expect(result.name).toBe('New Name');
    });

    it('should throw NotFoundException if field not found', async () => {
      (
        firebaseServiceMock.updateSubcollectionDocument as jest.Mock
      ).mockRejectedValue(new NotFoundException('Document not found'));

      await expect(
        service.updateCustomField('user1', 'nonexistent', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCustomField', () => {
    it('should delete a custom field', async () => {
      await service.deleteCustomField('user1', '1');

      expect(
        firebaseServiceMock.deleteSubcollectionDocument,
      ).toHaveBeenCalledWith('users', 'user1', 'customFields', '1');
    });

    it('should throw NotFoundException if field not found', async () => {
      (
        firebaseServiceMock.deleteSubcollectionDocument as jest.Mock
      ).mockRejectedValue(new NotFoundException('Document not found'));

      await expect(
        service.deleteCustomField('user1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorderFields', () => {
    it('should reorder fields using batch update', async () => {
      const fieldIds = ['field1', 'field2', 'field3'];

      await service.reorderFields('user1', fieldIds);

      expect(firebaseServiceMock.createBatch).toHaveBeenCalled();
      const batch = (firebaseServiceMock.createBatch as jest.Mock).mock
        .results[0].value;
      expect(batch.update).toHaveBeenCalledTimes(3);
      expect(batch.commit).toHaveBeenCalled();
    });
  });
});
