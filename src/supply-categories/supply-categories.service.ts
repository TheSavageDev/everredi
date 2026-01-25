import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';

export interface SupplyCategory {
  id: string;
  name: string;
  description?: string;
  parentCategoryId?: string;
  parentCategoryPath?: string;
  iconName?: string;
  sortOrder: number;
  createdAt: any;
  updatedAt: any;
}

// Helper function to convert PostgreSQL row to SupplyCategory
function rowToSupplyCategory(row: any): SupplyCategory {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    parentCategoryId: row.parent_category_id,
    parentCategoryPath: row.parent_category_path,
    iconName: row.icon_name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class SupplyCategoriesService {
  constructor(@Inject(SUPABASE) private readonly supabase: SupabaseClient) {}

  async getCategories(): Promise<SupplyCategory[]> {
    const { data, error } = await this.supabase
      .from('supply_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to get categories: ${error.message}`);
    }

    return (data || []).map(rowToSupplyCategory);
  }

  async getCategory(categoryId: string): Promise<SupplyCategory | null> {
    const { data, error } = await this.supabase
      .from('supply_categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (error || !data) {
      return null;
    }

    return rowToSupplyCategory(data);
  }
}
