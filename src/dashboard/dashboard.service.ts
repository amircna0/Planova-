import { Injectable } from '@nestjs/common';
import { GoalsService } from '../goals/goals.service';
import { HabitsService } from '../habits/habits.service';
import { ReportsService } from '../reports/reports.service';
import { TasksService } from '../tasks/tasks.service';
import { LIFE_AREAS } from '../common/life-areas';
import { PrismaService } from '../prisma.service';
import { toDateOnly } from '../common/date-utils';

@Injectable()
export class DashboardService {
  constructor(
    private tasksService: TasksService,
    private goalsService: GoalsService,
    private habitsService: HabitsService,
    private reportsService: ReportsService,
    private prisma: PrismaService,
  ) {}

  async getToday(userId: number, date: Date) {
    const isoDate = toDateOnly(date);
    const [todayTasks, unfinishedTasks, goals, habitSummary, weeklyReport] = await Promise.all([
      this.tasksService.findByDate(userId, date),
      this.tasksService.getUnfinished(userId, date),
      this.goalsService.findAll(userId),
      this.habitsService.getSummary(userId, isoDate, isoDate),
      this.reportsService.getWeeklyReport(userId, isoDate),
    ]);

    const activeGoals = goals.filter((goal) => goal.status === 'active');
    const completedTasks = todayTasks.filter((task) => task.status === 'done').length;
    const focusMinutes = todayTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
    const lifeAreas = LIFE_AREAS.map((lifeArea) => {
      const areaTasks = todayTasks.filter((task) => task.lifeArea === lifeArea);
      const areaGoals = activeGoals.filter((goal) => goal.lifeArea === lifeArea);
      const areaHabits = habitSummary.habits.filter((habit) => habit.lifeArea === lifeArea);
      const areaCompletedTasks = areaTasks.filter((task) => task.status === 'done').length;
      const taskCompletionRate = areaTasks.length ? Math.round((areaCompletedTasks / areaTasks.length) * 100) : 0;
      const goalProgress = areaGoals.length
        ? Math.round(areaGoals.reduce((sum, goal) => sum + goal.progress, 0) / areaGoals.length)
        : 0;
      const habitCompletionRate = areaHabits.length
        ? Math.round(areaHabits.reduce((sum, habit) => sum + habit.completionRate, 0) / areaHabits.length)
        : 0;
      const scoreParts = [
        areaTasks.length ? taskCompletionRate : null,
        areaGoals.length ? goalProgress : null,
        areaHabits.length ? habitCompletionRate : null,
      ].filter((score): score is number => typeof score === 'number');

      return {
        lifeArea,
        tasksToday: areaTasks.length,
        completedTasksToday: areaCompletedTasks,
        activeGoals: areaGoals.length,
        averageGoalProgress: goalProgress,
        habits: areaHabits.length,
        habitCompletionRate,
        score: scoreParts.length ? Math.round(scoreParts.reduce((sum, score) => sum + score, 0) / scoreParts.length) : 0,
      };
    });

    return {
      date: isoDate,
      tasks: {
        totalToday: todayTasks.length,
        completedToday: completedTasks,
        unfinished: unfinishedTasks.length,
        completionRate: todayTasks.length ? Math.round((completedTasks / todayTasks.length) * 100) : 0,
        focusMinutes,
        next: todayTasks.find((task) => task.status !== 'done') || null,
        items: todayTasks,
      },
      goals: {
        active: activeGoals.length,
        averageProgress: activeGoals.length
          ? Math.round(activeGoals.reduce((sum, goal) => sum + goal.progress, 0) / activeGoals.length)
          : 0,
        top: activeGoals.slice(0, 3),
      },
      habits: habitSummary,
      lifeAreas,
      weeklyReport,
    };
  }

  async getOverview(userId: number) {
    const [tasks, goals, habits, milestones, weeklyFocuses] = await Promise.all([
      this.prisma.task.findMany({ where: { userId } }),
      this.prisma.goal.findMany({ where: { userId } }),
      this.prisma.habit.findMany({ where: { userId } }),
      this.prisma.milestone.findMany({ where: { userId } }),
      this.prisma.weeklyFocus.findMany({ where: { userId } }),
    ]);

    const now = new Date();
    const lifeAreas = LIFE_AREAS.map((lifeArea) => {
      const areaTasks = tasks.filter((task) => task.lifeArea === lifeArea);
      const areaGoals = goals.filter((goal) => goal.lifeArea === lifeArea && goal.status !== 'archived');
      const areaHabits = habits.filter((habit) => habit.lifeArea === lifeArea);
      const goalIds = new Set(areaGoals.map((goal) => goal.id));
      const areaMilestones = milestones.filter((milestone) => goalIds.has(milestone.goalId));
      const areaWeeklyFocuses = weeklyFocuses.filter((focus) => goalIds.has(focus.goalId));
      const completedTasks = areaTasks.filter((task) => task.status === 'done').length;
      const overdueTasks = areaTasks.filter(
        (task) => task.status !== 'done' && task.dueDate && task.dueDate.getTime() < now.getTime(),
      ).length;
      const completedMilestones = areaMilestones.filter((milestone) => milestone.status === 'completed').length;
      const averageGoalProgress = areaGoals.length
        ? Math.round(areaGoals.reduce((sum, goal) => sum + goal.progress, 0) / areaGoals.length)
        : 0;
      const averageMilestoneProgress = areaMilestones.length
        ? Math.round(areaMilestones.reduce((sum, milestone) => sum + milestone.progress, 0) / areaMilestones.length)
        : 0;

      return {
        lifeArea,
        goals: areaGoals.length,
        averageGoalProgress,
        milestones: areaMilestones.length,
        completedMilestones,
        averageMilestoneProgress,
        weeklyFocuses: areaWeeklyFocuses.length,
        tasks: areaTasks.length,
        completedTasks,
        overdueTasks,
        habits: areaHabits.length,
        score: this.averageScore([
          areaGoals.length ? averageGoalProgress : null,
          areaMilestones.length ? averageMilestoneProgress : null,
          areaTasks.length ? Math.round((completedTasks / areaTasks.length) * 100) : null,
        ]),
      };
    });

    const activeGoals = goals.filter((goal) => goal.status === 'active');

    return {
      totals: {
        goals: goals.length,
        activeGoals: activeGoals.length,
        milestones: milestones.length,
        weeklyFocuses: weeklyFocuses.length,
        tasks: tasks.length,
        completedTasks: tasks.filter((task) => task.status === 'done').length,
        habits: habits.length,
      },
      lifeAreas,
      topLifeAreas: [...lifeAreas].sort((a, b) => b.score - a.score).slice(0, 3),
      needsAttention: lifeAreas
        .filter((area) => area.overdueTasks > 0 || (area.goals > 0 && area.score < 40))
        .sort((a, b) => b.overdueTasks - a.overdueTasks || a.score - b.score),
    };
  }

  private averageScore(values: Array<number | null>) {
    const scores = values.filter((value): value is number => typeof value === 'number');
    return scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
  }
}
