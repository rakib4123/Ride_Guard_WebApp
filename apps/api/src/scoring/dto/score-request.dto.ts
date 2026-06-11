import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn, IsInt, IsNumber, IsObject, Max, Min, ValidateNested,
} from 'class-validator';
import type {
  FeatureVector, LatLon, Occupation, EducationLevel, Ownership, YesNo,
  BikeCondition, RoadType, RoadCondition, Frequency, Weather, TimeOfDay,
  AlcoholFlag,
} from '@rideguard/shared';
import {
  OCCUPATIONS, EDUCATION_LEVELS, FREQUENCIES, OWNERSHIPS, BIKE_CONDITIONS,
  ROAD_TYPES, ROAD_CONDITIONS, WEATHERS, TIMES_OF_DAY,
} from '@rideguard/shared';

export class LatLonDto implements LatLon {
  @ApiProperty() @IsNumber() @Min(-90) @Max(90) lat!: number;
  @ApiProperty() @IsNumber() @Min(-180) @Max(180) lon!: number;
}

const YESNO: YesNo[] = ['Yes', 'No'];

/** Validates the 19-feature vector against the trained model's domains. */
export class FeatureVectorDto implements FeatureVector {
  @ApiProperty() @IsInt() @Min(10) @Max(100) Biker_Age!: number;
  @ApiProperty() @IsIn(OCCUPATIONS) Biker_Occupation!: Occupation;
  @ApiProperty() @IsIn(EDUCATION_LEVELS) Biker_Education_Level!: EducationLevel;
  @ApiProperty() @IsNumber() @Min(0) @Max(80) Riding_Experience!: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(1000) Daily_Travel_Distance!: number;
  @ApiProperty() @IsIn(OWNERSHIPS) Motorcycle_Ownership!: Ownership;
  @ApiProperty() @IsIn(YESNO) Valid_Driving_License!: YesNo;
  @ApiProperty() @IsIn(BIKE_CONDITIONS) Bike_Condition!: BikeCondition;

  @ApiProperty() @IsIn(FREQUENCIES) Talk_While_Riding!: Frequency;
  @ApiProperty() @IsIn(FREQUENCIES) Smoke_While_Riding!: Frequency;
  @ApiProperty() @IsIn(YESNO) Wearing_Helmet!: YesNo;
  @ApiProperty() @IsIn([0, 1]) Biker_Alcohol!: AlcoholFlag;
  @ApiProperty() @IsIn(ROAD_TYPES) Road_Type!: RoadType;
  @ApiProperty() @IsIn(ROAD_CONDITIONS) Road_condition!: RoadCondition;
  @ApiProperty() @IsInt() @Min(1) @Max(8) Traffic_Density!: number;
  @ApiProperty() @IsInt() @Min(20) @Max(120) Speed_Limit!: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(300) Bike_Speed!: number;

  @ApiProperty() @IsIn(WEATHERS) Weather!: Weather;
  @ApiProperty() @IsIn(TIMES_OF_DAY) Time_of_Day!: TimeOfDay;
}

export class ScorePointRequestDto {
  @ApiProperty({ type: FeatureVectorDto })
  @IsObject() @ValidateNested() @Type(() => FeatureVectorDto)
  features!: FeatureVectorDto;

  @ApiProperty({ type: LatLonDto })
  @IsObject() @ValidateNested() @Type(() => LatLonDto)
  location!: LatLonDto;
}
