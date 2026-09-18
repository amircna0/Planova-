import { IsNumber, IsString, Matches, Min } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month!: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;
}
