import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { createLocationSchema, updateLocationSchema } from '@everredi/validation';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ok } from '../common/mappers';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LocationsService } from './locations.service';

@Controller('locations')
@UseGuards(SupabaseAuthGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('workspaceId') workspaceId: string) {
    return ok(await this.locations.list(workspaceId, user.id));
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Query('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(createLocationSchema)) body: unknown,
  ) {
    return ok(await this.locations.create(workspaceId, user.id, body as never));
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLocationSchema)) body: unknown,
  ) {
    return ok(await this.locations.update(id, user.id, body as never));
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return ok(await this.locations.remove(id, user.id));
  }
}
