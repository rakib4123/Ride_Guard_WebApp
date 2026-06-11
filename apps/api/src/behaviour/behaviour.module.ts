import { Module } from '@nestjs/common';
import { BEHAVIOUR_SCORER } from './behaviour.scorer';
import { MockScorer } from './mock.scorer';
import { HttpScorer } from './http.scorer';

/**
 * Binds the active behaviour scorer. When MODEL_SERVICE_URL is set, the real
 * Tier-1 model (Python sidecar) is used via HttpScorer; otherwise the
 * transparent MockScorer. Either way the rest of the app is unchanged.
 */
@Module({
  providers: [
    MockScorer,
    HttpScorer,
    {
      provide: BEHAVIOUR_SCORER,
      useFactory: (http: HttpScorer, mock: MockScorer) =>
        process.env.MODEL_SERVICE_URL ? http : mock,
      inject: [HttpScorer, MockScorer],
    },
  ],
  exports: [BEHAVIOUR_SCORER],
})
export class BehaviourModule {}
