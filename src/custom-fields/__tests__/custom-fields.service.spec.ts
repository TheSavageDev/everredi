import {
  CustomFieldsService,
  CustomFieldDefinition,
} from '../custom-fields.service';
import { NotFoundException } from '@nestjs/common';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';

describe('CustomFieldsService', () => {
  const supabaseMock = createSupabaseClientMock();
  let service: CustomFieldsService;

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();
    service = new CustomFieldsService(supabaseMock);
  });

  describe('getCustomFields', () => {
    it('should return custom fields for a user', async () => {
      const field1 = {
        id: '1',
        user_id: 'user1',
        name: 'Field 1',
        field_type: 'text',
        is_required: false,
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (supabaseMock._setMockData as jest.Mock)('custom_fields', [field1]);

      const result = await service.getCustomFields('user1');

      expect(supabaseMock.from).toHaveBeenCalledWith('custom_fields');
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
      expect(supabaseMock.from).toHaveBeenCalledWith('custom_fields');
    });

    it('should auto-assign order when not provided', async () => {
      const existingField = {
        id: '1',
        user_id: 'user1',
        name: 'Existing Field',
        type: 'text',
        required: false,
        order: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (supabaseMock._setMockData as jest.Mock)('custom_fields', [existingField]);
      jest.spyOn(service, 'getCustomFields').mockResolvedValue([{
        id: '1',
        userId: 'user1',
        name: 'Existing Field',
        type: 'text',
        required: false,
        order: 5,
        createdAt: new Date(existingField.created_at),
        updatedAt: new Date(existingField.updated_at),
      }]);

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
      const existingField = {
        id: '1',
        user_id: 'user1',
        name: 'Old Name',
        field_type: 'text',
        is_required: false,
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (supabaseMock._setMockDocument as jest.Mock)('custom_fields', '1', existingField);

      const updates = {
        name: 'New Name',
      };

      const result = await service.updateCustomField('user1', '1', updates);

      expect(supabaseMock.from).toHaveBeenCalledWith('custom_fields');
      expect(result.name).toBe('New Name');
    });

    it('should throw NotFoundException if field not found', async () => {
      // Mock empty result for update query
      (supabaseMock._setMockData as jest.Mock)('custom_fields', []);

      await expect(
        service.updateCustomField('user1', 'nonexistent', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCustomField', () => {
    it('should delete a custom field', async () => {
      const existingField = {
        id: '1',
        user_id: 'user1',
        name: 'Test Field',
        field_type: 'text',
        is_required: false,
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (supabaseMock._setMockDocument as jest.Mock)('custom_fields', '1', existingField);

      await service.deleteCustomField('user1', '1');

      expect(supabaseMock.from).toHaveBeenCalledWith('custom_fields');
    });

    it('should throw NotFoundException if field not found', async () => {
      (supabaseMock._setMockData as jest.Mock)('custom_fields', []);

      await expect(
        service.deleteCustomField('user1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorderFields', () => {
    it('should reorder fields using batch update', async () => {
      const fieldIds = ['field1', 'field2', 'field3'];
      
      // Setup mock fields
      (supabaseMock._setMockData as jest.Mock)('custom_fields', [
        { id: 'field1', user_id: 'user1', order: 0 },
        { id: 'field2', user_id: 'user1', order: 1 },
        { id: 'field3', user_id: 'user1', order: 2 },
      ]);

      await service.reorderFields('user1', fieldIds);

      expect(supabaseMock.from).toHaveBeenCalledWith('custom_fields');
    });
  });
});
