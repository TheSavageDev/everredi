import { Injectable, Inject, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';

const logger = new Logger('DeviceTokensService');

export interface DeviceToken {
  id?: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DeviceTokensService {
  constructor(@Inject(SUPABASE) private readonly supabase: SupabaseClient) {}

  /**
   * Register or update a device token for a user
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
  ): Promise<void> {
    try {
      // Check if token already exists for this user
      const { data: existing } = await this.supabase
        .from('device_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('token', token)
        .single();

      const now = new Date();

      if (existing) {
        // Update existing token
        const { error } = await this.supabase
          .from('device_tokens')
          .update({
            platform,
            is_active: true,
            updated_at: now.toISOString(),
          })
          .eq('id', existing.id);

        if (error) {
          throw new Error(`Failed to update device token: ${error.message}`);
        }
        logger.log(`Updated device token for user ${userId}`);
      } else {
        // Create new token
        const { error } = await this.supabase.from('device_tokens').insert({
          user_id: userId,
          token,
          platform,
          is_active: true,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        });

        if (error) {
          throw new Error(`Failed to register device token: ${error.message}`);
        }
        logger.log(`Registered new device token for user ${userId}`);
      }
    } catch (error) {
      logger.error(`Error registering device token for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get distinct user IDs that have at least one active device token (for broadcast audience).
   */
  async getDistinctUserIdsWithActiveTokens(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('device_tokens')
        .select('user_id')
        .eq('is_active', true);

      if (error) {
        logger.error(`Error fetching user IDs with tokens: ${error.message}`);
        return [];
      }

      const userIds = [...new Set((data || []).map((row) => row.user_id))];
      return userIds;
    } catch (error) {
      logger.error('Error in getDistinctUserIdsWithActiveTokens:', error);
      return [];
    }
  }

  /**
   * Get all device tokens for a user
   */
  async getUserDeviceTokens(userId: string): Promise<DeviceToken[]> {
    try {
      const { data, error } = await this.supabase
        .from('device_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to get device tokens: ${error.message}`);
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        token: row.token,
        platform: row.platform,
        userId: row.user_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));
    } catch (error) {
      logger.error(`Error getting device tokens for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Remove a device token
   */
  async removeDeviceToken(userId: string, token: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('device_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('token', token);

      if (error) {
        throw new Error(`Failed to remove device token: ${error.message}`);
      }
      logger.log(`Removed device token for user ${userId}`);
    } catch (error) {
      logger.error(`Error removing device token for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Remove all device tokens for a user (e.g., on logout)
   */
  async removeAllUserTokens(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('device_tokens')
        .update({ is_active: false })
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to remove all device tokens: ${error.message}`);
      }
      logger.log(`Removed all device tokens for user ${userId}`);
    } catch (error) {
      logger.error(
        `Error removing all device tokens for user ${userId}:`,
        error,
      );
      throw error;
    }
  }
}
