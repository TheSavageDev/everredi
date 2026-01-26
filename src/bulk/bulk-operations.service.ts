import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';
import { UsersService } from '../users/users.service';
import {
  InventoryService,
  InventoryItem,
} from '../inventory/inventory.service';
import { UserKitsService, UserKit } from '../kits/user-kits.service';

export interface BulkImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export interface BulkUpdateRequest {
  itemIds: string[];
  updates: Partial<InventoryItem>;
}

@Injectable()
export class BulkOperationsService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly usersService: UsersService,
    private readonly inventoryService: InventoryService,
    private readonly userKitsService: UserKitsService,
  ) {}

  async importInventoryFromJSON(
    userId: string,
    jsonData: unknown[],
  ): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    interface ImportRow {
      supplyName?: string;
      locationId?: string;
      actualQuantity?: number | string;
      status?: string;
      expirationDate?: string;
      purchaseDate?: string;
      purchasePrice?: number | string;
      supplier?: string;
      notes?: string;
      supplyId?: string;
      supplyCategoryId?: string;
    }

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i] as ImportRow;
      try {
        // Validate required fields
        if (
          !row.supplyName ||
          !row.locationId ||
          row.actualQuantity === undefined
        ) {
          throw new Error(
            'Missing required fields: supplyName, locationId, actualQuantity',
          );
        }

        // Convert dates if provided
        const expirationDate = row.expirationDate
          ? this.parseDate(row.expirationDate)
          : undefined;
        const purchaseDate = row.purchaseDate
          ? this.parseDate(row.purchaseDate)
          : undefined;

        const itemData: Omit<
          InventoryItem,
          'id' | 'userId' | 'createdAt' | 'updatedAt'
        > = {
          supplyName: row.supplyName,
          locationId: row.locationId,
          actualQuantity:
            typeof row.actualQuantity === 'number'
              ? row.actualQuantity
              : parseInt(String(row.actualQuantity), 10) || 0,
          // Status will be calculated based on quantities in createInventoryItem
          status: 'complete', // Default, will be recalculated
          expirationDate,
          purchaseDate,
          purchasePrice:
            row.purchasePrice !== undefined
              ? typeof row.purchasePrice === 'number'
                ? row.purchasePrice
                : parseFloat(String(row.purchasePrice))
              : undefined,
          supplier: row.supplier,
          notes: row.notes,
          supplyId: row.supplyId,
          supplyCategoryId: row.supplyCategoryId,
        };

        await this.inventoryService.createInventoryItem(userId, itemData);
        result.success++;
      } catch (error: unknown) {
        result.failed++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          row: i + 1,
          error: errorMessage,
        });
      }
    }

    return result;
  }

  async exportInventory(
    userId: string,
  ): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to export inventory: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      supplyName: item.supply_name,
      supplyId: item.supply_id,
      locationId: item.location_id,
      actualQuantity: item.actual_quantity ?? 0,
      status: item.status,
      expirationDate: item.expiration_date
        ? new Date(item.expiration_date).toISOString()
        : undefined,
      purchaseDate: item.purchase_date
        ? new Date(item.purchase_date).toISOString()
        : undefined,
      purchasePrice: item.purchase_price,
      supplier: item.supplier,
      notes: item.notes,
      supplyCategoryId: item.supply_category_id,
    }));
  }

  async exportKits(userId: string): Promise<Array<Record<string, unknown>>> {
    const kits = await this.userKitsService.getUserKits(userId);
    const result: Array<Record<string, unknown>> = [];

    for (const kit of kits) {
      const items = await this.userKitsService.getkitItems(userId, kit.id);
      result.push({
        id: kit.id,
        name: kit.name,
        locationId: kit.locationId,
        status: kit.status,
        notes: kit.notes,
        items: items.map((item) => ({
          supplyId: item.supplyId,
          supplyName: item.supplyName,
          requiredQuantity: item.requiredQuantity,
          actualQuantity: item.actualQuantity,
          status: item.status,
          notes: item.notes,
        })),
      });
    }

    return result;
  }

  async bulkUpdateInventory(
    userId: string,
    request: BulkUpdateRequest,
  ): Promise<{ updated: number; failed: number }> {
    let updated = 0;
    let failed = 0;

    for (const itemId of request.itemIds) {
      try {
        // Verify item belongs to user
        const { data: item, error: fetchError } = await this.supabase
          .from('inventory_items')
          .select('id')
          .eq('id', itemId)
          .eq('user_id', userId)
          .single();

        if (fetchError || !item) {
          failed++;
          continue;
        }

        // Prepare update data
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        if (request.updates.status !== undefined) {
          updateData.status = request.updates.status;
        }
        if (request.updates.locationId !== undefined) {
          updateData.location_id = request.updates.locationId;
        }
        if (request.updates.expirationDate !== undefined) {
          const expirationDateValue = request.updates.expirationDate;
          if (typeof expirationDateValue === 'string') {
            updateData.expiration_date = new Date(
              expirationDateValue,
            ).toISOString();
          } else if (expirationDateValue instanceof Date) {
            updateData.expiration_date = expirationDateValue.toISOString();
          }
        }

        const { error: updateError } = await this.supabase
          .from('inventory_items')
          .update(updateData)
          .eq('id', itemId)
          .eq('user_id', userId);

        if (updateError) {
          failed++;
        } else {
          updated++;
        }
      } catch {
        failed++;
      }
    }

    return { updated, failed };
  }

  async duplicateKit(
    userId: string,
    kitId: string,
    newName?: string,
  ): Promise<UserKit> {
    const kit = await this.userKitsService.getUserKit(userId, kitId);
    if (!kit) {
      throw new BadRequestException('Kit not found');
    }

    const items = await this.userKitsService.getkitItems(userId, kitId);

    // Create new kit
    const newKitData: Omit<
      UserKit,
      'id' | 'userId' | 'createdAt' | 'updatedAt'
    > = {
      name: newName || `${kit.name} (Copy)`,
      locationId: kit.locationId,
      status: 'active', // Default status for new kits
      notes: kit.notes,
    };

    const newKit = await this.userKitsService.createUserKit(userId, newKitData);

    // Copy items
    for (const item of items) {
      // When duplicating a kit, we want to copy the requirements
      // Actual items will be created separately by users
      await this.userKitsService.createKitItemInstance(userId, newKit.id, {
        supplyId: item.supplyId || '', // Required field, use empty string if undefined
        supplyName: item.supplyName || '',
        requiredQuantity: item.requiredQuantity ?? 0, // Use requiredQuantity if available, fallback to quantity
        notes: item.notes,
        // Don't pass inventoryItemId - we're creating a new kit, so items should be created fresh
      });
    }

    return newKit;
  }

  private parseDate(dateValue: any): Date | undefined {
    if (!dateValue) return undefined;

    if (dateValue instanceof Date) {
      return dateValue;
    }

    if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    if (dateValue instanceof Date) {
      return dateValue;
    }

    return undefined;
  }
}
