const baseUrl = process.env.PLANOVA_BASE_URL || 'http://localhost:8889';
const email = process.env.PLANOVA_DEMO_EMAIL || 'demo@planova.app';
const targetPlan = process.env.PLANOVA_DEMO_PLAN || 'premium';

let token = '';

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

async function main() {
  console.log(`Seeding Planova demo data at ${baseUrl}`);
  console.log(`Demo account: ${email}`);

  const session = await request('POST', '/auth/login', { email }, false);
  token = session.access_token;

  const planInfo = await request('GET', '/plans/me');
  if (planInfo.devPlanSwitchEnabled) {
    await request('PATCH', '/plans/me', { plan: targetPlan });
  } else {
    console.log('Development plan switch is disabled; keeping current plan.');
  }

  await request('PATCH', '/profile', {
    name: 'Planova Demo',
    mode: 'freelancer',
  });

  const date = today();
  const tomorrow = addDays(date, 1);
  const nextWeek = addDays(date, 7);

  const careerGoal = await request('POST', '/goals', {
    title: 'Land a remote developer client',
    description: 'Build a portfolio, apply consistently, and follow up with leads.',
    timeframe: 'annual',
    lifeArea: 'career',
  });

  await request('POST', `/goals/${careerGoal.id}/roadmap/generate`, {
    startDate: date,
    months: 1,
    weeksPerMilestone: 2,
    tasksPerWeek: 2,
  });

  await request('POST', '/goals', {
    title: 'Build healthier daily energy',
    timeframe: 'annual',
    lifeArea: 'health',
  });

  await request('POST', '/tasks', {
    title: 'Prepare portfolio case study outline',
    dueDate: date,
    priority: 1,
    duration: 60,
    lifeArea: 'career',
  });

  await request('POST', '/tasks', {
    title: 'Send two client follow-ups',
    dueDate: date,
    priority: 2,
    duration: 45,
    lifeArea: 'career',
  });

  await request('POST', '/tasks', {
    title: 'Plan tomorrow workout',
    dueDate: tomorrow,
    priority: 3,
    duration: 30,
    lifeArea: 'health',
  });

  await request('POST', '/planner/focus-blocks', {
    title: 'Portfolio deep work',
    date,
    startTime: '10:00',
    endTime: '11:30',
    type: 'focus',
  });

  const dailyPlanning = await request('POST', '/habits', {
    title: 'Daily planning',
    frequency: 'daily',
    lifeArea: 'personal_growth',
  });

  const workout = await request('POST', '/habits', {
    title: 'Workout or active recovery',
    frequency: 'daily',
    lifeArea: 'health',
  });

  await request('POST', `/habits/${dailyPlanning.id}/logs`, {
    date,
    completed: true,
    mood: 4,
  });

  await request('POST', `/habits/${workout.id}/logs`, {
    date,
    completed: true,
    mood: 5,
  });

  await request('POST', '/personal/notes', {
    text: 'Demo note: focus on the portfolio case study before opening email.',
  });

  await request('POST', '/personal/dates', {
    title: 'Client proposal deadline',
    date: nextWeek,
  });

  await request('PUT', '/personal/reflections', {
    date,
    text: 'Good planning day. Keep tomorrow realistic and protect deep work time.',
  });

  await request('PUT', '/personal/monthly-focus', {
    month: monthKey(),
    text: 'Ship a visible portfolio proof and build client outreach consistency.',
  });

  await request('PUT', '/personal/budget', {
    month: monthKey(),
    total: 1500,
  });

  await request('POST', '/personal/budget/expenses', {
    month: monthKey(),
    name: 'Portfolio domain',
    amount: 18,
  });

  const dashboard = await request('GET', `/dashboard/today?date=${date}`);

  console.log('\nDemo seed complete.');
  console.log(`Open: ${baseUrl}`);
  console.log(`Login email: ${email}`);
  console.log(`Today tasks: ${dashboard.tasks.totalToday}`);
  console.log(`Active goals: ${dashboard.goals.active}`);
}

main().catch((error) => {
  console.error(`\nDemo seed failed: ${error.message}`);
  process.exit(1);
});
