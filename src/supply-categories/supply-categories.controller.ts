import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { SupplyCategoriesService } from './supply-categories.service';

@Controller('supply-categories')
@UseGuards(FirebaseAuthGuard)
export class SupplyCategoriesController {
  constructor(private readonly categoriesService: SupplyCategoriesService) {}

  @Get()
  async getCategories() {
    const categories = await this.categoriesService.getCategories();
    return {
      success: true,
      data: categories,
      message: 'Categories retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async getCategory(@Param('id') id: string) {
    const category = await this.categoriesService.getCategory(id);
    if (!category) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
        },
        timestamp: new Date().toISOString(),
      };
    }
    return {
      success: true,
      data: category,
      message: 'Category retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
