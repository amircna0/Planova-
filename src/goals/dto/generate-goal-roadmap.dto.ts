import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GenerateGoalRoadmapDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  months?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  weeksPerMilestone?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  tasksPerWeek?: number;
}
