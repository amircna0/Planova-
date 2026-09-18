export const LIFE_AREAS = [
  'career',
  'health',
  'money',
  'learning',
  'relationships',
  'personal_growth',
] as const;

export type LifeArea = (typeof LIFE_AREAS)[number];
