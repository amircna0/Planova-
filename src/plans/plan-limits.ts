export type PlanName = 'free' | 'pro' | 'premium';
export type LimitedResource = 'tasks' | 'goals' | 'habits';

export interface PlanDefinition {
  name: PlanName;
  limits: Record<LimitedResource, number | null>;
  features: string[];
}

export const PLAN_DEFINITIONS: Record<PlanName, PlanDefinition> = {
  free: {
    name: 'free',
    limits: {
      tasks: 30,
      goals: 3,
      habits: 3,
    },
    features: ['daily_planner', 'basic_calendar', 'basic_goals', 'limited_habits'],
  },
  pro: {
    name: 'pro',
    limits: {
      tasks: null,
      goals: null,
      habits: null,
    },
    features: ['ai_planner', 'smart_rescheduling', 'weekly_reports', 'unlimited_core'],
  },
  premium: {
    name: 'premium',
    limits: {
      tasks: null,
      goals: null,
      habits: null,
    },
    features: ['ai_planner', 'smart_rescheduling', 'weekly_reports', 'unlimited_core', 'advanced_analytics', 'life_dashboard', 'templates', 'shared_planning'],
  },
};

export const PLAN_NAMES = Object.keys(PLAN_DEFINITIONS) as PlanName[];

export const FEATURE_UPGRADE_PLAN: Record<string, PlanName> = {
  ai_planner: 'pro',
  smart_rescheduling: 'pro',
  weekly_reports: 'pro',
  unlimited_core: 'pro',
  advanced_analytics: 'premium',
  life_dashboard: 'premium',
  templates: 'premium',
  shared_planning: 'premium',
};
