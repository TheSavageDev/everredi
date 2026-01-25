import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiService } from './ai.service';
import type { AiRecommendationRequest } from './ai.service';

interface CurrentUserPayload {
  uid: string;
}

@Controller('ai')
@UseGuards(SupabaseAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('recommendations')
  async getRecommendation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() request: AiRecommendationRequest,
  ) {
    const recommendation = await this.aiService.generateRecommendation(
      user.uid,
      request,
    );
    return {
      success: true,
      data: recommendation,
      message: 'Recommendation generated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('recommendations')
  async getRecommendations(@CurrentUser() user: CurrentUserPayload) {
    const recommendations = await this.aiService.getRecommendations(user.uid);
    return {
      success: true,
      data: recommendations,
      message: 'Recommendations retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
