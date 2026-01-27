import {
  ForbiddenException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { UserKitsService } from '../kits/user-kits.service';

const logger = new Logger('InventoryService');

export interface InventoryItem {
  id: string;
  userId: string;
  supplyId?: string; // Optional: only if user selected from curated catalog
  supplyName: string; // Required: free-form name user enters
  supplyCategoryId?: string;
  locationId: string;
  locationName?: string;
  kitId?: string; // Optional: if this item belongs to a specific kit
  kitName?: string; // Optional: name of the kit this item belongs to
  // Quantity fields - actual_quantity for actual items, required_quantity for requirements
  actualQuantity: number; // Actual quantity on hand (for actual items)
  requiredQuantity?: number; // Required quantity (for kit items, both requirements and actual items)
  lotCode?: string; // Lot/batch identifier (stored directly on inventory_item)
  expirationDate?: Date;
  purchaseDate?: Date;
  purchasePrice?: number;
  supplier?: string;
  notes?: string;
  status: 'complete' | 'partial' | 'missing' | 'used' | 'disposed' | 'expired';
  sentNotifications?: string[]; // Array of days for which notifications have been sent (e.g., ['60', '30', '10', '1'])
  customFields?: Record<string, string | number | boolean | null>; // Custom field values keyed by fieldId
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to convert PostgreSQL row to InventoryItem
function rowToInventoryItem(row: any): InventoryItem {
  // Read actual_quantity and required_quantity directly from database columns
  const actualQty =
    row.actual_quantity !== undefined && row.actual_quantity !== null
      ? row.actual_quantity
      : row.is_requirement
        ? 0
        : 0; // Default to 0 if not set
  const requiredQty =
    row.required_quantity !== undefined && row.required_quantity !== null
      ? row.required_quantity
      : undefined;

  return {
    id: row.id,
    userId: row.user_id,
    supplyId: row.supply_id,
    supplyName: row.supply_name || row.freeform_name,
    supplyCategoryId: row.supply_category_id,
    locationId: row.location_id || '',
    locationName: row.location_name,
    kitId: row.kit_id,
    kitName: row.kit_name,
    // Use actual_quantity and required_quantity directly
    actualQuantity: actualQty,
    requiredQuantity: requiredQty,
    lotCode: row.lot_code, // Lot/batch identifier
    expirationDate: row.expiration_date
      ? new Date(row.expiration_date)
      : undefined,
    purchaseDate: row.purchase_date ? new Date(row.purchase_date) : undefined,
    purchasePrice: row.purchase_price,
    supplier: row.supplier,
    notes: row.notes,
    status: row.status,
    sentNotifications: row.sent_notifications || [],
    customFields: row.custom_fields,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class InventoryService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    @Inject(forwardRef(() => UserKitsService))
    private readonly userKitsService?: UserKitsService,
  ) {}

  /**
   * Converts a date value (string or object with toDate) to a Date
   */
  private convertToDate(
    dateValue: string | { toDate: () => Date } | Date | undefined,
  ): Date | undefined {
    if (!dateValue) {
      return undefined;
    }
    if (dateValue instanceof Date) {
      return dateValue;
    }
    if (typeof dateValue === 'string') {
      return new Date(dateValue);
    }
    // Handle objects with toDate method (for backward compatibility)
    if (
      typeof dateValue === 'object' &&
      'toDate' in dateValue &&
      typeof dateValue.toDate === 'function'
    ) {
      return dateValue.toDate();
    }
    return undefined;
  }

  async getInventoryItems(userId: string): Promise<InventoryItem[]> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Get inventory items (no lots aggregation needed - each item is already a single lot)
    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_requirement', false); // Only get actual items, not requirements

    if (error) {
      logger.error(`Error fetching inventory items: ${error.message}`);
      throw new Error(`Failed to get inventory items: ${error.message}`);
    }

    // Check for expired items and update their status
    const now = new Date();
    const lifecycleStates = ['used', 'disposed', 'expired'];
    const expiredUpdates: Array<{ id: string; supply_name: string }> = [];

    for (const item of data || []) {
      if (
        item.expiration_date &&
        new Date(item.expiration_date) < now &&
        !lifecycleStates.includes(item.status as string)
      ) {
        expiredUpdates.push({ id: item.id, supply_name: item.supply_name });
      }
    }

    // Batch update expired items
    if (expiredUpdates.length > 0) {
      for (const update of expiredUpdates) {
        try {
          await this.supabase
            .from('inventory_items')
            .update({
              status: 'expired',
              updated_at: now.toISOString(),
            })
            .eq('id', update.id)
            .eq('tenant_id', tenant.id);
        } catch (updateError) {
          logger.warn(
            `Failed to update expired status for item ${update.id}: ${updateError}`,
          );
        }
      }
      logger.log(
        `Updated ${expiredUpdates.length} items to expired status during getInventoryItems`,
      );
    }

    // Re-fetch items to get updated statuses
    const { data: updatedData, error: refetchError } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_requirement', false);

    if (refetchError) {
      logger.error(`Error refetching inventory items: ${refetchError.message}`);
      // Fall back to original data if refetch fails
      return (data || []).map((item: any) => rowToInventoryItem(item));
    }

    // Convert rows to InventoryItem - columns are already populated by database
    return (updatedData || []).map((item: any) => rowToInventoryItem(item));
  }

  async getInventoryItem(
    userId: string,
    itemId: string,
  ): Promise<InventoryItem> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Allow both requirements and actual items - kit items can be requirements
    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('id', itemId)
      .eq('tenant_id', tenant.id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Inventory item not found');
    }

    // Check if item has expired and update status if needed
    const lifecycleStates = ['used', 'disposed', 'expired'];
    const currentStatus = data.status as string;

    if (
      data.expiration_date &&
      new Date(data.expiration_date) < new Date() &&
      !lifecycleStates.includes(currentStatus)
    ) {
      try {
        const { data: updatedData, error: updateError } = await this.supabase
          .from('inventory_items')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId)
          .eq('tenant_id', tenant.id)
          .select()
          .single();

        if (!updateError && updatedData) {
          logger.log(`Updated item ${itemId} to expired status`);
          return rowToInventoryItem(updatedData);
        }
      } catch (updateError) {
        logger.warn(
          `Failed to update expired status for item ${itemId}: ${updateError}`,
        );
      }
    }

    return rowToInventoryItem(data);
  }

  /**
   * Creates a new inventory item for a user.
   *
   * This method:
   * - Checks if user is premium (premium users have unlimited items)
   * - For free users, enforces a limit of 100 active inventory items
   * - Converts date strings to PostgreSQL timestamps
   * - Initializes sentNotifications array for items with expiration dates
   *
   * @param userId - The ID of the user creating the item
   * @param itemData - The inventory item data (excluding auto-generated fields)
   * @returns Promise resolving to the created InventoryItem
   * @throws ForbiddenException if free user has reached the 100 item limit
   *
   * @example
   * ```typescript
   * const item = await inventoryService.createInventoryItem('user123', {
   *   supplyName: 'Bandages',
   *   locationId: 'loc123',
   *   actualQuantity: 10,
   *   status: 'complete',
   *   expirationDate: '2025-12-31'
   * });
   * ```
   */
  async createInventoryItem(
    userId: string,
    itemData: Omit<
      InventoryItem,
      'id' | 'userId' | 'createdAt' | 'updatedAt' | 'sentNotifications'
    > & { kitId?: string }, // kit_id for items in kits (nullable)
  ): Promise<InventoryItem> {
    const isPremium = await this.usersService.isPremiumUser(userId);

    if (!isPremium) {
      // Get user's tenant for scoping
      const tenant = await this.tenantsService.getUserDefaultTenant(userId);

      const { count, error: countError } = await this.supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('is_requirement', false); // Only count actual items, not requirements
      if (countError) {
        logger.error(`Error counting inventory items: ${countError.message}`);
      }

      const activeCount = count || 0;
      const maxFreeItems = 100;

      if (activeCount >= maxFreeItems) {
        throw new ForbiddenException({
          code: 'INVENTORY_LIMIT_REACHED',
          message:
            'You have reached the free limit of 100 active inventory items. Upgrade to premium for unlimited inventory.',
        });
      }
    }

    const now = new Date();

    // Convert date strings to Date objects
    const expirationDate = this.convertToDate(itemData.expirationDate);
    const purchaseDate = this.convertToDate(itemData.purchaseDate);

    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Use kitId directly (containers table was removed)
    let kitId = (itemData as any).kitId || (itemData as any).containerId;

    // If no kitId and requireKit is true, create a default kit for user's tenant
    // Note: kit_id can be NULL for standalone inventory (not in a kit)
    if (!kitId && (itemData as any).requireKit) {
      // Try to find an existing default kit
      const { data: defaultKit } = await this.supabase
        .from('kits')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('name', 'Default Kit')
        .is('deleted_at', null)
        .single();

      if (defaultKit) {
        kitId = defaultKit.id;
      } else {
        // Create default kit
        const { data: newKit } = await this.supabase
          .from('kits')
          .insert({
            tenant_id: tenant.id,
            name: 'Default Kit',
            status: 'active',
          })
          .select()
          .single();

        if (newKit) {
          kitId = newKit.id;
        }
      }
    }

    // Create inventory_item - all lot data stored directly on item
    // Use actualQuantity instead of quantity
    const actualQty =
      itemData.actualQuantity !== undefined ? itemData.actualQuantity : 0;

    // Calculate status based on quantities
    // Only auto-calculate for fulfillment states, preserve lifecycle states (used, disposed, expired)
    let calculatedStatus: 'complete' | 'partial' | 'missing' | 'used' | 'disposed' | 'expired';
    const lifecycleStates = ['used', 'disposed', 'expired'];
    if (
      itemData.status &&
      ['complete', 'partial', 'missing', 'used', 'disposed', 'expired'].includes(itemData.status)
    ) {
      calculatedStatus = itemData.status;
    } else if (itemData.requiredQuantity !== undefined) {
      // For kit items with required_quantity
      if (actualQty >= itemData.requiredQuantity) {
        calculatedStatus = 'complete';
      } else if (actualQty > 0) {
        calculatedStatus = 'partial';
      } else {
        calculatedStatus = 'missing';
      }
    } else {
      // For standalone items (no required_quantity)
      calculatedStatus = actualQty > 0 ? 'complete' : 'missing';
    }

    const insertData: any = {
      tenant_id: tenant.id,
      kit_id: kitId || null, // NULL for standalone inventory
      supply_id: itemData.supplyId || null,
      freeform_name: !itemData.supplyId ? itemData.supplyName : null,
      supply_name: itemData.supplyName,
      supply_category_id: itemData.supplyCategoryId,
      location_id: itemData.locationId,
      location_name: itemData.locationName,
      is_requirement: false, // This is an actual item, not a requirement
      status: calculatedStatus,
      expiration_date: expirationDate ? expirationDate.toISOString() : null,
      purchase_date: purchaseDate ? purchaseDate.toISOString() : null,
      purchase_price: itemData.purchasePrice,
      supplier: itemData.supplier,
      lot_code: (itemData as any).lotCode || null,
      actual_quantity: actualQty,
      required_quantity: itemData.requiredQuantity,
      notes: itemData.notes,
      custom_fields: itemData.customFields,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    // Filter out undefined values
    const filteredData = Object.fromEntries(
      Object.entries(insertData).filter(([, value]) => value !== undefined),
    );

    // If item is in a kit, lookup required_quantity from matching requirement
    if (kitId && !itemData.requiredQuantity) {
      const { data: requirement } = await this.supabase
        .from('inventory_items')
        .select('required_quantity')
        .eq('kit_id', kitId)
        .eq('tenant_id', tenant.id)
        .eq('is_requirement', true)
        .or(
          itemData.supplyId
            ? `supply_id.eq.${itemData.supplyId}`
            : `freeform_name.eq.${itemData.supplyName}`,
        )
        .single();

      if (requirement && requirement.required_quantity) {
        filteredData.required_quantity = requirement.required_quantity;
      }
    }

    const { data: inventoryItem, error: itemError } = await this.supabase
      .from('inventory_items')
      .insert(filteredData)
      .select()
      .single();

    if (itemError || !inventoryItem) {
      throw new Error(
        `Failed to create inventory item: ${itemError?.message || 'Unknown error'}`,
      );
    }

    // If item belongs to a kit, check if it's an OSHA kit and recalculate compliance
    if (kitId && this.userKitsService) {
      try {
        await this.userKitsService.recalculateCompliance(userId, kitId);
      } catch (error) {
        logger.warn(
          `Failed to recalculate compliance after creating inventory item: ${error}`,
        );
        // Don't fail item creation if compliance check fails
      }
    }

    // Return item with all fields populated
    return rowToInventoryItem(inventoryItem);
  }

  async updateInventoryItem(
    userId: string,
    itemId: string,
    updates: Partial<InventoryItem>,
  ): Promise<InventoryItem> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Get current item to check expiration date changes
    const { data: currentItem, error: fetchError } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('id', itemId)
      .eq('tenant_id', tenant.id)
      .single();

    if (fetchError || !currentItem) {
      throw new NotFoundException('Inventory item not found');
    }

    const oldExpirationDate = currentItem.expiration_date
      ? new Date(currentItem.expiration_date)
      : null;

    // Convert date strings to Date objects in updates
    const processedUpdates: any = {};
    const newExpirationDate = this.convertToDate(updates.expirationDate);
    const newPurchaseDate = this.convertToDate(updates.purchaseDate);

    // Map interface fields to database columns
    if (updates.supplyId !== undefined)
      processedUpdates.supply_id = updates.supplyId;
    if (updates.supplyName !== undefined)
      processedUpdates.supply_name = updates.supplyName;
    if (updates.supplyCategoryId !== undefined)
      processedUpdates.supply_category_id = updates.supplyCategoryId;
    if (updates.locationId !== undefined)
      processedUpdates.location_id = updates.locationId;
    if (updates.locationName !== undefined)
      processedUpdates.location_name = updates.locationName;
    if (updates.kitId !== undefined) processedUpdates.kit_id = updates.kitId;
    if (updates.kitName !== undefined)
      processedUpdates.kit_name = updates.kitName;
    if (updates.actualQuantity !== undefined) {
      processedUpdates.actual_quantity = updates.actualQuantity;
    }
    if (updates.requiredQuantity !== undefined) {
      processedUpdates.required_quantity = updates.requiredQuantity;
    }
    if (updates.lotCode !== undefined)
      processedUpdates.lot_code = updates.lotCode;
    if (updates.purchasePrice !== undefined)
      processedUpdates.purchase_price = updates.purchasePrice;
    if (updates.supplier !== undefined)
      processedUpdates.supplier = updates.supplier;
    if (updates.notes !== undefined) processedUpdates.notes = updates.notes;

    // Calculate status based on quantities if status is not explicitly provided
    // or if quantities have changed
    const actualQty =
      updates.actualQuantity !== undefined
        ? Number(updates.actualQuantity)
        : Number(currentItem.actual_quantity) || 0;
    const requiredQty =
      updates.requiredQuantity !== undefined
        ? updates.requiredQuantity !== null
          ? Number(updates.requiredQuantity)
          : null
        : currentItem.required_quantity !== null && currentItem.required_quantity !== undefined
          ? Number(currentItem.required_quantity)
          : null;

    // Only auto-calculate status for fulfillment states, preserve lifecycle states
    const lifecycleStates = ['used', 'disposed', 'expired'];
    const currentStatus = currentItem.status as string;

    const validStatuses = ['complete', 'partial', 'missing', 'used', 'disposed', 'expired'];
    
    if (updates.status !== undefined) {
      // Status explicitly provided - validate and use it
      if (!validStatuses.includes(updates.status)) {
        throw new Error(
          `Invalid status value: ${updates.status}. Must be one of: ${validStatuses.join(', ')}`,
        );
      }
      processedUpdates.status = updates.status;
    } else if (
      (updates.actualQuantity !== undefined || updates.requiredQuantity !== undefined) &&
      !lifecycleStates.includes(currentStatus)
    ) {
      // Quantities changed and current status is not a lifecycle state - recalculate status
      let calculatedStatus: 'complete' | 'partial' | 'missing' | 'used' | 'disposed' | 'expired';
      if (requiredQty !== undefined && requiredQty !== null) {
        // For kit items with required_quantity
        if (actualQty >= requiredQty) {
          calculatedStatus = 'complete';
        } else if (actualQty > 0) {
          calculatedStatus = 'partial';
        } else {
          calculatedStatus = 'missing';
        }
      } else {
        // For standalone items (no required_quantity)
        calculatedStatus = actualQty > 0 ? 'complete' : 'missing';
      }
      processedUpdates.status = calculatedStatus;
    }
    if (updates.customFields !== undefined)
      processedUpdates.custom_fields = updates.customFields;

    if (newExpirationDate !== undefined) {
      processedUpdates.expiration_date = newExpirationDate.toISOString();
    }
    if (newPurchaseDate !== undefined) {
      processedUpdates.purchase_date = newPurchaseDate.toISOString();
    }

    // Handle expiration date changes - reset sentNotifications if expiration date changed
    if (newExpirationDate !== undefined) {
      const expirationChanged =
        !oldExpirationDate ||
        oldExpirationDate.getTime() !== newExpirationDate.getTime();

      if (expirationChanged) {
        // Reset sent notifications so cron job can send new alerts for the new expiration date
        processedUpdates.sent_notifications = [];
        logger.log(
          `Expiration date changed for item ${itemId}, resetting sent notifications`,
        );
      }
    } else if (updates.expirationDate === null) {
      // Expiration date was removed - clear sent notifications
      processedUpdates.expiration_date = null;
      processedUpdates.sent_notifications = [];
    }

    processedUpdates.updated_at = new Date().toISOString();

    // Filter out undefined values
    const updateData = Object.fromEntries(
      Object.entries(processedUpdates).filter(
        ([, value]) => value !== undefined,
      ),
    );

    const { data, error } = await this.supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', itemId)
      .eq('tenant_id', tenant.id)
      .select()
      .single();

    if (error) {
      logger.error(
        `Failed to update inventory item ${itemId}: ${error.message}`,
        { error, updateData, currentItem: currentItem.id },
      );
      throw new Error(`Failed to update inventory item: ${error.message}`);
    }

    const result = rowToInventoryItem(data);

    // If item belongs to a kit, check if it's an OSHA kit and recalculate compliance
    const kitId = data.kit_id || currentItem.kit_id;
    if (kitId && this.userKitsService) {
      try {
        await this.userKitsService.recalculateCompliance(userId, kitId);
      } catch (error) {
        logger.warn(
          `Failed to recalculate compliance after updating inventory item: ${error}`,
        );
        // Don't fail item update if compliance check fails
      }
    }

    return result;
  }

  async deleteInventoryItem(userId: string, itemId: string): Promise<void> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Get the item first to check if it belongs to a kit
    const { data: item, error: fetchError } = await this.supabase
      .from('inventory_items')
      .select('kit_id')
      .eq('id', itemId)
      .eq('tenant_id', tenant.id)
      .single();

    const kitId = item?.kit_id;

    const { error } = await this.supabase
      .from('inventory_items')
      .delete()
      .eq('id', itemId)
      .eq('tenant_id', tenant.id);

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Inventory item not found');
      }
      throw new Error(`Failed to delete inventory item: ${error.message}`);
    }

    // If item belonged to a kit, check if it's an OSHA kit and recalculate compliance
    if (kitId && this.userKitsService) {
      try {
        await this.userKitsService.recalculateCompliance(userId, kitId);
      } catch (error) {
        logger.warn(
          `Failed to recalculate compliance after deleting inventory item: ${error}`,
        );
        // Don't fail item deletion if compliance check fails
      }
    }
  }

  async searchInventoryItems(
    userId: string,
    term: string,
  ): Promise<InventoryItem[]> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_requirement', false); // Only search actual items, not requirements

    if (error) {
      logger.error(`Error fetching inventory items: ${error.message}`);
      return [];
    }

    const searchTerm = term.toLowerCase();
    return (data || [])
      .map(rowToInventoryItem)
      .filter(
        (item) =>
          item.supplyName?.toLowerCase().includes(searchTerm) ||
          item.notes?.toLowerCase().includes(searchTerm),
      );
  }

  async getExpiringItems(
    userId: string,
    days?: number,
  ): Promise<InventoryItem[]> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    const thresholdDate = new Date(
      Date.now() + (days || 30) * 24 * 60 * 60 * 1000,
    );
    const now = new Date();

    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_requirement', false) // Only get actual items, not requirements
      .gte('expiration_date', now.toISOString())
      .lte('expiration_date', thresholdDate.toISOString())
      .order('expiration_date', { ascending: true });

    if (error) {
      logger.error(`Error fetching expiring items: ${error.message}`);
      return [];
    }

    return (data || []).map(rowToInventoryItem);
  }

  async getExpiredItems(userId: string): Promise<InventoryItem[]> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_requirement', false) // Only get actual items, not requirements
      .eq('status', 'expired')
      .order('expiration_date', { ascending: true });

    if (error) {
      logger.error(`Error fetching expired items: ${error.message}`);
      return [];
    }

    return (data || []).map(rowToInventoryItem);
  }

  async getLowQuantityItems(
    userId: string,
    thresholdPercent: number = 10,
  ): Promise<InventoryItem[]> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Get all inventory items that have required_quantity > 0 OR are in kits
    // First, get items that already have required_quantity set
    const { data: itemsWithRequiredQty, error: error1 } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_requirement', false) // Only get actual items, not requirements
      .gt('required_quantity', 0)
      .not('required_quantity', 'is', null);

    if (error1) {
      logger.error(`Error fetching items with required_quantity: ${error1.message}`);
    }

    // Also get items in kits that might not have required_quantity set yet
    const { data: itemsInKits, error: error2 } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_requirement', false)
      .not('kit_id', 'is', null)
      .or('required_quantity.is.null,required_quantity.eq.0');

    if (error2) {
      logger.error(`Error fetching items in kits: ${error2.message}`);
    }

    // Combine and deduplicate by id
    const allItems = new Map<string, any>();
    (itemsWithRequiredQty || []).forEach((item) => {
      allItems.set(item.id, item);
    });
    (itemsInKits || []).forEach((item) => {
      if (!allItems.has(item.id)) {
        allItems.set(item.id, item);
      }
    });

    const itemsArray = Array.from(allItems.values());

    if (itemsArray.length === 0) {
      logger.log(`No items with required_quantity or in kits found for user ${userId}`);
      return [];
    }

    // For items without required_quantity, try to get it from the matching requirement
    // Batch lookup requirements for all kits
    const kitIds = [...new Set(itemsArray.map((item) => item.kit_id).filter(Boolean))];
    const requirementsMap = new Map<string, number>();

    if (kitIds.length > 0) {
      const { data: requirements, error: reqError } = await this.supabase
        .from('inventory_items')
        .select('kit_id, supply_id, freeform_name, required_quantity')
        .eq('tenant_id', tenant.id)
        .eq('is_requirement', true)
        .in('kit_id', kitIds)
        .gt('required_quantity', 0);

      if (reqError) {
        logger.warn(`Error fetching requirements: ${reqError.message}`);
      } else if (requirements) {
        // Build a map: key = kit_id + supply_id/freeform_name, value = required_quantity
        requirements.forEach((req) => {
          const key = req.supply_id
            ? `${req.kit_id}:supply:${req.supply_id}`
            : `${req.kit_id}:freeform:${req.freeform_name}`;
          requirementsMap.set(key, req.required_quantity);
        });
      }
    }

    // Enrich items with required_quantity from requirements if missing
    const enrichedItems = itemsArray.map((item) => {
      if (item.required_quantity && item.required_quantity > 0) {
        return item;
      }

      // Try to get from requirements map
      if (item.kit_id) {
        const key = item.supply_id
          ? `${item.kit_id}:supply:${item.supply_id}`
          : `${item.kit_id}:freeform:${item.freeform_name}`;
        const reqQty = requirementsMap.get(key);
        if (reqQty) {
          item.required_quantity = reqQty;
        }
      }

      return item;
    });

    // Filter items where actualQuantity < requiredQuantity AND percentage remaining <= threshold
    const threshold = thresholdPercent / 100;
    const lowQuantityItems = enrichedItems.filter((item) => {
      const actualQty = item.actual_quantity || 0;
      const requiredQty = item.required_quantity || 0;
      
      // Must have a required quantity
      if (requiredQty === 0) return false;
      
      // Only show items that are actually below required (not at or above)
      if (actualQty >= requiredQty) return false;
      
      // Calculate percentage remaining
      const percentRemaining = actualQty / requiredQty;
      
      // Show if percentage remaining is at or below threshold (e.g., 10% or less remaining)
      return percentRemaining <= threshold;
    });

    // Sort by percentage remaining (lowest first)
    lowQuantityItems.sort((a, b) => {
      const aPercent = (a.actual_quantity || 0) / (a.required_quantity || 1);
      const bPercent = (b.actual_quantity || 0) / (b.required_quantity || 1);
      return aPercent - bPercent;
    });

    logger.log(
      `Low quantity check: Found ${lowQuantityItems.length} low quantity items (threshold: ${thresholdPercent}%) out of ${enrichedItems.length} items checked (${itemsWithRequiredQty?.length || 0} with required_quantity, ${itemsInKits?.length || 0} in kits without)`,
    );

    return lowQuantityItems.map(rowToInventoryItem);
  }
}
