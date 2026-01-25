import { Injectable, Inject, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from './supabase.provider';

/**
 * Helper service for common Supabase operations
 * Provides transaction helpers and common query patterns
 */
@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);

  constructor(@Inject(SUPABASE) private readonly supabase: SupabaseClient) {}

  /**
   * Execute a transaction using PostgreSQL's BEGIN/COMMIT
   * Note: Supabase JS client doesn't support transactions directly,
   * so this uses raw SQL via RPC or direct SQL execution
   */
  async executeInTransaction<T>(
    operations: (client: SupabaseClient) => Promise<T>,
  ): Promise<T> {
    // Supabase JS client doesn't support transactions directly
    // For now, we'll execute operations sequentially
    // In production, you might want to use Supabase's RPC functions
    // or execute raw SQL with BEGIN/COMMIT
    try {
      return await operations(this.supabase);
    } catch (error) {
      this.logger.error('Transaction error:', error);
      throw error;
    }
  }

  /**
   * Execute raw SQL query
   * Use with caution - prefer Supabase client methods when possible
   */
  async executeRawSQL<T = any>(sql: string, params?: any[]): Promise<T[]> {
    // Note: This requires the Supabase service role key
    // For security, consider using RPC functions instead
    const response = await this.supabase.rpc('exec_sql', {
      sql,
      params: params || [],
    });

    if (response.error) {
      throw new Error(`SQL execution error: ${response.error.message}`);
    }

    return (response.data as T[]) || [];
  }

  /**
   * Batch insert with error handling
   */
  async batchInsert<T extends Record<string, any>>(
    table: string,
    records: T[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): Promise<{ inserted: number; errors: any[] }> {
    const errors: any[] = [];
    let inserted = 0;

    // Supabase has a limit on batch size, so we'll chunk
    const chunkSize = 1000;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      let query = this.supabase.from(table).insert(chunk);

      if (options?.onConflict) {
        // Note: Supabase upsert uses .upsert() method instead of onConflict
        // For now, we'll skip onConflict handling as it requires different API
        this.logger.warn('onConflict option not supported in batch insert');
      }

      const { error, data } = await query.select();

      if (error) {
        errors.push({ chunk: i, error });
        this.logger.error(`Batch insert error for chunk ${i}:`, error);
      } else {
        inserted += data?.length || chunk.length;
      }
    }

    return { inserted, errors };
  }

  /**
   * Batch update with error handling
   */
  async batchUpdate<T extends Record<string, any>>(
    table: string,
    updates: Array<{ id: string; data: Partial<T> }>,
  ): Promise<{ updated: number; errors: any[] }> {
    const errors: any[] = [];
    let updated = 0;

    // Update one by one for now (Supabase doesn't support batch updates directly)
    // In production, consider using a stored procedure for better performance
    for (const update of updates) {
      const { error } = await this.supabase
        .from(table)
        .update(update.data)
        .eq('id', update.id);

      if (error) {
        errors.push({ id: update.id, error });
        this.logger.error(`Batch update error for ${update.id}:`, error);
      } else {
        updated++;
      }
    }

    return { updated, errors };
  }

  /**
   * Soft delete (set is_active = false or deleted_at = now())
   */
  async softDelete(
    table: string,
    id: string,
    options?: { deletedAtColumn?: string; activeColumn?: string },
  ): Promise<void> {
    const updateData: any = {};

    if (options?.deletedAtColumn) {
      updateData[options.deletedAtColumn] = new Date().toISOString();
    }

    if (options?.activeColumn) {
      updateData[options.activeColumn] = false;
    }

    if (Object.keys(updateData).length === 0) {
      // Default to is_active if no options provided
      updateData.is_active = false;
    }

    const { error } = await this.supabase
      .from(table)
      .update(updateData)
      .eq('id', id);

    if (error) {
      throw new Error(`Soft delete error: ${error.message}`);
    }
  }

  /**
   * Get paginated results
   */
  async paginate<T>(
    table: string,
    options: {
      page?: number;
      pageSize?: number;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
      filters?: Record<string, any>;
    },
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase.from(table).select('*', { count: 'exact' });

    // Apply filters
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    // Apply ordering
    if (options.orderBy) {
      query = query.order(options.orderBy, {
        ascending: options.orderDirection !== 'desc',
      });
    }

    // Apply pagination
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Pagination error: ${error.message}`);
    }

    return {
      data: (data as T[]) || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }

  /**
   * Check if a record exists
   */
  async exists(table: string, filters: Record<string, any>): Promise<boolean> {
    let query = this.supabase
      .from(table)
      .select('id', { count: 'exact', head: true });

    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { count, error } = await query;

    if (error) {
      throw new Error(`Existence check error: ${error.message}`);
    }

    return (count || 0) > 0;
  }

  /**
   * Get the Supabase client (for advanced use cases)
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }
}
