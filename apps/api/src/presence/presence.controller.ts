import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import type { PresenceUpdate } from '@rideguard/shared';
import { PresenceService } from './presence.service';

class PresenceUpdateDto implements PresenceUpdate {
  @ApiProperty({ description: 'Random per-session id the client rotates; never an account id.' })
  @IsUUID() sessionId!: string;
  @ApiProperty() @IsNumber() @Min(-90) @Max(90) lat!: number;
  @ApiProperty() @IsNumber() @Min(-180) @Max(180) lon!: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(300) speedKmh!: number;
  @ApiProperty({ nullable: true }) @IsOptional() @IsNumber() @Min(0) @Max(360) headingDeg!: number | null;
  @ApiProperty() @IsNumber() @Min(0) @Max(100_000) accuracyM!: number;
}

@ApiTags('presence')
@Controller('presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Post()
  @HttpCode(200)
  @ApiOkResponse({ description: 'RideGuard riders around you, grouped into vehicles.' })
  update(@Body() body: PresenceUpdateDto) {
    return this.presence.update({ ...body, headingDeg: body.headingDeg ?? null });
  }
}
