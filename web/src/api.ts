import { Project, TaskItem, TokenPayload } from './types';

export interface JsonResult<T> {
  response: Response;
  data: T | null;
  rawText: string;
}

export function stripHtmlSnippet(input = '') {
  return input.replace(/<[^>]+>/g, ' ').trim();
}

export async function requestJson<T>(url: string, options: RequestInit = {}): Promise<JsonResult<T>> {
  const response = await fetch(url, options);
  const rawText = await response.text();
  let data: T | null = null;
  try {
    data = JSON.parse(rawText);
  } catch (_error) {
    data = null;
  }
  return { response, data, rawText };
}

export function buildTokenPayload(oauthState?: string | null, accessToken?: string): TokenPayload | null {
  if (oauthState) return { oauthState };
  if (accessToken) return { accessToken };
  return null;
}

export async function fetchTimeConfig() {
  return requestJson<{ timeSource: string }>('/api/time/config');
}

export interface AiRewriteBody {
  rawText: string;
  locale: string;
  projects: Project[];
  currentTime?: string;
  openaiBaseUrl?: string;
  openaiApiKey?: string;
}

export async function aiRewrite(body: AiRewriteBody) {
  return requestJson<{ tasks: TaskItem[]; model: string }>('/api/ai/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface AuthorizePayload {
  clientId?: string;
  clientSecret?: string;
  redirectUri: string;
  scope?: string;
}

export async function startAuthorize(body: AuthorizePayload) {
  return requestJson<{ authorizeUrl: string; state: string }>('/api/oauth/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchOauthSession(state: string) {
  return requestJson<{ accessToken: string; refreshToken?: string; expiresAt?: string }>('/api/oauth/session?state=' + encodeURIComponent(state));
}

export async function exchangeAuthCode(body: { code: string; clientId?: string; clientSecret?: string; redirectUri: string; scope?: string }) {
  return requestJson<{ accessToken: string; state?: string; expiresAt?: string }>('/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function validateAuthorization(payload: TokenPayload) {
  return requestJson<{ success: boolean; projects?: Project[]; auth?: { sessionState?: string; expiresAt?: string } }>('/api/dida/projects/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function listProjects(payload: TokenPayload) {
  return requestJson<{ success: boolean; projects: Project[]; auth?: { sessionState?: string } }>('/api/dida/projects/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function fetchProjectData(body: { projectId: string } & TokenPayload) {
  return requestJson<{ success: boolean; data: any; auth?: { sessionState?: string } }>('/api/dida/project/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function toggleTaskComplete(body: { projectId: string; taskId: string; complete: boolean; task?: any } & TokenPayload) {
  return requestJson<{ success: boolean }>('/api/dida/project/task/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchTaskDetail(body: { projectId: string; taskId: string } & TokenPayload) {
  return requestJson<{ success: boolean; data: any; auth?: { sessionState?: string } }>('/api/dida/project/task/detail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface CreateTasksBody extends TokenPayload {
  projectId: string;
  projectName?: string;
  timeZone: string;
  reminders: string[];
  tasks: TaskItem[];
}

export async function createTasks(body: CreateTasksBody) {
  return requestJson<{ results: { title: string; success?: boolean; error?: string; message?: string }[]; auth?: { sessionState?: string; refreshCount?: number } }>('/api/dida/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchSubmissions() {
  return requestJson<{ entries: any[] }>('/api/submissions');
}
