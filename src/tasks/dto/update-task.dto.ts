import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { LIFE_AREAS, LifeArea } from '../../common/life-areas';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(LIFE_AREAS)
  lifeArea?: LifeArea;

  @IsOptional()
  @IsIn(['todo', 'in_progress', 'done', 'split', 'no_longer_important'])
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  duration?: number;

  @IsOptional()
  @IsString()
  recurring?: string;

  @IsOptional()
  @IsInt()
  parentGoalId?: number;
}
