import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { UsersService } from './users.service';

@Controller('admin/users')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const limitNum = Math.min(
      Math.max(parseInt(limit || '50', 10) || 50, 1),
      100,
    );
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    const users = await this.usersService.listUsers({
      limit: limitNum,
      offset,
      emailSearch: search?.trim() || undefined,
    });

    return {
      success: true,
      data: users,
      message: 'Users retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    const user = await this.usersService.getUserById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      success: true,
      data: user,
      message: 'User retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: Partial<{ isAdmin?: boolean; isActive?: boolean }>,
  ) {
    const existing = await this.usersService.getUserById(id);
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const user = await this.usersService.updateUser(id, {
      ...(body.isAdmin !== undefined && { isAdmin: body.isAdmin }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    });

    return {
      success: true,
      data: user,
      message: 'User updated successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
