import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { SuppliesService } from './supplies.service';

@Controller('supplies')
@UseGuards(FirebaseAuthGuard)
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Get()
  async getSupplies(@Query('categoryId') categoryId?: string) {
    const supplies = await this.suppliesService.getSupplies(categoryId);
    return {
      success: true,
      data: supplies,
      message: 'Supplies retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('search')
  async searchSupplies(@Query('term') term: string) {
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
    const supplies = await this.suppliesService.searchSupplies(term);
    return {
      success: true,
      data: supplies,
      message: 'Search completed successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async getSupply(@Param('id') id: string) {
    const supply = await this.suppliesService.getSupply(id);
    if (!supply) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Supply not found',
        },
        timestamp: new Date().toISOString(),
      };
    }
    return {
      success: true,
      data: supply,
      message: 'Supply retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
