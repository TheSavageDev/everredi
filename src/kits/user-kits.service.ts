import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
  Logger,
} from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';
import { UsersService } from '../users/users.service';
import { InventoryService } from '../inventory/inventory.service';

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
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

@Injectable()
export class UserKitsService {
  private readonly logger = new Logger(UserKitsService.name);

  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
    @Inject(forwardRef(() => InventoryService))
    private readonly inventoryService: InventoryService,
    private readonly usersService: UsersService,
  ) {}

  async getUserKits(userId: string): Promise<UserKit[]> {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as UserKit[];
  }

  async getUserKit(userId: string, kitId: string): Promise<UserKit> {
    if (!userId || !userId.trim()) {
      throw new BadRequestException('User ID is required');
    }

    if (!kitId || !kitId.trim()) {
      throw new BadRequestException('Kit ID is required');
    }

    // First, try to get the kit from the user's own collection
    const doc = await this.firestore
      .collection('users')
      .doc(userId.trim())
      .collection('userKits')
      .doc(kitId.trim())
      .get();

    if (doc.exists) {
      return { id: doc.id, ...doc.data() } as UserKit;
    }

    // If not found, check if it's shared with this user
    // Search all users' collections for kits shared with this user
    const allUsersSnapshot = await this.firestore.collection('users').get();

    for (const userDoc of allUsersSnapshot.docs) {
      const ownerId = userDoc.id;
      if (ownerId === userId.trim()) continue; // Skip own kits (already checked)

      // Check if this kit is shared with the user
      const shareSnapshot = await this.firestore
        .collection('users')
        .doc(ownerId)
        .collection('userKits')
        .doc(kitId.trim())
        .collection('sharedWith')
        .where('sharedWith', '==', userId.trim())
        .limit(1)
        .get();

      if (!shareSnapshot.empty) {
        // Kit is shared with this user, fetch it
        const kitDoc = await this.firestore
          .collection('users')
          .doc(ownerId)
          .collection('userKits')
          .doc(kitId.trim())
          .get();

        if (kitDoc.exists) {
          return { id: kitDoc.id, ...kitDoc.data() } as UserKit;
        }
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
      const snapshot = await this.firestore
        .collection('users')
        .doc(userId)
        .collection('userKits')
        .where('status', 'in', ['active', 'incomplete'])
        .get();

      const activeCount = snapshot.size;
      const maxFreeKits = 5;

      if (activeCount >= maxFreeKits) {
        throw new ForbiddenException({
          code: 'KIT_LIMIT_REACHED',
          message:
            'You have reached the free limit of 5 kits. Upgrade to premium for unlimited kits.',
        });
      }
    }

    const now = Timestamp.now();
    const docRef = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .add({
        ...kitData,
        userId,
        createdAt: now,
        updatedAt: now,
      });

    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() } as UserKit;
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
    // For "fully loaded" kits, actualQuantity = requiredQuantity
    // For "empty" kits, actualQuantity = 0
    if (templateItems && templateItems.length > 0) {
      this.logger.log(
        `Creating kit with ${templateItems.length} items from template ${templateId} (${includeItems ? 'fully loaded' : 'empty'})`,
      );
      const now = Timestamp.now();
      const batch = this.firestore.batch();

      for (const item of templateItems) {
        if (!item.supplyId) {
          this.logger.warn(
            `Skipping item without supplyId: ${JSON.stringify(item)}`,
          );
          continue;
        }

        const itemInstanceRef = this.firestore
          .collection('users')
          .doc(userId)
          .collection('userKits')
          .doc(kit.id)
          .collection('kitItems')
          .doc();

        // For fully loaded kits, set actualQuantity equal to requiredQuantity
        // For empty kits, set actualQuantity to 0
        const actualQuantity = includeItems ? item.quantity : 0;
        let status: 'missing' | 'partial' | 'complete';
        if (actualQuantity >= item.quantity) {
          status = 'complete';
        } else if (actualQuantity > 0) {
          status = 'partial';
        } else {
          status = 'missing';
        }

        const itemInstanceData: any = {
          userKitId: kit.id,
          supplyId: item.supplyId,
          supplyName: item.supplyName || 'Unknown item',
          requiredQuantity: item.quantity,
          actualQuantity,
          status,
          createdAt: now,
          updatedAt: now,
        };

        // Only include notes if it's defined
        if (item.notes) {
          itemInstanceData.notes = item.notes;
        }

        batch.set(itemInstanceRef, itemInstanceData);

        // If fully loaded, also create inventory items
        if (includeItems && actualQuantity > 0) {
          try {
            const inventoryItemData: any = {
              supplyId: item.supplyId,
              supplyName: item.supplyName || 'Unknown item',
              locationId,
              locationName,
              kitId: kit.id, // Link inventory item to the kit
              kitName: kit.name, // Include kit name for easy reference
              quantity: actualQuantity,
              status: 'active',
            };

            // Only include notes if it's defined and not empty
            if (item.notes) {
              inventoryItemData.notes = item.notes;
            }

            await this.inventoryService.createInventoryItem(
              userId,
              inventoryItemData,
            );
            this.logger.log(
              `Created inventory item for ${item.supplyName} (quantity: ${actualQuantity}, kit: ${kit.name})`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to create inventory item for ${item.supplyName}: ${error instanceof Error ? error.message : String(error)}`,
              error instanceof Error ? error.stack : undefined,
            );
            // Don't fail the entire operation if inventory creation fails
          }
        }
      }

      await batch.commit();
      this.logger.log(
        `Successfully created ${templateItems.length} item instances for kit ${kit.id} (actualQuantity: ${includeItems ? 'set to requiredQuantity' : '0'})`,
      );
    } else {
      this.logger.log(
        `Template ${templateId} has no items. Creating kit without items.`,
      );
    }

    return kit;
  }

  async updateUserKit(
    userId: string,
    kitId: string,
    updates: Partial<UserKit>,
  ): Promise<UserKit> {
    const kitRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .doc(kitId);

    // Get current kit data to check what's changing
    const currentDoc = await kitRef.get();
    if (!currentDoc.exists) {
      throw new NotFoundException('User kit not found');
    }
    const currentKit = { id: currentDoc.id, ...currentDoc.data() } as UserKit;

    // Update the kit
    await kitRef.update({
      ...updates,
      updatedAt: Timestamp.now(),
    });

    // If location or name changed, update associated inventory items
    const locationChanged =
      updates.locationId !== undefined &&
      updates.locationId !== currentKit.locationId;
    const nameChanged =
      updates.name !== undefined && updates.name !== currentKit.name;
    const locationNameChanged =
      updates.locationName !== undefined &&
      updates.locationName !== currentKit.locationName;

    if (locationChanged || nameChanged || locationNameChanged) {
      try {
        // Find all inventory items linked to this kit
        const inventorySnapshot = await this.firestore
          .collection('users')
          .doc(userId)
          .collection('inventoryItems')
          .where('kitId', '==', kitId)
          .get();

        if (!inventorySnapshot.empty) {
          const batch = this.firestore.batch();
          const updateData: Record<string, unknown> = {
            updatedAt: Timestamp.now(),
          };

          // Update location if it changed
          if (locationChanged && updates.locationId) {
            updateData.locationId = updates.locationId;

            // If locationName wasn't provided, fetch it from Firestore
            if (!updates.locationName) {
              try {
                const locationDoc = await this.firestore
                  .collection('users')
                  .doc(userId)
                  .collection('locations')
                  .doc(updates.locationId)
                  .get();

                if (locationDoc.exists) {
                  const locationData = locationDoc.data();
                  updateData.locationName = locationData?.name || null;
                }
              } catch (error) {
                this.logger.error(
                  `Failed to fetch location name for ${updates.locationId}: ${error instanceof Error ? error.message : String(error)}`,
                  error instanceof Error ? error.stack : undefined,
                );
                // Continue without locationName
              }
            } else {
              updateData.locationName = updates.locationName;
            }
          } else if (locationNameChanged && updates.locationName) {
            updateData.locationName = updates.locationName;
          }

          // Update kit name if it changed
          if (nameChanged && updates.name) {
            updateData.kitName = updates.name;
          }

          // Update all inventory items in batch
          inventorySnapshot.docs.forEach((doc) => {
            batch.update(doc.ref, updateData);
          });

          await batch.commit();
          this.logger.log(
            `Updated ${inventorySnapshot.docs.length} inventory items for kit ${kitId}`,
          );
        }
      } catch (error) {
        // Log error but don't fail the kit update
        this.logger.error(
          `Failed to update inventory items for kit ${kitId}: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    const doc = await kitRef.get();
    if (!doc.exists) {
      throw new NotFoundException('User kit not found');
    }

    return { id: doc.id, ...doc.data() } as UserKit;
  }

  async deleteUserKit(userId: string, kitId: string): Promise<void> {
    const kitRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .doc(kitId);

    const doc = await kitRef.get();
    if (!doc.exists) {
      throw new NotFoundException('User kit not found');
    }

    await kitRef.delete();
  }

  async getkitItems(
    userId: string,
    userKitId: string,
  ): Promise<KitItemInstance[]> {
    // First, try to get items from the user's own kit
    let snapshot = await this.firestore
      .collection('users')
      .doc(userId.trim())
      .collection('userKits')
      .doc(userKitId.trim())
      .collection('kitItems')
      .get();

    // If not found, check if it's a shared kit
    if (snapshot.empty) {
      // Find the owner of this shared kit
      const allUsersSnapshot = await this.firestore.collection('users').get();

      for (const userDoc of allUsersSnapshot.docs) {
        const ownerId = userDoc.id;
        if (ownerId === userId.trim()) continue; // Skip own kits (already checked)

        // Check if this kit is shared with the user
        const shareSnapshot = await this.firestore
          .collection('users')
          .doc(ownerId)
          .collection('userKits')
          .doc(userKitId.trim())
          .collection('sharedWith')
          .where('sharedWith', '==', userId.trim())
          .limit(1)
          .get();

        if (!shareSnapshot.empty) {
          // Kit is shared, get items from owner's collection
          snapshot = await this.firestore
            .collection('users')
            .doc(ownerId)
            .collection('userKits')
            .doc(userKitId.trim())
            .collection('kitItems')
            .get();
          break;
        }
      }
    }

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as KitItemInstance[];
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
    > & { actualQuantity?: number },
  ): Promise<KitItemInstance> {
    // Verify kit exists
    const kitRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .doc(userKitId);
    const kitDoc = await kitRef.get();
    if (!kitDoc.exists) {
      throw new NotFoundException('User kit not found');
    }

    // Get actual quantity from inventory item if inventoryItemId is provided
    let actualQuantity = itemData.actualQuantity || 0;
    if (itemData.inventoryItemId && !itemData.actualQuantity) {
      const inventoryRef = this.firestore
        .collection('users')
        .doc(userId)
        .collection('inventoryItems')
        .doc(itemData.inventoryItemId);
      const inventoryDoc = await inventoryRef.get();
      if (inventoryDoc.exists) {
        const inventoryData = inventoryDoc.data();
        actualQuantity = inventoryData?.quantity || 0;
      }
    }

    // Calculate status based on actualQuantity vs requiredQuantity
    let status: 'missing' | 'partial' | 'complete';
    if (actualQuantity >= itemData.requiredQuantity) {
      status = 'complete';
    } else if (actualQuantity > 0) {
      status = 'partial';
    } else {
      status = 'missing';
    }

    const now = Timestamp.now();
    const docRef = await kitRef.collection('kitItems').add({
      ...itemData,
      userKitId,
      actualQuantity,
      status,
      createdAt: now,
      updatedAt: now,
    });

    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() } as KitItemInstance;
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
    // Verify kit exists
    const kitRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .doc(userKitId);
    const kitDoc = await kitRef.get();
    if (!kitDoc.exists) {
      throw new NotFoundException('User kit not found');
    }

    // Verify item exists
    const itemRef = kitRef.collection('kitItems').doc(itemId);
    const itemDoc = await itemRef.get();
    if (!itemDoc.exists) {
      throw new NotFoundException('Kit item instance not found');
    }

    const itemData = itemDoc.data() as KitItemInstance;

    // Use updated values or fall back to existing values
    const actualQuantity =
      updates.actualQuantity !== undefined
        ? Math.max(0, updates.actualQuantity)
        : itemData.actualQuantity;
    const requiredQuantity =
      updates.requiredQuantity !== undefined
        ? Math.max(1, updates.requiredQuantity) // Ensure at least 1
        : itemData.requiredQuantity;
    const supplyName =
      updates.supplyName !== undefined
        ? updates.supplyName
        : itemData.supplyName;

    // Calculate status based on actualQuantity vs requiredQuantity
    let status: 'missing' | 'partial' | 'complete';
    if (actualQuantity >= requiredQuantity) {
      status = 'complete';
    } else if (actualQuantity > 0) {
      status = 'partial';
    } else {
      status = 'missing';
    }

    const now = Timestamp.now();
    const updateData: any = {
      status,
      updatedAt: now,
    };

    // Only update fields that were provided
    if (updates.actualQuantity !== undefined) {
      updateData.actualQuantity = actualQuantity;
    }
    if (updates.requiredQuantity !== undefined) {
      updateData.requiredQuantity = requiredQuantity;
    }
    if (updates.supplyName !== undefined) {
      updateData.supplyName = supplyName;
    }
    if (updates.notes !== undefined) {
      // Allow clearing notes by passing empty string
      if (updates.notes === '') {
        updateData.notes = null;
      } else {
        updateData.notes = updates.notes;
      }
    }

    await itemRef.update(updateData);

    const updatedDoc = await itemRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as KitItemInstance;
  }

  async moveKitItemInstance(
    userId: string,
    sourceKitId: string,
    itemId: string,
    targetKitId: string,
  ): Promise<KitItemInstance> {
    // Verify both kits exist
    const sourceKitRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .doc(sourceKitId);
    const sourceKitDoc = await sourceKitRef.get();
    if (!sourceKitDoc.exists) {
      throw new NotFoundException('Source kit not found');
    }

    const targetKitRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .doc(targetKitId);
    const targetKitDoc = await targetKitRef.get();
    if (!targetKitDoc.exists) {
      throw new NotFoundException('Target kit not found');
    }

    if (sourceKitId === targetKitId) {
      throw new Error('Cannot move item to the same kit');
    }

    // Get the item from source kit
    const sourceItemRef = sourceKitRef.collection('kitItems').doc(itemId);
    const sourceItemDoc = await sourceItemRef.get();
    if (!sourceItemDoc.exists) {
      throw new NotFoundException('Kit item instance not found');
    }

    const itemData = sourceItemDoc.data() as KitItemInstance;

    // Create item in target kit
    const targetItemRef = targetKitRef.collection('kitItems').doc();
    const now = Timestamp.now();

    const newItemData: any = {
      userKitId: targetKitId,
      supplyId: itemData.supplyId,
      supplyName: itemData.supplyName,
      requiredQuantity: itemData.requiredQuantity,
      actualQuantity: itemData.actualQuantity,
      status: itemData.status,
      createdAt: now,
      updatedAt: now,
    };

    if (itemData.notes) {
      newItemData.notes = itemData.notes;
    }

    // Use batch to ensure atomicity
    const batch = this.firestore.batch();
    batch.set(targetItemRef, newItemData);
    batch.delete(sourceItemRef);

    await batch.commit();

    const newItemDoc = await targetItemRef.get();
    return { id: newItemDoc.id, ...newItemDoc.data() } as KitItemInstance;
  }

  async deleteKitItemInstance(
    userId: string,
    userKitId: string,
    itemId: string,
  ): Promise<void> {
    // Verify kit exists
    const kitRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .doc(userKitId);
    const kitDoc = await kitRef.get();
    if (!kitDoc.exists) {
      throw new NotFoundException('User kit not found');
    }

    // Verify item exists
    const itemRef = kitRef.collection('kitItems').doc(itemId);
    const itemDoc = await itemRef.get();
    if (!itemDoc.exists) {
      throw new NotFoundException('Kit item instance not found');
    }

    await itemRef.delete();
  }
}
