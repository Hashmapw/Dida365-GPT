export type Priority = 'none' | 'low' | 'medium' | 'high';
export type ScheduleMode = 'point' | 'range' | 'none';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  projectId: string;
  priority: Priority;
  dueDate: string;
  startDate: string;
  suggestedDueDate?: string;
  scheduleMode: ScheduleMode;
  reminders: string[];
  subTasks: string[];
  isAllDay?: boolean;
  enabled?: boolean;
}

export interface Project {
  id: string;
  name: string;
  color?: string;
  groupId?: string;
  closed?: boolean;
}

export interface ProjectTask {
  id: string;
  title: string;
  desc?: string;
  content?: string;
  projectId?: string;
  startDate?: string;
  dueDate?: string;
  isAllDay?: boolean;
  priority?: number;
  status?: number;
  completedTime?: string;
  reminders?: string[];
  items?: ProjectTask[];
}

export interface ProjectData {
  project: Project;
  tasks: ProjectTask[];
}

export interface SubmissionEntry {
  title: string;
  id?: string;
  projectName?: string;
  projectId?: string;
  createdAt?: string;
  success?: boolean;
  error?: string;
  message?: string;
  latestTask?: ProjectTask;
  latestStatusCheckedAt?: string;
}

export interface TokenPayload {
  oauthState?: string | null;
  accessToken?: string;
}

export interface AiSettings {
  baseUrl?: string;
  apiKey?: string;
}
