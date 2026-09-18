import { Module } from '@nestjs/common';
import { PlannerService } from './planner.service';
import { PlannerController } from './planner.controller';
import { DatabaseModule } from '../database.module';

@Module({
  imports: [DatabaseModule],
  providers: [PlannerService],
  controllers: [PlannerController],
  exports: [PlannerService],
})
export class PlannerModule {}
