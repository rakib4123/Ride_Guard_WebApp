import { Module } from '@nestjs/common';
import { BehaviourModule } from '../behaviour/behaviour.module';
import { SpatialModule } from '../spatial/spatial.module';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';

@Module({
  imports: [BehaviourModule, SpatialModule],
  controllers: [ScoringController],
  providers: [ScoringService],
})
export class ScoringModule {}
