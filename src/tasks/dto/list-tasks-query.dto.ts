import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { LIFE_AREAS, LifeArea } from '../../common/life-areas';

export class ListTasksQueryDto {
  @IsOptional()
  @IsIn(['todo', 'in_progress', 'done', 'split', 'no_longer_important'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(LIFE_AREAS)
  lifeArea?: LifeArea;

  @IsOptional()
  @IsDateString()
  date?: string;
}
