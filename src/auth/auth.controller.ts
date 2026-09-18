import { Controller, ForbiddenException, Get, Post, Body, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleOAuthGuard } from './google-oauth.guard';
import { isDevEmailLoginEnabled, isGoogleOAuthConfigured } from '../config/environment';
import { DevLoginDto } from './dto/dev-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('config')
  getAuthConfig() {
    return {
      devEmailLoginEnabled: isDevEmailLoginEnabled(),
      googleOAuthEnabled: isGoogleOAuthConfigured(),
      googleAuthUrl: '/auth/google',
    };
  }

  @Post('login')
  async login(@Body() dto: DevLoginDto) {
    if (!isDevEmailLoginEnabled()) {
      throw new ForbiddenException('Development email login is disabled');
    }

    const user = await this.authService.validateUserByEmail(dto.email);
    return this.authService.login(user);
  }

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth() {
    // initiates Google OAuth2 login flow
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    // GoogleStrategy sets req.user
    const session = await this.authService.login(req.user);
    return res.redirect(this.authService.buildOAuthRedirectUrl(session.access_token, req.user.email));
  }
}
