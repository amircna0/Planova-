import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateImportantDateDto } from './dto/create-important-date.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';
import { UpsertMonthlyFocusDto } from './dto/upsert-monthly-focus.dto';
import { UpsertReflectionDto } from './dto/upsert-reflection.dto';
import { PersonalService } from './personal.service';

@Controller('personal')
@UseGuards(AuthGuard('jwt'))
export class PersonalController {
  constructor(private personalService: PersonalService) {}

  @Get('notes')
  getNotes(@Req() req: any, @Query('month') month?: string) {
    return this.personalService.getNotes(req.user.id, month);
  }

  @Post('notes')
  createNote(@Req() req: any, @Body() dto: CreateNoteDto) {
    return this.personalService.createNote(req.user.id, dto);
  }

  @Delete('notes/:id')
  deleteNote(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.personalService.deleteNote(req.user.id, id);
  }

  @Get('dates')
  getImportantDates(@Req() req: any) {
    return this.personalService.getImportantDates(req.user.id);
  }

  @Post('dates')
  createImportantDate(@Req() req: any, @Body() dto: CreateImportantDateDto) {
    return this.personalService.createImportantDate(req.user.id, dto);
  }

  @Delete('dates/:id')
  deleteImportantDate(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.personalService.deleteImportantDate(req.user.id, id);
  }

  @Get('reflections')
  getReflections(@Req() req: any) {
    return this.personalService.getReflections(req.user.id);
  }

  @Put('reflections')
  upsertReflection(@Req() req: any, @Body() dto: UpsertReflectionDto) {
    return this.personalService.upsertReflection(req.user.id, dto);
  }

  @Get('monthly-focus')
  getMonthlyFocuses(@Req() req: any) {
    return this.personalService.getMonthlyFocuses(req.user.id);
  }

  @Put('monthly-focus')
  upsertMonthlyFocus(@Req() req: any, @Body() dto: UpsertMonthlyFocusDto) {
    return this.personalService.upsertMonthlyFocus(req.user.id, dto);
  }

  @Get('budget')
  getBudget(@Req() req: any, @Query('month') month: string) {
    return this.personalService.getBudget(req.user.id, month);
  }

  @Put('budget')
  upsertBudget(@Req() req: any, @Body() dto: UpsertBudgetDto) {
    return this.personalService.upsertBudget(req.user.id, dto);
  }

  @Post('budget/expenses')
  createExpense(@Req() req: any, @Body() dto: CreateExpenseDto) {
    return this.personalService.createExpense(req.user.id, dto);
  }

  @Delete('budget/expenses/:id')
  deleteExpense(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.personalService.deleteExpense(req.user.id, id);
  }
}
