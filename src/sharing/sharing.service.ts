import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';
import { UserKitsService } from '../kits/user-kits.service';
import { UsersService } from '../users/users.service';

export interface SharedKit {
  id: string;
  kitId: string;
  ownerId: string;
  sharedWith: string; // userId
  permission: 'view' | 'edit';
  sharedAt: Date;
  createdAt: Date;
}

export interface SharedKitLink {
  id: string;
  kitId: string;
  ownerId: string;
  linkToken: string;
  permission: 'view' | 'edit';
  expiresAt?: Date;
  createdAt: Date;
}

@Injectable()
export class SharingService {
  private readonly logger = new Logger(SharingService.name);

  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
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

    // Ensure sharedWithUserId is trimmed for consistency
    const trimmedSharedWithUserId = sharedWithUserId.trim();

    // Use kit_acl instead of shared_kits
    // kit_acl uses: kit_id, subject_type='user', subject_id=userId, permission
    const now = new Date();
    const { data: share, error } = await this.supabase
      .from('kit_acl')
      .upsert(
        {
          kit_id: kitId.trim(),
          subject_type: 'user',
          subject_id: trimmedSharedWithUserId,
          permission: permission as 'view' | 'edit',
          created_at: now.toISOString(),
        },
        {
          onConflict: 'kit_id,subject_type,subject_id',
        },
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to share kit: ${error.message}`);
    }

    // Get owner_id from kits.tenant_id → tenants.owner_user_id
    const { data: kitData } = await this.supabase
      .from('kits')
      .select('tenant_id, tenants(owner_user_id)')
      .eq('id', kitId.trim())
      .single();

    const ownerIdFromKit = (kitData?.tenants as any)?.owner_user_id || ownerIdStr.trim();

    return {
      id: share.id,
      kitId: share.kit_id,
      ownerId: ownerIdFromKit,
      sharedWith: share.subject_id,
      permission: share.permission as 'view' | 'edit',
      sharedAt: new Date(share.created_at),
      createdAt: new Date(share.created_at),
    };
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

    const now = new Date();
    const expiresAt = expiresInDays
      ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const linkData: any = {
      kit_id: kitId.trim(),
      owner_id: ownerIdStr.trim(),
      link_token: linkToken,
      permission,
      created_at: now.toISOString(),
    };

    if (expiresAt) {
      linkData.expires_at = expiresAt.toISOString();
    }

    const { data: link, error } = await this.supabase
      .from('share_links')
      .insert(linkData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create share link: ${error.message}`);
    }

    return {
      id: link.id,
      kitId: link.kit_id,
      ownerId: link.owner_id,
      linkToken: link.link_token,
      permission: link.permission,
      expiresAt: link.expires_at
        ? new Date(link.expires_at)
        : undefined,
      createdAt: new Date(link.created_at),
    };
  }

  /**
   * CRITICAL PERFORMANCE FIX: This method replaces the O(n*m*k) nested loop query
   * with a simple indexed SQL lookup - O(log n) performance!
   *
   * Old (Firestore): Scan all users → all kits → all shares = O(n*m*k)
   * New (PostgreSQL): Indexed lookup on subject_id (where subject_type='user') = O(log n)
   */
  async getSharedKits(userId: string): Promise<
    Array<
      Omit<SharedKit, 'sharedAt' | 'createdAt'> & {
        sharedAt: string;
        createdAt: string;
        kitName: string;
      }
    >
  > {
    const trimmedUserId = userId.trim();
    this.logger.log(
      `[getSharedKits] Searching for kits shared with user: ${trimmedUserId}`,
    );

    // CRITICAL: This single query replaces the O(n*m*k) nested loops!
    // Uses indexed lookup on subject_id (where subject_type='user') for O(log n) performance
    const { data: sharedKits, error } = await this.supabase
      .from('kit_acl')
      .select(
        `
        id,
        kit_id,
        subject_id,
        permission,
        created_at,
        kits!inner(
          name,
          tenant_id,
          tenants(owner_user_id)
        )
      `,
      )
      .eq('subject_type', 'user')
      .eq('subject_id', trimmedUserId);

    if (error) {
      this.logger.error(
        `Error fetching shared kits: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get shared kits: ${error.message}`);
    }

    if (!sharedKits || sharedKits.length === 0) {
      this.logger.log(
        `[getSharedKits] No shared kits found for user ${trimmedUserId}`,
      );
      return [];
    }

    this.logger.log(
      `[getSharedKits] Found ${sharedKits.length} shared kits for user ${trimmedUserId}`,
    );

    // Transform the data to match the expected interface
    return sharedKits.map((share: any) => ({
      id: share.id,
      kitId: share.kit_id,
      ownerId: (share.kits?.tenants as any)?.owner_user_id || '',
      sharedWith: share.subject_id,
      permission: share.permission as 'view' | 'edit',
      sharedAt: new Date(share.created_at).toISOString(),
      createdAt: new Date(share.created_at).toISOString(),
      kitName: share.kits?.name || 'Unnamed Kit',
    }));
  }

  async getKitSharePermission(
    kitId: string,
    userId: string,
  ): Promise<{ isOwner: boolean; permission?: 'view' | 'edit' } | null> {
    const trimmedUserId = userId.trim();
    const trimmedKitId = kitId.trim();

    // First check if user owns the kit (via tenant ownership)
    const { data: kit, error: kitError } = await this.supabase
      .from('kits')
      .select('tenant_id, tenants(owner_user_id)')
      .eq('id', trimmedKitId)
      .single();

    if (!kitError && kit && (kit.tenants as any)?.owner_user_id === trimmedUserId) {
      return { isOwner: true };
    }

    // Check if kit is shared with this user via kit_acl
    const { data: share, error: shareError } = await this.supabase
      .from('kit_acl')
      .select('permission')
      .eq('kit_id', trimmedKitId)
      .eq('subject_type', 'user')
      .eq('subject_id', trimmedUserId)
      .single();

    if (!shareError && share) {
      return {
        isOwner: false,
        permission: share.permission as 'view' | 'edit',
      };
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
    // Verify owner has access to this kit
    const { data: kitData } = await this.supabase
      .from('kits')
      .select('tenant_id, tenants(owner_user_id)')
      .eq('id', kitId.trim())
      .single();

    if (!kitData || (kitData.tenants as any)?.owner_user_id !== ownerId.trim()) {
      throw new NotFoundException('Kit not found or access denied');
    }

    // Get all user shares for this kit (subject_type='user')
    const { data: shares, error } = await this.supabase
      .from('kit_acl')
      .select('*')
      .eq('kit_id', kitId.trim())
      .eq('subject_type', 'user');

    if (error) {
      throw new Error(`Failed to get kit shares: ${error.message}`);
    }

    if (!shares || shares.length === 0) {
      return [];
    }

    // Transform and enrich with user info
    const enrichedShares = await Promise.all(
      shares.map(async (share: any) => {
        // Get user info for the sharedWith user (subject_id is the user ID)
        let sharedWithEmail: string | undefined;
        let sharedWithDisplayName: string | undefined;
        try {
          const sharedWithUser = await this.usersService.getUserById(
            share.subject_id,
          );
          if (sharedWithUser) {
            sharedWithEmail = sharedWithUser.email;
            sharedWithDisplayName = sharedWithUser.displayName;
          }
        } catch (error) {
          // If we can't get user info, continue without it
          this.logger.warn(
            `Failed to get user info for ${share.subject_id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        return {
          id: share.id,
          kitId: share.kit_id,
          ownerId: ownerId.trim(),
          sharedWith: share.subject_id,
          permission: share.permission as 'view' | 'edit',
          sharedAt: new Date(share.created_at).toISOString(),
          createdAt: new Date(share.created_at).toISOString(),
          sharedWithEmail,
          sharedWithDisplayName,
        };
      }),
    );

    return enrichedShares;
  }

  async revokeShare(
    kitId: string,
    ownerId: string,
    shareId: string,
  ): Promise<void> {
    // Verify owner has access to this kit
    const { data: kitData } = await this.supabase
      .from('kits')
      .select('tenant_id, tenants(owner_user_id)')
      .eq('id', kitId.trim())
      .single();

    if (!kitData || (kitData.tenants as any)?.owner_user_id !== ownerId.trim()) {
      throw new NotFoundException('Kit not found or access denied');
    }

    const { error } = await this.supabase
      .from('kit_acl')
      .delete()
      .eq('id', shareId)
      .eq('kit_id', kitId.trim())
      .eq('subject_type', 'user');

    if (error) {
      throw new Error(`Failed to revoke share: ${error.message}`);
    }
  }

  async removeSharedKit(kitId: string, userId: string): Promise<void> {
    // Simple indexed lookup - no need to scan all users!
    const { data, error } = await this.supabase
      .from('kit_acl')
      .delete()
      .eq('kit_id', kitId.trim())
      .eq('subject_type', 'user')
      .eq('subject_id', userId.trim())
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Shared kit not found');
    }
  }

  async revokeShareLink(
    kitId: string,
    ownerId: string,
    linkId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('share_links')
      .delete()
      .eq('id', linkId)
      .eq('kit_id', kitId.trim())
      .eq('owner_id', ownerId.trim());

    if (error) {
      throw new Error(`Failed to revoke share link: ${error.message}`);
    }
  }

  private generateToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
