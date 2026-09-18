import { LifeArea } from '../common/life-areas';
import { UserMode } from '../common/user-modes';

interface StarterTemplateItem {
  title: string;
  lifeArea: LifeArea;
}

interface StarterTemplate {
  mode: UserMode;
  goals: StarterTemplateItem[];
  habits: Array<StarterTemplateItem & { frequency: 'daily' | 'weekly' | 'monthly' }>;
  tasks: Array<StarterTemplateItem & { duration: number; priority: number }>;
}

export const STARTER_TEMPLATES: Record<UserMode, StarterTemplate> = {
  student: {
    mode: 'student',
    goals: [
      { title: 'Prepare for upcoming exams', lifeArea: 'learning' },
      { title: 'Build a consistent study routine', lifeArea: 'personal_growth' },
    ],
    habits: [
      { title: 'Study block', frequency: 'daily', lifeArea: 'learning' },
      { title: 'Review notes', frequency: 'daily', lifeArea: 'learning' },
    ],
    tasks: [
      { title: 'List exam dates and deadlines', priority: 1, duration: 30, lifeArea: 'learning' },
      { title: 'Plan this week of study blocks', priority: 2, duration: 45, lifeArea: 'learning' },
    ],
  },
  freelancer: {
    mode: 'freelancer',
    goals: [
      { title: 'Deliver client work on time', lifeArea: 'career' },
      { title: 'Grow monthly freelance income', lifeArea: 'money' },
    ],
    habits: [
      { title: 'Client follow-up', frequency: 'daily', lifeArea: 'career' },
      { title: 'Track income and invoices', frequency: 'weekly', lifeArea: 'money' },
    ],
    tasks: [
      { title: 'Review active client deadlines', priority: 1, duration: 30, lifeArea: 'career' },
      { title: 'Send one proposal or follow-up', priority: 2, duration: 45, lifeArea: 'career' },
    ],
  },
  fitness_lifestyle: {
    mode: 'fitness_lifestyle',
    goals: [
      { title: 'Improve weekly fitness consistency', lifeArea: 'health' },
      { title: 'Build better sleep and recovery habits', lifeArea: 'health' },
    ],
    habits: [
      { title: 'Workout or active recovery', frequency: 'daily', lifeArea: 'health' },
      { title: 'Sleep check-in', frequency: 'daily', lifeArea: 'health' },
    ],
    tasks: [
      { title: 'Plan three workouts this week', priority: 1, duration: 30, lifeArea: 'health' },
      { title: 'Prepare a simple meal plan', priority: 2, duration: 45, lifeArea: 'health' },
    ],
  },
  general: {
    mode: 'general',
    goals: [
      { title: 'Create a balanced weekly plan', lifeArea: 'personal_growth' },
      { title: 'Make progress on one meaningful project', lifeArea: 'career' },
    ],
    habits: [
      { title: 'Daily planning', frequency: 'daily', lifeArea: 'personal_growth' },
      { title: 'Focused work block', frequency: 'daily', lifeArea: 'career' },
    ],
    tasks: [
      { title: 'Choose top three priorities for today', priority: 1, duration: 20, lifeArea: 'personal_growth' },
      { title: 'Schedule one focus block', priority: 2, duration: 15, lifeArea: 'career' },
    ],
  },
};
