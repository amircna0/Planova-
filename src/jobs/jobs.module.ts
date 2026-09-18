import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { ReportsProcessor } from './reports.processor';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue({
      name: 'reports',
    }),
    ReportsModule,
  ],
  controllers: [JobsController],
  providers: [JobsService, ReportsProcessor],
  exports: [JobsService],
})
export class JobsModule {}
