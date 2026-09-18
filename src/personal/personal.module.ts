import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { PersonalController } from './personal.controller';
import { PersonalService } from './personal.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PersonalController],
  providers: [PersonalService],
})
export class PersonalModule {}
