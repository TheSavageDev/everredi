import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { upsertUserSchema } from '@everredi/validation';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ok } from '../common/mappers';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(SupabaseAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return ok(await this.users.getById(user.id));
  }

  @Put('me')
  async update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(upsertUserSchema)) body: unknown,
  ) {
    return ok(await this.users.updateMe(user.id, body as never));
  }
}
