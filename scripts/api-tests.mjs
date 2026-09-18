const baseUrl = process.env.PLANOVA_BASE_URL || 'http://localhost:8889';
const email = process.env.PLANOVA_TEST_EMAIL || `planova-test-${Date.now()}@example.com`;

let token = '';
let checks = 0;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uniqueTitle(prefix) {
  return `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 7)}`;
}

function ok(label) {
  checks += 1;
  console.log(`ok - ${label}`);
}

function assert(condition, label) {
  if (!condition) {
    throw new Error(label);
  }

  ok(label);
}

async function request(method, path, body, options = {}) {
  const headers = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (options.expectStatus !== undefined) {
    assert(response.status === options.expectStatus, `${method} ${path} returns ${options.expectStatus}`);
    return data;
  }

  if (!response.ok) {
    const message = data?.message || response.statusText;
    throw new Error(`${method} ${path} failed: ${Array.isArray(message) ? message.join(', ') : message}`);
  }

  return data;
}

async function login(testEmail = email) {
  const session = await request('POST', '/auth/login', { email: testEmail }, { auth: false });
  token = session.access_token;
  assert(Boolean(token), `login works for ${testEmail}`);
}

async function testValidation() {
  await request('POST', '/auth/login', { email: 'not-an-email' }, { auth: false, expectStatus: 400 });
  await login();
  await request('GET', '/tasks?priority=10', undefined, { expectStatus: 400 });
  await request('GET', '/planner/daily?workStart=18&workEnd=9', undefined, { expectStatus: 400 });
  await request('GET', '/reports/history?limit=200', undefined, { expectStatus: 400 });
  await request('GET', '/insights/habits?days=2', undefined, { expectStatus: 400 });
  await request('POST', '/templates/starter/not_a_mode/apply', undefined, { expectStatus: 400 });
}

async function testPlanGatesAndLimits() {
  const freeEmail = `planova-free-${Date.now()}@example.com`;
  await login(freeEmail);

  const current = await request('GET', '/plans/me');
  assert(current.plan.name === 'free', 'fresh account starts on free');

  const billing = await request('GET', '/billing/me');
  assert(billing.user.plan === 'free' && typeof billing.configured === 'boolean', 'billing status loads for authenticated user');

  await request('POST', '/billing/checkout', { plan: 'free' }, { expectStatus: 400 });

  await request('POST', '/copilot/daily-plan', {
    prompt: 'plan my day',
    date: today(),
  }, { expectStatus: 403 });

  await request('GET', '/insights/habits', undefined, { expectStatus: 403 });

  for (let index = 1; index <= 3; index += 1) {
    await request('POST', '/goals', {
      title: uniqueTitle(`Free limit goal ${index}`),
      timeframe: 'annual',
      lifeArea: 'career',
    });
  }

  await request('POST', '/goals', {
    title: uniqueTitle('Free limit goal overflow'),
    timeframe: 'annual',
    lifeArea: 'career',
  }, { expectStatus: 403 });
}

async function testCoreFlows() {
  const premiumEmail = `planova-premium-${Date.now()}@example.com`;
  await login(premiumEmail);

  const plan = await request('PATCH', '/plans/me', { plan: 'premium' });
  assert(plan.plan.name === 'premium', 'development plan switch enables premium tests');

  const date = today();
  const task = await request('POST', '/tasks', {
    title: uniqueTitle('API task'),
    dueDate: date,
    priority: 1,
    duration: 45,
    lifeArea: 'career',
  });
  assert(task.id, 'task can be created');

  await request('PATCH', `/tasks/${task.id}/status`, { status: 'in_progress' });
  const updatedTask = await request('GET', `/tasks/${task.id}`);
  assert(updatedTask.status === 'in_progress', 'task status can be updated');

  const focus = await request('POST', '/planner/focus-blocks', {
    title: uniqueTitle('API focus'),
    date,
    startTime: '09:00',
    endTime: '09:45',
    type: 'focus',
  });
  assert(focus.id, 'focus block can be created');

  const options = await request('GET', `/tasks/${task.id}/reschedule-options?date=${date}`);
  assert(options.options.some((option) => option.action === 'tomorrow'), 'reschedule options include tomorrow');

  const rescheduled = await request('POST', `/tasks/${task.id}/reschedule`, { action: 'tomorrow' });
  assert(rescheduled.action === 'tomorrow', 'task can be rescheduled');

  const goal = await request('POST', '/goals', {
    title: uniqueTitle('API goal'),
    timeframe: 'annual',
    lifeArea: 'career',
  });
  assert(goal.id, 'goal can be created');

  const roadmap = await request('POST', `/goals/${goal.id}/roadmap/generate`, {
    startDate: date,
    months: 1,
    weeksPerMilestone: 2,
    tasksPerWeek: 2,
  });
  assert(roadmap.created.tasks === 4, 'roadmap generation creates expected tasks');

  const habit = await request('POST', '/habits', {
    title: uniqueTitle('API habit'),
    frequency: 'daily',
    lifeArea: 'health',
  });
  assert(habit.id, 'habit can be created');

  const habitLog = await request('POST', `/habits/${habit.id}/logs`, {
    date,
    completed: true,
    mood: 5,
  });
  assert(habitLog.completed === true, 'habit log can be upserted');

  const note = await request('POST', '/personal/notes', { text: uniqueTitle('API note') });
  assert(note.id, 'personal note can be created');

  const dashboard = await request('GET', `/dashboard/today?date=${date}`);
  assert(dashboard.tasks && dashboard.goals && dashboard.habits, 'dashboard today returns core sections');
}

async function main() {
  console.log(`Planova API tests: ${baseUrl}`);
  await request('GET', '/health', undefined, { auth: false });
  ok('health endpoint is reachable');
  const authConfig = await request('GET', '/auth/config', undefined, { auth: false });
  assert(typeof authConfig.devEmailLoginEnabled === 'boolean' && typeof authConfig.googleOAuthEnabled === 'boolean', 'auth config exposes login modes');

  await testValidation();
  await testPlanGatesAndLimits();
  await testCoreFlows();

  console.log(`\nAPI tests passed: ${checks} checks`);
}

main().catch((error) => {
  console.error(`\nAPI tests failed: ${error.message}`);
  process.exit(1);
});
