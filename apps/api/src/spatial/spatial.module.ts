import { Module } from '@nestjs/common';
import { SpatialController } from './spatial.controller';
import { SpatialService } from './spatial.service';

@Module({
  controllers: [SpatialController],
  providers: [SpatialService],
  exports: [SpatialService],
})
export class SpatialModule {}
