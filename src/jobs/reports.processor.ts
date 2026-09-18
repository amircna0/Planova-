import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { ReportsService } from '../reports/reports.service';

interface WeeklyReportJob {
  userId: number;
  weekStart?: string;
}

@Injectable()
@Processor('reports')
export class ReportsProcessor extends WorkerHost {
  constructor(private reportsService: ReportsService) {
    super();
  }

  async process(job: Job<WeeklyReportJob>) {
    if (job.name !== 'weekly-report') {
      return null;
    }

    await job.updateProgress(25);
    const report = await this.reportsService.generateWeeklyReport(job.data.userId, job.data.weekStart);
    await job.updateProgress(100);
    return report;
  }
}
