import { IsIn, IsOptional, IsString } from 'class-validator';
import { LIFE_AREAS, LifeArea } from '../../common/life-areas';

export class UpdateHabitDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  frequency?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(LIFE_AREAS)
  lifeArea?: LifeArea;
}
