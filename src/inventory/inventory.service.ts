import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';

const logger = new Logger('InventoryService');

export interface InventoryItem {
  id: string;
  userId: string;
  supplyId?: string; // Optional: only if user selected from curated catalog
  supplyName: string; // Required: free-form name user enters
  supplyCategoryId?: string;
  locationId: string;
  locationName?: string;
  kitId?: string; // Optional: if this item belongs to a specific kit
  kitName?: string; // Optional: name of the kit this item belongs to
  quantity: number;
  expirationDate?: Timestamp;
  purchaseDate?: Timestamp;
  purchasePrice?: number;
  supplier?: string;
  notes?: string;
  status: 'active' | 'expired' | 'used' | 'disposed';
  sentNotifications?: string[]; // Array of days for which notifications have been sent (e.g., ['60', '30', '10', '1'])
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

@Injectable()
export class InventoryService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  /**
   * Converts a date value (string, Timestamp, or object with toDate) to a Firestore Timestamp
   */
  private convertToTimestamp(
    dateValue: string | Timestamp | { toDate: () => Date } | undefined,
  ): Timestamp | undefined {
    if (!dateValue) {
      return undefined;
    }
    if (typeof dateValue === 'string') {
      return Timestamp.fromDate(new Date(dateValue));
    }
    if (dateValue instanceof Timestamp) {
      return dateValue;
    }
    // Handle Firestore Timestamp-like objects
    if (
      typeof dateValue === 'object' &&
      'toDate' in dateValue &&
      typeof dateValue.toDate === 'function'
    ) {
      return Timestamp.fromDate(dateValue.toDate());
    }
    return undefined;
  }

  async getInventoryItems(userId: string): Promise<InventoryItem[]> {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('inventoryItems')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as InventoryItem[];
  }

  async getInventoryItem(
    userId: string,
    itemId: string,
  ): Promise<InventoryItem> {
    const doc = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('inventoryItems')
      .doc(itemId)
      .get();

    if (!doc.exists) {
      throw new NotFoundException('Inventory item not found');
    }

    return { id: doc.id, ...doc.data() } as InventoryItem;
  }

  async createInventoryItem(
    userId: string,
    itemData: Omit<
      InventoryItem,
      'id' | 'userId' | 'createdAt' | 'updatedAt' | 'sentNotifications'
    >,
  ): Promise<InventoryItem> {
    const now = Timestamp.now();

    // Create document reference
    const docRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('inventoryItems')
      .doc();

    // Convert date strings to Firestore Timestamps
    const expirationTimestamp = this.convertToTimestamp(
      itemData.expirationDate,
    );
    const purchaseTimestamp = this.convertToTimestamp(itemData.purchaseDate);

    // Build document data, omitting undefined values
    const documentData: Record<string, unknown> = {
      userId,
      createdAt: now,
      updatedAt: now,
    };

    // Only include fields that are not undefined
    Object.keys(itemData).forEach((key) => {
      const value = itemData[key as keyof typeof itemData];
      if (value !== undefined) {
        documentData[key] = value;
      }
    });

    // Set converted timestamps
    if (expirationTimestamp) {
      documentData.expirationDate = expirationTimestamp;
    }
    if (purchaseTimestamp) {
      documentData.purchaseDate = purchaseTimestamp;
    }

    // Initialize sentNotifications as empty array for items with expiration dates
    if (expirationTimestamp) {
      documentData.sentNotifications = [];
    }

    await docRef.set(documentData);

    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() } as InventoryItem;
  }

  async updateInventoryItem(
    userId: string,
    itemId: string,
    updates: Partial<InventoryItem>,
  ): Promise<InventoryItem> {
    const itemRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('inventoryItems')
      .doc(itemId);

    // Get current item to check expiration date changes
    const currentDoc = await itemRef.get();
    if (!currentDoc.exists) {
      throw new NotFoundException('Inventory item not found');
    }

    const currentItem = {
      id: currentDoc.id,
      ...currentDoc.data(),
    } as InventoryItem;
    const oldExpirationDate = currentItem.expirationDate;

    // Convert date strings to Firestore Timestamps in updates
    const processedUpdates: Record<string, unknown> = { ...updates };
    const newExpirationTimestamp = this.convertToTimestamp(
      updates.expirationDate,
    );
    const newPurchaseTimestamp = this.convertToTimestamp(updates.purchaseDate);

    if (newExpirationTimestamp !== undefined) {
      processedUpdates.expirationDate = newExpirationTimestamp;
    }
    if (newPurchaseTimestamp !== undefined) {
      processedUpdates.purchaseDate = newPurchaseTimestamp;
    }

    // Handle expiration date changes - reset sentNotifications if expiration date changed
    if (newExpirationTimestamp !== undefined) {
      const expirationChanged =
        !oldExpirationDate ||
        oldExpirationDate.toDate().getTime() !==
          newExpirationTimestamp.toDate().getTime();

      if (expirationChanged) {
        // Reset sent notifications so cron job can send new alerts for the new expiration date
        processedUpdates.sentNotifications = [];
        logger.log(
          `Expiration date changed for item ${itemId}, resetting sent notifications`,
        );
      }
    } else if (updates.expirationDate === null) {
      // Expiration date was removed - clear sent notifications
      processedUpdates.sentNotifications = [];
    }

    // Filter out undefined values before updating
    const updateData = Object.fromEntries(
      Object.entries(processedUpdates).filter(
        ([, value]) => value !== undefined,
      ),
    );

    await itemRef.update({
      ...updateData,
      updatedAt: Timestamp.now(),
    });

    const doc = await itemRef.get();
    return { id: doc.id, ...doc.data() } as InventoryItem;
  }

  async deleteInventoryItem(userId: string, itemId: string): Promise<void> {
    const itemRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('inventoryItems')
      .doc(itemId);

    const doc = await itemRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Inventory item not found');
    }

    await itemRef.delete();
  }

  async searchInventoryItems(
    userId: string,
    term: string,
  ): Promise<InventoryItem[]> {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('inventoryItems')
      .get();

    const allItems = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as InventoryItem[];

    const searchTerm = term.toLowerCase();
    return allItems.filter(
      (item) =>
        item.supplyName?.toLowerCase().includes(searchTerm) ||
        item.notes?.toLowerCase().includes(searchTerm),
    );
  }

  async getExpiringItems(
    userId: string,
    days?: number,
  ): Promise<InventoryItem[]> {
    const thresholdDate = Timestamp.fromDate(
      new Date(Date.now() + (days || 30) * 24 * 60 * 60 * 1000),
    );
    const now = Timestamp.now();

    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('inventoryItems')
      .where('status', '==', 'active')
      .where('expirationDate', '>=', now)
      .where('expirationDate', '<=', thresholdDate)
      .orderBy('expirationDate', 'asc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as InventoryItem[];
  }
}
