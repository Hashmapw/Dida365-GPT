import React, { useEffect, useMemo, useRef, useState } from 'react';
import { App as AntdApp, Button, Card, Flex, Space, Tag, Typography, Layout, Menu, theme, notification, Progress } from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  LockOutlined,
  SettingOutlined,
  FormOutlined,
  HistoryOutlined,
  UnorderedListOutlined,
  SafetyOutlined,
  RobotOutlined,
  EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { RawInputSection } from './components/RawInputSection';
import { TasksSection } from './components/TasksSection';
import { SubmitBar } from './components/SubmitBar';
import { OauthModal } from './components/OauthModal';
import { AiSettingsModal } from './components/AiSettingsModal';
import { PromptSettingsModal } from './components/PromptSettingsModal';
import { ProjectsView } from './components/ProjectsView';
import { SubmissionsView } from './components/SubmissionsView';
import { PageHeader } from './components/PageHeader';
import {
  AiRewriteBody,
  aiRewrite,
  buildTokenPayload,
  createTasks,
  exchangeAuthCode,
  fetchPrompts,
  fetchOauthSession,
  fetchProjectTasksAll,
  fetchSubmissions,
  fetchSyncStatus,
  fetchTimeConfig,
  listProjects,
  savePrompts,
  toggleTaskComplete,
  triggerSync,
  updateProjectTaskHidden,
  updateProjectTaskStatus,
  startAuthorize,
  stripHtmlSnippet,
  validateAuthorization,
} from './api';
import { AiSettings, Project, ProjectTask, SubmissionEntry, SyncStatus, TaskItem, TokenPayload } from './types';
import { getCurrentTimeWithTimezone } from './utils/time';

const OAUTH_STATE_KEY = 'didauto:oauthState';
const ACTIVE_MENU_KEY_STORAGE = 'didauto:activeMenuKey';
const AVAILABLE_MENU_KEYS = new Set(['submit-task', 'submissions', 'projects']);

function getInitialActiveMenuKey() {
  const stored = localStorage.getItem(ACTIVE_MENU_KEY_STORAGE);
  if (stored && AVAILABLE_MENU_KEYS.has(stored)) {
    return stored;
  }
  return 'submit-task';
}

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeTask(raw: Partial<TaskItem>, allDayDefault = false): TaskItem {
  const priority = normalizePriority(raw.priority);
  const startRaw = (raw.startDate || '').trim();
  const dueRaw = (raw.dueDate || raw.suggestedDueDate || '').trim();
  const startParts = splitDateAndTime(startRaw);
  const dueParts = splitDateAndTime(dueRaw);
  const hasStartDate = Boolean(startParts.date);
  const hasDueDate = Boolean(dueParts.date);
  const hasStartTime = Boolean(startParts.time);
  const hasDueTime = Boolean(dueParts.time);

  let scheduleMode: TaskItem['scheduleMode'] = raw.scheduleMode || 'point';
  if (hasStartDate || hasDueDate) {
    const datesDiffer = startParts.date && dueParts.date && startParts.date !== dueParts.date;
    const shouldRange = hasStartTime || hasDueTime || datesDiffer;
    scheduleMode = shouldRange ? 'range' : 'point';
  }

  let normalizedStart = startRaw;
  let normalizedDue = dueRaw;
  if (scheduleMode === 'point') {
    if (!hasDueDate && hasStartDate) {
      normalizedDue = startParts.date;
    }
    normalizedStart = '';
  }

  const dateOnlyFlag = (hasDueDate && !hasDueTime) || (hasStartDate && !hasStartTime);
  // Treat date-only values as全天，无论 isAllDay 默认值如何
  const resolvedAllDay = raw.isAllDay === true ? true : dateOnlyFlag ? true : allDayDefault;

  if (resolvedAllDay) {
    if (normalizedDue) {
      normalizedDue = normalizedDue.split('T')[0];
    }
    if (normalizedStart) {
      normalizedStart = normalizedStart.split('T')[0];
    }
  }

  return {
    id: raw.id || uid(),
    title: raw.title || '',
    description: raw.description || '',
    completed: Boolean(raw.completed),
    projectId: raw.projectId || '',
    priority,
    startDate: normalizedStart,
    dueDate: normalizedDue,
    suggestedDueDate: raw.suggestedDueDate,
    scheduleMode,
    reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
    subTasks: Array.isArray(raw.subTasks) ? raw.subTasks : [],
    isAllDay: resolvedAllDay,
    enabled: raw.enabled ?? true,
    rawLine: raw.rawLine,
  };
}

function normalizePriority(value: any): TaskItem['priority'] {
  const raw = (value ?? '').toString().trim().toLowerCase();
  if (!raw) return 'none';
  if (['urgent', 'high', '5', '最高', '高'].includes(raw)) return 'high';
  if (['medium', '3', '中'].includes(raw)) return 'medium';
  if (['low', '1', '低'].includes(raw)) return 'low';
  if (['none', '0', '无'].includes(raw)) return 'none';
  return 'none';
}

