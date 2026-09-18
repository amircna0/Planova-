import { Module, Logger, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { GoogleOAuthGuard } from './google-oauth.guard';
import { DatabaseModule } from '../database.module';
import { getJwtExpiresIn, getJwtSecret, isGoogleOAuthConfigured } from '../config/environment';

const providers: Provider[] = [AuthService, JwtStrategy, GoogleOAuthGuard];
if (isGoogleOAuthConfigured()) {
  providers.push(GoogleStrategy);
} else {
  const logger = new Logger('AuthModule');
  logger.warn('Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable.');
}

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: getJwtExpiresIn() as any }
    })
  ],
  providers: providers,
  controllers: [AuthController],
  exports: [AuthService]
})
export class AuthModule {}
