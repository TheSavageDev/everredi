import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';

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
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  async getCustomFields(userId: string): Promise<CustomFieldDefinition[]> {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('customFields')
      .orderBy('order', 'asc')
      .orderBy('name', 'asc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      userId,
      ...doc.data(),
    })) as CustomFieldDefinition[];
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

    const fieldRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('customFields')
      .doc();

    const field: Omit<CustomFieldDefinition, 'id'> = {
      userId,
      ...fieldData,
      order: fieldData.order ?? maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };

    await fieldRef.set(field);
    return { id: fieldRef.id, ...field };
  }

  async updateCustomField(
    userId: string,
    fieldId: string,
    updates: Partial<
      Omit<CustomFieldDefinition, 'id' | 'userId' | 'createdAt'>
    >,
  ): Promise<CustomFieldDefinition> {
    const fieldRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('customFields')
      .doc(fieldId);

    const doc = await fieldRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Custom field not found');
    }

    await fieldRef.update({
      ...updates,
      updatedAt: Timestamp.now(),
    });

    const updatedDoc = await fieldRef.get();
    return {
      id: updatedDoc.id,
      userId,
      ...updatedDoc.data(),
    } as CustomFieldDefinition;
  }

  async deleteCustomField(userId: string, fieldId: string): Promise<void> {
    const fieldRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('customFields')
      .doc(fieldId);

    const doc = await fieldRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Custom field not found');
    }

    await fieldRef.delete();
  }

  async reorderFields(userId: string, fieldIds: string[]): Promise<void> {
    const batch = this.firestore.batch();

    fieldIds.forEach((fieldId, index) => {
      const fieldRef = this.firestore
        .collection('users')
        .doc(userId)
        .collection('customFields')
        .doc(fieldId);
      batch.update(fieldRef, { order: index, updatedAt: Timestamp.now() });
    });

    await batch.commit();
  }
}