function parseTaskLines(input: string) {
  return input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length);
}

function splitDateAndTime(value: string) {
  if (!value) return { date: '', time: '' };
  const [datePart, timePart] = value.split('T');
  return { date: datePart || '', time: timePart || '' };
}

function isDateOnly(value = '') {
  return Boolean(value) && !value.includes('T');
}

function projectNameById(projects: Project[], id: string) {
  return projects.find((p) => p.id === id)?.name || '';
}

function formatProjectTaskStatus(tasks: ProjectTask[]) {
  if (!tasks.length) return '暂无任务';
  const hiddenCount = tasks.filter((task) => Boolean(task.isHidden)).length;
  if (!hiddenCount) return `共 ${tasks.length} 条任务`;
  return `共 ${tasks.length} 条任务（显示 ${tasks.length - hiddenCount}，已折叠 ${hiddenCount}）`;
}

export default function App() {
  const { message, notification } = AntdApp.useApp();
  const [rawText, setRawText] = useState('');
  const [locale, setLocale] = useState<'zh' | 'en'>('zh');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [aiSettings, setAiSettings] = useState<AiSettings>({});
  const [systemHint, setSystemHint] = useState('');
  const [userTemplate, setUserTemplate] = useState('');
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptsSaving, setPromptsSaving] = useState(false);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });
  const [aiStatus, setAiStatus] = useState('默认使用服务端配置');
  const [aiStatusType, setAiStatusType] = useState<'success' | 'warning' | 'error'>('success');
  const [oauthModalOpen, setOauthModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  
  // Navigation state
  const [activeMenuKey, setActiveMenuKey] = useState(getInitialActiveMenuKey);

  const [submissionsRange, setSubmissionsRange] = useState<'1d' | '3d' | '7d' | '30d' | 'all'>('7d');
  const [oauthState, setOauthState] = useState<string | null>(() => {
    return localStorage.getItem(OAUTH_STATE_KEY);
  });
  const [oauthStatus, setOauthStatus] = useState<{ type: 'success' | 'warning' | 'error' | 'info'; text: string }>({
    type: oauthState ? 'warning' : 'error',
    text: oauthState ? '等待授权结果' : '尚未授权',
  });
  const [timeSource, setTimeSource] = useState('Asia/Shanghai');
  const [projectsStatus, setProjectsStatus] = useState('');
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectTasksMap, setProjectTasksMap] = useState<Record<string, ProjectTask[]>>({});
  const [projectTasksStatus, setProjectTasksStatus] = useState<Record<string, string>>({});
  const [projectTasksLoadingId, setProjectTasksLoadingId] = useState<string | null>(null);
  const [checkedProjectTaskIds, setCheckedProjectTaskIds] = useState<string[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const lastSubmissionsLoadedAt = useRef<number>(0);
  const redirectUri = useMemo(() => new URL('/oauth/callback', window.location.origin).href, []);
  const filterOpenProjects = (items: Project[] = []) => items.filter((p) => p && p.closed !== true);

  const pendingTasksRef = useRef<Record<string, {
    taskId: string;
    projectId: string;
    timeoutId: NodeJS.Timeout;
    task: ProjectTask;
  }>>({});
  
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  async function executeTaskCompletion(taskId: string, projectId: string, task: ProjectTask) {
    if (pendingTasksRef.current[taskId]) {
      delete pendingTasksRef.current[taskId];
    }
    
    const payload: any = {
      projectId,
      taskId,
      complete: true,
      task,
      ...(tokenPayload || {}),
    };

    const { response, data, rawText } = await toggleTaskComplete(payload);
    
    if (!response.ok || !data?.success) {
      // Revert UI on failure
      setCheckedProjectTaskIds(prev => prev.filter(id => id !== taskId));
      const errorText = data?.error || stripHtmlSnippet(rawText) || '提交任务失败';
      message.error(errorText);
    } else {
       message.success(`任务 "${task.title}" 已完成`);
       // Refresh project tasks
       const selectedProject = projects.find((p) => p.id === projectId);
       if (selectedProject) {
         loadProjectTasks(selectedProject, true);
       }
    }
  }

  function undoTaskCompletion(taskId: string) {
    const pending = pendingTasksRef.current[taskId];
    if (pending) {
      clearTimeout(pending.timeoutId);
      notification.destroy(`pending-${taskId}`);
      delete pendingTasksRef.current[taskId];

      // Revert UI
      setCheckedProjectTaskIds(prev => prev.filter(id => id !== taskId));
      // Revert local DB
      updateProjectTaskStatus({ taskId, status: 0, completedTime: null });
      message.info('已撤销完成');
    }
  }

  // Flush pending tasks when switching pages
  useEffect(() => {
    const ids = Object.keys(pendingTasksRef.current);
    if (ids.length > 0) {
      ids.forEach(id => {
        const item = pendingTasksRef.current[id];
        clearTimeout(item.timeoutId);
        notification.destroy(`pending-${id}`);
        executeTaskCompletion(item.taskId, item.projectId, item.task);
      });
    }
  }, [activeMenuKey]);

  useEffect(() => {
    fetchTimeConfig().then(({ data }) => {
      if (data?.timeSource) {
        setTimeSource(data.timeSource);
      }
    });
  }, []);

  useEffect(() => {
    if (activeMenuKey === 'projects') {
      loadProjects(true);
    } else if (activeMenuKey === 'submissions') {
      if (Date.now() - lastSubmissionsLoadedAt.current >= 60_000 || !submissions.length) {
        loadSubmissionHistory();
      }
    }
  }, [activeMenuKey]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_MENU_KEY_STORAGE, activeMenuKey);
  }, [activeMenuKey]);

  useEffect(() => {
    function handleOauthMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload || payload.source !== 'didauto-auth') return;
      if (payload.state) {
        persistOauthState(payload.state);
        syncOauthSession(payload.state, false);
      }
      if (payload.success) {
        setOauthStatus({ type: 'success', text: payload.message || '授权成功' });
        message.success('授权成功，正在同步 Token');
      } else {
        setOauthStatus({ type: 'error', text: payload.message || '授权失败，请重试' });
        message.error(payload.message || '授权失败');
      }
    }
    window.addEventListener('message', handleOauthMessage);
    return () => window.removeEventListener('message', handleOauthMessage);
  }, [message]);

  useEffect(() => {
    if (oauthState) {
      validateAuth({ oauthState });
    }
  }, []);

  useEffect(() => {
    if (promptModalOpen) {
      loadPrompts();
    }
  }, [promptModalOpen]);

  const tokenPayload = buildTokenPayload(oauthState);

  async function validateAuth(payload: TokenPayload | null, silent = false) {
    if (!payload) {
      setOauthStatus({ type: 'error', text: '尚未授权' });
      return false;
    }
    const { response, data, rawText } = await validateAuthorization(payload);
    if (response.ok && data?.success) {
      setOauthStatus({
        type: 'success',
        text: data.auth?.expiresAt ? `授权有效 · 过期时间 ${new Date(data.auth.expiresAt).toLocaleString()}` : '授权有效',
      });
      if (Array.isArray(data.projects)) {
        setProjects(filterOpenProjects(data.projects));
      }
      return true;
    }
    const messageText = data?.error || stripHtmlSnippet(rawText) || '授权校验失败';
    setOauthStatus({ type: 'error', text: messageText });
    if (!silent) {
      message.error(messageText);
    }
    return false;
  }

  function persistOauthState(state: string) {
    setOauthState(state);
    localStorage.setItem(OAUTH_STATE_KEY, state);
  }

  async function syncOauthSession(state: string, silent = true) {
    const { response, data, rawText } = await fetchOauthSession(state);
    if (!response.ok) {
      const errorText = data?.error || stripHtmlSnippet(rawText) || '授权会话不存在或已失效';
      setOauthStatus({ type: 'error', text: errorText });
      if (!silent) {
        message.error(errorText);
      }
      return false;
    }
    persistOauthState(state);
    setOauthStatus({
      type: 'success',
      text: data?.expiresAt ? `授权成功 · 预计 ${new Date(data.expiresAt).toLocaleString()} 过期` : '授权成功',
    });
    return true;
  }

  async function handleStartOauth() {
    const { response, data, rawText } = await startAuthorize({ redirectUri });
    if (!response.ok || !data?.authorizeUrl || !data.state) {
      const errorText = data?.error || stripHtmlSnippet(rawText) || '无法启动 OAuth 流程';
      setOauthStatus({ type: 'error', text: errorText });
      message.error(errorText);
      return;
    }
    persistOauthState(data.state);
    setOauthStatus({ type: 'warning', text: '已打开授权窗口，请在完成后返回' });
    window.open(data.authorizeUrl, 'didauto-auth', 'width=520,height=720');
  }

  async function handleCheckOauth() {
    if (!oauthState) {
      message.warning('尚未保存 OAuth state，请重新发起授权');
      setOauthModalOpen(true);
      return;
    }
    await syncOauthSession(oauthState, false);
  }

  async function handleExchangeCode(values: { code: string; clientId?: string; clientSecret?: string }) {
    const payload = { ...values, redirectUri };
    const { response, data, rawText } = await exchangeAuthCode(payload);
    if (!response.ok || !data) {
      const errorText = data?.error || stripHtmlSnippet(rawText) || '获取 Token 失败';
      setOauthStatus({ type: 'error', text: errorText });
      message.error(errorText);
      return;
    }
    if (data.state) {
      persistOauthState(data.state);
    }
    setOauthStatus({
      type: 'success',
      text: data.expiresAt ? `Token 预计在 ${new Date(data.expiresAt).toLocaleString()} 过期` : '已保存授权',
    });
    setOauthModalOpen(false);
    validateAuth(buildTokenPayload(data.state || oauthState), true);
  }

  async function loadProjects(silent = false) {
    if (!tokenPayload) {
      if (!silent) {
        setProjectsStatus('请先完成授权');
        message.warning('请先完成授权');
      }
      return [];
    }
    setProjectsLoading(true);
    setProjectsStatus('正在获取清单列表...');
    const { response, data, rawText } = await listProjects(tokenPayload);
    setProjectsLoading(false);
    if (!response.ok) {
      const errorText = data?.error || stripHtmlSnippet(rawText) || '获取清单失败';
      setProjectsStatus(errorText);
      if (!silent) {
        message.error(errorText);
      }
      return [];
    }
    const list = Array.isArray(data.projects) ? filterOpenProjects(data.projects) : [];
    // Reset cached project tasks so expand will refetch after refresh
    setProjectTasksMap({});
    setCheckedProjectTaskIds([]);
    setProjectTasksStatus({});
    setProjects(list);
    setProjectsStatus(list.length ? `共 ${list.length} 个清单` : '暂无清单');
    return list;
  }

  async function loadPrompts() {
    setPromptsLoading(true);
    const { response, data, rawText } = await fetchPrompts();
    setPromptsLoading(false);
    if (!response.ok) {
      const errorText = data?.error || stripHtmlSnippet(rawText) || '无法获取提示词';
      message.error(errorText);
      return;
    }
    const decode = (val?: string) => (val ? val.replace(/\\n/g, '\n') : '');
    setSystemHint(decode(data?.systemHint));
    setUserTemplate(decode(data?.userTemplate));
  }

  async function handleSavePrompts(values: { systemHint: string; userTemplate: string }) {
    setPromptsSaving(true);
    const encode = (val: string) => val.replace(/\r?\n/g, '\\n');
    const payload = { systemHint: encode(values.systemHint || ''), userTemplate: encode(values.userTemplate || '') };
    const { response, data, rawText } = await savePrompts(payload);
    setPromptsSaving(false);
    if (!response.ok || !data?.success) {
      const errorText = data?.error || stripHtmlSnippet(rawText) || '保存失败';
      message.error(errorText);
      return;
    }
    setSystemHint(values.systemHint);
    setUserTemplate(values.userTemplate);
    message.success('已保存提示词到 .env');
  }

  async function handleAiGenerate() {
    const lines = parseTaskLines(rawText);
    if (!lines.length) {
      message.error('请先输入至少一行任务内容');
      return;
    }
    setAiLoading(true);
    setAiProgress({ current: 0, total: lines.length });
    setAiStatus('正在调用 AI 整理任务');
    setAiStatusType('warning');
    setTasks([]);
    const availableProjects = tokenPayload ? await loadProjects(true) : filterOpenProjects(projects);
    const currentTime = getCurrentTimeWithTimezone(timeSource || 'Local');

    try {
      const generated: TaskItem[] = [];
      for (let i = 0; i < lines.length; i += 1) {
        setAiProgress({ current: i, total: lines.length });
        const body: AiRewriteBody = {
          rawText: lines[i],
          locale,
          projects: availableProjects,
          currentTime,
        };
        if (aiSettings.baseUrl) body.openaiBaseUrl = aiSettings.baseUrl;
        if (aiSettings.apiKey) body.openaiApiKey = aiSettings.apiKey;

        const { response, data, rawText } = await aiRewrite(body);
        if (!response.ok || !data?.tasks) {
          throw new Error(data?.error || stripHtmlSnippet(rawText) || 'AI 返回为空');
        }
        data.tasks.forEach((task) => generated.push(normalizeTask({ ...task, rawLine: lines[i] }, false)));
        setTasks(generated.slice());
        setAiProgress({ current: i + 1, total: lines.length });
      }
      setAiStatus(`共生成 ${generated.length} 条任务`);
      setAiStatusType('success');
      message.success(`AI 整理完成，共 ${generated.length} 条`);
    } catch (error: any) {
      const msg = error?.message || 'AI 整理失败';
      setAiStatus(msg);
      setAiStatusType('error');
      message.error(msg);
    } finally {
      setAiLoading(false);
    }
  }

  function addEmptyTask() {
    const today = dayjs().format('YYYY-MM-DD');
    setTasks((prev) => [
      ...prev,
      normalizeTask({
        title: '',
        description: '',
        completed: false,
        projectId: '',
        priority: 'none',
        dueDate: today,
        scheduleMode: 'point',
        subTasks: [],
        reminders: [],
        isAllDay: false,
      }),
    ]);
  }

  function handleTaskChange(index: number, updates: Partial<TaskItem>) {
    setTasks((prev) => prev.map((task, idx) => (idx === index ? { ...task, ...updates } : task)));
  }

  function handleRemoveTask(index: number) {
    setTasks((prev) => prev.filter((_, idx) => idx !== index));
  }

  function clearTasks() {
    setTasks([]);
    message.success('已清空任务');
  }

  async function handleSubmitClick() {
    const activeTasks = tasks.filter((task) => task.enabled !== false);
    if (!activeTasks.length) {
      message.error('至少需要一条任务');
      return;
    }
    for (let i = 0; i < activeTasks.length; i += 1) {
      const t = activeTasks[i];
      if (!t.title.trim()) {
        message.error(`任务 ${i + 1} 的标题不能为空`);
        return;
      }
      if (!t.projectId.trim()) {
        message.error(`任务 ${i + 1} 的所属清单不能为空`);
        return;
      }
    }
    if (!tokenPayload) {
      message.error('需要完成 OAuth 授权后才能提交');
      setOauthModalOpen(true);
      return;
    }
    submitTasks(activeTasks);
  }

  async function submitTasks(tasksToSubmit: TaskItem[]) {
    if (!tasksToSubmit.length) {
      return;
    }
    const chosenProject = tasksToSubmit.find((task) => task.projectId)?.projectId || '';
    if (!chosenProject) {
      message.error('请选择所属清单');
      return;
    }
    const payload = {
      ...(tokenPayload as TokenPayload),
      projectId: chosenProject,
      projectName: projectNameById(projects, chosenProject),
      timeZone: timeSource || 'Asia/Shanghai',
      reminders: [],
      tasks: tasksToSubmit,
    };
    setCreateLoading(true);
    const { response, data, rawText } = await createTasks(payload);
    setCreateLoading(false);
    if (!response.ok || !data) {
      const errorText = data?.error || stripHtmlSnippet(rawText) || '创建失败';
      message.error(errorText);
      return;
    }
    (data.results || []).forEach((item) => {
      if (item.success !== false) {
        notification.success({ message: item.title || '已创建任务', description: item.message || '' });
      } else {
        notification.error({ message: item.title || '提交失败', description: item.error || '未知错误' });
      }
    });
  }

  async function loadSubmissionHistory(rangeOverride?: string): Promise<SubmissionEntry[]> {
    setSubmissionsLoading(true);
    try {
      const { response, data, rawText } = await fetchSubmissions(rangeOverride ?? submissionsRange);
      if (!response.ok) {
        const errorText = data?.error || stripHtmlSnippet(rawText) || '无法获取提交记录';
        message.error(errorText);
        return [];
      }
      const entries = Array.isArray(data?.entries) ? (data.entries as SubmissionEntry[]) : [];
      setSubmissions(entries);
      lastSubmissionsLoadedAt.current = Date.now();
      if (!entries.length) {
        message.warning('所选时间范围内没有提交记录');
      }
      // Also fetch sync status
      const syncResult = await fetchSyncStatus();
      if (syncResult.response.ok && syncResult.data) {
        setSyncStatus(syncResult.data);
      }
      return entries;
    } finally {
      setSubmissionsLoading(false);
    }
  }

  async function handleManualSync() {
    if (!tokenPayload) {
      message.error('需要授权后才能同步');
      return;
    }
    setSyncing(true);
    try {
      const { response, data, rawText } = await triggerSync(tokenPayload);
      if (!response.ok || !data?.success) {
        const errorText = data?.error || stripHtmlSnippet(rawText) || '同步失败';
        message.error(errorText);
        return;
      }
      const msg = `同步完成: ${data.synced || 0} 成功, ${data.failed || 0} 失败${data.rateLimited ? ' (触发限流)' : ''}`;
      if (data.failed) {
        message.warning(msg);
      } else {
        message.success(msg);
      }
      if (data.syncState) {
        setSyncStatus(data.syncState as SyncStatus);
      }
      // Reload submissions to reflect updated data
      await loadSubmissionHistory();
    } finally {
      setSyncing(false);
    }
  }

  function submissionToProjectTask(entry: SubmissionEntry): ProjectTask {
    let synced: any = {};
    try {
      if (entry.latestSyncedContent) synced = JSON.parse(entry.latestSyncedContent);
    } catch {}
    return {
      id: entry.id || '',
      title: synced.title || entry.title || '未命名任务',
      desc: synced.description || synced.desc || '',
      content: synced.content || '',
      projectId: entry.projectId,
      startDate: synced.startDate || entry.startDate || undefined,
      dueDate: synced.dueDate || entry.dueDate || undefined,
      isAllDay: synced.isAllDay ?? entry.isAllDay,
      priority: synced.priority ?? entry.priority,
      status: synced.status ?? entry.status,
      completedTime: synced.completedTime || entry.completedTime || undefined,
      items: Array.isArray(synced.items) ? synced.items : [],
    };
  }

  async function loadProjectTasks(project: Project, force = false) {
    if (!force && projectTasksMap[project.id]) return;
    setProjectTasksLoadingId(project.id);
    setProjectTasksStatus((prev) => ({ ...prev, [project.id]: `正在加载 ${project.name || '清单'}...` }));

    let tasks: ProjectTask[] = [];
    const payload = buildTokenPayload(oauthState);
    if (payload) {
      try {
        const { data } = await fetchProjectTasksAll({ projectId: project.id, ...payload });
        tasks = Array.isArray(data?.tasks) ? data.tasks : [];
      } catch (err: any) {
        console.warn('API loadProjectTasks failed, falling back to submissions:', err.message);
      }
    }

    // Fallback: if API returned nothing, use local submissions
    if (!tasks.length) {
      let source = submissions;
      if (!source.length) {
        source = await loadSubmissionHistory();
      }
      tasks = source
        .filter((e) => e.projectId === project.id)
        .map(submissionToProjectTask);
    }

    setProjectTasksLoadingId(null);
    setProjectTasksMap((prev) => ({ ...prev, [project.id]: tasks }));
    setCheckedProjectTaskIds((prev) => {
      const nextChecked = tasks.filter((t) => t.status === 2 || t.completedTime).map((t) => t.id);
      const merged = new Set([...prev, ...nextChecked]);
      return Array.from(merged);
    });
    setProjectTasksStatus((prev) => ({ ...prev, [project.id]: formatProjectTaskStatus(tasks) }));
    if (!tasks.length) {
      message.warning(`清单 ${project.name || '未命名清单'} 下暂无任务`);
    }
  }

  async function handleToggleHiddenProjectTask(taskId: string, isHidden: boolean) {
    const currentProject = Object.entries(projectTasksMap).find(([, list]) => list.some((task) => task.id === taskId))?.[0] || '';
    if (!currentProject) return;

    const previousTasks = projectTasksMap[currentProject] || [];
    const currentTask = previousTasks.find((task) => task.id === taskId);
    if (!currentTask) return;
    const nextTasks = previousTasks.map((task) => (task.id === taskId ? { ...task, isHidden } : task));

    setProjectTasksMap((prev) => ({ ...prev, [currentProject]: nextTasks }));
    setProjectTasksStatus((prev) => ({ ...prev, [currentProject]: formatProjectTaskStatus(nextTasks) }));

    const { response, data, rawText } = await updateProjectTaskHidden({
      taskId,
      isHidden,
      projectId: currentProject,
      task: currentTask,
    });
    if (!response.ok || !data?.success) {
      const errorText = data?.error || stripHtmlSnippet(rawText) || '更新隐藏状态失败';
      setProjectTasksMap((prev) => ({ ...prev, [currentProject]: previousTasks }));
      setProjectTasksStatus((prev) => ({ ...prev, [currentProject]: formatProjectTaskStatus(previousTasks) }));
      message.error(errorText);
      return;
    }
    message.success(isHidden ? '任务已隐藏' : '已取消隐藏');
  }

  async function handleToggleProjectTask(taskId: string, checked: boolean) {
    if (!checked) {
      // Allow unchecking ONLY if it is currently pending
      if (pendingTasksRef.current[taskId]) {
        undoTaskCompletion(taskId);
        return;
      }
      message.warning('已完成的任务无法取消勾选');
      return;
    }

    const currentProject = Object.entries(projectTasksMap).find(([, list]) => list.some((t) => t.id === taskId))?.[0] || '';
    if (!currentProject) return;
    const task = projectTasksMap[currentProject]?.find((t) => t.id === taskId);
    if (!task) return;

    // Optimistically update UI
    setCheckedProjectTaskIds((prev) => Array.from(new Set([...prev, taskId])));

    // Immediately update local DB
    updateProjectTaskStatus({ taskId, status: 2, completedTime: new Date().toISOString() });

    // Start delay
    const duration = 30; // seconds
    const key = `pending-${taskId}`;
    
    const timeoutId = setTimeout(() => {
      executeTaskCompletion(taskId, currentProject, task);
      notification.destroy(key);
    }, duration * 1000);

    pendingTasksRef.current[taskId] = { taskId, projectId: currentProject, timeoutId, task };

    notification.open({
      key,
      message: (
        <Flex justify="space-between" align="center" style={{ width: '100%', paddingRight: 24 }}>
           <Typography.Text strong>任务已标记完成</Typography.Text>
           <Typography.Text type="secondary" style={{ fontSize: 12 }}>{duration}s 后提交</Typography.Text>
        </Flex>
      ),
      description: (
        <div style={{ marginTop: 8 }}>
          <Typography.Text ellipsis style={{ maxWidth: '100%', display: 'block', color: '#666', fontSize: 13, marginBottom: 8 }}>
            {task.title}
          </Typography.Text>
          <div className="countdown-bar-container">
            <div 
              className="countdown-bar-fill" 
              style={{ animation: `countdown-width ${duration}s linear forwards` }} 
            />
          </div>
        </div>
      ),
      duration: duration,
      btn: (
        <Button type="primary" size="small" onClick={() => undoTaskCompletion(taskId)}>
          撤销
        </Button>
      ),
      placement: 'bottomRight',
      icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      style: { width: 360 }
    });
  }

  const projectTreeData = projects.map((project) => {
    const tasksLoaded = Object.prototype.hasOwnProperty.call(projectTasksMap, project.id);
    const tasks = projectTasksMap[project.id] || [];

    const toTaskNode = (task: ProjectTask) => ({
      title: task.title || '未命名任务',
      key: task.id,
      nodeType: 'task',
      taskStatus: task.status,
      taskCompletedTime: task.completedTime,
      isHidden: Boolean(task.isHidden),
      children: Array.isArray(task.items)
        ? task.items.map((sub, idx) => ({
            title: sub.title || `子任务 ${idx + 1}`,
            key: `${task.id}-sub-${idx}`,
            nodeType: 'subtask',
            disableCheckbox: true,
          }))
        : [],
      disableCheckbox: task.status === 2 || !!task.completedTime,
    });

    const visibleTasks = tasks.filter((task) => !task.isHidden);
    const hiddenTasks = tasks.filter((task) => task.isHidden);

    const children =
      tasks.length > 0
        ? [
            ...visibleTasks.map(toTaskNode),
            ...(hiddenTasks.length
              ? [
                  {
                    title: `已折叠任务 (${hiddenTasks.length})`,
                    key: `${project.id}-collapsed`,
                    nodeType: 'collapsed-group',
                    disableCheckbox: true,
                    selectable: false,
                    children: hiddenTasks.map(toTaskNode),
                  },
                ]
              : []),
          ]
        : tasksLoaded
          ? []
          : [
              {
                title: projectTasksLoadingId === project.id ? '加载中...' : '点击展开加载任务',
                key: `${project.id}-loading`,
                disableCheckbox: true,
                selectable: false,
              },
            ];
    return {
      title: project.name || '未命名清单',
      key: project.id,
      nodeType: 'project',
      color: project.color,
      disableCheckbox: true,
      checkable: false,
      isLeaf: tasksLoaded && tasks.length === 0,
      children,
    };
  });

  const statusBadges = (
    <Space className="pill-row">
      <StatusPill
        icon={<LockOutlined />}
        status={oauthStatus.type}
        text={oauthStatus.text}
        onClick={() => setOauthModalOpen(true)}
      />
      <StatusPill
        icon={<ApiOutlined />}
        status={aiStatusType}
        text={aiStatus}
        onClick={() => setAiModalOpen(true)}
      />
    </Space>
  );

  const renderContent = () => {
    switch (activeMenuKey) {
      case 'submit-task':
        return (
          <>
            <PageHeader
              title="Markdown Submit"
              subtitle="将组会上散落的 Todo 待办列表，自动整理并提交到滴答清单，AI 帮你补充细节，提高任务管理效率！"
              eyebrow="Todo List 2 Dida365"
              extra={statusBadges}
            />

            <Space direction="vertical" size="large" style={{ width: '100%', marginTop: 24 }}>
              <RawInputSection
                rawText={rawText}
                locale={locale}
                onRawChange={setRawText}
                onLocaleChange={setLocale}
                onGenerate={handleAiGenerate}
                onAddTask={addEmptyTask}
                generating={aiLoading}
                progress={aiProgress}
              />
              <TasksSection
                tasks={tasks}
                projects={projects}
                onTaskChange={handleTaskChange}
                onRemoveTask={handleRemoveTask}
                onAddTask={addEmptyTask}
                onClearTasks={clearTasks}
                onRefreshProjects={() => loadProjects(false)}
              />
            </Space>

            <SubmitBar
              onSubmit={handleSubmitClick}
              submitting={createLoading}
              taskCount={tasks.filter((t) => t.enabled !== false).length}
              timeZone={timeSource}
            />
          </>
        );
      case 'projects':
        return (
          <ProjectsView
            projects={projects}
            loading={projectsLoading}
            statusText={projectsStatus}
            onRefresh={() => loadProjects(false)}
            treeData={projectTreeData}
            checkedTaskIds={checkedProjectTaskIds}
            onToggleTask={handleToggleProjectTask}
            onToggleHiddenTask={handleToggleHiddenProjectTask}
            onExpandProject={(projectId) => {
              const project = projects.find((p) => p.id === projectId);
              if (project) {
                loadProjectTasks(project);
              }
            }}
            loadingProjectId={projectTasksLoadingId}
            projectStatus={projectTasksStatus}
          />
        );
      case 'submissions':
        return (
          <SubmissionsView
            entries={submissions}
            loading={submissionsLoading}
            range={submissionsRange}
            onRangeChange={(val) => {
              setSubmissionsRange(val);
              loadSubmissionHistory(val);
            }}
            onRefresh={() => {
              loadSubmissionHistory();
            }}
            syncing={syncing}
            onSync={handleManualSync}
            syncStatus={syncStatus}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider
        width={240}
        theme="light"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          borderRight: '1px solid rgba(5, 5, 5, 0.06)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.02)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '32px 24px 24px', flexShrink: 0 }}>
          <Flex align="center" gap={12}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #1677ff 0%, #3b5999 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: 18,
                boxShadow: '0 4px 10px rgba(22, 119, 255, 0.2)',
              }}
            >
              D
            </div>
            <Typography.Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1f2433' }}>
              Dida Auto
            </Typography.Title>
          </Flex>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
          <Menu
            mode="inline"
            selectedKeys={[activeMenuKey]}
            onClick={(e) => {
              if (['oauth', 'ai-settings', 'prompt-settings'].includes(e.key)) {
                if (e.key === 'oauth') setOauthModalOpen(true);
                if (e.key === 'ai-settings') setAiModalOpen(true);
                if (e.key === 'prompt-settings') setPromptModalOpen(true);
                return;
              }
              setActiveMenuKey(String(e.key));
            }}
            style={{ borderRight: 0 }}
            items={[
              {
                key: 'submit-task',
                icon: <FormOutlined />,
                label: '提交任务',
              },
              {
                key: 'submissions',
                icon: <HistoryOutlined />,
                label: '提交记录',
              },
              {
                key: 'projects',
                icon: <UnorderedListOutlined />,
                label: '清单列表',
              },
              {
                type: 'divider',
                style: { margin: '24px 0' },
              },
              {
                key: 'settings-group',
                label: <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>设置与配置</span>,
                type: 'group',
                children: [
                   {
                    key: 'oauth',
                    icon: <SafetyOutlined />,
                    label: '授权管理',
                  },
                  {
                    key: 'ai-settings',
                    icon: <RobotOutlined />,
                    label: 'AI 设置',
                  },
                  {
                    key: 'prompt-settings',
                    icon: <EditOutlined />,
                    label: 'Prompt 设置',
                  },
                ]
              }
            ]}
          />
        </div>
      </Layout.Sider>
      <Layout style={{ marginLeft: 240, background: '#f7f8fb', transition: 'all 0.2s' }}>
        <Layout.Content style={{ margin: '32px 32px 0', overflow: 'initial' }}>
          <div className="app-shell" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 0 120px' }}>
            {renderContent()}
          </div>
        </Layout.Content>
      </Layout>

      <OauthModal
        open={oauthModalOpen}
        onClose={() => setOauthModalOpen(false)}
        onStartOauth={handleStartOauth}
        onCheckOauth={handleCheckOauth}
        onExchangeCode={handleExchangeCode}
        redirectUri={redirectUri}
        statusText={oauthStatus.text}
        statusType={oauthStatus.type}
        oauthState={oauthState}
        submitting={false}
      />

      <AiSettingsModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onSave={(values) => setAiSettings(values)}
        baseUrl={aiSettings.baseUrl}
        apiKey={aiSettings.apiKey}
      />

      <PromptSettingsModal
        open={promptModalOpen}
        onClose={() => setPromptModalOpen(false)}
        systemHint={systemHint}
        userTemplate={userTemplate}
        loading={promptsLoading}
        saving={promptsSaving}
        onSave={handleSavePrompts}
      />
    </Layout>
  );
}

function StatusPill({
  status,
  text,
  icon,
  onClick,
}: {
  status: 'success' | 'warning' | 'error';
  text: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const color =
    status === 'success' ? 'success' : status === 'warning' ? 'gold' : status === 'error' ? 'red' : 'default';
  const statusIcon =
    status === 'success' ? <CheckCircleOutlined /> : status === 'warning' ? <ExclamationCircleOutlined /> : icon;
  return (
    <Tag
      color={color}
      style={{ cursor: onClick ? 'pointer' : 'default', padding: '8px 12px', display: 'inline-flex', gap: 6 }}
      onClick={onClick}
    >
      {statusIcon}
      <span>{text}</span>
    </Tag>
  );
}
