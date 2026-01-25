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
  quantity: number;
  expirationDate?: Date;
  purchaseDate?: Date;
  purchasePrice?: number;
  supplier?: string;
  notes?: string;
  status: 'active' | 'expired' | 'used' | 'disposed';
  sentNotifications?: string[]; // Array of days for which notifications have been sent (e.g., ['60', '30', '10', '1'])
  customFields?: Record<string, string | number | boolean | null>; // Custom field values keyed by fieldId
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to convert PostgreSQL row to InventoryItem
function rowToInventoryItem(row: any): InventoryItem {
  return {
    id: row.id,
    userId: row.user_id,
    supplyId: row.supply_id,
    supplyName: row.supply_name,
    supplyCategoryId: row.supply_category_id,
    locationId: row.location_id,
    locationName: row.location_name,
    kitId: row.kit_id,
    kitName: row.kit_name,
    quantity: row.quantity,
    expirationDate: row.expiration_date
      ? new Date(row.expiration_date)
      : undefined,
    purchaseDate: row.purchase_date
      ? new Date(row.purchase_date)
      : undefined,
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

    // Try new schema first (with inventory_lots), fall back to old schema if table doesn't exist
    let data: any[] | null = null;
    let error: any = null;
    
    // Try to get inventory items with lots (new schema)
    const result = await this.supabase
      .from('inventory_items')
      .select(`
        *,
        inventory_lots(
          id,
          quantity_units,
          expiration_date,
          purchase_date,
          purchase_price,
          supplier,
          status
        )
      `)
      .eq('tenant_id', tenant.id)
      .eq('is_requirement', false); // Only get actual items, not requirements
    
    data = result.data;
    error = result.error;
    
    // If error is about missing relationship/table, fall back to old schema
    if (error && (error.message?.includes('relationship') || error.message?.includes('schema cache') || error.code === 'PGRST202')) {
      logger.warn('inventory_lots table not found, using old schema');
      // Fall back to old schema (no lots)
      const oldResult = await this.supabase
        .from('inventory_items')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_requirement', false);
      
      if (oldResult.error) {
        logger.error(`Error fetching inventory items: ${oldResult.error.message}`);
        throw new Error(`Failed to get inventory items: ${oldResult.error.message}`);
      }
      
      // Return items in old format (no lots aggregation)
      return (oldResult.data || []).map((item: any) => rowToInventoryItem(item));
    }

    if (error) {
      logger.error(`Error fetching inventory items: ${error.message}`);
      throw new Error(`Failed to get inventory items: ${error.message}`);
    }

    // Aggregate quantities from lots and use earliest expiration
    return (data || []).map((item: any) => {
      const lots = item.inventory_lots || [];
      const activeLots = lots.filter((lot: any) => lot.status === 'active');
      
      // Calculate total quantity from active lots
      const totalQuantity = activeLots.reduce(
        (sum: number, lot: any) => sum + (lot.quantity_units || 0),
        0
      );
      
      // Get earliest expiration date from active lots
      const expirationDates = activeLots
        .map((lot: any) => lot.expiration_date)
        .filter((date: any) => date)
        .sort();
      const earliestExpiration = expirationDates.length > 0 
        ? new Date(expirationDates[0]) 
        : undefined;
      
      // Use first lot's purchase info
      const firstLot = activeLots[0] || lots[0];
      const purchaseDate = firstLot?.purchase_date ? new Date(firstLot.purchase_date) : undefined;
      const purchasePrice = firstLot?.purchase_price;
      const supplier = firstLot?.supplier;
      
      // Determine status: if all lots are expired/used/disposed, item is expired/used/disposed
      const allExpired = activeLots.length === 0 && lots.some((lot: any) => lot.status === 'expired');
      const allUsed = activeLots.length === 0 && lots.some((lot: any) => lot.status === 'used');
      const allDisposed = activeLots.length === 0 && lots.some((lot: any) => lot.status === 'disposed');
      
      let status = item.status;
      if (allExpired) status = 'expired';
      else if (allUsed) status = 'used';
      else if (allDisposed) status = 'disposed';
      else if (activeLots.length > 0) status = 'active';
      
      const baseItem = rowToInventoryItem(item);
      return {
        ...baseItem,
        quantity: totalQuantity, // Aggregate from lots
        expirationDate: earliestExpiration,
        purchaseDate,
        purchasePrice,
        supplier,
        status,
      };
    });
  }

  async getInventoryItem(
    userId: string,
    itemId: string,
  ): Promise<InventoryItem> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);
    
    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('id', itemId)
      .eq('tenant_id', tenant.id)
      .eq('is_requirement', false) // Only get actual items, not requirements
      .single();

    if (error || !data) {
      throw new NotFoundException('Inventory item not found');
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
   *   quantity: 10,
   *   status: 'active',
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
        .eq('is_requirement', false) // Only count actual items, not requirements
        .eq('status', 'active');

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

    // Create inventory_item (aggregate) - note: quantity is now in lots
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
      status: itemData.status || 'active',
      notes: itemData.notes,
      custom_fields: itemData.customFields,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    // Filter out undefined values
    const filteredData = Object.fromEntries(
      Object.entries(insertData).filter(([, value]) => value !== undefined),
    );

    const { data: inventoryItem, error: itemError } = await this.supabase
      .from('inventory_items')
      .insert(filteredData)
      .select()
      .single();

    if (itemError) {
      throw new Error(`Failed to create inventory item: ${itemError.message}`);
    }

    // Create inventory_lot with quantity and expiration
    if (inventoryItem) {
      const lotData: any = {
        inventory_item_id: inventoryItem.id,
        quantity_units: itemData.quantity,
        expiration_date: expirationDate ? expirationDate.toISOString().split('T')[0] : null,
        purchase_date: purchaseDate ? purchaseDate.toISOString().split('T')[0] : null,
        purchase_price: itemData.purchasePrice,
        supplier: itemData.supplier,
        status: itemData.status === 'expired' ? 'expired' : 
                itemData.status === 'used' ? 'used' :
                itemData.status === 'disposed' ? 'disposed' : 'active',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      const { error: lotError } = await this.supabase
        .from('inventory_lots')
        .insert(lotData);

      if (lotError) {
        logger.error(`Failed to create inventory lot: ${lotError.message}`);
      }
    }

    // Return in old format for backward compatibility
    const result = {
      ...rowToInventoryItem(inventoryItem),
      quantity: itemData.quantity,
      expirationDate,
      purchaseDate,
    };

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

    return result;
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
    if (updates.quantity !== undefined)
      processedUpdates.quantity = updates.quantity;
    if (updates.purchasePrice !== undefined)
      processedUpdates.purchase_price = updates.purchasePrice;
    if (updates.supplier !== undefined)
      processedUpdates.supplier = updates.supplier;
    if (updates.notes !== undefined) processedUpdates.notes = updates.notes;
    if (updates.status !== undefined) processedUpdates.status = updates.status;
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
      .eq('status', 'active')
      .gte('expiration_date', now.toISOString())
      .lte('expiration_date', thresholdDate.toISOString())
      .order('expiration_date', { ascending: true });

    if (error) {
      logger.error(`Error fetching expiring items: ${error.message}`);
      return [];
    }

    return (data || []).map(rowToInventoryItem);
  }
}
