import { LifeArea } from '../common/life-areas';

export interface CopilotTaskDraft {
  title: string;
  priority: number;
  duration: number;
  category?: string;
  lifeArea?: LifeArea;
}

export interface CopilotPlan {
  source: 'openai' | 'fallback';
  date: string;
  topPriorities: string[];
  tasks: CopilotTaskDraft[];
  focusBlocks: Array<{
    title: string;
    startTime: string;
    endTime: string;
  }>;
  breaks: Array<{
    startTime: string;
    endTime: string;
  }>;
  reminders: string[];
  rescheduleAdvice: string[];
}
