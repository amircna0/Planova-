import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class LogHabitDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  mood?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
