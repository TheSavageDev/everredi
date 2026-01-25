import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';

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
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomFieldValue {
  fieldId: string;
  value: string | number | boolean | null;
}

// Helper function to convert PostgreSQL row to CustomFieldDefinition
function rowToCustomField(row: any): CustomFieldDefinition {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.field_type,
    required: row.is_required,
    options: row.options || undefined,
    order: row.order || 0,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class CustomFieldsService {
  constructor(@Inject(SUPABASE) private readonly supabase: SupabaseClient) {}

  async getCustomFields(userId: string): Promise<CustomFieldDefinition[]> {
    const { data, error } = await this.supabase
      .from('custom_fields')
      .select('*')
      .eq('user_id', userId)
      .order('order', { ascending: true });

    if (error) {
      throw new Error(`Failed to get custom fields: ${error.message}`);
    }

    const fields = (data || []).map(rowToCustomField);
    // Secondary sort by name (if order is the same)
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
   * - Stores the field in the user's customFields table
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
    const now = new Date();

    // Get current max order
    const existingFields = await this.getCustomFields(userId);
    const maxOrder = existingFields.reduce(
      (max, field) => Math.max(max, field.order || 0),
      0,
    );

    const { data, error } = await this.supabase
      .from('custom_fields')
      .insert({
        user_id: userId,
        name: fieldData.name,
        field_type: fieldData.type,
        is_required: fieldData.required,
        options: fieldData.options || null,
        order: fieldData.order ?? maxOrder + 1,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create custom field: ${error.message}`);
    }

    return rowToCustomField(data);
  }

  async updateCustomField(
    userId: string,
    fieldId: string,
    updates: Partial<
      Omit<CustomFieldDefinition, 'id' | 'userId' | 'createdAt'>
    >,
  ): Promise<CustomFieldDefinition> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.type !== undefined) updateData.field_type = updates.type;
    if (updates.required !== undefined)
      updateData.is_required = updates.required;
    if (updates.options !== undefined)
      updateData.options = updates.options || null;
    if (updates.order !== undefined) updateData.order = updates.order;

    const { data, error } = await this.supabase
      .from('custom_fields')
      .update(updateData)
      .eq('id', fieldId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Custom field not found');
      }
      throw new Error(`Failed to update custom field: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('Custom field not found');
    }

    return rowToCustomField(data);
  }

  async deleteCustomField(userId: string, fieldId: string): Promise<void> {
    const { error } = await this.supabase
      .from('custom_fields')
      .delete()
      .eq('id', fieldId)
      .eq('user_id', userId);

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Custom field not found');
      }
      throw new Error(`Failed to delete custom field: ${error.message}`);
    }
  }

  async reorderFields(userId: string, fieldIds: string[]): Promise<void> {
    // Update each field's order
    for (let index = 0; index < fieldIds.length; index++) {
      const { error } = await this.supabase
        .from('custom_fields')
        .update({
          order: index,
          updated_at: new Date().toISOString(),
        })
        .eq('id', fieldIds[index])
        .eq('user_id', userId);

      if (error) {
        throw new Error(
          `Failed to reorder field ${fieldIds[index]}: ${error.message}`,
        );
      }
    }
  }
}
