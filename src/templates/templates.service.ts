import { Injectable } from '@nestjs/common';
import { USER_MODES, UserMode } from '../common/user-modes';
import { GoalsService } from '../goals/goals.service';
import { HabitsService } from '../habits/habits.service';
import { TasksService } from '../tasks/tasks.service';
import { STARTER_TEMPLATES } from './starter-templates';
import { toDateOnly } from '../common/date-utils';

@Injectable()
export class TemplatesService {
  constructor(
    private goalsService: GoalsService,
    private habitsService: HabitsService,
    private tasksService: TasksService,
  ) {}

  listStarterTemplates() {
    return USER_MODES.map((mode) => STARTER_TEMPLATES[mode]);
  }

  async applyStarterTemplate(userId: number, mode: UserMode) {
    const template = STARTER_TEMPLATES[mode];
    const today = toDateOnly(new Date());

    const goals: Awaited<ReturnType<GoalsService['create']>>[] = [];
    const habits: Awaited<ReturnType<HabitsService['create']>>[] = [];
    const tasks: Awaited<ReturnType<TasksService['create']>>[] = [];

    for (const goal of template.goals) {
      goals.push(
        await this.goalsService.create(userId, {
          title: goal.title,
          timeframe: 'annual',
          lifeArea: goal.lifeArea,
        }),
      );
    }

    for (const habit of template.habits) {
      habits.push(await this.habitsService.create(userId, habit));
    }

    for (const task of template.tasks) {
      tasks.push(
        await this.tasksService.create(userId, {
          title: task.title,
          priority: task.priority,
          duration: task.duration,
          lifeArea: task.lifeArea,
          dueDate: today,
        }),
      );
    }

    return {
      mode,
      goals,
      habits,
      tasks,
    };
  }
}
