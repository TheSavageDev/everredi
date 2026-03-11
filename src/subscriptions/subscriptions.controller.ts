import {
  BadRequestException,
  Controller,
  Get,
  Body,
  Headers,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  SubscriptionsService,
  type RevenueCatWebhookPayload,
} from './subscriptions.service';
import { StripeService } from './stripe.service';
import { RevenueCatService } from './revenuecat.service';

@Controller('subscriptions')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly stripeService: StripeService,
    private readonly revenueCatService: RevenueCatService,
  ) {}

  @Post('create-checkout')
  @UseGuards(SupabaseAuthGuard)
  async createCheckoutSession(
    @CurrentUser() user: { uid: string },
    @Body() body: { priceId: string; mode?: 'subscription' | 'payment' },
  ) {
    const session = await this.subscriptionsService.createCheckoutSession(
      user.uid,
      body.priceId,
      body.mode,
    );
    return {
      success: true,
      data: session,
      message: 'Checkout session created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('portal')
  @UseGuards(SupabaseAuthGuard)
  async createCustomerPortal(@CurrentUser() user: { uid: string }) {
    const session = await this.subscriptionsService.createCustomerPortalSession(
      user.uid,
    );
    return {
      success: true,
      data: session,
      message: 'Customer portal session created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('webhook')
  @SkipThrottle()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody?.toString() ?? '';
    this.logger.log(
      `[Stripe Webhook] Received request, body length=${rawBody.length}, hasSignature=${!!signature}`,
    );
    try {
      const event = this.stripeService.handleWebhook(rawBody, signature);
      this.logger.log(
        `[Stripe Webhook] Verified event id=${event.id} type=${event.type}`,
      );
      await this.subscriptionsService.handleWebhookEvent(event);
      this.logger.log(`[Stripe Webhook] Processed event id=${event.id}`);
      return { received: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack =
        error instanceof Error ? error.stack : String(errorMessage);

      this.logger.error('Stripe webhook error:', errorStack);

      const lower = errorMessage.toLowerCase();
      const isSignatureError =
        lower.includes('signature verification') ||
        lower.includes('no signatures found') ||
        lower.includes('invalid signature');

      if (isSignatureError) {
        throw new UnauthorizedException('Invalid Stripe signature');
      }

      throw new BadRequestException('Failed to process Stripe webhook');
    }
  }

  @Get('revenuecat/info')
  @UseGuards(SupabaseAuthGuard)
  async getRevenueCatInfo(@CurrentUser() user: { uid: string }): Promise<{
    success: boolean;
    data?: unknown;
    error?: { message: string };
    message?: string;
    timestamp: string;
  }> {
    try {
      const customerInfo = await this.revenueCatService.getCustomerInfo(
        user.uid,
      );
      return {
        success: true,
        data: customerInfo as unknown,
        message: 'Customer info retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to retrieve customer info';
      return {
        success: false,
        error: {
          message: errorMessage,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('revenuecat/cancel')
  @UseGuards(SupabaseAuthGuard)
  async cancelRevenueCatSubscription(
    @CurrentUser() user: { uid: string },
    @Body() body: { productId: string },
  ): Promise<{
    success: boolean;
    data?: unknown;
    error?: { message: string };
    message?: string;
    timestamp: string;
  }> {
    try {
      const result = await this.revenueCatService.cancelSubscription(
        user.uid,
        body.productId,
      );
      return {
        success: true,
        data: result as unknown,
        message: 'Subscription cancelled successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to cancel subscription';
      return {
        success: false,
        error: {
          message: errorMessage,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('revenuecat/webhook')
  @SkipThrottle()
  async handleRevenueCatWebhook(
    @Body() body: RevenueCatWebhookPayload,
    @Headers('authorization') authHeader?: string,
  ) {
    try {
      // Verify webhook authorization (RevenueCat sends Authorization header with shared secret)
      const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
      const nodeEnv = process.env.NODE_ENV || 'development';

      if (!webhookSecret) {
        const message =
          '[RevenueCat Webhook] REVENUECAT_WEBHOOK_SECRET is not configured.';
        if (nodeEnv === 'production') {
          this.logger.error(message);
          throw new UnauthorizedException('RevenueCat webhook misconfigured');
        }

        this.logger.warn(
          `${message} Skipping authorization check in non-production environment.`,
        );
      } else {
        const providedSecret = authHeader?.replace('Bearer ', '');
        if (providedSecret !== webhookSecret) {
          this.logger.warn('[RevenueCat Webhook] Invalid authorization secret');
          throw new UnauthorizedException('Invalid RevenueCat webhook secret');
        }
      }

      this.logger.log(
        `[RevenueCat Webhook] Received event type=${(body as any).type ?? (body as any).event?.type ?? '?'} app_user_id=${(body as any).app_user_id ?? (body as any).event?.app_user_id ?? '?'} payloadPreview=${JSON.stringify(body).substring(0, 300)}`,
      );

      await this.subscriptionsService.handleRevenueCatWebhook(body);
      return { received: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        '[RevenueCat Webhook] Error:',
        error instanceof Error ? error.stack : String(error),
      );

      throw new BadRequestException('Failed to process RevenueCat webhook');
    }
  }

  @Post('revenuecat/sync')
  @UseGuards(SupabaseAuthGuard)
  async syncRevenueCatData(@CurrentUser() user: { uid: string }) {
    try {
      // Manually sync RevenueCat data for the current user
      const customerInfo = await this.revenueCatService.getCustomerInfo(
        user.uid,
      );
      await this.subscriptionsService.syncRevenueCatCustomerToDatabase(
        user.uid,
        customerInfo,
      );
      return {
        success: true,
        message: 'RevenueCat data synced successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: { message: errorMessage },
        timestamp: new Date().toISOString(),
      };
    }
  }
}
