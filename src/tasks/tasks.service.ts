import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { RescheduleTaskDto } from './dto/reschedule-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PlansService } from '../plans/plans.service';
import {
  addUtcDays,
  combineUtcDateAndMinutes,
  parseDateInput,
  toDateOnly,
  toUtcDayEnd,
  toUtcDayStart,
  toUtcTimeOnly,
  utcMinutesSinceMidnight,
} from '../common/date-utils';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService, private plansService: PlansService) {}

  async create(userId: number, dto: CreateTaskDto) {
    await this.plansService.assertWithinLimit(userId, 'tasks');

    return this.prisma.task.create({
      data: {
        ...dto,
        dueDate: dto.dueDate ? toUtcDayStart(dto.dueDate) : undefined,
        startTime: dto.startTime ? parseDateInput(dto.startTime) : undefined,
        endTime: dto.endTime ? parseDateInput(dto.endTime) : undefined,
        userId
      }
    });
  }

  async findAll(userId: number, filters?: { status?: string; priority?: number; category?: string; lifeArea?: string }) {
    return this.prisma.task.findMany({
      where: {
        userId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.priority && { priority: filters.priority }),
        ...(filters?.category && { category: filters.category }),
        ...(filters?.lifeArea && { lifeArea: filters.lifeArea }),
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(userId: number, taskId: number) {
    return this.prisma.task.findFirst({
      where: { id: taskId, userId }
    });
  }

  async update(userId: number, taskId: number, dto: UpdateTaskDto) {
    return this.prisma.task.updateMany({
      where: { id: taskId, userId },
      data: {
        ...dto,
        dueDate: dto.dueDate ? toUtcDayStart(dto.dueDate) : undefined,
        startTime: dto.startTime ? parseDateInput(dto.startTime) : undefined,
        endTime: dto.endTime ? parseDateInput(dto.endTime) : undefined,
      }
    });
  }

  async remove(userId: number, taskId: number) {
    return this.prisma.task.deleteMany({
      where: { id: taskId, userId }
    });
  }

  async updateStatus(userId: number, taskId: number, status: string) {
    return this.prisma.task.updateMany({
      where: { id: taskId, userId },
      data: { status }
    });
  }

  async findByDate(userId: number, date: Date) {
    const start = toUtcDayStart(date);
    const end = toUtcDayEnd(date);

    return this.prisma.task.findMany({
      where: {
        userId,
        OR: [
          { dueDate: { gte: start, lte: end } },
          { startTime: { gte: start, lte: end } },
        ],
      },
      orderBy: [{ startTime: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }]
    });
  }

  async getUnfinished(userId: number, date: Date) {
    const end = toUtcDayEnd(date);

    return this.prisma.task.findMany({
      where: {
        userId,
        status: { in: ['todo', 'in_progress'] },
        OR: [
          { dueDate: { lte: end } },
          { endTime: { lte: end } },
        ],
      },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getRescheduleOptions(userId: number, taskId: number, date: Date = new Date()) {
    await this.plansService.assertFeature(userId, 'smart_rescheduling');

    const task = await this.ensureTaskOwner(userId, taskId);
    const baseDate = toUtcDayStart(date);
    const duration = Math.min(Math.max(task.duration || 45, 15), 240);
    const tomorrow = this.nextDayStart(baseDate);
    const weekend = this.nextWeekendStart(baseDate);
    const slots = await this.findOpenSlots(userId, task.id, baseDate, duration, 7);
    const suggestedSlot = slots[0] || null;

    return {
      task: {
        id: task.id,
        title: task.title,
        duration,
        priority: task.priority,
        dueDate: task.dueDate,
      },
      suggestedSlot,
      options: [
        {
          action: 'custom',
          label: suggestedSlot ? 'Best open slot' : 'No open slot found',
          dueDate: suggestedSlot?.date || toDateOnly(tomorrow),
          startTime: suggestedSlot?.startDateTime || null,
          endTime: suggestedSlot?.endDateTime || null,
          reason: suggestedSlot
            ? `Fits ${duration} minutes without overlapping scheduled work`
            : 'Try moving this task to tomorrow or splitting it into smaller tasks',
          available: Boolean(suggestedSlot),
        },
        {
          action: 'tomorrow',
          label: 'Move to tomorrow',
          dueDate: toDateOnly(tomorrow),
          reason: 'Simple recovery plan for unfinished work',
          available: true,
        },
        {
          action: 'weekend',
          label: 'Move to weekend',
          dueDate: toDateOnly(weekend),
          reason: 'Better for tasks that need more breathing room',
          available: true,
        },
        {
          action: 'split',
          label: 'Break into smaller tasks',
          dueDate: toDateOnly(tomorrow),
          reason: 'Useful when the task feels too large or unclear',
          available: true,
        },
      ],
      searchWindow: {
        start: toDateOnly(this.nextDayStart(baseDate)),
        days: 7,
        workStart: '09:00',
        workEnd: '18:00',
      },
    };
  }

  async reschedule(userId: number, taskId: number, dto: RescheduleTaskDto) {
    await this.plansService.assertFeature(userId, 'smart_rescheduling');

    const task = await this.ensureTaskOwner(userId, taskId);

    if (dto.action === 'delete') {
      await this.prisma.task.delete({ where: { id: task.id } });
      return { action: dto.action, taskId: task.id, message: 'Task deleted' };
    }

    if (dto.action === 'no_longer_important') {
      const updated = await this.prisma.task.update({
        where: { id: task.id },
        data: { status: 'no_longer_important' },
      });
      return { action: dto.action, task: updated };
    }

    if (dto.action === 'split') {
      const parts = dto.parts?.filter((part) => part.trim().length > 0);

      if (!parts?.length) {
        throw new BadRequestException('Split action requires at least one task part');
      }

      const dueDate = dto.dueDate ? toUtcDayStart(dto.dueDate) : this.nextDayStart(new Date());
      const createdTasks = await this.prisma.$transaction([
        this.prisma.task.update({
          where: { id: task.id },
          data: { status: 'split' },
        }),
        ...parts.map((title) =>
          this.prisma.task.create({
            data: {
              userId,
              title,
              category: task.category,
              priority: task.priority,
              dueDate,
              duration: task.duration ? Math.max(15, Math.ceil(task.duration / parts.length)) : undefined,
              parentGoalId: task.parentGoalId,
              description: `Split from task: ${task.title}`,
            },
          }),
        ),
      ]);

      return {
        action: dto.action,
        originalTask: createdTasks[0],
        newTasks: createdTasks.slice(1),
      };
    }

    if (dto.action === 'custom') {
      const startTime = dto.startTime ? parseDateInput(dto.startTime) : null;
      const endTime = dto.endTime ? parseDateInput(dto.endTime) : null;
      const dueDate = dto.dueDate
        ? toUtcDayStart(dto.dueDate)
        : startTime
          ? toUtcDayStart(startTime)
          : null;

      if (!dueDate) {
        throw new BadRequestException('Custom rescheduling requires dueDate or startTime');
      }

      if ((startTime && !endTime) || (!startTime && endTime)) {
        throw new BadRequestException('Custom rescheduling requires both startTime and endTime');
      }

      if (startTime && endTime && endTime.getTime() <= startTime.getTime()) {
        throw new BadRequestException('Custom rescheduling endTime must be after startTime');
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const updatedTask = await tx.task.update({
          where: { id: task.id },
          data: {
            dueDate,
            startTime,
            endTime,
            status: 'todo',
          },
        });

        await tx.focusBlock.deleteMany({
          where: {
            userId,
            taskId: task.id,
          },
        });

        const focusBlock =
          startTime && endTime
            ? await tx.focusBlock.create({
                data: {
                  userId,
                  taskId: task.id,
                  title: task.title,
                  start: startTime,
                  end: endTime,
                  type: 'focus',
                },
              })
            : null;

        return { task: updatedTask, focusBlock };
      });

      return {
        action: dto.action,
        ...updated,
        suggestion: startTime
          ? `Scheduled for ${toDateOnly(dueDate)} at ${toUtcTimeOnly(startTime)}`
          : `Moved to ${toDateOnly(dueDate)}`,
      };
    }

    const baseDate = task.dueDate || new Date();
    const dueDate =
      dto.action === 'tomorrow'
        ? this.nextDayStart(baseDate)
        : dto.action === 'weekend'
          ? this.nextWeekendStart(baseDate)
          : dto.dueDate
            ? toUtcDayStart(dto.dueDate)
            : null;

    if (!dueDate) {
      throw new BadRequestException('Unsupported reschedule action');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: task.id },
        data: {
          dueDate,
          startTime: null,
          endTime: null,
          status: 'todo',
        },
      });

      await tx.focusBlock.deleteMany({
        where: {
          userId,
          taskId: task.id,
        },
      });

      return updatedTask;
    });

    return {
      action: dto.action,
      task: updated,
      suggestion: `Moved to ${toDateOnly(dueDate)}`,
    };
  }

  private async ensureTaskOwner(userId: number, taskId: number) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new ForbiddenException('Task does not belong to this user');
    }

    return task;
  }

  private nextDayStart(date: Date) {
    return addUtcDays(date, 1);
  }

  private nextWeekendStart(date: Date) {
    const value = toUtcDayStart(date);
    const day = value.getUTCDay();
    const daysUntilSaturday = day === 6 ? 7 : 6 - day;
    value.setUTCDate(value.getUTCDate() + daysUntilSaturday);
    return value;
  }

  private async findOpenSlots(userId: number, taskId: number, baseDate: Date, duration: number, days: number) {
    const slots: Array<{
      date: string;
      startTime: string;
      endTime: string;
      startDateTime: string;
      endDateTime: string;
    }> = [];
    const workStart = 9 * 60;
    const workEnd = 18 * 60;

    for (let offset = 1; offset <= days; offset += 1) {
      const day = addUtcDays(baseDate, offset);
      const dayEnd = toUtcDayEnd(day);

      const [focusBlocks, scheduledTasks] = await Promise.all([
        this.prisma.focusBlock.findMany({
          where: {
            userId,
            start: { lt: dayEnd },
            end: { gt: day },
          },
        }),
        this.prisma.task.findMany({
          where: {
            userId,
            id: { not: taskId },
            status: { notIn: ['done', 'no_longer_important'] },
            startTime: { not: null, lt: dayEnd },
            endTime: { not: null, gt: day },
          },
        }),
      ]);

      const busy = this.mergeIntervals([
        ...focusBlocks.map((block) => ({
          start: utcMinutesSinceMidnight(block.start),
          end: utcMinutesSinceMidnight(block.end),
        })),
        ...scheduledTasks.map((task) => ({
          start: utcMinutesSinceMidnight(task.startTime as Date),
          end: utcMinutesSinceMidnight(task.endTime as Date),
        })),
      ]);

      let cursor = workStart;

      for (const interval of busy) {
        const gapEnd = Math.max(workStart, Math.min(interval.start, workEnd));

        if (gapEnd - cursor >= duration) {
          slots.push(this.buildSlot(day, cursor, duration));
        }

        cursor = Math.max(cursor, Math.min(interval.end, workEnd));
      }

      if (workEnd - cursor >= duration) {
        slots.push(this.buildSlot(day, cursor, duration));
      }

      if (slots.length >= 3) {
        return slots.slice(0, 3);
      }
    }

    return slots;
  }

  private mergeIntervals(intervals: Array<{ start: number; end: number }>) {
    const sorted = intervals
      .filter((interval) => interval.end > interval.start)
      .sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number }> = [];

    for (const interval of sorted) {
      const last = merged[merged.length - 1];

      if (!last || interval.start > last.end) {
        merged.push({ ...interval });
      } else {
        last.end = Math.max(last.end, interval.end);
      }
    }

    return merged;
  }

  private buildSlot(date: Date, startMinutes: number, duration: number) {
    const endMinutes = startMinutes + duration;
    const startDate = this.combineDateAndMinutes(date, startMinutes);
    const endDate = this.combineDateAndMinutes(date, endMinutes);

    return {
      date: toDateOnly(date),
      startTime: this.minutesToTime(startMinutes),
      endTime: this.minutesToTime(endMinutes),
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
    };
  }

  private combineDateAndMinutes(date: Date, minutes: number) {
    return combineUtcDateAndMinutes(date, minutes);
  }

  private minutesToTime(minutes: number) {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
}
