import { Injectable, Inject, Logger } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';
import { PublicTemplatesService } from './public-templates.service';
import { KitTemplatesService } from './kit-templates.service';
import { SuppliesService } from '../supplies/supplies.service';

interface DefaultTemplate {
  name: string;
  description: string;
  purpose: string;
  groupSize: number;
  environment?: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  items: Array<{
    supplyName: string;
    quantity: number;
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
        { supplyName: 'Adhesive Bandages', quantity: 20 },
        { supplyName: 'Gauze Pads', quantity: 10 },
        { supplyName: 'Medical Tape', quantity: 1 },
        { supplyName: 'Antiseptic Wipes', quantity: 10 },
        { supplyName: 'Tweezers', quantity: 1 },
        { supplyName: 'Scissors', quantity: 1 },
        { supplyName: 'Disposable Gloves', quantity: 4 },
        { supplyName: 'Pain Relievers', quantity: 1 },
      ],
    },
    {
      name: 'Hiking/Outdoor Kit',
      description:
        'Designed for outdoor adventures and hiking trips. Includes supplies for treating injuries in remote locations and handling outdoor-specific emergencies.',
      purpose: 'hiking',
      groupSize: 6,
      environment: 'outdoor',
      skillLevel: 'intermediate',
      items: [
        { supplyName: 'Adhesive Bandages', quantity: 30 },
        { supplyName: 'Gauze Pads', quantity: 15 },
        { supplyName: 'Medical Tape', quantity: 2 },
        { supplyName: 'Antiseptic Wipes', quantity: 20 },
        { supplyName: 'Tweezers', quantity: 1 },
        { supplyName: 'Scissors', quantity: 1 },
        { supplyName: 'Disposable Gloves', quantity: 6 },
        { supplyName: 'Moleskin', quantity: 1, notes: 'For blisters' },
        { supplyName: 'Emergency Blanket', quantity: 1 },
        { supplyName: 'Pain Relievers', quantity: 1 },
        { supplyName: 'Antihistamine', quantity: 1 },
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
        { supplyName: 'Adhesive Bandages', quantity: 25 },
        { supplyName: 'Gauze Pads', quantity: 12 },
        { supplyName: 'Medical Tape', quantity: 1 },
        { supplyName: 'Antiseptic Wipes', quantity: 15 },
        { supplyName: 'Tweezers', quantity: 1 },
        { supplyName: 'Scissors', quantity: 1 },
        { supplyName: 'Disposable Gloves', quantity: 5 },
        { supplyName: 'Emergency Blanket', quantity: 1 },
        { supplyName: 'Flashlight', quantity: 1 },
        { supplyName: 'Pain Relievers', quantity: 1 },
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
        { supplyName: 'Adhesive Bandages', quantity: 50 },
        { supplyName: 'Gauze Pads', quantity: 20 },
        { supplyName: 'Medical Tape', quantity: 2 },
        { supplyName: 'Antiseptic Wipes', quantity: 25 },
        { supplyName: 'Tweezers', quantity: 1 },
        { supplyName: 'Scissors', quantity: 1 },
        { supplyName: 'Disposable Gloves', quantity: 10 },
        { supplyName: 'Thermometer', quantity: 1 },
        { supplyName: 'Pain Relievers', quantity: 1 },
        { supplyName: 'Antihistamine', quantity: 1 },
        { supplyName: 'Hydrogen Peroxide', quantity: 1 },
      ],
    },
    {
      name: 'Workplace First Aid Kit',
      description:
        'OSHA-compliant first aid kit designed for workplaces. Suitable for offices, warehouses, and other work environments.',
      purpose: 'workplace',
      groupSize: 20,
      environment: 'indoor',
      skillLevel: 'beginner',
      items: [
        { supplyName: 'Adhesive Bandages', quantity: 100 },
        { supplyName: 'Gauze Pads', quantity: 40 },
        { supplyName: 'Medical Tape', quantity: 4 },
        { supplyName: 'Antiseptic Wipes', quantity: 50 },
        { supplyName: 'Tweezers', quantity: 2 },
        { supplyName: 'Scissors', quantity: 2 },
        { supplyName: 'Disposable Gloves', quantity: 20 },
        { supplyName: 'Eye Wash Solution', quantity: 1 },
        { supplyName: 'Burn Gel', quantity: 1 },
        { supplyName: 'Pain Relievers', quantity: 1 },
        { supplyName: 'CPR Face Shield', quantity: 1 },
      ],
    },
    {
      name: 'Sports/Activity Kit',
      description:
        'Specialized first aid kit for sports activities, team events, and athletic competitions. Includes supplies for common sports injuries.',
      purpose: 'sports',
      groupSize: 10,
      environment: 'outdoor',
      skillLevel: 'intermediate',
      items: [
        { supplyName: 'Adhesive Bandages', quantity: 40 },
        { supplyName: 'Gauze Pads', quantity: 20 },
        { supplyName: 'Medical Tape', quantity: 3 },
        { supplyName: 'Antiseptic Wipes', quantity: 30 },
        { supplyName: 'Tweezers', quantity: 1 },
        { supplyName: 'Scissors', quantity: 1 },
        { supplyName: 'Disposable Gloves', quantity: 10 },
        { supplyName: 'Ice Pack', quantity: 2 },
        { supplyName: 'Elastic Bandage', quantity: 2 },
        { supplyName: 'Pain Relievers', quantity: 1 },
        { supplyName: 'Antihistamine', quantity: 1 },
      ],
    },
  ];

  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
    private readonly publicTemplatesService: PublicTemplatesService,
    private readonly kitTemplatesService: KitTemplatesService,
    private readonly suppliesService: SuppliesService,
  ) {}

  async seedDefaultTemplates(
    force: boolean = false,
  ): Promise<{ created: number; skipped: number; updated: number }> {
    let created = 0;
    let skipped = 0;
    let updated = 0;

    this.logger.log('🌱 Starting to seed default kit templates...');

    // Ensure system user document exists
    const systemUserRef = this.firestore
      .collection('users')
      .doc(SYSTEM_USER_ID);
    const systemUserDoc = await systemUserRef.get();
    if (!systemUserDoc.exists) {
      const now = Timestamp.now();
      await systemUserRef.set({
        id: SYSTEM_USER_ID,
        firebaseUid: SYSTEM_USER_ID,
        email: 'system@everredi.app',
        displayName: 'System',
        subscriptionTier: 'premium',
        subscriptionStatus: 'active',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      this.logger.log('✅ Created system user document');
    }

    for (const template of this.defaultTemplates) {
      try {
        // Check if template already exists by name
        const existingTemplates = await this.firestore
          .collection('publicKitTemplates')
          .where('name', '==', template.name)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        if (!existingTemplates.empty) {
          const existingTemplate = existingTemplates.docs[0];
          const existingData = existingTemplate.data() as any;

          // If force is true, or template doesn't have items, update it
          if (force || !existingData.publicTemplateId) {
            this.logger.log(
              `🔄 ${force ? 'Force updating' : 'Updating'} "${template.name}" - ${!existingData.publicTemplateId ? 'missing items' : 'force reseed'}...`,
            );

            // Soft delete the existing template
            await this.firestore
              .collection('publicKitTemplates')
              .doc(existingTemplate.id)
              .update({ isActive: false });

            // Delete old items if they exist
            try {
              const oldItemsSnapshot = await this.firestore
                .collection('publicKitTemplates')
                .doc(existingTemplate.id)
                .collection('kitItems')
                .get();

              if (!oldItemsSnapshot.empty) {
                const deleteBatch = this.firestore.batch();
                oldItemsSnapshot.docs.forEach((doc) => {
                  deleteBatch.delete(doc.ref);
                });
                await deleteBatch.commit();
                this.logger.log(
                  `  Deleted ${oldItemsSnapshot.size} old items from template`,
                );
              }
            } catch (error: any) {
              this.logger.warn(
                `  Could not delete old items: ${error.message}`,
              );
            }

            // Continue to create new template below
            updated++;
          } else {
            // Verify items actually exist in the public template
            try {
              const items =
                await this.publicTemplatesService.getPublicTemplateItems(
                  existingTemplate.id,
                );
              if (items.length === 0) {
                this.logger.log(
                  `🔄 Updating "${template.name}" - exists but no items found`,
                );
                await this.firestore
                  .collection('publicKitTemplates')
                  .doc(existingTemplate.id)
                  .update({ isActive: false });
                updated++;
                // Continue to create new template below
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
              await this.firestore
                .collection('publicKitTemplates')
                .doc(existingTemplate.id)
                .update({ isActive: false });
              updated++;
              // Continue to create new template below
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

        // Verify template document exists before adding items
        const templateDocCheck = await this.firestore
          .collection('publicKitTemplates')
          .doc(publicTemplate.id)
          .get();

        if (!templateDocCheck.exists) {
          throw new Error(
            `Public template document ${publicTemplate.id} was not created!`,
          );
        }
        this.logger.log(
          `  ✅ Confirmed template document exists: publicKitTemplates/${publicTemplate.id}`,
        );

        // Add items directly to the public template
        await this.addItemsToPublicTemplate(publicTemplate.id, template.items);

        // Final verification - query directly from Firestore
        const finalCheck = await this.firestore
          .collection('publicKitTemplates')
          .doc(publicTemplate.id)
          .collection('kitItems')
          .get();

        this.logger.log(
          `  🔍 Final database check: Found ${finalCheck.size} items in publicKitTemplates/${publicTemplate.id}/kitItems`,
        );

        if (finalCheck.empty) {
          throw new Error(
            `CRITICAL: Items were not saved! Template ${publicTemplate.id} has no items in database.`,
          );
        }

        // Verify items were saved using the service method
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
          TemplateSeedService.name,
        );
      }
    }

    this.logger.log(
      `\n✨ Seeding complete! Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`,
    );

    return { created, skipped, updated };
  }

  private async addItemsToPublicTemplate(
    publicTemplateId: string,
    items: Array<{ supplyName: string; quantity: number; notes?: string }>,
  ): Promise<void> {
    const templateRef = this.firestore
      .collection('publicKitTemplates')
      .doc(publicTemplateId);

    // Verify template document exists
    const templateDoc = await templateRef.get();
    if (!templateDoc.exists) {
      throw new Error(
        `Public template document ${publicTemplateId} does not exist`,
      );
    }
    this.logger.log(
      `  Template document ${publicTemplateId} exists, adding ${items.length} items...`,
    );

    const now = Timestamp.now();
    const batch = this.firestore.batch();

    // Try to find supplies by name, fallback to using name as supplyId
    const allSupplies = await this.suppliesService.getSupplies();
    const supplyMap = new Map<string, string>();
    allSupplies.forEach((supply) => {
      supplyMap.set(supply.name.toLowerCase(), supply.id);
    });

    items.forEach((item, index) => {
      // Create a new document reference for each item
      const itemRef = templateRef.collection('kitItems').doc();
      const supplyId =
        supplyMap.get(item.supplyName.toLowerCase()) || item.supplyName; // Use name as fallback

      const itemData: any = {
        publicTemplateId: publicTemplateId,
        supplyId,
        supplyName: item.supplyName,
        quantity: item.quantity,
        isRequired: true,
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
      };

      // Only include notes if it's defined
      if (item.notes) {
        itemData.notes = item.notes;
      }

      this.logger.log(
        `    Adding item ${index + 1}/${items.length}: ${item.supplyName} (qty: ${item.quantity}, supplyId: ${supplyId})`,
      );
      batch.set(itemRef, itemData);
    });

    try {
      this.logger.log(`  Committing batch with ${items.length} items...`);
      await batch.commit();
      this.logger.log(`  ✅ Batch committed successfully`);

      // Wait a moment for Firestore to propagate
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify items were actually written by querying directly
      this.logger.log(`  Verifying items in database...`);
      const itemsSnapshot = await templateRef
        .collection('kitItems')
        .orderBy('sortOrder')
        .get();

      this.logger.log(
        `  Found ${itemsSnapshot.size} items in database (expected ${items.length})`,
      );

      if (itemsSnapshot.empty) {
        this.logger.error(
          `  ❌ ERROR: No items found in template ${publicTemplateId} after batch commit! Template path: publicKitTemplates/${publicTemplateId}/kitItems`,
        );
        throw new Error(
          `Failed to save items to template ${publicTemplateId} - batch committed but no items found`,
        );
      } else if (itemsSnapshot.size !== items.length) {
        this.logger.warn(
          `  ⚠️  WARNING: Expected ${items.length} items but found ${itemsSnapshot.size} in template ${publicTemplateId}`,
        );
        // Log what we found
        itemsSnapshot.docs.forEach((doc, idx) => {
          const data = doc.data();
          this.logger.log(
            `    Item ${idx + 1}: ${data.supplyName} (qty: ${data.quantity}, supplyId: ${data.supplyId})`,
          );
        });
      } else {
        this.logger.log(
          `  ✅ Verified ${itemsSnapshot.size} items exist in template ${publicTemplateId}`,
        );
        // Log first few items as confirmation
        itemsSnapshot.docs.slice(0, 3).forEach((doc, idx) => {
          const data = doc.data();
          this.logger.log(
            `    Item ${idx + 1}: ${data.supplyName} (qty: ${data.quantity})`,
          );
        });
        if (itemsSnapshot.size > 3) {
          this.logger.log(`    ... and ${itemsSnapshot.size - 3} more items`);
        }
      }
    } catch (error: any) {
      this.logger.error(
        `  ❌ Failed to commit batch for template ${publicTemplateId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
