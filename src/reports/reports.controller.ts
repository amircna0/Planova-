import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import { ReportHistoryQueryDto } from './dto/report-history-query.dto';

@Controller('reports')
@UseGuards(AuthGuard('jwt'))
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('weekly')
  async getWeekly(@Req() req: any, @Query('weekStart') weekStart?: string) {
    return this.reportsService.getWeeklyReport(req.user.id, weekStart);
  }

  @Post('weekly')
  async generateWeekly(@Req() req: any, @Query('weekStart') weekStart?: string) {
    return this.reportsService.generateWeeklyReport(req.user.id, weekStart);
  }

  @Get('history')
  async history(@Req() req: any, @Query() query: ReportHistoryQueryDto) {
    return this.reportsService.history(req.user.id, query.limit || 12);
  }
}
