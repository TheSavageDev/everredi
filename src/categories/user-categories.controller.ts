import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { PremiumGuard } from '../common/guards/premium.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserCategoriesService } from './user-categories.service';

@Controller('categories/user')
@UseGuards(FirebaseAuthGuard, PremiumGuard)
export class UserCategoriesController {
  constructor(private readonly userCategoriesService: UserCategoriesService) {}

  @Get()
  async getUserCategories(@CurrentUser('uid') userId: string) {
    const categories =
      await this.userCategoriesService.getUserCategories(userId);
    return {
      success: true,
      data: categories,
      message: 'User categories retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async getUserCategory(
    @CurrentUser('uid') userId: string,
    @Param('id') categoryId: string,
  ) {
    const category = await this.userCategoriesService.getUserCategory(
      userId,
      categoryId,
    );
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

  @Post()
  async createUserCategory(
    @CurrentUser('uid') userId: string,
    @Body()
    body: {
      name: string;
      description?: string;
      icon?: string;
      color?: string;
      order?: number;
    },
  ) {
    const category = await this.userCategoriesService.createUserCategory(
      userId,
      body,
    );
    return {
      success: true,
      data: category,
      message: 'Category created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  async updateUserCategory(
    @CurrentUser('uid') userId: string,
    @Param('id') categoryId: string,
    @Body()
    body: Partial<{
      name: string;
      description?: string;
      icon?: string;
      color?: string;
      order?: number;
    }>,
  ) {
    const category = await this.userCategoriesService.updateUserCategory(
      userId,
      categoryId,
      body,
    );
    return {
      success: true,
      data: category,
      message: 'Category updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  async deleteUserCategory(
    @CurrentUser('uid') userId: string,
    @Param('id') categoryId: string,
  ) {
    await this.userCategoriesService.deleteUserCategory(userId, categoryId);
    return {
      success: true,
      message: 'Category deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('reorder')
  async reorderCategories(
    @CurrentUser('uid') userId: string,
    @Body() body: { categoryIds: string[] },
  ) {
    await this.userCategoriesService.reorderCategories(
      userId,
      body.categoryIds,
    );
    return {
      success: true,
      message: 'Categories reordered successfully',
      timestamp: new Date().toISOString(),
    };
  }
}


