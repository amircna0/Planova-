import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ClientLogDto } from './dto/client-log.dto';
import { LoggingService } from './logging.service';

@Controller('logs')
export class LoggingController {
  constructor(private loggingService: LoggingService) {}

  @Post('client')
  createClientLog(@Body() dto: ClientLogDto, @Req() req: Request) {
    this.loggingService.client(dto.message, {
      level: dto.level,
      source: dto.source,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      ...dto.meta,
    });

    return { status: 'logged' };
  }
}
