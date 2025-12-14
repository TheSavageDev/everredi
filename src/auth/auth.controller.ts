import { Controller, Post, UseGuards, Body } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('create-or-update')
  @UseGuards(FirebaseAuthGuard)
  async createOrUpdateUser(@CurrentUser() user: any) {
    const userData = await this.authService.createOrUpdateUser(
      user.uid,
      user.email,
      user.name,
    );
    return {
      success: true,
      data: userData,
      message: 'User created or updated successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
