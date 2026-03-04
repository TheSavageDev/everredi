import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';

export interface TrackClickDto {
  supplyId: string;
  source: 'inventory' | 'ai' | 'restock' | 'kit';
}

@Injectable()
export class AffiliateTrackingService {
  constructor(@Inject(SUPABASE) private readonly supabase: SupabaseClient) {}

  async trackClick(
    userId: string,
    dto: TrackClickDto,
  ): Promise<{ success: boolean; id?: string }> {
    // Get supply information to get affiliate link
    const { data: supply, error: supplyError } = await this.supabase
      .from('supplies')
      .select('id, name, affiliate_link')
      .eq('id', dto.supplyId)
      .single();

    if (supplyError || !supply) {
      throw new Error(`Supply with id ${dto.supplyId} not found`);
    }

    if (!supply.affiliate_link) {
      throw new Error(`Supply ${dto.supplyId} does not have an affiliate link`);
    }

    // Check if tracking record exists
    const { data: existing } = await this.supabase
      .from('affiliate_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('supply_id', dto.supplyId)
      .single();

    if (existing) {
      // Increment click count
      const { error } = await this.supabase
        .from('affiliate_tracking')
        .update({
          click_count: (existing.click_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        throw new Error(`Failed to track click: ${error.message}`);
      }
      return { success: true, id: existing.id };
    } else {
      // Create new tracking record
      const { data: newRecord, error } = await this.supabase
        .from('affiliate_tracking')
        .insert({
          user_id: userId,
          supply_id: dto.supplyId,
          click_count: 1,
          conversion_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to track click: ${error.message}`);
      }
      return { success: true, id: newRecord.id };
    }
  }

  async getClicksByUser(
    userId: string,
    limit: number = 100,
  ): Promise<
    Array<{
      supplyId: string;
      supplyName: string;
      clickCount: number;
      conversionCount: number;
    }>
  > {
    const { data, error } = await this.supabase
      .from('affiliate_tracking')
      .select('supply_id, click_count, conversion_count, supplies(name)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get clicks: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      supplyId: row.supply_id,
      supplyName: row.supplies?.name || 'Unknown',
      clickCount: row.click_count || 0,
      conversionCount: row.conversion_count || 0,
    }));
  }
}
