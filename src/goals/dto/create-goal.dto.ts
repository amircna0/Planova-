import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { LIFE_AREAS, LifeArea } from '../../common/life-areas';

export class CreateGoalDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(LIFE_AREAS)
  lifeArea?: LifeArea;

  @IsOptional()
  @IsIn(['annual', 'quarterly', 'monthly', 'weekly'])
  timeframe?: string;

  @IsOptional()
  @IsIn(['active', 'paused', 'completed', 'archived'])
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsInt()
  parentId?: number;
}
