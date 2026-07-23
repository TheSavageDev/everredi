import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateShareLinkInput, ShareKitWithUserInput } from '@everredi/validation';
import { and, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { addDays } from '../common/date';
import { mapAcl, mapKit, mapShareLink } from '../common/mappers';
import { DB, type Db } from '../db/db.module';
import { kitAcl, kits, shareLinks, workspaceMembers } from '../db/schema';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Injectable()
export class SharingService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly workspaces: WorkspacesService,
  ) {}

  async shareWithUser(kitId: string, actorId: string, input: ShareKitWithUserInput) {
    const { kit } = await this.workspaces.canAccessKit(actorId, kitId, 'edit');
    await this.workspaces.requireMembership(kit.workspaceId, actorId, 'admin');

    const [existing] = await this.db
      .select()
      .from(kitAcl)
      .where(and(eq(kitAcl.kitId, kitId), eq(kitAcl.userId, input.userId)))
      .limit(1);
    if (existing) {
      const [row] = await this.db
        .update(kitAcl)
        .set({ permission: input.permission })
        .where(eq(kitAcl.id, existing.id))
        .returning();
      return mapAcl(row!);
    }
    const [row] = await this.db
      .insert(kitAcl)
      .values({
        kitId,
        userId: input.userId,
        permission: input.permission,
      })
      .returning();
    return mapAcl(row!);
  }

  async listShares(kitId: string, actorId: string) {
    const { kit } = await this.workspaces.canAccessKit(actorId, kitId, 'view');
    await this.workspaces.requireMembership(kit.workspaceId, actorId, 'admin');
    const rows = await this.db.select().from(kitAcl).where(eq(kitAcl.kitId, kitId));
    return rows.map(mapAcl);
  }

  async revokeShare(kitId: string, actorId: string, shareId: string) {
    const { kit } = await this.workspaces.canAccessKit(actorId, kitId, 'edit');
    await this.workspaces.requireMembership(kit.workspaceId, actorId, 'admin');
    await this.db
      .delete(kitAcl)
      .where(and(eq(kitAcl.id, shareId), eq(kitAcl.kitId, kitId)));
    return null;
  }

  async createLink(kitId: string, actorId: string, input: CreateShareLinkInput) {
    await this.workspaces.canAccessKit(actorId, kitId, 'edit');
    const token = randomBytes(20).toString('hex');
    const [row] = await this.db
      .insert(shareLinks)
      .values({
        kitId,
        ownerId: actorId,
        linkToken: token,
        permission: input.permission,
        expiresAt: input.expiresInDays
          ? addDays(new Date(), input.expiresInDays)
          : null,
      })
      .returning();
    return mapShareLink(row!);
  }

  async revokeLink(kitId: string, actorId: string, linkId: string) {
    await this.workspaces.canAccessKit(actorId, kitId, 'edit');
    await this.db
      .delete(shareLinks)
      .where(and(eq(shareLinks.id, linkId), eq(shareLinks.kitId, kitId)));
    return null;
  }

  async sharedWithMe(userId: string) {
    const rows = await this.workspaces.kitsSharedWithUser(userId);
    return rows.filter((k) => !k.deletedAt).map(mapKit);
  }

  async redeemLink(userId: string, email: string, token: string) {
    const [link] = await this.db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.linkToken, token))
      .limit(1);
    if (!link) throw new NotFoundException('Share link not found');
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new BadRequestException('Share link expired');
    }
    const [kit] = await this.db.select().from(kits).where(eq(kits.id, link.kitId)).limit(1);
    if (!kit || kit.deletedAt) throw new NotFoundException('Kit not found');

    const permission = link.permission === 'edit' ? 'edit' : 'view';
    const [existingAcl] = await this.db
      .select()
      .from(kitAcl)
      .where(and(eq(kitAcl.kitId, kit.id), eq(kitAcl.userId, userId)))
      .limit(1);
    if (existingAcl) {
      await this.db
        .update(kitAcl)
        .set({ permission })
        .where(eq(kitAcl.id, existingAcl.id));
    } else {
      await this.db.insert(kitAcl).values({
        kitId: kit.id,
        userId,
        permission,
      });
    }

    // If edit permission, also invite into workspace as member when not already
    const membership = await this.workspaces.getMembership(kit.workspaceId, userId);
    if (!membership && link.permission === 'edit') {
      try {
        await this.db.insert(workspaceMembers).values({
          workspaceId: kit.workspaceId,
          userId,
          role: 'member',
        });
      } catch {
        // ignore race / cap issues; ACL still grants kit access
      }
    }

    return mapKit(kit);
  }
}
