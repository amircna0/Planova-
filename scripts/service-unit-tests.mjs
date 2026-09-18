import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const distDir = join(process.cwd(), 'dist');

if (!existsSync(distDir)) {
  throw new Error('dist directory is missing. Run npm run build before service-unit-tests.mjs.');
}

const {
  addUtcDays,
  combineUtcDateAndTime,
  parseDateInput,
  toDateOnly,
  toUtcDayEnd,
  toUtcDayStart,
} = require('../dist/common/date-utils');
const { AuthService } = require('../dist/auth/auth.service');
const { BillingService } = require('../dist/billing/billing.service');
const { CopilotService } = require('../dist/copilot/copilot.service');
const { GoalsService } = require('../dist/goals/goals.service');
const { HabitsService } = require('../dist/habits/habits.service');
const { PlansService } = require('../dist/plans/plans.service');
const { TasksService } = require('../dist/tasks/tasks.service');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function forbiddenWith(responseMatcher) {
  return (error) => {
    const response = typeof error.getResponse === 'function' ? error.getResponse() : {};
    return error?.status === 403 && responseMatcher(response);
  };
}

test('date utilities keep date-only values in UTC day buckets', () => {
  assert.equal(parseDateInput('2026-09-02').toISOString(), '2026-09-02T00:00:00.000Z');
  assert.equal(toUtcDayStart('2026-09-02').toISOString(), '2026-09-02T00:00:00.000Z');
  assert.equal(toUtcDayEnd('2026-09-02').toISOString(), '2026-09-02T23:59:59.999Z');
  assert.equal(addUtcDays('2026-09-02', 2).toISOString(), '2026-09-04T00:00:00.000Z');
  assert.equal(combineUtcDateAndTime('2026-09-02', '09:30').toISOString(), '2026-09-02T09:30:00.000Z');
  assert.equal(toDateOnly(new Date('2026-09-02T23:30:00.000Z')), '2026-09-02');
});

test('auth service builds OAuth redirect URLs with JWT data in the fragment', () => {
  const originalAppUrl = process.env.PLANOVA_APP_URL;
  process.env.PLANOVA_APP_URL = 'https://planova.example/app/';

  try {
    const service = new AuthService({}, {});
    const redirectUrl = service.buildOAuthRedirectUrl('jwt.test.token', 'user@example.com');

    assert.equal(redirectUrl, 'https://planova.example/app#access_token=jwt.test.token&email=user%40example.com');
  } finally {
    if (originalAppUrl === undefined) delete process.env.PLANOVA_APP_URL;
    else process.env.PLANOVA_APP_URL = originalAppUrl;
  }
});

test('plans service blocks free users at resource limits with upgrade metadata', async () => {
  const prisma = {
    user: {
      findUnique: async () => ({ id: 1, email: 'free@example.com', plan: 'free' }),
    },
    task: {
      count: async () => 30,
    },
    goal: {
      count: async () => 0,
    },
    habit: {
      count: async () => 0,
    },
  };
  const service = new PlansService(prisma);

  await assert.rejects(
    () => service.assertWithinLimit(1, 'tasks'),
    forbiddenWith((response) => response.resource === 'tasks' && response.limit === 30 && response.upgradeTo === 'pro'),
  );
});

test('plans service reports the correct upgrade path for gated features', async () => {
  const prisma = {
    user: {
      findUnique: async () => ({ id: 1, email: 'free@example.com', plan: 'free' }),
    },
    task: { count: async () => 0 },
    goal: { count: async () => 0 },
    habit: { count: async () => 0 },
  };
  const service = new PlansService(prisma);

  await assert.rejects(
    () => service.assertFeature(1, 'ai_planner'),
    forbiddenWith((response) => response.feature === 'ai_planner' && response.upgradeTo === 'pro'),
  );

  await assert.rejects(
    () => service.assertFeature(1, 'advanced_analytics'),
    forbiddenWith((response) => response.feature === 'advanced_analytics' && response.upgradeTo === 'premium'),
  );
});

