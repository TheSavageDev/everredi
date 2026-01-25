import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';

export interface Tenant {
  id: string;
  type: 'personal' | 'team';
  name: string;
  ownerUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: Date;
}

function rowToTenant(row: any): Tenant {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    ownerUserId: row.owner_user_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToTenantMember(row: any): TenantMember {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    role: row.role,
    createdAt: new Date(row.created_at),
  };
}

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(@Inject(SUPABASE) private readonly supabase: SupabaseClient) {}

  /**
   * Get or create personal tenant for a user
   */
  async getOrCreatePersonalTenant(userId: string): Promise<Tenant> {
    // Check if tenants table exists (new schema)
    const { data: existing, error: findError } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('owner_user_id', userId)
      .eq('type', 'personal')
      .single();

    // If table doesn't exist, return a mock tenant (old schema compatibility)
    if (findError && (findError.message?.includes('schema cache') || findError.code === 'PGRST202' || findError.code === '42P01')) {
      this.logger.warn('tenants table not found - migrations 012-022 not run. Returning mock tenant for backward compatibility.');
      // Return a mock tenant that represents the user's personal workspace
      // In the old schema, each user is implicitly their own tenant
      return {
        id: userId, // Use user ID as tenant ID in old schema
        type: 'personal',
        name: 'Personal Workspace',
        ownerUserId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    if (!findError && existing) {
      return rowToTenant(existing);
    }

    // Get user info for tenant name
    const { data: user } = await this.supabase
      .from('users')
      .select('display_name, email')
      .eq('id', userId)
      .single();

    const tenantName = user?.display_name 
      ? `${user.display_name}'s Workspace`
      : user?.email 
      ? `${user.email}'s Workspace`
      : 'Personal Workspace';

    // Create personal tenant
    const { data: newTenant, error: createError } = await this.supabase
      .from('tenants')
      .insert({
        type: 'personal',
        name: tenantName,
        owner_user_id: userId,
      })
      .select()
      .single();

    if (createError || !newTenant) {
      this.logger.error(`Failed to create personal tenant: ${createError?.message}`);
      // If table doesn't exist, return mock tenant instead of throwing
      if (createError?.message?.includes('schema cache') || createError?.code === 'PGRST202' || createError?.code === '42P01') {
        this.logger.warn('tenants table not found - migrations 012-022 not run. Returning mock tenant for backward compatibility.');
        return {
          id: userId,
          type: 'personal',
          name: tenantName,
          ownerUserId: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      throw new Error(`Failed to create personal tenant: ${createError?.message}`);
    }

    // Create tenant member (owner)
    await this.supabase.from('tenant_members').insert({
      tenant_id: newTenant.id,
      user_id: userId,
      role: 'owner',
    });

    // Set as user default
    await this.supabase.from('user_defaults').upsert({
      user_id: userId,
      default_tenant_id: newTenant.id,
    });

    return rowToTenant(newTenant);
  }

  /**
   * Get user's default tenant
   */
  async getUserDefaultTenant(userId: string): Promise<Tenant> {
    const { data: userDefault, error } = await this.supabase
      .from('user_defaults')
      .select('default_tenant_id, tenants(*)')
      .eq('user_id', userId)
      .single();

    if (error || !userDefault) {
      // Fallback: get or create personal tenant
      return this.getOrCreatePersonalTenant(userId);
    }

    return rowToTenant(userDefault.tenants);
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<Tenant> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Tenant not found');
    }

    return rowToTenant(data);
  }

  /**
   * Get user's tenants (personal + teams)
   */
  async getUserTenants(userId: string): Promise<Tenant[]> {
    const { data: members, error } = await this.supabase
      .from('tenant_members')
      .select('tenant_id, tenants(*)')
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to get user tenants: ${error.message}`);
      return [];
    }

    return (members || []).map((m: any) => rowToTenant(m.tenants));
  }

  /**
   * Get tenant members
   */
  async getTenantMembers(tenantId: string): Promise<TenantMember[]> {
    const { data, error } = await this.supabase
      .from('tenant_members')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) {
      this.logger.error(`Failed to get tenant members: ${error.message}`);
      return [];
    }

    return (data || []).map(rowToTenantMember);
  }

  /**
   * Check if user has permission in tenant
   */
  async hasPermission(
    userId: string,
    tenantId: string,
    requiredRole?: 'owner' | 'admin' | 'member',
  ): Promise<boolean> {
    const { data: member, error } = await this.supabase
      .from('tenant_members')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single();

    if (error || !member) {
      return false;
    }

    if (!requiredRole) {
      return true; // Any role is sufficient
    }

    const roleHierarchy = { owner: 3, admin: 2, member: 1 };
    const userRoleLevel = roleHierarchy[member.role as keyof typeof roleHierarchy] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    return userRoleLevel >= requiredRoleLevel;
  }
}
