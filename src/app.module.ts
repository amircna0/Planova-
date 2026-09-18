import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database.module';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';
import { PlannerModule } from './planner/planner.module';
import { HabitsModule } from './habits/habits.module';
import { GoalsModule } from './goals/goals.module';
import { ReportsModule } from './reports/reports.module';
import { JobsModule } from './jobs/jobs.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PlansModule } from './plans/plans.module';
import { CopilotModule } from './copilot/copilot.module';
import { ProfileModule } from './profile/profile.module';
import { TemplatesModule } from './templates/templates.module';
import { InsightsModule } from './insights/insights.module';
import { LoggingModule } from './logging/logging.module';
import { PersonalModule } from './personal/personal.module';
import { BillingModule } from './billing/billing.module';

const optionalModules = process.env.REDIS_ENABLED === 'true' ? [JobsModule] : [];

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    TasksModule,
    PlannerModule,
    HabitsModule,
    GoalsModule,
    ReportsModule,
    DashboardModule,
    PlansModule,
    CopilotModule,
    ProfileModule,
    TemplatesModule,
    InsightsModule,
    LoggingModule,
    PersonalModule,
    BillingModule,
    ...optionalModules,
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
