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
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(FirebaseAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getInventoryItems(@CurrentUser() user: any) {
    const items = await this.inventoryService.getInventoryItems(user.uid);
    return {
      success: true,
      data: items,
      message: 'Inventory items retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  async createInventoryItem(@CurrentUser() user: any, @Body() itemData: any) {
    const item = await this.inventoryService.createInventoryItem(
      user.uid,
      itemData,
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
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updates: any,
  ) {
    const item = await this.inventoryService.updateInventoryItem(
      user.uid,
      id,
      updates,
    );
    return {
      success: true,
      data: item,
      message: 'Inventory item updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  async deleteInventoryItem(@CurrentUser() user: any, @Param('id') id: string) {
    await this.inventoryService.deleteInventoryItem(user.uid, id);
    return {
      success: true,
      message: 'Inventory item deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('search')
  async searchInventoryItems(
    @CurrentUser() user: any,
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
    @CurrentUser() user: any,
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
