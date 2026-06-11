import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SpatialService } from './spatial.service';

@ApiTags('spatial')
@Controller('hotspots')
export class SpatialController {
  constructor(private readonly spatial: SpatialService) {}

  @Get()
  @ApiOkResponse({ description: 'Dhaka hotspot points for the map heat layer.' })
  getHotspots() {
    return {
      source: this.spatial.getSource(),
      hotspots: this.spatial.getHotspots(),
    };
  }
}
