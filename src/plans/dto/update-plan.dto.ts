import { IsIn } from 'class-validator';
import { PLAN_NAMES, PlanName } from '../plan-limits';

export class UpdatePlanDto {
  @IsIn(PLAN_NAMES)
  plan!: PlanName;
}
