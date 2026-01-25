import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LocationsService, Location } from './locations.service';

@Controller('locations')
@UseGuards(SupabaseAuthGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  async getLocations(@CurrentUser() user: { uid: string }) {
    const locations = await this.locationsService.getLocations(user.uid);
    return {
      success: true,
      data: locations,
      message: 'Locations retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  async createLocation(
    @CurrentUser() user: { uid: string },
    @Body()
    locationData: Partial<{
      name: string;
      description?: string;
      locationType?: string;
      address?: string;
      coordinates?: { latitude: number; longitude: number };
    }>,
  ) {
    const location = await this.locationsService.createLocation(
      user.uid,
      locationData as Omit<
        Location,
        'id' | 'updatedAt' | 'createdAt' | 'userId'
      >,
    );
    return {
      success: true,
      data: location,
      message: 'Location created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id')
  async updateLocation(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
    @Body()
    updates: Partial<{
      name?: string;
      description?: string;
      locationType?: string;
      address?: string;
      coordinates?: { latitude: number; longitude: number };
    }>,
  ) {
    const location = await this.locationsService.updateLocation(
      user.uid,
      id,
      updates as Partial<Location>,
    );
    return {
      success: true,
      data: location,
      message: 'Location updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  async deleteLocation(
    @CurrentUser() user: { uid: string },
    @Param('id') id: string,
  ) {
    await this.locationsService.deleteLocation(user.uid, id);
    return {
      success: true,
      message: 'Location deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
