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
import { SharingService } from './sharing.service';

@Controller('sharing')
@UseGuards(FirebaseAuthGuard, PremiumGuard)
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Post('kits/:kitId/share')
  async shareKit(
    @CurrentUser('uid') userId: string,
    @Param('kitId') kitId: string,
    @Body() body: { userId: string; permission: 'view' | 'edit' },
  ) {
    const share = await this.sharingService.shareKitWithUser(
      kitId,
      userId,
      body.userId,
      body.permission,
    );
    return {
      success: true,
      data: share,
      message: 'Kit shared successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('kits/:kitId/share-link')
  async createShareLink(
    @CurrentUser('uid') userId: string,
    @Param('kitId') kitId: string,
    @Body() body: { permission: 'view' | 'edit'; expiresInDays?: number },
  ) {
    const link = await this.sharingService.createShareLink(
      kitId,
      userId,
      body.permission,
      body.expiresInDays,
    );
    return {
      success: true,
      data: link,
      message: 'Share link created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('kits/shared')
  async getSharedKits(@CurrentUser('uid') userId: string) {
    const sharedKits = await this.sharingService.getSharedKits(userId);
    return {
      success: true,
      data: sharedKits,
      message: 'Shared kits retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('kits/:kitId/share/:shareId')
  async revokeShare(
    @CurrentUser('uid') userId: string,
    @Param('kitId') kitId: string,
    @Param('shareId') shareId: string,
  ) {
    await this.sharingService.revokeShare(kitId, userId, shareId);
    return {
      success: true,
      message: 'Share revoked successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('kits/:kitId/share-link/:linkId')
  async revokeShareLink(
    @CurrentUser('uid') userId: string,
    @Param('kitId') kitId: string,
    @Param('linkId') linkId: string,
  ) {
    await this.sharingService.revokeShareLink(kitId, userId, linkId);
    return {
      success: true,
      message: 'Share link revoked successfully',
      timestamp: new Date().toISOString(),
    };
  }
}


