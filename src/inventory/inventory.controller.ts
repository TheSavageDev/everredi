import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InventoryService, InventoryItem } from './inventory.service';

@Controller('inventory')
@UseGuards(FirebaseAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getInventoryItems(@CurrentUser() user: { uid: string }) {
    const items = await this.inventoryService.getInventoryItems(user.uid);
    return {
      success: true,
      data: items,
      message: 'Inventory items retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  async createInventoryItem(
    @CurrentUser() user: { uid: string },
    @Body()
    itemData: Partial<{
      supplyId?: string;
      supplyName?: string;
      supplyCategoryId?: string;
      locationId?: string;
      quantity?: number;
      expirationDate?: string;
      purchaseDate?: string;
      purchasePrice?: number;
      supplier?: string;
      notes?: string;
      status?: string;
    }>,
  ) {
    const item = await this.inventoryService.createInventoryItem(
      user.uid,
      itemData as Omit<
        InventoryItem,
        'id' | 'updatedAt' | 'createdAt' | 'userId' | 'sentNotifications'
      >,
    );
    return {
      success: true,
      data: item,
      message: 'Inventory item created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id')
  async updateInventoryItem(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
    @Body()
    updates: Partial<{
      supplyId?: string;
      supplyName?: string;
      supplyCategoryId?: string;
      locationId?: string;
      quantity?: number;
      expirationDate?: string;
      purchaseDate?: string;
      purchasePrice?: number;
      supplier?: string;
      notes?: string;
      status?: string;
    }>,
  ) {
    const item = await this.inventoryService.updateInventoryItem(
      user.uid,
      id,
      updates as Partial<InventoryItem>,
    );
    return {
      success: true,
      data: item,
      message: 'Inventory item updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  async deleteInventoryItem(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
  ) {
    await this.inventoryService.deleteInventoryItem(user.uid, id);
    return {
      success: true,
      message: 'Inventory item deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('search')
  async searchInventoryItems(
    @CurrentUser() user: { uid: string },
    @Query('term') term: string,
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
    const items = await this.inventoryService.searchInventoryItems(
      user.uid,
      term,
    );
    return {
      success: true,
      data: items,
      message: 'Search completed successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('expiring')
  async getExpiringItems(
    @CurrentUser() user: { uid: string },
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : undefined;
    const items = await this.inventoryService.getExpiringItems(
      user.uid,
      daysNum,
    );
    return {
      success: true,
      data: items,
      message: 'Expiring items retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
