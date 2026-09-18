import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import { parseDateInput } from '../common/date-utils';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('today')
  async today(@Req() req: any, @Query('date') date?: string) {
    return this.dashboardService.getToday(req.user.id, parseDateInput(date));
  }

  @Get('overview')
  async overview(@Req() req: any) {
    return this.dashboardService.getOverview(req.user.id);
  }
}
