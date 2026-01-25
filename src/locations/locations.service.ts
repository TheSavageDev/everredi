import {
  ForbiddenException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';
import { UsersService } from '../users/users.service';

export interface Location {
  id: string;
  userId: string;
  name: string;
  description?: string;
  locationType: 'home' | 'office' | 'vehicle' | 'backpack' | 'general';
  address?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to convert PostgreSQL row to Location
function rowToLocation(row: any): Location {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    locationType: row.location_type,
    address: row.address,
    coordinates: row.coordinates,
    isPrimary: row.is_primary,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class LocationsService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly usersService: UsersService,
  ) {}

  async getLocations(userId: string): Promise<Location[]> {
    const { data, error } = await this.supabase
      .from('locations')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get locations: ${error.message}`);
    }

    return (data || []).map(rowToLocation);
  }

  async getLocation(userId: string, locationId: string): Promise<Location> {
    const { data, error } = await this.supabase
      .from('locations')
      .select('*')
      .eq('id', locationId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Location not found');
    }

    return rowToLocation(data);
  }

  async createLocation(
    userId: string,
    locationData: Omit<Location, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<Location> {
    const isPremium = await this.usersService.isPremiumUser(userId);
    if (!isPremium) {
      const { count, error: countError } = await this.supabase
        .from('locations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        // Log but continue
      }

      const locationCount = count || 0;
      const maxFreeLocations = 2;

      if (locationCount >= maxFreeLocations) {
        throw new ForbiddenException({
          code: 'LOCATION_LIMIT_REACHED',
          message:
            'You have reached the free limit of 2 locations. Upgrade to premium for unlimited locations.',
        });
      }
    }

    const now = new Date();
    const { data, error } = await this.supabase
      .from('locations')
      .insert({
        user_id: userId,
        name: locationData.name,
        description: locationData.description,
        location_type: locationData.locationType,
        address: locationData.address,
        coordinates: locationData.coordinates,
        is_primary: locationData.isPrimary,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create location: ${error.message}`);
    }

    return rowToLocation(data);
  }

  async updateLocation(
    userId: string,
    locationId: string,
    updates: Partial<Location>,
  ): Promise<Location> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.locationType !== undefined)
      updateData.location_type = updates.locationType;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.coordinates !== undefined)
      updateData.coordinates = updates.coordinates;
    if (updates.isPrimary !== undefined)
      updateData.is_primary = updates.isPrimary;

    const { data, error } = await this.supabase
      .from('locations')
      .update(updateData)
      .eq('id', locationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Location not found');
      }
      throw new Error(`Failed to update location: ${error.message}`);
    }

    return rowToLocation(data);
  }

  async deleteLocation(userId: string, locationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('locations')
      .delete()
      .eq('id', locationId)
      .eq('user_id', userId);

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Location not found');
      }
      throw new Error(`Failed to delete location: ${error.message}`);
    }
  }
}
