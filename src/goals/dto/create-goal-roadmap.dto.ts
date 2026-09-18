import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class RoadmapTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  duration?: number;
}

class RoadmapWeeklyFocusDto {
  @IsString()
  title!: string;

  @IsDateString()
  weekStart!: string;

  @IsDateString()
  weekEnd!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => RoadmapTaskDto)
  tasks?: RoadmapTaskDto[];
}

class RoadmapMilestoneDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  targetMonth?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => RoadmapWeeklyFocusDto)
  weeklyFocuses?: RoadmapWeeklyFocusDto[];
}

export class CreateGoalRoadmapDto {
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => RoadmapMilestoneDto)
  milestones!: RoadmapMilestoneDto[];
}
