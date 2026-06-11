import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsObject, ValidateNested } from 'class-validator';
import { FeatureVectorDto, LatLonDto } from './score-request.dto';

export class ScoreRouteRequestDto {
  @ApiProperty({ type: FeatureVectorDto })
  @IsObject() @ValidateNested() @Type(() => FeatureVectorDto)
  features!: FeatureVectorDto;

  @ApiProperty({ type: [LatLonDto], description: 'Polyline; at least origin + destination.' })
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => LatLonDto)
  path!: LatLonDto[];
}
