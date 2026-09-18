import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CopilotService } from './copilot.service';
import { GeneratePlanDto } from './dto/generate-plan.dto';

@Controller('copilot')
@UseGuards(AuthGuard('jwt'))
export class CopilotController {
  constructor(private copilotService: CopilotService) {}

  @Post('daily-plan')
  generateDailyPlan(@Req() req: any, @Body() dto: GeneratePlanDto) {
    return this.copilotService.generatePlan(req.user.id, dto);
  }

  @Post('daily-plan/apply')
  applyDailyPlan(@Req() req: any, @Body() dto: GeneratePlanDto) {
    return this.copilotService.applyPlan(req.user.id, dto);
  }
}
