import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';
import { UsersService } from '../users/users.service';

export interface AlertThreshold {
  id: string;
  userId: string;
  categoryId?: string;
  daysBeforeExpiration: number;
  alertLevel: 'warning' | 'critical';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LowStockAlert {
  id: string;
  userId: string;
  supplyId: string;
  supplyName: string;
  minimumQuantity: number;
  isActive: boolean;
  lastTriggeredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  emailFrequency: 'immediate' | 'daily' | 'weekly';
  expirationAlertsEnabled: boolean;
  lowStockAlertsEnabled: boolean;
  usageRemindersEnabled: boolean;
  updatedAt: Date;
}

// Helper functions to convert PostgreSQL rows
function rowToAlertThreshold(row: any): AlertThreshold {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    daysBeforeExpiration: row.days_before_expiration,
    alertLevel: row.alert_level,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToLowStockAlert(row: any): LowStockAlert {
  return {
    id: row.id,
    userId: row.user_id,
    supplyId: row.supply_id,
    supplyName: row.supply_name,
    minimumQuantity: row.minimum_quantity,
    isActive: row.is_active,
    lastTriggeredAt: row.last_triggered_at
      ? new Date(row.last_triggered_at)
      : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToNotificationPreferences(row: any): NotificationPreferences {
  return {
    userId: row.user_id,
    emailEnabled: row.email_enabled,
    pushEnabled: row.push_enabled,
    emailFrequency: row.email_frequency,
    expirationAlertsEnabled: row.expiration_alerts_enabled,
    lowStockAlertsEnabled: row.low_stock_alerts_enabled,
    usageRemindersEnabled: row.usage_reminders_enabled,
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class AdvancedNotificationsService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly usersService: UsersService,
  ) {}

  async getAlertThresholds(userId: string): Promise<AlertThreshold[]> {
    const { data, error } = await this.supabase
      .from('alert_thresholds')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to get alert thresholds: ${error.message}`);
    }

    return (data || []).map(rowToAlertThreshold);
  }

  async createAlertThreshold(
    userId: string,
    thresholdData: Omit<
      AlertThreshold,
      'id' | 'userId' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<AlertThreshold> {
    const now = new Date();
    const { data, error } = await this.supabase
      .from('alert_thresholds')
      .insert({
        user_id: userId,
        category_id: thresholdData.categoryId,
        days_before_expiration: thresholdData.daysBeforeExpiration,
        alert_level: thresholdData.alertLevel,
        is_active: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create alert threshold: ${error.message}`);
    }

    return rowToAlertThreshold(data);
  }

  async updateAlertThreshold(
    userId: string,
    thresholdId: string,
    updates: Partial<Omit<AlertThreshold, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<AlertThreshold> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.categoryId !== undefined)
      updateData.category_id = updates.categoryId;
    if (updates.daysBeforeExpiration !== undefined)
      updateData.days_before_expiration = updates.daysBeforeExpiration;
    if (updates.alertLevel !== undefined)
      updateData.alert_level = updates.alertLevel;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await this.supabase
      .from('alert_thresholds')
      .update(updateData)
      .eq('id', thresholdId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update alert threshold: ${error.message}`);
    }

    return rowToAlertThreshold(data);
  }

  async deleteAlertThreshold(
    userId: string,
    thresholdId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('alert_thresholds')
      .delete()
      .eq('id', thresholdId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete alert threshold: ${error.message}`);
    }
  }

  async getLowStockAlerts(userId: string): Promise<LowStockAlert[]> {
    const { data, error } = await this.supabase
      .from('low_stock_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to get low stock alerts: ${error.message}`);
    }

    return (data || []).map(rowToLowStockAlert);
  }

