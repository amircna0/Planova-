import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateImportantDateDto } from './dto/create-important-date.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';
import { UpsertMonthlyFocusDto } from './dto/upsert-monthly-focus.dto';
import { UpsertReflectionDto } from './dto/upsert-reflection.dto';
import { toUtcDayStart } from '../common/date-utils';

@Injectable()
export class PersonalService {
  constructor(private prisma: PrismaService) {}

  getNotes(userId: number, month?: string) {
    return this.prisma.note.findMany({
      where: { userId, ...(month !== undefined && { month }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  createNote(userId: number, dto: CreateNoteDto) {
    return this.prisma.note.create({
      data: { userId, text: dto.text, month: dto.month },
    });
  }

  async deleteNote(userId: number, noteId: number) {
    await this.ensureOwner('note', userId, noteId);
    return this.prisma.note.delete({ where: { id: noteId } });
  }

  getImportantDates(userId: number) {
    return this.prisma.importantDate.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });
  }

  createImportantDate(userId: number, dto: CreateImportantDateDto) {
    return this.prisma.importantDate.create({
      data: { userId, title: dto.title, date: toUtcDayStart(dto.date) },
    });
  }

  async deleteImportantDate(userId: number, dateId: number) {
    await this.ensureOwner('importantDate', userId, dateId);
    return this.prisma.importantDate.delete({ where: { id: dateId } });
  }

  getReflections(userId: number) {
    return this.prisma.reflection.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  upsertReflection(userId: number, dto: UpsertReflectionDto) {
    const date = toUtcDayStart(dto.date);

    return this.prisma.reflection.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, text: dto.text },
      update: { text: dto.text },
    });
  }

  getMonthlyFocuses(userId: number) {
    return this.prisma.monthlyFocus.findMany({
      where: { userId },
      orderBy: { month: 'desc' },
    });
  }

  upsertMonthlyFocus(userId: number, dto: UpsertMonthlyFocusDto) {
    return this.prisma.monthlyFocus.upsert({
      where: { userId_month: { userId, month: dto.month } },
      create: { userId, month: dto.month, text: dto.text },
      update: { text: dto.text },
    });
  }

  async getBudget(userId: number, month: string) {
    return this.prisma.budgetMonth.upsert({
      where: { userId_month: { userId, month } },
      create: { userId, month, total: 0 },
      update: {},
      include: { expenses: { orderBy: { createdAt: 'desc' } } },
    });
  }

  upsertBudget(userId: number, dto: UpsertBudgetDto) {
    return this.prisma.budgetMonth.upsert({
      where: { userId_month: { userId, month: dto.month } },
      create: { userId, month: dto.month, total: dto.total },
      update: { total: dto.total },
      include: { expenses: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async createExpense(userId: number, dto: CreateExpenseDto) {
    const budget = await this.getBudget(userId, dto.month);

    return this.prisma.expense.create({
      data: { budgetId: budget.id, name: dto.name, amount: dto.amount },
    });
  }

  async deleteExpense(userId: number, expenseId: number) {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, budget: { userId } },
    });

    if (!expense) {
      throw new ForbiddenException('Expense does not belong to this user');
    }

    return this.prisma.expense.delete({ where: { id: expenseId } });
  }

  private async ensureOwner(model: 'note' | 'importantDate', userId: number, id: number) {
    const record =
      model === 'note'
        ? await this.prisma.note.findFirst({ where: { id, userId }, select: { id: true } })
        : await this.prisma.importantDate.findFirst({ where: { id, userId }, select: { id: true } });

    if (!record) {
      throw new ForbiddenException('Record does not belong to this user');
    }
  }
}
