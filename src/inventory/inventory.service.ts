import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../config/firebase.service';
import { UsersService } from '../users/users.service';

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
  customFields?: Record<string, string | number | boolean | null>; // Custom field values keyed by fieldId
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
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
    return this.firebaseService.getSubcollection<InventoryItem>(
      'users',
      userId,
      'inventoryItems',
    );
  }

  async getInventoryItem(
    userId: string,
    itemId: string,
  ): Promise<InventoryItem> {
    const item =
      await this.firebaseService.getSubcollectionDocument<InventoryItem>(
        'users',
        userId,
        'inventoryItems',
        itemId,
        { throwIfNotFound: true },
      );

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    return item;
  }

  /**
   * Creates a new inventory item for a user.
   *
   * This method:
   * - Checks if user is premium (premium users have unlimited items)
   * - For free users, enforces a limit of 100 active inventory items
   * - Converts date strings to Firestore Timestamps
   * - Initializes sentNotifications array for items with expiration dates
   *
   * @param userId - The ID of the user creating the item
   * @param itemData - The inventory item data (excluding auto-generated fields)
   * @returns Promise resolving to the created InventoryItem
   * @throws ForbiddenException if free user has reached the 100 item limit
   *
   * @example
   * ```typescript
   * const item = await inventoryService.createInventoryItem('user123', {
   *   supplyName: 'Bandages',
   *   locationId: 'loc123',
   *   quantity: 10,
   *   status: 'active',
   *   expirationDate: '2025-12-31'
   * });
   * ```
   */
  async createInventoryItem(
    userId: string,
    itemData: Omit<
      InventoryItem,
      'id' | 'userId' | 'createdAt' | 'updatedAt' | 'sentNotifications'
    >,
  ): Promise<InventoryItem> {
    const isPremium = await this.usersService.isPremiumUser(userId);

    if (!isPremium) {
      const activeItems = await this.firebaseService.getSubcollection(
        'users',
        userId,
        'inventoryItems',
        {
          where: [{ field: 'status', operator: '==', value: 'active' }],
        },
      );

      const activeCount = activeItems.length;
      const maxFreeItems = 100;

      if (activeCount >= maxFreeItems) {
        throw new ForbiddenException({
          code: 'INVENTORY_LIMIT_REACHED',
          message:
            'You have reached the free limit of 100 active inventory items. Upgrade to premium for unlimited inventory.',
        });
      }
    }

    const now = Timestamp.now();

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

    return this.firebaseService.addSubcollectionDocument<InventoryItem>(
      'users',
      userId,
      'inventoryItems',
      documentData as Partial<InventoryItem>,
    );
  }

  async updateInventoryItem(
    userId: string,
    itemId: string,
    updates: Partial<InventoryItem>,
  ): Promise<InventoryItem> {
    // Get current item to check expiration date changes
    const currentItem =
      await this.firebaseService.getSubcollectionDocument<InventoryItem>(
        'users',
        userId,
        'inventoryItems',
        itemId,
        { throwIfNotFound: true },
      );

    if (!currentItem) {
      throw new NotFoundException('Inventory item not found');
    }

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
    ) as Partial<InventoryItem>;

    return this.firebaseService.updateSubcollectionDocument<InventoryItem>(
      'users',
      userId,
      'inventoryItems',
      itemId,
      {
        ...updateData,
        updatedAt: Timestamp.now(),
      },
    );
  }

  async deleteInventoryItem(userId: string, itemId: string): Promise<void> {
    await this.firebaseService.deleteSubcollectionDocument(
      'users',
      userId,
      'inventoryItems',
      itemId,
    );
  }

  async searchInventoryItems(
    userId: string,
    term: string,
  ): Promise<InventoryItem[]> {
    const allItems = await this.firebaseService.getSubcollection<InventoryItem>(
      'users',
      userId,
      'inventoryItems',
    );

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

    return this.firebaseService.getSubcollection<InventoryItem>(
      'users',
      userId,
      'inventoryItems',
      {
        where: [
          { field: 'status', operator: '==', value: 'active' },
          { field: 'expirationDate', operator: '>=', value: now },
          { field: 'expirationDate', operator: '<=', value: thresholdDate },
        ],
        orderBy: { field: 'expirationDate', direction: 'asc' },
      },
    );
  }
}
