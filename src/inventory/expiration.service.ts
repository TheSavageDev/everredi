import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';

@Injectable()
export class ExpirationService {
  constructor(@Inject(SUPABASE) private readonly supabase: SupabaseClient) {}

  async getExpiringItemsByThreshold(
    userId: string,
    thresholdDays: number[],
  ): Promise<any[]> {
    const results: any[] = [];

    for (const days of thresholdDays) {
      const thresholdDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      const now = new Date();

      const { data, error } = await this.supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', userId)
        .gte('expiration_date', now.toISOString())
        .lte('expiration_date', thresholdDate.toISOString())
        .order('expiration_date', { ascending: true });

      if (error) {
        // Log but continue with other thresholds
        continue;
      }

      results.push(
        ...(data || []).map((item) => ({
          ...item,
          thresholdDays: days,
        })),
      );
    }

    return results;
  }

  async bulkUpdateExpirationDates(
    userId: string,
    updates: Array<{ itemId: string; expirationDate: Date }>,
  ): Promise<void> {
    // Update each item individually (Supabase doesn't have true batch updates via JS client)
    for (const update of updates) {
      const { error } = await this.supabase
        .from('inventory_items')
        .update({
          expiration_date: update.expirationDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', update.itemId)
        .eq('user_id', userId);

      if (error) {
        // Log error but continue with other updates
        console.error(
          `Failed to update expiration date for item ${update.itemId}: ${error.message}`,
        );
      }
    }
  }
}
