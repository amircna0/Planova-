import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { USER_MODES, UserMode } from '../user-modes';

@Injectable()
export class UserModePipe implements PipeTransform<string, UserMode> {
  transform(value: string): UserMode {
    if (!USER_MODES.includes(value as UserMode)) {
      throw new BadRequestException('Invalid starter template mode');
    }

    return value as UserMode;
  }
}
