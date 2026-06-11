import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BehaviourModule } from './behaviour/behaviour.module';
import { SpatialModule } from './spatial/spatial.module';
import { ScoringModule } from './scoring/scoring.module';
import { TripsModule } from './trips/trips.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BehaviourModule,
    SpatialModule,
    ScoringModule,
    TripsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
