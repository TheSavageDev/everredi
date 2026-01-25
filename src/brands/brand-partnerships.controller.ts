import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import {
  BrandPartnershipsService,
  BrandPartnership,
} from './brand-partnerships.service';

@Controller('brand-partnerships')
export class BrandPartnershipsController {
  constructor(
    private readonly brandPartnershipsService: BrandPartnershipsService,
  ) {}

  @Get()
  @UseGuards(SupabaseAuthGuard)
  async getPartnerships(@Query('categoryIds') categoryIds?: string) {
    const partnerships =
      await this.brandPartnershipsService.getActivePartnerships();
    return {
      success: true,
      data: partnerships,
      message: 'Brand partnerships retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('all')
  @UseGuards(SupabaseAuthGuard, AdminGuard)
  async getAllPartnerships() {
    const partnerships =
      await this.brandPartnershipsService.getAllPartnerships();
    return {
      success: true,
      data: partnerships,
      message: 'All brand partnerships retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  async getPartnership(@Param('id') id: string) {
    const partnership = await this.brandPartnershipsService.getPartnership(id);
    if (!partnership) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Brand partnership not found',
        },
        timestamp: new Date().toISOString(),
      };
    }
    return {
      success: true,
      data: partnership,
      message: 'Brand partnership retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @UseGuards(SupabaseAuthGuard, AdminGuard)
  async createPartnership(
    @Body()
    body: {
      brandName: string;
      logoUrl?: string;
      websiteUrl?: string;
      description?: string;
      categoryIds?: string[];
      isActive: boolean;
      partnershipType: 'featured' | 'recommended' | 'sponsor';
      priority: number;
      startDate: string;
      endDate?: string;
    },
  ) {
    const partnership = await this.brandPartnershipsService.createPartnership({
      ...body,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    } as any);
    return {
      success: true,
      data: partnership,
      message: 'Brand partnership created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @UseGuards(SupabaseAuthGuard, AdminGuard)
  async updatePartnership(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      brandName: string;
      logoUrl: string;
      websiteUrl: string;
      description: string;
      categoryIds: string[];
      isActive: boolean;
      partnershipType: 'featured' | 'recommended' | 'sponsor';
      priority: number;
      startDate: string;
      endDate: string;
    }>,
  ) {
    const updates: Partial<
      Omit<BrandPartnership, 'id' | 'createdAt' | 'updatedAt'>
    > = {
      ...body,
    } as Partial<Omit<BrandPartnership, 'id' | 'createdAt' | 'updatedAt'>>;
    if (body.startDate) {
      (updates as any).startDate = new Date(body.startDate);
    }
    if (body.endDate !== undefined) {
      (updates as any).endDate = body.endDate
        ? new Date(body.endDate)
        : undefined;
    }

    const partnership = await this.brandPartnershipsService.updatePartnership(
      id,
      updates,
    );
    return {
      success: true,
      data: partnership,
      message: 'Brand partnership updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard, AdminGuard)
  async deletePartnership(@Param('id') id: string) {
    await this.brandPartnershipsService.deletePartnership(id);
    return {
      success: true,
      message: 'Brand partnership deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
