import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';
import { UserKitsService } from '../kits/user-kits.service';

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
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
    private readonly userKitsService: UserKitsService,
  ) {}

  async shareKitWithUser(
    kitId: string,
    ownerId: string,
    sharedWithUserId: string,
    permission: 'view' | 'edit',
  ): Promise<SharedKit> {
    // Verify kit exists and belongs to owner
    const kit = await this.userKitsService.getUserKit(ownerId, kitId);
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
      return { id: updated.id, kitId, ownerId, ...updated.data() } as SharedKit;
    }

    // Create new share
    const now = Timestamp.now();
    const shareRef = await this.firestore
      .collection('users')
      .doc(ownerId)
      .collection('userKits')
      .doc(kitId)
      .collection('sharedWith')
      .add({
        sharedWith: sharedWithUserId,
        permission,
        sharedAt: now,
        createdAt: now,
      });

    const shareDoc = await shareRef.get();
    return { id: shareDoc.id, kitId, ownerId, ...shareDoc.data() } as SharedKit;
  }

  async createShareLink(
    kitId: string,
    ownerId: string,
    permission: 'view' | 'edit',
    expiresInDays?: number,
  ): Promise<SharedKitLink> {
    // Verify kit exists
    const kit = await this.userKitsService.getUserKit(ownerId, kitId);
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

    const linkRef = await this.firestore
      .collection('users')
      .doc(ownerId)
      .collection('userKits')
      .doc(kitId)
      .collection('shareLinks')
      .add({
        linkToken,
        permission,
        expiresAt,
        createdAt: now,
      });

    const linkDoc = await linkRef.get();
    return {
      id: linkDoc.id,
      kitId,
      ownerId,
      ...linkDoc.data(),
    } as SharedKitLink;
  }

  async getSharedKits(
    userId: string,
  ): Promise<Array<SharedKit & { kitName: string }>> {
    // Find all kits shared with this user
    const allUsersSnapshot = await this.firestore.collection('users').get();
    const sharedKits: Array<SharedKit & { kitName: string }> = [];

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
          const share = sharesSnapshot.docs[0].data() as SharedKit;
          const kit = kitDoc.data();
          sharedKits.push({
            id: share.id || '',
            kitId: kitDoc.id,
            ownerId,
            sharedWith: userId,
            permission: share.permission,
            sharedAt: share.sharedAt,
            createdAt: share.createdAt,
            kitName: kit.name || 'Unnamed Kit',
          });
        }
      }
    }

    return sharedKits;
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


