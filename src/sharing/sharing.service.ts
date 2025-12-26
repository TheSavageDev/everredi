import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Logger,
} from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';
import { UserKitsService } from '../kits/user-kits.service';
import { UsersService } from '../users/users.service';

export interface SharedKit {
  id: string;
  kitId: string;
  ownerId: string;
  sharedWith: string; // userId
  permission: 'view' | 'edit';
  sharedAt: Timestamp;
  createdAt: Timestamp;
}

export interface SharedKitLink {
  id: string;
  kitId: string;
  ownerId: string;
  linkToken: string;
  permission: 'view' | 'edit';
  expiresAt?: Timestamp;
  createdAt: Timestamp;
}

@Injectable()
export class SharingService {
  private readonly logger = new Logger(SharingService.name);

  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
    private readonly userKitsService: UserKitsService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  async shareKitWithUser(
    kitId: string,
    ownerId: string,
    sharedWithUserId: string,
    permission: 'view' | 'edit',
  ): Promise<SharedKit> {
    if (!kitId || !kitId.trim()) {
      throw new BadRequestException('Kit ID is required');
    }

    // Ensure ownerId is a string
    const ownerIdStr =
      typeof ownerId === 'string' ? ownerId : String(ownerId || '');

    if (!ownerIdStr || !ownerIdStr.trim()) {
      throw new BadRequestException('Owner ID is required');
    }

    if (!sharedWithUserId || !sharedWithUserId.trim()) {
      throw new BadRequestException('Shared with user ID is required');
    }

    // Verify kit exists and belongs to owner
    const kit = await this.userKitsService.getUserKit(
      ownerIdStr.trim(),
      kitId.trim(),
    );
    if (!kit) {
      throw new NotFoundException('Kit not found');
    }

    // Check if already shared
    const existingShare = await this.firestore
      .collection('users')
      .doc(ownerId)
      .collection('userKits')
      .doc(kitId)
      .collection('sharedWith')
      .where('sharedWith', '==', sharedWithUserId)
      .limit(1)
      .get();

    if (!existingShare.empty) {
      // Update existing share
      const existingDoc = existingShare.docs[0];
      await existingDoc.ref.update({
        permission,
        sharedAt: Timestamp.now(),
      });
      const updated = await existingDoc.ref.get();
      return {
        id: updated.id,
        kitId: kitId.trim(),
        ownerId: ownerIdStr.trim(),
        ...updated.data(),
      } as SharedKit;
    }

    // Create new share
    const now = Timestamp.now();
    const shareRef = await this.firestore
      .collection('users')
      .doc(ownerIdStr.trim())
      .collection('userKits')
      .doc(kitId.trim())
      .collection('sharedWith')
      .add({
        sharedWith: sharedWithUserId,
        permission,
        sharedAt: now,
        createdAt: now,
      });

    const shareDoc = await shareRef.get();
    return {
      id: shareDoc.id,
      kitId: kitId.trim(),
      ownerId: ownerIdStr.trim(),
      ...shareDoc.data(),
    } as SharedKit;
  }

