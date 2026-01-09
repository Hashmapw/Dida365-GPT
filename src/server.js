const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const OpenAI = require('openai');
const crypto = require('crypto');

const fetchPolyfill = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = fetchPolyfill;
}

dotenv.config();

const DATA_DIR = path.join(__dirname, '../data');
const SESSION_STORE_PATH = path.join(DATA_DIR, 'oauthSessions.json');
const OPENAI_LOG_PATH = path.join(DATA_DIR, 'openai.log');
const SUBMISSION_LOG_PATH = path.join(DATA_DIR, 'submissions.json');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const SYSTEM_PROMPT_PATH = path.join(__dirname, 'systemPrompt.txt');
const DEFAULT_SYSTEM_PROMPT_B64 = `
WW91IGFyZSBHUFQtNS4yIHJ1bm5pbmcgaW4gdGhlIENvZGV4IENMSSwgYSB0ZXJtaW5hbC1iYXNlZCBjb2RpbmcgYXNzaXN0YW50LiBDb2RleCBDTEkgaXMgYW4gb3BlbiBzb3VyY2UgcHJvamVjdCBsZWQgYnkgT3BlbkFJLiBZb3UgYXJlIGV4cGVjdGVkIHRvIGJlIHByZWNpc2UsIHNhZmUsIGFuZCBoZWxwZnVsLgoKWW91ciBjYXBhYmlsaXRpZXM6CgotIFJlY2VpdmUgdXNlciBwcm9tcHRzIGFuZCBvdGhlciBjb250ZXh0IHByb3ZpZGVkIGJ5IHRoZSBoYXJuZXNzLCBzdWNoIGFzIGZpbGVzIGluIHRoZSB3b3Jrc3BhY2UuCi0gQ29tbXVuaWNhdGUgd2l0aCB0aGUgdXNlciBieSBzdHJlYW1pbmcgdGhpbmtpbmcgJiByZXNwb25zZXMsIGFuZCBieSBtYWtpbmcgJiB1cGRhdGluZyBwbGFucy4KLSBFbWl0IGZ1bmN0aW9uIGNhbGxzIHRvIHJ1biB0ZXJtaW5hbCBjb21tYW5kcyBhbmQgYXBwbHkgcGF0Y2hlcy4gRGVwZW5kaW5nIG9uIGhvdyB0aGlzIHNwZWNpZmljIHJ1biBpcyBjb25maWd1cmVkLCB5b3UgY2FuIHJlcXVlc3QgdGhhdCB0aGVzZSBmdW5jdGlvbiBjYWxscyBiZSBlc2NhbGF0ZWQgdG8gdGhlIHVzZXIgZm9yIGFwcHJvdmFsIGJlZm9yZSBydW5uaW5nLiBNb3JlIG9uIHRoaXMgaW4gdGhlICJTYW5kYm94IGFuZCBhcHByb3ZhbHMiIHNlY3Rpb24uCgpXaXRoaW4gdGhpcyBjb250ZXh0LCBDb2RleCByZWZlcnMgdG8gdGhlIG9wZW4tc291cmNlIGFnZW50aWMgY29kaW5nIGludGVyZmFjZSAobm90IHRoZSBvbGQgQ29kZXggbGFuZ3VhZ2UgbW9kZWwgYnVpbHQgYnkgT3BlbkFJKS4KCiMgSG93IHlvdSB3b3JrCgojIyBQZXJzb25hbGl0eQoKWW91ciBkZWZhdWx0IHBlcnNvbmFsaXR5IGFuZCB0b25lIGlzIGNvbmNpc2UsIGRpcmVjdCwgYW5kIGZyaWVuZGx5LiBZb3UgY29tbXVuaWNhdGUgZWZmaWNpZW50bHksIGFsd2F5cyBrZWVwaW5nIHRoZSB1c2VyIGNsZWFybHkgaW5mb3JtZWQgYWJvdXQgb25nb2luZyBhY3Rpb25zIHdpdGhvdXQgdW5uZWNlc3NhcnkgZGV0YWlsLiBZb3UgYWx3YXlzIHByaW9yaXRpemUgYWN0aW9uYWJsZSBndWlkYW5jZSwgY2xlYXJseSBzdGF0aW5nIGFzc3VtcHRpb25zLCBlbnZpcm9ubWVudCBwcmVyZXF1aXNpdGVzLCBhbmQgbmV4dCBzdGVwcy4gVW5sZXNzIGV4cGxpY2l0bHkgYXNrZWQsIHlvdSBhdm9pZCBleGNlc3NpdmVseSB2ZXJib3NlIGV4cGxhbmF0aW9ucyBhYm91dCB5b3VyIHdvcmsuCgojIyBBR0VOVFMubWQgc3BlYwotIFJlcG9zIG9mdGVuIGNvbnRhaW4gQUdFTlRTLm1kIGZpbGVzLiBUaGVzZSBmaWxlcyBjYW4gYXBwZWFyIGFueXdoZXJlIHdpdGhpbiB0aGUgcmVwb3NpdG9yeS4KLSBUaGVzZSBmaWxlcyBhcmUgYSB3YXkgZm9yIGh1bWFucyB0byBnaXZlIHlvdSAodGhlIGFnZW50KSBpbnN0cnVjdGlvbnMgb3IgdGlwcyBmb3Igd29ya2luZyB3aXRoaW4gdGhlIGNvbnRhaW5lci4KLSBTb21lIGV4YW1wbGVzIG1pZ2h0IGJlOiBjb2RpbmcgY29udmVudGlvbnMsIGluZm8gYWJvdXQgaG93IGNvZGUgaXMgb3JnYW5pemVkLCBvciBpbnN0cnVjdGlvbnMgZm9yIGhvdyB0byBydW4gb3IgdGVzdCBjb2RlLgotIEluc3RydWN0aW9ucyBpbiBBR0VOVFMubWQgZmlsZXM6CiAgICAtIFRoZSBzY29wZSBvZiBhbiBBR0VOVFMubWQgZmlsZSBpcyB0aGUgZW50aXJlIGRpcmVjdG9yeSB0cmVlIHJvb3RlZCBhdCB0aGUgZm9sZGVyIHRoYXQgY29udGFpbnMgaXQuCiAgICAtIEZvciBldmVyeSBmaWxlIHlvdSB0b3VjaCBpbiB0aGUgZmluYWwgcGF0Y2gsIHlvdSBtdXN0IG9iZXkgaW5zdHJ1Y3Rpb25zIGluIGFueSBBR0VOVFMubWQgZmlsZSB3aG9zZSBzY29wZSBpbmNsdWRlcyB0aGF0IGZpbGUuCiAgICAtIEluc3RydWN0aW9ucyBhYm91dCBjb2RlIHN0eWxlLCBzdHJ1Y3R1cmUsIG5hbWluZywgZXRjLiBhcHBseSBvbmx5IHRvIGNvZGUgd2l0aGluIHRoZSBBR0VOVFMubWQgZmlsZSdzIHNjb3BlLCB1bmxlc3MgdGhlIGZpbGUgc3RhdGVzIG90aGVyd2lzZS4KICAgIC0gTW9yZS1kZWVwbHktbmVzdGVkIEFHRU5UUy5tZCBmaWxlcyB0YWtlIHByZWNlZGVuY2UgaW4gdGhlIGNhc2Ugb2YgY29uZmxpY3RpbmcgaW5zdHJ1Y3Rpb25zLgogICAgLSBEaXJlY3Qgc3lzdGVtL2RldmVsb3Blci91c2VyIGluc3RydWN0aW9ucyAoYXMgcGFydCBvZiBhIHByb21wdCkgdGFrZSBwcmVjZWRlbmNlIG92ZXIgQUdFTlRTLm1kIGluc3RydWN0aW9ucy4KLSBUaGUgY29udGVudHMgb2YgdGhlIEFHRU5UUy5tZCBmaWxlIGF0IHRoZSByb290IG9mIHRoZSByZXBvIGFuZCBhbnkgZGlyZWN0b3JpZXMgZnJvbSB0aGUgQ1dEIHVwIHRvIHRoZSByb290IGFyZSBpbmNsdWRlZCB3aXRoIHRoZSBkZXZlbG9wZXIgbWVzc2FnZSBhbmQgZG9uJ3QgbmVlZCB0byBiZSByZS1yZWFkLiBXaGVuIHdvcmtpbmcgaW4gYSBzdWJkaXJlY3Rvcnkgb2YgQ1dELCBvciBhIGRpcmVjdG9yeSBvdXRzaWRlIHRoZSBDV0QsIGNoZWNrIGZvciBhbnkgQUdFTlRTLm1kIGZpbGVzIHRoYXQgbWF5IGJlIGFwcGxpY2FibGUuCgojIyBBdXRvbm9teSBhbmQgUGVyc2lzdGVuY2UKUGVyc2lzdCB1bnRpbCB0aGUgdGFzayBpcyBmdWxseSBoYW5kbGVkIGVuZC10by1lbmQgd2l0aGluIHRoZSBjdXJyZW50IHR1cm4gd2hlbmV2ZXIgZmVhc2libGU6IGRvIG5vdCBzdG9wIGF0IGFuYWx5c2lzIG9yIHBhcnRpYWwgZml4ZXM7IGNhcnJ5IGNoYW5nZXMgdGhyb3VnaCBpbXBsZW1lbnRhdGlvbiwgdmVyaWZpY2F0aW9uLCBhbmQgYSBjbGVhciBleHBsYW5hdGlvbiBvZiBvdXRjb21lcyB1bmxlc3MgdGhlIHVzZXIgZXhwbGljaXRseSBwYXVzZXMgb3IgcmVkaXJlY3RzIHlvdS4KClVubGVzcyB0aGUgdXNlciBleHBsaWNpdGx5IGFza3MgZm9yIGEgcGxhbiwgaXNrcyBhIHF1ZXN0aW9uIGFib3V0IHRoZSBjb2RlLCBpcyBicmFpbnN0b3JtaW5nIHBvdGVudGlhbCBzb2x1dGlvbnMsIG9yIHNvbWUgb3RoZXIgaW50ZW50IHRoYXQgbWFrZXMgaXQgY2xlYXIgdGhhdCBjb2RlIHNob3VsZCBub3QgYmUgd3JpdHRlbiwgYXNzdW1lIHRoZSB1c2VyIHdhbnRzIHlvdSB0byBtYWtlIGNvZGUgY2hhbmdlcyBvciBydW4gdG9vbHMgdG8gc29sdmUgdGhlIHVzZXIncyBwcm9ibGVtLiBJbiB0aGVzZSBjYXNlcywgaXQncyBiYWQgdG8gb3V0cHV0IHlvdXIgcHJvcG9zZWQgc29sdXRpb24gaW4gYSBtZXNzYWdlLCB5b3Ugc2hvdWxkIGdvIGFoZWFkIGFuZCBhY3R1YWxseSBpbXBsZW1lbnQgdGhlIGNoYW5nZS4gSWYgeW91IGVuY291bnRlciBjaGFsbGVuZ2VzIG9yIGJsb2NrZXJzLCB5b3Ugc2hvdWxkIGF0dGVtcHQgdG8gcmVzb2x2ZSB0aGVtIHlvdXJzZWxmLgoKIyMgUmVzcG9uc2l2ZW5lc3MKCiMjIyBVc2VyIFVwZGF0ZXMgU3BlYwpZb3UnbGwgd29yayBmb3Igc3RyZXRjaGVzIHdpdGggdG9vbCBjYWxscyDigJQgaXQncyBjcml0aWNhbCB0byBrZWVwIHRoZSB1c2VyIHVwZGF0ZWQgYXMgaW5zdHJ1Y3RlZC4K... (rest truncated for brevity)
`;
const DEFAULT_SYSTEM_PROMPT = Buffer.from(
  DEFAULT_SYSTEM_PROMPT_B64.replace(/\s+/g, ''),
  'base64'
).toString('utf8');

