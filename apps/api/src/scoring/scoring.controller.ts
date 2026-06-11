import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ScorePointRequestDto } from './dto/score-request.dto';
import { ScoreRouteRequestDto } from './dto/route-request.dto';
import { ScoringService } from './scoring.service';

@ApiTags('scoring')
@Controller('score')
export class ScoringController {
  constructor(private readonly scoring: ScoringService) {}

  @Post()
  @ApiOkResponse({ description: 'Fused risk for a single point.' })
  scorePoint(@Body() body: ScorePointRequestDto) {
    return this.scoring.scorePoint(body.features, body.location);
  }

  @Post('route')
  @ApiOkResponse({ description: 'Per-segment + aggregate risk for a route.' })
  scoreRoute(@Body() body: ScoreRouteRequestDto) {
    return this.scoring.scoreRoute(body.features, body.path);
  }
}
