import { Module } from '@nestjs/common';
import { GoalsModule } from '../goals/goals.module';
import { HabitsModule } from '../habits/habits.module';
import { ReportsModule } from '../reports/reports.module';
import { TasksModule } from '../tasks/tasks.module';
import { DatabaseModule } from '../database.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [DatabaseModule, TasksModule, GoalsModule, HabitsModule, ReportsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
