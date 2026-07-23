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
  createFromTemplateSchema,
  createKitSchema,
  updateKitSchema,
} from '@everredi/validation';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ok } from '../common/mappers';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { KitsService } from './kits.service';

@Controller('kits')
@UseGuards(SupabaseAuthGuard)
export class KitsController {
  constructor(private readonly kits: KitsService) {}

  @Get('templates')
  async templates() {
    return ok(await this.kits.templates());
  }

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('workspaceId') workspaceId: string) {
    return ok(await this.kits.list(workspaceId, user.id));
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return ok(await this.kits.get(id, user.id));
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Query('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(createKitSchema)) body: unknown,
  ) {
    return ok(await this.kits.create(workspaceId, user.id, body as never));
  }

  @Post('from-template')
  async fromTemplate(
    @CurrentUser() user: AuthUser,
    @Query('workspaceId') workspaceId: string,
    @Body(new ZodValidationPipe(createFromTemplateSchema)) body: unknown,
  ) {
    return ok(await this.kits.createFromTemplate(workspaceId, user.id, body as never));
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateKitSchema)) body: unknown,
  ) {
    return ok(await this.kits.update(id, user.id, body as never));
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return ok(await this.kits.remove(id, user.id));
  }
}
