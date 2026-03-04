import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { SuppliesService } from './supplies.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';

@Controller('supplies')
@UseGuards(SupabaseAuthGuard)
export class SuppliesController {
  constructor(
    private readonly suppliesService: SuppliesService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async getSupplies(
    @CurrentUser('uid') userId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const subscriptionStatus =
      await this.usersService.getSubscriptionStatus(userId);
    const isPremium = subscriptionStatus.isPremium;

    const supplies = await this.suppliesService.getSupplies(
      userId,
      isPremium,
      categoryId,
    );
    return {
      success: true,
      data: supplies,
      message: 'Supplies retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('search')
  async searchSupplies(
    @Query('term') term: string,
    @CurrentUser('uid') userId: string,
  ) {
    if (!term) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search term is required',
        },
        timestamp: new Date().toISOString(),
      };
    }

    const subscriptionStatus =
      await this.usersService.getSubscriptionStatus(userId);
    const isPremium = subscriptionStatus.isPremium;

    const supplies = await this.suppliesService.searchSupplies(
      term,
      userId,
      isPremium,
    );
    return {
      success: true,
      data: supplies,
      message: 'Search completed successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async getSupply(@Param('id') id: string, @CurrentUser('uid') userId: string) {
    const subscriptionStatus =
      await this.usersService.getSubscriptionStatus(userId);
    const isPremium = subscriptionStatus.isPremium;

    const supply = await this.suppliesService.getSupply(id, userId, isPremium);
    if (!supply) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Supply not found',
        },
        timestamp: new Date().toISOString(),
      };
    }
    return {
      success: true,
      data: supply,
      message: 'Supply retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @UseGuards(SupabaseAuthGuard, AdminGuard)
  async updateSupply(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      isSponsored: boolean;
      sponsoredBy: string;
      sponsoredUntil: string;
      sponsoredPriority: number;
    }>,
  ) {
    const supply = await this.suppliesService.updateSupply(id, body);
    return {
      success: true,
      data: supply,
      message: 'Supply updated successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
