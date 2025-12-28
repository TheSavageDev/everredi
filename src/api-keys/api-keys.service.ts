import { Injectable, NotFoundException } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../config/firebase.service';
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
  constructor(private readonly firebaseService: FirebaseService) {}

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

    const apiKey = await this.firebaseService.addSubcollectionDocument<ApiKey>(
      'users',
      userId,
      'apiKeys',
      {
        name,
        keyHash,
        createdAt: now,
        expiresAt,
        isActive: true,
      },
    );

    // Return the plain key only once (for display to user)
    return { key, apiKey };
  }

  async getApiKeys(userId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
    const apiKeys = await this.firebaseService.getSubcollection<ApiKey>(
      'users',
      userId,
      'apiKeys',
      {
        orderBy: { field: 'createdAt', direction: 'desc' },
      },
    );

    return apiKeys.map((apiKey) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { keyHash, ...rest } = apiKey;
      return {
        ...rest,
        userId,
      } as Omit<ApiKey, 'keyHash'>;
    });
  }

  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    await this.firebaseService.updateSubcollectionDocument(
      'users',
      userId,
      'apiKeys',
      keyId,
      { isActive: false },
    );
  }

  async getApiKeyUsage(
    userId: string,
    keyId: string,
  ): Promise<{ usageCount: number; lastUsed?: Timestamp }> {
    // This would typically query a usage tracking collection
    // For now, return basic info from the key itself
    const key = await this.firebaseService.getSubcollectionDocument<ApiKey>(
      'users',
      userId,
      'apiKeys',
      keyId,
      { throwIfNotFound: true },
    );

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    return {
      usageCount: 0, // TODO: Implement usage tracking
      lastUsed: key.lastUsed,
    };
  }

  async validateApiKey(
    key: string,
  ): Promise<{ userId: string; keyId: string } | null> {
    const keyHash = this.hashKey(key);

    // Search all users' API keys for matching hash
    const allUsers = await this.firebaseService.getCollection<{ id: string }>(
      'users',
    );

    for (const user of allUsers) {
      const keys = await this.firebaseService.getSubcollection<ApiKey>(
        'users',
        user.id,
        'apiKeys',
        {
          where: [
            { field: 'keyHash', operator: '==', value: keyHash },
            { field: 'isActive', operator: '==', value: true },
          ],
          limit: 1,
        },
      );

      if (keys.length > 0) {
        const keyData = keys[0];

        // Check expiration
        if (keyData.expiresAt && keyData.expiresAt.toMillis() < Date.now()) {
          return null;
        }

        // Update last used
        await this.firebaseService.updateSubcollectionDocument(
          'users',
          user.id,
          'apiKeys',
          keyData.id,
          { lastUsed: Timestamp.now() },
        );

        return {
          userId: user.id,
          keyId: keyData.id,
        };
      }
    }

    return null;
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}
