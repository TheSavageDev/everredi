import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';

export interface BrandPartnership {
  id: string;
  brandName: string;
  contactEmail?: string;
  contactName?: string;
  partnershipType?: string;
  status: 'active' | 'inactive' | 'pending';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to convert PostgreSQL row to BrandPartnership
function rowToBrandPartnership(row: any): BrandPartnership {
  return {
    id: row.id,
    brandName: row.brand_name,
    contactEmail: row.contact_email,
    contactName: row.contact_name,
    partnershipType: row.partnership_type,
    status: row.status,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class BrandPartnershipsService {
  constructor(@Inject(SUPABASE) private readonly supabase: SupabaseClient) {}

  /**
   * Gets all active brand partnerships.
   *
   * @returns Promise resolving to array of active BrandPartnership objects
   */
  async getActivePartnerships(
    _categoryIds?: string[],
  ): Promise<BrandPartnership[]> {
    const { data, error } = await this.supabase
      .from('brand_partnerships')
      .select('*')
      .eq('status', 'active')
      .order('brand_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to get active partnerships: ${error.message}`);
    }

    return (data || []).map(rowToBrandPartnership);
  }

  async getAllPartnerships(): Promise<BrandPartnership[]> {
    const { data, error } = await this.supabase
      .from('brand_partnerships')
      .select('*')
      .order('brand_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to get partnerships: ${error.message}`);
    }

    return (data || []).map(rowToBrandPartnership);
  }

  async getPartnership(
    partnershipId: string,
  ): Promise<BrandPartnership | null> {
    const { data, error } = await this.supabase
      .from('brand_partnerships')
      .select('*')
      .eq('id', partnershipId)
      .single();

    if (error || !data) {
      return null;
    }

    return rowToBrandPartnership(data);
  }

  async createPartnership(
    partnershipData: Omit<BrandPartnership, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BrandPartnership> {
    const now = new Date();
    const { data, error } = await this.supabase
      .from('brand_partnerships')
      .insert({
        brand_name: partnershipData.brandName,
        contact_email: partnershipData.contactEmail,
        contact_name: partnershipData.contactName,
        partnership_type: partnershipData.partnershipType,
        status: partnershipData.status,
        notes: partnershipData.notes,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create partnership: ${error.message}`);
    }

    return rowToBrandPartnership(data);
  }

  async updatePartnership(
    partnershipId: string,
    updates: Partial<Omit<BrandPartnership, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BrandPartnership> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.brandName !== undefined)
      updateData.brand_name = updates.brandName;
    if (updates.contactEmail !== undefined)
      updateData.contact_email = updates.contactEmail;
    if (updates.contactName !== undefined)
      updateData.contact_name = updates.contactName;
    if (updates.partnershipType !== undefined)
      updateData.partnership_type = updates.partnershipType;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    const { data, error } = await this.supabase
      .from('brand_partnerships')
      .update(updateData)
      .eq('id', partnershipId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update partnership: ${error.message}`);
    }

    return rowToBrandPartnership(data);
  }

  async deletePartnership(partnershipId: string): Promise<void> {
    const { error } = await this.supabase
      .from('brand_partnerships')
      .delete()
      .eq('id', partnershipId);

    if (error) {
      throw new Error(`Failed to delete partnership: ${error.message}`);
    }
  }
}
