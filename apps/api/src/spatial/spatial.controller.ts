import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SpatialService } from './spatial.service';

@ApiTags('spatial')
@Controller('hotspots')
export class SpatialController {
  constructor(private readonly spatial: SpatialService) {}

  @Get()
  @ApiOkResponse({ description: 'Crash grids per region, and the busiest cells for the map.' })
  getHotspots() {
    return {
      source: this.spatial.getSource(),
      hotspots: this.spatial.getHotspots(),
      regions: this.spatial.getRegions(),
    };
  }
}
