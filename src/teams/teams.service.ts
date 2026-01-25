import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';
import { UsersService } from '../users/users.service';

export interface Team {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
  invitedBy: string;
  joinedAt: Date;
  createdAt: Date;
}

// Helper functions to convert PostgreSQL rows
function rowToTeam(row: any): Team {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.owner_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToTeamMember(row: any): TeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    role: row.role,
    invitedBy: row.invited_by || row.user_id, // Default to user_id if not set
    joinedAt: new Date(row.joined_at),
    createdAt: new Date(row.joined_at), // Use joined_at as created_at
  };
}

@Injectable()
export class TeamsService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly usersService: UsersService,
  ) {}

  async createTeam(
    userId: string,
    teamData: Omit<Team, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  ): Promise<Team> {
    const now = new Date();

    // Create team
    const { data: team, error: teamError } = await this.supabase
      .from('teams')
      .insert({
        name: teamData.name,
        description: teamData.description,
        owner_id: userId,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (teamError || !team) {
      throw new Error(`Failed to create team: ${teamError?.message}`);
    }

    // Add owner as admin member
    const { error: memberError } = await this.supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: userId,
        role: 'admin',
        joined_at: now.toISOString(),
      });

    if (memberError) {
      // Rollback team creation
      await this.supabase.from('teams').delete().eq('id', team.id);
      throw new Error(`Failed to add owner as member: ${memberError.message}`);
    }

    return rowToTeam(team);
  }

  async getTeamsByUser(userId: string): Promise<Team[]> {
    // Get teams where user is owner
    const { data: ownedTeams, error: ownedError } = await this.supabase
      .from('teams')
      .select('*')
      .eq('owner_id', userId);

    if (ownedError) {
      throw new Error(`Failed to get owned teams: ${ownedError.message}`);
    }

    // Get teams where user is a member
    const { data: memberships, error: memberError } = await this.supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId);

    if (memberError) {
      throw new Error(`Failed to get team memberships: ${memberError.message}`);
    }

    const teamIds = new Set<string>();
    (ownedTeams || []).forEach((team) => teamIds.add(team.id));
    (memberships || []).forEach((m) => teamIds.add(m.team_id));

    if (teamIds.size === 0) {
      return [];
    }

    // Fetch all teams
    const { data: teams, error: teamsError } = await this.supabase
      .from('teams')
      .select('*')
      .in('id', Array.from(teamIds));

    if (teamsError) {
      throw new Error(`Failed to get teams: ${teamsError.message}`);
    }

    return (teams || []).map(rowToTeam);
  }

  async getTeam(teamId: string): Promise<Team | null> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (error || !data) {
      return null;
    }

    return rowToTeam(data);
  }

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const { data, error } = await this.supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId);

    if (error) {
      throw new Error(`Failed to get team members: ${error.message}`);
    }

    return (data || []).map(rowToTeamMember);
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

    const now = new Date();
    const { data, error } = await this.supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
        role,
        joined_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to invite member: ${error.message}`);
    }

    return rowToTeamMember(data);
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

    const { data, error } = await this.supabase
      .from('team_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .eq('team_id', teamId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update member role: ${error.message}`);
    }

    return rowToTeamMember(data);
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

    const { error } = await this.supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)
      .eq('team_id', teamId);

    if (error) {
      throw new Error(`Failed to remove member: ${error.message}`);
    }
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

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;

    const { data, error } = await this.supabase
      .from('teams')
      .update(updateData)
      .eq('id', teamId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update team: ${error.message}`);
    }

    return rowToTeam(data);
  }

  async deleteTeam(teamId: string, userId: string): Promise<void> {
    const team = await this.getTeam(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.ownerId !== userId) {
      throw new BadRequestException('Only the owner can delete the team');
    }

    // Delete all members (cascade should handle this, but explicit for clarity)
    const { error: membersError } = await this.supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId);

    if (membersError) {
      throw new Error(`Failed to delete team members: ${membersError.message}`);
    }

    // Delete team
    const { error: teamError } = await this.supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (teamError) {
      throw new Error(`Failed to delete team: ${teamError.message}`);
    }
  }
}
