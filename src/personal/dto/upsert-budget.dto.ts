import { IsNumber, IsString, Matches, Min } from 'class-validator';

export class UpsertBudgetDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month!: string;

  @IsNumber()
  @Min(0)
  total!: number;
}
