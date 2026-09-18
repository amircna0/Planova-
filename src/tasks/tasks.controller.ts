import { Controller, Get, Post, Body, Patch, Delete, Param, UseGuards, Req, Query, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { RescheduleTaskDto } from './dto/reschedule-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { parseDateInput } from '../common/date-utils';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';

@Controller('tasks')
@UseGuards(AuthGuard('jwt'))
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(req.user.id, dto);
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Query() query: ListTasksQueryDto,
  ) {
    if (query.date) {
      return this.tasksService.findByDate(req.user.id, parseDateInput(query.date));
    }
    return this.tasksService.findAll(req.user.id, {
      status: query.status,
      priority: query.priority,
      category: query.category,
      lifeArea: query.lifeArea,
    });
  }

  @Get('unfinished')
  async getUnfinished(@Req() req: any, @Query('date') date?: string) {
    return this.tasksService.getUnfinished(req.user.id, parseDateInput(date));
  }

  @Get(':id/reschedule-options')
  async getRescheduleOptions(@Req() req: any, @Param('id', ParseIntPipe) taskId: number, @Query('date') date?: string) {
    return this.tasksService.getRescheduleOptions(req.user.id, taskId, parseDateInput(date));
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id', ParseIntPipe) taskId: number) {
    return this.tasksService.findOne(req.user.id, taskId);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id', ParseIntPipe) taskId: number, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(req.user.id, taskId, dto);
  }

  @Patch(':id/status')
  async updateStatus(@Req() req: any, @Param('id', ParseIntPipe) taskId: number, @Body() dto: UpdateTaskStatusDto) {
    return this.tasksService.updateStatus(req.user.id, taskId, dto.status);
  }

  @Post(':id/reschedule')
  async reschedule(@Req() req: any, @Param('id', ParseIntPipe) taskId: number, @Body() dto: RescheduleTaskDto) {
    return this.tasksService.reschedule(req.user.id, taskId, dto);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) taskId: number) {
    return this.tasksService.remove(req.user.id, taskId);
  }
}
