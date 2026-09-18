import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class ClientLogDto {
  @IsIn(['error', 'warn', 'info'])
  level!: 'error' | 'warn' | 'info';

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
