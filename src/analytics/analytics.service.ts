import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';
import { UsersService } from '../users/users.service';

export interface UsagePattern {
  supplyId: string;
  supplyName: string;
  usageCount: number;
  lastUsed?: Date;
  averageUsagePerMonth: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface ExpirationForecast {
  itemId: string;
  supplyName: string;
  expirationDate: Date;
  daysUntilExpiration: number;
  estimatedValue: number;
  category?: string;
}

export interface CostTracking {
  totalInventoryValue: number;
  costByCategory: Array<{
    categoryId: string;
    categoryName: string;
    totalCost: number;
    itemCount: number;
  }>;
  monthlySpending: Array<{
    month: string;
    total: number;
  }>;
  yearlySpending: number;
}

export interface ComplianceTrend {
  kitId: string;
  kitName: string;
  complianceScore: number;
  checkDate: Date;
  missingItems: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly usersService: UsersService,
  ) {}

  async getUsagePatterns(userId: string): Promise<UsagePattern[]> {
    // Get all inventory items with status 'used'
    const { data: items, error } = await this.supabase
      .from('inventory_items')
      .select('id, supply_id, supply_name, updated_at')
      .eq('user_id', userId)
      .eq('status', 'used');

    if (error) {
      throw new Error(`Failed to get inventory items: ${error.message}`);
    }

    // Group by supply and calculate usage
    const supplyUsage = new Map<
      string,
      {
        supplyId: string;
        supplyName: string;
        usageCount: number;
        lastUsed?: Date;
        dates: Date[];
      }
    >();

    (items || []).forEach((item: any) => {
      if (item.supply_id) {
        const defaultUsage = {
          supplyId: item.supply_id,
          supplyName: item.supply_name || 'Unknown',
          usageCount: 0,
          lastUsed: undefined as Date | undefined,
          dates: [] as Date[],
        };
        const existing = supplyUsage.get(item.supply_id) || defaultUsage;

        existing.usageCount++;
        const updatedAt = item.updated_at
          ? new Date(item.updated_at)
          : undefined;
        if (
          updatedAt &&
          (!existing.lastUsed ||
            updatedAt.getTime() > existing.lastUsed.getTime())
        ) {
          existing.lastUsed = updatedAt;
        }
        if (updatedAt) {
          existing.dates.push(updatedAt);
        }

        supplyUsage.set(item.supply_id, existing);
      }
    });

    // Calculate trends and averages
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const patterns: UsagePattern[] = [];

    for (const [, data] of supplyUsage.entries()) {
      const recentDates = data.dates.filter(
        (date) => date.getTime() >= sixMonthsAgo.getTime(),
      );
      const averageUsagePerMonth = recentDates.length / 6;

      // Simple trend calculation: compare first half vs second half of last 6 months
      const firstHalf = recentDates.filter(
        (date) =>
          date.getTime() >= now.getTime() - 90 * 24 * 60 * 60 * 1000 &&
          date.getTime() < now.getTime() - 45 * 24 * 60 * 60 * 1000,
      ).length;
      const secondHalf = recentDates.filter(
        (date) => date.getTime() >= now.getTime() - 45 * 24 * 60 * 60 * 1000,
      ).length;

      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (secondHalf > firstHalf * 1.2) {
        trend = 'increasing';
      } else if (secondHalf < firstHalf * 0.8) {
        trend = 'decreasing';
      }

      patterns.push({
        supplyId: data.supplyId,
        supplyName: data.supplyName,
        usageCount: data.usageCount,
        lastUsed: data.lastUsed,
        averageUsagePerMonth,
        trend,
      });
    }

    // Sort by usage count descending
    return patterns.sort((a, b) => b.usageCount - a.usageCount);
  }

  async getExpirationForecast(
    userId: string,
    daysAhead: number = 90,
  ): Promise<ExpirationForecast[]> {
    const now = new Date();
    const futureDate = new Date(
      now.getTime() + daysAhead * 24 * 60 * 60 * 1000,
    );

    const { data: items, error } = await this.supabase
      .from('inventory_items')
      .select(
        'id, expiration_date, purchase_price, quantity, supply_name, supply_category_id',
      )
      .eq('user_id', userId)
      .eq('status', 'active')
      .not('expiration_date', 'is', null)
      .lte('expiration_date', futureDate.toISOString());

    if (error) {
      throw new Error(`Failed to get inventory items: ${error.message}`);
    }

    const forecasts: ExpirationForecast[] = [];

    for (const item of items || []) {
      if (item.expiration_date) {
        const expirationDate = new Date(item.expiration_date);
        const daysUntilExpiration = Math.ceil(
          (new Date(item.expiration_date).getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000),
        );

        const estimatedValue =
          (parseFloat(item.purchase_price) || 0) * (item.quantity || 1);

        // Get category name if needed
        let categoryName: string | undefined;
        if (item.supply_category_id) {
          const { data: category } = await this.supabase
            .from('supply_categories')
            .select('name')
            .eq('id', item.supply_category_id)
            .single();
          categoryName = category?.name;
        }

        forecasts.push({
          itemId: item.id,
          supplyName: item.supply_name || 'Unknown',
          expirationDate,
          daysUntilExpiration,
          estimatedValue,
          category: categoryName,
        });
      }
    }

    // Sort by days until expiration
    return forecasts.sort(
      (a, b) => a.daysUntilExpiration - b.daysUntilExpiration,
    );
  }

