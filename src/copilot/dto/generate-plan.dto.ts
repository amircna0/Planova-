import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { LIFE_AREAS, LifeArea } from '../../common/life-areas';

export class GeneratePlanDto {
  @IsString()
  prompt!: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  workStart?: number;

  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(23)
  workEnd?: number;

  @IsOptional()
  @IsIn(LIFE_AREAS)
  defaultLifeArea?: LifeArea;
}
