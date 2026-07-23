import { Controller, Get } from '@nestjs/common';
import { ok } from './common/mappers';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return ok({ status: 'ok' });
  }
}
