import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { PremiumGuard } from '../common/guards/premium.guard';
import { Premium } from '../common/decorators/premium.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SharingService } from './sharing.service';

@Controller('sharing')
@UseGuards(SupabaseAuthGuard, PremiumGuard)
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Post('kits/:kitId/share')
  @Premium()
  async shareKit(
    @CurrentUser('uid') userId: string,
    @Param('kitId') kitId: string,
    @Body() body: { userId: string; permission: 'view' | 'edit' },
  ) {
    if (!kitId || !kitId.trim()) {
      throw new BadRequestException('Kit ID is required');
    }

    if (!body.userId || !body.userId.trim()) {
      throw new BadRequestException('User ID is required');
    }

    if (!body.permission || !['view', 'edit'].includes(body.permission)) {
      throw new BadRequestException(
        'Permission must be either "view" or "edit"',
      );
    }

    const share = await this.sharingService.shareKitWithUser(
      kitId.trim(),
      userId,
      body.userId.trim(),
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
    if (!kitId || !kitId.trim()) {
      throw new BadRequestException('Kit ID is required');
    }

    if (!body.permission || !['view', 'edit'].includes(body.permission)) {
      throw new BadRequestException(
        'Permission must be either "view" or "edit"',
      );
    }

    const link = await this.sharingService.createShareLink(
      kitId.trim(),
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

  @Get('kits/:kitId/permission')
  async getKitPermission(
    @CurrentUser('uid') userId: string,
    @Param('kitId') kitId: string,
  ) {
    const permission = await this.sharingService.getKitSharePermission(
      kitId.trim(),
      userId,
    );

    if (!permission) {
      return {
        success: false,
        message: 'Kit not found or not accessible',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      data: permission,
      message: 'Kit permission retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('kits/:kitId/shares')
  async getKitShares(
    @CurrentUser('uid') userId: string,
    @Param('kitId') kitId: string,
  ) {
    if (!kitId || !kitId.trim()) {
      throw new BadRequestException('Kit ID is required');
    }

    // Verify user owns the kit
    const permission = await this.sharingService.getKitSharePermission(
      kitId.trim(),
      userId,
    );

    if (!permission || !permission.isOwner) {
      throw new BadRequestException('Only kit owners can view shares');
    }

    const shares = await this.sharingService.getKitShares(kitId.trim(), userId);
    return {
      success: true,
      data: shares,
      message: 'Kit shares retrieved successfully',
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

  @Delete('kits/:kitId/shared-with-me')
  async removeSharedKit(
    @CurrentUser('uid') userId: string,
    @Param('kitId') kitId: string,
  ) {
    if (!kitId || !kitId.trim()) {
      throw new BadRequestException('Kit ID is required');
    }

    await this.sharingService.removeSharedKit(kitId.trim(), userId);
    return {
      success: true,
      message: 'Shared kit removed successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
