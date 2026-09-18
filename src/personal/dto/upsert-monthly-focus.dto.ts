import { IsString, Matches } from 'class-validator';

export class UpsertMonthlyFocusDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month!: string;

  @IsString()
  text!: string;
}