  async getCostTracking(userId: string): Promise<CostTracking> {
    const { data: items, error } = await this.supabase
      .from('inventory_items')
      .select('id, purchase_price, quantity, supply_category_id, purchase_date')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to get inventory items: ${error.message}`);
    }

    // Calculate total inventory value
    let totalInventoryValue = 0;
    const categoryCosts = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        totalCost: number;
        itemCount: number;
      }
    >();

    // Get category names
    const categoryIds = new Set(
      (items || [])
        .map((item: any) => item.supply_category_id)
        .filter((id: string) => id),
    );

    const categoryMap = new Map<string, string>();
    if (categoryIds.size > 0) {
      const { data: categories } = await this.supabase
        .from('supply_categories')
        .select('id, name')
        .in('id', Array.from(categoryIds));

      (categories || []).forEach((cat: any) => {
        categoryMap.set(cat.id, cat.name);
      });
    }

    (items || []).forEach((item: any) => {
      const itemValue =
        (parseFloat(item.purchase_price) || 0) * (item.quantity || 1);
      totalInventoryValue += itemValue;

      const categoryId = item.supply_category_id || 'uncategorized';
      const categoryName = categoryMap.get(categoryId) || 'Uncategorized';

      const existing = categoryCosts.get(categoryId) || {
        categoryId,
        categoryName,
        totalCost: 0,
        itemCount: 0,
      };

      existing.totalCost += itemValue;
      existing.itemCount++;
      categoryCosts.set(categoryId, existing);
    });

    // Get monthly spending from purchase dates
    const monthlySpending = new Map<string, number>();
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    (items || []).forEach((item: any) => {
      if (item.purchase_date && item.purchase_price) {
        const purchaseDate = new Date(item.purchase_date);
        if (purchaseDate >= oneYearAgo) {
          const monthKey = `${purchaseDate.getFullYear()}-${String(purchaseDate.getMonth() + 1).padStart(2, '0')}`;
          const existing = monthlySpending.get(monthKey) || 0;
          monthlySpending.set(
            monthKey,
            existing + parseFloat(item.purchase_price) * (item.quantity || 1),
          );
        }
      }
    });

    const monthlySpendingArray = Array.from(monthlySpending.entries())
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const yearlySpending = monthlySpendingArray.reduce(
      (sum, month) => sum + month.total,
      0,
    );

    return {
      totalInventoryValue,
      costByCategory: Array.from(categoryCosts.values()).sort(
        (a, b) => b.totalCost - a.totalCost,
      ),
      monthlySpending: monthlySpendingArray,
      yearlySpending,
    };
  }

  async getComplianceTrends(
    userId: string,
    limit: number = 10,
  ): Promise<ComplianceTrend[]> {
    // Get latest compliance check for each kit
    const { data: checks, error } = await this.supabase
      .from('compliance_checks')
      .select(
        'kit_id, compliance_score, checked_at, missing_items, kits(name)',
      )
      .eq('user_id', userId)
      .order('checked_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get compliance checks: ${error.message}`);
    }

    // Group by kit and get latest for each
    const kitMap = new Map<string, any>();
    (checks || []).forEach((check: any) => {
      if (!kitMap.has(check.kit_id)) {
        kitMap.set(check.kit_id, check);
      }
    });

    const trends: ComplianceTrend[] = Array.from(kitMap.values()).map(
      (check: any) => ({
        kitId: check.kit_id,
        kitName: check.kits?.name || 'Unnamed Kit',
        complianceScore: check.compliance_score || 0,
        checkDate: new Date(check.checked_at),
        missingItems: Array.isArray(check.missing_items)
          ? check.missing_items.length
          : 0,
      }),
    );

    // Sort by check date descending
    return trends
      .sort((a, b) => b.checkDate.getTime() - a.checkDate.getTime())
      .slice(0, limit);
  }
}
