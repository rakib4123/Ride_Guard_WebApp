import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';
import type { CreateTripInput } from '@rideguard/shared';

/**
 * The client posts a trip per the Section 10 schema minus the server-assigned
 * fields. We validate the few fields we depend on and accept the nested
 * structure as-is (kept permissive so the schema can evolve without breaking
 * collection); the server stamps ids, hashing, and versions.
 */
export class CreateTripDto implements CreateTripInput {
  @ApiProperty({ description: 'Raw rider id; hashed before storage.' })
  @IsString()
  rider_id!: string;

  @ApiProperty() @IsString() app_version!: string;

  @ApiProperty() @IsObject() consent!: CreateTripInput['consent'];
  @ApiProperty() @IsObject() trip!: CreateTripInput['trip'];
  @ApiProperty() @IsObject() context!: CreateTripInput['context'];
  @ApiProperty() @IsObject() prediction!: CreateTripInput['prediction'];
  @ApiProperty() @IsObject() outcome!: CreateTripInput['outcome'];
  @ApiProperty() @IsObject() response!: CreateTripInput['response'];
}