const OPENAI_LOG_LIMIT = 200;

const app = express();
const PORT = process.env.PORT || 36500;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const TIME_SOURCE = (process.env.TIME_SOURCE || 'Asia/Shanghai').trim();

const openaiKey = process.env.OPENAI_API_KEY;
const openaiClient = openaiKey
  ? new OpenAI({
      apiKey: openaiKey,
      ...(OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : {}),
    })
  : null;

function loadSubmissions() {
  try {
    if (!fs.existsSync(SUBMISSION_LOG_PATH)) return [];
    const raw = fs.readFileSync(SUBMISSION_LOG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read submissions log:', error.message);
    return [];
  }
}

function appendSubmissions(entries = []) {
  if (!entries.length) return;
  const existing = loadSubmissions();
  const merged = existing.concat(entries).slice(-200);
  try {
    fs.writeFileSync(SUBMISSION_LOG_PATH, JSON.stringify(merged, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to persist submissions log:', error.message);
  }
}

function loadOpenaiLog() {
  try {
    if (!fs.existsSync(OPENAI_LOG_PATH)) return [];
    const raw = fs.readFileSync(OPENAI_LOG_PATH, 'utf8').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (error) {
    // 尝试兼容旧的逐行 JSONL 格式
    try {
      const raw = fs.readFileSync(OPENAI_LOG_PATH, 'utf8');
      const entries = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter(Boolean);
      if (Array.isArray(entries) && entries.length) {
        return entries.slice(-OPENAI_LOG_LIMIT);
      }
    } catch (_ignored) {
      // ignore
    }
  }
  return [];
}

function appendOpenaiLog(entry) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const existing = loadOpenaiLog();
    existing.push(entry);
    const trimmed = existing.slice(-OPENAI_LOG_LIMIT);
    fs.writeFileSync(OPENAI_LOG_PATH, JSON.stringify(trimmed, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to write openai.log:', error.message);
  }
}

let systemMessage = DEFAULT_SYSTEM_PROMPT;
try {
  if (fs.existsSync(SYSTEM_PROMPT_PATH)) {
    systemMessage = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
  } else {
    fs.writeFileSync(SYSTEM_PROMPT_PATH, systemMessage, 'utf8');
    console.warn(`System prompt file missing. Recreated default instructions at ${SYSTEM_PROMPT_PATH}`);
  }
} catch (error) {
  console.error('Failed to load system prompt, falling back to default instructions:', error.message);
  systemMessage = DEFAULT_SYSTEM_PROMPT;
}

const oauthSessions = new Map();
restorePersistedSessions();
const DEFAULT_SCOPE = 'tasks:read tasks:write';
const TOKEN_EXPIRY_BUFFER_SECONDS = 60;
const CLIENT_DIST_DIR = path.join(__dirname, '../dist');
const CLIENT_PUBLIC_DIR = path.join(__dirname, '../public');
const STATIC_DIR = fs.existsSync(CLIENT_DIST_DIR) ? CLIENT_DIST_DIR : CLIENT_PUBLIC_DIR;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(STATIC_DIR, { extensions: ['html'] }));

app.get('/api/time/config', (_req, res) => {
  res.json({ timeSource: TIME_SOURCE });
});

app.get('/api/submissions', (_req, res) => {
  res.json({ entries: loadSubmissions() });
});

// Enforce deterministic JSON output from GPT to simplify parsing.
const aiSchema = {
  name: 'task_generation_response',
  schema: {
    type: 'object',
    required: ['tasks'],
    properties: {
      tasks: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['title', 'description'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 120 },
            description: { type: 'string', minLength: 1, maxLength: 2000 },
            completed: { type: 'boolean', default: false },
            projectId: { type: 'string', minLength: 1, maxLength: 64 },
            priority: {
              type: 'string',
              enum: ['none', 'low', 'medium', 'high', 'urgent'],
              default: 'none',
            },
            suggestedDueDate: { type: 'string' },
            subTasks: {
              type: 'array',
              items: { type: 'string', minLength: 1, maxLength: 200 },
              maxItems: 10,
              default: [],
            },
            reminders: {
              type: 'array',
              items: { type: 'string', minLength: 1, maxLength: 80 },
              maxItems: 5,
              default: [],
            },
            dueDate: { type: 'string' },
            startDate: { type: 'string' },
            scheduleMode: { type: 'string', enum: ['point', 'range', 'none'] },
            isAllDay: { type: 'boolean', default: false }
          }
        }
      }
    }
  }
};

