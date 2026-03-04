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
import {
  InventoryService,
  type InventoryItem,
} from '../inventory/inventory.service';
import { TenantsService } from '../tenants/tenants.service';
import { ComplianceService } from '../compliance/compliance.service';

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
  isOshaKit?: boolean;
  oshaKitType?: string;
  oshaRuleId?: string;
  complianceStatus?: 'compliant' | 'non_compliant' | 'partial' | 'not_checked';
  complianceScore?: number;
  lastComplianceCheckAt?: Date;
  complianceMetadata?: {
    missingItems?: Array<{
      supplyId: string;
      supplyName: string;
      requiredQuantity: number;
      actualQuantity: number;
    }>;
    extraItems?: Array<{
      supplyId: string;
      supplyName: string;
      quantity: number;
    }>;
  };
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
    isOshaKit: row.is_osha_kit || false,
    oshaKitType: row.osha_kit_type,
    oshaRuleId: row.osha_rule_id,
    complianceStatus: row.compliance_status || 'not_checked',
    complianceScore: row.compliance_score,
    lastComplianceCheckAt: row.last_compliance_check_at
      ? new Date(row.last_compliance_check_at)
      : undefined,
    complianceMetadata: row.compliance_metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// Helper function to convert PostgreSQL row to KitItemInstance
