import { IsIn } from 'class-validator';
import { PlanName } from '../../plans/plan-limits';

export class CreateCheckoutSessionDto {
  @IsIn(['pro', 'premium'])
  plan!: Exclude<PlanName, 'free'>;
}
