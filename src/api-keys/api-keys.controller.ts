import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { PremiumGuard } from '../common/guards/premium.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiKeysService } from './api-keys.service';

@Controller('api-keys')
@UseGuards(FirebaseAuthGuard, PremiumGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  async generateApiKey(
    @CurrentUser('uid') userId: string,
    @Body() body: { name: string; expiresInDays?: number },
  ) {
    const { key, apiKey } = await this.apiKeysService.generateApiKey(
      userId,
      body.name,
      body.expiresInDays,
    );
    return {
      success: true,
      data: {
        ...apiKey,
        key, // Only returned once on creation
      },
      message: 'API key generated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  async getApiKeys(@CurrentUser('uid') userId: string) {
    const keys = await this.apiKeysService.getApiKeys(userId);
    return {
      success: true,
      data: keys,
      message: 'API keys retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  async revokeApiKey(
    @CurrentUser('uid') userId: string,
    @Param('id') keyId: string,
  ) {
    await this.apiKeysService.revokeApiKey(userId, keyId);
    return {
      success: true,
      message: 'API key revoked successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/usage')
  async getApiKeyUsage(
    @CurrentUser('uid') userId: string,
    @Param('id') keyId: string,
  ) {
    const usage = await this.apiKeysService.getApiKeyUsage(userId, keyId);
    return {
      success: true,
      data: usage,
      message: 'API key usage retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }
}


