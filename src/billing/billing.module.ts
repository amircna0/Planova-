import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { LoggingModule } from '../logging/logging.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [DatabaseModule, LoggingModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