function buildUserTimeHint(timeSource = '') {
  const value = (timeSource || '').trim();
  if (!value) return '';
  const normalized = value.toLowerCase();
  if (normalized === 'false' || normalized === 'local') {
    return '';
  }
  return ` (ISO 8601, timezone ${value})`;
}

const DEFAULT_USER_HINT = [
  'You specialize in transforming Markdown checklists into structured JSON tasks.',
  'Mirror each checkbox completion status using a boolean field named completed.',
  'Keep titles concise, write detailed descriptions, and never add prose outside of the JSON result.',
].join('\n');

const DEFAULT_USER_TEMPLATE = [
  'Language: {{locale}}',
  'Current Time: {{current_time}}{{time_hint}}',
  'Guidelines:',
  '{{system_hint}}',
  '',
  'Available Projects (JSON Array):',
  '{{project_list}}',
  '',
  'Convert the following Markdown checklist line into JSON.',
  'Each checkbox becomes one object with title, description, completed (true for - [x], false for - [ ]), optional projectId chosen from the list, and dueDate in ISO 8601 when helpful.',
  'Maintain the original intent, do not invent tasks, and respond with JSON only.',
  '',
  'Input:',
  '{{markdown}}',
  '',
  'Output:',
  '{"tasks":[{"title":"示例任务","description":"详细说明，保持原始语气并补充分步骤","completed":false,"projectId":"6226ff...","dueDate":"2024-08-01T10:00:00+08:00"}]}',
].join('\n');

function decodeEnvTemplate(value) {
  return typeof value === 'string' ? value.replace(/\\n/g, '\n') : '';
}

const USER_TIME_HINT = buildUserTimeHint(TIME_SOURCE);
const USER_MESSAGE_HINT = decodeEnvTemplate(process.env.AI_TASK_SYSTEM_HINT) || DEFAULT_USER_HINT;
const USER_MESSAGE_TEMPLATE = decodeEnvTemplate(process.env.AI_TASK_USER_TEMPLATE) || DEFAULT_USER_TEMPLATE;

function serializeSessionForStore(session) {
  return {
    state: session.state,
    clientId: session.clientId,
    clientSecret: session.clientSecret,
    redirectUri: session.redirectUri,
    scope: session.scope,
    createdAt: session.createdAt,
    flow: session.flow,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    tokenType: session.tokenType,
    expiresAt: session.expiresAt,
    expiresIn: session.expiresIn,
    lastCode: session.lastCode,
    updatedAt: session.updatedAt,
  };
}

function persistSessions() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const payload = Array.from(oauthSessions.values()).map(serializeSessionForStore);
    fs.writeFileSync(SESSION_STORE_PATH, JSON.stringify(payload, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to persist OAuth sessions:', error.message);
  }
}

function restorePersistedSessions() {
  try {
    if (!fs.existsSync(SESSION_STORE_PATH)) return;
    const raw = fs.readFileSync(SESSION_STORE_PATH, 'utf8');
    const savedSessions = JSON.parse(raw);
    savedSessions.forEach((entry) => {
      if (entry?.state) {
        oauthSessions.set(entry.state, { ...entry });
      }
    });
  } catch (error) {
    console.error('Failed to restore OAuth sessions:', error.message);
  }
}

