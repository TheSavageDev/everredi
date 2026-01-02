import { Controller, Post, UseGuards, Req, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import type { Request } from 'express';

interface FirebaseUser {
  uid: string;
  email?: string;
  name?: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('create-or-update')
  @UseGuards(FirebaseAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 3600000 } }) // 20 requests per hour (more restrictive than default)
  async createOrUpdateUser(
    @CurrentUser() user: FirebaseUser,
    @Req() request: Request,
  ) {
    // Log auth attempt for security monitoring
    const ip =
      request.ip ||
      request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      'unknown';
    const timestamp = new Date().toISOString();
    const userAgent = request.headers['user-agent'] || 'unknown';
    
    this.logger.log(
      `[${timestamp}] 🔐 POST /api/auth/create-or-update - Auth sync attempt: user=${user.uid}, email=${user.email || 'no-email'}, ip=${ip}, userAgent=${userAgent.substring(0, 50)}`,
    );

    const userData = await this.authService.createOrUpdateUser(
      user.uid,
      user.email || '',
      user.name,
    );

    this.logger.log(
      `[${new Date().toISOString()}] ✅ Auth sync successful: user=${user.uid}, email=${user.email || 'no-email'}`,
    );

    return {
      success: true,
      data: userData,
      message: 'User created or updated successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