  async createLowStockAlert(
    userId: string,
    alertData: Omit<LowStockAlert, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<LowStockAlert> {
    const now = new Date();
    const { data, error } = await this.supabase
      .from('low_stock_alerts')
      .insert({
        user_id: userId,
        supply_id: alertData.supplyId,
        supply_name: alertData.supplyName,
        minimum_quantity: alertData.minimumQuantity,
        is_active: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create low stock alert: ${error.message}`);
    }

    return rowToLowStockAlert(data);
  }

  async updateLowStockAlert(
    userId: string,
    alertId: string,
    updates: Partial<Omit<LowStockAlert, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<LowStockAlert> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.supplyId !== undefined) updateData.supply_id = updates.supplyId;
    if (updates.supplyName !== undefined)
      updateData.supply_name = updates.supplyName;
    if (updates.minimumQuantity !== undefined)
      updateData.minimum_quantity = updates.minimumQuantity;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await this.supabase
      .from('low_stock_alerts')
      .update(updateData)
      .eq('id', alertId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update low stock alert: ${error.message}`);
    }

    return rowToLowStockAlert(data);
  }

  async deleteLowStockAlert(userId: string, alertId: string): Promise<void> {
    const { error } = await this.supabase
      .from('low_stock_alerts')
      .delete()
      .eq('id', alertId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete low stock alert: ${error.message}`);
    }
  }

  /**
   * Single source for "is push enabled" for a user (used by expiration and broadcast flows).
   * Reads notification_preferences.push_enabled; defaults to true when no row exists.
   */
  async isPushEnabled(userId: string): Promise<boolean> {
    const prefs = await this.getNotificationPreferences(userId);
    return prefs?.pushEnabled ?? true;
  }

  async getNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreferences | null> {
    const { data, error } = await this.supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Return defaults
      return {
        userId,
        emailEnabled: true,
        pushEnabled: true,
        emailFrequency: 'immediate',
        expirationAlertsEnabled: true,
        lowStockAlertsEnabled: true,
        usageRemindersEnabled: false,
        updatedAt: new Date(),
      };
    }

    return rowToNotificationPreferences(data);
  }

  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<Omit<NotificationPreferences, 'userId' | 'updatedAt'>>,
  ): Promise<NotificationPreferences> {
    const existing = await this.getNotificationPreferences(userId);
    const now = new Date();

    const updateData: any = {
      updated_at: now.toISOString(),
    };

    if (preferences.emailEnabled !== undefined)
      updateData.email_enabled = preferences.emailEnabled;
    if (preferences.pushEnabled !== undefined)
      updateData.push_enabled = preferences.pushEnabled;
    if (preferences.emailFrequency !== undefined)
      updateData.email_frequency = preferences.emailFrequency;
    if (preferences.expirationAlertsEnabled !== undefined)
      updateData.expiration_alerts_enabled =
        preferences.expirationAlertsEnabled;
    if (preferences.lowStockAlertsEnabled !== undefined)
      updateData.low_stock_alerts_enabled = preferences.lowStockAlertsEnabled;
    if (preferences.usageRemindersEnabled !== undefined)
      updateData.usage_reminders_enabled = preferences.usageRemindersEnabled;

    if (!existing || !existing.updatedAt) {
      // Create new preferences
      const { data, error } = await this.supabase
        .from('notification_preferences')
        .insert({
          user_id: userId,
          email_enabled: preferences.emailEnabled ?? true,
          push_enabled: preferences.pushEnabled ?? true,
          email_frequency: preferences.emailFrequency ?? 'immediate',
          expiration_alerts_enabled:
            preferences.expirationAlertsEnabled ?? true,
          low_stock_alerts_enabled: preferences.lowStockAlertsEnabled ?? true,
          usage_reminders_enabled: preferences.usageRemindersEnabled ?? false,
          updated_at: now.toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(
          `Failed to create notification preferences: ${error.message}`,
        );
      }

      return rowToNotificationPreferences(data);
    } else {
      // Update existing preferences
      const { data, error } = await this.supabase
        .from('notification_preferences')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(
          `Failed to update notification preferences: ${error.message}`,
        );
      }

      return rowToNotificationPreferences(data);
    }
  }
}
