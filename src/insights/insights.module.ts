import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { PlansModule } from '../plans/plans.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

@Module({
  imports: [DatabaseModule, PlansModule],
  controllers: [InsightsController],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}
