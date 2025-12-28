import { Injectable, NotFoundException } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../config/firebase.service';

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'dropdown'
  | 'checkbox';

export interface CustomFieldDefinition {
  id: string;
  userId: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[]; // For dropdown type
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CustomFieldValue {
  fieldId: string;
  value: string | number | boolean | null;
}

@Injectable()
export class CustomFieldsService {
  constructor(private readonly firebaseService: FirebaseService) {}

  async getCustomFields(userId: string): Promise<CustomFieldDefinition[]> {
    const fields =
      await this.firebaseService.getSubcollection<CustomFieldDefinition>(
        'users',
        userId,
        'customFields',
        {
          orderBy: { field: 'order', direction: 'asc' },
        },
      );
    // Secondary sort by name (Firestore only supports one orderBy, so we do it in memory)
    return fields.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Creates a new custom field definition for a user.
   *
   * Custom fields allow users to add additional metadata to their inventory items.
   * Supported types: 'text', 'number', 'date', 'dropdown', 'checkbox'
   *
   * This method:
   * - Automatically calculates the order if not provided (appends to end)
   * - Sets createdAt and updatedAt timestamps
   * - Stores the field in the user's customFields subcollection
   *
   * @param userId - The ID of the user creating the field
   * @param fieldData - The field definition (name, type, required, options, order)
   * @returns Promise resolving to the created CustomFieldDefinition
   *
   * @example
   * ```typescript
   * const field = await service.createCustomField('user123', {
   *   name: 'Batch Number',
   *   type: 'text',
   *   required: false,
   *   order: 0
   * });
   *
   * // Dropdown field with options
   * const dropdown = await service.createCustomField('user123', {
   *   name: 'Quality',
   *   type: 'dropdown',
   *   required: true,
   *   options: ['Excellent', 'Good', 'Fair', 'Poor']
   * });
   * ```
   */
  async createCustomField(
    userId: string,
    fieldData: Omit<
      CustomFieldDefinition,
      'id' | 'userId' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<CustomFieldDefinition> {
    const now = Timestamp.now();

    // Get current max order
    const existingFields = await this.getCustomFields(userId);
    const maxOrder = existingFields.reduce(
      (max, field) => Math.max(max, field.order || 0),
      0,
    );

    const field: Omit<CustomFieldDefinition, 'id'> = {
      userId,
      ...fieldData,
      order: fieldData.order ?? maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };

    return this.firebaseService.addSubcollectionDocument<CustomFieldDefinition>(
      'users',
      userId,
      'customFields',
      field,
    );
  }

  async updateCustomField(
    userId: string,
    fieldId: string,
    updates: Partial<
      Omit<CustomFieldDefinition, 'id' | 'userId' | 'createdAt'>
    >,
  ): Promise<CustomFieldDefinition> {
    return this.firebaseService.updateSubcollectionDocument<CustomFieldDefinition>(
      'users',
      userId,
      'customFields',
      fieldId,
      {
        ...updates,
        updatedAt: Timestamp.now(),
      },
    );
  }

  async deleteCustomField(userId: string, fieldId: string): Promise<void> {
    await this.firebaseService.deleteSubcollectionDocument(
      'users',
      userId,
      'customFields',
      fieldId,
    );
  }

  async reorderFields(userId: string, fieldIds: string[]): Promise<void> {
    const batch = this.firebaseService.createBatch();

    fieldIds.forEach((fieldId, index) => {
      const ref = this.firebaseService.getSubcollectionDocumentRef(
        'users',
        userId,
        'customFields',
        fieldId,
      );
      batch.update(ref, { order: index, updatedAt: Timestamp.now() });
    });

    await batch.commit();
  }
}
