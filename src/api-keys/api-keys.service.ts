import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';
import * as crypto from 'crypto';

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyHash: string; // Hashed version of the key
  usageCount?: number;
  lastUsed?: Date;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

// Helper function to convert PostgreSQL row to ApiKey
function rowToApiKey(row: any): ApiKey {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    keyHash: row.key_hash,
    usageCount: row.usage_count ?? undefined,
    lastUsed: row.last_used_at ? new Date(row.last_used_at) : undefined,
    createdAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    isActive: row.is_active,
  };
}

@Injectable()
export class ApiKeysService {
  constructor(@Inject(SUPABASE) private readonly supabase: SupabaseClient) {}

  async generateApiKey(
    userId: string,
    name: string,
    expiresInDays?: number,
  ): Promise<{ key: string; apiKey: ApiKey }> {
    // Generate a secure random API key
    const key = `ek_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = this.hashKey(key);

    const now = new Date();
    const expiresAt = expiresInDays
      ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const { data, error } = await this.supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        name,
        key_hash: keyHash,
        created_at: now.toISOString(),
        expires_at: expiresAt?.toISOString() || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to generate API key: ${error.message}`);
    }

    // Return the plain key only once (for display to user)
    return { key, apiKey: rowToApiKey(data) };
  }

  async getApiKeys(userId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
    const { data, error } = await this.supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get API keys: ${error.message}`);
    }

    return (data || []).map((row) => {
      const apiKey = rowToApiKey(row);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { keyHash, ...rest } = apiKey;
      return rest;
    });
  }

  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    const { error } = await this.supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId)
      .eq('user_id', userId);

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('API key not found');
      }
      throw new Error(`Failed to revoke API key: ${error.message}`);
    }
  }

  async getApiKeyUsage(
    userId: string,
    keyId: string,
  ): Promise<{ usageCount: number; lastUsed?: Date }> {
    const { data, error } = await this.supabase
      .from('api_keys')
      .select('*')
      .eq('id', keyId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('API key not found');
    }

    return {
      usageCount: data.usage_count ?? 0,
      lastUsed: data.last_used_at ? new Date(data.last_used_at) : undefined,
    };
  }

  async validateApiKey(
    key: string,
  ): Promise<{ userId: string; keyId: string } | null> {
    const keyHash = this.hashKey(key);

    // Search for matching hash in api_keys table
    const { data, error } = await this.supabase
      .from('api_keys')
      .select('id, user_id, expires_at, is_active, usage_count')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null;
    }

    // Update last used and increment usage counter
    await this.supabase
      .from('api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: (data.usage_count ?? 0) + 1,
      })
      .eq('id', data.id);

    return {
      userId: data.user_id,
      keyId: data.id,
    };
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}
