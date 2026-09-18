import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateHabitDto } from './dto/create-habit.dto';
import { LogHabitDto } from './dto/log-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { HabitsService } from './habits.service';

@Controller('habits')
@UseGuards(AuthGuard('jwt'))
export class HabitsController {
  constructor(private habitsService: HabitsService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateHabitDto) {
    return this.habitsService.create(req.user.id, dto);
  }

  @Get()
  async findAll(@Req() req: any, @Query('lifeArea') lifeArea?: string) {
    return this.habitsService.findAll(req.user.id, { lifeArea });
  }

  @Get('summary')
  async getSummary(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('lifeArea') lifeArea?: string,
  ) {
    return this.habitsService.getSummary(req.user.id, from, to, { lifeArea });
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id', ParseIntPipe) habitId: number) {
    return this.habitsService.findOne(req.user.id, habitId);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id', ParseIntPipe) habitId: number, @Body() dto: UpdateHabitDto) {
    return this.habitsService.update(req.user.id, habitId, dto);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) habitId: number) {
    return this.habitsService.remove(req.user.id, habitId);
  }

  @Post(':id/logs')
  async log(@Req() req: any, @Param('id', ParseIntPipe) habitId: number, @Body() dto: LogHabitDto) {
    return this.habitsService.log(req.user.id, habitId, dto);
  }

  @Get(':id/logs')
  async getLogs(
    @Req() req: any,
    @Param('id', ParseIntPipe) habitId: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.habitsService.getLogs(req.user.id, habitId, from, to);
  }
}
