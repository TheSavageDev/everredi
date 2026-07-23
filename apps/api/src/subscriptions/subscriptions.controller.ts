import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ok } from '../common/mappers';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('status')
  @UseGuards(SupabaseAuthGuard)
  async status(@CurrentUser() user: AuthUser) {
    return ok(await this.subscriptions.status(user.id));
  }

  @Post('revenuecat/webhook')
  async webhook(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-revenuecat-secret') rcSecret: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const secret = rcSecret ?? authorization?.replace(/^Bearer\s+/i, '');
    this.subscriptions.assertWebhookSecret(secret);
    return ok(await this.subscriptions.handleRevenueCatWebhook(body ?? {}));
  }
}
