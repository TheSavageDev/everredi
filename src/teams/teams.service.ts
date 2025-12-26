import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';
import { UsersService } from '../users/users.service';

export interface Team {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
  invitedBy: string;
  joinedAt: Timestamp;
  createdAt: Timestamp;
}

@Injectable()
export class TeamsService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
    private readonly usersService: UsersService,
  ) {}

  async createTeam(
    userId: string,
    teamData: Omit<Team, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  ): Promise<Team> {
    const now = Timestamp.now();
    const teamRef = this.firestore.collection('teams').doc();

    const team: Omit<Team, 'id'> = {
      ...teamData,
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    };

    await teamRef.set(team);

    // Add owner as admin member
    await this.firestore
      .collection('teams')
      .doc(teamRef.id)
      .collection('members')
      .add({
        userId,
        role: 'admin',
        invitedBy: userId,
        joinedAt: now,
        createdAt: now,
      });

    return { id: teamRef.id, ...team };
  }

  async getTeamsByUser(userId: string): Promise<Team[]> {
    // Get teams where user is owner
    const ownedTeamsSnapshot = await this.firestore
      .collection('teams')
      .where('ownerId', '==', userId)
      .get();

    // Get teams where user is a member
    const memberTeamsSnapshot = await this.firestore
      .collectionGroup('members')
      .where('userId', '==', userId)
      .get();

    const teamIds = new Set<string>();
    ownedTeamsSnapshot.docs.forEach((doc) => teamIds.add(doc.id));
    memberTeamsSnapshot.docs.forEach((doc) => {
      const teamId = doc.ref.parent.parent?.id;
      if (teamId) teamIds.add(teamId);
    });

    const teams: Team[] = [];
    for (const teamId of teamIds) {
      const teamDoc = await this.firestore
        .collection('teams')
        .doc(teamId)
        .get();
      if (teamDoc.exists) {
        teams.push({ id: teamDoc.id, ...teamDoc.data() } as Team);
      }
    }

    return teams;
  }

  async getTeam(teamId: string): Promise<Team | null> {
    const doc = await this.firestore.collection('teams').doc(teamId).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() } as Team;
  }

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const snapshot = await this.firestore
      .collection('teams')
      .doc(teamId)
      .collection('members')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      teamId,
      ...doc.data(),
    })) as TeamMember[];
  }

  async inviteMember(
    teamId: string,
    inviterId: string,
    userId: string,
    role: 'admin' | 'member' | 'viewer' = 'member',
  ): Promise<TeamMember> {
    const team = await this.getTeam(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Check if user is already a member
    const existingMembers = await this.getTeamMembers(teamId);
    if (existingMembers.some((m) => m.userId === userId)) {
      throw new BadRequestException('User is already a member of this team');
    }

    const now = Timestamp.now();
    const memberRef = await this.firestore
      .collection('teams')
      .doc(teamId)
      .collection('members')
      .add({
        userId,
        role,
        invitedBy: inviterId,
        joinedAt: now,
        createdAt: now,
      });

    const memberDoc = await memberRef.get();
    return { id: memberDoc.id, teamId, ...memberDoc.data() } as TeamMember;
  }

  async updateMemberRole(
    teamId: string,
    memberId: string,
    newRole: 'admin' | 'member' | 'viewer',
    updaterId: string,
  ): Promise<TeamMember> {
    // Verify updater has permission (admin or owner)
    const team = await this.getTeam(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const members = await this.getTeamMembers(teamId);
    const updaterMember = members.find((m) => m.userId === updaterId);
    if (team.ownerId !== updaterId && updaterMember?.role !== 'admin') {
      throw new BadRequestException('Only admins can update member roles');
    }

    const memberRef = this.firestore
      .collection('teams')
      .doc(teamId)
      .collection('members')
      .doc(memberId);

    await memberRef.update({ role: newRole });

    const memberDoc = await memberRef.get();
    return { id: memberDoc.id, teamId, ...memberDoc.data() } as TeamMember;
  }

  async removeMember(
    teamId: string,
    memberId: string,
    removerId: string,
  ): Promise<void> {
    const team = await this.getTeam(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Verify remover has permission
    const members = await this.getTeamMembers(teamId);
    const removerMember = members.find((m) => m.userId === removerId);
    if (team.ownerId !== removerId && removerMember?.role !== 'admin') {
      throw new BadRequestException('Only admins can remove members');
    }

    await this.firestore
      .collection('teams')
      .doc(teamId)
      .collection('members')
      .doc(memberId)
      .delete();
  }

  async updateTeam(
    teamId: string,
    userId: string,
    updates: Partial<Omit<Team, 'id' | 'ownerId' | 'createdAt'>>,
  ): Promise<Team> {
    const team = await this.getTeam(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.ownerId !== userId) {
      throw new BadRequestException('Only the owner can update the team');
    }

    await this.firestore
      .collection('teams')
      .doc(teamId)
      .update({
        ...updates,
        updatedAt: Timestamp.now(),
      });

    const updatedDoc = await this.firestore
      .collection('teams')
      .doc(teamId)
      .get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as Team;
  }

  async deleteTeam(teamId: string, userId: string): Promise<void> {
    const team = await this.getTeam(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.ownerId !== userId) {
      throw new BadRequestException('Only the owner can delete the team');
    }

    // Delete all members first
    const membersSnapshot = await this.firestore
      .collection('teams')
      .doc(teamId)
      .collection('members')
      .get();

    const batch = this.firestore.batch();
    membersSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Delete team
    await this.firestore.collection('teams').doc(teamId).delete();
  }
}