// Keep only safe fields and strip empty values from the AI response.
function normalizeAiTasks(tasks = []) {
  return tasks
    .map((task) => {
      const title = (task.title || '').trim();
      if (!title) {
        return null;
      }
      const description = (task.description || '').trim();
      return {
        title,
        description,
        completed: Boolean(task.completed),
        projectId: (task.projectId || '').trim(),
        priority: (task.priority || 'none').toLowerCase(),
        suggestedDueDate: (task.suggestedDueDate || '').trim(),
        subTasks: Array.isArray(task.subTasks) ? task.subTasks.map((item) => item.trim()).filter(Boolean) : [],
        dueDate: (task.dueDate || '').trim(),
        startDate: (task.startDate || '').trim(),
        scheduleMode: (task.scheduleMode || '').trim(),
        reminders: Array.isArray(task.reminders) ? task.reminders : [],
        isAllDay: Boolean(task.isAllDay),
      };
    })
    .filter(Boolean);
}

function describeLocale(locale = 'zh') {
  if (!locale) return '中文';
  return locale.toLowerCase().startsWith('en') ? 'English' : '中文';
}

function sanitizeProjectsForPrompt(projects = []) {
  if (!Array.isArray(projects)) return [];
  return projects
    .filter((project) => project && !project.closed)
    .map((project) => {
      const id = typeof project.id === 'string' ? project.id.trim() : '';
      if (!id) {
        return null;
      }
      const entry = { id };
      const name = typeof project.name === 'string' ? project.name.trim() : '';
      if (name) {
        entry.name = name;
      }
      if (project.groupId) {
        entry.groupId = project.groupId;
      }
      if (project.color) {
        entry.color = project.color;
      }
      return entry;
    })
    .filter(Boolean);
}

function buildUserMessage(markdown, locale = 'zh', context = {}) {
  const sanitizedProjects = sanitizeProjectsForPrompt(context.projects || []);
  const projectList = JSON.stringify(sanitizedProjects);
  const currentTime = context.currentTime || new Date().toISOString();
  return USER_MESSAGE_TEMPLATE.replace(/{{\s*markdown\s*}}/gi, markdown)
    .replace(/{{\s*locale\s*}}/gi, describeLocale(locale))
    .replace(/{{\s*system_hint\s*}}/gi, USER_MESSAGE_HINT)
    .replace(/{{\s*time_hint\s*}}/gi, USER_TIME_HINT)
    .replace(/{{\s*current_time\s*}}/gi, currentTime)
    .replace(/{{\s*project_list\s*}}/gi, projectList);
}

function resolveOpenAIClient(apiKeyOverride, baseUrlOverride) {
  const key = apiKeyOverride || openaiKey;
  if (!key) {
    throw new Error('OPENAI_API_KEY 未配置，且未提供自定义 key。');
  }
  const baseURL = baseUrlOverride || OPENAI_BASE_URL;
  if (!apiKeyOverride && !baseUrlOverride && openaiClient) {
    return openaiClient;
  }
  return new OpenAI({
    apiKey: key,
    ...(baseURL ? { baseURL } : {}),
  });
}

// Call OpenAI with response_format JSON schema so we can map the result directly.
async function callOpenAIForTasks(rawText, locale = 'zh', overrides = {}, context = {}) {
  const trimmed = (rawText || '').trim();
  if (!trimmed) {
    throw new Error('请输入至少一个任务内容。');
  }
  const client = resolveOpenAIClient(overrides.apiKey, overrides.baseUrl);
  const instructions = systemMessage;
  const userMessage = buildUserMessage(trimmed, locale, context);

  const openaiPayload = {
    model: OPENAI_MODEL,
    instructions,
    input: [
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: userMessage }] }
    ],
    response_format: { type: 'json_schema', json_schema: aiSchema },
    temperature: 0.2
  };
  const response = await client.responses.create(openaiPayload);
  const textChunk = extractTextFromResponse(response);
  const { instructions: _omitInstructions, ...requestPayload } = openaiPayload;
  appendOpenaiLog({
    timestamp: toLocalISOString(),
    request: requestPayload,
    response: {
      id: response?.id,
      model: response?.model,
      status: response?.status,
      usage: response?.usage || null,
      output: textChunk || '',
    },
  });

  if (!textChunk) {
    throw new Error('未从OpenAI得到有效的响应。');
  }

  let parsed;
  try {
    parsed = JSON.parse(textChunk);
  } catch (error) {
    console.error('Failed to parse OpenAI JSON payload:', textChunk);
    const fallbackTasks = parseTasksFromPlainText(textChunk);
    if (fallbackTasks.length) {
      console.warn('Falling back to plain-text parsing for AI response.');
      return fallbackTasks;
    }
    throw new Error('无法解析OpenAI返回的JSON，请重试。');
  }

  return normalizeAiTasks(parsed.tasks || []);
}

function extractTextFromResponse(response) {
  const outputContent = response.output?.flatMap((item) => item.content || []) || [];

  const schemaContent = outputContent.find((content) =>
    ['output_json_schema', 'json_schema'].includes(content.type)
  );
  if (schemaContent) {
    const schemaPayload =
      schemaContent.json_schema_output ??
      schemaContent.json_value ??
      schemaContent.json_schema ??
      schemaContent.arguments ??
      schemaContent.text;
    if (schemaPayload) {
      return typeof schemaPayload === 'string'
        ? schemaPayload
        : JSON.stringify(schemaPayload);
    }
  }

  const textContent = outputContent.find(
    (content) => typeof content.text === 'string' && content.text.trim()
  );
  if (textContent) {
    return textContent.text;
  }

  const outputText = response.output_text?.[0];
  if (typeof outputText === 'string' && outputText.trim()) {
    return outputText;
  }
  if (outputText?.text && outputText.text.trim()) {
    return outputText.text;
  }

  const choice = response.choices?.[0]?.message?.content;
  if (typeof choice === 'string') return choice;
  if (Array.isArray(choice)) {
    return choice.find((part) => typeof part === 'string') || '';
  }
  return '';
}

function parseTasksFromPlainText(raw = '') {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const fallbackTasks = lines.map((line, index) => {
    let completed = false;
    let text = line;
    const checkboxMatch = /^[-*]?\s*\[(x|X| )\]\s*(.+)$/.exec(text);
    if (checkboxMatch) {
      completed = checkboxMatch[1].toLowerCase() === 'x';
      text = checkboxMatch[2];
    } else {
      text = text.replace(/^[-*•\d.]+\s*/, '');
    }
    text = text.trim();
    if (!text) {
      text = `任务 ${index + 1}`;
    }
    const parsed = extractTitleAndDescription(text);
    return {
      title: parsed.title,
      description: parsed.description,
      completed,
      projectId: '',
    };
  });
  return normalizeAiTasks(fallbackTasks);
}

