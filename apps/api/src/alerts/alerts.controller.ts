import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CronSecretGuard } from '../common/guards/cron-secret.guard';
import { ok } from '../common/mappers';
import { AlertsService } from './alerts.service';

@Controller('internal')
@SkipThrottle()
@UseGuards(CronSecretGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  /** Vercel Cron (and manual) entrypoint — scans every workspace. */
  @Get('cron/alerts')
  async cronAlerts(@Query('withinDays') withinDays?: string) {
    return ok(
      await this.alerts.runForAllWorkspaces(
        withinDays ? Number(withinDays) : 30,
      ),
    );
  }

  @Get('alerts/workspaces')
  async listWorkspaces() {
    return ok({ workspaceIds: await this.alerts.listWorkspaceIds() });
  }

  /** Per-workspace processor for Queues / Workflow fan-out. */
  @Post('alerts/workspaces/:workspaceId')
  async processWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Query('withinDays') withinDays?: string,
  ) {
    return ok(
      await this.alerts.runForWorkspace(
        workspaceId,
        withinDays ? Number(withinDays) : 30,
      ),
    );
  }
}
