import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { getAppBaseUrl } from '../config/environment';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async validateUserByEmail(email: string) {
    // Upsert: create user if doesn't exist
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      const name = email.split('@')[0];
      user = await this.prisma.user.create({ data: { email, name } });
    }
    return user;
  }

  async findOrCreateOAuthUser(profile: any) {
    const email = profile.emails && profile.emails[0] && profile.emails[0].value;
    const name = profile.displayName || (profile.name && `${profile.name.givenName} ${profile.name.familyName}`) || null;
    if (!email) return null;

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({ data: { email, name } });
    }
    return user;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email };
    return { access_token: this.jwtService.sign(payload) };
  }

  buildOAuthRedirectUrl(accessToken: string, email: string) {
    const url = new URL(getAppBaseUrl());
    url.hash = new URLSearchParams({
      access_token: accessToken,
      email,
    }).toString();

    return url.toString();
  }
}
