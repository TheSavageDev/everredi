import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';
import { UsersService } from '../users/users.service';

export interface UserCategory {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to convert PostgreSQL row to UserCategory
function rowToUserCategory(row: any): UserCategory {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    icon: row.icon_name,
    order: row.sort_order,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class UserCategoriesService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly usersService: UsersService,
  ) {}

  async getUserCategories(userId: string): Promise<UserCategory[]> {
    const { data, error } = await this.supabase
      .from('user_categories')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to get user categories: ${error.message}`);
    }

    const categories = (data || []).map(rowToUserCategory);
    // Secondary sort by name (if sort_order is the same)
    return categories.sort((a, b) => {
      if ((a.order || 0) !== (b.order || 0))
        return (a.order || 0) - (b.order || 0);
      return a.name.localeCompare(b.name);
    });
  }

  async getUserCategory(
    userId: string,
    categoryId: string,
  ): Promise<UserCategory | null> {
    const { data, error } = await this.supabase
      .from('user_categories')
      .select('*')
      .eq('id', categoryId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return rowToUserCategory(data);
  }

  async createUserCategory(
    userId: string,
    categoryData: Omit<
      UserCategory,
      'id' | 'userId' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<UserCategory> {
    const now = new Date();

    // Get current max order
    const existingCategories = await this.getUserCategories(userId);
    const maxOrder = existingCategories.reduce(
      (max, cat) => Math.max(max, cat.order || 0),
      0,
    );

    const { data, error } = await this.supabase
      .from('user_categories')
      .insert({
        user_id: userId,
        name: categoryData.name,
        description: categoryData.description,
        icon_name: categoryData.icon,
        sort_order: categoryData.order ?? maxOrder + 1,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user category: ${error.message}`);
    }

    return rowToUserCategory(data);
  }

  async updateUserCategory(
    userId: string,
    categoryId: string,
    updates: Partial<Omit<UserCategory, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<UserCategory> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.icon !== undefined) updateData.icon_name = updates.icon;
    if (updates.order !== undefined) updateData.sort_order = updates.order;

    const { data, error } = await this.supabase
      .from('user_categories')
      .update(updateData)
      .eq('id', categoryId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('User category not found');
      }
      throw new Error(`Failed to update user category: ${error.message}`);
    }

    return rowToUserCategory(data);
  }

  async deleteUserCategory(userId: string, categoryId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_categories')
      .delete()
      .eq('id', categoryId)
      .eq('user_id', userId);

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('User category not found');
      }
      throw new Error(`Failed to delete user category: ${error.message}`);
    }
  }

  async reorderCategories(
    userId: string,
    categoryIds: string[],
  ): Promise<void> {
    // Update each category's order
    for (let index = 0; index < categoryIds.length; index++) {
      const { error } = await this.supabase
        .from('user_categories')
        .update({
          sort_order: index,
          updated_at: new Date().toISOString(),
        })
        .eq('id', categoryIds[index])
        .eq('user_id', userId);

      if (error) {
        throw new Error(
          `Failed to reorder category ${categoryIds[index]}: ${error.message}`,
        );
      }
    }
  }
}
