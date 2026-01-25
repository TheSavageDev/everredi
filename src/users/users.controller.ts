import {
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(SupabaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getCurrentUser(@CurrentUser() user: { uid: string }) {
    const userData = await this.usersService.getUserById(user.uid);
    return {
      success: true,
      data: userData,
      message: 'User retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Put('me')
  async updateCurrentUser(
    @CurrentUser() user: { uid: string },
    @Body() updates: Partial<{ displayName?: string; avatarUrl?: string }>,
  ) {
    const userData = await this.usersService.updateUser(user.uid, updates);
    return {
      success: true,
      data: userData,
      message: 'User updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('me/subscription')
  async getSubscriptionStatus(@CurrentUser() user: { uid: string }) {
    const status = await this.usersService.getSubscriptionStatus(user.uid);
    return {
      success: true,
      data: status,
      message: 'Subscription status retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('me/referral/apply')
  async applyReferralCode(
    @CurrentUser() user: { uid: string },
    @Body() body: { referralCode: string },
  ) {
    const result = await this.usersService.applyReferralCode(
      user.uid,
      body.referralCode,
    );
    return {
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('me/referral/stats')
  async getReferralStats(@CurrentUser() user: { uid: string }) {
    const stats = await this.usersService.getReferralStats(user.uid);
    return {
      success: true,
      data: stats,
      message: 'Referral stats retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('search')
  async searchUser(@Query('email') email: string) {
    if (!email || !email.trim()) {
      throw new BadRequestException('Email query parameter is required');
    }

    const user = await this.usersService.searchUserByEmail(email.trim());

    if (!user) {
      return {
        success: false,
        message: 'User not found',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      data: user,
      message: 'User found successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
