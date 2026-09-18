const INSECURE_JWT_SECRETS = new Set(['', 'change_me', 'changeme', 'secret']);

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function isDevelopmentPlanSwitchEnabled() {
  return process.env.DEV_PLAN_SWITCH_ENABLED === 'true' || !isProduction();
}

export function isDevEmailLoginEnabled() {
  return process.env.DEV_EMAIL_LOGIN_ENABLED === 'true' || !isProduction();
}

export function isGoogleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getGoogleCallbackUrl() {
  return process.env.GOOGLE_CALLBACK_URL || `http://localhost:${getPort()}/auth/google/callback`;
}

export function getAppBaseUrl() {
  return (process.env.PLANOVA_APP_URL || process.env.APP_BASE_URL || `http://localhost:${getPort()}`).replace(/\/+$/, '');
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET || 'change_me';

  if (isProduction() && INSECURE_JWT_SECRETS.has(secret.trim())) {
    throw new Error('JWT_SECRET must be set to a strong value in production');
  }

  return secret;
}

export function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '1d';
}

export function getPort() {
  const raw = process.env.PORT || '3000';
  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

export function validateEnvironment() {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  const jwtSecret = process.env.JWT_SECRET || '';
  if (isProduction() && INSECURE_JWT_SECRETS.has(jwtSecret.trim())) {
    errors.push('JWT_SECRET must be set to a strong value in production');
  } else if (INSECURE_JWT_SECRETS.has(jwtSecret.trim())) {
    warnings.push('JWT_SECRET is using a development fallback. Set a strong secret before production.');
  }

  try {
    getPort();
  } catch (error) {
    errors.push((error as Error).message);
  }

  if (process.env.REDIS_ENABLED === 'true') {
    const redisPort = Number(process.env.REDIS_PORT || '6379');
    if (!Number.isInteger(redisPort) || redisPort < 1 || redisPort > 65535) {
      errors.push('REDIS_PORT must be an integer between 1 and 65535 when REDIS_ENABLED=true');
    }
  }

  const hasGoogleClientId = Boolean(process.env.GOOGLE_CLIENT_ID);
  const hasGoogleClientSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET);
  const hasGoogleCallbackUrl = Boolean(process.env.GOOGLE_CALLBACK_URL);
  if ((hasGoogleClientId || hasGoogleClientSecret) && (!hasGoogleClientId || !hasGoogleClientSecret)) {
    errors.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together');
  }

  if (hasGoogleCallbackUrl) {
    try {
      const parsedUrl = new URL(process.env.GOOGLE_CALLBACK_URL as string);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        errors.push('GOOGLE_CALLBACK_URL must use http or https');
      }
    } catch {
      errors.push('GOOGLE_CALLBACK_URL must be a valid URL');
    }
  }

  const appBaseUrl = process.env.PLANOVA_APP_URL || process.env.APP_BASE_URL;
  if (appBaseUrl) {
    try {
      const parsedUrl = new URL(appBaseUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        errors.push('PLANOVA_APP_URL must use http or https');
      }
    } catch {
      errors.push('PLANOVA_APP_URL must be a valid URL');
    }
  }

  const stripeValues = [
    process.env.STRIPE_SECRET_KEY,
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_PRO_PRICE_ID,
    process.env.STRIPE_PREMIUM_PRICE_ID,
  ];
  const hasAnyStripeConfig = stripeValues.some(Boolean);
  const hasStripeSecret = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasStripeWebhookSecret = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const hasStripePriceConfig = Boolean(process.env.STRIPE_PRO_PRICE_ID || process.env.STRIPE_PREMIUM_PRICE_ID);

  if (hasAnyStripeConfig && (!hasStripeSecret || !hasStripeWebhookSecret)) {
    errors.push('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be configured together for billing webhooks');
  }

  if (hasAnyStripeConfig && !hasStripePriceConfig) {
    warnings.push('Stripe billing is configured without STRIPE_PRO_PRICE_ID or STRIPE_PREMIUM_PRICE_ID, so paid plans will not be granted.');
  }

  if (isProduction() && !hasStripeSecret) {
    warnings.push('Stripe billing is not configured; paid plan changes cannot be applied from payment webhooks.');
  }

  if (isProduction() && hasStripeSecret && !appBaseUrl) {
    warnings.push('PLANOVA_APP_URL is not configured; Stripe checkout and portal redirects will fall back to localhost.');
  }

  if (isProduction() && !isDevEmailLoginEnabled() && (!hasGoogleClientId || !hasGoogleClientSecret || !hasGoogleCallbackUrl)) {
    errors.push('Google OAuth must be configured in production when development email login is disabled');
  }

  if (isProduction() && isDevelopmentPlanSwitchEnabled()) {
    warnings.push('DEV_PLAN_SWITCH_ENABLED=true allows users to switch plans without billing.');
  }

  if (isProduction() && isDevEmailLoginEnabled()) {
    warnings.push('DEV_EMAIL_LOGIN_ENABLED=true allows email-only login without OAuth.');
  }

  warnings.forEach((warning) => console.warn(`[env] ${warning}`));

  if (errors.length) {
    throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
  }
}
