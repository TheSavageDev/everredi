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
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LocationsService } from './locations.service';

@Controller('locations')
@UseGuards(FirebaseAuthGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  async getLocations(@CurrentUser() user: any) {
    const locations = await this.locationsService.getLocations(user.uid);
    return {
      success: true,
      data: locations,
      message: 'Locations retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  async createLocation(@CurrentUser() user: any, @Body() locationData: any) {
    const location = await this.locationsService.createLocation(
      user.uid,
      locationData,
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
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updates: any,
  ) {
    const location = await this.locationsService.updateLocation(
      user.uid,
      id,
      updates,
    );
    return {
      success: true,
      data: location,
      message: 'Location updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  async deleteLocation(@CurrentUser() user: any, @Param('id') id: string) {
    await this.locationsService.deleteLocation(user.uid, id);
    return {
      success: true,
      message: 'Location deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
