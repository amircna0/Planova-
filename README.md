# Planova Backend

NestJS backend for Planova, a planning product that connects goals, milestones, weekly focus, daily tasks, habits, reports, and personal dashboards.

Quick start:

```bash
npm install
# generate Prisma client after installing
npm run prisma:generate
npm run start:dev
```

After the backend is running, verify the main API flows:

```bash
npm run test:unit
npm run smoke
npm run test:api
```

The unit test script builds the TypeScript project and exercises core service logic with mocked dependencies. The smoke and API tests use `PLANOVA_BASE_URL` when set, otherwise they target `http://localhost:8889`.

Create a realistic demo account:

```bash
npm run seed:demo
```

The demo seed uses `PLANOVA_DEMO_EMAIL` and `PLANOVA_DEMO_PLAN` when set. Defaults are `demo@planova.app` and `premium`.

Database

1. Create a Postgres database and set `DATABASE_URL` in `.env` (see `.env.example`).
2. Run `npm run prisma:migrate` to create initial schema (dev).

## Backend MVP surfaces

All product routes except login use JWT auth:

```txt
Authorization: Bearer <access_token>
```

Core endpoints:

```txt
GET  /auth/config
POST /auth/login
GET  /auth/google
GET  /auth/google/callback
GET  /health

GET  /profile
PATCH /profile

GET  /plans
GET  /plans/me
PATCH /plans/me

GET  /billing/me
POST /billing/checkout
POST /billing/portal
POST /billing/stripe/webhook

POST /tasks
GET  /tasks
GET  /tasks/unfinished
GET  /tasks/:id/reschedule-options
PATCH /tasks/:id
PATCH /tasks/:id/status
POST /tasks/:id/reschedule
DELETE /tasks/:id

GET  /planner/daily
GET  /planner/next-task
POST /planner/apply-schedule
GET  /planner/stats
GET  /planner/focus-blocks
POST /planner/focus-blocks
DELETE /planner/focus-blocks/:id

POST /goals
GET  /goals
GET  /goals/hierarchy
GET  /goals/:id/roadmap
POST /goals/:id/roadmap
POST /goals/:id/roadmap/generate
PATCH /goals/:id
PATCH /goals/:id/progress
DELETE /goals/:id

POST /habits
GET  /habits
GET  /habits/summary
POST /habits/:id/logs
GET  /habits/:id/logs

GET  /dashboard/today
GET  /dashboard/overview

GET  /reports/weekly
POST /reports/weekly
GET  /reports/history

Weekly reports include completed and missed tasks, planned workload, focus time, habit completion rate, best habit streak, mood pattern, and next-week focus.

POST /copilot/daily-plan
POST /copilot/daily-plan/apply

GET  /templates/starter
POST /templates/starter/:mode/apply

GET  /personal/notes
POST /personal/notes
GET  /personal/dates
POST /personal/dates
GET  /personal/reflections
PUT  /personal/reflections
GET  /personal/monthly-focus
PUT  /personal/monthly-focus
GET  /personal/budget
PUT  /personal/budget
POST /personal/budget/expenses
```

Example roadmap generation:

```json
{
  "startDate": "2026-09-01",
  "months": 1,
  "weeksPerMilestone": 2,
  "tasksPerWeek": 2
}
```

## Scheduling date rule

Planova treats date-only fields, such as `dueDate`, habit log dates, reflections, and dashboard days, as UTC day buckets. Clock-based scheduling, such as focus blocks and task `startTime`/`endTime`, is also combined with the selected date through shared helpers in `src/common/date-utils.ts`.

This avoids the common planner bug where `2026-09-02` shifts to the previous or next day when serialized in a different server timezone.

## Development plan switching

`PATCH /plans/me` is a development shortcut for testing Free, Pro, and Premium behavior. It is enabled outside production and can be explicitly enabled with:

```bash
DEV_PLAN_SWITCH_ENABLED=true
```

Production billing should update plans from trusted payment webhooks, not from this endpoint.

Development email login is also blocked in production unless explicitly enabled:

```bash
DEV_EMAIL_LOGIN_ENABLED=true
```

## Production auth

`GET /auth/config` tells the static frontend whether development email login and Google OAuth are available. In production, Planova requires Google OAuth configuration unless `DEV_EMAIL_LOGIN_ENABLED=true` is explicitly set.

Configure Google OAuth:

```bash
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_CALLBACK_URL="https://your-api.example/auth/google/callback"
PLANOVA_APP_URL="https://your-planova-app.example"
```

The Google callback creates or finds the user, signs a Planova JWT, and redirects back to `PLANOVA_APP_URL` with the token in the URL fragment so the static frontend can store it and clear the fragment.

## Stripe billing webhooks

Planova can update paid plans from signed Stripe webhook events:

```bash
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRO_PRICE_ID="price_..."
STRIPE_PREMIUM_PRICE_ID="price_..."
PLANOVA_APP_URL="https://your-planova-app.example"
```

Configure Stripe to send subscription events to:

```txt
POST /billing/stripe/webhook
```

Authenticated users can start server-created Checkout sessions through `POST /billing/checkout` with `{ "plan": "pro" }` or `{ "plan": "premium" }`. Users with an attached Stripe customer can open the hosted Customer Portal through `POST /billing/portal`.

The backend verifies the `Stripe-Signature` header against the raw request body before applying plan changes. Active or trialing subscriptions mapped to `STRIPE_PRO_PRICE_ID` grant Pro, active or trialing subscriptions mapped to `STRIPE_PREMIUM_PRICE_ID` grant Premium, and canceled/inactive subscriptions return the user to Free. Checkout and portal redirects use `PLANOVA_APP_URL` when set.

## CI

GitHub Actions workflow `.github/workflows/ci.yml` runs install, Prisma generation, migrations against Postgres, service unit tests, the compiled backend, smoke tests, and API tests.
