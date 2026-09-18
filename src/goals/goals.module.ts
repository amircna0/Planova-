import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [DatabaseModule, PlansModule],
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
