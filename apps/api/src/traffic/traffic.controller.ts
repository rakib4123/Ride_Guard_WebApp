import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';
import { LatLonDto } from '../scoring/dto/score-request.dto';
import { TrafficService } from './traffic.service';

class TrafficRouteRequestDto {
  @ApiProperty({ type: LatLonDto })
  @IsObject() @ValidateNested() @Type(() => LatLonDto)
  origin!: LatLonDto;

  @ApiProperty({ type: LatLonDto })
  @IsObject() @ValidateNested() @Type(() => LatLonDto)
  destination!: LatLonDto;
}

@ApiTags('traffic')
@Controller('traffic')
export class TrafficController {
  constructor(private readonly traffic: TrafficService) {}

  @Post('route')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Live-traffic route, or available:false when Google is off.' })
  route(@Body() body: TrafficRouteRequestDto) {
    return this.traffic.route(body.origin, body.destination);
  }
}
