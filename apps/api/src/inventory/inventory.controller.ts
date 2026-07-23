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
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
} from '@everredi/validation';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ok } from '../common/mappers';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(SupabaseAuthGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('workspaceId') workspaceId: string,
    @Query('kitId') kitId?: string,
  ) {
    return ok(await this.inventory.list(workspaceId, user.id, kitId));
  }

  @Get('expiring')
  async expiring(
    @CurrentUser() user: AuthUser,
    @Query('workspaceId') workspaceId: string,
    @Query('withinDays') withinDays?: string,
  ) {
    return ok(
      await this.inventory.expiring(
        workspaceId,
        user.id,
        withinDays ? Number(withinDays) : 30,
      ),
    );
  }

  @Get('low-stock')
  async lowStock(
    @CurrentUser() user: AuthUser,
    @Query('workspaceId') workspaceId: string,
  ) {
    return ok(await this.inventory.lowStock(workspaceId, user.id));
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Query('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(createInventoryItemSchema)) body: unknown,
  ) {
    return ok(await this.inventory.create(workspaceId, user.id, body as never));
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInventoryItemSchema)) body: unknown,
  ) {
    return ok(await this.inventory.update(id, user.id, body as never));
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return ok(await this.inventory.remove(id, user.id));
  }
}