test('tasks service suggests the first non-conflicting reschedule slot', async () => {
  const featureChecks = [];
  const task = {
    id: 10,
    userId: 1,
    title: 'Write proposal',
    duration: 60,
    priority: 1,
    dueDate: new Date('2026-09-01T00:00:00.000Z'),
  };
  const prisma = {
    task: {
      findFirst: async () => task,
      findMany: async () => [
        {
          id: 22,
          startTime: new Date('2026-09-02T10:00:00.000Z'),
          endTime: new Date('2026-09-02T11:00:00.000Z'),
        },
      ],
    },
    focusBlock: {
      findMany: async () => [
        {
          id: 7,
          start: new Date('2026-09-02T09:00:00.000Z'),
          end: new Date('2026-09-02T10:00:00.000Z'),
        },
      ],
    },
  };
  const plansService = {
    assertFeature: async (_userId, feature) => featureChecks.push(feature),
  };
  const service = new TasksService(prisma, plansService);

  const options = await service.getRescheduleOptions(1, task.id, new Date('2026-09-01T00:00:00.000Z'));

  assert.deepEqual(featureChecks, ['smart_rescheduling']);
  assert.equal(options.suggestedSlot.date, '2026-09-02');
  assert.equal(options.suggestedSlot.startTime, '11:00');
  assert.equal(options.suggestedSlot.endTime, '12:00');
  assert.equal(options.options[0].label, 'Best open slot');
});

test('tasks service custom reschedule updates task time and creates a focus block', async () => {
  const task = {
    id: 10,
    userId: 1,
    title: 'Write proposal',
    duration: 60,
    priority: 1,
    dueDate: new Date('2026-09-01T00:00:00.000Z'),
  };
  const calls = {};
  const tx = {
    task: {
      update: async ({ data }) => {
        calls.updatedTask = data;
        return { ...task, ...data };
      },
    },
    focusBlock: {
      deleteMany: async (args) => {
        calls.deletedFocusBlocks = args;
        return { count: 1 };
      },
      create: async ({ data }) => {
        calls.createdFocusBlock = data;
        return { id: 99, ...data };
      },
    },
  };
  const prisma = {
    task: {
      findFirst: async () => task,
    },
    $transaction: async (callback) => callback(tx),
  };
  const service = new TasksService(prisma, { assertFeature: async () => undefined });

  const result = await service.reschedule(1, task.id, {
    action: 'custom',
    startTime: '2026-09-03T13:00:00.000Z',
    endTime: '2026-09-03T14:00:00.000Z',
  });

  assert.equal(result.action, 'custom');
  assert.equal(calls.updatedTask.status, 'todo');
  assert.equal(calls.updatedTask.dueDate.toISOString(), '2026-09-03T00:00:00.000Z');
  assert.equal(calls.createdFocusBlock.userId, 1);
  assert.equal(calls.createdFocusBlock.taskId, task.id);
  assert.equal(calls.createdFocusBlock.title, task.title);
  assert.equal(calls.createdFocusBlock.start.toISOString(), '2026-09-03T13:00:00.000Z');
  assert.equal(calls.createdFocusBlock.end.toISOString(), '2026-09-03T14:00:00.000Z');
});

test('goals service enforces hierarchy rules before creating child goals', async () => {
  const prisma = {
    goal: {
      create: async ({ data }) => ({ id: 50, ...data }),
      findFirst: async ({ where }) => {
        if (where.id === 1) {
          return { id: 1, userId: 1, timeframe: 'annual' };
        }

        if (where.id === 2) {
          return { id: 2, userId: 1, timeframe: 'monthly' };
        }

        return null;
      },
    },
  };
  const service = new GoalsService(prisma, { assertWithinLimit: async () => undefined });

  await assert.rejects(
    () => service.create(1, { title: 'Invalid annual child', timeframe: 'annual', parentId: 1 }),
    /Annual goals cannot have a parent goal/,
  );
  await assert.rejects(
    () => service.create(1, { title: 'Missing parent', timeframe: 'quarterly' }),
    /quarterly goals must have a parent goal/,
  );
  await assert.rejects(
    () => service.create(1, { title: 'Wrong weekly parent', timeframe: 'weekly', parentId: 1 }),
    /weekly goals must belong to: monthly/,
  );

  const created = await service.create(1, { title: 'Valid weekly goal', timeframe: 'weekly', parentId: 2 });
  assert.equal(created.timeframe, 'weekly');
  assert.equal(created.parentId, 2);
});

