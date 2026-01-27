/**
 * Seed Uncharted Supply Co Premium Templates
 *
 * Creates premium kit templates for Uncharted Supply Co kits
 * These templates are marked as requires_premium = true
 *
 * Run with: npx ts-node api/scripts/seed-uncharted-templates.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
// Try .env.development first, then fall back to .env
const envFile =
  process.env.NODE_ENV === 'production' ? '.env' : '.env.development';
config({ path: resolve(__dirname, `../${envFile}`) });
// Also load .env as fallback for any missing variables
config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
// Use SUPABASE_SECRET_KEY (service role key) from .env.development
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('   - SUPABASE_URL');
  if (!supabaseServiceKey) {
    console.error('   - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');
  }
  console.error(`\n   Loaded from: ${envFile}`);
  console.error(
    '   Make sure these are set in your .env.development or .env file',
  );
  process.exit(1);
}

console.log(`📋 Using environment file: ${envFile}`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface UnchartedTemplate {
  name: string;
  description: string;
  purpose: string;
  link: string;
  price: number;
  items: Array<{
    supplyName: string;
    quantity: number;
    notes?: string;
  }>;
}

const unchartedTemplates: UnchartedTemplate[] = [
  {
    name: 'Uncharted Supply Co The Possibles Pouch',
    description:
      'Uncharted Supply Co The Possibles Pouch. Includes all the supplies you need to treat minor injuries and emergencies.',
    purpose: 'uncharted',
    link: 'https://unchartedsupplyco.com/products/the-possibles-pouch',
    price: 89,
    items: [
      { supplyName: 'Ibuprofen Sachet', quantity: 2 },
      { supplyName: 'Antihistamine Sachet', quantity: 2 },
      { supplyName: 'Adhesive bandages (1x3 inches)', quantity: 6 },
      { supplyName: 'Adhesive bandages (2x4 inches)', quantity: 2 },
      { supplyName: 'Mylar Blanket', quantity: 1 },
      { supplyName: 'Blister Gels', quantity: 4 },
      { supplyName: 'Triple Antibiotic', quantity: 4 },
      { supplyName: 'Safety Pins', quantity: 2 },
      { supplyName: 'Wound Closure Stripes', quantity: 2 },
      { supplyName: 'Hemostatic gauze', quantity: 4 },
      { supplyName: 'Gauze Pads (3x3 inches)', quantity: 2 },
      { supplyName: 'Slishman Pressure Bandage', quantity: 1 },
      { supplyName: 'Bailing Wire', quantity: 1 },
      { supplyName: 'Flat Pack Duct Tape', quantity: 1 },
      { supplyName: 'Flat Pack stormproof matches', quantity: 1 },
      { supplyName: 'Reusable Zip Ties', quantity: 4 },
      { supplyName: 'Signaling Mirror', quantity: 1 },
      { supplyName: 'Fishing Kit', quantity: 1 },
      { supplyName: 'Ferro Rod', quantity: 1 },
      { supplyName: 'Tinder', quantity: 1 },
      { supplyName: 'Water Purification Tablets', quantity: 5 },
    ],
  },
  {
    name: 'Uncharted Supply Co First Aid Plus',
    description:
      'Uncharted Supply Co First Aid Plus. Includes all the supplies you need to treat minor injuries and emergencies.',
    purpose: 'uncharted',
    link: 'https://unchartedsupplyco.com/products/first-aid-plus',
    price: 49,
    items: [
      { supplyName: 'Adhesive bandages (2x4 inches)', quantity: 6 },
      { supplyName: 'Hypo-allergenic Medical Tape', quantity: 1 },
      { supplyName: 'Duct Tape', quantity: 1 },
      { supplyName: 'Triangular Bandage', quantity: 1 },
      { supplyName: 'Splinter Probes', quantity: 1 },
      { supplyName: 'Shears', quantity: 1 },
      { supplyName: 'Antibaterial Wipes', quantity: 1 },
      { supplyName: 'Nitrile Gloves', quantity: 2 },
      { supplyName: 'Flashlight', quantity: 1 },
      { supplyName: 'Tweezers', quantity: 1 },
      { supplyName: 'First Aid Guide & Notebook', quantity: 1 },
      { supplyName: 'Adhesive bandages (1x3 inches)', quantity: 6 },
      { supplyName: 'Chem Lights', quantity: 2 },
      { supplyName: 'Mylar Blanket', quantity: 1 },
      { supplyName: 'Stormproof Matches', quantity: 2 },
      { supplyName: 'Non-Adhesive Cotton Gauze Sponges', quantity: 2 },
      { supplyName: 'Triple Antibiotic', quantity: 5 },
      { supplyName: 'Multi-tool Pro', quantity: 1 },
      { supplyName: 'Safety Pins', quantity: 5 },
      { supplyName: 'Slishman Pressure Bandage', quantity: 1 },
      { supplyName: 'Zip Ties - 7 inches', quantity: 4 },
      { supplyName: 'Burn Cream', quantity: 1 },
      { supplyName: 'Blister Pads', quantity: 5 },
      { supplyName: 'Saline Tube (30mL)', quantity: 1 },
      { supplyName: 'Antiseptic Towelette', quantity: 1 },
      { supplyName: 'CPR Kit', quantity: 1 },
    ],
  },
  {
    name: 'Uncharted Supply Co First Aid Pro',
    description:
      'Uncharted Supply Co First Aid Pro. Includes all the supplies you need to treat minor injuries and emergencies.',
    purpose: 'uncharted',
    link: 'https://unchartedsupplyco.com/products/first-aid-pro',
    price: 79,
    items: [
      // { supplyName: 'Adhesive bandages (2x4 inches)', quantity: 6 },
      // { supplyName: 'Hypo-allergenic Medical Tape', quantity: 1 },
      // { supplyName: 'Duct Tape', quantity: 1 },
      // { supplyName: 'Triangular Bandage', quantity: 1 },
      // { supplyName: 'Splinter Probes', quantity: 1 },
      // { supplyName: 'Shears', quantity: 1 },
      // { supplyName: 'Antibaterial Wipes', quantity: 1 },
      // { supplyName: 'Nitrile Gloves', quantity: 2 },
      // { supplyName: 'Flashlight', quantity: 1 },
      // { supplyName: 'Tweezers', quantity: 1 },
      // { supplyName: 'First Aid Guide & Notebook', quantity: 1 },
      // { supplyName: 'Adhesive bandages (1x3 inches)', quantity: 6 },
      // { supplyName: 'Chem Lights', quantity: 2 },
      // { supplyName: 'Mylar Blanket', quantity: 1 },
      // { supplyName: 'Stormproof Matches', quantity: 2 },
      // { supplyName: 'Non-Adhesive Cotton Gauze Sponges', quantity: 2 },
      // { supplyName: 'Triple Antibiotic', quantity: 5 },
      // { supplyName: 'Multi-tool Pro', quantity: 1 },
      // { supplyName: 'Safety Pins', quantity: 5 },
      // { supplyName: 'Slishman Pressure Bandage', quantity: 1 },
      // { supplyName: 'Zip Ties - 7 inches', quantity: 4 },
      // { supplyName: 'Burn Cream', quantity: 1 },
      // { supplyName: 'Blister Pads', quantity: 5 },
      // { supplyName: 'Saline Tube (30mL)', quantity: 1 },
      // { supplyName: 'Antiseptic Towelette', quantity: 1 },
      // { supplyName: 'CPR Kit', quantity: 1 },
    ],
  },
  {
    name: 'Uncharted Supply Co Triage Kit',
    description:
      'Uncharted Supply Co Triage Kit. Includes all the supplies you need to treat minor injuries and emergencies.',
    purpose: 'uncharted',
    link: 'https://unchartedsupplyco.com/products/triage-kit',
    price: 59,
    items: [
      // { supplyName: 'Adhesive bandages (2x4 inches)', quantity: 6 },
      // { supplyName: 'Hypo-allergenic Medical Tape', quantity: 1 },
      // { supplyName: 'Duct Tape', quantity: 1 },
      // { supplyName: 'Triangular Bandage', quantity: 1 },
      // { supplyName: 'Splinter Probes', quantity: 1 },
      // { supplyName: 'Shears', quantity: 1 },
      // { supplyName: 'Antibaterial Wipes', quantity: 1 },
      // { supplyName: 'Nitrile Gloves', quantity: 2 },
      // { supplyName: 'Flashlight', quantity: 1 },
      // { supplyName: 'Tweezers', quantity: 1 },
      // { supplyName: 'First Aid Guide & Notebook', quantity: 1 },
      // { supplyName: 'Adhesive bandages (1x3 inches)', quantity: 6 },
      // { supplyName: 'Chem Lights', quantity: 2 },
      // { supplyName: 'Mylar Blanket', quantity: 1 },
      // { supplyName: 'Stormproof Matches', quantity: 2 },
      // { supplyName: 'Non-Adhesive Cotton Gauze Sponges', quantity: 2 },
      // { supplyName: 'Triple Antibiotic', quantity: 5 },
      // { supplyName: 'Multi-tool Pro', quantity: 1 },
      // { supplyName: 'Safety Pins', quantity: 5 },
      // { supplyName: 'Slishman Pressure Bandage', quantity: 1 },
      // { supplyName: 'Zip Ties - 7 inches', quantity: 4 },
      // { supplyName: 'Burn Cream', quantity: 1 },
      // { supplyName: 'Blister Pads', quantity: 5 },
      // { supplyName: 'Saline Tube (30mL)', quantity: 1 },
      // { supplyName: 'Antiseptic Towelette', quantity: 1 },
      // { supplyName: 'CPR Kit', quantity: 1 },
    ],
  },
  {
    name: 'Uncharted Supply Co Core',
    description:
      'Uncharted Supply Co Core. Includes all the supplies you need to treat minor injuries and emergencies.',
    purpose: 'uncharted',
    link: 'https://unchartedsupplyco.com/products/first-aid-core',
    price: 39,
    items: [],
  },
  {
    name: 'Uncharted Supply Co The Wolf Pack',
    description:
      'Uncharted Supply Co The Wolf Pack. Includes all the supplies you need to treat minor injuries and emergencies.',
    purpose: 'uncharted',
    link: 'https://unchartedsupplyco.com/products/the-wolf-pack',
    price: 89,
    items: [],
  },
];

// Category IDs from 001_seed_supply_catalog.sql
const CATEGORY_IDS = {
  'Bandages & Wound Care': 'a1b2c3d4-e5f6-4789-a012-345678901234',
  'Emergency & Trauma': 'd4e5f6a7-b8c9-4012-d345-678901234567',
  'Personal Protection': 'e5f6a7b8-c9d0-4123-e456-789012345678',
  'Hygiene & Sanitation': 'f6a7b8c9-d0e1-4234-f567-890123456789',
  Respiratory: 'c9d0e1f2-a3b4-4567-c890-123456789012',
  'Documentation & Reference': 'd0e1f2a3-b4c5-4678-d901-234567890123',
  'Burn Care': 'a7b8c9d0-e1f2-4345-a678-901234567890',
};

function findCategoryForSupply(supplyName: string): {
  id: string;
  name: string;
} {
  const nameLower = supplyName.toLowerCase();

  if (
    nameLower.includes('gauze') ||
    nameLower.includes('bandage') ||
    nameLower.includes('tape') ||
    nameLower.includes('wrap') ||
    nameLower.includes('splint')
  ) {
    return {
      id: CATEGORY_IDS['Bandages & Wound Care'],
      name: 'Bandages & Wound Care',
    };
  }
  if (nameLower.includes('glove')) {
    return {
      id: CATEGORY_IDS['Personal Protection'],
      name: 'Personal Protection',
    };
  }
  if (
    nameLower.includes('blanket') ||
    nameLower.includes('foil') ||
    nameLower.includes('tourniquet')
  ) {
    return {
      id: CATEGORY_IDS['Emergency & Trauma'],
      name: 'Emergency & Trauma',
    };
  }
  if (nameLower.includes('resuscitation') || nameLower.includes('cpr')) {
    return { id: CATEGORY_IDS['Respiratory'], name: 'Respiratory' };
  }
  if (
    nameLower.includes('wound cleaning') ||
    nameLower.includes('cleaning agent') ||
    nameLower.includes('antiseptic') ||
    nameLower.includes('eye wash')
  ) {
    return {
      id: CATEGORY_IDS['Hygiene & Sanitation'],
      name: 'Hygiene & Sanitation',
    };
  }
  if (
    nameLower.includes('emergency assistance') ||
    nameLower.includes('direction')
  ) {
    return {
      id: CATEGORY_IDS['Documentation & Reference'],
      name: 'Documentation & Reference',
    };
  }
  if (nameLower.includes('burn')) {
    return { id: CATEGORY_IDS['Burn Care'], name: 'Burn Care' };
  }

  // Default to Bandages & Wound Care
  return {
    id: CATEGORY_IDS['Bandages & Wound Care'],
    name: 'Bandages & Wound Care',
  };
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
  const unitType =
    supplyName.toLowerCase().includes('roll') ||
    supplyName.toLowerCase().includes('tape')
      ? 'roll'
      : supplyName.toLowerCase().includes('box')
        ? 'box'
        : supplyName.toLowerCase().includes('bottle')
          ? 'bottle'
          : supplyName.toLowerCase().includes('pack')
            ? 'pack'
            : 'piece';

  const expires =
    !supplyName.toLowerCase().includes('blanket') &&
    !supplyName.toLowerCase().includes('direction') &&
    !supplyName.toLowerCase().includes('equipment');

  const { data: newSupply, error } = await supabase
    .from('supplies')
    .insert({
      name: supplyName,
      description: `Uncharted Supply Co supply: ${supplyName}`,
      category_id: category.id,
      category_name: category.name,
      unit_type: unitType,
      base_unit: 'each',
      expires: expires,
      default_expiration_days: expires ? 1825 : null,
      scope: 'global',
      tenant_id: null,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !newSupply) {
    console.error(
      `  ❌ Failed to create supply "${supplyName}": ${error?.message}`,
    );
    return null;
  }

  console.log(`  ✅ Created supply: ${supplyName}`);
  return newSupply.id;
}

async function seedUnchartedTemplates() {
  console.log('🌱 Starting to seed Uncharted Supply Co premium templates...');

  for (const template of unchartedTemplates) {
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
          console.error(
            `  ❌ Failed to create revision: ${revisionError?.message}`,
          );
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
        console.error(
          `  ❌ Failed to create template: ${templateError?.message}`,
        );
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
        console.error(
          `  ❌ Failed to create revision: ${revisionError?.message}`,
        );
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

    const existingSupplyIds = new Set(
      (existingItems || []).map((item) => item.supply_id),
    );

    // Create or update template items
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let itemsSkipped = 0;

    for (let i = 0; i < template.items.length; i++) {
      const item = template.items[i];
      const supplyId = await findOrCreateSupply(item.supplyName);

      if (!supplyId) {
        console.warn(
          `  ⚠️  Could not find or create supply: ${item.supplyName}, skipping...`,
        );
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
          console.error(
            `  ❌ Failed to update item ${item.supplyName}: ${updateError.message}`,
          );
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
          console.error(
            `  ❌ Failed to create item ${item.supplyName}: ${itemError.message}`,
          );
          itemsSkipped++;
        } else {
          itemsCreated++;
        }
      }
    }

    console.log(
      `  ✅ Created ${itemsCreated} items, updated ${itemsUpdated} items, skipped ${itemsSkipped}`,
    );
  }

  console.log('\n✨ Uncharted template seeding complete!');
}

seedUnchartedTemplates()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
