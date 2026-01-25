import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';

export interface Notification {
  id: string;
  userId: string;
  type: 'expiration' | 'low_stock' | 'compliance' | 'system';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  sentAt?: Date;
  createdAt: Date;
}

// Helper function to convert PostgreSQL row to Notification
function rowToNotification(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    data: row.data,
    isRead: row.is_read,
    sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
    createdAt: new Date(row.created_at),
  };
}

@Injectable()
export class NotificationsService {
  constructor(@Inject(SUPABASE) private readonly supabase: SupabaseClient) {}

  async getNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await this.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to get notifications: ${error.message}`);
    }

    return (data || []).map(rowToNotification);
  }

  async createNotification(
    userId: string,
    notificationData: Omit<Notification, 'id' | 'userId' | 'createdAt'>,
  ): Promise<Notification> {
    const now = new Date();
    const { data, error } = await this.supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data,
        is_read: notificationData.isRead,
        sent_at: notificationData.sentAt
          ? notificationData.sentAt.toISOString()
          : null,
        created_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    return rowToNotification(data);
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      throw new Error(
        `Failed to mark all notifications as read: ${error.message}`,
      );
    }
  }
}