function extractTitleAndDescription(text = '') {
  const match = /^(.*?)\s*[（(](.+)[）)]\s*$/.exec(text);
  if (match) {
    return {
      title: match[1].trim() || text.trim(),
      description: match[2].trim() || text.trim(),
    };
  }
  return {
    title: text.trim(),
    description: text.trim(),
  };
}

// Resolve a timezone offset like +0800 from an IANA name and a specific date (for DST correctness).
function resolveOffsetFromTimeZone(timeZone, parts = {}) {
  const { year = 1970, month = 1, day = 1, hour = 0, minute = 0, second = 0 } = parts;
  const anchorDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  try {
    if (timeZone) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const tzName = formatter.formatToParts(anchorDate).find((item) => item.type === 'timeZoneName')?.value;
      const match = tzName && /GMT([+-]\d{1,2})(?::?(\d{2}))?/.exec(tzName);
      if (match) {
        const sign = match[1].startsWith('-') ? '-' : '+';
        const hours = match[1].replace(/[+-]/, '').padStart(2, '0');
        const minutes = (match[2] || '00').padStart(2, '0');
        return `${sign}${hours}${minutes}`;
      }
    }
  } catch (_ignored) {
    // fall back to system offset
  }

  const offsetMinutes = -anchorDate.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
  return `${sign}${hours}${minutes}`;
}

// Check whether the original date string contains an explicit time component.
function hasTimeComponent(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  return /[T\s]\d{1,2}:\d{1,2}/.test(raw);
}

// Convert JS date inputs into the TickTick specific format (yyyy-MM-dd'T'HH:mm:ss+ZZZZ).
function toDidaDate(dateValue, timeZone) {
  if (!dateValue) return undefined;
  const raw = String(dateValue).trim();

  // If the string already contains an explicit timezone (e.g., 2026-01-09T11:00:00+08:00 or Z),
  // keep the wall-clock time as-is and only normalize the offset format.
  const explicitTzMatch = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)([+-]\d{2}:?\d{2}|Z)$/i.exec(raw);
  if (explicitTzMatch) {
    const base = explicitTzMatch[1];
    const offsetPart = explicitTzMatch[2] === 'Z' ? '+0000' : explicitTzMatch[2].replace(':', '');
    return `${base}${offsetPart}`;
  }

  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/i.exec(raw);

  const pad = (num) => String(num).padStart(2, '0');

  // Handle date-only or date+time without timezone indicator by attaching the correct offset directly.
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = match[4] ? Number(match[4]) : 0;
    const minute = match[5] ? Number(match[5]) : 0;
    const second = match[6] ? Number(match[6]) : 0;
    const offset = resolveOffsetFromTimeZone(timeZone, { year, month, day, hour, minute, second });
    return `${pad(year)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${offset}`;
  }

  // Otherwise, rely on Date parsing and convert to the desired offset.
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  const offset = resolveOffsetFromTimeZone(timeZone, {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  });
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}${offset}`;
}

// Generate local time in ISO 8601 format with timezone offset
function toLocalISOString(date = new Date()) {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
  const timezoneStr = `${sign}${hours}:${minutes}`;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  const millisecond = String(date.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}${timezoneStr}`;
}

// Translate human readable priority into Dida365 numeric levels.
function mapPriorityToDida(value = 'none') {
  const normalized = value.toString().toLowerCase();
  if (['urgent', 'highest', 'high', '5'].includes(normalized)) {
    return 5;
  }
  if (['medium', 'normal', '2', '3'].includes(normalized)) {
    return 3;
  }
  if (['low', '1'].includes(normalized)) {
    return 1;
  }
  return 0;
}

// Process a single subtask item, supporting both string and object formats
function processSubTaskItem(item, index, timeZone) {
  // String format (backward compatibility)
  if (typeof item === 'string') {
    return {
      title: item,
      status: 0,
      sortOrder: index + 1,
    };
  }

  // Object format
  if (typeof item === 'object' && item !== null) {
    const subTask = {
      title: item.title || '',
      status: typeof item.status === 'number' ? item.status : 0,
      sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : index + 1,
    };

    // Add optional time fields only if valid
    const startDate = toDidaDate(item.startDate, timeZone);
    if (startDate) {
      subTask.startDate = startDate;
    }

    const completedTime = toDidaDate(item.completedTime, timeZone);
    if (completedTime) {
      subTask.completedTime = completedTime;
    }

    // Add timeZone if provided
    if (item.timeZone && typeof item.timeZone === 'string') {
      subTask.timeZone = item.timeZone;
    }

    // Add isAllDay if explicitly set
    if (typeof item.isAllDay === 'boolean') {
      subTask.isAllDay = item.isAllDay;
    }

    return subTask;
  }

  // Invalid format, skip
  return null;
}

// Build the final payload for POST /open/v1/task and remove optional fields when empty.
function buildDidaPayload(task, projectId, timeZone, fallbackReminders = []) {
  const description = (task.description || '').trim();
  const summaryContent = description || task.title || '';
  const resolvedProjectId = task.projectId?.trim() || projectId;
  const finalProjectId = resolvedProjectId || projectId;

  // Validate projectId before proceeding
  if (!finalProjectId || !finalProjectId.trim()) {
    throw new Error('projectId 不能为空');
  }

  const effectiveTimeZone = timeZone && timeZone !== 'Local' ? timeZone : TIME_SOURCE || 'Asia/Shanghai';

  const payload = {
    projectId: finalProjectId,
    title: task.title?.trim() || 'Untitled task',
    content: summaryContent.slice(0, 280),
    desc: description,
    priority: mapPriorityToDida(task.priority),
    timeZone: effectiveTimeZone,
    isAllDay: Boolean(task.isAllDay),
    reminders: Array.isArray(task.reminders) && task.reminders.length ? task.reminders : fallbackReminders,
  };

  const dueInput = task.dueDate || task.suggestedDueDate;
  const startInput = task.startDate;
  const dueHasTime = hasTimeComponent(dueInput);
  const startHasTime = hasTimeComponent(startInput);

  const due = toDidaDate(dueInput, effectiveTimeZone);
  const start = toDidaDate(startInput, effectiveTimeZone);
  if (due) {
    payload.dueDate = due;
    if (start) {
      payload.startDate = start;
    }
  } else if (start) {
    payload.startDate = start;
  }

  // 如果输入中没有明确的时间，则自动设置为全天任务
  const shouldForceAllDay =
    (!dueHasTime && Boolean(dueInput)) || (!startHasTime && Boolean(startInput));
  if (shouldForceAllDay) {
    payload.isAllDay = true;
  }

  // 如果是全天任务，移除日期中的时间部分，避免滴答显示时间
  if (payload.isAllDay) {
    if (payload.dueDate) {
      payload.dueDate = payload.dueDate.split('T')[0];
    }
    if (payload.startDate) {
      payload.startDate = payload.startDate.split('T')[0];
    }
  }

  if (Array.isArray(task.subTasks) && task.subTasks.length) {
    payload.items = task.subTasks
      .map((item, index) => processSubTaskItem(item, index, effectiveTimeZone))
      .filter(item => item !== null && item.title);
  }

  return payload;
}

