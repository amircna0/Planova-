import { Module } from '@nestjs/common';
import { GoalsModule } from '../goals/goals.module';
import { HabitsModule } from '../habits/habits.module';
import { TasksModule } from '../tasks/tasks.module';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [GoalsModule, HabitsModule, TasksModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
