import { Controller, Post, UseGuards, Req, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import type { Request } from 'express';

interface SupabaseUser {
  uid: string;
  email?: string;
  name?: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('create-or-update')
  @Throttle({ authSync: { limit: 20, ttl: 60000 } })
  @UseGuards(SupabaseAuthGuard)
  async createOrUpdateUser(
    @CurrentUser() user: SupabaseUser,
    @Req() request: Request,
  ) {
    const ip =
      request.ip ||
      request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      'unknown';
    const userAgent = (request.headers['user-agent'] || 'unknown').substring(
      0,
      80,
    );

    this.logger.log(
      `Auth sync attempt from ip=${ip} userAgent=${userAgent}`,
    );

    const userData = await this.authService.createOrUpdateUser(
      user.uid,
      user.email || '',
      user.name,
    );

    this.logger.log(`Auth sync successful from ip=${ip}`);

    return {
      success: true,
      data: userData,
      message: 'User created or updated successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
