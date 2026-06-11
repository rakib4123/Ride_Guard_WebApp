import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MODEL_VERSION } from '@rideguard/shared';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      modelVersion: MODEL_VERSION,
      scorer: process.env.MODEL_SERVICE_URL ? 'tier1-model' : 'placeholder',
      modelService: process.env.MODEL_SERVICE_URL ?? null,
      time: new Date().toISOString(),
    };
  }
}
