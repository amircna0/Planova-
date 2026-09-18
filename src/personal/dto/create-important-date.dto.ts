import { IsDateString, IsString } from 'class-validator';

export class CreateImportantDateDto {
  @IsDateString()
  date!: string;

  @IsString()
  title!: string;
}
