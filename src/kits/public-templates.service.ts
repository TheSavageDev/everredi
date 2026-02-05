import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';
import { UsersService } from '../users/users.service';
import { getDefaultPeopleCountOptions } from './utils/people-count-options';

export interface PublicKitTemplate {
  id: string;
  name: string;
  description?: string;
  purpose: string;
  groupSize: number;
  environment?: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  isActive: boolean;
  requiresPremium?: boolean;
  createdBy?: string; // userId who created it, or 'system' for default templates
  publicTemplateId?: string; // Reference to user template if synced from user
  defaultPeopleCount?: number; // Default: 1
  peopleCountOptions?: number[]; // e.g., [2, 4, 8] - additional options beyond default
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to convert PostgreSQL row to PublicKitTemplate
function rowToPublicTemplate(row: any): PublicKitTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    purpose: row.purpose,
    groupSize: row.group_size,
    environment: row.environment,
    skillLevel: row.skill_level,
    isActive: row.is_active,
    requiresPremium: row.requires_premium || false,
    createdBy: row.created_by,
    publicTemplateId: row.public_template_id,
    defaultPeopleCount: row.default_people_count,
    peopleCountOptions: row.people_count_options,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class PublicTemplatesService {
  private readonly logger = new Logger(PublicTemplatesService.name);

  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly usersService: UsersService,
  ) {}

  async getPublicTemplates(
    purpose?: string,
    skillLevel?: string,
    userId?: string,
  ): Promise<PublicKitTemplate[]> {
    let query = this.supabase
      .from('kit_templates')
      .select('*')
      .eq('is_public', true)
      .eq('is_active', true);

    if (purpose) {
      query = query.eq('purpose', purpose);
    }

    if (skillLevel) {
      query = query.eq('skill_level', skillLevel);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to get public templates: ${error.message}`);
    }

    // Return all templates (including premium) - users can see them but can't use them without premium
    return (data || []).map(rowToPublicTemplate);
  }

  async getPublicTemplate(
    templateId: string,
    userId?: string,
  ): Promise<PublicKitTemplate> {
    const { data, error } = await this.supabase
      .from('kit_templates')
      .select('*')
      .eq('id', templateId)
      .eq('is_public', true)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new NotFoundException('Public kit template not found');
    }

    const template = rowToPublicTemplate(data);

    // Check premium requirement
    if (template.requiresPremium && userId) {
      const isPremium = await this.usersService.isPremiumUser(userId);
      if (!isPremium) {
        throw new ForbiddenException({
          code: 'PREMIUM_REQUIRED',
          message:
            'This template requires a premium subscription. Upgrade to premium to access OSHA-compliant kit templates.',
        });
      }
    }

    return template;
  }

  async createPublicTemplate(
    templateData: Omit<
      PublicKitTemplate,
      'id' | 'isActive' | 'createdAt' | 'updatedAt'
    > & { isActive?: boolean },
  ): Promise<PublicKitTemplate> {
    const now = new Date();
    const { data, error } = await this.supabase
      .from('kit_templates')
      .insert({
        user_id: null, // Public templates don't have a user_id
        name: templateData.name,
        description: templateData.description,
        purpose: templateData.purpose,
        group_size: templateData.groupSize,
        environment: templateData.environment,
        skill_level: templateData.skillLevel,
        is_public: true,
        is_active: templateData.isActive ?? true,
        requires_premium: templateData.requiresPremium || false,
        created_by: templateData.createdBy,
        public_template_id: templateData.publicTemplateId,
        default_people_count:
          templateData.defaultPeopleCount ?? templateData.groupSize,
        people_count_options:
          templateData.peopleCountOptions ??
          getDefaultPeopleCountOptions(templateData.groupSize),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create public template: ${error.message}`);
    }