test('habits service preserves explicit false logs and normalizes log dates', async () => {
  const upserts = [];
  const prisma = {
    habit: {
      findFirst: async () => ({ id: 5 }),
    },
    habitLog: {
      upsert: async (args) => {
        upserts.push(args);
        return args.create;
      },
    },
  };
  const service = new HabitsService(prisma, { assertWithinLimit: async () => undefined });

  const log = await service.log(1, 5, {
    date: '2026-09-02',
    completed: false,
    mood: 3,
    notes: 'Skipped intentionally',
  });

  assert.equal(upserts[0].where.habitId_date.date.toISOString(), '2026-09-02T00:00:00.000Z');
  assert.equal(log.completed, false);
  assert.equal(log.mood, 3);
});

test('copilot service uses deterministic fallback plans without OpenAI configuration', async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const featureChecks = [];
    const service = new CopilotService(
      { assertFeature: async (_userId, feature) => featureChecks.push(feature) },
      {},
      {},
    );

    const plan = await service.generatePlan(1, {
      prompt: 'study exam and workout',
      date: '2026-09-02',
      defaultLifeArea: 'career',
      workStart: 8,
    });

    assert.deepEqual(featureChecks, ['ai_planner']);
    assert.equal(plan.source, 'fallback');
    assert.equal(plan.date, '2026-09-02');
    assert.equal(plan.tasks[0].title, 'Study exam');
    assert.equal(plan.tasks[0].lifeArea, 'learning');
    assert.equal(plan.tasks[1].title, 'Workout');
    assert.equal(plan.tasks[1].lifeArea, 'health');
    assert.equal(plan.focusBlocks[0].startTime, '08:00');
  } finally {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  }
});

test('billing service maps active Stripe subscriptions to configured paid plans', async () => {
  const originalProPriceId = process.env.STRIPE_PRO_PRICE_ID;
  const originalPremiumPriceId = process.env.STRIPE_PREMIUM_PRICE_ID;
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
  process.env.STRIPE_PREMIUM_PRICE_ID = 'price_premium';

  try {
    const updates = [];
    const prisma = {
      user: {
        findUnique: async ({ where }) => {
          if (where.id === 1) {
            return { id: 1, email: 'paid@example.com', plan: 'free', stripeCustomerId: null, stripeSubscriptionId: null };
          }

          return null;
        },
        update: async ({ data }) => {
          updates.push(data);
          return { id: 1, email: 'paid@example.com', ...data };
        },
      },
    };
    const service = new BillingService(prisma, { log: () => undefined, warn: () => undefined });

    const result = await service.syncStripeSubscription({
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      current_period_end: 1788307200,
      metadata: { userId: '1' },
      items: {
        data: [{ price: { id: 'price_premium' } }],
      },
    });

    assert.equal(result.applied, true);
    assert.equal(updates[0].plan, 'premium');
    assert.equal(updates[0].stripeCustomerId, 'cus_123');
    assert.equal(updates[0].stripeSubscriptionId, 'sub_123');
    assert.equal(updates[0].stripePriceId, 'price_premium');
    assert.equal(updates[0].billingCurrentPeriodEnd.toISOString(), '2026-09-02T00:00:00.000Z');
  } finally {
    if (originalProPriceId === undefined) delete process.env.STRIPE_PRO_PRICE_ID;
    else process.env.STRIPE_PRO_PRICE_ID = originalProPriceId;

    if (originalPremiumPriceId === undefined) delete process.env.STRIPE_PREMIUM_PRICE_ID;
    else process.env.STRIPE_PREMIUM_PRICE_ID = originalPremiumPriceId;
  }
});

test('billing service returns inactive Stripe subscriptions to free', async () => {
  const originalProPriceId = process.env.STRIPE_PRO_PRICE_ID;
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro';

  try {
    const updates = [];
    const prisma = {
      user: {
        findUnique: async ({ where }) => {
          if (where.stripeSubscriptionId === 'sub_canceled') {
            return { id: 2, email: 'canceled@example.com', plan: 'pro', stripeCustomerId: 'cus_456', stripeSubscriptionId: 'sub_canceled' };
          }

          return null;
        },
        update: async ({ data }) => {
          updates.push(data);
          return { id: 2, email: 'canceled@example.com', ...data };
        },
      },
    };
    const service = new BillingService(prisma, { log: () => undefined, warn: () => undefined });

    const result = await service.syncStripeSubscription(
      {
        id: 'sub_canceled',
        customer: 'cus_456',
        status: 'canceled',
        items: {
          data: [{ price: { id: 'price_pro' } }],
        },
      },
      'customer.subscription.deleted',
    );

    assert.equal(result.applied, true);
    assert.equal(updates[0].plan, 'free');
    assert.equal(updates[0].stripeSubscriptionStatus, 'canceled');
  } finally {
    if (originalProPriceId === undefined) delete process.env.STRIPE_PRO_PRICE_ID;
    else process.env.STRIPE_PRO_PRICE_ID = originalProPriceId;
  }
});

