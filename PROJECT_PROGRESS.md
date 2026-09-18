# Planova Project Progress

Last updated: 2026-08-25

## Current Stage

Planova is currently in the **integrated backend MVP / alpha** stage.

This means the project is no longer only a design or simple to-do prototype. It has a real NestJS backend, Prisma data models, feature modules, plan gates, and a frontend that talks to the backend. It is still not production-ready because payment enforcement, secure production auth, automated coverage, deployment hardening, and external integrations still need work.

## Product Vision

Planova is being built as a personal planning platform with three product plans:

- Free: daily planner, basic calendar, basic goals, limited habits.
- Pro: AI planner, smart rescheduling, weekly reports, unlimited core usage.
- Premium: advanced analytics, life dashboard, templates, shared planning, and future advanced features.

The long-term product direction is:

- AI Daily Planner Assistant.
- Goal-to-task roadmap system.
- Smart rescheduling.
- Google Calendar deep sync.
- Gmail-to-task.
- Weekly review reports.
- Habit and mood intelligence.
- Student, freelancer, fitness/lifestyle modes.
- Shared planning.
- Life dashboard.
- Template marketplace.

## Backend Progress

The backend is built with NestJS and Prisma.

Completed modules:

- Auth module with dev email login, JWT auth, and Google OAuth scaffolding.
- Auth module now exposes auth config and redirects Google OAuth callbacks back to the frontend with a Planova JWT.
- Tasks module with CRUD, status updates, unfinished tasks, and smart rescheduling.
- Planner module with daily plan generation and focus block CRUD.
- Goals module with annual/quarterly/monthly/weekly hierarchy and roadmap generation.
- Habits module with habit CRUD, logging, summaries, and mood data.
- Reports module with weekly report generation and report history.
- Dashboard module with today overview and life-area overview.
- Plans module with Free, Pro, and Premium definitions, limits, and feature gates.
- Billing module with authenticated billing status, server-created Stripe Checkout sessions, Customer Portal sessions, and signed Stripe webhook plan updates.
- Copilot module with OpenAI-backed or fallback daily plan generation.
- Profile module with user mode and profile updates.
- Templates module with starter templates for user modes.
- Insights module with Premium habit/mood analytics.
- Personal module with notes, important dates, reflections, monthly focus, budget, and expenses.
- Logging module with server and frontend client log capture.
- Jobs module for optional Redis-backed report processing.

## Database Progress

Prisma models exist for:

- User
- Task
- Goal
- Milestone
- WeeklyFocus
- FocusBlock
- Habit
- HabitLog
- Report
- Note
- ImportantDate
- Reflection
- MonthlyFocus
- BudgetMonth
- Expense
- Stripe customer/subscription fields on User

Important indexes and relations already support:

- user-owned data separation
- task date filtering
- task status filtering
- goal hierarchy
- roadmap entities
- habit logs
- weekly report uniqueness
- personal dashboard data

## Frontend Progress

The active frontend was replaced with the provided `planova_1.html` UI.

The served frontend file is:

- `public/index.html`

The root copy is:

- `planova.html`

Both files are kept identical.

Connected frontend features:

- Dev email login through `/auth/login`.
- Auth mode discovery through `/auth/config`.
- Google OAuth browser flow through `/auth/google`.
- JWT storage in `localStorage`.
- Current plan display through `/plans/me`.
- Plan card display through `/plans`.
- Development plan switching through `PATCH /plans/me`.
- Billing status through `/billing/me`.
- Stripe Checkout session creation through `/billing/checkout`.
- Stripe Customer Portal session creation through `/billing/portal`.
- Task creation, deletion, and status updates through `/tasks`.
- Daily unfinished tasks through `/tasks/unfinished`.
- Smart reschedule suggestions through `/tasks/:id/reschedule-options`.
- Smart reschedule actions through `/tasks/:id/reschedule`.
- Focus block creation, listing, and deletion through `/planner/focus-blocks`.
- AI Copilot preview/apply through `/copilot/daily-plan` and `/copilot/daily-plan/apply`.
- Goal creation, deletion, and progress updates through `/goals`.
- Goal roadmap generation through `/goals/:id/roadmap/generate`.
- Habit creation, deletion, and logging through `/habits`.
- Premium habit intelligence through `/insights/habits`.
- Dashboard cards through `/dashboard/today` and `/dashboard/overview`.
- Weekly review summary through dashboard weekly report data.
- Starter templates through `/templates/starter`.
- Applying templates through `/templates/starter/:mode/apply`.
- Profile mode updates through `/profile`.
- Notes through `/personal/notes`.
- Important dates through `/personal/dates`.
- Reflections through `/personal/reflections`.
- Monthly focus through `/personal/monthly-focus`.
- Budget and expenses through `/personal/budget` and `/personal/budget/expenses`.
- Frontend error logging through `/logs/client`.