  async createShareLink(
    kitId: string,
    ownerId: string,
    permission: 'view' | 'edit',
    expiresInDays?: number,
  ): Promise<SharedKitLink> {
    if (!kitId || !kitId.trim()) {
      throw new BadRequestException('Kit ID is required');
    }

    // Ensure ownerId is a string
    const ownerIdStr =
      typeof ownerId === 'string' ? ownerId : String(ownerId || '');

    if (!ownerIdStr || !ownerIdStr.trim()) {
      throw new BadRequestException('Owner ID is required');
    }

    // Verify kit exists
    const kit = await this.userKitsService.getUserKit(
      ownerIdStr.trim(),
      kitId.trim(),
    );
    if (!kit) {
      throw new NotFoundException('Kit not found');
    }

    // Generate unique token
    const linkToken = this.generateToken();

    const now = Timestamp.now();
    const expiresAt = expiresInDays
      ? Timestamp.fromMillis(
          now.toMillis() + expiresInDays * 24 * 60 * 60 * 1000,
        )
      : undefined;

    // Build the document data, only including expiresAt if it's defined
    const linkData: any = {
      linkToken,
      permission,
      createdAt: now,
    };

    // Only add expiresAt if it's defined (not undefined)
    if (expiresAt) {
      linkData.expiresAt = expiresAt;
    }

    const linkRef = await this.firestore
      .collection('users')
      .doc(ownerIdStr.trim())
      .collection('userKits')
      .doc(kitId.trim())
      .collection('shareLinks')
      .add(linkData);

    const linkDoc = await linkRef.get();
    return {
      id: linkDoc.id,
      kitId: kitId.trim(),
      ownerId: ownerIdStr.trim(),
      ...linkDoc.data(),
    } as SharedKitLink;
  }

  async getSharedKits(userId: string): Promise<
    Array<
      Omit<SharedKit, 'sharedAt' | 'createdAt'> & {
        sharedAt: string;
        createdAt: string;
        kitName: string;
      }
    >
  > {
    // Find all kits shared with this user
    const allUsersSnapshot = await this.firestore.collection('users').get();
    const sharedKits: Array<
      Omit<SharedKit, 'sharedAt' | 'createdAt'> & {
        sharedAt: string;
        createdAt: string;
        kitName: string;
      }
    > = [];

    for (const userDoc of allUsersSnapshot.docs) {
      const ownerId = userDoc.id;
      if (ownerId === userId) continue; // Skip own kits

      const kitsSnapshot = await this.firestore
        .collection('users')
        .doc(ownerId)
        .collection('userKits')
        .get();

      for (const kitDoc of kitsSnapshot.docs) {
        const sharesSnapshot = await this.firestore
          .collection('users')
          .doc(ownerId)
          .collection('userKits')
          .doc(kitDoc.id)
          .collection('sharedWith')
          .where('sharedWith', '==', userId)
          .get();

        if (!sharesSnapshot.empty) {
          const share = sharesSnapshot.docs[0].data() as any;
          const kit = kitDoc.data();

          // Convert Firestore Timestamps to ISO strings
          const sharedAtTimestamp = share.sharedAt as Timestamp | undefined;
          const createdAtTimestamp = share.createdAt as Timestamp | undefined;

          const sharedAt = sharedAtTimestamp
            ? sharedAtTimestamp.toDate
              ? sharedAtTimestamp.toDate().toISOString()
              : new Date(sharedAtTimestamp.toMillis()).toISOString()
            : new Date().toISOString();
          const createdAt = createdAtTimestamp
            ? createdAtTimestamp.toDate
              ? createdAtTimestamp.toDate().toISOString()
              : new Date(createdAtTimestamp.toMillis()).toISOString()
            : new Date().toISOString();

          sharedKits.push({
            id: sharesSnapshot.docs[0].id,
            kitId: kitDoc.id,
            ownerId,
            sharedWith: userId,
            permission: share.permission,
            sharedAt,
            createdAt,
            kitName: kit.name || 'Unnamed Kit',
          });
        }
      }
    }

    return sharedKits;
  }

  async getKitSharePermission(
    kitId: string,
    userId: string,
  ): Promise<{ isOwner: boolean; permission?: 'view' | 'edit' } | null> {
    // First check if user owns the kit
    const allUsersSnapshot = await this.firestore.collection('users').get();

    for (const userDoc of allUsersSnapshot.docs) {
      const ownerId = userDoc.id;

      // Check if this is the user's own kit
      if (ownerId === userId.trim()) {
        const kitDoc = await this.firestore
          .collection('users')
          .doc(ownerId)
          .collection('userKits')
          .doc(kitId.trim())
          .get();

        if (kitDoc.exists) {
          return { isOwner: true };
        }
      }

      // Check if kit is shared with this user
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
        const share = shareSnapshot.docs[0].data();
        return {
          isOwner: false,
          permission: share.permission as 'view' | 'edit',
        };
      }
    }

