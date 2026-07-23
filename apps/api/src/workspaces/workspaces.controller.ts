import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from '@everredi/validation';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ok } from '../common/mappers';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
@UseGuards(SupabaseAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return ok(await this.workspaces.listForUser(user.id));
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createWorkspaceSchema)) body: unknown,
  ) {
    return ok(await this.workspaces.create(user.id, body as never));
  }

  @Get(':workspaceId/members')
  async members(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return ok(await this.workspaces.listMembers(workspaceId, user.id));
  }

  @Post(':workspaceId/invites')
  async invite(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: unknown,
  ) {
    return ok(await this.workspaces.invite(workspaceId, user.id, body as never));
  }

  @Get(':workspaceId/invites')
  async listInvites(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return ok(await this.workspaces.listInvites(workspaceId, user.id));
  }

  @Post('invites/accept')
  async accept(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(z.object({ token: z.string().min(10) }))) body: { token: string },
  ) {
    return ok(await this.workspaces.acceptInvite(user.id, user.email, body.token));
  }

  @Delete(':workspaceId/invites/:inviteId')
  async revokeInvite(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return ok(await this.workspaces.revokeInvite(workspaceId, user.id, inviteId));
  }

  @Delete(':workspaceId/members/:userId')
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') targetUserId: string,
  ) {
    return ok(await this.workspaces.removeMember(workspaceId, user.id, targetUserId));
  }

  @Patch(':workspaceId/members/:userId')
  async updateRole(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') targetUserId: string,
    @Body(new ZodValidationPipe(updateMemberRoleSchema)) body: { role: 'admin' | 'member' },
  ) {
    return ok(
      await this.workspaces.updateMemberRole(
        workspaceId,
        user.id,
        targetUserId,
        body.role,
      ),
    );
  }
}
