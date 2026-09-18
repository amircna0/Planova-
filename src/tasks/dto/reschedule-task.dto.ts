import { ArrayMinSize, IsArray, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export type RescheduleAction = 'tomorrow' | 'weekend' | 'custom' | 'split' | 'delete' | 'no_longer_important';

export class RescheduleTaskDto {
  @IsIn(['tomorrow', 'weekend', 'custom', 'split', 'delete', 'no_longer_important'])
  action!: RescheduleAction;

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
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  parts?: string[];
}
