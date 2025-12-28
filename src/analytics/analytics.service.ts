import { Injectable, Inject } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../config/firebase.service';
import { UsersService } from '../users/users.service';
import { FIRESTORE } from '../config/firebase.provider';
import type { firestore } from 'firebase-admin';

export interface UsagePattern {
  supplyId: string;
  supplyName: string;
  usageCount: number;
  lastUsed?: Timestamp;
  averageUsagePerMonth: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface ExpirationForecast {
  itemId: string;
  supplyName: string;
  expirationDate: Timestamp;
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
  checkDate: Timestamp;
  missingItems: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  async getUsagePatterns(userId: string): Promise<UsagePattern[]> {
    // Get all inventory items
    const items = await this.firebaseService.getSubcollection(
      'users',
      userId,
      'inventoryItems',
    );

    // Group by supply and calculate usage
    const supplyUsage = new Map<
      string,
      {
        supplyId: string;
        supplyName: string;
        usageCount: number;
        lastUsed?: Timestamp;
        dates: Timestamp[];
      }
    >();

    items.forEach((item: any) => {
      if (item.status === 'used' && item.supplyId) {
        const defaultUsage = {
          supplyId: item.supplyId,
          supplyName: item.supplyName || 'Unknown',
          usageCount: 0,
          lastUsed: undefined as Timestamp | undefined,
          dates: [] as Timestamp[],
        };
        const existing = supplyUsage.get(item.supplyId) || defaultUsage;

        existing.usageCount++;
        if (
          item.updatedAt &&
          (!existing.lastUsed || item.updatedAt > existing.lastUsed)
        ) {
          existing.lastUsed = item.updatedAt;
        }
        if (item.updatedAt) {
          existing.dates.push(item.updatedAt);
        }

        supplyUsage.set(item.supplyId, existing);
      }
    });

    // Calculate trends and averages
    const now = Timestamp.now();
    const sixMonthsAgo = Timestamp.fromMillis(
      now.toMillis() - 180 * 24 * 60 * 60 * 1000,
    );

    const patterns: UsagePattern[] = [];

    for (const [supplyId, data] of supplyUsage.entries()) {
      const recentDates = data.dates.filter((date) => date >= sixMonthsAgo);
      const averageUsagePerMonth = recentDates.length / 6;

      // Simple trend calculation: compare first half vs second half of last 6 months
      const firstHalf = recentDates.filter(
        (date) =>
          date >=
            Timestamp.fromMillis(now.toMillis() - 90 * 24 * 60 * 60 * 1000) &&
          date <
            Timestamp.fromMillis(now.toMillis() - 45 * 24 * 60 * 60 * 1000),
      ).length;
      const secondHalf = recentDates.filter(
        (date) =>
          date >=
          Timestamp.fromMillis(now.toMillis() - 45 * 24 * 60 * 60 * 1000),
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
    const now = Timestamp.now();
    const futureDate = Timestamp.fromMillis(
      now.toMillis() + daysAhead * 24 * 60 * 60 * 1000,
    );

    const inventorySnapshot = await this.firebaseService.getSubcollection(
      'users',
      userId,
      'inventoryItems',
      {
        where: [{ field: 'status', operator: '==', value: 'active' }],
      },
    );

    const forecasts: ExpirationForecast[] = [];

    for (const item of inventorySnapshot) {
      if (item.expirationDate && item.expirationDate <= futureDate) {
        const expirationDate = item.expirationDate as Timestamp;
        const daysUntilExpiration = Math.ceil(
          (expirationDate.toMillis() - now.toMillis()) / (24 * 60 * 60 * 1000),
        );

        const estimatedValue = (item.purchasePrice || 0) * (item.quantity || 1);

        forecasts.push({
          itemId: item.id,
          supplyName: item.supplyName || 'Unknown',
          expirationDate,
          daysUntilExpiration,
          estimatedValue,
          category: item.categoryName,
        });
      }
    }

    // Sort by days until expiration
    return forecasts.sort(
      (a, b) => a.daysUntilExpiration - b.daysUntilExpiration,
    );
  }

  async getCostTracking(userId: string): Promise<CostTracking> {
    const items = await this.firebaseService.getSubcollection(
      'users',
      userId,
      'inventoryItems',
      {
        where: [{ field: 'status', operator: '==', value: 'active' }],
      },
    );

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

    items.forEach((item) => {
      const itemValue = (item.purchasePrice || 0) * (item.quantity || 1);
      totalInventoryValue += itemValue;

      const categoryId = item.categoryId || 'uncategorized';
      const categoryName = item.categoryName || 'Uncategorized';

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

    items.forEach((item) => {
      if (item.purchaseDate && item.purchasePrice) {
        const purchaseDate = (item.purchaseDate as Timestamp).toDate();
        if (purchaseDate >= oneYearAgo) {
          const monthKey = `${purchaseDate.getFullYear()}-${String(purchaseDate.getMonth() + 1).padStart(2, '0')}`;
          const existing = monthlySpending.get(monthKey) || 0;
          monthlySpending.set(
            monthKey,
            existing + item.purchasePrice * (item.quantity || 1),
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
    const kits = await this.firebaseService.getSubcollection(
      'users',
      userId,
      'userKits',
    );

    const trends: ComplianceTrend[] = [];

    for (const kit of kits) {
      // Get latest compliance check for this kit
      // Note: This is a nested subcollection (users/{userId}/userKits/{kitId}/complianceChecks)
      // FirebaseService doesn't support nested subcollections yet, so we use direct Firestore access
      const checksSnapshot = await this.firestore
        .collection('users')
        .doc(userId)
        .collection('userKits')
        .doc(kit.id)
        .collection('complianceChecks')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!checksSnapshot.empty) {
        const check = checksSnapshot.docs[0].data() as any;
        trends.push({
          kitId: kit.id,
          kitName: kit.name || 'Unnamed Kit',
          complianceScore: check.complianceScore || 0,
          checkDate: check.createdAt || Timestamp.now(),
          missingItems: check.missingItems?.length || 0,
        });
      }
    }

    // Sort by check date descending
    return trends
      .sort((a, b) => b.checkDate.toMillis() - a.checkDate.toMillis())
      .slice(0, limit);
  }
}
