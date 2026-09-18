import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { PlansModule } from '../plans/plans.module';
import { TasksModule } from '../tasks/tasks.module';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';

@Module({
  imports: [DatabaseModule, PlansModule, TasksModule],
  controllers: [CopilotController],
  providers: [CopilotService],
})
export class CopilotModule {}
