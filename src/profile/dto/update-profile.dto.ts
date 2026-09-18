import { IsIn, IsOptional, IsString } from 'class-validator';
import { USER_MODES, UserMode } from '../../common/user-modes';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(USER_MODES)
  mode?: UserMode;
}
