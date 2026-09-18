import { IsDateString, IsIn, IsInt, IsOptional, IsString, Matches } from 'class-validator';

export class CreateFocusBlockDto {
  @IsString()
  title!: string;

  @IsDateString()
  date!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime!: string;

  @IsOptional()
  @IsIn(['focus', 'break', 'meeting', 'personal'])
  type?: string;

  @IsOptional()
  @IsInt()
  taskId?: number;
}
