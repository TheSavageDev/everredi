import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { PremiumGuard } from '../common/guards/premium.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TeamsService } from './teams.service';

@Controller('teams')
@UseGuards(FirebaseAuthGuard, PremiumGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  async createTeam(
    @CurrentUser('uid') userId: string,
    @Body() body: { name: string; description?: string },
  ) {
    const team = await this.teamsService.createTeam(userId, body);
    return {
      success: true,
      data: team,
      message: 'Team created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  async getTeams(@CurrentUser('uid') userId: string) {
    const teams = await this.teamsService.getTeamsByUser(userId);
    return {
      success: true,
      data: teams,
      message: 'Teams retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async getTeam(
    @CurrentUser('uid') userId: string,
    @Param('id') teamId: string,
  ) {
    const team = await this.teamsService.getTeam(teamId);
    if (!team) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Team not found',
        },
        timestamp: new Date().toISOString(),
      };
    }
    return {
      success: true,
      data: team,
      message: 'Team retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/members')
  async getTeamMembers(
    @CurrentUser('uid') userId: string,
    @Param('id') teamId: string,
  ) {
    const members = await this.teamsService.getTeamMembers(teamId);
    return {
      success: true,
      data: members,
      message: 'Team members retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/members')
  async inviteMember(
    @CurrentUser('uid') userId: string,
    @Param('id') teamId: string,
    @Body() body: { userId: string; role?: 'admin' | 'member' | 'viewer' },
  ) {
    const member = await this.teamsService.inviteMember(
      teamId,
      userId,
      body.userId,
      body.role || 'member',
    );
    return {
      success: true,
      data: member,
      message: 'Member invited successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id/members/:memberId')
  async updateMemberRole(
    @CurrentUser('uid') userId: string,
    @Param('id') teamId: string,
    @Param('memberId') memberId: string,
    @Body() body: { role: 'admin' | 'member' | 'viewer' },
  ) {
    const member = await this.teamsService.updateMemberRole(
      teamId,
      memberId,
      body.role,
      userId,
    );
    return {
      success: true,
      data: member,
      message: 'Member role updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @CurrentUser('uid') userId: string,
    @Param('id') teamId: string,
    @Param('memberId') memberId: string,
  ) {
    await this.teamsService.removeMember(teamId, memberId, userId);
    return {
      success: true,
      message: 'Member removed successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  async updateTeam(
    @CurrentUser('uid') userId: string,
    @Param('id') teamId: string,
    @Body() body: Partial<{ name: string; description?: string }>,
  ) {
    const team = await this.teamsService.updateTeam(teamId, userId, body);
    return {
      success: true,
      data: team,
      message: 'Team updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  async deleteTeam(
    @CurrentUser('uid') userId: string,
    @Param('id') teamId: string,
  ) {
    await this.teamsService.deleteTeam(teamId, userId);
    return {
      success: true,
      message: 'Team deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }
}


