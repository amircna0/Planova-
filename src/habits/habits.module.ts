import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { HabitsController } from './habits.controller';
import { HabitsService } from './habits.service';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [DatabaseModule, PlansModule],
  controllers: [HabitsController],
  providers: [HabitsService],
  exports: [HabitsService],
})
export class HabitsModule {}
