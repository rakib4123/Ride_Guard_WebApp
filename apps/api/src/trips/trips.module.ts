import { Module } from '@nestjs/common';
import { FileTripsRepository } from './file-trips.repository';
import { TRIPS_REPOSITORY } from './trips.repository';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  controllers: [TripsController],
  providers: [
    TripsService,
    { provide: TRIPS_REPOSITORY, useClass: FileTripsRepository },
  ],
})
export class TripsModule {}
