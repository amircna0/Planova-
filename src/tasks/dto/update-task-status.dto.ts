import { IsIn } from 'class-validator';

export class UpdateTaskStatusDto {
  @IsIn(['todo', 'in_progress', 'done', 'split', 'no_longer_important'])
  status!: string;
}
