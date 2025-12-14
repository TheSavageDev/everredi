import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly stripeService: StripeService,
  ) {}

  @Post('create-checkout')
  @UseGuards(FirebaseAuthGuard)
  async createCheckoutSession(
    @CurrentUser() user: any,
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
  @UseGuards(FirebaseAuthGuard)
  async createCustomerPortal(@CurrentUser() user: any) {
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
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    try {
      const event = await this.stripeService.handleWebhook(
        req.rawBody?.toString() || '',
        signature,
      );
      await this.subscriptionsService.handleWebhookEvent(event);
      return { received: true };
    } catch (error) {
      console.error('Webhook error:', error);
      return { received: false, error: error.message };
    }
  }
}
