export const USER_MODES = ['student', 'freelancer', 'fitness_lifestyle', 'general'] as const;

export type UserMode = (typeof USER_MODES)[number];
