/**
 * Seed OSHA Premium Templates
 * 
 * Creates premium kit templates for OSHA-compliant kits (Class A, Class B, Construction, General Industry)
 * These templates are marked as requires_premium = true
 * 
 * Run with: npx ts-node api/scripts/seed-osha-templates.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
// Try .env.development first, then fall back to .env
const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.development';
config({ path: resolve(__dirname, `../${envFile}`) });
// Also load .env as fallback for any missing variables
config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
// Use SUPABASE_SECRET_KEY (service role key) from .env.development
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('   - SUPABASE_URL');
  if (!supabaseServiceKey) {
    console.error('   - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');
  }
  console.error(`\n   Loaded from: ${envFile}`);
  console.error('   Make sure these are set in your .env.development or .env file');
  process.exit(1);
}

console.log(`📋 Using environment file: ${envFile}`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface OshaTemplate {
  name: string;
  description: string;
  purpose: string;
  oshaKitType: string;
  items: Array<{
    supplyName: string;
    quantity: number;
    notes?: string;
  }>;
}

const oshaTemplates: OshaTemplate[] = [
  {
    name: 'OSHA Class A First Aid Kit',
    description: 'ANSI Z308.1-2021 Class A compliant first aid kit for low-risk environments with smaller workforces. Addresses common workplace injuries like cuts, burns, and sprains.',
    purpose: 'osha-class-a',
    oshaKitType: 'class_a',
    items: [
      { supplyName: 'Gauze pads (4x4 inches)', quantity: 16 },
      { supplyName: 'Gauze pads (8x10 inches)', quantity: 4 },
      { supplyName: 'Adhesive bandages', quantity: 50 },
      { supplyName: 'Gauze roller bandage (2 inches wide)', quantity: 1 },
      { supplyName: 'Triangular bandages', quantity: 4 },
      { supplyName: 'Wound cleaning agent', quantity: 10 },
      { supplyName: 'Scissors', quantity: 1 },
      { supplyName: 'Tweezers', quantity: 1 },
      { supplyName: 'Foil blanket', quantity: 1 },
      { supplyName: 'Adhesive tape', quantity: 1 },
      { supplyName: 'Latex gloves', quantity: 2 },
      { supplyName: 'Resuscitation equipment', quantity: 1 },
      { supplyName: 'Emergency assistance directions', quantity: 1 },
    ],
  },
  {
    name: 'OSHA Class B First Aid Kit',
    description: 'ANSI Z308.1-2021 Class B compliant comprehensive first aid kit for high-risk environments or larger operations. Contains all Class A supplies plus additional items for more severe injuries.',
    purpose: 'osha-class-b',
    oshaKitType: 'class_b',
    items: [
      { supplyName: 'Gauze pads (4x4 inches)', quantity: 32 },
      { supplyName: 'Gauze pads (8x10 inches)', quantity: 8 },
      { supplyName: 'Adhesive bandages', quantity: 100 },
      { supplyName: 'Gauze roller bandage (2 inches wide)', quantity: 2 },
      { supplyName: 'Triangular bandages', quantity: 8 },
      { supplyName: 'Wound cleaning agent', quantity: 20 },
      { supplyName: 'Scissors', quantity: 1 },
      { supplyName: 'Tweezers', quantity: 1 },
      { supplyName: 'Foil blanket', quantity: 2 },
      { supplyName: 'Adhesive tape', quantity: 2 },
      { supplyName: 'Latex gloves', quantity: 4 },
      { supplyName: 'Resuscitation equipment', quantity: 1 },
      { supplyName: 'Elastic wraps', quantity: 2 },
      { supplyName: 'Splint', quantity: 1 },
      { supplyName: 'Tourniquet', quantity: 1 },
      { supplyName: 'Emergency assistance directions', quantity: 1 },
    ],
  },
  {
    name: 'OSHA Construction Industry First Aid Kit',
    description: 'OSHA-compliant first aid kit for construction sites. Based on OSHA 1926.50 and ANSI Z308.1-2021 Class B with construction-specific additions including eye wash solution.',
    purpose: 'osha-construction',
    oshaKitType: 'construction',
    items: [
      { supplyName: 'Gauze pads (4x4 inches)', quantity: 32 },
      { supplyName: 'Gauze pads (8x10 inches)', quantity: 8 },
      { supplyName: 'Adhesive bandages', quantity: 100 },
      { supplyName: 'Gauze roller bandage (2 inches wide)', quantity: 2 },
      { supplyName: 'Triangular bandages', quantity: 8 },
      { supplyName: 'Wound cleaning agent', quantity: 20 },
      { supplyName: 'Scissors', quantity: 1 },
      { supplyName: 'Tweezers', quantity: 1 },
      { supplyName: 'Foil blanket', quantity: 2 },
      { supplyName: 'Adhesive tape', quantity: 2 },
      { supplyName: 'Latex gloves', quantity: 4 },
      { supplyName: 'Resuscitation equipment', quantity: 1 },
      { supplyName: 'Elastic wraps', quantity: 2 },
      { supplyName: 'Splint', quantity: 1 },
      { supplyName: 'Tourniquet', quantity: 1 },
      { supplyName: 'Eye wash solution', quantity: 1 },
      { supplyName: 'Emergency assistance directions', quantity: 1 },
    ],
  },
  {
    name: 'OSHA General Industry First Aid Kit',
    description: 'OSHA-compliant first aid kit for general industry workplaces. Based on OSHA 1910.151 and ANSI Z308.1-2021 Class A requirements.',
    purpose: 'osha-general-industry',
    oshaKitType: 'general_industry',
    items: [
      { supplyName: 'Gauze pads (4x4 inches)', quantity: 16 },
      { supplyName: 'Gauze pads (8x10 inches)', quantity: 4 },
      { supplyName: 'Adhesive bandages', quantity: 50 },
      { supplyName: 'Gauze roller bandage (2 inches wide)', quantity: 1 },
      { supplyName: 'Triangular bandages', quantity: 4 },
      { supplyName: 'Wound cleaning agent', quantity: 10 },
      { supplyName: 'Scissors', quantity: 1 },
      { supplyName: 'Tweezers', quantity: 1 },
      { supplyName: 'Foil blanket', quantity: 1 },
      { supplyName: 'Adhesive tape', quantity: 1 },
      { supplyName: 'Latex gloves', quantity: 2 },
      { supplyName: 'Resuscitation equipment', quantity: 1 },
      { supplyName: 'Emergency assistance directions', quantity: 1 },
    ],
  },
  {
    name: 'OSHA Healthcare/Medical First Aid Kit',
    description: 'OSHA-compliant first aid kit for healthcare facilities, medical offices, and clinics. Includes supplies for bloodborne pathogen protection, sharps injuries, and medical emergencies.',
    purpose: 'osha-healthcare',
    oshaKitType: 'healthcare',
    items: [
      { supplyName: 'Gauze pads (4x4 inches)', quantity: 32 },
      { supplyName: 'Gauze pads (8x10 inches)', quantity: 8 },
      { supplyName: 'Adhesive bandages', quantity: 100 },
      { supplyName: 'Gauze roller bandage (2 inches wide)', quantity: 2 },
      { supplyName: 'Triangular bandages', quantity: 8 },
      { supplyName: 'Wound cleaning agent', quantity: 20 },
      { supplyName: 'Scissors', quantity: 2 },
      { supplyName: 'Tweezers', quantity: 2 },
      { supplyName: 'Foil blanket', quantity: 2 },
      { supplyName: 'Adhesive tape', quantity: 2 },
      { supplyName: 'Latex gloves', quantity: 10 },
      { supplyName: 'Resuscitation equipment', quantity: 2 },
      { supplyName: 'Eye wash solution', quantity: 1 },
      { supplyName: 'Antiseptic wipes', quantity: 50 },
      { supplyName: 'Emergency assistance directions', quantity: 1 },
    ],
  },
  {
    name: 'OSHA Food Service/Restaurant First Aid Kit',
    description: 'OSHA-compliant first aid kit for restaurants, kitchens, and food service establishments. Emphasizes burn treatment, cuts, and food-safe wound care supplies.',
    purpose: 'osha-food-service',
    oshaKitType: 'food_service',
    items: [
      { supplyName: 'Gauze pads (4x4 inches)', quantity: 24 },
      { supplyName: 'Gauze pads (8x10 inches)', quantity: 6 },
      { supplyName: 'Adhesive bandages', quantity: 75 },
      { supplyName: 'Gauze roller bandage (2 inches wide)', quantity: 2 },
      { supplyName: 'Triangular bandages', quantity: 6 },
      { supplyName: 'Wound cleaning agent', quantity: 15 },
      { supplyName: 'Scissors', quantity: 1 },
      { supplyName: 'Tweezers', quantity: 1 },
      { supplyName: 'Foil blanket', quantity: 1 },
      { supplyName: 'Adhesive tape', quantity: 2 },
      { supplyName: 'Latex gloves', quantity: 6 },
      { supplyName: 'Resuscitation equipment', quantity: 1 },
      { supplyName: 'Eye wash solution', quantity: 1 },
      { supplyName: 'Burn gel', quantity: 1 },
      { supplyName: 'Antiseptic wipes', quantity: 30 },
      { supplyName: 'Emergency assistance directions', quantity: 1 },
    ],
  },
  {
    name: 'OSHA Warehouse/Logistics First Aid Kit',
    description: 'OSHA-compliant first aid kit for warehouses, distribution centers, and logistics facilities. Designed for high-occupancy areas with material handling equipment and heavy lifting operations.',
    purpose: 'osha-warehouse',
    oshaKitType: 'warehouse',
    items: [
      { supplyName: 'Gauze pads (4x4 inches)', quantity: 40 },
      { supplyName: 'Gauze pads (8x10 inches)', quantity: 10 },
      { supplyName: 'Adhesive bandages', quantity: 150 },
      { supplyName: 'Gauze roller bandage (2 inches wide)', quantity: 3 },
      { supplyName: 'Triangular bandages', quantity: 10 },
      { supplyName: 'Wound cleaning agent', quantity: 25 },
      { supplyName: 'Scissors', quantity: 2 },
      { supplyName: 'Tweezers', quantity: 2 },
      { supplyName: 'Foil blanket', quantity: 3 },
      { supplyName: 'Adhesive tape', quantity: 3 },
      { supplyName: 'Latex gloves', quantity: 8 },
      { supplyName: 'Resuscitation equipment', quantity: 2 },
      { supplyName: 'Elastic wraps', quantity: 4 },
      { supplyName: 'Splint', quantity: 2 },
      { supplyName: 'Emergency assistance directions', quantity: 1 },
    ],
  },
  {
    name: 'OSHA Manufacturing/Industrial First Aid Kit',
    description: 'OSHA-compliant first aid kit for manufacturing facilities and industrial settings. Includes supplies for machine-related injuries, chemical exposure, and eye protection needs.',
    purpose: 'osha-manufacturing',
    oshaKitType: 'manufacturing',
    items: [
      { supplyName: 'Gauze pads (4x4 inches)', quantity: 40 },
      { supplyName: 'Gauze pads (8x10 inches)', quantity: 10 },
      { supplyName: 'Adhesive bandages', quantity: 150 },
      { supplyName: 'Gauze roller bandage (2 inches wide)', quantity: 3 },
      { supplyName: 'Triangular bandages', quantity: 10 },
      { supplyName: 'Wound cleaning agent', quantity: 25 },
      { supplyName: 'Scissors', quantity: 2 },
      { supplyName: 'Tweezers', quantity: 2 },
      { supplyName: 'Foil blanket', quantity: 3 },
      { supplyName: 'Adhesive tape', quantity: 3 },
      { supplyName: 'Latex gloves', quantity: 8 },
      { supplyName: 'Resuscitation equipment', quantity: 2 },
      { supplyName: 'Eye wash solution', quantity: 2 },
      { supplyName: 'Elastic wraps', quantity: 4 },
      { supplyName: 'Splint', quantity: 2 },
      { supplyName: 'Tourniquet', quantity: 1 },
      { supplyName: 'Emergency assistance directions', quantity: 1 },
    ],
  },
];

// Category IDs from 001_seed_supply_catalog.sql
const CATEGORY_IDS = {
  'Bandages & Wound Care': 'a1b2c3d4-e5f6-4789-a012-345678901234',
  'Emergency & Trauma': 'd4e5f6a7-b8c9-4012-d345-678901234567',
  'Personal Protection': 'e5f6a7b8-c9d0-4123-e456-789012345678',
  'Hygiene & Sanitation': 'f6a7b8c9-d0e1-4234-f567-890123456789',
  'Respiratory': 'c9d0e1f2-a3b4-4567-c890-123456789012',
  'Documentation & Reference': 'd0e1f2a3-b4c5-4678-d901-234567890123',
  'Burn Care': 'a7b8c9d0-e1f2-4345-a678-901234567890',
};

function findCategoryForSupply(supplyName: string): { id: string; name: string } {
  const nameLower = supplyName.toLowerCase();
  
  if (nameLower.includes('gauze') || nameLower.includes('bandage') || nameLower.includes('tape') || nameLower.includes('wrap') || nameLower.includes('splint')) {
    return { id: CATEGORY_IDS['Bandages & Wound Care'], name: 'Bandages & Wound Care' };
  }
  if (nameLower.includes('glove')) {
    return { id: CATEGORY_IDS['Personal Protection'], name: 'Personal Protection' };
  }
  if (nameLower.includes('blanket') || nameLower.includes('foil') || nameLower.includes('tourniquet')) {
    return { id: CATEGORY_IDS['Emergency & Trauma'], name: 'Emergency & Trauma' };
  }
  if (nameLower.includes('resuscitation') || nameLower.includes('cpr')) {
    return { id: CATEGORY_IDS['Respiratory'], name: 'Respiratory' };
  }
  if (nameLower.includes('wound cleaning') || nameLower.includes('cleaning agent') || nameLower.includes('antiseptic') || nameLower.includes('eye wash')) {
    return { id: CATEGORY_IDS['Hygiene & Sanitation'], name: 'Hygiene & Sanitation' };
  }
  if (nameLower.includes('emergency assistance') || nameLower.includes('direction')) {
    return { id: CATEGORY_IDS['Documentation & Reference'], name: 'Documentation & Reference' };
  }
  if (nameLower.includes('burn')) {
    return { id: CATEGORY_IDS['Burn Care'], name: 'Burn Care' };
  }
  
  // Default to Bandages & Wound Care
  return { id: CATEGORY_IDS['Bandages & Wound Care'], name: 'Bandages & Wound Care' };
}

async function findOrCreateSupply(supplyName: string): Promise<string | null> {
  // Try exact match first
  const { data: exact } = await supabase
    .from('supplies')
    .select('id')
    .ilike('name', supplyName)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (exact) {
    return exact.id;
  }

  // Try partial match
  const { data: partial } = await supabase
    .from('supplies')
    .select('id')
    .ilike('name', `%${supplyName}%`)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (partial) {
    return partial.id;
  }

  // Supply doesn't exist, create it
  const category = findCategoryForSupply(supplyName);
  const unitType = supplyName.toLowerCase().includes('roll') || supplyName.toLowerCase().includes('tape') ? 'roll' :
                   supplyName.toLowerCase().includes('box') ? 'box' :
                   supplyName.toLowerCase().includes('bottle') ? 'bottle' :
                   supplyName.toLowerCase().includes('pack') ? 'pack' : 'piece';
  
  const expires = !supplyName.toLowerCase().includes('blanket') && 
                  !supplyName.toLowerCase().includes('direction') &&
                  !supplyName.toLowerCase().includes('equipment');
  
  const { data: newSupply, error } = await supabase
    .from('supplies')
    .insert({
      name: supplyName,
      description: `OSHA-required supply: ${supplyName}`,
      category_id: category.id,
      category_name: category.name,
      unit_type: unitType,
      base_unit: 'each',
      expires: expires,
      default_expiration_days: expires ? 1825 : null,
      osha_required: true,
      scope: 'global',
      tenant_id: null,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !newSupply) {
    console.error(`  ❌ Failed to create supply "${supplyName}": ${error?.message}`);
    return null;
  }

  console.log(`  ✅ Created supply: ${supplyName}`);
  return newSupply.id;
}

async function seedOshaTemplates() {
  console.log('🌱 Starting to seed OSHA premium templates...');

  for (const template of oshaTemplates) {
    console.log(`\n📦 Processing template: ${template.name}`);

    // Check if template already exists
    const { data: existing } = await supabase
      .from('kit_templates')
      .select('id')
      .eq('name', template.name)
      .eq('created_by', 'system')
      .single();

    let templateId: string;
    let revisionId: string;

    if (existing) {
      console.log(`  ℹ️  Template already exists: ${existing.id}`);
      templateId = existing.id;

      // Get the latest revision
      const { data: latestRevision } = await supabase
        .from('kit_template_revisions')
        .select('id')
        .eq('kit_template_id', templateId)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (latestRevision) {
        revisionId = latestRevision.id;
        console.log(`  ℹ️  Using existing revision: ${revisionId}`);
      } else {
        // Create a new revision if none exists
        const { data: newRevision, error: revisionError } = await supabase
          .from('kit_template_revisions')
          .insert({
            kit_template_id: templateId,
            version: 1,
            created_by: null,
          })
          .select()
          .single();

        if (revisionError || !newRevision) {
          console.error(`  ❌ Failed to create revision: ${revisionError?.message}`);
          continue;
        }
        revisionId = newRevision.id;
        console.log(`  ✅ Created new revision: ${revisionId}`);
      }
    } else {

    // Create template
    const { data: templateData, error: templateError } = await supabase
      .from('kit_templates')
      .insert({
        user_id: null, // System template
        name: template.name,
        description: template.description,
        purpose: template.purpose,
        group_size: 1,
        environment: 'indoor',
        skill_level: 'beginner',
        is_public: true,
        is_ai_generated: false,
        requires_premium: true, // Premium template
        created_by: 'system',
        is_active: true,
        default_people_count: 1,
        people_count_options: [],
      })
      .select()
      .single();

    if (templateError || !templateData) {
      console.error(`  ❌ Failed to create template: ${templateError?.message}`);
      continue;
    }

      console.log(`  ✅ Created template: ${templateData.id}`);
      templateId = templateData.id;

      // Create template revision
      const { data: revision, error: revisionError } = await supabase
        .from('kit_template_revisions')
        .insert({
          kit_template_id: templateData.id,
          version: 1,
          created_by: null,
        })
        .select()
        .single();

      if (revisionError || !revision) {
        console.error(`  ❌ Failed to create revision: ${revisionError?.message}`);
        continue;
      }

      console.log(`  ✅ Created revision: ${revision.id}`);
      revisionId = revision.id;
    }

    // Get existing items in the revision
    const { data: existingItems } = await supabase
      .from('kit_template_revision_items')
      .select('supply_id')
      .eq('template_revision_id', revisionId);

    const existingSupplyIds = new Set((existingItems || []).map(item => item.supply_id));

    // Create or update template items
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let itemsSkipped = 0;

    for (let i = 0; i < template.items.length; i++) {
      const item = template.items[i];
      const supplyId = await findOrCreateSupply(item.supplyName);

      if (!supplyId) {
        console.warn(`  ⚠️  Could not find or create supply: ${item.supplyName}, skipping...`);
        itemsSkipped++;
        continue;
      }

      // Check if item already exists in this revision
      if (existingSupplyIds.has(supplyId)) {
        // Update existing item
        const { error: updateError } = await supabase
          .from('kit_template_revision_items')
          .update({
            required_units: item.quantity,
            notes: item.notes,
            sort_order: i,
          })
          .eq('template_revision_id', revisionId)
          .eq('supply_id', supplyId);

        if (updateError) {
          console.error(`  ❌ Failed to update item ${item.supplyName}: ${updateError.message}`);
          itemsSkipped++;
        } else {
          itemsUpdated++;
        }
      } else {
        // Insert new item
        const { error: itemError } = await supabase
          .from('kit_template_revision_items')
          .insert({
            template_revision_id: revisionId,
            supply_id: supplyId,
            required_units: item.quantity,
            notes: item.notes,
            sort_order: i,
            scales_with_people: false,
          });

        if (itemError) {
          console.error(`  ❌ Failed to create item ${item.supplyName}: ${itemError.message}`);
          itemsSkipped++;
        } else {
          itemsCreated++;
        }
      }
    }

    console.log(`  ✅ Created ${itemsCreated} items, updated ${itemsUpdated} items, skipped ${itemsSkipped}`);
  }

  console.log('\n✨ OSHA template seeding complete!');
}

seedOshaTemplates()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
