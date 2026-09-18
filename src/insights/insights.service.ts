import { Injectable } from '@nestjs/common';
import { LIFE_AREAS } from '../common/life-areas';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma.service';
import { addUtcDays, toDateOnly, toUtcDayEnd, toUtcDayStart } from '../common/date-utils';

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService, private plansService: PlansService) {}

  async getHabitMoodInsights(userId: number, days = 30) {
    await this.plansService.assertFeature(userId, 'advanced_analytics');

    const range = this.dateRange(days);
    const habits = await this.prisma.habit.findMany({
      where: { userId },
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
    });

    const logs = habits.flatMap((habit) =>
      habit.logs.map((log) => ({
        ...log,
        habitTitle: habit.title,
        habitCategory: habit.category,
        lifeArea: habit.lifeArea,
      })),
    );
    const completedLogs = logs.filter((log) => log.completed);
    const missedLogs = logs.filter((log) => !log.completed);
    const moodLogs = logs.filter((log) => typeof log.mood === 'number');
    const completedMoodLogs = completedLogs.filter((log) => typeof log.mood === 'number');
    const missedMoodLogs = missedLogs.filter((log) => typeof log.mood === 'number');
    const moodOnCompletedDays = this.average(completedMoodLogs.map((log) => log.mood as number));
    const moodOnMissedDays = this.average(missedMoodLogs.map((log) => log.mood as number));

    return {
      range: {
        start: toDateOnly(range.start),
        end: toDateOnly(range.end),
        days,
      },
      totals: {
        habits: habits.length,
        logs: logs.length,
        completed: completedLogs.length,
        missed: missedLogs.length,
        completionRate: logs.length ? Math.round((completedLogs.length / logs.length) * 100) : 0,
        moodAverage: this.average(moodLogs.map((log) => log.mood as number)),
      },
      moodPattern: {
        averageOnCompletedHabits: moodOnCompletedDays,
        averageOnMissedHabits: moodOnMissedDays,
        difference: moodOnCompletedDays !== null && moodOnMissedDays !== null
          ? Number((moodOnCompletedDays - moodOnMissedDays).toFixed(2))
          : null,
      },
      bestDay: this.bestDayByCompletion(logs),
      lifeAreas: this.lifeAreaBreakdown(logs),
      habitStreaks: habits.map((habit) => ({
        habitId: habit.id,
        title: habit.title,
        currentStreak: this.currentStreak(habit.logs),
        completionRate: habit.logs.length
          ? Math.round((habit.logs.filter((log) => log.completed).length / habit.logs.length) * 100)
          : 0,
      })),
      insights: this.buildInsightMessages(logs, moodOnCompletedDays, moodOnMissedDays),
    };
  }

  private dateRange(days: number) {
    const normalizedDays = Math.min(Math.max(days, 7), 90);
    const end = toUtcDayEnd(new Date());
    const start = addUtcDays(end, -normalizedDays + 1);

    return { start, end };
  }

  private average(values: number[]) {
    if (!values.length) {
      return null;
    }

    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
  }

  private bestDayByCompletion(logs: Array<{ date: Date; completed: boolean }>) {
    const days = logs.reduce<Record<string, { total: number; completed: number }>>((result, log) => {
      const key = log.date.toLocaleDateString('en-US', { weekday: 'long' });
      result[key] = result[key] || { total: 0, completed: 0 };
      result[key].total += 1;
      result[key].completed += log.completed ? 1 : 0;
      return result;
    }, {});

    return Object.entries(days)
      .map(([day, value]) => ({
        day,
        completionRate: Math.round((value.completed / value.total) * 100),
        completed: value.completed,
        total: value.total,
      }))
      .sort((a, b) => b.completionRate - a.completionRate || b.completed - a.completed)[0] || null;
  }

  private lifeAreaBreakdown(logs: Array<{ lifeArea: string | null; completed: boolean; mood: number | null }>) {
    return LIFE_AREAS.map((lifeArea) => {
      const areaLogs = logs.filter((log) => log.lifeArea === lifeArea);
      const completed = areaLogs.filter((log) => log.completed).length;
      const moodValues = areaLogs
        .map((log) => log.mood)
        .filter((mood): mood is number => typeof mood === 'number');

      return {
        lifeArea,
        logs: areaLogs.length,
        completed,
        completionRate: areaLogs.length ? Math.round((completed / areaLogs.length) * 100) : 0,
        moodAverage: this.average(moodValues),
      };
    });
  }

  private currentStreak(logs: Array<{ date: Date; completed: boolean }>) {
    const byDay = new Map(logs.map((log) => [toDateOnly(log.date), log.completed]));
    let cursor = toUtcDayStart(new Date());
    let streak = 0;

    while (byDay.get(toDateOnly(cursor))) {
      streak += 1;
      cursor = addUtcDays(cursor, -1);
    }

    return streak;
  }

  private buildInsightMessages(
    logs: Array<{ completed: boolean }>,
    moodOnCompletedDays: number | null,
    moodOnMissedDays: number | null,
  ) {
    const messages: string[] = [];
    const completed = logs.filter((log) => log.completed).length;
    const completionRate = logs.length ? Math.round((completed / logs.length) * 100) : 0;

    if (!logs.length) {
      return ['Log habits and mood for a few days to unlock meaningful patterns'];
    }

    if (completionRate >= 80) {
      messages.push('Habit consistency is strong across this period');
    } else if (completionRate < 50) {
      messages.push('Habit consistency is below 50%, so smaller daily targets may help');
    }

    if (moodOnCompletedDays !== null && moodOnMissedDays !== null) {
      const diff = moodOnCompletedDays - moodOnMissedDays;

      if (diff >= 0.5) {
        messages.push(`Mood is ${diff.toFixed(1)} points higher on completed-habit days`);
      } else if (diff <= -0.5) {
        messages.push('Mood is lower on completed-habit days, so check whether goals are too intense');
      }
    }

    return messages.length ? messages : ['Patterns are forming, but the data is still balanced'];
  }
}