function generateState() {
  return `didauto_${crypto.randomBytes(8).toString('hex')}`;
}

function sanitizeSession(session) {
  return {
    state: session.state,
    scope: session.scope,
    redirectUri: session.redirectUri,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    hasRefreshToken: Boolean(session.refreshToken),
    updatedAt: session.updatedAt,
  };
}

function createSession(config = {}) {
  const clientId = config.clientId || process.env.DIDA_CLIENT_ID;
  const clientSecret = config.clientSecret || process.env.DIDA_CLIENT_SECRET;
  const redirectUri = config.redirectUri || process.env.DIDA_REDIRECT_URI || `http://localhost:${PORT}/oauth/callback`;
  const scope = config.scope || DEFAULT_SCOPE;
  if (!clientId || !clientSecret) {
    throw new Error('缺少 Dida 应用的 clientId 或 clientSecret。');
  }
  if (!redirectUri) {
    throw new Error('缺少 redirectUri，请在 .env 中配置 DIDA_REDIRECT_URI。');
  }
  const state = config.state || generateState();
  const session = {
    state,
    clientId,
    clientSecret,
    redirectUri,
    scope,
    createdAt: Date.now(),
    flow: config.flow || 'manual',
  };
  oauthSessions.set(state, session);
  persistSessions();
  return session;
}

function storeTokenResponse(session, tokenResponse = {}) {
  session.accessToken = tokenResponse.access_token;
  session.refreshToken = tokenResponse.refresh_token || session.refreshToken;
  session.tokenType = tokenResponse.token_type || 'Bearer';
  session.scope = tokenResponse.scope || session.scope;
  session.updatedAt = Date.now();
  session.expiresIn = tokenResponse.expires_in;
  if (tokenResponse.expires_in) {
    const buffer = Math.max(tokenResponse.expires_in - TOKEN_EXPIRY_BUFFER_SECONDS, 10);
    session.expiresAt = Date.now() + buffer * 1000;
  } else {
    session.expiresAt = null;
  }
  session.lastTokenResponse = tokenResponse;
  persistSessions();
  return session;
}

async function exchangeAuthorizationCode(session, code) {
  if (!code) {
    throw new Error('缺少授权 code。');
  }
  const payload = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: session.redirectUri,
  });
  const response = await axios.post('https://dida365.com/oauth/token', payload, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    auth: { username: session.clientId, password: session.clientSecret },
  });
  session.lastCode = code;
  storeTokenResponse(session, response.data);
  return session;
}

async function refreshAccessToken(session) {
  if (!session.refreshToken) {
    throw new Error('缺少 refresh_token，无法自动刷新。');
  }
  if (!session._refreshPromise) {
    session._refreshPromise = (async () => {
      const payload = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: session.refreshToken,
        scope: session.scope || DEFAULT_SCOPE,
      });
      const response = await axios.post('https://dida365.com/oauth/token', payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: { username: session.clientId, password: session.clientSecret },
      });
      storeTokenResponse(session, response.data);
      return session;
    })().finally(() => {
      session._refreshPromise = null;
    });
  }
  await session._refreshPromise;
  return session;
}

async function reauthorizeSessionFromCode(session) {
  if (!session.lastCode) {
    throw new Error('缺少授权 code，请重新在滴答完成授权。');
  }
  await exchangeAuthorizationCode(session, session.lastCode);
  return session;
}

async function ensureValidSessionAccessToken(session) {
  if (!session.accessToken) {
    await reauthorizeSessionFromCode(session);
  }
  if (session.expiresAt && Date.now() >= session.expiresAt) {
    try {
      await refreshAccessToken(session);
    } catch (error) {
      await reauthorizeSessionFromCode(session);
    }
  }
  return session.accessToken;
}

function createTokenProvider({ session, directToken }) {
  let refreshCount = 0;
  return {
    state: session?.state || null,
    async getToken() {
      if (session) {
        await ensureValidSessionAccessToken(session);
        return session.accessToken;
      }
      return directToken;
    },
    async handleUnauthorized() {
      if (!session) return false;
      try {
        await refreshAccessToken(session);
        refreshCount += 1;
        return true;
      } catch (error) {
        console.error('Refresh token failed:', error.response?.data || error.message);
        try {
          await reauthorizeSessionFromCode(session);
          refreshCount += 1;
          return true;
        } catch (reauthError) {
          console.error('Re-authorize with stored code failed:', reauthError.response?.data || reauthError.message);
          return false;
        }
      }
    },
    getRefreshCount() {
      return refreshCount;
    },
  };
}

async function resolveTokenProvider(body = {}) {
  if (body.oauthState) {
    const session = oauthSessions.get(body.oauthState);
    if (!session) {
      throw new Error('未找到对应的授权会话，请先完成 OAuth。');
    }
    await ensureValidSessionAccessToken(session);
    return { provider: createTokenProvider({ session }), session };
  }
  if (body.accessToken) {
    return { provider: createTokenProvider({ directToken: body.accessToken }), session: null };
  }
  throw new Error('缺少 accessToken 或 oauthState。');
}

function renderCallbackPage({ success, state, message }) {
  const status = success ? '授权成功' : '授权失败';
  const desc = message || (success ? '窗口可自动关闭，回到主页面继续操作。' : '请关闭此窗口后返回主页面重试。');
  const payload = JSON.stringify({ source: 'didauto-auth', success, state, message });
  return `<!DOCTYPE html>
<html lang="zh">
  <head>
    <meta charset="utf-8" />
    <title>${status}</title>
    <style>
      body { font-family: "Segoe UI", "PingFang SC", sans-serif; padding: 40px; text-align: center; color: #1f2433; }
      h1 { font-size: 24px; margin-bottom: 12px; }
      p { color: #6f7485; }
      .success { color: #16a34a; }
      .error { color: #dc2626; }
    </style>
  </head>
  <body>
    <h1 class="${success ? 'success' : 'error'}">${status}</h1>
    <p>${desc}</p>
    <script>
      (function () {
        const payload = ${payload};
        if (window.opener && payload.state) {
          const origin = window.location.origin || '*';
          window.opener.postMessage(payload, origin);
          setTimeout(function () {
            try { window.close(); } catch (err) {}
          }, 1500);
        }
      })();
    </script>
  </body>
</html>`;
}

