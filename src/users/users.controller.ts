import { Controller, Get, Post, Put, UseGuards, Body } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getCurrentUser(@CurrentUser() user: any) {
    const userData = await this.usersService.getUserById(user.uid);
    return {
      success: true,
      data: userData,
      message: 'User retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Put('me')
  async updateCurrentUser(@CurrentUser() user: any, @Body() updates: any) {
    const userData = await this.usersService.updateUser(user.uid, updates);
    return {
      success: true,
      data: userData,
      message: 'User updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('me/subscription')
  async getSubscriptionStatus(@CurrentUser() user: any) {
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
    @CurrentUser() user: any,
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
  async getReferralStats(@CurrentUser() user: any) {
    const stats = await this.usersService.getReferralStats(user.uid);
    return {
      success: true,
      data: stats,
      message: 'Referral stats retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
