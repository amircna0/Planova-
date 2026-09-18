import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private plansService: PlansService) {}

  @Get()
  getPlans() {
    return this.plansService.getPlans();
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getCurrentPlan(@Req() req: any) {
    return this.plansService.getCurrentPlan(req.user.id);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  updatePlanForDevelopment(@Req() req: any, @Body() dto: UpdatePlanDto) {
    return this.plansService.updatePlanForDevelopment(req.user.id, dto.plan);
  }
}
