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
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InventoryService, InventoryItem } from './inventory.service';

@Controller('inventory')
@UseGuards(SupabaseAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getInventoryItems(
    @CurrentUser() user: { uid: string },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page != null ? parseInt(page, 10) : undefined;
    const pageSizeNum =
      pageSize != null ? Math.min(parseInt(pageSize, 10), 50) : undefined;

    if (
      pageNum != null &&
      !Number.isNaN(pageNum) &&
      pageSizeNum != null &&
      !Number.isNaN(pageSizeNum) &&
      pageNum >= 1 &&
      pageSizeNum >= 1
    ) {
      const result = await this.inventoryService.getInventoryItemsPaginated(
        user.uid,
        pageNum,
        pageSizeNum,
      );
      return {
        success: true,
        data: result.data,
        hasMore: result.hasMore,
        page: result.page,
        message: 'Inventory items retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    }

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
      quantity?: number; // Legacy field name - maps to actualQuantity
      actualQuantity?: number;
      requiredQuantity?: number;
      expirationDate?: string;
      purchaseDate?: string;
      purchasePrice?: number;
      supplier?: string;
      notes?: string;
      status?: string;
      lotCode?: string;
    }>,
  ) {
    // Map quantity to actualQuantity for backward compatibility
    // Also convert date strings to Date objects
    const mappedUpdates: any = { ...updates };
    if (
      updates.quantity !== undefined &&
      updates.actualQuantity === undefined
    ) {
      mappedUpdates.actualQuantity = updates.quantity;
      delete mappedUpdates.quantity;
    }

    // Convert date strings to Date objects if provided
    if (
      updates.expirationDate !== undefined &&
      typeof updates.expirationDate === 'string'
    ) {
      mappedUpdates.expirationDate = new Date(updates.expirationDate);
    }
    if (
      updates.purchaseDate !== undefined &&
      typeof updates.purchaseDate === 'string'
    ) {
      mappedUpdates.purchaseDate = new Date(updates.purchaseDate);
    }

    const item = await this.inventoryService.updateInventoryItem(
      user.uid,
      id,
      mappedUpdates as Partial<InventoryItem>,
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

  @Get('expired')
  async getExpiredItems(@CurrentUser() user: { uid: string }) {
    const items = await this.inventoryService.getExpiredItems(user.uid);
    return {
      success: true,
      data: items,
      message: 'Expired items retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('low-quantity')
  async getLowQuantityItems(
    @CurrentUser() user: { uid: string },
    @Query('threshold') threshold?: string,
  ) {
    const thresholdNum = threshold ? parseFloat(threshold) : 10;
    const items = await this.inventoryService.getLowQuantityItems(
      user.uid,
      thresholdNum,
    );
    return {
      success: true,
      data: items,
      message: 'Low quantity items retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async getInventoryItem(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
  ) {
    const item = await this.inventoryService.getInventoryItem(user.uid, id);
    return {
      success: true,
      data: item,
      message: 'Inventory item retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
