import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { createShareLinkSchema, shareKitWithUserSchema } from '@everredi/validation';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ok } from '../common/mappers';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SharingService } from './sharing.service';

@Controller('sharing')
@UseGuards(SupabaseAuthGuard)
export class SharingController {
  constructor(private readonly sharing: SharingService) {}

  @Get('kits/shared')
  async shared(@CurrentUser() user: AuthUser) {
    return ok(await this.sharing.sharedWithMe(user.id));
  }

  @Post('kits/:kitId/share')
  async share(
    @CurrentUser() user: AuthUser,
    @Param('kitId') kitId: string,
    @Body(new ZodValidationPipe(shareKitWithUserSchema)) body: unknown,
  ) {
    return ok(await this.sharing.shareWithUser(kitId, user.id, body as never));
  }

  @Get('kits/:kitId/shares')
  async list(@CurrentUser() user: AuthUser, @Param('kitId') kitId: string) {
    return ok(await this.sharing.listShares(kitId, user.id));
  }

  @Delete('kits/:kitId/share/:shareId')
  async revoke(
    @CurrentUser() user: AuthUser,
    @Param('kitId') kitId: string,
    @Param('shareId') shareId: string,
  ) {
    return ok(await this.sharing.revokeShare(kitId, user.id, shareId));
  }

  @Post('kits/:kitId/share-link')
  async createLink(
    @CurrentUser() user: AuthUser,
    @Param('kitId') kitId: string,
    @Body(new ZodValidationPipe(createShareLinkSchema)) body: unknown,
  ) {
    return ok(await this.sharing.createLink(kitId, user.id, body as never));
  }

  @Delete('kits/:kitId/share-link/:linkId')
  async revokeLink(
    @CurrentUser() user: AuthUser,
    @Param('kitId') kitId: string,
    @Param('linkId') linkId: string,
  ) {
    return ok(await this.sharing.revokeLink(kitId, user.id, linkId));
  }

  @Post('links/:token/redeem')
  async redeem(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return ok(await this.sharing.redeemLink(user.id, user.email, token));
  }
}
