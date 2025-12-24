import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BulkOperationsService } from './bulk-operations.service';
import { PremiumGuard } from '../common/guards/premium.guard';

@Controller('bulk')
@UseGuards(FirebaseAuthGuard, PremiumGuard)
export class BulkOperationsController {
  constructor(private readonly bulkOperationsService: BulkOperationsService) {}

  @Post('import/inventory')
  async importInventory(
    @CurrentUser('uid') userId: string,
    @Body() body: { data: any[] | string },
  ) {
    let jsonData: any[];

    if (Array.isArray(body.data)) {
      jsonData = body.data;
    } else if (typeof body.data === 'string') {
      jsonData = JSON.parse(body.data);
    } else {
      throw new Error('No data provided');
    }

    const result = await this.bulkOperationsService.importInventoryFromJSON(
      userId,
      jsonData,
    );
    return {
      success: true,
      data: result,
      message: 'Import completed',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('export/inventory')
  async exportInventory(@CurrentUser('uid') userId: string) {
    const data = await this.bulkOperationsService.exportInventory(userId);
    return {
      success: true,
      data,
      message: 'Inventory exported successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('export/kits')
  async exportKits(@CurrentUser('uid') userId: string) {
    const data = await this.bulkOperationsService.exportKits(userId);
    return {
      success: true,
      data,
      message: 'Kits exported successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('update/inventory')
  async bulkUpdateInventory(
    @CurrentUser('uid') userId: string,
    @Body() body: { itemIds: string[]; updates: any },
  ) {
    const result = await this.bulkOperationsService.bulkUpdateInventory(
      userId,
      body,
    );
    return {
      success: true,
      data: result,
      message: 'Bulk update completed',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('duplicate-kit')
  async duplicateKit(
    @CurrentUser('uid') userId: string,
    @Body() body: { kitId: string; newName?: string },
  ) {
    const kit = await this.bulkOperationsService.duplicateKit(
      userId,
      body.kitId,
      body.newName,
    );
    return {
      success: true,
      data: kit,
      message: 'Kit duplicated successfully',
      timestamp: new Date().toISOString(),
    };
  }
}