// Works with consolidated inventory_items table
function rowToKitItem(row: any, actualQuantity?: number): KitItemInstance {
  // Read required_quantity and actual_quantity directly from database columns
  const reqQty =
    row.required_quantity !== undefined && row.required_quantity !== null
      ? row.required_quantity
      : 0;
  const actQty =
    actualQuantity !== undefined
      ? actualQuantity
      : row.actual_quantity !== undefined && row.actual_quantity !== null
        ? row.actual_quantity
        : 0;

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
    inventoryItemId: row.inventory_item_id || row.id,
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

// Helper function to convert PostgreSQL row to InventoryItem (for kit items)
// Includes kit-specific fields: requiredQuantity and actualQuantity
// Reads directly from database columns (no calculation needed)
function rowToInventoryItemForKit(row: any): InventoryItem {
  // Read actual_quantity and required_quantity directly from database columns
  const actQty =
    row.actual_quantity !== undefined && row.actual_quantity !== null
      ? row.actual_quantity
      : 0;

  // Read required_quantity from database column
  const reqQty =
    row.required_quantity !== undefined && row.required_quantity !== null
      ? row.required_quantity
      : undefined;

  // Calculate status for kit items
  let status: 'missing' | 'partial' | 'complete';
  if (row.status && ['missing', 'partial', 'complete'].includes(row.status)) {
    status = row.status as 'missing' | 'partial' | 'complete';
  } else {
    // For kit items, calculate status based on actual vs required
    if (actQty >= reqQty) {
      status = 'complete';
    } else if (actQty > 0) {
      status = 'partial';
    } else {
      status = 'missing';
    }
  }

  // Read expiration date directly from row (no lots aggregation)
  const expirationDate = row.expiration_date
    ? new Date(row.expiration_date)
    : undefined;

  // Read purchase info directly from row (no lots aggregation)
  const purchaseDate = row.purchase_date
    ? new Date(row.purchase_date)
    : undefined;
  const purchasePrice = row.purchase_price;
  const supplier = row.supplier;

  return {
    id: row.id,
    userId: row.user_id || '',
    supplyId: row.supply_id,
    supplyName: row.supply_name || row.freeform_name || '',
    supplyCategoryId: row.supply_category_id,
    locationId: row.location_id || '',
    locationName: row.location_name,
    kitId: row.kit_id,
    kitName: row.kit_name,
    // Use actual_quantity and required_quantity directly (no quantity field)
    actualQuantity: actQty, // Read from database column
    requiredQuantity: reqQty, // Read from database column
    lotCode: row.lot_code, // Lot/batch identifier
    expirationDate,
    purchaseDate,
    purchasePrice,
    supplier,
    notes: row.notes,
    status: status,
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
    @Inject(forwardRef(() => ComplianceService))
    private readonly complianceService: ComplianceService,
  ) {}

  /**
   * Resolve kit access: returns kit id and tenant id if the user can access the kit
   * (as owner via tenant, or as shared editor via kit_acl with edit/admin).
   * When requireEdit is true, only returns when user has edit or admin permission.
   */
  private async getKitIdAndTenantIdIfAccessible(
    userId: string,
    kitId: string,
    requireEdit: boolean,
  ): Promise<{ kitId: string; tenantId: string } | null> {
    const trimmedUserId = userId?.trim();
    const trimmedKitId = kitId?.trim();
    if (!trimmedUserId || !trimmedKitId) return null;

    const tenant =
      await this.tenantsService.getUserDefaultTenant(trimmedUserId);

    const { data: kit, error: kitError } = await this.supabase
      .from('kits')
      .select('id, tenant_id')
      .eq('id', trimmedKitId)
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null)
      .single();

    if (!kitError && kit) {
      return { kitId: trimmedKitId, tenantId: kit.tenant_id };
    }

    const { data: acl, error: aclError } = await this.supabase
      .from('kit_acl')
      .select('kit_id')
      .eq('kit_id', trimmedKitId)
      .eq('subject_type', 'user')
      .eq('subject_id', trimmedUserId)
      .in(
        'permission',
        requireEdit ? ['edit', 'admin'] : ['view', 'edit', 'admin'],
      )
      .single();

    if (aclError || !acl) return null;

    const { data: sharedKit, error: sharedKitError } = await this.supabase
      .from('kits')
      .select('id, tenant_id')
      .eq('id', trimmedKitId)
      .is('deleted_at', null)
      .single();

    if (sharedKitError || !sharedKit) return null;
    return { kitId: trimmedKitId, tenantId: sharedKit.tenant_id };
  }

  /**
   * Compute kit status from requirement items: complete if all requirement items are complete, else incomplete.
   * Used for non-archived kits so status reflects item fulfillment.
   */
  private async computeKitStatusFromItems(
    tenantId: string,
    kitId: string,
  ): Promise<'complete' | 'incomplete'> {
    const { data: items, error } = await this.supabase
      .from('inventory_items')
      .select('id, status')
      .eq('kit_id', kitId)
      .eq('tenant_id', tenantId)
      .not('required_quantity', 'is', null);

    if (error || !items?.length) {
      return 'incomplete';
    }
    const allComplete = items.every(
      (row: { status: string }) => row.status === 'complete',
    );
    return allComplete ? 'complete' : 'incomplete';
  }

  /**
   * Batch compute derived status for multiple kits (non-archived only).
   * Returns a map of kitId -> 'complete' | 'incomplete'.
   */
  private async computeKitStatusFromItemsBatch(
    tenantId: string,
    kitIds: string[],
  ): Promise<Map<string, 'complete' | 'incomplete'>> {
    const result = new Map<string, 'complete' | 'incomplete'>();
    kitIds.forEach((id) => result.set(id, 'incomplete'));
    if (kitIds.length === 0) return result;

    const { data: rows, error } = await this.supabase
      .from('inventory_items')
      .select('kit_id, status')
      .in('kit_id', kitIds)
      .eq('tenant_id', tenantId)
      .not('required_quantity', 'is', null);

    if (error || !rows?.length) return result;

    const hasIncomplete = new Set<string>();
    for (const row of rows as { kit_id: string; status: string }[]) {
      if (row.status !== 'complete') {
        hasIncomplete.add(row.kit_id);
      }
    }
    const hasRequirements = new Set(
      (rows as { kit_id: string }[]).map((r) => r.kit_id),
    );
    for (const kitId of kitIds) {
      result.set(
        kitId,
        hasRequirements.has(kitId) && !hasIncomplete.has(kitId)
          ? 'complete'
          : 'incomplete',
      );
    }
    return result;
  }

  async getUserKitsPaginated(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: UserKit[]; hasMore: boolean; page: number }> {
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: kitsData, error } = await this.supabase
      .from('kits')
      .select(
        'id, name, location_id, status, notes, metadata, created_at, updated_at, is_osha_kit, osha_kit_type, osha_rule_id, compliance_status, compliance_score, last_compliance_check_at, compliance_metadata, locations(name)',
      )
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to get user kits: ${error.message}`);
    }

    const kits = kitsData || [];
    const nonArchivedIds = kits
      .filter((k: any) => k.status !== 'archived')
      .map((k: any) => k.id);
    const derivedStatus = await this.computeKitStatusFromItemsBatch(
      tenant.id,
      nonArchivedIds,
    );

    const data = kits.map((kit: any) => {
      const status =
        kit.status === 'archived'
          ? kit.status
          : (derivedStatus.get(kit.id) ?? kit.status);
      return rowToUserKit({
        ...kit,
        status,
        user_id: userId,
        kit_template_id: kit.metadata?.kit_template_id,
        kit_template_name: kit.metadata?.kit_template_name,
        location_name: Array.isArray(kit.locations)
          ? kit.locations[0]?.name
          : kit.locations?.name,
      });
    });

    return {
      data,
      hasMore: data.length === pageSize,
      page,
    };
  }

  async getUserKits(userId: string): Promise<UserKit[]> {
    // Get user's default tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Query kits directly (containers table was removed in migration 025)
    const { data: kitsData, error } = await this.supabase
      .from('kits')
      .select(
        'id, name, location_id, status, notes, metadata, created_at, updated_at, is_osha_kit, osha_kit_type, osha_rule_id, compliance_status, compliance_score, last_compliance_check_at, compliance_metadata, locations(name)',
      )
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to get user kits: ${error.message}`);
    }

    const kits = kitsData || [];
    const nonArchivedIds = kits
      .filter((k: any) => k.status !== 'archived')
      .map((k: any) => k.id);
    const derivedStatus = await this.computeKitStatusFromItemsBatch(
      tenant.id,
      nonArchivedIds,
    );

    return kits.map((kit: any) => {
      const status =
        kit.status === 'archived'
          ? kit.status
          : (derivedStatus.get(kit.id) ?? kit.status);
      return rowToUserKit({
        ...kit,
        status,
        user_id: userId,
        kit_template_id: kit.metadata?.kit_template_id,
        kit_template_name: kit.metadata?.kit_template_name,
        location_name: Array.isArray(kit.locations)
          ? kit.locations[0]?.name
          : kit.locations?.name,
      });
    });
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
        'id, name, location_id, status, notes, metadata, created_at, updated_at, is_osha_kit, osha_kit_type, osha_rule_id, compliance_status, compliance_score, last_compliance_check_at, compliance_metadata, locations(name)',
      )
      .eq('id', kitId.trim())
      .eq('tenant_id', tenant.id)
      .is('deleted_at', null)
      .single();

    if (!kitError && kit) {
      const base = {
        ...kit,
        user_id: userId,
        kit_template_id: kit.metadata?.kit_template_id,
        kit_template_name: kit.metadata?.kit_template_name,
        location_name: Array.isArray(kit.locations)
          ? kit.locations[0]?.name
          : (kit.locations as any)?.name,
      };
      if (kit.status !== 'archived') {
        base.status = await this.computeKitStatusFromItems(tenant.id, kit.id);
      }
      return rowToUserKit(base);
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
        const base = {
          ...sharedKit,
          user_id: userId,
          kit_template_id: sharedKit.metadata?.kit_template_id,
          kit_template_name: sharedKit.metadata?.kit_template_name,
          location_name: Array.isArray(sharedKit.locations)
            ? sharedKit.locations[0]?.name
            : sharedKit.locations?.name,
        };
        if (sharedKit.status !== 'archived') {
          base.status = await this.computeKitStatusFromItems(
            sharedKit.tenant_id,
            sharedKit.id,
          );
        }
        return rowToUserKit(base);
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
        .is('deleted_at', null);

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

    // Premium check for OSHA kit designation
    if (kitData.isOshaKit) {
      const isPremium = await this.usersService.isPremiumUser(userId);
      if (!isPremium) {
        throw new ForbiddenException({
          code: 'PREMIUM_REQUIRED',
          message:
            'OSHA compliance features require a premium subscription. Upgrade to premium to designate kits as OSHA-compliant.',
        });
      }
    }

    // Get user's tenant
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    const now = new Date();

    const insertData: any = {
      tenant_id: tenant.id,
      name: kitData.name,
      location_id: kitData.locationId,
      status: kitData.status ?? 'active',
      notes: kitData.notes,
      metadata: kitData.kitTemplateId
        ? {
            kit_template_id: kitData.kitTemplateId,
            kit_template_name: kitData.kitTemplateName,
          }
        : null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    // Add OSHA fields if provided
    if (kitData.isOshaKit !== undefined) {
      insertData.is_osha_kit = kitData.isOshaKit;
    }
    if (kitData.oshaKitType) {
      insertData.osha_kit_type = kitData.oshaKitType;
    }
    if (kitData.oshaRuleId) {
      insertData.osha_rule_id = kitData.oshaRuleId;
    }

    const { data, error } = await this.supabase
      .from('kits')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user kit: ${error.message}`);
    }

    // If OSHA kit, trigger compliance check
    if (kitData.isOshaKit && kitData.oshaKitType) {
      try {
        await this.recalculateCompliance(userId, data.id, kitData.oshaKitType);
      } catch (error) {
        this.logger.warn(
          `Failed to calculate compliance for new OSHA kit ${data.id}: ${error}`,
        );
        // Don't fail kit creation if compliance check fails
      }
    }

    // Convert kits row to UserKit format
    return rowToUserKit({
      ...data,
      user_id: userId,
      kit_template_id: data.metadata?.kit_template_id,
      kit_template_name: data.metadata?.kit_template_name,
      location_name: kitData.locationName,
    });
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
      requiredQuantity: number;
      notes?: string;
    }>,
  ): Promise<UserKit> {
    // Check if template is an OSHA template by checking template purpose
    // OSHA templates have purposes like 'osha-class-a', 'osha-class-b', etc.
    const { data: template } = await this.supabase
      .from('kit_templates')
      .select('purpose, requires_premium')
      .eq('id', templateId)
      .single();

    let oshaKitType: string | undefined;
    if (template?.purpose?.startsWith('osha-')) {
      // Map template purpose to OSHA kit type
      const purposeMap: Record<string, string> = {
        'osha-class-a': 'class_a',
        'osha-class-b': 'class_b',
        'osha-construction': 'construction',
        'osha-general-industry': 'general_industry',
        'osha-healthcare': 'healthcare',
        'osha-food-service': 'food_service',
        'osha-warehouse': 'warehouse',
        'osha-manufacturing': 'manufacturing',
      };
      oshaKitType =
        purposeMap[template.purpose] || template.purpose.replace('osha-', '');
    }

    // Create the kit
    const kitData: Omit<UserKit, 'id' | 'userId' | 'createdAt' | 'updatedAt'> =
      {
        kitTemplateId: templateId,
        kitTemplateName: templateName,
        name: templateName,
        locationId,
        locationName,
        status: 'active',
      };

    // If it's an OSHA template, set OSHA fields (premium check happens in createUserKit)
    if (oshaKitType) {
      kitData.isOshaKit = true;
      kitData.oshaKitType = oshaKitType;
    }

    const kit = await this.createUserKit(userId, kitData);

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
          // Templates are built from the supply catalog and should have supplyId; allow supplyName-only as fallback for legacy data
          if (!item.supplyName?.trim()) {
            this.logger.warn(
              `Skipping inventory item creation: missing supply name and supplyId`,
            );
            continue;
          }
          // For fully loaded kits, actual quantity equals required quantity from template
          const actualQty = item.requiredQuantity ?? 0;
          if (actualQty <= 0) {
            this.logger.warn(
              `Skipping inventory item creation for ${item.supplyName || 'unknown item'}: requiredQuantity is ${actualQty}`,
            );
            continue;
          }
          if (!locationId) {
            this.logger.error(
              `Cannot create inventory item for ${item.supplyName || 'unknown item'}: locationId is missing`,
            );
            continue;
          }
          // Use supplyId + supplyName for mapping; freeform items use supplyName as key
          const mapKey = item.supplyId ?? `freeform:${item.supplyName.trim()}`;
          try {
            this.logger.log(
              `Creating inventory item: ${item.supplyName || 'Unknown'} (supplyId: ${item.supplyId ?? 'freeform'}, actualQuantity: ${actualQty}, locationId: ${locationId})`,
            );
            const inventoryItem =
              await this.inventoryService.createInventoryItem(userId, {
                supplyId: item.supplyId || undefined,
                supplyName: item.supplyName.trim(),
                locationId,
                locationName,
                kitId: kit.id,
                kitName: kit.name,
                actualQuantity: actualQty,
                requiredQuantity: actualQty,
                notes: (item as { notes?: string }).notes,
              });
            if (!inventoryItem || !inventoryItem.id) {
              this.logger.error(
                `❌ Inventory item creation returned invalid result for ${item.supplyName}: ${JSON.stringify(inventoryItem)}`,
              );
              continue;
            }
            inventoryItemMap.set(mapKey, inventoryItem.id);
            this.logger.log(
              `✅ Created inventory item for ${item.supplyName} (id: ${inventoryItem.id}, actualQuantity: ${actualQty}, kit: ${kit.name})`,
            );
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(
              `❌ Failed to create inventory item for ${item.supplyName || 'unknown'} (supplyId: ${item.supplyId}, actualQuantity: ${actualQty}): ${errorMessage}`,
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
          .select('id, supply_id, actual_quantity')
          .in('id', inventoryItemIds);

        if (fetchError) {
          this.logger.warn(
            `Failed to fetch inventory item quantities: ${fetchError.message}. Will use template quantities.`,
          );
        } else if (inventoryItems) {
          // Create reverse map: inventoryItemId -> quantity, then map to supplyId
          const inventoryIdToQuantity = new Map<string, number>();
          inventoryItems.forEach((inv) => {
            // Read actual quantity directly from database column
            const actualQty = inv.actual_quantity ?? 0;
            inventoryIdToQuantity.set(inv.id, actualQty);
          });

          // Map supplyId -> actualQuantity
          inventoryItemMap.forEach((inventoryItemId, supplyId) => {
            const actualQty = inventoryIdToQuantity.get(inventoryItemId) || 0;
            inventoryQuantitiesMap.set(supplyId, actualQty);
            this.logger.log(
              `Mapped inventory actualQuantity for supplyId ${supplyId}: ${actualQty}`,
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
        this.logger.log(
          `Creating empty kit requirements from ${templateItems.length} template items`,
        );
        const kitItems = templateItems
          .filter((item) => item.supplyId || item.supplyName)
          .map((item) => {
            // Ensure requiredQuantity is a valid number (should be > 0 for template items)
            const requiredQuantity =
              item.requiredQuantity && item.requiredQuantity > 0
                ? item.requiredQuantity
                : 0;

            // Create as requirement in inventory_items
            return {
              tenant_id: tenant.id,
              kit_id: kit.id,
              location_id: locationId, // Include location from the kit
              supply_id: item.supplyId || null,
              freeform_name: item.supplyId
                ? null
                : item.supplyName || 'Unknown item',
              supply_name: item.supplyName || 'Unknown item',
              required_quantity: requiredQuantity, // Required quantity for requirements
              actual_quantity: 0, // Requirements have 0 actual quantity
              status: 'missing', // Default status for requirements
              notes: (item as { notes?: string }).notes,
              created_at: now.toISOString(),
              updated_at: now.toISOString(),
            };
          });

        this.logger.log(
          `Filtered to ${kitItems.length} valid kit items for empty kit`,
        );

        if (kitItems.length > 0) {
          // Ensure all items have tenant_id
          const kitItemsWithTenant = kitItems.map((item) => ({
            ...item,
            tenant_id: tenant.id,
          }));

          this.logger.log(
            `Inserting ${kitItemsWithTenant.length} requirements into inventory_items for kit ${kit.id}`,
          );

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

          this.logger.log(
            `✅ Successfully created ${kitItemsWithTenant.length} requirements for kit ${kit.id}`,
          );
        } else {
          this.logger.warn(
            `No valid items to create for empty kit ${kit.id}. Template items: ${JSON.stringify(templateItems.slice(0, 3))}`,
          );
        }
      } else {
        // For fully loaded kits, the actual inventory items already serve as requirements
        // We need to update them to set the required quantity (already set on create; this is a no-op if create passed requiredQuantity)
        // CRITICAL: Do NOT create separate requirements - that would violate the unique constraint
        for (const [mapKey, inventoryItemId] of inventoryItemMap.entries()) {
          const templateItem = templateItems.find(
            (item) =>
              item.supplyId === mapKey ||
              (mapKey.startsWith('freeform:') &&
                item.supplyName?.trim() === mapKey.slice(9)),
          );
          if (templateItem && templateItem.requiredQuantity > 0) {
            const { error: updateError } = await this.supabase
              .from('inventory_items')
              .update({ required_quantity: templateItem.requiredQuantity })
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

    // Premium check for OSHA kit designation
    const isBecomingOshaKit =
      updates.isOshaKit === true && !currentKit.is_osha_kit;
    const isChangingOshaType =
      updates.isOshaKit !== false &&
      (updates.oshaKitType !== undefined ||
        updates.isOshaKit === true ||
        currentKit.is_osha_kit);

    if (isBecomingOshaKit || isChangingOshaType) {
      const isPremium = await this.usersService.isPremiumUser(userId);
      if (!isPremium) {
        throw new ForbiddenException({
          code: 'PREMIUM_REQUIRED',
          message:
            'OSHA compliance features require a premium subscription. Upgrade to premium to designate kits as OSHA-compliant.',
        });
      }
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.locationId !== undefined)
      updateData.location_id = updates.locationId;
    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    // Handle OSHA fields
    if (updates.isOshaKit !== undefined) {
      updateData.is_osha_kit = updates.isOshaKit;
      // If disabling OSHA, clear related fields
      if (!updates.isOshaKit) {
        updateData.osha_kit_type = null;
        updateData.osha_rule_id = null;
        updateData.compliance_status = 'not_checked';
        updateData.compliance_score = null;
        updateData.last_compliance_check_at = null;
        updateData.compliance_metadata = null;
      }
    }
    if (updates.oshaKitType !== undefined) {
      updateData.osha_kit_type = updates.oshaKitType;
    }
    if (updates.oshaRuleId !== undefined) {
      updateData.osha_rule_id = updates.oshaRuleId;
    }

    if (
      updates.kitTemplateId !== undefined ||
      updates.kitTemplateName !== undefined
    ) {
      updateData.metadata = {
        ...(currentKit.metadata || {}),
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
        'id, name, location_id, status, notes, metadata, created_at, updated_at, is_osha_kit, osha_kit_type, osha_rule_id, compliance_status, compliance_score, last_compliance_check_at, compliance_metadata, locations(name)',
      )
      .single();

    if (updateError) {
      throw new Error(`Failed to update user kit: ${updateError.message}`);
    }

    // If OSHA kit designation changed or type changed, recalculate compliance
    const oshaStatusChanged =
      updates.isOshaKit !== undefined &&
      updates.isOshaKit !== currentKit.is_osha_kit;
    const oshaTypeChanged =
      updates.oshaKitType !== undefined &&
      updates.oshaKitType !== currentKit.osha_kit_type;

    if (
      (oshaStatusChanged && updates.isOshaKit) ||
      (oshaTypeChanged && (updatedKit.is_osha_kit || updates.isOshaKit))
    ) {
      const oshaKitType =
        updates.oshaKitType ||
        updatedKit.osha_kit_type ||
        currentKit.osha_kit_type;
      if (oshaKitType) {
        try {
          await this.recalculateCompliance(userId, kitId, oshaKitType);
          // Reload kit to get updated compliance data
          const { data: reloadedKit } = await this.supabase
            .from('kits')
            .select(
              'id, name, location_id, status, notes, metadata, created_at, updated_at, is_osha_kit, osha_kit_type, osha_rule_id, compliance_status, compliance_score, last_compliance_check_at, compliance_metadata, locations(name)',
            )
            .eq('id', kitId)
            .single();
          if (reloadedKit) {
            updatedKit.compliance_status = reloadedKit.compliance_status;
            updatedKit.compliance_score = reloadedKit.compliance_score;
            updatedKit.last_compliance_check_at =
              reloadedKit.last_compliance_check_at;
            updatedKit.compliance_metadata = reloadedKit.compliance_metadata;
          }
        } catch (error) {
          this.logger.warn(
            `Failed to calculate compliance for updated OSHA kit ${kitId}: ${error}`,
          );
          // Don't fail kit update if compliance check fails
        }
      }
    }

    // If location or name changed, update associated inventory items
    const locationChanged =
      updates.locationId !== undefined &&
      updates.locationId !== currentKit.location_id;
    const nameChanged =
      updates.name !== undefined && updates.name !== currentKit.name;
    const locationNameChanged =
      updates.locationName !== undefined &&
      updates.locationName !== currentKit.location_name;

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

    return rowToUserKit({
      ...updatedKit,
      user_id: userId,
      kit_template_id: updatedKit.metadata?.kit_template_id,
      kit_template_name: updatedKit.metadata?.kit_template_name,
      location_name: Array.isArray(updatedKit.locations)
        ? updatedKit.locations[0]?.name
        : (updatedKit.locations as any)?.name,
    });
  }

  /**
   * Recalculate compliance status for an OSHA kit
   * Called automatically when kit items change or on-demand
   */
  async recalculateCompliance(
    userId: string,
    kitId: string,
    oshaKitType?: string,
  ): Promise<void> {
    // Get kit to check if it's an OSHA kit
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);
    const { data: kit, error: kitError } = await this.supabase
      .from('kits')
      .select('id, is_osha_kit, osha_kit_type, osha_rule_id')
      .eq('id', kitId)
      .eq('tenant_id', tenant.id)
      .single();

    if (kitError || !kit) {
      this.logger.warn(`Kit ${kitId} not found for compliance recalculation`);
      return;
    }

    if (!kit.is_osha_kit) {
      // Not an OSHA kit, nothing to do
      return;
    }

    const kitType = oshaKitType || kit.osha_kit_type;
    if (!kitType) {
      this.logger.warn(
        `Cannot recalculate compliance for kit ${kitId}: no OSHA kit type specified`,
      );
      return;
    }

    try {
      // Use ComplianceService to check compliance and update kit record
      await this.complianceService.checkComplianceAndUpdateKit(
        userId,
        kitId,
        kit.osha_rule_id || undefined,
        kitType,
      );
    } catch (error) {
      this.logger.error(
        `Failed to recalculate compliance for kit ${kitId}: ${error}`,
      );
      throw error;
    }
  }

  async deleteUserKit(
    userId: string,
    kitId: string,
    options?: { keepItems?: boolean },
  ): Promise<void> {
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

    if (options?.keepItems) {
      // Detach items from kit instead of deleting them
      const { error: detachError } = await this.supabase
        .from('inventory_items')
        .update({
          kit_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('kit_id', kitId)
        .eq('tenant_id', tenant.id);

      if (detachError) {
        this.logger.error(
          `Failed to detach inventory items for kit ${kitId}: ${detachError.message}`,
        );
        throw new Error(`Failed to detach kit items: ${detachError.message}`);
      }

      this.logger.log(`Detached inventory items for kit ${kitId}`);
    } else {
      // Delete all inventory items associated with this kit
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
    }

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
  ): Promise<InventoryItem[]> {
    // Get user's tenant for scoping
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);

    // Get all inventory items for this kit (both requirements and actual items)
    const { data: items, error: itemsError } = await this.supabase
      .from('inventory_items')
      .select('*')
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
          .select('*')
          .eq('kit_id', userKitId.trim());

        if (result.error) {
          this.logger.error(
            `Error fetching shared kit items: ${result.error.message}`,
          );
          return [];
        }

        // Convert rows to InventoryItem - columns are already populated by database
        return (result.data || []).map((item: any) =>
          rowToInventoryItemForKit(item),
        );
      }
    }

    if (itemsError) {
      this.logger.error(`Error fetching kit items: ${itemsError.message}`);
      return [];
    }

    // Convert rows to InventoryItem - columns are already populated by database
    return (items || []).map((item: any) => rowToInventoryItemForKit(item));
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
    const access = await this.getKitIdAndTenantIdIfAccessible(
      userId,
      userKitId,
      true,
    );
    if (!access) {
      throw new NotFoundException('Kit not found');
    }
    const { tenantId } = access;

    // Get kit to get location_id and name
    const { data: kit, error: kitError } = await this.supabase
      .from('kits')
      .select('id, location_id, tenant_id, name')
      .eq('id', userKitId)
      .single();

    if (kitError || !kit) {
      throw new NotFoundException('Kit not found');
    }

    // Check if any inventory item already exists for this kit and supply (use kit's tenant)
    let existingItem: any = null;
    if (itemData.supplyId && itemData.supplyId.trim() !== '') {
      const { data: existing } = await this.supabase
        .from('inventory_items')
        .select('id, required_quantity, actual_quantity')
        .eq('kit_id', userKitId)
        .eq('tenant_id', tenantId)
        .eq('supply_id', itemData.supplyId)
        .maybeSingle();
      existingItem = existing;
    } else {
      const { data: existing } = await this.supabase
        .from('inventory_items')
        .select('id, required_quantity, actual_quantity')
        .eq('kit_id', userKitId)
        .eq('tenant_id', tenantId)
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
          .select('id, actual_quantity, required_quantity')
          .eq('kit_id', userKitId)
          .eq('supply_id', itemData.supplyId)
          .maybeSingle();
        existingInventoryItem = existing;
      } else {
        // For items without supplyId, check by freeform_name and kit_id
        // Note: unique constraint doesn't apply when supply_id is NULL
        const { data: existing } = await this.supabase
          .from('inventory_items')
          .select('id, actual_quantity, required_quantity')
          .eq('kit_id', userKitId)
          .eq('freeform_name', itemData.supplyName)
          .is('supply_id', null)
          .maybeSingle();
        existingInventoryItem = existing;
      }

      if (existingInventoryItem) {
        // Use existing inventory item
        inventoryItemId = existingInventoryItem.id;

        // Get actual quantity directly from item (no lots aggregation needed)
        const { data: invItem } = await this.supabase
          .from('inventory_items')
          .select('actual_quantity, required_quantity')
          .eq('id', existingInventoryItem.id)
          .single();

        // Read actual_quantity from database column
        actualQty = invItem?.actual_quantity ?? 0;

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
              actualQuantity: itemData.requiredQuantity || 0,
              requiredQuantity: itemData.requiredQuantity,
              status: 'missing', // Will be calculated based on quantities
              notes: itemData.notes,
              kitId: userKitId,
              expirationDate: (itemData as any).expirationDate
                ? new Date((itemData as any).expirationDate)
                : undefined,
            } as any,
            { tenantIdOverride: tenantId },
          );
          inventoryItemId = inventoryItem.id;
          actualQty =
            inventoryItem.actualQuantity || itemData.requiredQuantity || 0;
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
          .select('actual_quantity, required_quantity')
          .eq('id', itemData.inventoryItemId)
          .single();

        // Read actual quantity directly from database column
        actualQty = invItem?.actual_quantity ?? 0;

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
      // Update requirement and set required_quantity
      // Also update matching actual items' required_quantity (trigger will do this, but set explicitly)
      const updateData: any = {
        required_quantity: requiredQty, // Set required_quantity column
        actual_quantity: 0, // Requirements have 0 actual quantity
        supply_name: itemData.supplyName,
        freeform_name: itemData.supplyId ? null : itemData.supplyName,
        notes: itemData.notes,
        status: status,
        updated_at: now.toISOString(),
      };

      await this.supabase
        .from('inventory_items')
        .update(updateData)
        .eq('id', existingItem.id);

      // Update matching actual items' required_quantity
      await this.supabase
        .from('inventory_items')
        .update({ required_quantity: requiredQty })
        .eq('kit_id', userKitId)
        .eq('tenant_id', tenantId)
        .or(
          itemData.supplyId
            ? `supply_id.eq.${itemData.supplyId}`
            : `freeform_name.eq.${itemData.supplyName}`,
        );

      // Fetch updated item
      const { data: updated, error: updateError } = await this.supabase
        .from('inventory_items')
        .select('*')
        .eq('id', existingItem.id)
        .single();

      if (updateError) {
        throw new Error(`Failed to update kit item: ${updateError.message}`);
      }
      kitItemId = updated.id;

      // Read actual quantity directly from database column
      actualQty = updated.actual_quantity ?? 0;
    } else {
      // Create new requirement
      // Note: If an inventory item already exists (from createInventoryItem above),
      // we should update it to also be a requirement, not create a duplicate
      if (inventoryItemId) {
        // Update the existing inventory item to also serve as the requirement
        const { data: updated, error: updateError } = await this.supabase
          .from('inventory_items')
          .update({
            required_quantity: requiredQty, // Set required_quantity column
            actual_quantity: 0, // Requirements have 0 actual quantity
            supply_name: itemData.supplyName,
            freeform_name: itemData.supplyId ? null : itemData.supplyName,
            notes: itemData.notes,
            status: status,
            updated_at: now.toISOString(),
          })
          .eq('id', inventoryItemId)
          .select('*')
          .single();

        if (updateError) {
          throw new Error(`Failed to update kit item: ${updateError.message}`);
        }
        kitItemId = updated.id;

        // Read actual quantity directly from database column
        actualQty = updated.actual_quantity ?? 0;
      } else {
        // Create new requirement (no inventory item exists)
        const { data: newItem, error: createError } = await this.supabase
          .from('inventory_items')
          .insert({
            tenant_id: tenantId,
            kit_id: userKitId,
            supply_id: itemData.supplyId || null,
            freeform_name: itemData.supplyId ? null : itemData.supplyName,
            supply_name: itemData.supplyName,
            location_id: kit.location_id,
            required_quantity: requiredQty, // Set required_quantity column
            actual_quantity: 0, // Requirements have 0 actual quantity
            status: status,
            notes: itemData.notes,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .select('*')
          .single();

        if (createError) {
          throw new Error(`Failed to create kit item: ${createError.message}`);
        }
        kitItemId = newItem.id;

        // Read actual quantity directly from database column (0 for requirements)
        actualQty = newItem.actual_quantity ?? 0;
      }
    }

    // Fetch the final item to return
    const { data: finalItem } = await this.supabase
      .from('inventory_items')
      .select('*')
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
      .not('required_quantity', 'is', null)
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
            actualQuantity: itemData.requiredQuantity || 0,
            requiredQuantity: itemData.requiredQuantity,
            // Status will be calculated automatically based on quantities
            notes: itemData.notes,
            containerId: containerId,
            expirationDate: (itemData as any).expirationDate
              ? new Date((itemData as any).expirationDate)
              : undefined,
          } as any,
        );
        inventoryItemId = inventoryItem.id;
        actualQty =
          inventoryItem.actualQuantity || itemData.requiredQuantity || 0;
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
          .select('actual_quantity, required_quantity')
          .eq('id', itemData.inventoryItemId)
          .single();

        // Read actual quantity directly from database column
        actualQty = invItem?.actual_quantity ?? 0;

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
          required_quantity: requiredQty,
          actual_quantity: 0, // Requirements have 0 actual quantity
          supply_name: itemData.supplyName,
          freeform_name: itemData.supplyId ? null : itemData.supplyName,
          notes: itemData.notes,
          status: status,
          updated_at: now.toISOString(),
        })
        .eq('id', existingItem.id)
        .select('*')
        .single();

      if (updateError) {
        throw new Error(`Failed to update kit item: ${updateError.message}`);
      }
      kitItemId = updated.id;

      // Read actual quantity directly from database column
      actualQty = updated.actual_quantity ?? 0;
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
          required_quantity: requiredQty,
          actual_quantity: 0, // Requirements have 0 actual quantity
          status: status,
          notes: itemData.notes,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select('*')
        .single();

      if (createError) {
        throw new Error(`Failed to create kit item: ${createError.message}`);
      }
      kitItemId = newItem.id;

      // Recalculate actual quantity
      // Read actual quantity directly from database column (0 for requirements)
      actualQty = newItem.actual_quantity ?? 0;
    }

    // Fetch the final item to return
    const { data: finalItem } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('id', kitItemId)
      .single();

    if (!finalItem) {
      throw new Error('Failed to fetch created kit item');
    }

    return rowToKitItem(finalItem, actualQty);
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
    const access = await this.getKitIdAndTenantIdIfAccessible(
      userId,
      userKitId,
      true,
    );
    if (!access) {
      throw new NotFoundException('Kit not found');
    }
    const { tenantId } = access;

    // Get current item (scoped to kit's tenant so shared editors can update)
    const { data: currentItem, error: itemError } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('id', itemId)
      .eq('kit_id', userKitId)
      .eq('tenant_id', tenantId)
      .single();

    if (itemError || !currentItem) {
      throw new NotFoundException('Kit item instance not found');
    }

    // Read current actual quantity directly from database column
    const currentActualQty = currentItem.actual_quantity ?? 0;

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
      actual_quantity: actualQuantity,
      required_quantity: requiredQuantity ?? currentItem.required_quantity,
      status: status, // Use calculated status directly (complete, partial, or missing)
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
      .eq('kit_id', userKitId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(`Failed to update kit item: ${updateError.message}`);
    }

    // Read actual quantity directly from database column
    const actualQty = updatedItem.actual_quantity ?? 0;
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

    const accessSource = await this.getKitIdAndTenantIdIfAccessible(
      userId,
      sourceKitId,
      true,
    );
    const accessTarget = await this.getKitIdAndTenantIdIfAccessible(
      userId,
      targetKitId,
      true,
    );
    if (!accessSource) {
      throw new NotFoundException('Source kit not found');
    }
    if (!accessTarget) {
      throw new NotFoundException('Target kit not found');
    }

    const { data: sourceKit, error: sourceError } = await this.supabase
      .from('kits')
      .select('id, location_id, name')
      .eq('id', sourceKitId)
      .single();

    if (sourceError || !sourceKit) {
      throw new NotFoundException('Source kit not found');
    }

    const { data: targetKit, error: targetError } = await this.supabase
      .from('kits')
      .select('id, location_id, name')
      .eq('id', targetKitId)
      .single();

    if (targetError || !targetKit) {
      throw new NotFoundException('Target kit not found');
    }

    // Get the item from source kit (use source tenant)
    const { data: sourceItem, error: itemError } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('id', itemId)
      .eq('kit_id', sourceKitId)
      .eq('tenant_id', accessSource.tenantId)
      .single();

    if (itemError || !sourceItem) {
      throw new NotFoundException('Kit item instance not found');
    }

    // Read actual quantity directly from database column
    const actualQty = sourceItem.actual_quantity ?? 0;
    const itemData = rowToKitItem(sourceItem, actualQty);
    const now = new Date();

    // If this item has actual quantity (actual item), update via InventoryService only when caller is owner (same tenant)
    const userTenant = await this.tenantsService.getUserDefaultTenant(userId);
    if (
      (sourceItem.actual_quantity ?? 0) > 0 &&
      accessSource.tenantId === userTenant.id
    ) {
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

    // Update kit_id, location_id, and tenant_id (so item belongs to target kit's tenant)
    const { data: updatedItem, error: updateError } = await this.supabase
      .from('inventory_items')
      .update({
        kit_id: targetKitId,
        location_id: targetKit.location_id,
        tenant_id: accessTarget.tenantId,
        updated_at: now.toISOString(),
      })
      .eq('id', itemId)
      .eq('kit_id', sourceKitId)
      .eq('tenant_id', accessSource.tenantId)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(
        `Failed to move item to target kit: ${updateError.message}`,
      );
    }

    // Read actual quantity directly from database column
    const finalActualQty = updatedItem.actual_quantity ?? 0;
    return rowToKitItem(updatedItem, finalActualQty);
  }

  async deleteKitItemInstance(
    userId: string,
    userKitId: string,
    itemId: string,
  ): Promise<void> {
    const access = await this.getKitIdAndTenantIdIfAccessible(
      userId,
      userKitId,
      true,
    );
    if (!access) {
      throw new NotFoundException('Kit not found');
    }
    const { tenantId } = access;

    // Verify item exists
    const { data: item, error: itemError } = await this.supabase
      .from('inventory_items')
      .select('id, actual_quantity, required_quantity')
      .eq('id', itemId)
      .eq('kit_id', userKitId)
      .eq('tenant_id', tenantId)
      .single();

    if (itemError || !item) {
      throw new NotFoundException('Kit item instance not found');
    }

    // Actual items (have actual_quantity > 0) may want remove-from-kit instead of delete
    if ((item.actual_quantity ?? 0) > 0) {
      // For actual items, we might want to just remove from kit (set kit_id to null)
      // instead of deleting. But for now, we'll delete if explicitly requested.
      this.logger.warn(
        `Deleting actual inventory item ${itemId} from kit ${userKitId}. Consider removing from kit instead.`,
      );
    }

    const { error: deleteError } = await this.supabase
      .from('inventory_items')
      .delete()
      .eq('id', itemId)
      .eq('kit_id', userKitId)
      .eq('tenant_id', tenantId);

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

    // Get all kit items with required_quantity set (requirements / placeholders)
    const { data: items, error: itemsError } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('kit_id', userKitId)
      .eq('tenant_id', tenant.id)
      .not('required_quantity', 'is', null);

    if (itemsError) {
      throw new Error(`Failed to fetch kit items: ${itemsError.message}`);
    }

    if (!items || items.length === 0) {
      return { updated: 0, failed: 0 };
    }

    let updated = 0;
    let failed = 0;
    const now = new Date();

    // Set each item's actual_quantity to its required_quantity (mark kit as fully stocked)
    for (const item of items) {
      const requiredQuantity =
        item.required_quantity ?? item.actual_quantity ?? 0;

      const { error: updateError } = await this.supabase
        .from('inventory_items')
        .update({
          actual_quantity: requiredQuantity,
          status: 'complete',
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

    return { updated, failed };
  }
}
