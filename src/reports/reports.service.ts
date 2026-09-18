import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { parseDateInput } from '../common/date-utils';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getWeeklyReport(userId: number, weekStart?: string) {
    return this.generateWeeklyReport(userId, weekStart);
  }

  async generateWeeklyReport(userId: number, weekStart?: string) {
    const range = this.weekRange(weekStart);
    const nextRange = this.shiftRange(range, 7);
    const [tasksCompleted, plannedTasks, missedTasks, focusBlocks, habits, nextWeeklyFocuses, nextWeekTasks] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          userId,
          status: 'done',
          updatedAt: {
            gte: range.start,
            lte: range.end,
          },
        },
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          OR: [
            { dueDate: { gte: range.start, lte: range.end } },
            { startTime: { gte: range.start, lte: range.end } },
            { endTime: { gte: range.start, lte: range.end } },
          ],
        },
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          status: { notIn: ['done', 'no_longer_important'] },
          OR: [
            { dueDate: { gte: range.start, lte: range.end } },
            { endTime: { gte: range.start, lte: range.end } },
          ],
        },
        orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      }),
      this.prisma.focusBlock.findMany({
        where: {
          userId,
          start: { gte: range.start },
          end: { lte: range.end },
        },
      }),
      this.prisma.habit.findMany({
        where: {
          userId,
        },
        include: {
          logs: {
            where: {
              date: {
                gte: range.start,
                lte: range.end,
              },
            },
            orderBy: { date: 'asc' },
          },
        },
      }),
      this.prisma.weeklyFocus.findMany({
        where: {
          userId,
          weekStart: { lte: nextRange.end },
          weekEnd: { gte: nextRange.start },
        },
        include: {
          goal: {
            select: {
              id: true,
              title: true,
              lifeArea: true,
            },
          },
        },
        orderBy: [{ weekStart: 'asc' }, { order: 'asc' }],
        take: 3,
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          status: { notIn: ['done', 'no_longer_important'] },
          OR: [
            { dueDate: { gte: nextRange.start, lte: nextRange.end } },
            { startTime: { gte: nextRange.start, lte: nextRange.end } },
          ],
        },
        orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
        take: 10,
      }),
    ]);

    const taskCountsByDay = this.countByDay(tasksCompleted.map((task) => task.updatedAt));
    const bestDay = this.bestDay(taskCountsByDay);
    const totalFocusMs = focusBlocks.reduce((sum, block) => sum + (block.end.getTime() - block.start.getTime()), 0);
    const totalFocusHours = Math.round(
      totalFocusMs / 3600000,
    );
    const habitLogs = habits.flatMap((habit) =>
      habit.logs.map((log) => ({
        ...log,
        habitTitle: habit.title,
        lifeArea: habit.lifeArea,
      })),
    );
    const moodValues = habitLogs
      .map((log) => log.mood)
      .filter((mood): mood is number => typeof mood === 'number');
    const completedMoodValues = habitLogs
      .filter((log) => log.completed)
      .map((log) => log.mood)
      .filter((mood): mood is number => typeof mood === 'number');
    const missedMoodValues = habitLogs
      .filter((log) => !log.completed)
      .map((log) => log.mood)
      .filter((mood): mood is number => typeof mood === 'number');
    const habitCompletionRate = habitLogs.length
      ? Math.round((habitLogs.filter((log) => log.completed).length / habitLogs.length) * 100)
      : 0;
    const moodAverage = this.average(moodValues);
    const bestHabitStreak = this.bestHabitStreak(habits);
    const mainFocusNextWeek = this.buildMainFocusNextWeek(nextWeeklyFocuses, nextWeekTasks);
    const focusByType = this.countByValue(focusBlocks.map((block) => block.type));

    const report = await this.prisma.report.upsert({
      where: {
        userId_type_weekStart: {
          userId,
          type: 'weekly',
          weekStart: range.start,
        },
      },
      create: {
        userId,
        type: 'weekly',
        weekStart: range.start,
        weekEnd: range.end,
        tasksCompleted: tasksCompleted.length,
        tasksOverdue: missedTasks.length,
        bestDay,
        totalFocusHours,
        moodAverage,
      },
      update: {
        weekEnd: range.end,
        tasksCompleted: tasksCompleted.length,
        tasksOverdue: missedTasks.length,
        bestDay,
        totalFocusHours,
        moodAverage,
      },
    });

    return {
      ...report,
      insights: {
        range: {
          start: this.toDateOnly(range.start),
          end: this.toDateOnly(range.end),
        },
        plannedTasks: plannedTasks.length,
        habitCompletionRate,
        bestHabitStreak,
        focusBlockCount: focusBlocks.length,
        focusByType,
        totalFocusMinutes: Math.round(totalFocusMs / 60000),
        taskCountsByDay,
        missedTasks: missedTasks.slice(0, 5).map((task) => ({
          id: task.id,
          title: task.title,
          dueDate: task.dueDate,
          priority: task.priority,
          lifeArea: task.lifeArea,
        })),
        moodPattern: {
          averageOnCompletedHabits: this.average(completedMoodValues),
          averageOnMissedHabits: this.average(missedMoodValues),
        },
        mainFocusNextWeek,
        summary: this.buildInsightSummary({
          tasksCompleted: tasksCompleted.length,
          tasksOverdue: missedTasks.length,
          habitCompletionRate,
          moodAverage,
          bestHabitStreak,
          mainFocusNextWeek,
        }),
      },
    };
  }

  async history(userId: number, limit: number) {
    return this.prisma.report.findMany({
      where: {
        userId,
        type: 'weekly',
      },
      orderBy: { weekStart: 'desc' },
      take: Math.min(limit, 52),
    });
  }

  private weekRange(weekStart?: string) {
    const start = this.toUtcDayStart(this.parseDate(weekStart));
    const day = start.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setUTCDate(start.getUTCDate() + mondayOffset);

    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);

    return { start, end };
  }

  private parseDate(date?: string) {
    if (!date) {
      return new Date();
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Date(`${date}T00:00:00.000Z`);
    }

    return parseDateInput(date);
  }

  private toUtcDayStart(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  }

  private shiftRange(range: { start: Date; end: Date }, days: number) {
    const start = new Date(range.start);
    start.setUTCDate(start.getUTCDate() + days);

    const end = new Date(range.end);
    end.setUTCDate(end.getUTCDate() + days);

    return { start, end };
  }

  private countByDay(dates: Date[]) {
    return dates.reduce<Record<string, number>>((counts, date) => {
      const key = date.toLocaleDateString('en-US', { weekday: 'long' });
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }

  private bestDay(counts: Record<string, number>) {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0] || null;
  }

  private average(values: number[]) {
    if (!values.length) {
      return null;
    }

    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
  }

  private bestHabitStreak(habits: Array<{ id: number; title: string; logs: Array<{ date: Date; completed: boolean }> }>) {
    let best: { habitId: number; title: string; days: number } | null = null;

    for (const habit of habits) {
      const days = habit.logs
        .filter((log) => log.completed)
        .map((log) => this.toDateOnly(log.date))
        .sort();
      let current = 0;
      let longest = 0;
      let previous: Date | null = null;

      for (const day of days) {
        const currentDate = new Date(`${day}T00:00:00.000Z`);
        const isNextDay = previous && currentDate.getTime() - previous.getTime() === 86400000;
        current = isNextDay ? current + 1 : 1;
        longest = Math.max(longest, current);
        previous = currentDate;
      }

      if (longest > 0 && (!best || longest > best.days)) {
        best = { habitId: habit.id, title: habit.title, days: longest };
      }
    }

    return best;
  }

  private buildMainFocusNextWeek(
    weeklyFocuses: Array<{ title: string; weekStart: Date; goal: { id: number; title: string; lifeArea: string | null } }>,
    tasks: Array<{ title: string; lifeArea: string | null; priority: number | null }>,
  ) {
    if (weeklyFocuses.length) {
      const focus = weeklyFocuses[0];

      return {
        source: 'weekly_focus',
        title: focus.title,
        goalId: focus.goal.id,
        goalTitle: focus.goal.title,
        lifeArea: focus.goal.lifeArea,
        weekStart: this.toDateOnly(focus.weekStart),
      };
    }

    if (tasks.length) {
      const lifeAreas = this.countByValue(tasks.map((task) => task.lifeArea || 'general'));
      const topLifeArea = Object.entries(lifeAreas).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      return {
        source: 'tasks',
        title: tasks[0].title,
        goalId: null,
        goalTitle: null,
        lifeArea: topLifeArea,
        weekStart: null,
      };
    }

    return {
      source: 'empty',
      title: 'Plan next week',
      goalId: null,
      goalTitle: null,
      lifeArea: null,
      weekStart: null,
    };
  }

  private countByValue(values: Array<string | null>) {
    return values.reduce<Record<string, number>>((counts, value) => {
      const key = value || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }

  private toDateOnly(date: Date) {
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }

  private buildInsightSummary(metrics: {
    tasksCompleted: number;
    tasksOverdue: number;
    habitCompletionRate: number;
    moodAverage: number | null;
    bestHabitStreak: { title: string; days: number } | null;
    mainFocusNextWeek: { title: string };
  }) {
    const insights: string[] = [];

    if (metrics.tasksCompleted > 0) {
      insights.push(`Completed ${metrics.tasksCompleted} task${metrics.tasksCompleted === 1 ? '' : 's'} this week`);
    }
    if (metrics.tasksOverdue > 0) {
      insights.push(`${metrics.tasksOverdue} missed task${metrics.tasksOverdue === 1 ? '' : 's'} need attention`);
    }
    if (metrics.habitCompletionRate >= 80) {
      insights.push('Habit consistency is strong');
    }
    if (metrics.bestHabitStreak) {
      insights.push(`${metrics.bestHabitStreak.title} had the best streak: ${metrics.bestHabitStreak.days} day${metrics.bestHabitStreak.days === 1 ? '' : 's'}`);
    }
    if (metrics.moodAverage !== null) {
      insights.push(`Average mood was ${metrics.moodAverage}`);
    }
    if (metrics.mainFocusNextWeek.title) {
      insights.push(`Main focus next week: ${metrics.mainFocusNextWeek.title}`);
    }

    return insights.length ? insights : ['No major weekly activity recorded yet'];
  }
}
