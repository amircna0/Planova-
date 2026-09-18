import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Milestone, Task, WeeklyFocus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { CreateGoalRoadmapDto } from './dto/create-goal-roadmap.dto';
import { GenerateGoalRoadmapDto } from './dto/generate-goal-roadmap.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { PlansService } from '../plans/plans.service';

const GOAL_ORDER = ['annual', 'quarterly', 'monthly', 'weekly'];

type CreatedWeeklyFocus = WeeklyFocus & { tasks: Task[] };
type CreatedMilestone = Milestone & { weeklyFocuses: CreatedWeeklyFocus[] };

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService, private plansService: PlansService) {}

  async create(userId: number, dto: CreateGoalDto) {
    await this.plansService.assertWithinLimit(userId, 'goals');

    const timeframe = dto.timeframe || 'annual';
    await this.validateHierarchy(userId, timeframe, dto.parentId);

    return this.prisma.goal.create({
      data: {
        ...dto,
        timeframe,
        userId,
      },
    });
  }

  async findAll(userId: number, filters?: { timeframe?: string; lifeArea?: string }) {
    return this.prisma.goal.findMany({
      where: {
        userId,
        ...(filters?.timeframe && { timeframe: filters.timeframe }),
        ...(filters?.lifeArea && { lifeArea: filters.lifeArea }),
      },
      include: {
        parentGoal: true,
        subGoals: true,
        tasks: true,
        milestones: {
          include: {
            weeklyFocuses: {
              include: { tasks: true },
              orderBy: [{ weekStart: 'asc' }, { order: 'asc' }],
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: [{ timeframe: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getHierarchy(userId: number) {
    return this.prisma.goal.findMany({
      where: {
        userId,
        timeframe: 'annual',
        parentId: null,
      },
      include: {
        subGoals: {
          where: { timeframe: { in: ['quarterly', 'monthly'] } },
          include: {
            subGoals: {
              where: { timeframe: { in: ['monthly', 'weekly'] } },
              include: {
                subGoals: {
                  where: { timeframe: 'weekly' },
                  include: { tasks: true },
                  orderBy: { createdAt: 'desc' },
                },
                tasks: true,
              },
              orderBy: { createdAt: 'desc' },
            },
            tasks: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        tasks: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: number, goalId: number) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
      include: {
        parentGoal: true,
        subGoals: true,
        tasks: true,
        milestones: {
          include: {
            weeklyFocuses: {
              include: { tasks: true },
              orderBy: [{ weekStart: 'asc' }, { order: 'asc' }],
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    return goal;
  }

  async getRoadmap(userId: number, goalId: number) {
    await this.ensureGoalOwner(userId, goalId);

    const milestones = await this.prisma.milestone.findMany({
      where: { userId, goalId },
      include: {
        weeklyFocuses: {
          include: {
            tasks: {
              orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }, { createdAt: 'asc' }],
            },
          },
          orderBy: [{ weekStart: 'asc' }, { order: 'asc' }],
        },
      },
      orderBy: { order: 'asc' },
    });

    return { goalId, milestones };
  }

  async createRoadmap(userId: number, goalId: number, dto: CreateGoalRoadmapDto) {
    const goal = await this.ensureGoalOwner(userId, goalId);

    if (!dto.milestones.length) {
      throw new BadRequestException('Roadmap requires at least one milestone');
    }

    const taskCount = dto.milestones.reduce(
      (total, milestone) =>
        total +
        (milestone.weeklyFocuses || []).reduce((weekTotal, week) => weekTotal + (week.tasks?.length || 0), 0),
      0,
    );

    await this.plansService.assertWithinAvailableLimit(userId, 'tasks', taskCount);

    return this.prisma.$transaction(async (tx) => {
      const milestones: CreatedMilestone[] = [];

      for (const [milestoneIndex, milestoneDto] of dto.milestones.entries()) {
        const milestone = await tx.milestone.create({
          data: {
            userId,
            goalId: goal.id,
            title: milestoneDto.title,
            description: milestoneDto.description,
            targetMonth: milestoneDto.targetMonth,
            dueDate: milestoneDto.dueDate ? this.toDayStart(new Date(milestoneDto.dueDate)) : undefined,
            order: milestoneIndex + 1,
          },
        });

        const weeklyFocuses: CreatedWeeklyFocus[] = [];

        for (const [weekIndex, weekDto] of (milestoneDto.weeklyFocuses || []).entries()) {
          const weeklyFocus = await tx.weeklyFocus.create({
            data: {
              userId,
              goalId: goal.id,
              milestoneId: milestone.id,
              title: weekDto.title,
              weekStart: this.toDayStart(new Date(weekDto.weekStart)),
              weekEnd: this.toDayEnd(new Date(weekDto.weekEnd)),
              order: weekIndex + 1,
            },
          });

          const tasks: Task[] = [];

          for (const [taskIndex, taskDto] of (weekDto.tasks || []).entries()) {
            const task = await tx.task.create({
              data: {
                userId,
                parentGoalId: goal.id,
                weeklyFocusId: weeklyFocus.id,
                title: taskDto.title,
                lifeArea: goal.lifeArea,
                priority: taskDto.priority || taskIndex + 1,
                duration: taskDto.duration,
                dueDate: taskDto.dueDate ? this.toDayStart(new Date(taskDto.dueDate)) : weeklyFocus.weekStart,
                description: `Created from goal roadmap: ${goal.title}`,
              },
            });

            tasks.push(task);
          }

          weeklyFocuses.push({ ...weeklyFocus, tasks });
        }

        milestones.push({ ...milestone, weeklyFocuses });
      }

      return {
        goal,
        milestones,
        created: {
          milestones: milestones.length,
          weeklyFocuses: milestones.reduce((total, milestone) => total + milestone.weeklyFocuses.length, 0),
          tasks: milestones.reduce(
            (total, milestone) =>
              total + milestone.weeklyFocuses.reduce((weekTotal, week) => weekTotal + week.tasks.length, 0),
            0,
          ),
        },
      };
    });
  }

  async generateRoadmap(userId: number, goalId: number, dto: GenerateGoalRoadmapDto) {
    const goal = await this.ensureGoalOwner(userId, goalId);
    const startDate = this.toDayStart(dto.startDate ? new Date(dto.startDate) : new Date());
    const months = dto.months || 3;
    const weeksPerMilestone = dto.weeksPerMilestone || 3;
    const tasksPerWeek = dto.tasksPerWeek || 3;

    const roadmap: CreateGoalRoadmapDto = {
      milestones: Array.from({ length: months }, (_, milestoneIndex) => {
        const milestoneStart = this.addDays(startDate, milestoneIndex * weeksPerMilestone * 7);
        const milestoneEnd = this.addDays(milestoneStart, weeksPerMilestone * 7 - 1);

        return {
          title: this.buildMilestoneTitle(goal.title, milestoneIndex),
          description: `Milestone ${milestoneIndex + 1} for ${goal.title}`,
          targetMonth: this.toMonthKey(milestoneStart),
          dueDate: this.toDateOnly(milestoneEnd),
          weeklyFocuses: Array.from({ length: weeksPerMilestone }, (_, weekIndex) => {
            const weekStart = this.addDays(milestoneStart, weekIndex * 7);
            const weekEnd = this.addDays(weekStart, 6);

            return {
              title: this.buildWeeklyFocusTitle(goal.title, milestoneIndex, weekIndex),
              weekStart: this.toDateOnly(weekStart),
              weekEnd: this.toDateOnly(weekEnd),
              tasks: Array.from({ length: tasksPerWeek }, (_, taskIndex) => ({
                title: this.buildRoadmapTaskTitle(goal.title, milestoneIndex, weekIndex, taskIndex),
                dueDate: this.toDateOnly(this.addDays(weekStart, Math.min(taskIndex * 2, 6))),
                priority: Math.min(taskIndex + 1, 5),
                duration: taskIndex === 0 ? 90 : 45,
              })),
            };
          }),
        };
      }),
    };

    return this.createRoadmap(userId, goalId, roadmap);
  }

  async update(userId: number, goalId: number, dto: UpdateGoalDto) {
    const current = await this.ensureGoalOwner(userId, goalId);
    const timeframe = dto.timeframe || current.timeframe;
    const parentId = dto.parentId === undefined ? current.parentId : dto.parentId;

    await this.validateHierarchy(userId, timeframe, parentId, goalId);

    return this.prisma.goal.update({
      where: { id: goalId },
      data: dto,
    });
  }

  async remove(userId: number, goalId: number) {
    await this.ensureGoalOwner(userId, goalId);
    return this.prisma.goal.delete({
      where: { id: goalId },
    });
  }

  private async ensureGoalOwner(userId: number, goalId: number) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new ForbiddenException('Goal does not belong to this user');
    }

    return goal;
  }

  private async validateHierarchy(userId: number, timeframe: string, parentId?: number | null, goalId?: number) {
    if (!GOAL_ORDER.includes(timeframe)) {
      throw new BadRequestException('Goal timeframe must be annual, quarterly, monthly, or weekly');
    }

    if (timeframe === 'annual' && parentId) {
      throw new BadRequestException('Annual goals cannot have a parent goal');
    }

    if (timeframe !== 'annual' && !parentId) {
      throw new BadRequestException(`${timeframe} goals must have a parent goal`);
    }

    if (!parentId) {
      return;
    }

    if (parentId === goalId) {
      throw new BadRequestException('A goal cannot be its own parent');
    }

    const parent = await this.ensureGoalOwner(userId, parentId);
    const allowedParents = this.allowedParentTimeframes(timeframe);

    if (!allowedParents.includes(parent.timeframe)) {
      throw new BadRequestException(`${timeframe} goals must belong to: ${allowedParents.join(' or ')}`);
    }
  }

  private allowedParentTimeframes(timeframe: string) {
    if (timeframe === 'quarterly') {
      return ['annual'];
    }

    if (timeframe === 'monthly') {
      return ['annual', 'quarterly'];
    }

    if (timeframe === 'weekly') {
      return ['monthly'];
    }

    return [];
  }

  private toDayStart(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  }

  private toDayEnd(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
  }

  private addDays(date: Date, days: number) {
    const value = new Date(date);
    value.setUTCDate(value.getUTCDate() + days);
    return value;
  }

  private toMonthKey(date: Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private toDateOnly(date: Date) {
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }

  private buildMilestoneTitle(goalTitle: string, index: number) {
    const phases = ['Clarify the target', 'Build consistent progress', 'Ship visible proof', 'Review and improve'];
    return `${phases[index % phases.length]}: ${goalTitle}`;
  }

  private buildWeeklyFocusTitle(goalTitle: string, milestoneIndex: number, weekIndex: number) {
    const weeklyActions = ['Plan', 'Execute', 'Review', 'Improve'];
    return `${weeklyActions[weekIndex % weeklyActions.length]} ${goalTitle} - month ${milestoneIndex + 1}`;
  }

  private buildRoadmapTaskTitle(goalTitle: string, milestoneIndex: number, weekIndex: number, taskIndex: number) {
    const taskActions = ['Define next outcome for', 'Work deeply on', 'Review progress for', 'Prepare next step for', 'Document wins for'];
    return `${taskActions[taskIndex % taskActions.length]} ${goalTitle} (M${milestoneIndex + 1} W${weekIndex + 1})`;
  }
}
