import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ok } from '../common/mappers';
import { SuppliesService } from './supplies.service';

@Controller()
@UseGuards(SupabaseAuthGuard)
export class SuppliesController {
  constructor(private readonly supplies: SuppliesService) {}

  @Get('supply-categories')
  async categories() {
    return ok(await this.supplies.categories());
  }

  @Get('supplies')
  async list(@Query('q') q?: string) {
    return ok(await this.supplies.list(q));
  }
}
