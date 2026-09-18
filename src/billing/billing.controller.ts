import { BadRequestException, Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { BillingService } from './billing.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getBillingStatus(@Req() req: any) {
    return this.billingService.getBillingStatus(req.user.id);
  }

  @Post('checkout')
  @UseGuards(AuthGuard('jwt'))
  createCheckoutSession(@Req() req: any, @Body() dto: CreateCheckoutSessionDto) {
    return this.billingService.createCheckoutSession(req.user.id, dto.plan);
  }

  @Post('portal')
  @UseGuards(AuthGuard('jwt'))
  createPortalSession(@Req() req: any) {
    return this.billingService.createPortalSession(req.user.id);
  }

  @Post('stripe/webhook')
  handleStripeWebhook(@Req() req: RawBodyRequest, @Headers('stripe-signature') signature?: string) {
    if (!req.rawBody) {
      throw new BadRequestException('Raw request body is required for Stripe signature verification');
    }

    return this.billingService.handleStripeWebhook(req.rawBody, signature);
  }
}
