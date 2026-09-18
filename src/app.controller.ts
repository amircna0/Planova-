import { Controller, Get, Res } from '@nestjs/common';
import { join } from 'path';
import { Response } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot(@Res() res: Response) {
    return res.sendFile(join(__dirname, '..', 'planova.html'));
  }

  @Get('health')
  getHealth() {
    return this.appService.getStatus();
  }
}
