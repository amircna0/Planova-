import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { TemplatesModule } from '../templates/templates.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [DatabaseModule, TemplatesModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
