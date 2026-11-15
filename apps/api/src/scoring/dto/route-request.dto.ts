import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsObject, ValidateNested } from 'class-validator';
import { ROUTE_MAX_POINTS } from '@rideguard/shared';
import { FeatureVectorDto, LatLonDto } from './score-request.dto';

export class ScoreRouteRequestDto {
  @ApiProperty({ type: FeatureVectorDto })
  @IsObject() @ValidateNested() @Type(() => FeatureVectorDto)
  features!: FeatureVectorDto;

  @ApiProperty({ type: [LatLonDto], description: `Polyline; origin + destination, at most ${ROUTE_MAX_POINTS} points.` })
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(ROUTE_MAX_POINTS)
  @ValidateNested({ each: true }) @Type(() => LatLonDto)
  path!: LatLonDto[];
}
