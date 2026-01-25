import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';
import { UsersService } from '../users/users.service';
import { InventoryService } from '../inventory/inventory.service';
import { TenantsService } from '../tenants/tenants.service';

export interface UserKit {
  id: string;
  userId: string;
  kitTemplateId?: string;
  kitTemplateName?: string;
  name: string;
  locationId: string;
  locationName?: string;
  status: 'active' | 'incomplete' | 'complete' | 'archived';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KitItemInstance {
  id: string;
  userKitId: string;
  inventoryItemId?: string;
  supplyId: string;
  supplyName?: string;
  requiredQuantity: number;
  actualQuantity: number;
  status: 'missing' | 'partial' | 'complete';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to convert PostgreSQL row to UserKit
function rowToUserKit(row: any): UserKit {
  return {
    id: row.id,
    userId: row.user_id,
    kitTemplateId: row.kit_template_id,
    kitTemplateName: row.kit_template_name,
    name: row.name,
    locationId: row.location_id,
    locationName: row.location_name,
    status: row.status,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// Helper function to convert PostgreSQL row to KitItemInstance
// Works with consolidated inventory_items table
function rowToKitItem(row: any, actualQuantity?: number): KitItemInstance {
  // For inventory_items, quantity is the required quantity for requirements
  // actualQuantity should be calculated from inventory_lots or passed in
  const reqQty = row.is_requirement
    ? row.quantity || 0
    : row.required_quantity || row.quantity || 0;
  const actQty =
    actualQuantity !== undefined ? actualQuantity : row.actual_quantity || 0;

  // Calculate status if not provided
  let status: 'missing' | 'partial' | 'complete';
  if (row.status && ['missing', 'partial', 'complete'].includes(row.status)) {
    status = row.status;
  } else {
    if (actQty >= reqQty) {
      status = 'complete';
    } else if (actQty > 0) {
      status = 'partial';
    } else {
      status = 'missing';
    }
  }

  return {
    id: row.id,
    userKitId: row.kit_id || row.user_kit_id || '',
    inventoryItemId:
      row.inventory_item_id || (row.is_requirement ? undefined : row.id),
    supplyId: row.supply_id || '',
    supplyName: row.supply_name || row.freeform_name,
    requiredQuantity: reqQty,
    actualQuantity: actQty,
    status,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class UserKitsService {
  private readonly logger = new Logger(UserKitsService.name);

  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    @Inject(forwardRef(() => InventoryService))
    private readonly inventoryService: InventoryService,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
  ) {}

  async getUserKits(userId: string): Promise<UserKit[]> {
    // Get user's default tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Query kits directly (containers table was removed in migration 025)
    const { data: kitsData, error } = await this.supabase
      .from('kits')
      .select(
        'id, name, location_id, status, notes, metadata, created_at, updated_at, locations(name)',
      )
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to get user kits: ${error.message}`);
    }

    // Map kits to UserKit format
    return (kitsData || []).map((kit: any) => ({
      id: kit.id,
      userId: userId,
      name: kit.name,
      locationId: kit.location_id || '',
      locationName: Array.isArray(kit.locations)
        ? kit.locations[0]?.name
        : (kit.locations as any)?.name,
      status: kit.status === 'archived' ? 'archived' : 'active',
      notes: kit.notes || undefined,
      kitTemplateId: (kit.metadata as any)?.kit_template_id,
      kitTemplateName: (kit.metadata as any)?.kit_template_name,
      createdAt: new Date(kit.created_at),
      updatedAt: new Date(kit.updated_at),
    }));
  }

  async getUserKit(userId: string, kitId: string): Promise<UserKit> {
    if (!userId || !userId.trim()) {
      throw new BadRequestException('User ID is required');
    }

    if (!kitId || !kitId.trim()) {
      throw new BadRequestException('Kit ID is required');
    }

    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // First, try to get the kit from the user's tenant
    const { data: kit, error: kitError } = await this.supabase
      .from('kits')
      .select(
        'id, name, location_id, status, notes, metadata, created_at, updated_at, locations(name)',
      )
      .eq('id', kitId.trim())
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null)
      .single();

    if (!kitError && kit) {
      return {
        id: kit.id,
        userId: userId,
        name: kit.name,
        locationId: kit.location_id || '',
        locationName: Array.isArray(kit.locations)
          ? kit.locations[0]?.name
          : (kit.locations as any)?.name,
        status: kit.status === 'archived' ? 'archived' : 'active',
        notes: kit.notes || undefined,
        kitTemplateId: (kit.metadata as any)?.kit_template_id,
        kitTemplateName: (kit.metadata as any)?.kit_template_name,
        createdAt: new Date(kit.created_at),
        updatedAt: new Date(kit.updated_at),
      };
    }

    // If not found, check if it's shared with this user using kit_acl
    const { data: share, error: shareError } = await this.supabase
      .from('kit_acl')
      .select('kit_id')
      .eq('kit_id', kitId.trim())
      .eq('subject_type', 'user')
      .eq('subject_id', userId.trim())
      .single();

    if (!shareError && share) {
      // Kit is shared with this user, fetch it from kits table
      const { data: sharedKit, error: sharedKitError } = await this.supabase
        .from('kits')
        .select('*')
        .eq('id', kitId.trim())
        .single();

      if (!sharedKitError && sharedKit) {
        return {
          id: sharedKit.id,
          userId: userId,
          name: sharedKit.name,
          locationId: sharedKit.location_id || '',
          locationName: Array.isArray(sharedKit.locations)
            ? sharedKit.locations[0]?.name
            : (sharedKit.locations as any)?.name,
          status: sharedKit.status === 'archived' ? 'archived' : 'active',
          notes: sharedKit.notes || undefined,
          kitTemplateId: (sharedKit.metadata as any)?.kit_template_id,
          kitTemplateName: (sharedKit.metadata as any)?.kit_template_name,
          createdAt: new Date(sharedKit.created_at),
          updatedAt: new Date(sharedKit.updated_at),
        };
      }
    }

    throw new NotFoundException('User kit not found');
  }

  async createUserKit(
    userId: string,
    kitData: Omit<UserKit, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<UserKit> {
    const isPremium = await this.usersService.isPremiumUser(userId);
    if (!isPremium) {
      // Count kits for user's tenant
      const tenant = await this.tenantsService.getUserDefaultTenant(userId);
      const { count, error: countError } = await this.supabase
        .from('kits')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .is('deleted_at', null)
        .in('status', ['active']);

      if (countError) {
        this.logger.error(`Error counting kits: ${countError.message}`);
        throw new Error(`Failed to count kits: ${countError.message}`);
      }

      const activeCount = count || 0;
      const maxFreeKits = 5;
      if (activeCount >= maxFreeKits) {
        throw new ForbiddenException({
          code: 'KIT_LIMIT_REACHED',
          message:
            'You have reached the free limit of 5 kits. Upgrade to premium for unlimited kits.',
        });
      }
    }

    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    const now = new Date();

    const { data, error } = await this.supabase
      .from('kits')
      .insert({
        tenant_id: tenant.id,
        name: kitData.name,
        location_id: kitData.locationId,
        status: kitData.status === 'archived' ? 'archived' : 'active',
        notes: kitData.notes,
        metadata: kitData.kitTemplateId
          ? {
              kit_template_id: kitData.kitTemplateId,
              kit_template_name: kitData.kitTemplateName,
            }
          : null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user kit: ${error.message}`);
    }

    // Convert kits row to UserKit format
    return {
      id: data.id,
      userId: userId,
      name: data.name,
      locationId: data.location_id || '',
      locationName: kitData.locationName,
      status: data.status === 'archived' ? 'archived' : 'active',
      notes: data.notes || undefined,
      kitTemplateId: (data.metadata as any)?.kit_template_id,
      kitTemplateName: (data.metadata as any)?.kit_template_name,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async createUserKitFromTemplate(
    userId: string,
    templateId: string,
    templateName: string,
    locationId: string,
    locationName?: string,
    includeItems: boolean = false,
    templateItems?: Array<{
      supplyId: string;
      supplyName?: string;
      quantity: number;
      notes?: string;
    }>,
  ): Promise<UserKit> {
    // Create the kit
    const kit = await this.createUserKit(userId, {
      kitTemplateId: templateId,
      kitTemplateName: templateName,
      name: templateName,
      locationId,
      locationName,
      status: 'active',
    });

    // Always create item instances if templateItems are provided
    if (templateItems && templateItems.length > 0) {
      this.logger.log(
        `Creating kit with ${templateItems.length} items from template ${templateId} (${includeItems ? 'fully loaded' : 'empty'})`,
      );
      // Log all template items before processing
      const now = new Date();

      // If fully loaded, create inventory items first and collect their IDs
      const inventoryItemMap = new Map<string, string>(); // Maps supplyId -> inventoryItemId
      if (includeItems) {
        if (!this.inventoryService) {
          this.logger.error(
            '❌ InventoryService is not available! Cannot create inventory items for fully loaded kit.',
          );
          throw new Error(
            'InventoryService is not available. Cannot create fully loaded kit.',
          );
        }
        this.logger.log(
          `Creating inventory items for fully loaded kit (${templateItems.length} items, locationId: ${locationId})`,
        );
        for (const item of templateItems) {
          if (!item.supplyId) {
            this.logger.warn(
              `Skipping inventory item creation for ${item.supplyName || 'unknown item'}: missing supplyId`,
            );
            continue;
          }
          if (item.quantity <= 0) {
            this.logger.warn(
              `Skipping inventory item creation for ${item.supplyName || 'unknown item'}: quantity is ${item.quantity}`,
            );
            continue;
          }
          if (!locationId) {
            this.logger.error(
              `Cannot create inventory item for ${item.supplyName || 'unknown item'}: locationId is missing`,
            );
            continue;
          }
          try {
            this.logger.log(
              `Creating inventory item: ${item.supplyName || 'Unknown'} (supplyId: ${item.supplyId}, quantity: ${item.quantity}, locationId: ${locationId})`,
            );
            const inventoryItem =
              await this.inventoryService.createInventoryItem(userId, {
                supplyId: item.supplyId,
                supplyName: item.supplyName || 'Unknown item',
                locationId,
                locationName,
                kitId: kit.id,
                kitName: kit.name,
                quantity: item.quantity,
                status: 'active',
                notes: (item as { notes?: string }).notes,
              });
            if (!inventoryItem || !inventoryItem.id) {
              this.logger.error(
                `❌ Inventory item creation returned invalid result for ${item.supplyName}: ${JSON.stringify(inventoryItem)}`,
              );
              continue;
            }
            inventoryItemMap.set(item.supplyId, inventoryItem.id);
            this.logger.log(
              `✅ Created inventory item for ${item.supplyName} (id: ${inventoryItem.id}, quantity: ${item.quantity}, kit: ${kit.name})`,
            );
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(
              `❌ Failed to create inventory item for ${item.supplyName || 'unknown'} (supplyId: ${item.supplyId}, quantity: ${item.quantity}): ${errorMessage}`,
              errorStack,
            );
            // Don't fail the entire operation if inventory creation fails
            // but log it clearly so we can debug
          }
        }
        this.logger.log(
          `Inventory item creation complete: ${inventoryItemMap.size}/${templateItems.length} items created successfully`,
        );
        if (inventoryItemMap.size === 0 && templateItems.length > 0) {
          this.logger.warn(
            `⚠️ WARNING: No inventory items were created for fully loaded kit! This may indicate a problem.`,
          );
        }
      } else {
        // Empty kit: Skip inventory item creation
        // This means no inventory items are created, so no expiration dates will be set
        // Kit items will be created with actual_quantity = 0
        this.logger.log(
          `Skipping inventory item creation (includeItems=false) - creating empty kit with requirements only`,
        );
      }

      // Create kit items, linking them to inventory items if they exist
      // If inventory items were created, fetch their quantities to set actual_quantity correctly
      const inventoryQuantitiesMap = new Map<string, number>(); // Maps supplyId -> quantity
      if (includeItems && inventoryItemMap.size > 0) {
        // Fetch quantities from created inventory items (with lots for new schema)
        const inventoryItemIds = Array.from(inventoryItemMap.values());
        const { data: inventoryItems, error: fetchError } = await this.supabase
          .from('inventory_items')
          .select(
            `
            id,
            supply_id,
            inventory_lots(
              quantity_units,
              status
            )
          `,
          )
          .in('id', inventoryItemIds);

        if (fetchError) {
          this.logger.warn(
            `Failed to fetch inventory item quantities: ${fetchError.message}. Will use template quantities.`,
          );
        } else if (inventoryItems) {
          // Create reverse map: inventoryItemId -> quantity, then map to supplyId
          const inventoryIdToQuantity = new Map<string, number>();
          inventoryItems.forEach((inv) => {
            // Aggregate quantity from active lots (new schema) or use quantity field (old schema)
            let quantity = 0;
            if (inv.inventory_lots && Array.isArray(inv.inventory_lots)) {
              // New schema: sum quantities from active lots
              quantity = inv.inventory_lots
                .filter((lot: any) => lot.status === 'active')
                .reduce(
                  (sum: number, lot: any) => sum + (lot.quantity_units || 0),
                  0,
                );
            } else {
              // Old schema: use quantity field directly
              quantity = (inv as any).quantity || 0;
            }
            inventoryIdToQuantity.set(inv.id, quantity);
          });

          // Map supplyId -> quantity
          inventoryItemMap.forEach((inventoryItemId, supplyId) => {
            const quantity = inventoryIdToQuantity.get(inventoryItemId) || 0;
            inventoryQuantitiesMap.set(supplyId, quantity);
            this.logger.log(
              `Mapped inventory quantity for supplyId ${supplyId}: ${quantity}`,
            );
          });
        }
      }

      // Get user's tenant for scoping
      const tenant = await this.tenantsService.getUserDefaultTenant(userId);

      // For fully loaded kits (includeItems = true), we already created the actual inventory items
      // Those items serve as both the requirement and the actual item, so we don't need separate requirements
      // For empty kits (includeItems = false), we need to create requirements only

      // CRITICAL: Only create requirements for empty kits, never for fully loaded kits
      // Fully loaded kits already have inventory items that serve as requirements
      if (!includeItems) {
        const kitItems = templateItems
          .filter((item) => item.supplyId || item.supplyName)
          .map((item) => {
            // Ensure quantity is a valid number (should be > 0 for template items)
            const requiredQuantity =
              item.quantity && item.quantity > 0 ? item.quantity : 0;

            // Create as requirement in inventory_items
            return {
              tenant_id: tenant.id,
              kit_id: kit.id,
              supply_id: item.supplyId || null,
              freeform_name: item.supplyId
                ? null
                : item.supplyName || 'Unknown item',
              supply_name: item.supplyName || 'Unknown item',
              quantity: requiredQuantity, // Required quantity for requirements
              is_requirement: true, // This is a requirement/placeholder
              status: 'missing', // Default status for requirements
              notes: (item as { notes?: string }).notes,
              created_at: now.toISOString(),
              updated_at: now.toISOString(),
            };
          });

        if (kitItems.length > 0) {
          // Ensure all items have tenant_id
          const kitItemsWithTenant = kitItems.map((item) => ({
            ...item,
            tenant_id: tenant.id,
          }));

          const { error: itemsError } = await this.supabase
            .from('inventory_items')
            .insert(kitItemsWithTenant);

          if (itemsError) {
            this.logger.error(
              `Failed to create kit requirements: ${itemsError.message}`,
              itemsError,
            );
            throw new Error(
              `Failed to create kit requirements: ${itemsError.message}`,
            );
          }
        }
      } else {
        // For fully loaded kits, the actual inventory items already serve as requirements
        // We need to update them to set the required quantity
        // CRITICAL: Do NOT create separate requirements - that would violate the unique constraint
        // Update each inventory item to set the required quantity
        for (const [supplyId, inventoryItemId] of inventoryItemMap.entries()) {
          const templateItem = templateItems.find(
            (item) => item.supplyId === supplyId,
          );
          if (templateItem && templateItem.quantity > 0) {
            // The quantity field in inventory_items for actual items (is_requirement=false)
            // should represent the required quantity, not the actual quantity
            // Actual quantity comes from inventory_lots
            const { error: updateError } = await this.supabase
              .from('inventory_items')
              .update({ quantity: templateItem.quantity })
              .eq('id', inventoryItemId);

            if (updateError) {
              this.logger.warn(
                `Failed to update required quantity for inventory item ${inventoryItemId}: ${updateError.message}`,
              );
            }
          }
        }
      }
    }

    return kit;
  }

  async updateUserKit(
    userId: string,
    kitId: string,
    updates: Partial<UserKit>,
  ): Promise<UserKit> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Get current kit data
    const { data: currentKit, error: fetchError } = await this.supabase
      .from('kits')
      .select('*')
      .eq('id', kitId)
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !currentKit) {
      throw new NotFoundException('User kit not found');
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.locationId !== undefined)
      updateData.location_id = updates.locationId;
    if (updates.status !== undefined) {
      updateData.status = updates.status === 'archived' ? 'archived' : 'active';
    }
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (
      updates.kitTemplateId !== undefined ||
      updates.kitTemplateName !== undefined
    ) {
      updateData.metadata = {
        ...((currentKit.metadata as any) || {}),
        ...(updates.kitTemplateId
          ? { kit_template_id: updates.kitTemplateId }
          : {}),
        ...(updates.kitTemplateName
          ? { kit_template_name: updates.kitTemplateName }
          : {}),
      };
    }

    // Update the kit
    const { data: updatedKit, error: updateError } = await this.supabase
      .from('kits')
      .update(updateData)
      .eq('id', kitId)
      .eq('tenant_id', tenant.id)
      .select(
        'id, name, location_id, status, notes, metadata, created_at, updated_at, locations(name)',
      )
      .single();

    if (updateError) {
      throw new Error(`Failed to update user kit: ${updateError.message}`);
    }

    const currentKitData = {
      id: currentKit.id,
      userId: userId,
      name: currentKit.name,
      locationId: currentKit.location_id || '',
      locationName: (currentKit as any).locations?.name,
      status: currentKit.status === 'archived' ? 'archived' : 'active',
      notes: currentKit.notes || undefined,
      kitTemplateId: (currentKit.metadata as any)?.kit_template_id,
      kitTemplateName: (currentKit.metadata as any)?.kit_template_name,
      createdAt: new Date(currentKit.created_at),
      updatedAt: new Date(currentKit.updated_at),
    };

    // If location or name changed, update associated inventory items
    const locationChanged =
      updates.locationId !== undefined &&
      updates.locationId !== currentKitData.locationId;
    const nameChanged =
      updates.name !== undefined && updates.name !== currentKitData.name;
    const locationNameChanged =
      updates.locationName !== undefined &&
      updates.locationName !== currentKitData.locationName;

    if (locationChanged || nameChanged || locationNameChanged) {
      try {
        // Find all inventory items linked to this kit
        const { data: inventoryItems, error: inventoryError } =
          await this.supabase
            .from('inventory_items')
            .select('id')
            .eq('user_id', userId)
            .eq('kit_id', kitId);

        if (!inventoryError && inventoryItems && inventoryItems.length > 0) {
          const inventoryUpdateData: any = {
            updated_at: new Date().toISOString(),
          };

          if (locationChanged && updates.locationId) {
            inventoryUpdateData.location_id = updates.locationId;

            // If locationName wasn't provided, fetch it
            if (!updates.locationName) {
              try {
                const { data: location } = await this.supabase
                  .from('locations')
                  .select('name')
                  .eq('id', updates.locationId)
                  .single();

                if (location) {
                  inventoryUpdateData.location_name = location.name;
                }
              } catch (error) {
                this.logger.error(
                  `Failed to fetch location name: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            } else {
              inventoryUpdateData.location_name = updates.locationName;
            }
          } else if (locationNameChanged && updates.locationName) {
            inventoryUpdateData.location_name = updates.locationName;
          }

          if (nameChanged && updates.name) {
            inventoryUpdateData.kit_name = updates.name;
          }

          // Update all inventory items
          const { error: bulkUpdateError } = await this.supabase
            .from('inventory_items')
            .update(inventoryUpdateData)
            .eq('user_id', userId)
            .eq('kit_id', kitId);

          if (bulkUpdateError) {
            this.logger.error(
              `Failed to update inventory items: ${bulkUpdateError.message}`,
            );
          } else {
            this.logger.log(
              `Updated ${inventoryItems.length} inventory items for kit ${kitId}`,
            );
          }
        }
      } catch (error) {
        // Log error but don't fail the kit update
        this.logger.error(
          `Failed to update inventory items for kit ${kitId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      id: updatedKit.id,
      userId: userId,
      name: updatedKit.name,
      locationId: updatedKit.location_id || '',
      locationName: Array.isArray(updatedKit.locations)
        ? updatedKit.locations[0]?.name
        : (updatedKit.locations as any)?.name,
      status: updatedKit.status === 'archived' ? 'archived' : 'active',
      notes: updatedKit.notes || undefined,
      kitTemplateId: (updatedKit.metadata as any)?.kit_template_id,
      kitTemplateName: (updatedKit.metadata as any)?.kit_template_name,
      createdAt: new Date(updatedKit.created_at),
      updatedAt: new Date(updatedKit.updated_at),
    };
  }

  async deleteUserKit(userId: string, kitId: string): Promise<void> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // First, verify the kit exists and belongs to the tenant
    const { data: kit, error: kitCheckError } = await this.supabase
      .from('kits')
      .select('id')
      .eq('id', kitId)
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null)
      .single();

    if (kitCheckError || !kit) {
      throw new NotFoundException('Kit not found');
    }

    // Delete all inventory items associated with this kit
    // This will cascade delete inventory_lots due to ON DELETE CASCADE
    const { error: deleteItemsError } = await this.supabase
      .from('inventory_items')
      .delete()
      .eq('kit_id', kitId)
      .eq('tenant_id', tenant.id);

    if (deleteItemsError) {
      this.logger.error(
        `Failed to delete inventory items for kit ${kitId}: ${deleteItemsError.message}`,
      );
      throw new Error(
        `Failed to delete kit items: ${deleteItemsError.message}`,
      );
    }

    this.logger.log(`Deleted inventory items for kit ${kitId}`);

    // Also delete related records that reference the kit
    // Delete kit_acl entries
    const { error: deleteAclError } = await this.supabase
      .from('kit_acl')
      .delete()
      .eq('kit_id', kitId);

    if (deleteAclError) {
      this.logger.warn(
        `Failed to delete kit_acl entries for kit ${kitId}: ${deleteAclError.message}`,
      );
      // Don't throw - ACL entries are not critical
    }

    // Delete share_links for this kit
    const { error: deleteShareLinksError } = await this.supabase
      .from('share_links')
      .delete()
      .eq('kit_id', kitId);

    if (deleteShareLinksError) {
      this.logger.warn(
        `Failed to delete share_links for kit ${kitId}: ${deleteShareLinksError.message}`,
      );
      // Don't throw - share links are not critical
    }

    // Finally, soft delete the kit (set deleted_at)
    const { error } = await this.supabase
      .from('kits')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', kitId)
      .eq('tenant_id', tenant.id);

    if (error) {
      throw new Error(`Failed to delete kit: ${error.message}`);
    }

    this.logger.log(
      `Successfully deleted kit ${kitId} and all associated items`,
    );
  }

  async getkitItems(
    userId: string,
    userKitId: string,
  ): Promise<KitItemInstance[]> {
    // Get user's tenant for scoping
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Get all inventory items for this kit (both requirements and actual items)
    const { data: items, error: itemsError } = await this.supabase
      .from('inventory_items')
      .select(
        `
        *,
        inventory_lots(
          id,
          quantity_units,
          status,
          expiration_date
        )
      `,
      )
      .eq('kit_id', userKitId.trim())
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true });

    // If not found or empty, check if it's a shared kit
    if (itemsError || !items || items.length === 0) {
      const { data: share } = await this.supabase
        .from('kit_acl')
        .select('kit_id')
        .eq('kit_id', userKitId.trim())
        .eq('subject_type', 'user')
        .eq('subject_id', userId.trim())
        .single();

      if (share) {
        const result = await this.supabase
          .from('inventory_items')
          .select(
            `
            *,
            inventory_lots(
              id,
              quantity_units,
              status,
              expiration_date
            )
          `,
          )
          .eq('kit_id', userKitId.trim());

        // Use result data and error
        const sharedItems = result.data;
        const sharedItemsError = result.error;

        if (!sharedItemsError && sharedItems) {
          return (sharedItems || []).map((item: any) => {
            let actualQty = 0;
            if (item.inventory_lots && Array.isArray(item.inventory_lots)) {
              actualQty = item.inventory_lots
                .filter(
                  (lot: any) =>
                    lot.status === 'active' &&
                    (!lot.expiration_date ||
                      new Date(lot.expiration_date) >= new Date()),
                )
                .reduce(
                  (sum: number, lot: any) => sum + (lot.quantity_units || 0),
                  0,
                );
            } else if (!item.is_requirement) {
              actualQty = item.quantity || 0;
            }

            const requiredQty = item.is_requirement
              ? item.quantity || 0
              : item.quantity || 0;

            return rowToKitItem(item, actualQty);
          });
        }
      }
    }

    if (itemsError) {
      this.logger.error(`Error fetching kit items: ${itemsError.message}`);
      return [];
    }

    // Convert to KitItemInstance, calculating actual quantities from lots
    return (items || []).map((item: any, index: number) => {
      let actualQty = 0;

      // For requirements (is_requirement = true), calculate actual from lots
      // For actual items (is_requirement = false), use quantity or lots
      if (item.inventory_lots && Array.isArray(item.inventory_lots)) {
        actualQty = item.inventory_lots
          .filter(
            (lot: any) =>
              lot.status === 'active' &&
              (!lot.expiration_date ||
                new Date(lot.expiration_date) >= new Date()),
          )
          .reduce(
            (sum: number, lot: any) => sum + (lot.quantity_units || 0),
            0,
          );
      } else if (!item.is_requirement) {
        // For actual items without lots, use quantity field
        actualQty = item.quantity || 0;
      }

      // For requirements, quantity field is the required quantity
      const requiredQty = item.is_requirement
        ? item.quantity || 0
        : item.quantity || 0;

      const result = rowToKitItem(item, actualQty);
      return result;
    });
  }

  /**
   * Get kit items using consolidated inventory_items model
   * @deprecated - Use getkitItems() directly, this method is kept for backward compatibility
   */
  private async getKitItemsFromNewSchema(
    containerId: string,
  ): Promise<KitItemInstance[]> {
    // This method is no longer needed - getkitItems() now handles everything
    // But we'll keep it for backward compatibility and redirect
    const { data: kit } = await this.supabase
      .from('kits')
      .select('id')
      .eq('id', containerId)
      .is('deleted_at', null)
      .single();

    if (!kit) {
      return [];
    }

    // Get user from tenant (we need userId, but we only have containerId)
    // This is a fallback, so we'll query without tenant_id filter
    const { data: items, error: itemsError } = await this.supabase
      .from('inventory_items')
      .select(
        `
        *,
        inventory_lots(
          id,
          quantity_units,
          status,
          expiration_date
        )
      `,
      )
      .eq('kit_id', containerId)
      .order('created_at', { ascending: true });

    if (itemsError) {
      this.logger.error(`Error fetching kit items: ${itemsError.message}`);
      return [];
    }

    return (items || []).map((item: any) => {
      let actualQty = 0;
      if (item.inventory_lots && Array.isArray(item.inventory_lots)) {
        actualQty = item.inventory_lots
          .filter(
            (lot: any) =>
              lot.status === 'active' &&
              (!lot.expiration_date ||
                new Date(lot.expiration_date) >= new Date()),
          )
          .reduce(
            (sum: number, lot: any) => sum + (lot.quantity_units || 0),
            0,
          );
      } else if (!item.is_requirement) {
        actualQty = item.quantity || 0;
      }

      return rowToKitItem(item, actualQty);
    });
  }

  async createKitItemInstance(
    userId: string,
    userKitId: string,
    itemData: Omit<
      KitItemInstance,
      | 'id'
      | 'userKitId'
      | 'actualQuantity'
      | 'status'
      | 'createdAt'
      | 'updatedAt'
    > & { actualQuantity?: number; createInventoryItem?: boolean },
  ): Promise<KitItemInstance> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Get kit to verify it exists and get location
    const { data: kit, error: kitError } = await this.supabase
      .from('kits')
      .select('id, location_id, tenant_id, name')
      .eq('id', userKitId)
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null)
      .single();

    if (kitError || !kit) {
      throw new NotFoundException('Kit not found');
    }

    // Check if any inventory item already exists for this kit and supply
    // (The unique constraint applies to kit_id + supply_id regardless of is_requirement)
    let existingItem: any = null;
    if (itemData.supplyId && itemData.supplyId.trim() !== '') {
      const { data: existing } = await this.supabase
        .from('inventory_items')
        .select('id, is_requirement, quantity')
        .eq('kit_id', userKitId)
        .eq('tenant_id', tenant.id)
        .eq('supply_id', itemData.supplyId)
        .maybeSingle();
      existingItem = existing;
    } else {
      // For items without supplyId, check by freeform_name
      const { data: existing } = await this.supabase
        .from('inventory_items')
        .select('id, is_requirement, quantity')
        .eq('kit_id', userKitId)
        .eq('tenant_id', tenant.id)
        .eq('freeform_name', itemData.supplyName)
        .is('supply_id', null)
        .maybeSingle();
      existingItem = existing;
    }

    let inventoryItemId: string | undefined;
    let actualQty = 0;

    // Handle inventory creation/assignment
    if (itemData.createInventoryItem && itemData.requiredQuantity > 0) {
      // Check if inventory item already exists for this kit and supply
      // The unique constraint is on (kit_id, supply_id) where both are NOT NULL
      let existingInventoryItem: any = null;
      if (itemData.supplyId && itemData.supplyId.trim() !== '') {
        const { data: existing } = await this.supabase
          .from('inventory_items')
          .select('id, quantity')
          .eq('kit_id', userKitId)
          .eq('supply_id', itemData.supplyId)
          .eq('is_requirement', false)
          .maybeSingle();
        existingInventoryItem = existing;
      } else {
        // For items without supplyId, check by freeform_name and kit_id
        // Note: unique constraint doesn't apply when supply_id is NULL
        const { data: existing } = await this.supabase
          .from('inventory_items')
          .select('id, quantity')
          .eq('kit_id', userKitId)
          .eq('freeform_name', itemData.supplyName)
          .is('supply_id', null)
          .eq('is_requirement', false)
          .maybeSingle();
        existingInventoryItem = existing;
      }

      if (existingInventoryItem) {
        // Use existing inventory item
        inventoryItemId = existingInventoryItem.id;

        // Get actual quantity from inventory lots
        const { data: invItem } = await this.supabase
          .from('inventory_items')
          .select(
            `
            inventory_lots(
              quantity_units,
              status,
              expiration_date
            )
          `,
          )
          .eq('id', existingInventoryItem.id)
          .single();

        if (invItem?.inventory_lots) {
          actualQty = invItem.inventory_lots
            .filter(
              (lot: any) =>
                lot.status === 'active' &&
                (!lot.expiration_date ||
                  new Date(lot.expiration_date) >= new Date()),
            )
            .reduce(
              (sum: number, lot: any) => sum + (lot.quantity_units || 0),
              0,
            );
        } else {
          // Fallback to quantity field if no lots
          actualQty = existingInventoryItem.quantity || 0;
        }

        this.logger.log(
          `✅ Using existing inventory item ${existingInventoryItem.id} for kit: ${itemData.supplyName}`,
        );
      } else {
        // Create new inventory item (not a requirement)
        try {
          const inventoryItem = await this.inventoryService.createInventoryItem(
            userId,
            {
              supplyId:
                itemData.supplyId && itemData.supplyId.trim() !== ''
                  ? itemData.supplyId
                  : undefined,
              supplyName: itemData.supplyName || 'Unknown item',
              locationId: kit.location_id,
              quantity: itemData.requiredQuantity,
              status: 'active',
              notes: itemData.notes,
              kitId: userKitId,
              expirationDate: (itemData as any).expirationDate
                ? new Date((itemData as any).expirationDate)
                : undefined,
            } as any,
          );
          inventoryItemId = inventoryItem.id;
          actualQty = inventoryItem.quantity || itemData.requiredQuantity;
          this.logger.log(
            `✅ Created inventory item ${inventoryItem.id} for kit: ${itemData.supplyName}`,
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `❌ Failed to create inventory item: ${errorMessage}`,
          );
          // Continue - requirement will be created without actual inventory
        }
      }
    } else if (itemData.inventoryItemId) {
      // Assign existing inventory item to kit
      inventoryItemId = itemData.inventoryItemId;
      try {
        await this.inventoryService.updateInventoryItem(
          userId,
          itemData.inventoryItemId,
          {
            kitId: userKitId,
          } as any,
        );

        // Get actual quantity from inventory lots
        const { data: invItem } = await this.supabase
          .from('inventory_items')
          .select(
            `
            inventory_lots(
              quantity_units,
              status,
              expiration_date
            )
          `,
          )
          .eq('id', itemData.inventoryItemId)
          .single();

        if (invItem?.inventory_lots) {
          actualQty = invItem.inventory_lots
            .filter(
              (lot: any) =>
                lot.status === 'active' &&
                (!lot.expiration_date ||
                  new Date(lot.expiration_date) >= new Date()),
            )
            .reduce(
              (sum: number, lot: any) => sum + (lot.quantity_units || 0),
              0,
            );
        }

        this.logger.log(
          `✅ Assigned inventory item ${itemData.inventoryItemId} to kit ${userKitId}`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `❌ Failed to assign inventory item: ${errorMessage}`,
        );
      }
    }

    // Calculate status
    const requiredQty = itemData.requiredQuantity;
    let status: 'missing' | 'partial' | 'complete';
    if (actualQty >= requiredQty) {
      status = 'complete';
    } else if (actualQty > 0) {
      status = 'partial';
    } else {
      status = 'missing';
    }

    const now = new Date();
    let kitItemId: string;

    if (existingItem) {
      // Update existing requirement
      const { data: updated, error: updateError } = await this.supabase
        .from('inventory_items')
        .update({
          quantity: requiredQty, // Required quantity for requirements
          supply_name: itemData.supplyName,
          freeform_name: itemData.supplyId ? null : itemData.supplyName,
          notes: itemData.notes,
          status:
            status === 'complete'
              ? 'active'
              : status === 'partial'
                ? 'active'
                : 'missing',
          updated_at: now.toISOString(),
        })
        .eq('id', existingItem.id)
        .select(
          `
          *,
          inventory_lots(
            id,
            quantity_units,
            status,
            expiration_date
          )
        `,
        )
        .single();

      if (updateError) {
        throw new Error(`Failed to update kit item: ${updateError.message}`);
      }
      kitItemId = updated.id;

      // Recalculate actual quantity
      if (updated.inventory_lots && Array.isArray(updated.inventory_lots)) {
        actualQty = updated.inventory_lots
          .filter(
            (lot: any) =>
              lot.status === 'active' &&
              (!lot.expiration_date ||
                new Date(lot.expiration_date) >= new Date()),
          )
          .reduce(
            (sum: number, lot: any) => sum + (lot.quantity_units || 0),
            0,
          );
      }
    } else {
      // Create new requirement
      // Note: If an inventory item already exists (from createInventoryItem above),
      // we should update it to also be a requirement, not create a duplicate
      if (inventoryItemId) {
        // Update the existing inventory item to also serve as the requirement
        const { data: updated, error: updateError } = await this.supabase
          .from('inventory_items')
          .update({
            quantity: requiredQty, // Required quantity for requirements
            supply_name: itemData.supplyName,
            freeform_name: itemData.supplyId ? null : itemData.supplyName,
            notes: itemData.notes,
            status:
              status === 'complete'
                ? 'active'
                : status === 'partial'
                  ? 'active'
                  : 'missing',
            updated_at: now.toISOString(),
          })
          .eq('id', inventoryItemId)
          .select(
            `
            *,
            inventory_lots(
              id,
              quantity_units,
              status,
              expiration_date
            )
          `,
          )
          .single();

        if (updateError) {
          throw new Error(`Failed to update kit item: ${updateError.message}`);
        }
        kitItemId = updated.id;

        // Recalculate actual quantity
        if (updated.inventory_lots && Array.isArray(updated.inventory_lots)) {
          actualQty = updated.inventory_lots
            .filter(
              (lot: any) =>
                lot.status === 'active' &&
                (!lot.expiration_date ||
                  new Date(lot.expiration_date) >= new Date()),
            )
            .reduce(
              (sum: number, lot: any) => sum + (lot.quantity_units || 0),
              0,
            );
        }
      } else {
        // Create new requirement (no inventory item exists)
        const { data: newItem, error: createError } = await this.supabase
          .from('inventory_items')
          .insert({
            tenant_id: tenant.id,
            kit_id: userKitId,
            supply_id: itemData.supplyId || null,
            freeform_name: itemData.supplyId ? null : itemData.supplyName,
            supply_name: itemData.supplyName,
            location_id: kit.location_id,
            quantity: requiredQty, // Required quantity for requirements
            is_requirement: true, // This is a requirement/placeholder
            status:
              status === 'complete'
                ? 'active'
                : status === 'partial'
                  ? 'active'
                  : 'missing',
            notes: itemData.notes,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .select(
            `
            *,
            inventory_lots(
              id,
              quantity_units,
              status,
              expiration_date
            )
          `,
          )
          .single();

        if (createError) {
          throw new Error(`Failed to create kit item: ${createError.message}`);
        }
        kitItemId = newItem.id;

        // Recalculate actual quantity from new item
        if (newItem.inventory_lots && Array.isArray(newItem.inventory_lots)) {
          actualQty = newItem.inventory_lots
            .filter(
              (lot: any) =>
                lot.status === 'active' &&
                (!lot.expiration_date ||
                  new Date(lot.expiration_date) >= new Date()),
            )
            .reduce(
              (sum: number, lot: any) => sum + (lot.quantity_units || 0),
              0,
            );
        }
      }
    }

    // Fetch the final item to return
    const { data: finalItem } = await this.supabase
      .from('inventory_items')
      .select(
        `
        *,
        inventory_lots(
          id,
          quantity_units,
          status,
          expiration_date
        )
      `,
      )
      .eq('id', kitItemId)
      .single();

    if (!finalItem) {
      throw new Error('Failed to fetch created kit item');
    }

    return rowToKitItem(finalItem, actualQty);
  }

  /**
   * @deprecated - Use createKitItemInstance() directly, this method is kept for backward compatibility
   */
  private async createKitItemInstanceNewSchema(
    userId: string,
    containerId: string,
    container: any,
    itemData: Omit<
      KitItemInstance,
      | 'id'
      | 'userKitId'
      | 'actualQuantity'
      | 'status'
      | 'createdAt'
      | 'updatedAt'
    > & { actualQuantity?: number; createInventoryItem?: boolean },
  ): Promise<KitItemInstance> {
    // Check if requirement already exists (deprecated method - use createKitItemInstance instead)
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);
    const { data: existingItem } = await this.supabase
      .from('inventory_items')
      .select('id')
      .eq('kit_id', containerId)
      .eq('tenant_id', tenant.id)
      .eq('is_requirement', true)
      .or(
        `supply_id.eq.${itemData.supplyId || 'null'},freeform_name.eq.${itemData.supplyName || 'null'}`,
      )
      .single();

    let inventoryItemId: string | undefined;
    let actualQty = 0;

    // Handle inventory creation/assignment
    if (itemData.createInventoryItem && itemData.requiredQuantity > 0) {
      // Create inventory item and assign to container
      try {
        const inventoryItem = await this.inventoryService.createInventoryItem(
          userId,
          {
            supplyId: itemData.supplyId,
            supplyName: itemData.supplyName || 'Unknown item',
            locationId: container.location_id,
            quantity: itemData.requiredQuantity,
            status: 'active',
            notes: itemData.notes,
            containerId: containerId,
            expirationDate: (itemData as any).expirationDate
              ? new Date((itemData as any).expirationDate)
              : undefined,
          } as any,
        );
        inventoryItemId = inventoryItem.id;
        actualQty = inventoryItem.quantity || itemData.requiredQuantity;
        this.logger.log(
          `✅ Created inventory item ${inventoryItem.id} for kit: ${itemData.supplyName}`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `❌ Failed to create inventory item: ${errorMessage}`,
        );
        // Continue - kit_item will be created without inventory
      }
    } else if (itemData.inventoryItemId) {
      // Assign existing inventory item to container
      inventoryItemId = itemData.inventoryItemId;
      try {
        await this.inventoryService.updateInventoryItem(
          userId,
          itemData.inventoryItemId,
          {
            containerId: containerId,
          } as any,
        );

        // Get actual quantity from inventory lots
        const { data: invItem } = await this.supabase
          .from('inventory_items')
          .select(
            `
            inventory_lots(
              quantity_units,
              status,
              expiration_date
            )
          `,
          )
          .eq('id', itemData.inventoryItemId)
          .single();

        if (invItem?.inventory_lots) {
          actualQty = invItem.inventory_lots
            .filter(
              (lot: any) =>
                lot.status === 'active' &&
                (!lot.expiration_date ||
                  new Date(lot.expiration_date) >= new Date()),
            )
            .reduce(
              (sum: number, lot: any) => sum + (lot.quantity_units || 0),
              0,
            );
        }

        this.logger.log(
          `✅ Assigned inventory item ${itemData.inventoryItemId} to container ${containerId}`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `❌ Failed to assign inventory item: ${errorMessage}`,
        );
      }
    }

    // Calculate status
    const requiredQty = itemData.requiredQuantity;
    let status: 'missing' | 'partial' | 'complete';
    if (actualQty >= requiredQty) {
      status = 'complete';
    } else if (actualQty > 0) {
      status = 'partial';
    } else {
      status = 'missing';
    }

    const now = new Date();
    let kitItemId: string;

    if (existingItem) {
      // Update existing requirement (deprecated method)
      const { data: updated, error: updateError } = await this.supabase
        .from('inventory_items')
        .update({
          quantity: requiredQty,
          supply_name: itemData.supplyName,
          freeform_name: itemData.supplyId ? null : itemData.supplyName,
          notes: itemData.notes,
          status:
            status === 'complete'
              ? 'active'
              : status === 'partial'
                ? 'active'
                : 'missing',
          updated_at: now.toISOString(),
        })
        .eq('id', existingItem.id)
        .select(
          `
          *,
          inventory_lots(
            id,
            quantity_units,
            status,
            expiration_date
          )
        `,
        )
        .single();

      if (updateError) {
        throw new Error(`Failed to update kit item: ${updateError.message}`);
      }
      kitItemId = updated.id;

      // Recalculate actual quantity
      if (updated.inventory_lots && Array.isArray(updated.inventory_lots)) {
        actualQty = updated.inventory_lots
          .filter(
            (lot: any) =>
              lot.status === 'active' &&
              (!lot.expiration_date ||
                new Date(lot.expiration_date) >= new Date()),
          )
          .reduce(
            (sum: number, lot: any) => sum + (lot.quantity_units || 0),
            0,
          );
      }
    } else {
      // Create new requirement (deprecated method)
      const { data: newItem, error: createError } = await this.supabase
        .from('inventory_items')
        .insert({
          tenant_id: container.tenant_id,
          kit_id: containerId,
          supply_id: itemData.supplyId || null,
          freeform_name: itemData.supplyId ? null : itemData.supplyName,
          supply_name: itemData.supplyName,
          location_id: container.location_id,
          quantity: requiredQty,
          is_requirement: true,
          status:
            status === 'complete'
              ? 'active'
              : status === 'partial'
                ? 'active'
                : 'missing',
          notes: itemData.notes,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select(
          `
          *,
          inventory_lots(
            id,
            quantity_units,
            status,
            expiration_date
          )
        `,
        )
        .single();

      if (createError) {
        throw new Error(`Failed to create kit item: ${createError.message}`);
      }
      kitItemId = newItem.id;

      // Recalculate actual quantity
      if (newItem.inventory_lots && Array.isArray(newItem.inventory_lots)) {
        actualQty = newItem.inventory_lots
          .filter(
            (lot: any) =>
              lot.status === 'active' &&
              (!lot.expiration_date ||
                new Date(lot.expiration_date) >= new Date()),
          )
          .reduce(
            (sum: number, lot: any) => sum + (lot.quantity_units || 0),
            0,
          );
      }
    }

    // Fetch the final item to return
    const { data: finalItem } = await this.supabase
      .from('inventory_items')
      .select(
        `
        *,
        inventory_lots(
          id,
          quantity_units,
          status,
          expiration_date
        )
      `,
      )
      .eq('id', kitItemId)
      .single();

    if (!finalItem) {
      throw new Error('Failed to fetch created kit item');
    }

    return rowToKitItem(finalItem, actualQty);
  }

  /**
   * @deprecated - Use createKitItemInstance() directly, this method is kept for backward compatibility
   */
  private async createKitItemInstanceOldSchema(
    userId: string,
    userKitId: string,
    itemData: Omit<
      KitItemInstance,
      | 'id'
      | 'userKitId'
      | 'actualQuantity'
      | 'status'
      | 'createdAt'
      | 'updatedAt'
    > & { actualQuantity?: number; createInventoryItem?: boolean },
  ): Promise<KitItemInstance> {
    // Original implementation for backward compatibility (updated to use kits table)
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);
    const { data: kit, error: kitError } = await this.supabase
      .from('kits')
      .select('id, location_id, name, locations(name)')
      .eq('id', userKitId)
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null)
      .single();

    if (kitError || !kit) {
      throw new NotFoundException('Kit not found');
    }

    const locationName = (kit.locations as any)?.name;

    let inventoryItemId = itemData.inventoryItemId;
    let actualQuantity = itemData.actualQuantity || 0;

    if (
      itemData.createInventoryItem &&
      !inventoryItemId &&
      itemData.requiredQuantity > 0
    ) {
      try {
        const inventoryItem = await this.inventoryService.createInventoryItem(
          userId,
          {
            supplyId: itemData.supplyId,
            supplyName: itemData.supplyName || 'Unknown item',
            locationId: kit.location_id,
            locationName: locationName,
            kitId: kit.id,
            quantity: itemData.requiredQuantity,
            status: 'active',
            notes: itemData.notes,
          } as any,
        );
        inventoryItemId = inventoryItem.id;
        actualQuantity = inventoryItem.quantity || itemData.requiredQuantity;
      } catch (error) {
        this.logger.error(`Failed to create inventory item: ${error}`);
      }
    }

    if (inventoryItemId) {
      const { data: inventoryItem } = await this.supabase
        .from('inventory_items')
        .select('quantity, kit_id, tenant_id')
        .eq('id', inventoryItemId)
        .eq('tenant_id', tenant.id)
        .single();

      if (inventoryItem && inventoryItem.kit_id !== userKitId) {
        try {
          await this.inventoryService.updateInventoryItem(
            userId,
            inventoryItemId,
            {
              kitId: userKitId,
              locationId: kit.location_id,
            } as any,
          );
        } catch (error) {
          this.logger.error(`Failed to update inventory item: ${error}`);
        }
      }
    }

    let status: 'missing' | 'partial' | 'complete';
    if (actualQuantity >= itemData.requiredQuantity) {
      status = 'complete';
    } else if (actualQuantity > 0) {
      status = 'partial';
    } else {
      status = 'missing';
    }

    const now = new Date();
    // Create as requirement in inventory_items
    const { data, error } = await this.supabase
      .from('inventory_items')
      .insert({
        tenant_id: tenant.id,
        kit_id: userKitId,
        supply_id: itemData.supplyId || null,
        freeform_name: itemData.supplyId ? null : itemData.supplyName,
        supply_name: itemData.supplyName,
        location_id: kit.location_id,
        quantity: itemData.requiredQuantity, // Required quantity for requirements
        is_requirement: true, // This is a requirement/placeholder
        status:
          status === 'complete'
            ? 'active'
            : status === 'partial'
              ? 'active'
              : 'missing',
        notes: itemData.notes,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select(
        `
        *,
        inventory_lots(
          id,
          quantity_units,
          status,
          expiration_date
        )
      `,
      )
      .single();

    if (error) {
      throw new Error(`Failed to create kit item: ${error.message}`);
    }

    // Calculate actual quantity from lots if available
    let actualQty = 0;
    if (data.inventory_lots && Array.isArray(data.inventory_lots)) {
      actualQty = data.inventory_lots
        .filter(
          (lot: any) =>
            lot.status === 'active' &&
            (!lot.expiration_date ||
              new Date(lot.expiration_date) >= new Date()),
        )
        .reduce((sum: number, lot: any) => sum + (lot.quantity_units || 0), 0);
    }

    return rowToKitItem(data, actualQty);
  }

  async updateKitItemInstance(
    userId: string,
    userKitId: string,
    itemId: string,
    updates: {
      actualQuantity?: number;
      supplyName?: string;
      requiredQuantity?: number;
      notes?: string;
    },
  ): Promise<KitItemInstance> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Verify kit exists
    const { data: kit, error: kitError } = await this.supabase
      .from('kits')
      .select('id')
      .eq('id', userKitId)
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null)
      .single();

    if (kitError || !kit) {
      throw new NotFoundException('Kit not found');
    }

    // Get current item
    const { data: currentItem, error: itemError } = await this.supabase
      .from('inventory_items')
      .select(
        `
        *,
        inventory_lots(
          id,
          quantity_units,
          status,
          expiration_date
        )
      `,
      )
      .eq('id', itemId)
      .eq('kit_id', userKitId)
      .eq('tenant_id', tenant.id)
      .single();

    if (itemError || !currentItem) {
      throw new NotFoundException('Kit item instance not found');
    }

    // Calculate current actual quantity from lots
    let currentActualQty = 0;
    if (
      currentItem.inventory_lots &&
      Array.isArray(currentItem.inventory_lots)
    ) {
      currentActualQty = currentItem.inventory_lots
        .filter(
          (lot: any) =>
            lot.status === 'active' &&
            (!lot.expiration_date ||
              new Date(lot.expiration_date) >= new Date()),
        )
        .reduce((sum: number, lot: any) => sum + (lot.quantity_units || 0), 0);
    } else if (!currentItem.is_requirement) {
      currentActualQty = currentItem.quantity || 0;
    }

    const itemData = rowToKitItem(currentItem, currentActualQty);

    // Use updated values or fall back to existing values
    const actualQuantity =
      updates.actualQuantity !== undefined
        ? Math.max(0, updates.actualQuantity)
        : itemData.actualQuantity;
    const requiredQuantity =
      updates.requiredQuantity !== undefined
        ? Math.max(1, updates.requiredQuantity)
        : itemData.requiredQuantity;
    const supplyName =
      updates.supplyName !== undefined
        ? updates.supplyName
        : itemData.supplyName;

    // Calculate status
    let status: 'missing' | 'partial' | 'complete';
    if (actualQuantity >= requiredQuantity) {
      status = 'complete';
    } else if (actualQuantity > 0) {
      status = 'partial';
    } else {
      status = 'missing';
    }

    const updateData: any = {
      quantity: requiredQuantity, // For requirements, quantity is the required quantity
      status:
        status === 'complete'
          ? 'active'
          : status === 'partial'
            ? 'active'
            : 'missing',
      updated_at: new Date().toISOString(),
    };

    if (updates.supplyName !== undefined) {
      updateData.supply_name = supplyName;
      if (!currentItem.supply_id) {
        updateData.freeform_name = supplyName;
      }
    }
    if (updates.notes !== undefined) {
      updateData.notes = updates.notes === '' ? null : updates.notes;
    }

    const { data: updatedItem, error: updateError } = await this.supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', itemId)
      .select(
        `
        *,
        inventory_lots(
          id,
          quantity_units,
          status,
          expiration_date
        )
      `,
      )
      .single();

    if (updateError) {
      throw new Error(`Failed to update kit item: ${updateError.message}`);
    }

    // Recalculate actual quantity
    let actualQty = 0;
    if (
      updatedItem.inventory_lots &&
      Array.isArray(updatedItem.inventory_lots)
    ) {
      actualQty = updatedItem.inventory_lots
        .filter(
          (lot: any) =>
            lot.status === 'active' &&
            (!lot.expiration_date ||
              new Date(lot.expiration_date) >= new Date()),
        )
        .reduce((sum: number, lot: any) => sum + (lot.quantity_units || 0), 0);
    } else if (!updatedItem.is_requirement) {
      actualQty = updatedItem.quantity || 0;
    }

    return rowToKitItem(updatedItem, actualQty);
  }

  async moveKitItemInstance(
    userId: string,
    sourceKitId: string,
    itemId: string,
    targetKitId: string,
  ): Promise<KitItemInstance> {
    if (sourceKitId === targetKitId) {
      throw new Error('Cannot move item to the same kit');
    }

    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Verify both kits exist
    const { data: sourceKit, error: sourceError } = await this.supabase
      .from('kits')
      .select('id, location_id, name')
      .eq('id', sourceKitId)
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null)
      .single();

    if (sourceError || !sourceKit) {
      throw new NotFoundException('Source kit not found');
    }

    const { data: targetKit, error: targetError } = await this.supabase
      .from('kits')
      .select('id, location_id, name')
      .eq('id', targetKitId)
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null)
      .single();

    if (targetError || !targetKit) {
      throw new NotFoundException('Target kit not found');
    }

    // Get the item from source kit
    const { data: sourceItem, error: itemError } = await this.supabase
      .from('inventory_items')
      .select(
        `
        *,
        inventory_lots(
          id,
          quantity_units,
          status,
          expiration_date
        )
      `,
      )
      .eq('id', itemId)
      .eq('kit_id', sourceKitId)
      .eq('tenant_id', tenant.id)
      .single();

    if (itemError || !sourceItem) {
      throw new NotFoundException('Kit item instance not found');
    }

    // Calculate actual quantity from lots
    let actualQty = 0;
    if (sourceItem.inventory_lots && Array.isArray(sourceItem.inventory_lots)) {
      actualQty = sourceItem.inventory_lots
        .filter(
          (lot: any) =>
            lot.status === 'active' &&
            (!lot.expiration_date ||
              new Date(lot.expiration_date) >= new Date()),
        )
        .reduce((sum: number, lot: any) => sum + (lot.quantity_units || 0), 0);
    } else if (!sourceItem.is_requirement) {
      actualQty = sourceItem.quantity || 0;
    }

    const itemData = rowToKitItem(sourceItem, actualQty);
    const now = new Date();

    // If this item has an inventory item (is_requirement = false), update its kit_id to the target kit
    if (!sourceItem.is_requirement) {
      try {
        await this.inventoryService.updateInventoryItem(userId, sourceItem.id, {
          kitId: targetKitId,
          locationId: targetKit.location_id,
        } as any);
        this.logger.log(
          `✅ Updated inventory item ${sourceItem.id} to move from kit ${sourceKitId} to kit ${targetKitId}`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `❌ Failed to update inventory item ${sourceItem.id} during move: ${errorMessage}`,
        );
        // Continue - the requirement will still be moved
      }
    }

    // Update kit_id to move to target kit
    const { data: updatedItem, error: updateError } = await this.supabase
      .from('inventory_items')
      .update({
        kit_id: targetKitId,
        location_id: targetKit.location_id,
        updated_at: now.toISOString(),
      })
      .eq('id', itemId)
      .select(
        `
        *,
        inventory_lots(
          id,
          quantity_units,
          status,
          expiration_date
        )
      `,
      )
      .single();

    if (updateError) {
      throw new Error(
        `Failed to move item to target kit: ${updateError.message}`,
      );
    }

    // Recalculate actual quantity
    let finalActualQty = 0;
    if (
      updatedItem.inventory_lots &&
      Array.isArray(updatedItem.inventory_lots)
    ) {
      finalActualQty = updatedItem.inventory_lots
        .filter(
          (lot: any) =>
            lot.status === 'active' &&
            (!lot.expiration_date ||
              new Date(lot.expiration_date) >= new Date()),
        )
        .reduce((sum: number, lot: any) => sum + (lot.quantity_units || 0), 0);
    } else if (!updatedItem.is_requirement) {
      finalActualQty = updatedItem.quantity || 0;
    }

    return rowToKitItem(updatedItem, finalActualQty);
  }

  async deleteKitItemInstance(
    userId: string,
    userKitId: string,
    itemId: string,
  ): Promise<void> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Verify kit exists
    const { data: kit, error: kitError } = await this.supabase
      .from('kits')
      .select('id')
      .eq('id', userKitId)
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null)
      .single();

    if (kitError || !kit) {
      throw new NotFoundException('Kit not found');
    }

    // Verify item exists
    const { data: item, error: itemError } = await this.supabase
      .from('inventory_items')
      .select('id, is_requirement')
      .eq('id', itemId)
      .eq('kit_id', userKitId)
      .eq('tenant_id', tenant.id)
      .single();

    if (itemError || !item) {
      throw new NotFoundException('Kit item instance not found');
    }

    // Only delete if it's a requirement (is_requirement = true)
    // Actual items (is_requirement = false) should be handled differently
    if (!item.is_requirement) {
      // For actual items, we might want to just remove from kit (set kit_id to null)
      // instead of deleting. But for now, we'll delete if explicitly requested.
      this.logger.warn(
        `Deleting actual inventory item ${itemId} from kit ${userKitId}. Consider removing from kit instead.`,
      );
    }

    const { error: deleteError } = await this.supabase
      .from('inventory_items')
      .delete()
      .eq('id', itemId);

    if (deleteError) {
      throw new Error(`Failed to delete kit item: ${deleteError.message}`);
    }
  }

  async bulkUpdateKitItemsToRequiredQuantity(
    userId: string,
    userKitId: string,
  ): Promise<{ updated: number; failed: number }> {
    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Verify kit exists
    const { data: kit, error: kitError } = await this.supabase
      .from('kits')
      .select('id')
      .eq('id', userKitId)
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null)
      .single();

    if (kitError || !kit) {
      throw new NotFoundException('Kit not found');
    }

    // Get all kit requirements (is_requirement = true)
    const { data: items, error: itemsError } = await this.supabase
      .from('inventory_items')
      .select(
        `
        *,
        inventory_lots(
          id,
          quantity_units,
          status,
          expiration_date
        )
      `,
      )
      .eq('kit_id', userKitId)
      .eq('tenant_id', tenant.id)
      .eq('is_requirement', true);

    if (itemsError) {
      throw new Error(`Failed to fetch kit items: ${itemsError.message}`);
    }

    if (!items || items.length === 0) {
      return { updated: 0, failed: 0 };
    }

    let updated = 0;
    let failed = 0;
    const now = new Date();

    // Update items that need updating
    for (const item of items) {
      const requiredQuantity = item.quantity || 0; // For requirements, quantity is required quantity

      // Calculate actual quantity from lots
      let actualQuantity = 0;
      if (item.inventory_lots && Array.isArray(item.inventory_lots)) {
        actualQuantity = item.inventory_lots
          .filter(
            (lot: any) =>
              lot.status === 'active' &&
              (!lot.expiration_date ||
                new Date(lot.expiration_date) >= new Date()),
          )
          .reduce(
            (sum: number, lot: any) => sum + (lot.quantity_units || 0),
            0,
          );
      }

      // Only update if actualQuantity is different from requiredQuantity
      // Note: This updates the status, but actual quantity comes from inventory_lots
      // So we're mainly updating the status field
      if (actualQuantity !== requiredQuantity) {
        const status: 'missing' | 'partial' | 'complete' =
          actualQuantity >= requiredQuantity
            ? 'complete'
            : actualQuantity > 0
              ? 'partial'
              : 'missing';

        const { error: updateError } = await this.supabase
          .from('inventory_items')
          .update({
            status:
              status === 'complete'
                ? 'active'
                : status === 'partial'
                  ? 'active'
                  : 'missing',
            updated_at: now.toISOString(),
          })
          .eq('id', item.id);

        if (updateError) {
          this.logger.error(
            `Failed to update kit item ${item.id}: ${updateError.message}`,
          );
          failed++;
        } else {
          updated++;
        }
      }
    }

    return { updated, failed };
  }
}
