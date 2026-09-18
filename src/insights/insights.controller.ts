import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InsightsService } from './insights.service';
import { HabitInsightsQueryDto } from './dto/habit-insights-query.dto';

@Controller('insights')
@UseGuards(AuthGuard('jwt'))
export class InsightsController {
  constructor(private insightsService: InsightsService) {}

  @Get('habits')
  getHabitMoodInsights(@Req() req: any, @Query() query: HabitInsightsQueryDto) {
    return this.insightsService.getHabitMoodInsights(req.user.id, query.days || 30);
  }
}
