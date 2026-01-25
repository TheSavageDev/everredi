import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';
import { SupplyCategoriesService } from '../supply-categories/supply-categories.service';

export interface Supply {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  categoryName?: string;
  brand?: string;
  model?: string;
  barcode?: string;
  sku?: string;
  unitType: 'piece' | 'box' | 'pack' | 'roll' | 'bottle' | 'tube';
  defaultExpirationDays?: number;
  oshaRequired: boolean;
  isActive: boolean;
  affiliateLink?: string; // Optional affiliate link for monetization
  isSponsored?: boolean; // Admin toggle
  sponsoredBy?: string; // Brand/partner name
  sponsoredUntil?: any; // Optional expiration (Timestamp)
  sponsoredPriority?: number; // For ordering (higher = shown first)
  createdAt: any;
  updatedAt: any;
}

// Helper function to convert PostgreSQL row to Supply
function rowToSupply(row: any): Supply {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name,
    brand: row.brand,
    model: row.model,
    barcode: row.barcode,
    sku: row.sku,
    unitType: row.unit_type,
    defaultExpirationDays: row.default_expiration_days,
    oshaRequired: row.osha_required,
    isActive: row.is_active,
    affiliateLink: row.affiliate_link,
    isSponsored: row.is_sponsored,
    sponsoredBy: row.sponsored_by,
    sponsoredUntil: row.sponsored_until
      ? new Date(row.sponsored_until)
      : undefined,
    sponsoredPriority: row.sponsored_priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class SuppliesService {
  private categorySortOrderCache: Map<string, number> | null = null;

  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly supplyCategoriesService: SupplyCategoriesService,
  ) {}

  /**
   * Get category sort orders, with caching for performance
   */
  private async getCategorySortOrders(): Promise<Map<string, number>> {
    if (this.categorySortOrderCache) {
      return this.categorySortOrderCache;
    }

    const categories = await this.supplyCategoriesService.getCategories();
    const sortOrderMap = new Map<string, number>();
    
    for (const category of categories) {
      sortOrderMap.set(category.id, category.sortOrder);
    }

    this.categorySortOrderCache = sortOrderMap;
    return sortOrderMap;
  }

  /**
   * Check if a sponsorship is currently active (not expired)
   */
  private isSponsorshipActive(supply: Supply): boolean {
    if (!supply.isSponsored) {
      return false;
    }

    // If no expiration date, sponsorship never expires
    if (!supply.sponsoredUntil) {
      return true;
    }

    // Check if expiration date is in the future
    const expirationDate = supply.sponsoredUntil instanceof Date 
      ? supply.sponsoredUntil 
      : new Date(supply.sponsoredUntil);
    const now = new Date();

    return expirationDate > now;
  }

  /**
   * Filter supplies based on user's premium status and sponsorship expiration
   * Premium users see all supplies, free users see only non-sponsored or active sponsored supplies
   */
  private filterSuppliesByAccess(supplies: Supply[], isPremium: boolean): Supply[] {
    if (isPremium) {
      // Premium users see all supplies
      return supplies;
    }

    // Free users see only:
    // - Non-sponsored supplies, OR
    // - Sponsored supplies that are not expired
    return supplies.filter((supply) => {
      if (!supply.isSponsored) {
        return true; // Non-sponsored items are always visible
      }

      // Sponsored items are visible only if not expired
      return this.isSponsorshipActive(supply);
    });
  }

  /**
   * Sort supplies by category sort_order first, then alphabetically within category
   * Active (non-expired) sponsored items appear first within their category (by priority desc), then regular items alphabetically
   */
  private async sortSuppliesByCategory(supplies: Supply[]): Promise<Supply[]> {
    const categorySortOrders = await this.getCategorySortOrders();

    return supplies.sort((a, b) => {
      // 1. Sort by category sort_order (ascending)
      const sortOrderA = categorySortOrders.get(a.categoryId) ?? 9999;
      const sortOrderB = categorySortOrders.get(b.categoryId) ?? 9999;
      
      if (sortOrderA !== sortOrderB) {
        return sortOrderA - sortOrderB;
      }

      // 2. Same category: active sponsored items before non-sponsored and expired sponsored
      const aIsActiveSponsored = this.isSponsorshipActive(a);
      const bIsActiveSponsored = this.isSponsorshipActive(b);

      if (aIsActiveSponsored && !bIsActiveSponsored) return -1;
      if (!aIsActiveSponsored && bIsActiveSponsored) return 1;

      // 3. Both active sponsored: sort by priority (desc), then alphabetically
      if (aIsActiveSponsored && bIsActiveSponsored) {
        const priorityA = a.sponsoredPriority || 0;
        const priorityB = b.sponsoredPriority || 0;
        if (priorityA !== priorityB) {
          return priorityB - priorityA; // Higher priority first
        }
      }

      // 4. Final sort: alphabetical by name
      return a.name.localeCompare(b.name);
    });
  }

  async getSupplies(userId: string, isPremium: boolean, categoryId?: string): Promise<Supply[]> {
    let query = this.supabase
      .from('supplies')
      .select('*')
      .eq('is_active', true);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get supplies: ${error.message}`);
    }

    const supplies = (data || []).map(rowToSupply);

    // Filter by access (premium status and sponsorship expiration)
    const filteredSupplies = this.filterSuppliesByAccess(supplies, isPremium);

    // Sort: by category sort_order first, then alphabetically within category
    return this.sortSuppliesByCategory(filteredSupplies);
  }

  async searchSupplies(term: string, userId: string, isPremium: boolean): Promise<Supply[]> {
    const { data, error } = await this.supabase
      .from('supplies')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to search supplies: ${error.message}`);
    }

    const searchTerm = term.toLowerCase();
    const filtered = (data || [])
      .map(rowToSupply)
      .filter(
        (supply) =>
          supply.name.toLowerCase().includes(searchTerm) ||
          supply.description?.toLowerCase().includes(searchTerm) ||
          supply.barcode?.toLowerCase().includes(searchTerm),
      );

    // Filter by access (premium status and sponsorship expiration)
    const filteredByAccess = this.filterSuppliesByAccess(filtered, isPremium);

    // Sort: by category sort_order first, then alphabetically within category
    return this.sortSuppliesByCategory(filteredByAccess);
  }

  async getSupply(supplyId: string, userId: string, isPremium: boolean): Promise<Supply | null> {
    const { data, error } = await this.supabase
      .from('supplies')
      .select('*')
      .eq('id', supplyId)
      .single();

    if (error || !data) {
      return null;
    }

    const supply = rowToSupply(data);

    // Check if user has access to this supply
    const filtered = this.filterSuppliesByAccess([supply], isPremium);
    
    return filtered.length > 0 ? filtered[0] : null;
  }

  async updateSupply(
    supplyId: string,
    updates: Partial<Omit<Supply, 'id' | 'createdAt'>>,
  ): Promise<Supply> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.categoryId !== undefined)
      updateData.category_id = updates.categoryId;
    if (updates.categoryName !== undefined)
      updateData.category_name = updates.categoryName;
    if (updates.brand !== undefined) updateData.brand = updates.brand;
    if (updates.model !== undefined) updateData.model = updates.model;
    if (updates.barcode !== undefined) updateData.barcode = updates.barcode;
    if (updates.sku !== undefined) updateData.sku = updates.sku;
    if (updates.unitType !== undefined) updateData.unit_type = updates.unitType;
    if (updates.defaultExpirationDays !== undefined)
      updateData.default_expiration_days = updates.defaultExpirationDays;
    if (updates.oshaRequired !== undefined)
      updateData.osha_required = updates.oshaRequired;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.affiliateLink !== undefined)
      updateData.affiliate_link = updates.affiliateLink;
    if (updates.isSponsored !== undefined)
      updateData.is_sponsored = updates.isSponsored;
    if (updates.sponsoredBy !== undefined)
      updateData.sponsored_by = updates.sponsoredBy;
    if (updates.sponsoredUntil !== undefined) {
      updateData.sponsored_until = updates.sponsoredUntil
        ? (updates.sponsoredUntil instanceof Date
            ? updates.sponsoredUntil
            : new Date(updates.sponsoredUntil)
          ).toISOString()
        : null;
    }
    if (updates.sponsoredPriority !== undefined)
      updateData.sponsored_priority = updates.sponsoredPriority;

    const { data, error } = await this.supabase
      .from('supplies')
      .update(updateData)
      .eq('id', supplyId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update supply: ${error.message}`);
    }

    return rowToSupply(data);
  }
}
