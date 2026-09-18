import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(AuthGuard('jwt'))
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Post('reports/weekly')
  async enqueueWeeklyReport(@Req() req: any, @Query('weekStart') weekStart?: string) {
    return this.jobsService.enqueueWeeklyReport(req.user.id, weekStart);
  }

  @Get('reports/:id')
  async getReportJob(@Param('id') jobId: string) {
    return this.jobsService.getReportJob(jobId);
  }
}
