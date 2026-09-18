const baseUrl = process.env.PLANOVA_BASE_URL || 'http://localhost:8889';
const email = process.env.PLANOVA_SMOKE_EMAIL || `planova-smoke-${Date.now()}@example.com`;

let token = '';
const results = [];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey() {
  return today().slice(0, 7);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function pass(label) {
  results.push({ label, ok: true });
  console.log(`ok - ${label}`);
}

function assert(value, label) {
  if (!value) {
    throw new Error(label);
  }

  pass(label);
}

async function request(method, path, body, authenticated = true) {
  const headers = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (authenticated && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || response.statusText;
    throw new Error(`${method} ${path} failed: ${Array.isArray(message) ? message.join(', ') : message}`);
  }

  return data;
}

async function expectStatus(method, path, body, status, authenticated = true) {
  const headers = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (authenticated && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  assert(response.status === status, `${method} ${path} returns ${status}`);
}

async function main() {
  console.log(`Planova smoke test: ${baseUrl}`);
  console.log(`Smoke user: ${email}`);

  const health = await request('GET', '/health', undefined, false);
  assert(health?.status === 'ok', 'health endpoint responds');

  const authConfig = await request('GET', '/auth/config', undefined, false);
  assert(typeof authConfig.devEmailLoginEnabled === 'boolean' && typeof authConfig.googleOAuthEnabled === 'boolean', 'auth config exposes login modes');

  const page = await fetch(baseUrl).then((response) => response.text());
  assert(page.includes('/tasks') && page.includes('/personal/notes') && page.includes('/auth/config') && page.includes('reschedule-options'), 'served frontend contains API wiring');

  const session = await request('POST', '/auth/login', { email }, false);
  token = session.access_token;
  assert(Boolean(token), 'dev email login returns JWT');

  await expectStatus('POST', '/auth/login', { email: 'not-an-email' }, 400, false);

  const plans = await request('GET', '/plans', undefined, false);
  assert(Array.isArray(plans) && plans.some((plan) => plan.name === 'free') && plans.some((plan) => plan.name === 'pro') && plans.some((plan) => plan.name === 'premium'), 'free/pro/premium plans load');

  let currentPlan = await request('GET', '/plans/me');
  assert(currentPlan?.plan?.name === 'free', 'new user starts on free plan');
  assert(typeof currentPlan.devPlanSwitchEnabled === 'boolean', 'current plan exposes dev plan switch flag');

  if (!currentPlan.devPlanSwitchEnabled) {
    throw new Error('Development plan switching is disabled; set DEV_PLAN_SWITCH_ENABLED=true or run outside NODE_ENV=production for the full smoke test.');
  }

  currentPlan = await request('PATCH', '/plans/me', { plan: 'premium' });
  assert(currentPlan?.plan?.name === 'premium', 'development plan switch reaches premium');

  const billing = await request('GET', '/billing/me');
  assert(billing?.user?.plan === 'premium' && typeof billing.configured === 'boolean', 'billing status loads');

  const date = today();
  const task = await request('POST', '/tasks', {
    title: 'Smoke test task',
    dueDate: date,
    priority: 1,
    duration: 45,
    lifeArea: 'career',
  });
  assert(task?.id, 'task creation works');

  const focusBlock = await request('POST', '/planner/focus-blocks', {
    title: 'Smoke focus block',
    date,
    startTime: '10:00',
    endTime: '10:45',
    type: 'focus',
  });
  assert(focusBlock?.id, 'focus block creation works');

  const unfinished = await request('GET', `/tasks/unfinished?date=${date}`);
  assert(Array.isArray(unfinished) && unfinished.some((item) => item.id === task.id), 'unfinished task query includes created task');

  const rescheduleOptions = await request('GET', `/tasks/${task.id}/reschedule-options?date=${date}`);
  assert(Array.isArray(rescheduleOptions.options), 'smart reschedule options load');

  const suggestedSlot = rescheduleOptions.suggestedSlot;
  const rescheduleBody = suggestedSlot
    ? {
        action: 'custom',
        dueDate: suggestedSlot.date,
        startTime: suggestedSlot.startDateTime,
        endTime: suggestedSlot.endDateTime,
      }
    : {
        action: 'tomorrow',
      };
  const rescheduled = await request('POST', `/tasks/${task.id}/reschedule`, rescheduleBody);
  assert(rescheduled?.action === rescheduleBody.action, 'smart reschedule action works');

  const goal = await request('POST', '/goals', {
    title: 'Smoke test goal',
    timeframe: 'annual',
    lifeArea: 'career',
  });
  assert(goal?.id, 'goal creation works');

  const roadmap = await request('POST', `/goals/${goal.id}/roadmap/generate`, {
    startDate: date,
    months: 1,
    weeksPerMilestone: 2,
    tasksPerWeek: 2,
  });
  assert(roadmap?.created?.tasks === 4, 'goal roadmap generation creates tasks');

  const habit = await request('POST', '/habits', {
    title: 'Smoke test habit',
    frequency: 'daily',
    lifeArea: 'health',
  });
  assert(habit?.id, 'habit creation works');

  const habitLog = await request('POST', `/habits/${habit.id}/logs`, {
    date,
    completed: true,
    mood: 4,
  });
  assert(habitLog?.completed === true, 'habit logging works');

  const insights = await request('GET', '/insights/habits');
  assert(insights?.totals?.habits >= 1, 'premium habit insights load');

  const note = await request('POST', '/personal/notes', {
    text: 'Smoke test note',
  });
  assert(note?.id, 'personal note creation works');

  const importantDate = await request('POST', '/personal/dates', {
    title: 'Smoke important date',
    date: addDays(date, 3),
  });
  assert(importantDate?.id, 'important date creation works');

  const reflection = await request('PUT', '/personal/reflections', {
    date,
    text: 'Smoke reflection',
  });
  assert(reflection?.text === 'Smoke reflection', 'reflection upsert works');

  const monthlyFocus = await request('PUT', '/personal/monthly-focus', {
    month: monthKey(),
    text: 'Smoke monthly focus',
  });
  assert(monthlyFocus?.text === 'Smoke monthly focus', 'monthly focus upsert works');

  const budget = await request('PUT', '/personal/budget', {
    month: monthKey(),
    total: 1000,
  });
  assert(Number(budget?.total) === 1000, 'budget upsert works');

  const expense = await request('POST', '/personal/budget/expenses', {
    month: monthKey(),
    name: 'Smoke expense',
    amount: 25,
  });
  assert(expense?.id, 'expense creation works');

  const templates = await request('GET', '/templates/starter', undefined, false);
  assert(Array.isArray(templates) && templates.length >= 4, 'starter templates load');

  const dashboard = await request('GET', `/dashboard/today?date=${date}`);
  assert(dashboard?.tasks && dashboard?.goals && dashboard?.habits, 'today dashboard loads');

  const overview = await request('GET', '/dashboard/overview');
  assert(overview?.totals && Array.isArray(overview.lifeAreas), 'dashboard overview loads');

  const report = await request('GET', `/reports/weekly?weekStart=${date}`);
  assert(report?.insights?.summary, 'weekly report loads');

  console.log(`\nSmoke test passed: ${results.length} checks`);
}

main().catch((error) => {
  console.error(`\nSmoke test failed: ${error.message}`);
  process.exit(1);
});
