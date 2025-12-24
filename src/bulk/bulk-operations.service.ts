import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';
import { UsersService } from '../users/users.service';
import {
  InventoryService,
  InventoryItem,
} from '../inventory/inventory.service';
import { UserKitsService, UserKit } from '../kits/user-kits.service';

export interface BulkImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export interface BulkUpdateRequest {
  itemIds: string[];
  updates: Partial<InventoryItem>;
}

@Injectable()
export class BulkOperationsService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
    private readonly usersService: UsersService,
    private readonly inventoryService: InventoryService,
    private readonly userKitsService: UserKitsService,
  ) {}

  async importInventoryFromJSON(
    userId: string,
    jsonData: any[],
  ): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      try {
        // Validate required fields
        if (!row.supplyName || !row.locationId || row.quantity === undefined) {
          throw new Error(
            'Missing required fields: supplyName, locationId, quantity',
          );
        }

        // Convert dates if provided
        const expirationDate = row.expirationDate
          ? this.parseDate(row.expirationDate)
          : undefined;
        const purchaseDate = row.purchaseDate
          ? this.parseDate(row.purchaseDate)
          : undefined;

        const itemData: Omit<
          InventoryItem,
          'id' | 'userId' | 'createdAt' | 'updatedAt'
        > = {
          supplyName: row.supplyName,
          locationId: row.locationId,
          quantity: parseInt(row.quantity, 10) || 0,
          status: row.status || 'active',
          expirationDate,
          purchaseDate,
          purchasePrice: row.purchasePrice
            ? parseFloat(row.purchasePrice)
            : undefined,
          supplier: row.supplier,
          notes: row.notes,
          supplyId: row.supplyId,
          supplyCategoryId: row.supplyCategoryId,
        };

        await this.inventoryService.createInventoryItem(userId, itemData);
        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: i + 1,
          error: error.message || 'Unknown error',
        });
      }
    }

    return result;
  }

  async exportInventory(userId: string): Promise<any[]> {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('inventoryItems')
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        supplyName: data.supplyName,
        supplyId: data.supplyId,
        locationId: data.locationId,
        quantity: data.quantity,
        status: data.status,
        expirationDate: data.expirationDate?.toDate().toISOString(),
        purchaseDate: data.purchaseDate?.toDate().toISOString(),
        purchasePrice: data.purchasePrice,
        supplier: data.supplier,
        notes: data.notes,
        supplyCategoryId: data.supplyCategoryId,
      };
    });
  }

  async exportKits(userId: string): Promise<any[]> {
    const kits = await this.userKitsService.getUserKits(userId);
    const result: any[] = [];

    for (const kit of kits) {
      const items = await this.userKitsService.getkitItems(userId, kit.id);
      result.push({
        id: kit.id,
        name: kit.name,
        locationId: kit.locationId,
        status: kit.status,
        notes: kit.notes,
        items: items.map((item) => ({
          supplyId: item.supplyId,
          supplyName: item.supplyName,
          requiredQuantity: item.requiredQuantity,
          actualQuantity: item.actualQuantity,
          status: item.status,
          notes: item.notes,
        })),
      });
    }

    return result;
  }

  async bulkUpdateInventory(
    userId: string,
    request: BulkUpdateRequest,
  ): Promise<{ updated: number; failed: number }> {
    let updated = 0;
    let failed = 0;

    for (const itemId of request.itemIds) {
      try {
        // Verify item belongs to user
        const itemDoc = await this.firestore
          .collection('users')
          .doc(userId)
          .collection('inventoryItems')
          .doc(itemId)
          .get();

        if (!itemDoc.exists) {
          failed++;
          continue;
        }

        // Prepare update data
        const updateData: any = {
          updatedAt: Timestamp.now(),
        };

        if (request.updates.status !== undefined) {
          updateData.status = request.updates.status;
        }
        if (request.updates.locationId !== undefined) {
          updateData.locationId = request.updates.locationId;
        }
        if (request.updates.expirationDate !== undefined) {
          updateData.expirationDate = this.parseDate(
            request.updates.expirationDate as any,
          );
        }

        await itemDoc.ref.update(updateData);
        updated++;
      } catch (error) {
        failed++;
      }
    }

    return { updated, failed };
  }

  async duplicateKit(
    userId: string,
    kitId: string,
    newName?: string,
  ): Promise<UserKit> {
    const kit = await this.userKitsService.getUserKit(userId, kitId);
    if (!kit) {
      throw new BadRequestException('Kit not found');
    }

    const items = await this.userKitsService.getkitItems(userId, kitId);

    // Create new kit
    const newKitData: Omit<
      UserKit,
      'id' | 'userId' | 'createdAt' | 'updatedAt'
    > = {
      name: newName || `${kit.name} (Copy)`,
      locationId: kit.locationId,
      status: 'active',
      notes: kit.notes,
    };

    const newKit = await this.userKitsService.createUserKit(userId, newKitData);

    // Copy items
    for (const item of items) {
      await this.userKitsService.createKitItemInstance(userId, newKit.id, {
        supplyId: item.supplyId,
        supplyName: item.supplyName,
        requiredQuantity: item.requiredQuantity,
        notes: item.notes,
        inventoryItemId: item.inventoryItemId,
      });
    }

    return newKit;
  }

  private parseDate(dateValue: any): Timestamp | undefined {
    if (!dateValue) return undefined;

    if (dateValue instanceof Timestamp) {
      return dateValue;
    }

    if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return Timestamp.fromDate(date);
      }
    }

    if (dateValue instanceof Date) {
      return Timestamp.fromDate(dateValue);
    }

    return undefined;
  }
}