test('billing service creates Stripe Checkout subscription sessions with user metadata', async () => {
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const originalProPriceId = process.env.STRIPE_PRO_PRICE_ID;
  const originalAppUrl = process.env.PLANOVA_APP_URL;
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
  process.env.PLANOVA_APP_URL = 'https://planova.example';

  try {
    const createdSessions = [];
    const prisma = {
      user: {
        findUnique: async ({ where }) => {
          if (where.id === 3) {
            return { id: 3, email: 'checkout@example.com', stripeCustomerId: null };
          }

          return null;
        },
      },
    };
    const service = new BillingService(prisma, { log: () => undefined, warn: () => undefined });
    service.stripe = {
      checkout: {
        sessions: {
          create: async (args) => {
            createdSessions.push(args);
            return { id: 'cs_test_123', url: 'https://checkout.stripe.test/session' };
          },
        },
      },
    };

    const result = await service.createCheckoutSession(3, 'pro');

    assert.equal(result.url, 'https://checkout.stripe.test/session');
    assert.equal(createdSessions[0].mode, 'subscription');
    assert.equal(createdSessions[0].customer_email, 'checkout@example.com');
    assert.equal(createdSessions[0].client_reference_id, '3');
    assert.equal(createdSessions[0].line_items[0].price, 'price_pro');
    assert.deepEqual(createdSessions[0].metadata, { userId: '3', email: 'checkout@example.com', plan: 'pro' });
    assert.deepEqual(createdSessions[0].subscription_data.metadata, { userId: '3', email: 'checkout@example.com', plan: 'pro' });
    assert.equal(createdSessions[0].success_url, 'https://planova.example/?billing=success&session_id={CHECKOUT_SESSION_ID}');
    assert.equal(createdSessions[0].cancel_url, 'https://planova.example/?billing=cancelled');
  } finally {
    if (originalWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;

    if (originalProPriceId === undefined) delete process.env.STRIPE_PRO_PRICE_ID;
    else process.env.STRIPE_PRO_PRICE_ID = originalProPriceId;

    if (originalAppUrl === undefined) delete process.env.PLANOVA_APP_URL;
    else process.env.PLANOVA_APP_URL = originalAppUrl;
  }
});

test('billing service creates Stripe Customer Portal sessions for attached customers', async () => {
  const originalAppUrl = process.env.PLANOVA_APP_URL;
  process.env.PLANOVA_APP_URL = 'https://planova.example/';

  try {
    const createdSessions = [];
    const prisma = {
      user: {
        findUnique: async ({ where }) => {
          if (where.id === 4) {
            return { id: 4, stripeCustomerId: 'cus_portal' };
          }

          return null;
        },
      },
    };
    const service = new BillingService(prisma, { log: () => undefined, warn: () => undefined });
    service.stripe = {
      billingPortal: {
        sessions: {
          create: async (args) => {
            createdSessions.push(args);
            return { id: 'bps_test_123', url: 'https://billing.stripe.test/session' };
          },
        },
      },
    };

    const result = await service.createPortalSession(4);

    assert.equal(result.url, 'https://billing.stripe.test/session');
    assert.equal(createdSessions[0].customer, 'cus_portal');
    assert.equal(createdSessions[0].return_url, 'https://planova.example/?billing=portal');
  } finally {
    if (originalAppUrl === undefined) delete process.env.PLANOVA_APP_URL;
    else process.env.PLANOVA_APP_URL = originalAppUrl;
  }
});

async function main() {
  for (const { name, fn } of tests) {
    await fn();
    console.log(`ok - ${name}`);
  }

  console.log(`\nService unit tests passed: ${tests.length} checks`);
}

main().catch((error) => {
  console.error(`\nService unit tests failed: ${error.stack || error.message}`);
  process.exit(1);
});
