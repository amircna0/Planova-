import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { USER_MODES, UserMode } from '../../common/user-modes';

export class CompleteOnboardingDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsIn(USER_MODES)
  mode!: UserMode;

  @IsOptional()
  @IsBoolean()
  applyTemplate?: boolean;
}
