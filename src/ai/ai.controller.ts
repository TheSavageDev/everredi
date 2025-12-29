import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { PremiumGuard } from '../common/guards/premium.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiService } from './ai.service';
import type { AiRecommendationRequest } from './ai.service';
import { Premium } from '../common/decorators/premium.decorator';

interface CurrentUserPayload {
  uid: string;
}

@Controller('ai')
@UseGuards(FirebaseAuthGuard, PremiumGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('recommendations')
  @Premium()
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
  @Premium()
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