## Important Fixes Completed

### Calendar-Safe Date Handling

A shared date utility was added:

- `src/common/date-utils.ts`

It centralizes:

- date-only parsing
- UTC day start/end
- UTC day addition
- combining dates with clock times
- UTC time formatting

This prevents planner bugs where a date like `2026-09-02` can shift backward or forward because of server timezone serialization.

### Smart Rescheduling MVP

Completed flow:

- User has unfinished task.
- Frontend asks backend for reschedule options.
- Backend scans existing tasks and focus blocks.
- Backend finds open work slots between `09:00` and `18:00`.
- Frontend shows “Best slot”.
- User clicks once.
- Backend updates the task and creates a matching focus block.

### Plan Feature Upgrade Messages

The backend now maps feature upgrade targets correctly:

- `ai_planner` -> Pro
- `smart_rescheduling` -> Pro
- `weekly_reports` -> Pro
- `advanced_analytics` -> Premium
- `life_dashboard` -> Premium
- `templates` -> Premium
- `shared_planning` -> Premium

## Current Verification

Confirmed:

- `npm run build` passes.
- `npm run test:unit` passes.
- `npm run smoke` passes against the local backend.
- `npm run test:api` passes against the local backend.
- `npm run seed:demo` creates a realistic demo account.
- GitHub Actions CI workflow exists for install, Prisma generation, migrations, service unit tests, smoke tests, and API tests.
- Frontend script syntax passes.
- Backend runs locally.
- Health endpoint responds.
- Served frontend contains the integrated UI.
- Authenticated API smoke checks passed for login, current plan, templates, personal notes, and dashboard.

Current local URL:

```txt
http://localhost:8889
```

## Known Dev-Only Areas

These are useful while learning and building, but must be replaced or locked down before production:

- `/auth/login` accepts any email and creates a user.
- `PATCH /plans/me` lets a user change their own plan for development testing, but is now blocked in production unless explicitly enabled.
- Google OAuth is now usable as the browser production login flow when configured.
- Stripe Checkout and Customer Portal foundations are connected, but live products/prices and portal settings must be configured in Stripe.
- Plan changes can be tied to Stripe subscription events when Stripe keys, webhook secret, price IDs, and `PLANOVA_APP_URL` are configured.
- Open CORS is suitable for local development, not production.
- There is no full automated test suite yet.

## Remaining Major Stages

### Stage 1: Production Hardening

- Automated API smoke tests are now available through `npm run smoke`.
- Backend API validation/plan-gate tests are now available through `npm run test:api`.
- Demo data seeding is now available through `npm run seed:demo`.
- Dev-only plan switching is now blocked in production unless `DEV_PLAN_SWITCH_ENABLED=true`.
- Dev-only email login is now blocked in production unless `DEV_EMAIL_LOGIN_ENABLED=true`.
- Production startup now requires Google OAuth credentials and callback URL when dev email login is disabled.
- Environment validation now checks required database/JWT/port/provider settings at startup.
- More DTO/query validation has been added for auth login, task filters, planner windows, report history, insights windows, and starter template modes.
- Initial service-level unit tests are now available through `npm run test:unit` for date handling, plan gates, task rescheduling, goal hierarchy, habit logs, and Copilot fallback planning.
- Remaining: expand service-level unit tests around reports, dashboard aggregation, personal data ownership, and template application.
- Remaining: add payment/auth production flows.
- CI workflow has been added so build, smoke, and API tests can run automatically in GitHub Actions.

### Stage 2: Real Auth And Billing

- Replace dev login with production auth flow.
- Stripe billing foundation has been added.
- Server-created Stripe Checkout sessions have been added.
- Stripe Customer Portal session creation has been added.
- Store Stripe subscription/customer IDs.
- Update user plan from trusted Stripe payment webhooks.
- Remove frontend self-upgrade in production.
- Google OAuth has been wired as the production browser login path.
- Remaining: add a more secure cookie/session strategy or token refresh flow before public launch.

### Stage 3: Google Calendar Deep Sync

- Store Google tokens safely.
- Import calendar events.
- Detect free time.
- Prevent focus block conflicts.
- Create smart task scheduling around meetings.

### Stage 4: Gmail-To-Task

- Connect Gmail OAuth scopes.
- Detect actionable emails.
- Create tasks from email content.
- Extract dates/deadlines.
- Show urgent email tasks on dashboard.

### Stage 5: Product Polish

- Add tests around core business logic.
- Improve onboarding.
- Add production deployment configuration.
- Add mobile polish.
- Add template marketplace foundation.
- Add shared planning models.
