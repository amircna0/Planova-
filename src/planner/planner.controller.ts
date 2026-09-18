import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PlannerService } from './planner.service';
import { CreateFocusBlockDto } from './dto/create-focus-block.dto';
import { toDateOnly } from '../common/date-utils';
import { DailyPlanQueryDto } from './dto/daily-plan-query.dto';

@Controller('planner')
@UseGuards(AuthGuard('jwt'))
export class PlannerController {
  constructor(private plannerService: PlannerService) {}

  /**
   * GET /planner/daily?date=2026-08-15&workStart=9&workEnd=18
   * Generate optimized daily schedule
   */
  @Get('daily')
  async getDailyPlan(
    @Req() req: any,
    @Query() query: DailyPlanQueryDto,
  ) {
    const workHoursStart = query.workStart ?? 9;
    const workHoursEnd = query.workEnd ?? 18;
    const planDate = query.date || toDateOnly(new Date());

    return this.plannerService.generateDailyPlan(
      req.user.id,
      planDate,
      workHoursStart,
      workHoursEnd,
    );
  }

  /**
   * GET /planner/next-task
   * Get the next recommended task for the user right now
   */
  @Get('next-task')
  async getNextTask(@Req() req: any) {
    const nextTask = await this.plannerService.getNextTask(req.user.id);
    if (!nextTask) {
      return { message: 'No pending tasks for today' };
    }
    return nextTask;
  }

  /**
   * POST /planner/apply-schedule?date=2026-08-15
   * Apply the generated schedule to actual task records in database
   */
  @Post('apply-schedule')
  async applySchedule(@Req() req: any, @Query() query: DailyPlanQueryDto) {
    const applyDate = query.date || toDateOnly(new Date());
    const result = await this.plannerService.applySchedule(req.user.id, applyDate);
    return {
      message: 'Schedule applied successfully',
      plan: result,
    };
  }

  @Get('focus-blocks')
  async getFocusBlocks(@Req() req: any, @Query('date') date?: string) {
    const planDate = date || toDateOnly(new Date());
    return this.plannerService.findFocusBlocks(req.user.id, planDate);
  }

  @Post('focus-blocks')
  async createFocusBlock(@Req() req: any, @Body() dto: CreateFocusBlockDto) {
    return this.plannerService.createFocusBlock(req.user.id, dto);
  }

  @Delete('focus-blocks/:id')
  async removeFocusBlock(@Req() req: any, @Param('id', ParseIntPipe) focusBlockId: number) {
    return this.plannerService.removeFocusBlock(req.user.id, focusBlockId);
  }

  /**
   * GET /planner/stats?date=2026-08-15
   * Get planning statistics (tasks scheduled, utilization, etc.)
   */
  @Get('stats')
  async getPlanningStats(@Req() req: any, @Query('date') date?: string) {
    const planDate = date || toDateOnly(new Date());
    const plan = await this.plannerService.generateDailyPlan(req.user.id, planDate);
    return plan.summary;
  }
}
