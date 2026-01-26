import { Injectable, Inject, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';
import { PublicTemplatesService } from './public-templates.service';
import { KitTemplatesService } from './kit-templates.service';
import { SuppliesService } from '../supplies/supplies.service';
import { SupplyCategoriesService } from '../supply-categories/supply-categories.service';
import type { SupplyCategory } from '../supply-categories/supply-categories.service';

interface DefaultTemplate {
  name: string;
  description: string;
  purpose: string;
  groupSize: number;
  environment?: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  items: Array<{
    supplyName: string;
    requiredQuantity: number;
    notes?: string;
  }>;
}

const SYSTEM_USER_ID = 'system';

@Injectable()
export class TemplateSeedService {
  private readonly logger = new Logger(TemplateSeedService.name);

  private readonly defaultTemplates: DefaultTemplate[] = [
    {
      name: 'Basic First Aid Kit',
      description:
        'A comprehensive first aid kit for general use at home, work, or on the go. Includes essential supplies for treating minor injuries and emergencies.',
      purpose: 'general',
      groupSize: 4,
      environment: 'indoor',
      skillLevel: 'beginner',
      items: [
        {
          supplyName: 'Adhesive Bandages - Assorted Sizes',
          requiredQuantity: 20,
        },
        { supplyName: 'Gauze Pads', requiredQuantity: 10 },
        { supplyName: 'Sterile Gauze Pads 4x4', requiredQuantity: 5 },
        { supplyName: 'Medical Tape', requiredQuantity: 1 },
        { supplyName: 'Antiseptic Wipes', requiredQuantity: 10 },
        { supplyName: 'Tweezers', requiredQuantity: 1 },
        { supplyName: 'Scissors', requiredQuantity: 1 },
        { supplyName: 'Disposable Gloves', requiredQuantity: 4 },
        { supplyName: 'Antibiotic Ointment', requiredQuantity: 1 },
        { supplyName: 'Pain Relievers', requiredQuantity: 1 },
      ],
    },
    {
      name: 'Hiking/Outdoor Kit',
      description:
        'Designed for outdoor adventures and hiking trips. Includes supplies for treating injuries in remote locations and handling outdoor-specific emergencies, including advanced trauma care.',
      purpose: 'hiking',
      groupSize: 6,
      environment: 'outdoor',
      skillLevel: 'intermediate',
      items: [
        { supplyName: 'Adhesive Bandages', requiredQuantity: 30 },
        { supplyName: 'Gauze Pads', requiredQuantity: 15 },
        { supplyName: 'Sterile Gauze Pads 4x4', requiredQuantity: 10 },
        { supplyName: 'Medical Tape', requiredQuantity: 2 },
        { supplyName: 'Antiseptic Wipes', requiredQuantity: 20 },
        { supplyName: 'Tweezers', requiredQuantity: 1 },
        { supplyName: 'Scissors', requiredQuantity: 1 },
        { supplyName: 'Disposable Gloves', requiredQuantity: 6 },
        { supplyName: 'Moleskin', requiredQuantity: 1, notes: 'For blisters' },
        { supplyName: 'Emergency Blanket', requiredQuantity: 1 },
        { supplyName: 'Tourniquet', requiredQuantity: 1 },
        { supplyName: 'QuikClot®', requiredQuantity: 1 },
        { supplyName: 'Israeli Bandage', requiredQuantity: 1 },
        { supplyName: 'Compressed Gauze', requiredQuantity: 2 },
        { supplyName: 'SAM Splint', requiredQuantity: 1 },
        { supplyName: 'Pain Relievers', requiredQuantity: 1 },
        { supplyName: 'Antihistamine', requiredQuantity: 1 },
      ],
    },
    {
      name: 'Car Emergency Kit',
      description:
        'Essential first aid supplies to keep in your vehicle. Perfect for roadside emergencies and travel-related injuries.',
      purpose: 'automotive',
      groupSize: 5,
      environment: 'outdoor',
      skillLevel: 'beginner',
      items: [
        { supplyName: 'Adhesive Bandages', requiredQuantity: 25 },
        { supplyName: 'Gauze Pads', requiredQuantity: 12 },
        { supplyName: 'Medical Tape', requiredQuantity: 1 },
        { supplyName: 'Antiseptic Wipes', requiredQuantity: 15 },
        { supplyName: 'Tweezers', requiredQuantity: 1 },
        { supplyName: 'Scissors', requiredQuantity: 1 },
        { supplyName: 'Disposable Gloves', requiredQuantity: 5 },
        { supplyName: 'Emergency Blanket', requiredQuantity: 1 },
        { supplyName: 'Flashlight', requiredQuantity: 1 },
        { supplyName: 'Pain Relievers', requiredQuantity: 1 },
      ],
    },
    {
      name: 'Home Emergency Kit',
      description:
        'Comprehensive first aid kit for your home. Includes supplies for common household injuries and emergencies for the whole family.',
      purpose: 'home',
      groupSize: 8,
      environment: 'indoor',
      skillLevel: 'beginner',
      items: [
        { supplyName: 'Adhesive Bandages', requiredQuantity: 50 },
        { supplyName: 'Gauze Pads', requiredQuantity: 20 },
        { supplyName: 'Medical Tape', requiredQuantity: 2 },
        { supplyName: 'Antiseptic Wipes', requiredQuantity: 25 },
        { supplyName: 'Tweezers', requiredQuantity: 1 },
        { supplyName: 'Scissors', requiredQuantity: 1 },
        { supplyName: 'Disposable Gloves', requiredQuantity: 10 },
        { supplyName: 'Thermometer', requiredQuantity: 1 },
        { supplyName: 'Pain Relievers', requiredQuantity: 1 },
        { supplyName: 'Antihistamine', requiredQuantity: 1 },
        { supplyName: 'Hydrogen Peroxide', requiredQuantity: 1 },
      ],
    },
    {
      name: 'Workplace First Aid Kit',
      description:
        'OSHA-compliant first aid kit designed for workplaces. Suitable for offices, warehouses, and other work environments. Includes comprehensive supplies for workplace injuries.',
      purpose: 'workplace',
      groupSize: 20,
      environment: 'indoor',
      skillLevel: 'beginner',
      items: [
        {
          supplyName: 'Adhesive Bandages - Assorted Sizes',
          requiredQuantity: 100,
        },
        { supplyName: 'Gauze Pads', requiredQuantity: 40 },
        { supplyName: 'Sterile Gauze Pads 4x4', requiredQuantity: 20 },
        { supplyName: 'Medical Tape', requiredQuantity: 4 },
        { supplyName: 'Antiseptic Wipes', requiredQuantity: 50 },
        { supplyName: 'Tweezers', requiredQuantity: 2 },
        { supplyName: 'Scissors', requiredQuantity: 2 },
        { supplyName: 'Disposable Gloves', requiredQuantity: 20 },
        { supplyName: 'Eye Wash Solution', requiredQuantity: 1 },
        { supplyName: 'Burn Gel', requiredQuantity: 1 },
        { supplyName: 'Antibiotic Ointment', requiredQuantity: 2 },
        { supplyName: 'Pain Relievers', requiredQuantity: 1 },
        { supplyName: 'CPR Face Shield', requiredQuantity: 1 },
        { supplyName: 'Triangular Bandage', requiredQuantity: 2 },
      ],
    },
    {
      name: 'Sports/Activity Kit',
      description:
        'Specialized first aid kit for sports activities, team events, and athletic competitions. Includes supplies for common sports injuries and athletic training needs.',
      purpose: 'sports',
      groupSize: 10,
      environment: 'outdoor',
      skillLevel: 'intermediate',
      items: [
        { supplyName: 'Adhesive Bandages', requiredQuantity: 40 },
        { supplyName: 'Gauze Pads', requiredQuantity: 20 },
        { supplyName: 'Medical Tape', requiredQuantity: 3 },
        { supplyName: 'Antiseptic Wipes', requiredQuantity: 30 },
        { supplyName: 'Tweezers', requiredQuantity: 1 },
        { supplyName: 'Scissors', requiredQuantity: 1 },
        { supplyName: 'Disposable Gloves', requiredQuantity: 10 },
        { supplyName: 'Ice Pack', requiredQuantity: 2 },
        { supplyName: 'Elastic Bandage', requiredQuantity: 2 },
        { supplyName: 'Athletic Tape', requiredQuantity: 2 },
        { supplyName: 'Pre-wrap', requiredQuantity: 2 },
        { supplyName: 'Kinesiology Tape', requiredQuantity: 1 },
        { supplyName: 'Compression Bandage', requiredQuantity: 2 },
        { supplyName: 'Biofreeze', requiredQuantity: 1 },
        { supplyName: 'Icy Hot', requiredQuantity: 1 },
        { supplyName: 'Pain Relievers', requiredQuantity: 1 },
        { supplyName: 'Antihistamine', requiredQuantity: 1 },
      ],
    },
    {
      name: 'Athletic Trainer Kit',
      description:
        'Comprehensive athletic training kit for sports medicine professionals. Includes specialized supplies for injury prevention, treatment, and rehabilitation for athletes and teams.',
      purpose: 'athletic-training',
      groupSize: 18,
      environment: 'outdoor',
      skillLevel: 'advanced',
      items: [
        { supplyName: 'Athletic Tape', requiredQuantity: 6 },
        { supplyName: 'Pre-wrap', requiredQuantity: 6 },
        { supplyName: 'Kinesiology Tape', requiredQuantity: 3 },
        { supplyName: 'Sports Tape', requiredQuantity: 2 },
        { supplyName: 'Foam Padding', requiredQuantity: 4 },
        { supplyName: 'Heel and Lace Pads', requiredQuantity: 2 },
        { supplyName: 'Athletic Trainer Scissors', requiredQuantity: 2 },
        { supplyName: 'Ankle Brace', requiredQuantity: 2 },
        { supplyName: 'Knee Brace', requiredQuantity: 2 },
        { supplyName: 'Wrist Brace', requiredQuantity: 2 },
        { supplyName: 'Elbow Brace', requiredQuantity: 1 },
        { supplyName: 'Shoulder Brace', requiredQuantity: 1 },
        { supplyName: 'Compression Sleeve', requiredQuantity: 3 },
        { supplyName: 'Biofreeze', requiredQuantity: 2 },
        { supplyName: 'Icy Hot', requiredQuantity: 2 },
        { supplyName: 'Tiger Balm', requiredQuantity: 1 },
        { supplyName: 'Instant Cold Pack', requiredQuantity: 6 },
        { supplyName: 'Compression Bandage', requiredQuantity: 4 },
        { supplyName: 'Elastic Bandage', requiredQuantity: 4 },
        { supplyName: 'Sterile Gauze Pads 4x4', requiredQuantity: 20 },
        { supplyName: 'Sterile Gauze Pads 2x2', requiredQuantity: 10 },
        { supplyName: 'Antiseptic Wipes', requiredQuantity: 40 },
        { supplyName: 'Disposable Gloves', requiredQuantity: 20 },
        { supplyName: 'Cohesive Bandage (Coban)', requiredQuantity: 4 },
        { supplyName: 'Pain Relievers', requiredQuantity: 1 },
      ],
    },
    {
      name: 'Advanced Medical/EMT Kit',
      description:
        'Professional-grade medical kit for EMTs, paramedics, and advanced medical responders. Includes advanced trauma care, airway management, monitoring equipment, and IV supplies.',
      purpose: 'advanced-medical',
      groupSize: 1,
      environment: 'any',
      skillLevel: 'advanced',
      items: [
        { supplyName: 'Tourniquet', requiredQuantity: 2 },
        { supplyName: 'CAT Tourniquet', requiredQuantity: 1 },
        { supplyName: 'Chest Seal', requiredQuantity: 2 },
        { supplyName: 'Hemostatic Gauze', requiredQuantity: 2 },
        { supplyName: 'QuikClot®', requiredQuantity: 2 },
        { supplyName: 'QuikClot® Combat Gauze LE', requiredQuantity: 1 },
        { supplyName: 'Israeli Bandage', requiredQuantity: 2 },
        { supplyName: 'Compressed Gauze', requiredQuantity: 4 },
        { supplyName: 'Abdominal Pad (ABD Pad)', requiredQuantity: 2 },
        { supplyName: 'Nasal Airway', requiredQuantity: 2 },
        { supplyName: 'Oral Airway', requiredQuantity: 2 },
        { supplyName: 'Bag Valve Mask', requiredQuantity: 1 },
        { supplyName: 'Stethoscope', requiredQuantity: 1 },
        { supplyName: 'Pulse Oximeter', requiredQuantity: 1 },
        { supplyName: 'Blood Pressure Cuff', requiredQuantity: 1 },
        { supplyName: 'Penlight', requiredQuantity: 1 },
        { supplyName: 'IV Catheter', requiredQuantity: 4 },
        { supplyName: 'IV Administration Set', requiredQuantity: 2 },
        { supplyName: 'Syringe', requiredQuantity: 6 },
        { supplyName: 'Needle', requiredQuantity: 6 },
        { supplyName: 'Alcohol Prep Pad', requiredQuantity: 20 },
        { supplyName: 'Hemostat Curved 5.5"', requiredQuantity: 1 },
        { supplyName: 'Hemostat Straight 5.5"', requiredQuantity: 1 },
        { supplyName: 'Surgical Scalpel Blade', requiredQuantity: 2 },
        { supplyName: 'Suture Removal Kit', requiredQuantity: 1 },
        { supplyName: 'Tongue Depressor', requiredQuantity: 10 },
        { supplyName: 'Cotton Swabs', requiredQuantity: 2 },
        { supplyName: 'Irrigation Syringe', requiredQuantity: 2 },
        { supplyName: 'XShear Trauma Shears', requiredQuantity: 1 },
        { supplyName: 'N95 Respirator', requiredQuantity: 5 },
        { supplyName: 'Gown', requiredQuantity: 2 },
        { supplyName: 'Disposable Gloves', requiredQuantity: 20 },
        { supplyName: 'Saline Solution', requiredQuantity: 2 },
        { supplyName: 'Povidone-Iodine Solution', requiredQuantity: 1 },
      ],
    },
    {
      name: 'Travel First Aid Kit',
      description:
        'Compact, portable first aid kit designed for travel. Includes essential supplies in travel-friendly quantities for treating minor injuries while on the go.',
      purpose: 'travel',
      groupSize: 3,
      environment: 'travel',
      skillLevel: 'beginner',
      items: [
        {
          supplyName: 'Adhesive Bandages - Assorted Sizes',
          requiredQuantity: 15,
        },
        { supplyName: 'Sterile Gauze Pads 4x4', requiredQuantity: 5 },
        { supplyName: 'Medical Tape', requiredQuantity: 1 },
        { supplyName: 'Antiseptic Wipes', requiredQuantity: 10 },
        { supplyName: 'Tweezers', requiredQuantity: 1 },
        { supplyName: 'Scissors', requiredQuantity: 1 },
        { supplyName: 'Disposable Gloves', requiredQuantity: 2 },
        { supplyName: 'Antibiotic Ointment', requiredQuantity: 1 },
        { supplyName: 'Pain Relievers', requiredQuantity: 1 },
        { supplyName: 'Antihistamine', requiredQuantity: 1 },
        { supplyName: 'First Aid Guide', requiredQuantity: 1 },
        { supplyName: 'Thermometer', requiredQuantity: 1 },
      ],
    },
  ];

  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly publicTemplatesService: PublicTemplatesService,
    private readonly kitTemplatesService: KitTemplatesService,
    private readonly suppliesService: SuppliesService,
    private readonly supplyCategoriesService: SupplyCategoriesService,
  ) {}

  async seedDefaultTemplates(
    force: boolean = false,
  ): Promise<{ created: number; skipped: number; updated: number }> {
    let created = 0;
    let skipped = 0;
    let updated = 0;

    this.logger.log('🌱 Starting to seed default kit templates...');

    // Ensure system user document exists
    const { data: systemUser } = await this.supabase
      .from('users')
      .select('id')
      .eq('id', SYSTEM_USER_ID)
      .single();

    if (!systemUser) {
      const now = new Date();
      const { error } = await this.supabase.from('users').insert({
        id: SYSTEM_USER_ID,
        email: 'system@everredi.app',
        display_name: 'System',
        subscription_tier: 'premium',
        subscription_status: 'active',
        is_active: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });

      if (error) {
        this.logger.warn(`Could not create system user: ${error.message}`);
      } else {
        this.logger.log('✅ Created system user document');
      }
    }

    for (const template of this.defaultTemplates) {
      try {
        // Check if template already exists by name
        const { data: existingTemplates } = await this.supabase
          .from('kit_templates')
          .select('*')
          .eq('name', template.name)
          .eq('is_public', true)
          .eq('is_active', true)
          .limit(1);

        if (existingTemplates && existingTemplates.length > 0) {
          const existingTemplate = existingTemplates[0];

          // If force is true, or template doesn't have items, update it
          if (force) {
            this.logger.log(`🔄 Force updating "${template.name}"...`);

            // Soft delete the existing template
            await this.supabase
              .from('kit_templates')
              .update({ is_active: false })
              .eq('id', existingTemplate.id);

            // Delete old revisions and their items (cascade will handle items)
            await this.supabase
              .from('kit_template_revisions')
              .delete()
              .eq('kit_template_id', existingTemplate.id);

            updated++;
          } else {
            // Verify items actually exist
            try {
              const items =
                await this.publicTemplatesService.getPublicTemplateItems(
                  existingTemplate.id,
                );
              if (items.length === 0) {
                this.logger.log(
                  `🔄 Updating "${template.name}" - exists but no items found`,
                );
                await this.supabase
                  .from('kit_templates')
                  .update({ is_active: false })
                  .eq('id', existingTemplate.id);
                updated++;
              } else {
                this.logger.log(
                  `⏭️  Skipping "${template.name}" - already exists with ${items.length} items`,
                );
                skipped++;
                continue;
              }
            } catch (error: any) {
              this.logger.log(
                `🔄 Updating "${template.name}" - error verifying items: ${error.message}`,
              );
              await this.supabase
                .from('kit_templates')
                .update({ is_active: false })
                .eq('id', existingTemplate.id);
              updated++;
            }
          }
        }

        // Create the public template first
        const publicTemplate =
          await this.publicTemplatesService.createPublicTemplate({
            defaultPeopleCount: 1,
            name: template.name,
            description: template.description,
            purpose: template.purpose,
            groupSize: template.groupSize,
            environment: template.environment,
            skillLevel: template.skillLevel,
            createdBy: 'system',
          });

        this.logger.log(`  Created public template ${publicTemplate.id}`);

        // Add items to the public template
        await this.addItemsToPublicTemplate(publicTemplate.id, template.items);

        // Verify items were saved
        const savedItems =
          await this.publicTemplatesService.getPublicTemplateItems(
            publicTemplate.id,
          );
        if (savedItems.length !== template.items.length) {
          this.logger.warn(
            `⚠️  Warning: Expected ${template.items.length} items but found ${savedItems.length} for template ${publicTemplate.id}`,
          );
        } else {
          this.logger.log(
            `  ✅ Service method confirms ${savedItems.length} items saved to template ${publicTemplate.id}`,
          );
        }

        this.logger.log(
          `✅ Created "${template.name}" with ${template.items.length} items (public template: ${publicTemplate.id})`,
        );
        created++;
      } catch (error: any) {
        this.logger.error(
          `❌ Failed to create "${template.name}":`,
          error.stack,
        );
      }
    }

    this.logger.log(
      `\n✨ Seeding complete! Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`,
    );

    return { created, skipped, updated };
  }

  private findCategoryForSupply(
    supplyName: string,
    categories: SupplyCategory[],
  ): { id: string; name: string } {
    const nameLower = supplyName.toLowerCase();

    // Create a map of category names to IDs
    const categoryMap = new Map<string, { id: string; name: string }>();
    categories.forEach((cat) =>
      categoryMap.set(cat.name.toLowerCase(), { id: cat.id, name: cat.name }),
    );

    // Keyword matching (order matters - more specific first)
    if (
      nameLower.includes('burn') ||
      nameLower.includes('gel') ||
      nameLower.includes('aloe')
    ) {
      return (
        categoryMap.get('burn care') || {
          id: categories[0].id,
          name: categories[0].name,
        }
      );
    }
    if (
      nameLower.includes('ice') ||
      nameLower.includes('cold') ||
      nameLower.includes('heat')
    ) {
      return (
        categoryMap.get('cold & heat therapy') || {
          id: categories[0].id,
          name: categories[0].name,
        }
      );
    }
    if (
      nameLower.includes('sanitizer') ||
      nameLower.includes('wipes') ||
      nameLower.includes('soap') ||
      nameLower.includes('eye wash')
    ) {
      return (
        categoryMap.get('hygiene & sanitation') || {
          id: categories[0].id,
          name: categories[0].name,
        }
      );
    }
    if (
      nameLower.includes('gloves') ||
      nameLower.includes('mask') ||
      nameLower.includes('goggles') ||
      nameLower.includes('shield') ||
      nameLower.includes('cpr')
    ) {
      return (
        categoryMap.get('personal protection') || {
          id: categories[0].id,
          name: categories[0].name,
        }
      );
    }
    if (
      nameLower.includes('emergency') ||
      nameLower.includes('blanket') ||
      nameLower.includes('tourniquet') ||
      nameLower.includes('splint')
    ) {
      return (
        categoryMap.get('emergency & trauma') || {
          id: categories[0].id,
          name: categories[0].name,
        }
      );
    }
    if (
      nameLower.includes('scissors') ||
      nameLower.includes('tweezers') ||
      nameLower.includes('thermometer') ||
      nameLower.includes('flashlight')
    ) {
      return (
        categoryMap.get('tools & instruments') || {
          id: categories[0].id,
          name: categories[0].name,
        }
      );
    }
    if (
      nameLower.includes('pain') ||
      nameLower.includes('reliever') ||
      nameLower.includes('medication') ||
      nameLower.includes('antihistamine') ||
      nameLower.includes('antiseptic') ||
      nameLower.includes('antibiotic') ||
      nameLower.includes('hydrogen') ||
      nameLower.includes('peroxide')
    ) {
      return (
        categoryMap.get('medications & ointments') || {
          id: categories[0].id,
          name: categories[0].name,
        }
      );
    }
    if (
      nameLower.includes('bandage') ||
      nameLower.includes('gauze') ||
      nameLower.includes('tape') ||
      nameLower.includes('dressing') ||
      nameLower.includes('moleskin') ||
      nameLower.includes('elastic')
    ) {
      return (
        categoryMap.get('bandages & wound care') || {
          id: categories[0].id,
          name: categories[0].name,
        }
      );
    }

    // Default fallback to first category
    return { id: categories[0].id, name: categories[0].name };
  }

  private async addItemsToPublicTemplate(
    publicTemplateId: string,
    items: Array<{
      supplyName: string;
      requiredQuantity: number;
      notes?: string;
    }>,
  ): Promise<void> {
    this.logger.log(
      `  Template document ${publicTemplateId} exists, adding ${items.length} items...`,
    );

    // Create a revision for this template (version 1)
    // Note: created_by is NULL for system templates since SYSTEM_USER_ID is a string, not a UUID
    const now = new Date();
    const { data: revision, error: revisionError } = await this.supabase
      .from('kit_template_revisions')
      .insert({
        kit_template_id: publicTemplateId,
        version: 1,
        created_by: null, // NULL for system-created templates
        created_at: now.toISOString(),
      })
      .select()
      .single();

    if (revisionError || !revision) {
      this.logger.error(
        `  ❌ Failed to create revision for template ${publicTemplateId}: ${revisionError?.message}`,
      );
      throw new Error(
        `Failed to create revision for template ${publicTemplateId}: ${revisionError?.message}`,
      );
    }

    this.logger.log(
      `  Created revision ${revision.id} (version 1) for template ${publicTemplateId}`,
    );

    // Get all supplies and categories
    // System user should see all supplies (premium access)
    const allSupplies = await this.suppliesService.getSupplies(
      SYSTEM_USER_ID,
      true,
    );
    const allCategories = await this.supplyCategoriesService.getCategories();
    const supplyMap = new Map<string, string>();
    allSupplies.forEach((supply) => {
      supplyMap.set(supply.name.toLowerCase(), supply.id);
    });

    // Process all items, creating supplies if they don't exist
    const revisionItems = await Promise.all(
      items.map(async (item, index) => {
        let supplyId = supplyMap.get(item.supplyName.toLowerCase());

        // If supply doesn't exist, create it
        if (!supplyId) {
          const category = this.findCategoryForSupply(
            item.supplyName,
            allCategories,
          );

          this.logger.log(
            `    Creating supply "${item.supplyName}" in category "${category.name}"`,
          );

          const { data: newSupply, error: createError } = await this.supabase
            .from('supplies')
            .insert({
              name: item.supplyName,
              category_id: category.id,
              category_name: category.name,
              scope: 'global',
              tenant_id: null,
              unit_type: 'piece',
              base_unit: 'each',
              expires: true,
              osha_required: false,
              is_active: true,
              created_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .select()
            .single();

          if (createError || !newSupply || !newSupply.id) {
            this.logger.error(
              `    ❌ Failed to create supply "${item.supplyName}": ${createError?.message}`,
            );
            throw new Error(
              `Failed to create supply "${item.supplyName}": ${createError?.message}`,
            );
          }

          supplyId = newSupply.id;
          this.logger.log(
            `    ✅ Created supply "${item.supplyName}" (id: ${supplyId}) in category "${category.name}"`,
          );

          // Add to map for potential future use in this batch
          // supplyId is guaranteed to be defined here (we checked newSupply.id above)
          supplyMap.set(item.supplyName.toLowerCase(), supplyId as string);
        }

        // At this point, supplyId is guaranteed to be defined
        if (!supplyId) {
          throw new Error(`Supply ID is undefined for "${item.supplyName}"`);
        }

        const itemData: any = {
          template_revision_id: revision.id,
          supply_id: supplyId,
          required_units: item.requiredQuantity,
          sort_order: index,
          scales_with_people: false,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        };

        // Only include notes if it's defined
        if (item.notes) {
          itemData.notes = item.notes;
        }

        this.logger.log(
          `    Adding item ${index + 1}/${items.length}: ${item.supplyName} (qty: ${item.requiredQuantity}, supplyId: ${supplyId})`,
        );

        return itemData;
      }),
    );

    this.logger.log(
      `  Inserting ${revisionItems.length} items into revision...`,
    );
    const { error } = await this.supabase
      .from('kit_template_revision_items')
      .insert(revisionItems);

    if (error) {
      this.logger.error(
        `  ❌ Failed to insert items for template ${publicTemplateId}: ${error.message}`,
      );
      throw new Error(
        `Failed to save items to template ${publicTemplateId}: ${error.message}`,
      );
    }

    this.logger.log(`  ✅ Items inserted successfully`);

    // Verify items were actually written
    const { data: savedItems, error: verifyError } = await this.supabase
      .from('kit_template_revision_items')
      .select('*')
      .eq('template_revision_id', revision.id)
      .order('sort_order', { ascending: true });

    if (verifyError) {
      this.logger.warn(`  Could not verify items: ${verifyError.message}`);
    } else {
      this.logger.log(
        `  Found ${savedItems?.length || 0} items in database (expected ${items.length})`,
      );

      if (!savedItems || savedItems.length === 0) {
        throw new Error(
          `Failed to save items to template ${publicTemplateId} - items inserted but none found`,
        );
      } else if (savedItems.length !== items.length) {
        this.logger.warn(
          `  ⚠️  WARNING: Expected ${items.length} items but found ${savedItems.length} in template ${publicTemplateId}`,
        );
      } else {
        this.logger.log(
          `  ✅ Verified ${savedItems.length} items exist in template ${publicTemplateId}`,
        );
      }
    }
  }
}
