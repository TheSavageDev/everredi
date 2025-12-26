import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';
import * as crypto from 'crypto';

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyHash: string; // Hashed version of the key
  lastUsed?: Timestamp;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  isActive: boolean;
}

@Injectable()
export class ApiKeysService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  async generateApiKey(
    userId: string,
    name: string,
    expiresInDays?: number,
  ): Promise<{ key: string; apiKey: ApiKey }> {
    // Generate a secure random API key
    const key = `ek_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = this.hashKey(key);

    const now = Timestamp.now();
    const expiresAt = expiresInDays
      ? Timestamp.fromMillis(
          now.toMillis() + expiresInDays * 24 * 60 * 60 * 1000,
        )
      : undefined;

    const apiKeyRef = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('apiKeys')
      .add({
        name,
        keyHash,
        createdAt: now,
        expiresAt,
        isActive: true,
      });

    const apiKeyDoc = await apiKeyRef.get();
    const apiKey = { id: apiKeyDoc.id, userId, ...apiKeyDoc.data() } as ApiKey;

    // Return the plain key only once (for display to user)
    return { key, apiKey };
  }

  async getApiKeys(userId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('apiKeys')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const { keyHash, ...rest } = data;
      return {
        id: doc.id,
        userId,
        ...rest,
      } as Omit<ApiKey, 'keyHash'>;
    });
  }

  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    const keyRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('apiKeys')
      .doc(keyId);

    const keyDoc = await keyRef.get();
    if (!keyDoc.exists) {
      throw new NotFoundException('API key not found');
    }

    await keyRef.update({ isActive: false });
  }

  async getApiKeyUsage(
    userId: string,
    keyId: string,
  ): Promise<{ usageCount: number; lastUsed?: Timestamp }> {
    // This would typically query a usage tracking collection
    // For now, return basic info from the key itself
    const keyDoc = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('apiKeys')
      .doc(keyId)
      .get();

    if (!keyDoc.exists) {
      throw new NotFoundException('API key not found');
    }

    const data = keyDoc.data() as ApiKey;
    return {
      usageCount: 0, // TODO: Implement usage tracking
      lastUsed: data.lastUsed,
    };
  }

  async validateApiKey(
    key: string,
  ): Promise<{ userId: string; keyId: string } | null> {
    const keyHash = this.hashKey(key);

    // Search all users' API keys for matching hash
    const allUsersSnapshot = await this.firestore.collection('users').get();

    for (const userDoc of allUsersSnapshot.docs) {
      const keysSnapshot = await this.firestore
        .collection('users')
        .doc(userDoc.id)
        .collection('apiKeys')
        .where('keyHash', '==', keyHash)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (!keysSnapshot.empty) {
        const keyDoc = keysSnapshot.docs[0];
        const keyData = keyDoc.data() as ApiKey;

        // Check expiration
        if (keyData.expiresAt && keyData.expiresAt.toMillis() < Date.now()) {
          return null;
        }

        // Update last used
        await keyDoc.ref.update({ lastUsed: Timestamp.now() });

        return {
          userId: userDoc.id,
          keyId: keyDoc.id,
        };
      }
    }

    return null;
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}
