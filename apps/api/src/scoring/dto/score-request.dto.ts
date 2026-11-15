import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsIn, IsInt, IsNumber, IsObject, Max, Min, ValidateNested,
} from 'class-validator';
import type {
  Area, FeatureVector, Frequency, LatLon, RoadCondition, RoadType, TimeOfDay, Weather,
} from '@rideguard/shared';
import {
  AREAS, FREQUENCIES, ROAD_CONDITIONS, ROAD_TYPES, TIMES_OF_DAY, WEATHERS,
} from '@rideguard/shared';

export class LatLonDto implements LatLon {
  @ApiProperty() @IsNumber() @Min(-90) @Max(90) lat!: number;
  @ApiProperty() @IsNumber() @Min(-180) @Max(180) lon!: number;
}

/** The measured inputs (no rider questions). The models clamp them to their training ranges. */
export class FeatureVectorDto implements FeatureVector {
  @ApiProperty() @IsNumber() @Min(0) @Max(300) Bike_Speed!: number;
  @ApiProperty() @IsInt() @Min(20) @Max(120) Speed_Limit!: number;
  @ApiProperty() @IsIn(FREQUENCIES) Talk_While_Riding!: Frequency;
  @ApiProperty() @IsIn(WEATHERS) Weather!: Weather;
  @ApiProperty() @IsIn(ROAD_CONDITIONS) Road_condition!: RoadCondition;
  @ApiProperty() @IsIn(TIMES_OF_DAY) Time_of_Day!: TimeOfDay;
  @ApiProperty() @IsIn(ROAD_TYPES) Road_Type!: RoadType;
  @ApiProperty() @IsInt() @Min(1) @Max(8) Traffic_Density!: number;
  @ApiProperty() @IsBoolean() Is_Dark!: boolean;
  @ApiProperty() @IsIn(AREAS) Area!: Area;
}

export class ScorePointRequestDto {
  @ApiProperty({ type: FeatureVectorDto })
  @IsObject() @ValidateNested() @Type(() => FeatureVectorDto)
  features!: FeatureVectorDto;

  @ApiProperty({ type: LatLonDto })
  @IsObject() @ValidateNested() @Type(() => LatLonDto)
  location!: LatLonDto;
}
