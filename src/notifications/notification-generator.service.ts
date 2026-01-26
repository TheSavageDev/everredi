import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { NotificationsService } from './notifications.service';
import { SUPABASE } from '../config/supabase.provider';

@Injectable()
export class NotificationGeneratorService {
  constructor(
    private readonly notificationsService: NotificationsService,
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
  ) {}

  async generateExpirationNotifications(
    userId: string,
    thresholdDays: number[],
  ) {
    for (const days of thresholdDays) {
      const thresholdDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      const now = new Date();

      const { data: items, error } = await this.supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', userId)
        .gte('expiration_date', now.toISOString())
        .lte('expiration_date', thresholdDate.toISOString());

      if (error) {
        continue; // Log but continue with other thresholds
      }

      for (const item of items || []) {
        if (!item.expiration_date) continue;

        const expirationDate = new Date(item.expiration_date);
        const daysUntil = Math.ceil(
          (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        await this.notificationsService.createNotification(userId, {
          type: 'expiration',
          title: 'Item Expiring Soon',
          message: `${item.supply_name} expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
          data: {
            inventoryItemId: item.id,
            expirationDate: item.expiration_date,
          },
          isRead: false,
          sentAt: new Date(),
        });
      }
    }
  }

  async generateLowStockNotifications(userId: string, threshold: number = 5) {
    const { data: items, error } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId)
      .lte('actual_quantity', threshold);

    if (error) {
      throw new Error(`Failed to get inventory items: ${error.message}`);
    }

    for (const item of items || []) {
      await this.notificationsService.createNotification(userId, {
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${item.supply_name} is running low (${item.actual_quantity} remaining)`,
        data: {
          inventoryItemId: item.id,
        },
        isRead: false,
        sentAt: new Date(),
      });
    }
  }
}
