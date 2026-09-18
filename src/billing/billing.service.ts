import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import Stripe = require('stripe');
import { LoggingService } from '../logging/logging.service';
import { PlanName } from '../plans/plan-limits';
import { PrismaService } from '../prisma.service';
import { getAppBaseUrl } from '../config/environment';

type StripeSubscriptionLike = {
  id: string;
  customer?: string | { id?: string } | null;
  status?: string | null;
  current_period_end?: number | null;
  metadata?: Record<string, string>;
  items?: {
    data?: Array<{
      price?: {
        id?: string;
      } | null;
    }>;
  };
};

@Injectable()
export class BillingService {
  private stripe?: Stripe;

  constructor(
    private prisma: PrismaService,
    private loggingService: LoggingService,
  ) {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
  }

  async getBillingStatus(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        plan: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionStatus: true,
        stripePriceId: true,
        billingCurrentPeriodEnd: true,
      },
    });

    return {
      configured: this.isStripeConfigured(),
      checkoutEnabled: this.isCheckoutEnabled(),
      portalEnabled: Boolean(this.stripe),
      prices: {
        pro: Boolean(process.env.STRIPE_PRO_PRICE_ID),
        premium: Boolean(process.env.STRIPE_PREMIUM_PRICE_ID),
      },
      user,
    };
  }

  async createCheckoutSession(userId: number, plan: Exclude<PlanName, 'free'>) {
    const stripe = this.ensureStripeClient();
    const priceId = this.priceIdForPlan(plan);

    if (!priceId) {
      throw new ServiceUnavailableException(`${plan} Stripe price is not configured`);
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new ServiceUnavailableException('Stripe webhook secret is required before checkout can grant access');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const metadata = {
      userId: String(user.id),
      email: user.email,
      plan,
    };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: user.stripeCustomerId || undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
      client_reference_id: String(user.id),
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata,
      subscription_data: {
        metadata,
      },
      success_url: `${this.appBaseUrl()}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.appBaseUrl()}/?billing=cancelled`,
    });

    return {
      id: session.id,
      url: session.url,
      plan,
    };
  }

  async createPortalSession(userId: number) {
    const stripe = this.ensureStripeClient();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer is attached to this user yet');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${this.appBaseUrl()}/?billing=portal`,
    });

    return {
      id: session.id,
      url: session.url,
    };
  }

  async handleStripeWebhook(rawBody: Buffer, signature?: string) {
    if (!this.stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new ServiceUnavailableException('Stripe billing is not configured');
    }

    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      throw new BadRequestException(`Stripe webhook signature verification failed: ${(error as Error).message}`);
    }

    const result = await this.applyStripeEvent(event);

    return {
      received: true,
      type: event.type,
      ...result,
    };
  }

  async applyStripeEvent(event: Pick<Stripe.Event, 'type' | 'data'>) {
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      return this.syncStripeSubscription(event.data.object as StripeSubscriptionLike, event.type);
    }

    if (event.type === 'checkout.session.completed') {
      return this.syncCheckoutSession(event.data.object as Stripe.Checkout.Session);
    }

    return {
      applied: false,
      reason: 'ignored_event_type',
    };
  }

  async syncStripeSubscription(subscription: StripeSubscriptionLike, eventType = 'customer.subscription.updated') {
    const subscriptionId = subscription.id;
    const customerId = this.stripeId(subscription.customer);
    const status = subscription.status || (eventType === 'customer.subscription.deleted' ? 'canceled' : 'unknown');
    const priceId = this.firstPriceId(subscription);
    const plan = eventType === 'customer.subscription.deleted' ? 'free' : this.planForSubscription(status, priceId);
    const user = await this.findBillingUser({
      userId: this.numericMetadata(subscription.metadata?.userId),
      email: subscription.metadata?.email,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    });

    if (!user) {
      this.loggingService.warn('Stripe subscription event did not match a Planova user', 'Billing', {
        subscriptionId,
        customerId,
        status,
        priceId,
        eventType,
      });

      return {
        applied: false,
        reason: 'user_not_found',
      };
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        plan,
        stripeCustomerId: customerId || user.stripeCustomerId,
        stripeSubscriptionId: subscriptionId,
        stripeSubscriptionStatus: status,
        stripePriceId: priceId,
        billingCurrentPeriodEnd: this.periodEnd(subscription.current_period_end),
      },
      select: {
        id: true,
        email: true,
        plan: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionStatus: true,
        stripePriceId: true,
        billingCurrentPeriodEnd: true,
      },
    });

    this.loggingService.log('Stripe subscription synced', 'Billing', {
      userId: updated.id,
      plan: updated.plan,
      status,
      priceId,
      eventType,
    });

    return {
      applied: true,
      user: updated,
    };
  }

  private async syncCheckoutSession(session: Stripe.Checkout.Session) {
    const userId = this.numericMetadata(session.client_reference_id || session.metadata?.userId);
    const email = session.customer_details?.email || session.customer_email || session.metadata?.email;
    const user = await this.findBillingUser({
      userId,
      email: email || undefined,
      stripeCustomerId: this.stripeId(session.customer),
      stripeSubscriptionId: this.stripeId(session.subscription),
    });

    if (!user) {
      this.loggingService.warn('Stripe checkout session did not match a Planova user', 'Billing', {
        sessionId: session.id,
        customerId: this.stripeId(session.customer),
        subscriptionId: this.stripeId(session.subscription),
      });

      return {
        applied: false,
        reason: 'user_not_found',
      };
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: this.stripeId(session.customer) || user.stripeCustomerId,
        stripeSubscriptionId: this.stripeId(session.subscription) || user.stripeSubscriptionId,
      },
      select: {
        id: true,
        email: true,
        plan: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionStatus: true,
      },
    });

    return {
      applied: true,
      user: updated,
    };
  }

  private async findBillingUser(filters: {
    userId?: number;
    email?: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  }) {
    if (filters.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: filters.userId } });
      if (user) return user;
    }

    if (filters.stripeSubscriptionId) {
      const user = await this.prisma.user.findUnique({
        where: { stripeSubscriptionId: filters.stripeSubscriptionId },
      });
      if (user) return user;
    }

    if (filters.stripeCustomerId) {
      const user = await this.prisma.user.findUnique({
        where: { stripeCustomerId: filters.stripeCustomerId },
      });
      if (user) return user;
    }

    if (filters.email) {
      return this.prisma.user.findUnique({ where: { email: filters.email } });
    }

    return null;
  }

  private planForSubscription(status: string, priceId?: string | null): PlanName {
    if (!['active', 'trialing'].includes(status)) {
      return 'free';
    }

    if (priceId && this.matchesPrice('STRIPE_PREMIUM_PRICE_ID', priceId)) {
      return 'premium';
    }

    if (priceId && this.matchesPrice('STRIPE_PRO_PRICE_ID', priceId)) {
      return 'pro';
    }

    return 'free';
  }

  private matchesPrice(envKey: string, priceId: string) {
    return (process.env[envKey] || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .includes(priceId);
  }

  private firstPriceId(subscription: StripeSubscriptionLike) {
    return subscription.items?.data?.find((item) => item.price?.id)?.price?.id || null;
  }

  private stripeId(value?: string | { id?: string } | null) {
    if (!value) {
      return null;
    }

    return typeof value === 'string' ? value : value.id || null;
  }

  private numericMetadata(value?: string | null) {
    if (!value) {
      return undefined;
    }

    const numberValue = Number(value);
    return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : undefined;
  }

  private periodEnd(value?: number | null) {
    return value ? new Date(value * 1000) : null;
  }

  private isStripeConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  }

  private isCheckoutEnabled() {
    return this.isStripeConfigured() && Boolean(process.env.STRIPE_PRO_PRICE_ID || process.env.STRIPE_PREMIUM_PRICE_ID);
  }

  private ensureStripeClient() {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe billing is not configured');
    }

    return this.stripe;
  }

  private priceIdForPlan(plan: Exclude<PlanName, 'free'>) {
    return plan === 'pro' ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_PREMIUM_PRICE_ID;
  }

  private appBaseUrl() {
    return getAppBaseUrl();
  }
}
