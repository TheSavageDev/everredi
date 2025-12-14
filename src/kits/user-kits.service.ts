import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';

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
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
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
    const doc = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .doc(kitId)
      .get();

    if (!doc.exists) {
      throw new NotFoundException('User kit not found');
    }

    return { id: doc.id, ...doc.data() } as UserKit;
  }

  async createUserKit(
    userId: string,
    kitData: Omit<UserKit, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<UserKit> {
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
      console.log(
        `Creating kit with ${templateItems.length} items from template ${templateId} (${includeItems ? 'fully loaded' : 'empty'})`,
      );
      const now = Timestamp.now();
      const batch = this.firestore.batch();

      for (const item of templateItems) {
        if (!item.supplyId) {
          console.warn('Skipping item without supplyId:', item);
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
      }

      await batch.commit();
      console.log(
        `Successfully created ${templateItems.length} item instances for kit ${kit.id} (actualQuantity: ${includeItems ? 'set to requiredQuantity' : '0'})`,
      );
    } else {
      console.log(
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

    await kitRef.update({
      ...updates,
      updatedAt: Timestamp.now(),
    });

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
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('userKits')
      .doc(userKitId)
      .collection('kitItems')
      .get();

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
