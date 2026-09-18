import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateGoalDto } from './dto/create-goal.dto';
import { CreateGoalRoadmapDto } from './dto/create-goal-roadmap.dto';
import { GenerateGoalRoadmapDto } from './dto/generate-goal-roadmap.dto';
import { UpdateGoalProgressDto } from './dto/update-goal-progress.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GoalsService } from './goals.service';

@Controller('goals')
@UseGuards(AuthGuard('jwt'))
export class GoalsController {
  constructor(private goalsService: GoalsService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(req.user.id, dto);
  }

  @Get()
  async findAll(@Req() req: any, @Query('timeframe') timeframe?: string, @Query('lifeArea') lifeArea?: string) {
    return this.goalsService.findAll(req.user.id, { timeframe, lifeArea });
  }

  @Get('hierarchy')
  async hierarchy(@Req() req: any) {
    return this.goalsService.getHierarchy(req.user.id);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id', ParseIntPipe) goalId: number) {
    return this.goalsService.findOne(req.user.id, goalId);
  }

  @Get(':id/roadmap')
  async getRoadmap(@Req() req: any, @Param('id', ParseIntPipe) goalId: number) {
    return this.goalsService.getRoadmap(req.user.id, goalId);
  }

  @Post(':id/roadmap')
  async createRoadmap(@Req() req: any, @Param('id', ParseIntPipe) goalId: number, @Body() dto: CreateGoalRoadmapDto) {
    return this.goalsService.createRoadmap(req.user.id, goalId, dto);
  }

  @Post(':id/roadmap/generate')
  async generateRoadmap(@Req() req: any, @Param('id', ParseIntPipe) goalId: number, @Body() dto: GenerateGoalRoadmapDto) {
    return this.goalsService.generateRoadmap(req.user.id, goalId, dto);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id', ParseIntPipe) goalId: number, @Body() dto: UpdateGoalDto) {
    return this.goalsService.update(req.user.id, goalId, dto);
  }

  @Patch(':id/progress')
  async updateProgress(@Req() req: any, @Param('id', ParseIntPipe) goalId: number, @Body() dto: UpdateGoalProgressDto) {
    return this.goalsService.update(req.user.id, goalId, { progress: dto.progress });
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) goalId: number) {
    return this.goalsService.remove(req.user.id, goalId);
  }
}