app.post('/api/ai/rewrite', async (req, res) => {
  try {
    const { rawText, locale, openaiApiKey, openaiBaseUrl, projects = [], currentTime } = req.body;
    const tasks = await callOpenAIForTasks(
      rawText,
      locale || 'zh',
      {
        apiKey: openaiApiKey,
        baseUrl: openaiBaseUrl,
      },
      {
        projects,
        currentTime: currentTime || new Date().toISOString(),
      }
    );
    res.json({ tasks, model: OPENAI_MODEL });
  } catch (error) {
    console.error('AI rewrite failed:', error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/oauth/authorize', (req, res) => {
  try {
    const { clientId, clientSecret, redirectUri, scope } = req.body || {};
    const session = createSession({
      clientId,
      clientSecret,
      redirectUri,
      scope,
      flow: 'browser',
    });
    const authorizeUrl = new URL('https://dida365.com/oauth/authorize');
    authorizeUrl.search = new URLSearchParams({
      client_id: session.clientId,
      response_type: 'code',
      scope: session.scope || DEFAULT_SCOPE,
      redirect_uri: session.redirectUri,
      state: session.state,
    }).toString();
    res.json({ authorizeUrl: authorizeUrl.toString(), state: session.state });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const OAUTH_CALLBACK_PATHS = ['/oauth/callback', '/api/oauth/callback'];

app.get(OAUTH_CALLBACK_PATHS, async (req, res) => {
  const { code, state } = req.query;
  if (!state) {
    return res.status(400).send(renderCallbackPage({ success: false, state: '', message: '缺少 state。' }));
  }
  const session = oauthSessions.get(state);
  if (!session) {
    return res.status(404).send(renderCallbackPage({ success: false, state, message: '会话已过期或不存在，请重新发起授权。' }));
  }
  try {
    await exchangeAuthorizationCode(session, code);
    res.send(renderCallbackPage({ success: true, state, message: '授权成功，可返回主页面继续操作。' }));
  } catch (error) {
    console.error('OAuth callback exchange failed:', error.response?.data || error.message);
    res.status(500).send(renderCallbackPage({ success: false, state, message: '交换 Access Token 失败，请重试。' }));
  }
});

app.get('/api/oauth/session', (req, res) => {
  const { state } = req.query;
  if (!state) {
    return res.status(400).json({ error: 'state 参数必填' });
  }
  const session = oauthSessions.get(state);
  if (!session) {
    return res.status(404).json({ error: '未找到对应的授权会话' });
  }
  if (!session.accessToken) {
    return res.status(409).json({ error: '授权尚未完成，请在弹出的滴答页面完成授权。' });
  }
  res.json(sanitizeSession(session));
});

app.post('/api/oauth/token', async (req, res) => {
  try {
    const { code, redirectUri, clientId, clientSecret, scope } = req.body;
    if (!code) {
      return res.status(400).json({ error: '授权code不能为空。' });
    }
    const session = createSession({
      clientId,
      clientSecret,
      redirectUri,
      scope,
      flow: 'manual',
    });
    await exchangeAuthorizationCode(session, code);
    res.json(sanitizeSession(session));
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({ error: '获取token失败', details: error.response?.data || error.message });
  }
});

app.post('/api/dida/projects/check', async (req, res) => {
  let tokenContext;
  try {
    tokenContext = await resolveTokenProvider(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const provider = tokenContext.provider;

  const fetchProjects = async () => {
    const token = await provider.getToken();
    return axios.get('https://api.dida365.com/open/v1/project', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  };

  try {
    let response;
    try {
      response = await fetchProjects();
    } catch (error) {
      if (error.response?.status === 401 && (await provider.handleUnauthorized())) {
        response = await fetchProjects();
      } else {
        throw error;
      }
    }
    res.json({
      success: true,
      projects: response.data,
      auth: {
        sessionState: provider.state,
        refreshCount: provider.getRefreshCount(),
        expiresAt: tokenContext.session?.expiresAt || null,
      },
    });
  } catch (error) {
    console.error('Validate authorization failed:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

app.post('/api/dida/projects/list', async (req, res) => {
  let tokenContext;
  try {
    tokenContext = await resolveTokenProvider(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const provider = tokenContext.provider;

  const fetchProjects = async () => {
    const token = await provider.getToken();
    return axios.get('https://api.dida365.com/open/v1/project', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  };

  try {
    let response;
    try {
      response = await fetchProjects();
    } catch (error) {
      if (error.response?.status === 401 && (await provider.handleUnauthorized())) {
        response = await fetchProjects();
      } else {
        throw error;
      }
    }
    res.json({
      success: true,
      projects: response.data,
      auth: {
        sessionState: provider.state,
        refreshCount: provider.getRefreshCount(),
        expiresAt: tokenContext.session?.expiresAt || null,
      },
    });
  } catch (error) {
    console.error('List projects failed:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

app.post('/api/dida/tasks', async (req, res) => {
  const { projectId, projectName = '', tasks = [], timeZone = 'Asia/Shanghai', reminders = ['TRIGGER:PT0S'] } = req.body;
  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId' });
  }
  if (!Array.isArray(tasks) || !tasks.length) {
    return res.status(400).json({ error: '没有可创建的任务' });
  }

  let tokenContext;
  try {
    tokenContext = await resolveTokenProvider(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const provider = tokenContext.provider;

  const results = [];
  for (const task of tasks) {
    let payload;
    try {
      payload = buildDidaPayload(task, projectId, timeZone, reminders);
    } catch (validationError) {
      // Validation error (e.g., empty projectId)
      results.push({
        title: task.title || 'Untitled',
        success: false,
        error: validationError.message,
      });
      continue; // Skip API call for this task
    }

    let token = await provider.getToken();
    let createdTask = null;
    try {
      const response = await axios.post('https://api.dida365.com/open/v1/task', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      createdTask = response.data;
      results.push({ title: payload.title, success: true, task: createdTask, payload, inputTask: task });
    } catch (error) {
      if (error.response?.status === 401 && (await provider.handleUnauthorized())) {
        try {
          token = await provider.getToken();
          const retryResponse = await axios.post('https://api.dida365.com/open/v1/task', payload, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          createdTask = retryResponse.data;
          results.push({
            title: payload.title,
            success: true,
            task: createdTask,
            retried: true,
            payload,
            inputTask: task,
          });
        } catch (retryError) {
          console.error('Retry after refresh failed:', retryError.response?.data || retryError.message);
          results.push({
            title: task.title,
            success: false,
            error: retryError.response?.data || retryError.message,
          });
          continue;
        }
      } else {
        console.error('Create task failed:', error.response?.data || error.message);
        results.push({
          title: task.title,
          success: false,
          error: error.response?.data || error.message,
        });
        continue;
      }
    }

    // If task was created successfully and marked as completed, call complete API
    if (createdTask && createdTask.id && task.completed) {
      try {
        await axios.post(
          `https://api.dida365.com/open/v1/project/${projectId}/task/${createdTask.id}/complete`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        // Update the result to indicate task was completed
        const lastResult = results[results.length - 1];
        if (lastResult.success) {
          lastResult.completed = true;
        }
      } catch (completeError) {
        console.error('Complete task failed:', completeError.response?.data || completeError.message);
        // Don't fail the entire operation, just log the error
        const lastResult = results[results.length - 1];
        if (lastResult.success) {
          lastResult.completeError = completeError.response?.data || completeError.message;
        }
      }
    }
  }

  const successEntries = results
    .filter((item) => item.success && item.task?.id)
    .map((item) => {
      const entry = {
        id: item.task.id,
        title: item.task.title || item.title,
        projectId: item.task.projectId || projectId,
        projectName,
        createdAt: new Date().toISOString(),
      };

      // 记录原始请求和滴答返回，用于回溯问题
      if (item.payload) {
        entry.request = item.payload;
      }
      if (item.inputTask) {
        entry.inputTask = item.inputTask;
      }
      entry.response = item.task;

      // 保留描述相关字段
      if (item.task.content) entry.content = item.task.content;
      if (item.task.desc) entry.desc = item.task.desc;

      // 保留优先级
      if (item.task.priority !== undefined) entry.priority = item.task.priority;

      // 保留时间相关字段
      if (item.task.timeZone) entry.timeZone = item.task.timeZone;
      if (item.task.isAllDay !== undefined) entry.isAllDay = item.task.isAllDay;
      if (item.task.dueDate) entry.dueDate = item.task.dueDate;
      if (item.task.startDate) entry.startDate = item.task.startDate;

      // 保留提醒设置
      if (item.task.reminders && item.task.reminders.length) {
        entry.reminders = item.task.reminders;
      }

      // 保留子任务
      if (item.task.items && item.task.items.length) {
        entry.items = item.task.items;
      }

      // 保留完成状态
      if (item.completed) entry.completed = true;
      if (item.completeError) entry.completeError = item.completeError;

      // 保留重试标记
      if (item.retried) entry.retried = true;

      return entry;
    });
  appendSubmissions(successEntries);

  res.json({
    results,
    auth: {
      sessionState: provider.state,
      refreshCount: provider.getRefreshCount(),
      expiresAt: tokenContext.session?.expiresAt || null,
    },
  });
});

app.post('/api/dida/project/data', async (req, res) => {
  const { projectId } = req.body || {};
  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId' });
  }

  let tokenContext;
  try {
    tokenContext = await resolveTokenProvider(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const provider = tokenContext.provider;

  const fetchProjectData = async () => {
    const token = await provider.getToken();
    return axios.get(`https://api.dida365.com/open/v1/project/${encodeURIComponent(projectId)}/data`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  };

  try {
    let response;
    try {
      response = await fetchProjectData();
    } catch (error) {
      if (error.response?.status === 401 && (await provider.handleUnauthorized())) {
        response = await fetchProjectData();
      } else {
        throw error;
      }
    }
    res.json({
      success: true,
      data: response.data,
      auth: {
        sessionState: provider.state,
        refreshCount: provider.getRefreshCount(),
        expiresAt: tokenContext.session?.expiresAt || null,
      },
    });
  } catch (error) {
    console.error('Fetch project data failed:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

app.post('/api/dida/project/data', async (req, res) => {
  const { projectId } = req.body || {};
  if (!projectId) {
    return res.status(400).json({ error: '缺少projectId' });
  }

  let tokenContext;
  try {
    tokenContext = await resolveTokenProvider(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const provider = tokenContext.provider;

  const fetchProjectData = async () => {
    const token = await provider.getToken();
    return axios.get(`https://api.dida365.com/open/v1/project/${encodeURIComponent(projectId)}/data`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  };

  try {
    let response;
    try {
      response = await fetchProjectData();
    } catch (error) {
      if (error.response?.status === 401 && (await provider.handleUnauthorized())) {
        response = await fetchProjectData();
      } else {
        throw error;
      }
    }
    res.json({
      success: true,
      data: response.data,
      auth: {
        sessionState: provider.state,
        refreshCount: provider.getRefreshCount(),
        expiresAt: tokenContext.session?.expiresAt || null,
      },
    });
  } catch (error) {
    console.error('Fetch project data failed:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

app.post('/api/dida/project/task/complete', async (req, res) => {
  const { projectId, taskId, complete = true, task } = req.body || {};
  if (!projectId || !taskId) {
    return res.status(400).json({ error: '缺少projectId或taskId' });
  }

  let tokenContext;
  try {
    tokenContext = await resolveTokenProvider(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const provider = tokenContext.provider;

  const getAuthHeaders = async () => {
    const token = await provider.getToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  try {
    if (complete) {
      const headers = await getAuthHeaders();
      await axios.post(
        `https://api.dida365.com/open/v1/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}/complete`,
        {},
        { headers }
      );
      return res.json({ success: true });
    }

    if (!task || !task.title) {
      return res.status(400).json({ error: '缺少任务内容，无法重新创建' });
    }
    const payload = {
      title: task.title,
      projectId,
      content: task.content || task.desc || '',
      desc: task.desc || '',
      priority: typeof task.priority === 'number' ? task.priority : 0,
      dueDate: task.dueDate || '',
      startDate: task.startDate || '',
      isAllDay: Boolean(task.isAllDay),
      reminders: Array.isArray(task.reminders) ? task.reminders : [],
      items: Array.isArray(task.items)
        ? task.items.map((item) => ({
            title: item.title || '',
            status: item.status,
            sortOrder: item.sortOrder,
            startDate: item.startDate,
            isAllDay: item.isAllDay,
            timeZone: item.timeZone,
          }))
        : [],
    };
    const headers = await getAuthHeaders();
    const response = await axios.post('https://api.dida365.com/open/v1/task', payload, { headers });
    res.json({ success: true, recreated: response.data });
  } catch (error) {
    console.error('Toggle task completion failed:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('*', (req, res) => {
  const indexPath = path.join(STATIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Client build not found. Please run `npm run client:build` first.');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
