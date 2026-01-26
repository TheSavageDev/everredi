import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';
import { PublicTemplatesService } from './public-templates.service';

export interface KitTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  purpose: string;
  groupSize: number;
  environment?: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  isPublic: boolean;
  isAiGenerated: boolean;
  aiPrompt?: string;
  requiresPremium?: boolean;
  defaultPeopleCount?: number; // Default: 1
  peopleCountOptions?: number[]; // e.g., [2, 4, 8] - additional options beyond default
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to convert PostgreSQL row to KitTemplate
function rowToKitTemplate(row: any): KitTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    purpose: row.purpose,
    groupSize: row.group_size,
    environment: row.environment,
    skillLevel: row.skill_level,
    isPublic: row.is_public,
    isAiGenerated: row.is_ai_generated,
    aiPrompt: row.ai_prompt,
    requiresPremium: row.requires_premium || false,
    defaultPeopleCount: row.default_people_count,
    peopleCountOptions: row.people_count_options,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class KitTemplatesService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly publicTemplatesService: PublicTemplatesService,
  ) {}

  async getKitTemplates(userId: string): Promise<KitTemplate[]> {
    const { data, error } = await this.supabase
      .from('kit_templates')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get kit templates: ${error.message}`);
    }

    return (data || []).map(rowToKitTemplate);
  }

  async getKitTemplate(
    userId: string,
    templateId: string,
  ): Promise<KitTemplate> {
    const { data, error } = await this.supabase
      .from('kit_templates')
      .select('*')
      .eq('id', templateId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Kit template not found');
    }

    return rowToKitTemplate(data);
  }

  async createKitTemplate(
    userId: string,
    templateData: Omit<
      KitTemplate,
      'id' | 'userId' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<KitTemplate> {
    const now = new Date();
    const { data, error } = await this.supabase
      .from('kit_templates')
      .insert({
        user_id: userId,
        name: templateData.name,
        description: templateData.description,
        purpose: templateData.purpose,
        group_size: templateData.groupSize,
        environment: templateData.environment,
        skill_level: templateData.skillLevel,
        is_public: templateData.isPublic,
        is_ai_generated: templateData.isAiGenerated,
        ai_prompt: templateData.aiPrompt,
        requires_premium: templateData.requiresPremium || false,
        default_people_count: templateData.defaultPeopleCount ?? 1,
        people_count_options: templateData.peopleCountOptions,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create kit template: ${error.message}`);
    }

    const template = rowToKitTemplate(data);

    // If template is created as public, sync to public collection
    if (templateData.isPublic) {
      await this.publicTemplatesService.createPublicTemplate({
        name: template.name,
        description: template.description,
        purpose: template.purpose,
        groupSize: template.groupSize,
        environment: template.environment,
        skillLevel: template.skillLevel,
        defaultPeopleCount: template.defaultPeopleCount ?? 1,
        peopleCountOptions: template.peopleCountOptions,
        createdBy: userId,
        publicTemplateId: `${userId}/${template.id}`,
      });
    }

    return template;
  }

  async updateKitTemplate(
    userId: string,
    templateId: string,
    updates: Partial<KitTemplate>,
  ): Promise<KitTemplate> {
    // Get existing template
    const { data: existingData, error: fetchError } = await this.supabase
      .from('kit_templates')
      .select('*')
      .eq('id', templateId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingData) {
      throw new NotFoundException('Kit template not found');
    }

    const existingTemplate = rowToKitTemplate(existingData);
    const wasPublic = existingTemplate.isPublic;
    const isNowPublic = updates.isPublic === true;

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.purpose !== undefined) updateData.purpose = updates.purpose;
    if (updates.groupSize !== undefined) updateData.group_size = updates.groupSize;
    if (updates.environment !== undefined) updateData.environment = updates.environment;
    if (updates.skillLevel !== undefined) updateData.skill_level = updates.skillLevel;
    if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
    if (updates.isAiGenerated !== undefined) updateData.is_ai_generated = updates.isAiGenerated;
    if (updates.aiPrompt !== undefined) updateData.ai_prompt = updates.aiPrompt;
    if (updates.requiresPremium !== undefined) updateData.requires_premium = updates.requiresPremium;
    if (updates.defaultPeopleCount !== undefined) updateData.default_people_count = updates.defaultPeopleCount;
    if (updates.peopleCountOptions !== undefined) updateData.people_count_options = updates.peopleCountOptions;

    // Update the user template
    const { data: updatedTemplate, error: updateError } = await this.supabase
      .from('kit_templates')
      .update(updateData)
      .eq('id', templateId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update kit template: ${updateError.message}`);
    }

    const template = rowToKitTemplate(updatedTemplate);

    // Sync to public templates if isPublic changed
    if (isNowPublic && !wasPublic) {
      // Template is being made public
      const existingPublicTemplate =
        await this.publicTemplatesService.findPublicTemplateByUserTemplateId(
          userId,
          templateId,
        );

      if (existingPublicTemplate) {
        await this.publicTemplatesService.updatePublicTemplate(
          existingPublicTemplate.id,
          {
            name: template.name,
            description: template.description,
            purpose: template.purpose,
            groupSize: template.groupSize,
            environment: template.environment,
            skillLevel: template.skillLevel,
            defaultPeopleCount: template.defaultPeopleCount ?? 1,
            peopleCountOptions: template.peopleCountOptions,
          },
        );
      } else {
        await this.publicTemplatesService.createPublicTemplate({
          name: template.name,
          description: template.description,
          purpose: template.purpose,
          groupSize: template.groupSize,
          environment: template.environment,
          skillLevel: template.skillLevel,
          defaultPeopleCount: template.defaultPeopleCount ?? 1,
          peopleCountOptions: template.peopleCountOptions,
          createdBy: userId,
          publicTemplateId: `${userId}/${templateId}`,
        });
      }
    } else if (!isNowPublic && wasPublic) {
      // Template is being made private
      const existingPublicTemplate =
        await this.publicTemplatesService.findPublicTemplateByUserTemplateId(
          userId,
          templateId,
        );

      if (existingPublicTemplate) {
        await this.publicTemplatesService.deletePublicTemplate(
          existingPublicTemplate.id,
        );
      }
    } else if (isNowPublic && wasPublic) {
      // Template is already public and being updated
      const existingPublicTemplate =
        await this.publicTemplatesService.findPublicTemplateByUserTemplateId(
          userId,
          templateId,
        );

      if (existingPublicTemplate) {
        await this.publicTemplatesService.updatePublicTemplate(
          existingPublicTemplate.id,
          {
            name: template.name,
            description: template.description,
            purpose: template.purpose,
            groupSize: template.groupSize,
            environment: template.environment,
            skillLevel: template.skillLevel,
            defaultPeopleCount: template.defaultPeopleCount ?? 1,
            peopleCountOptions: template.peopleCountOptions,
          },
        );
      }
    }

    return template;
  }

  async deleteKitTemplate(userId: string, templateId: string): Promise<void> {
    const { error } = await this.supabase
      .from('kit_templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', userId);

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Kit template not found');
      }
      throw new Error(`Failed to delete kit template: ${error.message}`);
    }
  }

  /**
   * Calculate item quantity based on people count
   */
  private calculateItemQuantity(
    item: {
      requiredQuantity: number;
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

    // If item scales with people, multiply base requiredQuantity
    if (item.scalesWithPeople === true) {
      const multiplier = selectedPeopleCount / defaultPeopleCount;
      return Math.ceil(item.requiredQuantity * multiplier);
    }

    // Otherwise, use base requiredQuantity unchanged
    return item.requiredQuantity;
  }

  async getTemplateItems(
    userId: string,
    templateId: string,
    selectedPeopleCount?: number,
  ): Promise<
    Array<{
      supplyId: string;
      supplyName?: string;
      requiredQuantity: number;
      notes?: string;
    }>
  > {
    // Get template
    const { data: template, error: templateError } = await this.supabase
      .from('kit_templates')
      .select('*')
      .eq('id', templateId)
      .eq('user_id', userId)
      .single();

    if (templateError || !template) {
      throw new NotFoundException('Kit template not found');
    }

    const templateData = rowToKitTemplate(template);
    const defaultPeopleCount = templateData.defaultPeopleCount ?? 1;
    const peopleCount = selectedPeopleCount ?? defaultPeopleCount;

    // Get template items
    const { data: items, error: itemsError } = await this.supabase
      .from('kit_template_items')
      .select('*')
      .eq('kit_template_id', templateId)
      .order('sort_order', { ascending: true });

    if (itemsError) {
      throw new Error(`Failed to get template items: ${itemsError.message}`);
    }

    return (items || []).map((item: any) => {
      // For old schema (kit_template_items), read from quantity column
      // For new schema (kit_template_revision_items), read from required_units column
      const baseQuantity = item.required_units ?? item.quantity ?? 0;
      const requiredQuantity = this.calculateItemQuantity(
        {
          requiredQuantity: baseQuantity,
          scalesWithPeople: item.scales_with_people,
          peopleCountQuantities: item.people_count_quantities,
        },
        peopleCount,
        defaultPeopleCount,
      );
      return {
        supplyId: item.supply_id,
        supplyName: item.supply_name,
        requiredQuantity,
        notes: item.notes,
      };
    });
  }
}
