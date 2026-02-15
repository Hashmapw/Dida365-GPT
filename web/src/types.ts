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
  rawLine?: string;
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
  isHidden?: boolean;
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
  originalContent?: string | null;
  aiPolishedContent?: string | null;
  latestSyncedContent?: string | null;
  priority?: number;
  status?: number;
  completedTime?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  isAllDay?: boolean;
  lastSyncedAt?: string | null;
  syncError?: string | null;
  requestPayload?: string | null;
}

export interface SyncStatus {
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  tasksSynced: number;
  tasksFailed: number;
  isSyncing: boolean;
}

export interface TokenPayload {
  oauthState?: string | null;
  accessToken?: string;
}

export interface AiSettings {
  baseUrl?: string;
  apiKey?: string;
}
