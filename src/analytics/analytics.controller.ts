import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { PremiumGuard } from '../common/guards/premium.guard';
import { Premium } from '../common/decorators/premium.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(SupabaseAuthGuard, PremiumGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('usage-patterns')
  @Premium()
  async getUsagePatterns(@CurrentUser('uid') userId: string) {
    const patterns = await this.analyticsService.getUsagePatterns(userId);
    return {
      success: true,
      data: patterns,
      message: 'Usage patterns retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('expiration-forecast')
  async getExpirationForecast(
    @CurrentUser('uid') userId: string,
    @Query('days') days?: string,
  ) {
    const daysAhead = days ? parseInt(days, 10) : 90;
    const forecast = await this.analyticsService.getExpirationForecast(
      userId,
      daysAhead,
    );
    return {
      success: true,
      data: forecast,
      message: 'Expiration forecast retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('cost-tracking')
  async getCostTracking(@CurrentUser('uid') userId: string) {
    const costTracking = await this.analyticsService.getCostTracking(userId);
    return {
      success: true,
      data: costTracking,
      message: 'Cost tracking retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('compliance-trends')
  async getComplianceTrends(
    @CurrentUser('uid') userId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const trends = await this.analyticsService.getComplianceTrends(
      userId,
      limitNum,
    );
    return {
      success: true,
      data: trends,
      message: 'Compliance trends retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
