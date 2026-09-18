import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateHabitDto } from './dto/create-habit.dto';
import { LogHabitDto } from './dto/log-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class HabitsService {
  constructor(private prisma: PrismaService, private plansService: PlansService) {}

  async create(userId: number, dto: CreateHabitDto) {
    await this.plansService.assertWithinLimit(userId, 'habits');

    return this.prisma.habit.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAll(userId: number, filters?: { lifeArea?: string }) {
    return this.prisma.habit.findMany({
      where: {
        userId,
        ...(filters?.lifeArea && { lifeArea: filters.lifeArea }),
      },
      include: {
        logs: {
          orderBy: { date: 'desc' },
          take: 7,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: number, habitId: number) {
    const habit = await this.prisma.habit.findFirst({
      where: { id: habitId, userId },
      include: {
        logs: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    });

    if (!habit) {
      throw new NotFoundException('Habit not found');
    }

    return habit;
  }

  async update(userId: number, habitId: number, dto: UpdateHabitDto) {
    await this.ensureHabitOwner(userId, habitId);
    return this.prisma.habit.update({
      where: { id: habitId },
      data: dto,
    });
  }

  async remove(userId: number, habitId: number) {
    await this.ensureHabitOwner(userId, habitId);
    return this.prisma.habit.delete({
      where: { id: habitId },
    });
  }

  async log(userId: number, habitId: number, dto: LogHabitDto) {
    await this.ensureHabitOwner(userId, habitId);
    const date = this.toDayStart(dto.date ? new Date(dto.date) : new Date());

    return this.prisma.habitLog.upsert({
      where: {
        habitId_date: {
          habitId,
          date,
        },
      },
      create: {
        habitId,
        date,
        completed: dto.completed ?? true,
        mood: dto.mood,
        notes: dto.notes,
      },
      update: {
        completed: dto.completed ?? true,
        mood: dto.mood,
        notes: dto.notes,
      },
    });
  }

  async getLogs(userId: number, habitId: number, from?: string, to?: string) {
    await this.ensureHabitOwner(userId, habitId);
    return this.prisma.habitLog.findMany({
      where: {
        habitId,
        date: this.dateRange(from, to),
      },
      orderBy: { date: 'desc' },
    });
  }

  async getSummary(userId: number, from?: string, to?: string, filters?: { lifeArea?: string }) {
    const habits = await this.prisma.habit.findMany({
      where: {
        userId,
        ...(filters?.lifeArea && { lifeArea: filters.lifeArea }),
      },
      include: {
        logs: {
          where: {
            date: this.dateRange(from, to),
          },
        },
      },
    });

    const totalLogs = habits.reduce((sum, habit) => sum + habit.logs.length, 0);
    const completedLogs = habits.reduce(
      (sum, habit) => sum + habit.logs.filter((log) => log.completed).length,
      0,
    );
    const moodValues = habits.flatMap((habit) =>
      habit.logs
        .map((log) => log.mood)
        .filter((mood): mood is number => typeof mood === 'number'),
    );

    return {
      totalHabits: habits.length,
      totalLogs,
      completedLogs,
      completionRate: totalLogs ? Math.round((completedLogs / totalLogs) * 100) : 0,
      moodAverage: moodValues.length
        ? Number((moodValues.reduce((sum, mood) => sum + mood, 0) / moodValues.length).toFixed(2))
        : null,
      habits: habits.map((habit) => {
        const completed = habit.logs.filter((log) => log.completed).length;
        return {
          id: habit.id,
          title: habit.title,
          frequency: habit.frequency,
          category: habit.category,
          lifeArea: habit.lifeArea,
          logs: habit.logs.length,
          completed,
          completionRate: habit.logs.length ? Math.round((completed / habit.logs.length) * 100) : 0,
        };
      }),
    };
  }

  private async ensureHabitOwner(userId: number, habitId: number) {
    const habit = await this.prisma.habit.findFirst({
      where: { id: habitId, userId },
      select: { id: true },
    });

    if (!habit) {
      throw new ForbiddenException('Habit does not belong to this user');
    }
  }

  private dateRange(from?: string, to?: string) {
    if (!from && !to) {
      return undefined;
    }

    return {
      ...(from && { gte: this.toDayStart(new Date(from)) }),
      ...(to && { lte: this.toDayEnd(new Date(to)) }),
    };
  }

  private toDayStart(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  }

  private toDayEnd(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
  }
}
