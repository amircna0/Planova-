import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { FocusBlock, Task } from '@prisma/client';
import OpenAI from 'openai';
import { LIFE_AREAS, LifeArea } from '../common/life-areas';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { GeneratePlanDto } from './dto/generate-plan.dto';
import { CopilotPlan, CopilotTaskDraft } from './copilot.types';
import { combineUtcDateAndTime, toDateOnly } from '../common/date-utils';

type CreatedFocusBlock = FocusBlock & { task: Task | null };

@Injectable()
export class CopilotService {
  private openai?: OpenAI;

  constructor(
    private plansService: PlansService,
    private tasksService: TasksService,
    private prisma: PrismaService,
  ) {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  async generatePlan(userId: number, dto: GeneratePlanDto): Promise<CopilotPlan> {
    await this.plansService.assertFeature(userId, 'ai_planner');

    const date = dto.date || toDateOnly(new Date());

    if (!this.openai) {
      return this.generateFallbackPlan(dto, date);
    }

    try {
      return await this.generateOpenAIPlan(dto, date);
    } catch {
      return this.generateFallbackPlan(dto, date);
    }
  }

  async applyPlan(userId: number, dto: GeneratePlanDto) {
    const plan = await this.generatePlan(userId, dto);
    const createdTasks: Awaited<ReturnType<TasksService['create']>>[] = [];
    const createdFocusBlocks: CreatedFocusBlock[] = [];

    for (const task of plan.tasks) {
      createdTasks.push(
        await this.tasksService.create(userId, {
          title: task.title,
          priority: task.priority,
          duration: task.duration,
          category: task.category,
          lifeArea: task.lifeArea,
          dueDate: plan.date,
        }),
      );
    }

    for (const [index, block] of plan.focusBlocks.entries()) {
      if (!this.isClockTime(block.startTime) || !this.isClockTime(block.endTime)) {
        continue;
      }

      const start = this.combineDateAndTime(plan.date, block.startTime);
      const end = this.combineDateAndTime(plan.date, block.endTime);

      if (end.getTime() <= start.getTime()) {
        continue;
      }

      const task = createdTasks[index];

      if (task) {
        createdTasks[index] = await this.prisma.task.update({
          where: { id: task.id },
          data: { startTime: start, endTime: end },
        });
      }

      createdFocusBlocks.push(
        await this.prisma.focusBlock.create({
          data: {
            userId,
            taskId: task?.id,
            title: block.title,
            start,
            end,
            type: 'focus',
          },
          include: { task: true },
        }),
      );
    }

    for (const block of plan.breaks) {
      if (!this.isClockTime(block.startTime) || !this.isClockTime(block.endTime)) {
        continue;
      }

      const start = this.combineDateAndTime(plan.date, block.startTime);
      const end = this.combineDateAndTime(plan.date, block.endTime);

      if (end.getTime() <= start.getTime()) {
        continue;
      }

      createdFocusBlocks.push(
        await this.prisma.focusBlock.create({
          data: {
            userId,
            title: 'Break',
            start,
            end,
            type: 'break',
          },
          include: { task: true },
        }),
      );
    }

    return {
      plan,
      createdTasks,
      createdFocusBlocks,
    };
  }

  private async generateOpenAIPlan(dto: GeneratePlanDto, date: string): Promise<CopilotPlan> {
    if (!this.openai) {
      throw new ServiceUnavailableException('OpenAI client is not configured');
    }

    const response = await this.openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.6',
      input: [
        {
          role: 'system',
          content:
            'You create realistic daily productivity plans. Return only valid JSON matching this shape: { "topPriorities": string[], "tasks": [{ "title": string, "priority": number, "duration": number, "category": string, "lifeArea": string }], "focusBlocks": [{ "title": string, "startTime": "HH:mm", "endTime": "HH:mm" }], "breaks": [{ "startTime": "HH:mm", "endTime": "HH:mm" }], "reminders": string[], "rescheduleAdvice": string[] }. Use lifeArea only from: career, health, money, learning, relationships, personal_growth.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            date,
            workStart: dto.workStart || 9,
            workEnd: dto.workEnd || 18,
            defaultLifeArea: dto.defaultLifeArea || 'career',
            prompt: dto.prompt,
          }),
        },
      ],
    });

    return this.normalizePlan(JSON.parse(response.output_text), date, 'openai', dto.defaultLifeArea);
  }

  private generateFallbackPlan(dto: GeneratePlanDto, date: string): CopilotPlan {
    const defaultLifeArea = dto.defaultLifeArea || 'career';
    const tasks = this.extractFallbackTasks(dto.prompt, defaultLifeArea);
    const workStart = dto.workStart || 9;
    const focusBlocks = this.buildFocusBlocks(tasks, workStart);

    return {
      source: 'fallback',
      date,
      topPriorities: tasks.slice(0, 3).map((task) => task.title),
      tasks,
      focusBlocks,
      breaks: this.buildBreaks(focusBlocks),
      reminders: ['Review the plan before starting', 'Mark tasks done as soon as you finish them'],
      rescheduleAdvice: ['Move unfinished tasks before the day ends', 'Split any task that feels unclear after 20 minutes'],
    };
  }

  private extractFallbackTasks(prompt: string, defaultLifeArea: LifeArea): CopilotTaskDraft[] {
    const parts = prompt
      .split(/,| and |&|\n/i)
      .map((part) => part.trim())
      .filter(Boolean);

    const drafts = (parts.length ? parts : [prompt]).slice(0, 8).map((part, index) => ({
      title: this.toTaskTitle(part),
      priority: Math.min(index + 1, 5),
      duration: index < 3 ? 60 : 30,
      category: index < 3 ? 'priority' : 'support',
      lifeArea: this.guessLifeArea(part, defaultLifeArea),
    }));

    return drafts.length ? drafts : [{ title: 'Plan the day', priority: 1, duration: 30, lifeArea: defaultLifeArea }];
  }

  private toTaskTitle(text: string) {
    const cleaned = text.replace(/^i\s+(have|need|want|must|should)\s+/i, '').trim();
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  private guessLifeArea(text: string, fallback: LifeArea): LifeArea {
    const value = text.toLowerCase();

    if (/gym|workout|health|sleep|run|fitness/.test(value)) return 'health';
    if (/exam|study|learn|course|assignment/.test(value)) return 'learning';
    if (/money|invoice|client|income|budget/.test(value)) return 'money';
    if (/friend|family|partner|couple|relationship/.test(value)) return 'relationships';
    if (/journal|meditate|reflect|growth/.test(value)) return 'personal_growth';
    return fallback;
  }

  private buildFocusBlocks(tasks: CopilotTaskDraft[], workStart: number) {
    let cursor = workStart * 60;

    return tasks.slice(0, 5).map((task) => {
      const start = cursor;
      const end = cursor + task.duration;
      cursor = end + 10;

      return {
        title: task.title,
        startTime: this.minutesToTime(start),
        endTime: this.minutesToTime(end),
      };
    });
  }

  private buildBreaks(focusBlocks: CopilotPlan['focusBlocks']) {
    return focusBlocks.slice(0, -1).map((block) => ({
      startTime: block.endTime,
      endTime: this.minutesToTime(this.timeToMinutes(block.endTime) + 10),
    }));
  }

  private normalizePlan(value: any, date: string, source: CopilotPlan['source'], defaultLifeArea?: LifeArea): CopilotPlan {
    const tasks = Array.isArray(value.tasks) ? value.tasks : [];

    return {
      source,
      date,
      topPriorities: Array.isArray(value.topPriorities) ? value.topPriorities.slice(0, 3).map(String) : [],
      tasks: tasks.slice(0, 10).map((task: any, index: number) => ({
        title: String(task.title || `Task ${index + 1}`),
        priority: Math.min(Math.max(Number(task.priority) || index + 1, 1), 5),
        duration: Math.min(Math.max(Number(task.duration) || 30, 5), 240),
        category: task.category ? String(task.category) : undefined,
        lifeArea: LIFE_AREAS.includes(task.lifeArea) ? task.lifeArea : defaultLifeArea,
      })),
      focusBlocks: Array.isArray(value.focusBlocks) ? value.focusBlocks : [],
      breaks: Array.isArray(value.breaks) ? value.breaks : [],
      reminders: Array.isArray(value.reminders) ? value.reminders.map(String) : [],
      rescheduleAdvice: Array.isArray(value.rescheduleAdvice) ? value.rescheduleAdvice.map(String) : [],
    };
  }

  private minutesToTime(minutes: number) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  private timeToMinutes(time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private isClockTime(time: string) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  }

  private combineDateAndTime(date: string, time: string) {
    return combineUtcDateAndTime(date, time);
  }
}
