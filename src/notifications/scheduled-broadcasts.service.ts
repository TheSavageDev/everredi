import { Injectable, Inject, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';
import { Cron } from '@nestjs/schedule';
import { PushNotificationService } from './push-notification.service';

const logger = new Logger('ScheduledBroadcastsService');

export interface ScheduledBroadcast {
  id: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  scheduledAt: Date;
  status: 'pending' | 'sent' | 'cancelled';
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function rowToScheduledBroadcast(row: any): ScheduledBroadcast {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    data: row.data ?? null,
    scheduledAt: new Date(row.scheduled_at),
    status: row.status,
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class ScheduledBroadcastsService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /**
   * Run every 5 minutes: send due scheduled broadcasts
   */
  @Cron('*/5 * * * *')
  async processDueBroadcasts(): Promise<void> {
    const due = await this.getPendingDue();
    for (const row of due) {
      try {
        const data =
          row.data && typeof row.data === 'object'
            ? (row.data as Record<string, string>)
            : undefined;
        await this.pushNotificationService.sendBroadcast(
          row.title,
          row.body,
          data,
        );
        await this.markSent(row.id);
        logger.log(`Sent scheduled broadcast ${row.id}`);
      } catch (error) {
        logger.error(`Failed to send scheduled broadcast ${row.id}:`, error);
      }
    }
  }

  async create(
    title: string,
    body: string,
    scheduledAt: Date,
    data?: Record<string, string>,
  ): Promise<ScheduledBroadcast> {
    const now = new Date();
    const { data: row, error } = await this.supabase
      .from('scheduled_broadcasts')
      .insert({
        title,
        body,
        data: data ?? null,
        scheduled_at: scheduledAt.toISOString(),
        status: 'pending',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create scheduled broadcast: ${error.message}`);
    }
    return rowToScheduledBroadcast(row);
  }

  async list(
    status?: 'pending' | 'sent' | 'cancelled',
  ): Promise<ScheduledBroadcast[]> {
    let query = this.supabase
      .from('scheduled_broadcasts')
      .select('*')
      .order('scheduled_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list scheduled broadcasts: ${error.message}`);
    }
    return (data || []).map(rowToScheduledBroadcast);
  }

  async getById(id: string): Promise<ScheduledBroadcast | null> {
    const { data, error } = await this.supabase
      .from('scheduled_broadcasts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return rowToScheduledBroadcast(data);
  }

  async cancel(id: string): Promise<ScheduledBroadcast> {
    const now = new Date();
    const { data, error } = await this.supabase
      .from('scheduled_broadcasts')
      .update({
        status: 'cancelled',
        updated_at: now.toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel scheduled broadcast: ${error.message}`);
    }
    if (!data) {
      throw new Error(
        'Scheduled broadcast not found or already sent/cancelled',
      );
    }
    return rowToScheduledBroadcast(data);
  }

  private async getPendingDue(): Promise<any[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('scheduled_broadcasts')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true });

    if (error) {
      logger.error(`Error fetching due broadcasts: ${error.message}`);
      return [];
    }
    return data || [];
  }

  private async markSent(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.supabase
      .from('scheduled_broadcasts')
      .update({ status: 'sent', sent_at: now, updated_at: now })
      .eq('id', id);
  }
}
