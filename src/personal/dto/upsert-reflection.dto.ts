import { IsDateString, IsString } from 'class-validator';

export class UpsertReflectionDto {
  @IsDateString()
  date!: string;

  @IsString()
  text!: string;
}
