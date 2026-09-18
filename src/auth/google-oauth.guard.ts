import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { isGoogleOAuthConfigured } from '../config/environment';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    if (!isGoogleOAuthConfigured()) {
      throw new ServiceUnavailableException(
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL.',
      );
    }

    return super.canActivate(context);
  }
}
