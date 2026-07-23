import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { upsertUserSchema } from '@everredi/validation';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ok } from '../common/mappers';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Controller('auth')
@UseGuards(SupabaseAuthGuard)
export class AuthController {
  constructor(
    private readonly users: UsersService,
    private readonly workspaces: WorkspacesService,
  ) {}

  @Post('create-or-update')
  async createOrUpdate(
    @CurrentUser() auth: AuthUser,
    @Body(new ZodValidationPipe(upsertUserSchema)) body: unknown,
  ) {
    const user = await this.users.upsertFromAuth(auth.id, auth.email, body as never);
    const workspace = await this.workspaces.ensurePersonalWorkspace(auth.id, auth.email);
    return ok({ user, workspace }, 'User synced');
  }
}