    return rowToPublicTemplate(data);
  }

  async updatePublicTemplate(
    templateId: string,
    updates: Partial<PublicKitTemplate>,
  ): Promise<PublicKitTemplate> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.purpose !== undefined) updateData.purpose = updates.purpose;
    if (updates.groupSize !== undefined)
      updateData.group_size = updates.groupSize;
    if (updates.environment !== undefined)
      updateData.environment = updates.environment;
    if (updates.skillLevel !== undefined)
      updateData.skill_level = updates.skillLevel;
    if (updates.requiresPremium !== undefined)
      updateData.requires_premium = updates.requiresPremium;
    if (updates.defaultPeopleCount !== undefined)
      updateData.default_people_count = updates.defaultPeopleCount;
    if (updates.peopleCountOptions !== undefined)
      updateData.people_count_options = updates.peopleCountOptions;

    const { data, error } = await this.supabase
      .from('kit_templates')
      .update(updateData)
      .eq('id', templateId)
      .eq('is_public', true)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update public template: ${error.message}`);
    }

    return rowToPublicTemplate(data);
  }

  async deletePublicTemplate(templateId: string): Promise<void> {
    // Soft delete by setting isActive to false
    const { error } = await this.supabase
      .from('kit_templates')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('is_public', true);

    if (error) {
      throw new Error(`Failed to delete public template: ${error.message}`);
    }
  }

  async findPublicTemplateByUserTemplateId(
    userId: string,
    userTemplateId: string,
  ): Promise<PublicKitTemplate | null> {
    const { data, error } = await this.supabase
      .from('kit_templates')
      .select('*')
      .eq('public_template_id', `${userId}/${userTemplateId}`)
      .eq('is_active', true)
      .eq('is_public', true)
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return rowToPublicTemplate(data);
  }

  /**
   * Calculate item quantity based on people count
   */
  private calculateItemQuantity(
    item: {
      quantity: number;
      scalesWithPeople?: boolean;
      peopleCountQuantities?: Record<number, number>;
    },
    selectedPeopleCount: number,
    defaultPeopleCount: number,
  ): number {
    // If explicit quantity exists for this people count, use it
    if (
      item.peopleCountQuantities &&
      item.peopleCountQuantities[selectedPeopleCount] !== undefined
    ) {
      return item.peopleCountQuantities[selectedPeopleCount];
    }

    // If item scales with people, multiply base quantity
    if (item.scalesWithPeople === true) {
      const multiplier = selectedPeopleCount / defaultPeopleCount;
      return Math.ceil(item.quantity * multiplier);
    }

    // If selected people count differs from default, scale base quantity proportionally
    // (template quantities are stored for the default people count)
    if (selectedPeopleCount !== defaultPeopleCount) {
      const multiplier = selectedPeopleCount / defaultPeopleCount;
      return Math.ceil(item.quantity * multiplier);
    }

    // Otherwise, use base quantity unchanged
    return item.quantity;
  }

  async getPublicTemplateItems(
    templateId: string,
    selectedPeopleCount?: number,
    userId?: string,
  ): Promise<
    Array<{
      supplyId: string;
      supplyName?: string;
      quantity: number;
      notes?: string;
    }>
  > {
    // Get template
    const { data: template, error: templateError } = await this.supabase
      .from('kit_templates')
      .select('*')
      .eq('id', templateId)
      .eq('is_public', true)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      throw new NotFoundException('Public kit template not found');
    }

    // Check premium requirement
    if (template.requires_premium && userId) {
      const isPremium = await this.usersService.isPremiumUser(userId);
      if (!isPremium) {
        throw new ForbiddenException({
          code: 'PREMIUM_REQUIRED',
          message:
            'This template requires a premium subscription. Upgrade to premium to access OSHA-compliant kit templates.',
        });
      }
    }

    const templateData = rowToPublicTemplate(template);
    const defaultPeopleCount = templateData.defaultPeopleCount ?? 1;
    const peopleCount = selectedPeopleCount ?? defaultPeopleCount;

    // Get the latest revision for this template
    const { data: revision, error: revisionError } = await this.supabase
      .from('kit_template_revisions')
      .select('id')
      .eq('kit_template_id', templateId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    let items: any[] = [];

    if (revisionError || !revision) {
      // No revision found, fall back to kit_template_items table
      this.logger.log(
        `No revision found for template ${templateId}, falling back to kit_template_items`,
      );
      const { data: legacyItems, error: legacyError } = await this.supabase
        .from('kit_template_items')
        .select('*')
        .eq('kit_template_id', templateId)
        .order('sort_order', { ascending: true });

      if (legacyError) {
        this.logger.error(
          `Failed to get template items from kit_template_items: ${legacyError.message}`,
        );
        return [];
      }

      items = legacyItems || [];
    } else {
      // Get template items from the revision
      const { data: revisionItems, error: itemsError } = await this.supabase
        .from('kit_template_revision_items')
        .select('*')
        .eq('template_revision_id', revision.id)
        .order('sort_order', { ascending: true });

      if (itemsError) {
        throw new Error(`Failed to get template items: ${itemsError.message}`);
      }

      items = revisionItems || [];
    }

    // Get all supply IDs to fetch supply names (templates are catalog-based)
    const supplyIds = items
      .map((item: any) => item.supply_id ?? item.supplyId)
      .filter((id: string | null | undefined) => id != null) as string[];

    // Fetch supply names in batch
    const supplyNamesMap = new Map<string, string>();
    if (supplyIds.length > 0) {
      const { data: supplies, error: suppliesError } = await this.supabase
        .from('supplies')
        .select('id, name')
        .in('id', supplyIds);

      if (!suppliesError && supplies) {
        supplies.forEach((supply: any) => {
          supplyNamesMap.set(supply.id, supply.name);
        });
      }
    }

    return items.map((item: any) => {
      // Calculate quantity from required_units (revision) or quantity (legacy)
      const baseQuantity = item.required_units ?? item.quantity ?? 0;

      const quantity = this.calculateItemQuantity(
        {
          quantity: baseQuantity,
          scalesWithPeople: item.scales_with_people,
          peopleCountQuantities:
            item.people_count_units ?? item.people_count_quantities,
        },
        peopleCount,
        defaultPeopleCount,
      );

      // Templates are built from the supply catalog; supply_id is NOT NULL in kit_template_revision_items
      const supplyId = item.supply_id ?? item.supplyId ?? null;
      const supplyName = supplyId
        ? supplyNamesMap.get(supplyId) || item.supply_name || item.supplyName
        : (item.supply_name ?? item.supplyName);

      return {
        supplyId,
        supplyName,
        quantity, // This is the required quantity (may be 0 if template has 0, but usually should be > 0)
        notes: item.notes,
      };
    });
  }
}
