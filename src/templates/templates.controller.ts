import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserMode } from '../common/user-modes';
import { UserModePipe } from '../common/pipes/user-mode.pipe';
import { TemplatesService } from './templates.service';

@Controller('templates')
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  @Get('starter')
  listStarterTemplates() {
    return this.templatesService.listStarterTemplates();
  }

  @Post('starter/:mode/apply')
  @UseGuards(AuthGuard('jwt'))
  applyStarterTemplate(@Req() req: any, @Param('mode', UserModePipe) mode: UserMode) {
    return this.templatesService.applyStarterTemplate(req.user.id, mode);
  }
}
