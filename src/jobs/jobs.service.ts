import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class JobsService {
  constructor(@InjectQueue('reports') private reportsQueue: Queue) {}

  async enqueueWeeklyReport(userId: number, weekStart?: string) {
    const job = await this.reportsQueue.add(
      'weekly-report',
      { userId, weekStart },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    return {
      id: job.id,
      name: job.name,
      status: await job.getState(),
    };
  }

  async getReportJob(jobId: string) {
    const job = await this.reportsQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('Report job not found');
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      status: await job.getState(),
      progress: job.progress,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    };
  }
}
