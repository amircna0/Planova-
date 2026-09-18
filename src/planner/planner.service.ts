import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateFocusBlockDto } from './dto/create-focus-block.dto';
import { combineUtcDateAndTime, toDateOnly, toUtcDayEnd, toUtcDayStart, utcMinutesSinceMidnight } from '../common/date-utils';

interface ScheduledTask {
  id: number;
  title: string;
  priority: number;
  duration: number;
  startTime: string;
  endTime: string;
  category: string;
}

interface DailyPlan {
  date: string;
  workHoursStart: number; // e.g., 9 for 9 AM
  workHoursEnd: number;   // e.g., 18 for 6 PM
  totalAvailableMinutes: number;
  scheduledTasks: ScheduledTask[];
  breaks: Array<{ startTime: string; endTime: string; type: string }>;
  summary: {
    totalTasks: number;
    totalScheduledMinutes: number;
    utilizationPercent: number;
  };
}

@Injectable()
export class PlannerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate an optimized daily schedule for a user
   * Rules:
   * - Higher priority tasks scheduled first
   * - Tasks sorted by priority then by duration
   * - Automatic break insertion (10 min break every 90 min of work)
   * - Respects user's work hours (default 9 AM - 6 PM)
   */
  async generateDailyPlan(
    userId: number,
    date: string = toDateOnly(new Date()),
    workHoursStart: number = 9,
    workHoursEnd: number = 18,
  ): Promise<DailyPlan> {
    if (workHoursEnd <= workHoursStart) {
      throw new BadRequestException('workEnd must be after workStart');
    }

    const startOfDay = toUtcDayStart(date);
    const endOfDay = toUtcDayEnd(date);

    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        status: { in: ['todo', 'in_progress'] },
        OR: [
          { dueDate: { gte: startOfDay, lte: endOfDay } },
          { startTime: { gte: startOfDay, lte: endOfDay } },
        ],
      },
      orderBy: [{ priority: 'asc' }, { duration: 'asc' }], // Higher priority (lower number) first
    });

    // Sort by priority (ascending = higher priority first) then duration
    const sortedTasks = tasks.sort((a, b) => {
      const priorityA = a.priority ?? 999;
      const priorityB = b.priority ?? 999;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return (a.duration || 60) - (b.duration || 60);
    });

    // Calculate available work minutes
    const totalAvailableMinutes = (workHoursEnd - workHoursStart) * 60;
    const scheduledTasks: ScheduledTask[] = [];
    const breaks: Array<{ startTime: string; endTime: string; type: string }> = [];

    let currentTimeMinutes = workHoursStart * 60; // Start in minutes from midnight
    let minutesWorkedSinceBreak = 0;
    const BREAK_INTERVAL = 90; // minutes of work before break
    const BREAK_DURATION = 10; // minutes

    for (const task of sortedTasks) {
      const taskDuration = task.duration || 60; // Default 60 min if not set

      // Check if we need a break before this task
      if (
        minutesWorkedSinceBreak + taskDuration > BREAK_INTERVAL &&
        minutesWorkedSinceBreak > 0
      ) {
        const breakStart = currentTimeMinutes;
        const breakEnd = breakStart + BREAK_DURATION;

        if (breakEnd <= workHoursEnd * 60) {
          breaks.push({
            startTime: this.minutesToTimeString(breakStart),
            endTime: this.minutesToTimeString(breakEnd),
            type: 'break',
          });
          currentTimeMinutes = breakEnd;
          minutesWorkedSinceBreak = 0;
        }
      }

      // Check if task fits in remaining work hours
      if (currentTimeMinutes + taskDuration <= workHoursEnd * 60) {
        const startTime = this.minutesToTimeString(currentTimeMinutes);
        const endTime = this.minutesToTimeString(currentTimeMinutes + taskDuration);

        scheduledTasks.push({
          id: task.id,
          title: task.title,
          priority: task.priority ?? 999,
          duration: taskDuration,
          startTime,
          endTime,
          category: task.category || 'general',
        });

        currentTimeMinutes += taskDuration;
        minutesWorkedSinceBreak += taskDuration;
      }
    }

    const totalScheduledMinutes = scheduledTasks.reduce(
      (sum, t) => sum + t.duration,
      0,
    );

    return {
      date,
      workHoursStart,
      workHoursEnd,
      totalAvailableMinutes,
      scheduledTasks,
      breaks,
      summary: {
        totalTasks: tasks.length,
        totalScheduledMinutes,
        utilizationPercent: Math.round(
          (totalScheduledMinutes / totalAvailableMinutes) * 100,
        ),
      },
    };
  }

  async findFocusBlocks(userId: number, date: string) {
    const range = this.dayRange(date);

    return this.prisma.focusBlock.findMany({
      where: {
        userId,
        start: { gte: range.start },
        end: { lte: range.end },
      },
      include: {
        task: true,
      },
      orderBy: { start: 'asc' },
    });
  }

  async createFocusBlock(userId: number, dto: CreateFocusBlockDto) {
    const start = this.combineDateAndTime(dto.date, dto.startTime);
    const end = this.combineDateAndTime(dto.date, dto.endTime);

    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('Focus block end time must be after start time');
    }

    if (dto.taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: dto.taskId, userId },
        select: { id: true },
      });

      if (!task) {
        throw new ForbiddenException('Task does not belong to this user');
      }
    }

    return this.prisma.focusBlock.create({
      data: {
        userId,
        taskId: dto.taskId,
        title: dto.title,
        start,
        end,
        type: dto.type || 'focus',
      },
      include: {
        task: true,
      },
    });
  }

  async removeFocusBlock(userId: number, focusBlockId: number) {
    const result = await this.prisma.focusBlock.deleteMany({
      where: { id: focusBlockId, userId },
    });

    if (!result.count) {
      throw new ForbiddenException('Focus block does not belong to this user');
    }

    return result;
  }

  /**
   * Get suggested next task based on current time
   */
  async getNextTask(userId: number): Promise<ScheduledTask | null> {
    const now = new Date();
    const today = toDateOnly(now);
    const plan = await this.generateDailyPlan(userId, today);

    const currentMinutes = utcMinutesSinceMidnight(now);

    // Find first task that hasn't started yet or is currently ongoing
    for (const task of plan.scheduledTasks) {
      const taskStart = this.timeStringToMinutes(task.startTime);
      const taskEnd = this.timeStringToMinutes(task.endTime);

      if (currentMinutes >= taskStart && currentMinutes < taskEnd) {
        return task; // Currently in this task
      }
      if (currentMinutes < taskStart) {
        return task; // Next upcoming task
      }
    }

    return null;
  }

  /**
   * Apply scheduled times to actual task records (persists to DB)
   */
  async applySchedule(userId: number, date: string): Promise<any> {
    const plan = await this.generateDailyPlan(userId, date);
    const range = this.dayRange(date);

    for (const scheduledTask of plan.scheduledTasks) {
      const startTime = combineUtcDateAndTime(date, `${scheduledTask.startTime}`);
      const endTime = combineUtcDateAndTime(date, `${scheduledTask.endTime}`);

      await this.prisma.task.update({
        where: { id: scheduledTask.id },
        data: {
          startTime,
          endTime,
        },
      });

      await this.prisma.focusBlock.deleteMany({
        where: {
          userId,
          taskId: scheduledTask.id,
          type: 'focus',
          start: { gte: range.start },
          end: { lte: range.end },
        },
      });

      await this.prisma.focusBlock.create({
        data: {
          userId,
          taskId: scheduledTask.id,
          title: scheduledTask.title,
          start: startTime,
          end: endTime,
          type: 'focus',
        },
      });
    }

    return plan;
  }

  // Helper: Convert minutes from midnight to HH:MM format
  private minutesToTimeString(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  // Helper: Convert HH:MM format to minutes from midnight
  private timeStringToMinutes(timeStr: string): number {
    const [hours, mins] = timeStr.split(':').map(Number);
    return hours * 60 + mins;
  }

  private dayRange(date: string) {
    return { start: toUtcDayStart(date), end: toUtcDayEnd(date) };
  }

  private combineDateAndTime(date: string, time: string) {
    return combineUtcDateAndTime(date, time);
  }
}
