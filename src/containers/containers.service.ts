import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';

export interface Container {
  id: string;
  tenantId: string;
  type: 'kit' | 'backstock';
  name: string;
  locationId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

function rowToContainer(row: any): Container {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type,
    name: row.name,
    locationId: row.location_id,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
  };
}

@Injectable()
export class ContainersService {
  private readonly logger = new Logger(ContainersService.name);

  constructor(@Inject(SUPABASE) private readonly supabase: SupabaseClient) {}

  /**
   * Get container by ID
   */
  async getContainer(containerId: string): Promise<Container> {
    const { data, error } = await this.supabase
      .from('containers')
      .select('*')
      .eq('id', containerId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Container not found');
    }

    return rowToContainer(data);
  }

  /**
   * Get containers for a tenant
   * Note: All containers are kits now, but we keep type parameter for backward compatibility
   */
  async getTenantContainers(
    tenantId: string,
    type?: 'kit' | 'backstock',
  ): Promise<Container[]> {
    let query = this.supabase
      .from('containers')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    // All containers are kits now, but filter by name if backstock requested
    if (type === 'backstock') {
      query = query.eq('name', 'Backstock');
    } else {
      // Default to kits (all containers are kits)
      query = query.eq('type', 'kit');
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      this.logger.error(`Failed to get containers: ${error.message}`);
      return [];
    }

    return (data || []).map(rowToContainer);
  }

  /**
   * Get or create backstock container for tenant
   * Note: Backstock is now just a regular kit with name "Backstock"
   * This method is kept for backward compatibility but creates a regular kit
   */
  async getOrCreateBackstock(tenantId: string): Promise<Container> {
    const { data: existing, error: findError } = await this.supabase
      .from('containers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('type', 'kit')
      .eq('name', 'Backstock')
      .is('deleted_at', null)
      .single();

    if (!findError && existing) {
      return rowToContainer(existing);
    }

    const { data: newContainer, error: createError } = await this.supabase
      .from('containers')
      .insert({
        tenant_id: tenantId,
        type: 'kit', // All containers are kits now
        name: 'Backstock',
      })
      .select()
      .single();

    if (createError || !newContainer) {
      this.logger.error(
        `Failed to create backstock kit: ${createError?.message}`,
      );
      throw new Error(
        `Failed to create backstock kit: ${createError?.message}`,
      );
    }

    // Create kits record
    await this.supabase.from('kits').insert({
      container_id: newContainer.id,
      status: 'active',
    });

    return rowToContainer(newContainer);
  }

  /**
   * Create container
   * Note: All containers are kits now, but we keep type parameter for backward compatibility
   */
  async createContainer(
    tenantId: string,
    type: 'kit' | 'backstock',
    name: string,
    locationId?: string,
    metadata?: Record<string, any>,
  ): Promise<Container> {
    // All containers are kits now
    const { data, error } = await this.supabase
      .from('containers')
      .insert({
        tenant_id: tenantId,
        type: 'kit', // Always kit
        name,
        location_id: locationId,
        metadata,
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Failed to create container: ${error?.message}`);
      throw new Error(`Failed to create container: ${error?.message}`);
    }

    // Create kits record
    await this.supabase.from('kits').insert({
      container_id: data.id,
      status: 'active',
    });

    return rowToContainer(data);
  }

  /**
   * Update container
   */
  async updateContainer(
    containerId: string,
    updates: Partial<{
      name: string;
      locationId: string;
      metadata: Record<string, any>;
    }>,
  ): Promise<Container> {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.locationId !== undefined)
      updateData.location_id = updates.locationId;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    const { data, error } = await this.supabase
      .from('containers')
      .update(updateData)
      .eq('id', containerId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update container: ${error?.message}`);
      throw new Error(`Failed to update container: ${error?.message}`);
    }

    return rowToContainer(data);
  }

  /**
   * Delete container (soft delete)
   */
  async deleteContainer(containerId: string): Promise<void> {
    const { error } = await this.supabase
      .from('containers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', containerId);

    if (error) {
      this.logger.error(`Failed to delete container: ${error.message}`);
      throw new Error(`Failed to delete container: ${error.message}`);
    }
  }
}