    return null; // Kit not found or not shared
  }

  async getKitShares(
    kitId: string,
    ownerId: string,
  ): Promise<
    Array<
      Omit<SharedKit, 'sharedAt' | 'createdAt'> & {
        sharedAt: string;
        createdAt: string;
        sharedWithEmail?: string;
        sharedWithDisplayName?: string;
      }
    >
  > {
    const sharesSnapshot = await this.firestore
      .collection('users')
      .doc(ownerId.trim())
      .collection('userKits')
      .doc(kitId.trim())
      .collection('sharedWith')
      .get();

    const shares: Array<
      Omit<SharedKit, 'sharedAt' | 'createdAt'> & {
        sharedAt: string;
        createdAt: string;
        sharedWithEmail?: string;
        sharedWithDisplayName?: string;
      }
    > = [];

    for (const shareDoc of sharesSnapshot.docs) {
      const share = shareDoc.data() as any;

      // Convert Firestore Timestamps to ISO strings
      const sharedAtTimestamp = share.sharedAt as Timestamp | undefined;
      const createdAtTimestamp = share.createdAt as Timestamp | undefined;

      const sharedAt = sharedAtTimestamp
        ? sharedAtTimestamp.toDate
          ? sharedAtTimestamp.toDate().toISOString()
          : new Date(sharedAtTimestamp.toMillis()).toISOString()
        : new Date().toISOString();
      const createdAt = createdAtTimestamp
        ? createdAtTimestamp.toDate
          ? createdAtTimestamp.toDate().toISOString()
          : new Date(createdAtTimestamp.toMillis()).toISOString()
        : new Date().toISOString();

      // Get user info for the sharedWith user
      let sharedWithEmail: string | undefined;
      let sharedWithDisplayName: string | undefined;
      try {
        const sharedWithUser = await this.usersService.getUserById(
          share.sharedWith,
        );
        if (sharedWithUser) {
          sharedWithEmail = sharedWithUser.email;
          sharedWithDisplayName = sharedWithUser.displayName;
        }
      } catch (error) {
        // If we can't get user info, continue without it
        this.logger.warn(
          `Failed to get user info for ${share.sharedWith}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      shares.push({
        id: shareDoc.id,
        kitId: kitId.trim(),
        ownerId: ownerId.trim(),
        sharedWith: share.sharedWith,
        permission: share.permission,
        sharedAt,
        createdAt,
        sharedWithEmail,
        sharedWithDisplayName,
      });
    }

    return shares;
  }

  async revokeShare(
    kitId: string,
    ownerId: string,
    shareId: string,
  ): Promise<void> {
    await this.firestore
      .collection('users')
      .doc(ownerId)
      .collection('userKits')
      .doc(kitId)
      .collection('sharedWith')
      .doc(shareId)
      .delete();
  }

  async removeSharedKit(kitId: string, userId: string): Promise<void> {
    // Find the share document where this user is the recipient
    // We need to search across all users to find the owner
    const allUsersSnapshot = await this.firestore.collection('users').get();

    for (const userDoc of allUsersSnapshot.docs) {
      const ownerId = userDoc.id;
      if (ownerId === userId.trim()) continue; // Skip own kits

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
        // Found the share, delete it
        await shareSnapshot.docs[0].ref.delete();
        return;
      }
    }

    throw new NotFoundException('Shared kit not found');
  }

  async revokeShareLink(
    kitId: string,
    ownerId: string,
    linkId: string,
  ): Promise<void> {
    await this.firestore
      .collection('users')
      .doc(ownerId)
      .collection('userKits')
      .doc(kitId)
      .collection('shareLinks')
      .doc(linkId)
      .delete();
  }

  private generateToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
