import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EVERREDI_PRO_ENTITLEMENT, FREE_LIMITS } from '@everredi/types';
import type {
  CreateWorkspaceInput,
  InviteMemberInput,
} from '@everredi/validation';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { addDays } from '../common/date';
import {
  mapInvite,
  mapMember,
  mapUser,
  mapWorkspace,
} from '../common/mappers';
import { DB, type Db } from '../db/db.module';
import {
  inventoryItems,
  kitAcl,
  kits,
  locations,
  users,
  workspaceInvites,
  workspaceMembers,
  workspaces,
} from '../db/schema';

@Injectable()
export class WorkspacesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async ensurePersonalWorkspace(userId: string, email: string) {
    const existing = await this.db
      .select()
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaces.type, 'personal'),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return mapWorkspace(existing[0].workspaces);
    }

    const [ws] = await this.db
      .insert(workspaces)
      .values({
        type: 'personal',
        name: `${email.split('@')[0] ?? 'My'}'s workspace`,
        ownerUserId: userId,
      })
      .returning();

    if (!ws) throw new Error('Failed to create workspace');

    await this.db.insert(workspaceMembers).values({
      workspaceId: ws.id,
      userId,
      role: 'owner',
    });

    return mapWorkspace(ws);
  }

  async listForUser(userId: string) {
    const rows = await this.db
      .select({ workspace: workspaces })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId, userId));
    return rows.map((r) => mapWorkspace(r.workspace));
  }

  async create(userId: string, input: CreateWorkspaceInput) {
    await this.assertCanCreateWorkspace(userId);
    const [ws] = await this.db
      .insert(workspaces)
      .values({
        type: input.type ?? 'shared',
        name: input.name,
        ownerUserId: userId,
      })
      .returning();
    if (!ws) throw new Error('Failed to create workspace');
    await this.db.insert(workspaceMembers).values({
      workspaceId: ws.id,
      userId,
      role: 'owner',
    });
    return mapWorkspace(ws);
  }

  async getMembership(workspaceId: string, userId: string) {
    const [row] = await this.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async requireMembership(
    workspaceId: string,
    userId: string,
    minRole: 'member' | 'admin' | 'owner' = 'member',
  ) {
    const membership = await this.getMembership(workspaceId, userId);
    if (!membership) {
      throw new ForbiddenException('Not a workspace member');
    }
    const rank = { member: 1, admin: 2, owner: 3 } as const;
    if (rank[membership.role] < rank[minRole]) {
      throw new ForbiddenException('Insufficient workspace role');
    }
    return membership;
  }

  async listMembers(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId);
    const rows = await this.db
      .select({
        member: workspaceMembers,
        email: users.email,
        displayName: users.displayName,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspaceId));
    return rows.map((r) =>
      mapMember({
        ...r.member,
        email: r.email,
        displayName: r.displayName,
      }),
    );
  }

  async invite(workspaceId: string, userId: string, input: InviteMemberInput) {
    await this.requireMembership(workspaceId, userId, 'admin');
    await this.assertMemberCap(workspaceId, userId);

    const token = randomBytes(24).toString('hex');
    const [invite] = await this.db
      .insert(workspaceInvites)
      .values({
        workspaceId,
        email: input.email.toLowerCase(),
        role: input.role,
        invitedBy: userId,
        token,
        expiresAt: addDays(new Date(), 14),
        status: 'pending',
      })
      .returning();
    if (!invite) throw new Error('Failed to create invite');
    return mapInvite(invite);
  }

  async listInvites(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId, 'admin');
    const rows = await this.db
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.workspaceId, workspaceId));
    return rows.map(mapInvite);
  }

  async acceptInvite(userId: string, email: string, token: string) {
    const [invite] = await this.db
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.token, token))
      .limit(1);
    if (!invite || invite.status !== 'pending') {
      throw new NotFoundException('Invite not found');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite expired');
    }
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      throw new ForbiddenException('Invite email mismatch');
    }

    const existing = await this.getMembership(invite.workspaceId, userId);
    if (existing) {
      return mapMember(existing);
    }

    await this.assertMemberCap(invite.workspaceId, invite.invitedBy);

    const [member] = await this.db
      .insert(workspaceMembers)
      .values({
        workspaceId: invite.workspaceId,
        userId,
        role: invite.role === 'owner' ? 'member' : invite.role,
      })
      .returning();
    if (!member) throw new Error('Failed to join workspace');

    await this.db
      .update(workspaceInvites)
      .set({ status: 'accepted' })
      .where(eq(workspaceInvites.id, invite.id));

    return mapMember(member);
  }

  async revokeInvite(workspaceId: string, userId: string, inviteId: string) {
    await this.requireMembership(workspaceId, userId, 'admin');
    await this.db
      .update(workspaceInvites)
      .set({ status: 'revoked' })
      .where(
        and(
          eq(workspaceInvites.id, inviteId),
          eq(workspaceInvites.workspaceId, workspaceId),
        ),
      );
    return null;
  }

  async removeMember(workspaceId: string, actorId: string, targetUserId: string) {
    await this.requireMembership(workspaceId, actorId, 'admin');
    const target = await this.getMembership(workspaceId, targetUserId);
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'owner') {
      throw new BadRequestException('Cannot remove workspace owner');
    }
    await this.db
      .delete(workspaceMembers)
      .where(eq(workspaceMembers.id, target.id));
    return null;
  }

  async updateMemberRole(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    role: 'admin' | 'member',
  ) {
    await this.requireMembership(workspaceId, actorId, 'owner');
    const target = await this.getMembership(workspaceId, targetUserId);
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'owner') {
      throw new BadRequestException('Cannot change owner role');
    }
    const [updated] = await this.db
      .update(workspaceMembers)
      .set({ role })
      .where(eq(workspaceMembers.id, target.id))
      .returning();
    if (!updated) throw new NotFoundException('Member not found');
    return mapMember(updated);
  }

  async canAccessKit(userId: string, kitId: string, need: 'view' | 'edit' = 'view') {
    const [kit] = await this.db
      .select()
      .from(kits)
      .where(eq(kits.id, kitId))
      .limit(1);
    if (!kit || kit.deletedAt) throw new NotFoundException('Kit not found');

    const membership = await this.getMembership(kit.workspaceId, userId);
    if (membership) {
      if (need === 'view') return { kit, membership, via: 'workspace' as const };
      if (membership.role === 'member' && need === 'edit') {
        // members can edit by default unless ACL denies — ACL is additive override
      }
      return { kit, membership, via: 'workspace' as const };
    }

    const [acl] = await this.db
      .select()
      .from(kitAcl)
      .where(and(eq(kitAcl.kitId, kitId), eq(kitAcl.userId, userId)))
      .limit(1);
    if (!acl) throw new ForbiddenException('No access to kit');
    const rank = { view: 1, edit: 2, admin: 3 } as const;
    if (rank[acl.permission] < rank[need]) {
      throw new ForbiddenException('Insufficient kit permission');
    }
    return { kit, membership: null, via: 'acl' as const };
  }

  async isPremium(userId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) return false;
    if (user.subscriptionTier !== 'premium') return false;
    if (
      user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt.getTime() < Date.now()
    ) {
      return false;
    }
    return user.subscriptionStatus === 'active';
  }

  async assertCanCreateWorkspace(userId: string) {
    if (await this.isPremium(userId)) return;
    const countRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.role, 'owner'),
          eq(workspaces.type, 'shared'),
        ),
      );
    if ((countRows[0]?.count ?? 0) >= 1) {
      throw new ForbiddenException(
        `Free plan allows 1 shared workspace. Upgrade for ${EVERREDI_PRO_ENTITLEMENT}.`,
      );
    }
  }

  async assertMemberCap(workspaceId: string, actorId: string) {
    if (await this.isPremium(actorId)) return;
    const countRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId));
    if ((countRows[0]?.count ?? 0) >= FREE_LIMITS.workspaceMembers) {
      throw new ForbiddenException(
        `Free plan allows ${FREE_LIMITS.workspaceMembers} members per workspace`,
      );
    }
  }

  async assertKitLimit(workspaceId: string, userId: string) {
    if (await this.isPremium(userId)) return;
    const countRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(kits)
      .where(and(eq(kits.workspaceId, workspaceId), sql`${kits.deletedAt} is null`));
    if ((countRows[0]?.count ?? 0) >= FREE_LIMITS.kits) {
      throw new ForbiddenException(`Free plan allows ${FREE_LIMITS.kits} kits`);
    }
  }

  async assertLocationLimit(workspaceId: string, userId: string) {
    if (await this.isPremium(userId)) return;
    const countRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(locations)
      .where(eq(locations.workspaceId, workspaceId));
    if ((countRows[0]?.count ?? 0) >= FREE_LIMITS.locations) {
      throw new ForbiddenException(
        `Free plan allows ${FREE_LIMITS.locations} locations`,
      );
    }
  }

  async assertInventoryLimit(workspaceId: string, userId: string) {
    if (await this.isPremium(userId)) return;
    const countRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventoryItems)
      .where(eq(inventoryItems.workspaceId, workspaceId));
    if ((countRows[0]?.count ?? 0) >= FREE_LIMITS.inventoryItems) {
      throw new ForbiddenException(
        `Free plan allows ${FREE_LIMITS.inventoryItems} inventory items`,
      );
    }
  }

  async workspaceIdsForUser(userId: string) {
    const rows = await this.db
      .select({ id: workspaces.id })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId, userId));
    return rows.map((r) => r.id);
  }

  async requireWorkspaceIdAccess(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId);
    return workspaceId;
  }

  // helper for shared kits query
  async kitsSharedWithUser(userId: string) {
    const rows = await this.db
      .select({ kit: kits })
      .from(kitAcl)
      .innerJoin(kits, eq(kits.id, kitAcl.kitId))
      .where(eq(kitAcl.userId, userId));
    return rows.map((r) => r.kit);
  }

  async getUser(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user ? mapUser(user) : null;
  }

  async memberUserIds(workspaceId: string) {
    const rows = await this.db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId));
    return rows.map((r) => r.userId);
  }

  async usersByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.db.select().from(users).where(inArray(users.id, ids));
  }
}
