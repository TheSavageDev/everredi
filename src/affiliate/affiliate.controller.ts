import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import { AffiliateTrackingService } from './affiliate-tracking.service';
import type { TrackClickDto } from './affiliate-tracking.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('affiliate')
@UseGuards(SupabaseAuthGuard)
export class AffiliateController {
  constructor(
    private readonly affiliateTrackingService: AffiliateTrackingService,
  ) {}

  @Post('track-click')
  async trackClick(
    @CurrentUser() user: { uid: string },
    @Body() dto: TrackClickDto,
  ) {
    const click = await this.affiliateTrackingService.trackClick(user.uid, dto);
    return {
      success: true,
      clickId: click.id,
    };
  }

  @Get('clicks')
  async getClicks(
    @CurrentUser() user: { uid: string },
    @Query('limit') limit?: string,
  ) {
    const clicks = await this.affiliateTrackingService.getClicksByUser(
      user.uid,
      limit ? parseInt(limit, 10) : 100,
    );
    return {
      success: true,
      clicks,
    };
  }
}
