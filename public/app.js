// Helper function to get current time with timezone support
function getCurrentTimeWithTimezone(timeSource) {
  const now = new Date();

  // If timeSource is 'Local' or empty, use local timezone
  if (!timeSource || timeSource.toLowerCase() === 'local' || timeSource.toLowerCase() === 'false') {
    const offset = -now.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
    const timezoneStr = `${sign}${hours}:${minutes}`;

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${timezoneStr}`;
  }

  // If timeSource is a specific timezone (e.g., 'Asia/Shanghai'), use Intl API
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeSource,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(now);
    const get = (type) => parts.find(p => p.type === type)?.value;

    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');
    const second = get('second');

    // Calculate timezone offset for the specified timezone
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timeSource }));
    const offsetMinutes = (tzDate - utcDate) / 60000;

    const sign = offsetMinutes >= 0 ? '+' : '-';
    const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
    const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
    const timezoneStr = `${sign}${hours}:${minutes}`;

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${timezoneStr}`;
  } catch (error) {
    console.error('Invalid timezone:', timeSource, error);
    // Fallback to local timezone
    return getCurrentTimeWithTimezone('Local');
  }
}

const rawTasksInput = document.getElementById('rawTasks');
const localePicker = document.getElementById('localePicker');
const generateBtn = document.getElementById('generateBtn');
const aiStatus = document.getElementById('aiStatus');
const tokenForm = document.getElementById('tokenForm');
const tokenStatus = document.getElementById('tokenStatus');
const createForm = document.getElementById('createForm');
const createStatus = document.getElementById('createStatus');
const tasksContainer = document.getElementById('tasksContainer');
const addTaskBtn = document.getElementById('addTaskBtn');
const accessTokenInput = document.getElementById('accessToken');
const projectIdInput = document.getElementById('projectId');
const timeZoneInput = document.getElementById('timeZone');
const reminderInput = document.getElementById('reminderInput');
const allDayToggle = document.getElementById('allDayToggle');
const confirmModal = document.getElementById('confirmModal');
const modalTaskList = document.getElementById('modalTaskList');
const modalConfirmBtn = document.getElementById('modalConfirm');
const modalCancelBtn = document.getElementById('modalCancel');
const modalCloseBtn = document.getElementById('modalClose');

const openaiBaseUrlInput = document.getElementById('openaiBaseUrl');
const openaiKeyInput = document.getElementById('openaiKey');
const proxyOrigin = document.body?.dataset?.proxyOrigin || window.location.origin;
const redirectDisplay = document.getElementById('redirectDisplay');
let redirectUriValue = '';
if (redirectDisplay) {
  redirectUriValue = new URL('/oauth/callback', proxyOrigin).href;
  redirectDisplay.value = redirectUriValue;
  redirectDisplay.setAttribute('title', redirectUriValue);
} else {
  redirectUriValue = new URL('/oauth/callback', proxyOrigin).href;
}
const startOauthBtn = document.getElementById('startOauthBtn');
const checkOauthBtn = document.getElementById('checkOauthBtn');
const oauthStatus = document.getElementById('oauthStatus');
const oauthModal = document.getElementById('oauthModal');
const oauthStatusBtn = document.getElementById('oauthStatusBtn');
const oauthModalClose = document.getElementById('oauthModalClose');
const aiStatusBtn = document.getElementById('aiStatusBtn');
const aiSettingsModal = document.getElementById('aiSettingsModal');
const aiModalClose = document.getElementById('aiModalClose');
const aiProgress = document.getElementById('aiProgress');
const aiProgressFill = document.getElementById('aiProgressFill');
const aiProgressText = document.getElementById('aiProgressText');
const createProgress = document.getElementById('createProgress');
const createProgressFill = document.getElementById('createProgressFill');
const createProgressText = document.getElementById('createProgressText');
const submissionsBtn = document.getElementById('submissionsBtn');
const submissionsModal = document.getElementById('submissionsModal');
const submissionsModalClose = document.getElementById('submissionsModalClose');
const submissionsStatus = document.getElementById('submissionsStatus');
const submissionsList = document.getElementById('submissionsList');
const toastContainer = document.getElementById('toastContainer');
let timeSource = 'Asia/Shanghai';
const projectListBtn = document.getElementById('projectListBtn');
const projectsModal = document.getElementById('projectsModal');
const projectsModalClose = document.getElementById('projectsModalClose');
const projectsRefreshBtn = document.getElementById('projectsRefreshBtn');
const projectsStatus = document.getElementById('projectsStatus');
const projectsList = document.getElementById('projectsList');

const defaultTimeZone = document.body?.dataset?.timeZone || 'Asia/Shanghai';
const tasksState = [];
let pendingSubmission = null;
let oauthPopup = null;
let oauthInitialized = false;
const OAUTH_STATE_KEY = 'didauto:oauthState';
let currentOauthState = loadStoredOauthState();
let confirmModalVisible = false;
let oauthModalVisible = false;
let aiModalVisible = false;
let projectsModalVisible = false;
let availableProjects = [];
let availableProjectsSignature = '[]';
let memoryAccessToken = '';
let memoryProjectId = '';
let memoryTimeZone = defaultTimeZone;
let memoryReminder = '';
let memoryAllDay = false;
const priorityOptions = [
  { value: 'high', label: '高优先级', color: '#DC2626' },
  { value: 'medium', label: '中优先级', color: '#EA8A1A' },
  { value: 'low', label: '低优先级', color: '#2563EB' },
  { value: 'none', label: '无优先级', color: '#9CA3AF' },
];

const localeOptions = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
];
let currentLocale = 'zh';

async function loadTimeConfig() {
  try {
    const { data } = await requestJson('/api/time/config');
    const configValue = (data?.timeSource || '').toString().trim();
    if (configValue) {
      timeSource = configValue;
    }
  } catch (error) {
    // 忽略配置加载错误，使用默认时区
  }
}

function normalizeScheduleMode(mode) {
  const value = (mode || '').toString().toLowerCase();
  if (['range', 'interval', 'duration', 'span'].includes(value)) return 'range';
  if (['none', 'off', 'unset'].includes(value)) return 'none';
  return 'point';
}

function readAccessToken() {
  return accessTokenInput ? accessTokenInput.value.trim() : memoryAccessToken;
}

function writeAccessToken(value) {
  memoryAccessToken = value || '';
  if (accessTokenInput) {
    accessTokenInput.value = memoryAccessToken;
  }
}

function readProjectId() {
  return projectIdInput ? projectIdInput.value.trim() : memoryProjectId;
}

function readTimeZone() {
  return timeZoneInput ? timeZoneInput.value.trim() : memoryTimeZone;
}

function readReminder() {
  return reminderInput ? reminderInput.value.trim() : memoryReminder;
}

function readAllDay() {
  return allDayToggle ? allDayToggle.checked : memoryAllDay;
}

function writeAllDay(value) {
  memoryAllDay = Boolean(value);
  if (allDayToggle) {
    allDayToggle.checked = memoryAllDay;
  }
}

function setStatus(el, message, isError = false) {
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('error', Boolean(isError));
}

function parseCommaList(value = '') {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function filterOpenProjects(projects = []) {
  return (Array.isArray(projects) ? projects : []).filter((project) => project && !project.closed);
}

function mapProjectsForAi(projects = []) {
  return filterOpenProjects(projects)
    .map((project) => {
      const id = typeof project.id === 'string' ? project.id.trim() : '';
      if (!id) {
        return null;
      }
      const name = typeof project.name === 'string' ? project.name.trim() : '';
      const entry = { id, name: name || id };
      if (project.groupId) {
        entry.groupId = project.groupId;
      }
      const color = normalizeProjectColor(project.color);
      if (color) {
        entry.color = color;
      }
      return entry;
    })
    .filter(Boolean);
}

function getProjectNameById(id = '') {
  const normalizedId = (id || '').trim();
  if (!normalizedId) return '';
  const target = availableProjects.find((project) => project.id === normalizedId);
  return target?.name || '';
}

function findProjectById(projectId) {
  const id = (projectId || '').trim();
  if (!id) return null;
  return availableProjects.find((project) => project.id === id) || null;
}

function createProjectPicker(task, onSelect) {
  const container = document.createElement('div');
  container.className = 'project-picker';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'project-picker-trigger';
  const chip = document.createElement('span');
  chip.className = 'project-color-chip';
  const label = document.createElement('span');
  label.className = 'project-picker-label';
  const caret = document.createElement('span');
  caret.className = 'project-picker-caret';
  caret.textContent = '▾';

  const menu = document.createElement('div');
  menu.className = 'project-picker-menu';

  const renderLabel = (projectId) => {
    const matched = findProjectById(projectId);
    if (matched) {
      label.textContent = matched.name;
      chip.style.backgroundColor = matched.color || '#cbd5e1';
      chip.classList.remove('hidden');
    } else {
      label.textContent = availableProjects.length ? '请选择清单' : '暂无清单可选择';
      chip.classList.add('hidden');
    }
  };

  const closeMenu = () => {
    container.classList.remove('open');
  };

  const buildMenu = () => {
    menu.innerHTML = '';
    availableProjects.forEach((project) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'project-option';
      const dot = document.createElement('span');
      dot.className = 'project-option-dot';
      if (project.color) {
        dot.style.backgroundColor = project.color;
      }
      const text = document.createElement('span');
      text.textContent = project.name;
      item.append(dot, text);
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        onSelect(project.id);
        renderLabel(project.id);
        closeMenu();
      });
      menu.appendChild(item);
    });
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!availableProjects.length) {
      return;
    }
    if (!container.classList.contains('open')) {
      buildMenu();
      container.classList.add('open');
    } else {
      closeMenu();
    }
  });

  container.append(trigger, menu);
  trigger.append(chip, label, caret);
  renderLabel(task.projectId);

  if (!availableProjects.length) {
    trigger.disabled = true;
  }

  return container;
}

function createPriorityPicker(currentValue, getProjectColor, onSelect) {
  const container = document.createElement('div');
  container.className = 'priority-picker';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'priority-picker-trigger';

  const flag = document.createElement('span');
  flag.className = 'priority-flag';
  flag.textContent = '⚑';
  const label = document.createElement('span');
  label.className = 'priority-picker-label';
  const caret = document.createElement('span');
  caret.className = 'priority-picker-caret';
  caret.textContent = '▾';

  const menu = document.createElement('div');
  menu.className = 'priority-picker-menu';

  const renderLabel = (value) => {
    const matched = priorityOptions.find((item) => item.value === value) || priorityOptions[priorityOptions.length - 1];
    label.textContent = matched.label;
    flag.style.color = matched.color || '#9CA3AF';
  };

  const closeMenu = () => {
    container.classList.remove('open');
  };

  const buildMenu = () => {
    menu.innerHTML = '';
    priorityOptions.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'priority-option';
      const icon = document.createElement('span');
      icon.className = 'priority-option-flag';
      icon.style.color = item.color;
      icon.textContent = '⚑';
      const text = document.createElement('span');
      text.textContent = item.label;
      btn.append(icon, text);
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        onSelect(item.value);
        renderLabel(item.value);
        closeMenu();
      });
      menu.appendChild(btn);
    });
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!container.classList.contains('open')) {
      buildMenu();
      container.classList.add('open');
    } else {
      closeMenu();
    }
  });

  trigger.append(flag, label, caret);
  container.append(trigger, menu);
  renderLabel(currentValue);
  container.setProjectColor = () => {};
  return container;
}

function formatDatePart(input) {
  if (!input) return '';
  const pad = (num) => String(num).padStart(2, '0');
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())}`;
  }
  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  }
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(input);
  if (match) {
    return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;
  }
  return '';
}

function formatTimePart(input) {
  if (!input) return '';
  const pad = (num) => String(num).padStart(2, '0');
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return `${pad(input.getHours())}:${pad(input.getMinutes())}`;
  }
  const timeMatch = /(\d{1,2}):(\d{1,2})/.exec(input);
  if (timeMatch) {
    return `${pad(timeMatch[1])}:${pad(timeMatch[2])}`;
  }
  // 检查是否是纯日期格式（YYYY-MM-DD 或 YYYY/MM/DD），如果是则不提取时间
  const dateOnlyMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(input);
  if (dateOnlyMatch) {
    return ''; // 纯日期，没有时间部分
  }
  // 只有当字符串包含时间信息（T 或空格后跟时间）时才尝试解析
  const hasTimeIndicator = /[T\s]\d{1,2}:\d{1,2}/.test(input);
  if (hasTimeIndicator) {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
    }
  }
  return '';
}

function splitDateAndTime(value) {
  if (!value) return { date: '', time: '' };
  const date = formatDatePart(value);
  const time = formatTimePart(value);
  return { date, time };
}

function combineDateTime(datePart, timePart) {
  if (!datePart) return '';
  const date = formatDatePart(datePart);
  const time = formatTimePart(timePart);
  if (!date) return '';
  return time ? `${date}T${time}` : date;
}

function formatScheduleLabel(datePart, timePart) {
  if (!datePart) return '';
  const date = formatDatePart(datePart);
  const time = formatTimePart(timePart);
  return time ? `${date} ${time}` : date;
}

function getEffectiveTimeZone() {
  const value = (timeSource || '').toString().trim();
  if (!value) return '';
  const normalized = value.toLowerCase();
  if (normalized === 'false' || normalized === 'local') return '';
  return value;
}

function getZonedDateParts(timeZone = '', baseDate = new Date()) {
  const options = {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };
  if (timeZone) {
    options.timeZone = timeZone;
  }
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  const parts = formatter.formatToParts(baseDate);
  const lookup = (type) => parts.find((item) => item.type === type)?.value || '';
  return {
    date: `${lookup('year')}-${lookup('month')}-${lookup('day')}`,
    time: `${lookup('hour')}:${lookup('minute')}`,
  };
}

async function fetchTimeParts() {
  const timeZone = getEffectiveTimeZone();
  if (!timeZone) {
    return getZonedDateParts('', new Date());
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(timeZone)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (response.ok) {
      const data = await response.json();
      if (data?.datetime) {
        return getZonedDateParts(timeZone, new Date(data.datetime));
      }
    }
  } catch (error) {
    // 忽略网络/解析错误，回退本地时间
  }
  return getZonedDateParts(timeZone, new Date());
}

function getNextQuarterHour(baseParts = getZonedDateParts(getEffectiveTimeZone())) {
  const now = baseParts || getZonedDateParts(getEffectiveTimeZone());
  const [hourStr, minuteStr] = (now.time || '').split(':');
  const hour = Number.parseInt(hourStr || '0', 10);
  const minute = Number.parseInt(minuteStr || '0', 10);
  const remainder = minute % 15;
  const add = remainder === 0 ? 15 : 15 - remainder;
  const totalMinutes = hour * 60 + minute + add;
  const nextHour = Math.floor((totalMinutes % (24 * 60)) / 60);
  const nextMinute = totalMinutes % 60;
  const dayOverflow = totalMinutes >= 24 * 60 ? 1 : 0;
  const base = new Date();
  base.setDate(base.getDate() + dayOverflow);
  const nextDate = getZonedDateParts(getEffectiveTimeZone(), base).date;
  const pad = (num) => String(num).padStart(2, '0');
  return {
    date: nextDate,
    time: `${pad(nextHour)}:${pad(nextMinute)}`,
  };
}

function createSchedulePicker(task, onChange) {
  const timeZone = getEffectiveTimeZone();
  const today = getZonedDateParts(timeZone).date;
  const state = {
    mode: normalizeScheduleMode(task.scheduleMode),
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    isAllDay: Boolean(task.isAllDay),
  };
  const startParts = splitDateAndTime(task.startDate);
  const endParts = splitDateAndTime(task.dueDate || task.suggestedDueDate);
  if (state.mode === 'range') {
    state.startDate = startParts.date || endParts.date || today;
    state.startTime = startParts.time;
    state.endDate = endParts.date || startParts.date || today;
    state.endTime = endParts.time;
  } else if (state.mode === 'none') {
    state.startDate = '';
    state.endDate = '';
  } else {
    state.endDate = endParts.date || startParts.date || today;
    state.endTime = endParts.time || startParts.time;
  }

  const container = document.createElement('div');
  container.className = 'schedule-picker';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'schedule-picker-trigger';
  const triggerValue = document.createElement('span');
  triggerValue.className = 'schedule-value';
  const triggerCaret = document.createElement('span');
  triggerCaret.className = 'schedule-picker-caret';
  triggerCaret.textContent = '▾';
  trigger.append(triggerValue, triggerCaret);

  const menu = document.createElement('div');
  menu.className = 'schedule-picker-menu';
  const wrapper = document.createElement('div');
  wrapper.className = 'schedule-wrapper';

  const modeRow = document.createElement('div');
  modeRow.className = 'schedule-mode-row';
  const pointBtn = document.createElement('button');
  pointBtn.type = 'button';
  pointBtn.className = 'schedule-mode-btn';
  pointBtn.textContent = '时间点';
  const rangeBtn = document.createElement('button');
  rangeBtn.type = 'button';
  rangeBtn.className = 'schedule-mode-btn';
  rangeBtn.textContent = '时间段';
  const noneBtn = document.createElement('button');
  noneBtn.type = 'button';
  noneBtn.className = 'schedule-mode-btn ghost';
  noneBtn.textContent = '不设置';

  const startRow = document.createElement('div');
  startRow.className = 'schedule-row';
  const startLabel = document.createElement('span');
  startLabel.textContent = '开始';
  const startDateInput = document.createElement('input');
  startDateInput.type = 'text';
  startDateInput.readOnly = true;
  startDateInput.placeholder = 'YYYY-MM-DD';
  startDateInput.className = 'schedule-input';
  const startTimeInput = document.createElement('input');
  startTimeInput.type = 'time';
  startTimeInput.className = 'time-input';
  startTimeInput.step = 900;
  startRow.append(startLabel, startDateInput, startTimeInput);

  const endRow = document.createElement('div');
  endRow.className = 'schedule-row';
  const endLabel = document.createElement('span');
  endLabel.textContent = '截止';
  const endDateInput = document.createElement('input');
  endDateInput.type = 'text';
  endDateInput.readOnly = true;
  endDateInput.placeholder = 'YYYY-MM-DD';
  endDateInput.className = 'schedule-input';
  const endTimeInput = document.createElement('input');
  endTimeInput.type = 'time';
  endTimeInput.className = 'time-input';
  endTimeInput.step = 900;
  endRow.append(endLabel, endDateInput, endTimeInput);

  const actionsRow = document.createElement('div');
  actionsRow.className = 'schedule-actions';
  const todayBtn = document.createElement('button');
  todayBtn.type = 'button';
  todayBtn.className = 'schedule-action';
  todayBtn.textContent = '今天';
  const nowBtn = document.createElement('button');
  nowBtn.type = 'button';
  nowBtn.className = 'schedule-action';
  nowBtn.textContent = '现在';
  const laterBtn = document.createElement('button');
  laterBtn.type = 'button';
  laterBtn.className = 'schedule-action';
  laterBtn.textContent = '稍后';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'schedule-action ghost';
  clearBtn.textContent = '清空';
  actionsRow.append(todayBtn, nowBtn, laterBtn, clearBtn);

  const allDayRow = document.createElement('label');
  allDayRow.className = 'schedule-all-day inline';
  const allDayToggleInline = document.createElement('input');
  allDayToggleInline.type = 'checkbox';
  allDayToggleInline.checked = state.isAllDay;
  const allDayText = document.createElement('span');
  allDayText.textContent = '全天';
  allDayRow.append(allDayToggleInline, allDayText);

  const datePickers = [];
  const bindDatePicker = (input, initialValue, onSelect) => {
    if (window.flatpickr) {
      const picker = window.flatpickr(input, {
        defaultDate: initialValue || null,
        dateFormat: 'Y-m-d',
        allowInput: true,
        disableMobile: true,
        onChange: (_dates, dateStr) => onSelect(dateStr),
        onClose: (_dates, dateStr) => onSelect(dateStr),
      });
      datePickers.push(picker);
      return picker;
    }
    input.readOnly = false;
    input.type = 'date';
    input.addEventListener('input', (event) => onSelect(event.target.value));
    return null;
  };

  const updateTriggerValue = () => {
    if (state.mode === 'none') {
      triggerValue.textContent = '未设置';
      return;
    }
    if (state.mode === 'range') {
      const startText = formatScheduleLabel(state.startDate, state.startTime);
      const endText = formatScheduleLabel(state.endDate, state.endTime);
      triggerValue.textContent = startText && endText ? `${startText} → ${endText}` : startText || endText || '未设置';
      return;
    }
    triggerValue.textContent = formatScheduleLabel(state.endDate, state.endTime) || '未设置';
  };

  const applyUpdates = () => {
    const updates = {
      scheduleMode: state.mode,
      startDate: state.mode === 'range' ? combineDateTime(state.startDate, state.startTime) : '',
      dueDate: state.mode === 'none' ? '' : combineDateTime(state.endDate, state.endTime),
      isAllDay: state.isAllDay,
    };
    Object.assign(task, updates);
    if (typeof onChange === 'function') {
      onChange(updates);
    }
    updateTriggerValue();
  };

  const syncInputs = () => {
    startRow.style.display = state.mode === 'range' ? 'flex' : 'none';
    pointBtn.classList.toggle('active', state.mode === 'point');
    rangeBtn.classList.toggle('active', state.mode === 'range');
    noneBtn.classList.toggle('active', state.mode === 'none');
    startDateInput.value = state.startDate || '';
    startTimeInput.value = state.startTime || '';
    endDateInput.value = state.endDate || '';
    endTimeInput.value = state.endTime || '';
    allDayToggleInline.checked = state.isAllDay;
    datePickers.forEach((picker) => {
      if (picker?.input === startDateInput && state.startDate) {
        picker.setDate(state.startDate, false);
      }
      if (picker?.input === endDateInput && state.endDate) {
        picker.setDate(state.endDate, false);
      }
    });
  };

  const setMode = (mode) => {
    state.mode = normalizeScheduleMode(mode);
    if (state.mode === 'none') {
      state.startDate = '';
      state.startTime = '';
      state.endDate = '';
      state.endTime = '';
    } else if (state.mode === 'range') {
      if (!state.startDate) state.startDate = state.endDate || today;
      if (!state.endDate) state.endDate = state.startDate;
    } else {
      // point 模式：只清空 startDate/startTime，保持 endDate 不变
      state.startDate = '';
      state.startTime = '';
      // 不再自动设置 endDate 为 today
    }
    syncInputs();
    applyUpdates();
  };

  bindDatePicker(startDateInput, state.startDate, (value) => {
    state.startDate = formatDatePart(value);
    applyUpdates();
    syncInputs();
  });
  bindDatePicker(endDateInput, state.endDate, (value) => {
    state.endDate = formatDatePart(value);
    applyUpdates();
    syncInputs();
  });

  startTimeInput.addEventListener('input', (event) => {
    state.startTime = formatTimePart(event.target.value);
    applyUpdates();
    syncInputs();
  });
  endTimeInput.addEventListener('input', (event) => {
    state.endTime = formatTimePart(event.target.value);
    applyUpdates();
    syncInputs();
  });

  pointBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    setMode('point');
  });
  rangeBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    setMode('range');
  });
  noneBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    setMode('none');
  });
  todayBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    state.endDate = today;
    if (state.mode === 'range') {
      state.startDate = today;
      state.startTime = '';
    }
    state.endTime = '';
    applyUpdates();
    syncInputs();
  });
  nowBtn.addEventListener('click', async (event) => {
    event.stopPropagation();
    const current = await fetchTimeParts();
    state.endDate = current.date;
    state.endTime = current.time;
    if (state.mode === 'range') {
      state.startDate = current.date;
      state.startTime = current.time;
    }
    applyUpdates();
    syncInputs();
  });
  laterBtn.addEventListener('click', async (event) => {
    event.stopPropagation();
    const base = await fetchTimeParts();
    const nextSlot = getNextQuarterHour(base);
    state.endDate = nextSlot.date;
    state.endTime = nextSlot.time;
    if (state.mode === 'range') {
      state.startDate = nextSlot.date;
      state.startTime = nextSlot.time;
    }
    applyUpdates();
    syncInputs();
  });
  clearBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    setMode('none');
  });
  allDayToggleInline.addEventListener('change', (event) => {
    state.isAllDay = event.target.checked;
    applyUpdates();
  });

  wrapper.append(modeRow, startRow, endRow, actionsRow);
  actionsRow.append(allDayRow);
  modeRow.append(pointBtn, rangeBtn, noneBtn);
  menu.appendChild(wrapper);

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    container.classList.toggle('open');
  });

  container.append(trigger, menu);
  syncInputs();
  updateTriggerValue();

  return container;
}
/* duplicate schedule picker removed */

function formatDateTimeLocal(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setAvailableProjects(projects = []) {
  const mapped = mapProjectsForAi(projects);
  const signature = JSON.stringify(mapped);
  if (signature === availableProjectsSignature) {
    return;
  }
  availableProjects = mapped;
  availableProjectsSignature = signature;
  if (tasksState.length) {
    renderTasks();
  }
}

document.addEventListener('click', (event) => {
  const pickers = document.querySelectorAll('.project-picker.open');
  pickers.forEach((picker) => {
    if (!picker.contains(event.target)) {
      picker.classList.remove('open');
    }
  });
  const priorityPickers = document.querySelectorAll('.priority-picker.open');
  priorityPickers.forEach((picker) => {
    if (!picker.contains(event.target)) {
      picker.classList.remove('open');
    }
  });
  const schedulePickers = document.querySelectorAll('.schedule-picker.open');
  schedulePickers.forEach((picker) => {
    if (!picker.contains(event.target)) {
      picker.classList.remove('open');
    }
  });
  const localePickers = document.querySelectorAll('.locale-picker.open');
  localePickers.forEach((picker) => {
    if (!picker.contains(event.target)) {
      picker.classList.remove('open');
    }
  });
  const clickedSubmissionsBtn = submissionsBtn && submissionsBtn.contains(event.target);
  if (
    submissionsModal &&
    !submissionsModal.classList.contains('hidden') &&
    submissionsModal.contains(event.target) === false &&
    !clickedSubmissionsBtn
  ) {
    hideSubmissionsModal();
  }
});

function setOauthStatus(message, isError = false) {
  setStatus(oauthStatus, message, isError);
}

function updateOauthIndicator(state = 'idle', tooltip = '') {
  if (!oauthStatusBtn) return;
  const labels = {
    success: '滴答已授权',
    pending: '授权中…',
    error: '滴答未授权',
    idle: '授权状态',
  };
  oauthStatusBtn.textContent = labels[state] || labels.idle;
  oauthStatusBtn.classList.remove('success', 'pending', 'error');
  if (state === 'success') {
    oauthStatusBtn.classList.add('success');
  } else if (state === 'pending') {
    oauthStatusBtn.classList.add('pending');
  } else if (state === 'error') {
    oauthStatusBtn.classList.add('error');
  }
  if (tooltip) {
    oauthStatusBtn.setAttribute('title', tooltip);
  } else {
    oauthStatusBtn.removeAttribute('title');
  }
}

function updateAiIndicator(state = 'error', tooltip = '') {
  if (!aiStatusBtn) return;
  const labels = {
    success: 'AI 已连接',
    pending: 'AI 连接中…',
    error: 'AI 未连接',
    idle: 'AI 状态',
  };
  aiStatusBtn.textContent = labels[state] || labels.idle;
  aiStatusBtn.classList.remove('success', 'pending', 'error');
  if (state === 'success') {
    aiStatusBtn.classList.add('success');
  } else if (state === 'pending') {
    aiStatusBtn.classList.add('pending');
  } else {
    aiStatusBtn.classList.add('error');
  }
  if (tooltip) {
    aiStatusBtn.setAttribute('title', tooltip);
  } else {
    aiStatusBtn.removeAttribute('title');
  }
}

function stripHtmlSnippet(text = '', maxLength = 160) {
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function loadStoredOauthState() {
  try {
    return window.sessionStorage.getItem(OAUTH_STATE_KEY);
  } catch (error) {
    return null;
  }
}

function persistOauthState(stateValue) {
  currentOauthState = stateValue || null;
  try {
    if (currentOauthState) {
      window.sessionStorage.setItem(OAUTH_STATE_KEY, currentOauthState);
    } else {
      window.sessionStorage.removeItem(OAUTH_STATE_KEY);
    }
  } catch (error) {
    // 忽略 sessionStorage 错误
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const rawText = await response.text();
  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch (error) {
      data = null;
    }
  } else {
    data = {};
  }
  if (!response.ok) {
    console.error('Request failed', {
      url,
      status: response.status,
      statusText: response.statusText,
      payload: options.body,
      rawText,
    });
  }
  return { response, data, rawText };
}

async function startOauthFlow(auto = false) {
  setOauthStatus('正在请求滴答授权链接...');
  updateOauthIndicator('pending', '正在请求滴答授权链接');
  const payload = {
    clientId: document.getElementById('clientId').value.trim() || undefined,
    clientSecret: document.getElementById('clientSecret').value.trim() || undefined,
    redirectUri: redirectUriValue,
  };
  try {
    oauthPopup = window.open('', 'dida-oauth', 'width=520,height=720');
    if (!oauthPopup || oauthPopup.closed) {
      setOauthStatus('浏览器阻止了弹窗，请允许后重试', true);
      updateOauthIndicator('error', '浏览器阻止了授权弹窗');
      return;
    }
    const { response, data, rawText } = await requestJson('/api/oauth/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(data?.error || stripHtmlSnippet(rawText) || '无法创建授权会话');
    }
    if (!data || !data.state || !data.authorizeUrl) {
      throw new Error(stripHtmlSnippet(rawText) || '服务端返回数据不完整，无法继续授权');
    }
    persistOauthState(data.state);
    oauthPopup.location = data.authorizeUrl;
    setOauthStatus('已打开滴答授权，请在新窗口完成登录');
  } catch (error) {
    closeOauthPopup();
    setOauthStatus(error.message, true);
    updateOauthIndicator('error', error.message);
    if (auto) {
      showOauthModal(true);
    }
  }
}

async function fetchOauthSession(state, options = {}) {
  const { silent = false, autoClose = false } = options;
  if (!state) {
    if (!silent) {
      setOauthStatus('没有活跃的授权会话，请先点击“打开滴答授权窗口”', true);
    }
    updateOauthIndicator('error', '尚未建立授权会话');
    return false;
  }
  try {
    const { response, data, rawText } = await requestJson(`/api/oauth/session?state=${encodeURIComponent(state)}`);
    const fallbackMessage = data?.error || stripHtmlSnippet(rawText) || '无法获取授权状态';
    if (!response.ok) {
      if (!silent) {
        setOauthStatus(fallbackMessage, true);
      }
      if (response.status === 409) {
        updateOauthIndicator('pending', fallbackMessage);
      } else {
        updateOauthIndicator('error', fallbackMessage);
      }
      return false;
    }
    if (!data) {
      throw new Error(stripHtmlSnippet(rawText) || '授权状态响应为空，请稍后重试');
    }
    persistOauthState(data.state || state);
    if (data.accessToken) {
      writeAccessToken(data.accessToken);
    } else {
      const waitingMessage = data.error || '授权尚未完成，请在弹出的滴答页面完成授权';
      if (!silent) {
        setOauthStatus(waitingMessage);
      }
      updateOauthIndicator('pending', waitingMessage);
      return false;
    }
    if (!silent) {
      const expiryText = data.expiresAt ? new Date(data.expiresAt).toLocaleString() : '未知';
      setOauthStatus(`授权已完成，可用 Token 约在 ${expiryText} 过期`);
    }
    updateOauthIndicator('pending', '正在验证授权状态');
    closeOauthPopup();
    if (autoClose) {
      hideOauthModal();
    }
    await validateAuthorization({ silent: true });
    return true;
  } catch (error) {
    if (!silent) {
      setOauthStatus(error.message, true);
    }
    updateOauthIndicator('error', error.message);
    return false;
  }
}

async function validateAuthorization(options = {}) {
  const { silent = false, showModalOnFail = false } = options;
  const payload = {};
  const directToken = readAccessToken();
  if (currentOauthState) {
    payload.oauthState = currentOauthState;
  } else if (directToken) {
    payload.accessToken = directToken;
  }
  if (!payload.oauthState && !payload.accessToken) {
    if (!silent) {
      setOauthStatus('暂无授权信息，请先完成授权', true);
    }
    updateOauthIndicator('error', '尚未授权');
    if (showModalOnFail) {
      showOauthModal(true);
    }
    return false;
  }
  if (!silent) {
    setOauthStatus('正在向滴答验证授权状态...');
  }
  updateOauthIndicator('pending', '正在验证授权状态');
  try {
    const { response, data, rawText } = await requestJson('/api/dida/projects/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(data?.error || stripHtmlSnippet(rawText) || '授权校验失败');
    }
    if (data.auth?.sessionState) {
      persistOauthState(data.auth.sessionState);
    }
    const projectCount = Array.isArray(data.projects) ? data.projects.length : 0;
    if (!silent) {
      setOauthStatus(`授权可用，可访问 ${projectCount} 个清单`);
    }
    const expiresText = data.auth?.expiresAt ? new Date(data.auth.expiresAt).toLocaleString() : '';
    updateOauthIndicator('success', expiresText ? `Token 约在 ${expiresText} 过期` : '授权有效');
    hideOauthModal();
    return true;
  } catch (error) {
    if (!silent) {
      setOauthStatus(error.message, true);
    }
    updateOauthIndicator('error', error.message);
    if (showModalOnFail) {
      showOauthModal(true);
    }
    return false;
  }
}

function handleOauthMessage(event) {
  if (event.origin !== window.location.origin && event.origin !== proxyOrigin) {
    return;
  }
  const payload = event.data;
  if (!payload || payload.source !== 'didauto-auth') {
    return;
  }
  if (payload.success) {
    setOauthStatus('授权成功，正在同步 Access Token...');
  } else {
    setOauthStatus(payload.message || '授权失败，请重试', true);
  }
  if (payload.state) {
    persistOauthState(payload.state);
    fetchOauthSession(payload.state, { silent: false, autoClose: true });
  }
  closeOauthPopup();
}

function checkOauthSession() {
  validateAuthorization({ silent: false, showModalOnFail: true });
}

async function ensureProjectsLoadedForTasks() {
  if (availableProjects.length) return;
  const projects = await fetchProjectsForAi();
  if (Array.isArray(projects) && projects.length) {
    setAvailableProjects(projects);
  }
}

async function addEmptyTask() {
  await ensureProjectsLoadedForTasks();
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10);
  tasksState.push({
    title: '',
    description: '',
    completed: false,
    projectId: '',
    priority: 'none',
    suggestedDueDate: '',
    dueDate: datePart,
    startDate: '',
    scheduleMode: 'point',
    reminders: [],
    subTasks: [],
    enabled: true,
    isAllDay: readAllDay(),
  });
  renderTasks();
}

function renderTasks() {
  if (!tasksState.length) {
    tasksContainer.innerHTML = `
      <p class="muted tight">👉 还没有可编辑的任务，粘贴文本并运行 AI 整理</p>
      <p class="muted tight">👉 还没有可编辑的任务，手动添加录入任务更可靠</p>`;
    return;
  }

  tasksContainer.innerHTML = '';

  tasksState.forEach((task, index) => {
    const card = document.createElement('div');
    card.className = 'task-card';

    const header = document.createElement('header');
    const title = document.createElement('h3');
    title.textContent = `任务 ${index + 1}`;

    const controls = document.createElement('div');
    controls.className = 'meta-row task-controls';

    const completedLabel = document.createElement('label');
    completedLabel.className = 'inline';
    const completedCheckbox = document.createElement('input');
    completedCheckbox.type = 'checkbox';
    completedCheckbox.checked = Boolean(task.completed);
    completedCheckbox.addEventListener('change', (event) => {
      tasksState[index].completed = event.target.checked;
    });
    completedLabel.append(completedCheckbox, document.createTextNode('标记完成'));

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '删除';
    removeBtn.addEventListener('click', () => {
      tasksState.splice(index, 1);
      renderTasks();
    });

    controls.append(completedLabel, removeBtn);
    header.append(title, controls);
    card.appendChild(header);

    const titleInput = document.createElement('input');
    titleInput.value = task.title;
    titleInput.placeholder = '任务标题';
    titleInput.addEventListener('input', (event) => {
      tasksState[index].title = event.target.value;
    });
    card.appendChild(titleInput);

    const descArea = document.createElement('textarea');
    descArea.rows = 5;
    descArea.value = task.description || '';
    descArea.placeholder = '详细说明 / 交付物，可使用 Markdown';
    descArea.addEventListener('input', (event) => {
      tasksState[index].description = event.target.value;
    });
    card.appendChild(descArea);

    const metaRow = document.createElement('div');
    metaRow.className = 'meta-row task-meta-row';

    const projectLabel = document.createElement('label');
    projectLabel.className = 'project-field inline';
    projectLabel.textContent = '所属清单';
    const projectPicker = createProjectPicker(task, (value) => {
      tasksState[index].projectId = value;
    });
    projectLabel.appendChild(projectPicker);

    const priorityLabel = document.createElement('label');
    priorityLabel.className = 'inline priority-field';
    priorityLabel.textContent = '优先级';
    const priorityPicker = createPriorityPicker(task.priority, null, (value) => {
      tasksState[index].priority = value;
    });
    priorityLabel.appendChild(priorityPicker);

    const scheduleLabel = document.createElement('label');
    scheduleLabel.className = 'inline schedule-field';
    scheduleLabel.textContent = '计划时间';
    const schedulePicker = createSchedulePicker(task, (updates) => {
      Object.assign(tasksState[index], updates);
    });
    scheduleLabel.appendChild(schedulePicker);

    metaRow.append(projectLabel, priorityLabel, scheduleLabel);
    card.appendChild(metaRow);

    const subTaskLabel = document.createElement('label');
    subTaskLabel.textContent = '子任务';
    const subTaskArea = document.createElement('textarea');
    subTaskArea.rows = 3;
    subTaskArea.value = Array.isArray(task.subTasks) ? task.subTasks.join('\n') : '';
    subTaskArea.placeholder = '子任务 1\n子任务 2';
    subTaskArea.addEventListener('input', (event) => {
      tasksState[index].subTasks = event.target.value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    });
    subTaskLabel.appendChild(subTaskArea);
    card.appendChild(subTaskLabel);

    if (task.suggestedDueDate && !task.dueDate) {
      const hint = document.createElement('p');
      hint.className = 'muted';
      hint.textContent = `AI 建议：${task.suggestedDueDate}`;
      card.appendChild(hint);
    }

    tasksContainer.appendChild(card);
  });
}

function clearAllTasks() {
  tasksState.length = 0;
  renderTasks();
  pushTaskToast({ success: true, title: '已清空任务', message: '任务列表已清空' });
}

async function handleAiGenerate() {
  const rawText = rawTasksInput.value.trim();
  if (!rawText) {
    pushTaskToast({ success: false, title: 'AI 整理失败', error: '请先输入任务内容' });
    return;
  }
  const taskLines = parseTaskLines(rawText);
  if (!taskLines.length) {
    pushTaskToast({ success: false, title: 'AI 整理失败', error: '没有可解析的任务，请确认输入格式' });
    return;
  }
  const baseOverride = openaiBaseUrlInput.value.trim();
  const keyOverride = openaiKeyInput.value.trim();
  generateBtn.disabled = true;
  setStatus(aiStatus, '', false);
  updateAiIndicator('pending', '正在调用 AI 整理任务');
  showAiProgress(taskLines.length);
  const projectsForAi = await fetchProjectsForAi();

  // Fetch timeSource configuration from server
  let timeSource = 'Local';
  try {
    const configResponse = await fetch('/api/time/config');
    if (configResponse.ok) {
      const configData = await configResponse.json();
      timeSource = configData.timeSource || 'Local';
    }
  } catch (error) {
    console.warn('Failed to fetch time config, using Local:', error);
  }

  // Generate current time with timezone support
  const currentTime = getCurrentTimeWithTimezone(timeSource);

  // Clear existing tasks before starting
  tasksState.length = 0;

  try {
    for (let i = 0; i < taskLines.length; i += 1) {
      updateAiProgress(i, taskLines.length);
      const payload = {
        rawText: taskLines[i],
        locale: currentLocale,
        projects: projectsForAi,
        currentTime,
      };
      if (baseOverride) {
        payload.openaiBaseUrl = baseOverride;
      }
      if (keyOverride) {
        payload.openaiApiKey = keyOverride;
      }
      const { response, data, rawText: responseText } = await requestJson('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(data?.error || stripHtmlSnippet(responseText) || 'AI 请求失败');
      }
      if (!data || !Array.isArray(data.tasks)) {
        throw new Error(stripHtmlSnippet(responseText) || 'AI 返回内容为空，请重试');
      }

      // Process and add tasks immediately after each request
      data.tasks.forEach((task) => {
        const completed = Boolean(task.completed);
        const startRaw = (task.startDate || '').trim();
        const dueRaw = (task.dueDate || task.suggestedDueDate || '').trim();
        const startParts = splitDateAndTime(startRaw);
        const dueParts = splitDateAndTime(dueRaw);
        const hasStartDate = Boolean(startParts.date);
        const hasDueDate = Boolean(dueParts.date);
        const hasStartTime = Boolean(startParts.time);
        const hasDueTime = Boolean(dueParts.time);
        let scheduleMode = normalizeScheduleMode(task.scheduleMode);
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
        tasksState.push({
          ...task,
          completed,
          projectId: task.projectId || '',
          enabled: task.enabled ?? true,
          dueDate: normalizedDue,
          startDate: normalizedStart,
          scheduleMode,
          reminders: Array.isArray(task.reminders) ? task.reminders : [],
          isAllDay: task.isAllDay ?? allDayToggle.checked,
        });
      });

      // Render tasks and update status after each request
      renderTasks();
      updateAiProgress(i + 1, taskLines.length);
      updateAiIndicator('success', `已生成 ${tasksState.length} 条任务`);
      setStatus(aiStatus, `已生成 ${tasksState.length} 条任务...`);
    }

    // Final status update
    setStatus(aiStatus, '', false);
    updateAiIndicator('success', `共 ${tasksState.length} 条`);
    pushTaskToast({ success: true, title: 'AI 整理完成', message: `共 ${tasksState.length} 条任务` });
  } catch (error) {
    setStatus(aiStatus, '', false);
    pushTaskToast({ success: false, title: 'AI 整理失败', error: error.message });
    updateAiIndicator('error', error.message);
  } finally {
    generateBtn.disabled = false;
    hideAiProgress();
  }
}

function parseTaskLines(input) {
  return input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length);
}

function showAiProgress(total) {
  if (!aiProgress || !aiProgressFill || !aiProgressText) return;
  aiProgress.classList.remove('hidden');
  aiProgressFill.classList.add('animated');
  aiProgressFill.style.width = '0%';
  aiProgressText.textContent = total > 0 ? `0/${total}` : '0%';
}

function updateAiProgress(current, total) {
  if (!aiProgress || !aiProgressFill || !aiProgressText || total === 0) return;
  const percentage = Math.min(100, Math.round((current / total) * 100));
  aiProgressFill.style.width = `${percentage}%`;
  aiProgressText.textContent = `${Math.min(current, total)}/${total}`;
}

function hideAiProgress() {
  if (!aiProgress || !aiProgressFill || !aiProgressText) return;
  aiProgress.classList.add('hidden');
  aiProgressFill.classList.remove('animated');
  aiProgressFill.style.width = '0%';
  aiProgressText.textContent = '';
}

function showCreateProgress(message = '正在创建...') {
  if (!createProgress || !createProgressFill || !createProgressText) return;
  createProgress.classList.remove('hidden');
  createProgressFill.classList.add('indeterminate', 'animated');
  createProgressFill.style.width = '100%';
  createProgressText.textContent = message;
}

function hideCreateProgress() {
  if (!createProgress || !createProgressFill || !createProgressText) return;
  createProgress.classList.add('hidden');
  createProgressFill.classList.remove('indeterminate', 'animated');
  createProgressFill.style.width = '0%';
  createProgressText.textContent = '';
}

function pushTaskToast(entry = {}) {
  if (!toastContainer) return;
  const success = entry.success !== false;
  const toast = document.createElement('div');
  toast.className = `toast ${success ? 'success' : 'error'}`;
  const badge = document.createElement('span');
  badge.className = 'toast-badge';
  badge.textContent = success ? '✅' : '⚠️';
  const textWrap = document.createElement('div');
  textWrap.className = 'toast-text';
  const title = document.createElement('p');
  title.className = 'toast-title';
  title.textContent = entry.title || '未命名任务';
  const message = document.createElement('p');
  message.className = 'toast-message';
  const messageText = entry.message
    ? entry.message
    : success
      ? '已成功提交到滴答清单'
      : (entry.error?.error || entry.error || '提交失败');
  message.textContent = messageText;
  textWrap.append(title, message);
  toast.append(badge, textWrap);
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, 3600);
}

async function handleTokenExchange(event) {
  event.preventDefault();
  const code = document.getElementById('authCode').value.trim();
  const clientId = document.getElementById('clientId').value.trim();
  const clientSecret = document.getElementById('clientSecret').value.trim();
  if (!code) {
    setStatus(tokenStatus, 'code 不能为空', true);
    return;
  }
  const submitBtn = tokenForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  setStatus(tokenStatus, '请求中...');
  try {
    const { response, data, rawText } = await requestJson('/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, clientId, clientSecret, redirectUri: redirectUriValue }),
    });
    if (!response.ok) {
      throw new Error(data?.error || stripHtmlSnippet(rawText) || '获取 Token 失败');
    }
    if (!data) {
      throw new Error(stripHtmlSnippet(rawText) || '授权响应为空，请稍后再试');
    }
    if (data.accessToken) {
    writeAccessToken(data.accessToken);
  }
    if (data.state) {
      persistOauthState(data.state);
      setOauthStatus('已保存授权会话，可直接用于后续 API 调用');
    }
    const expiryText = data.expiresAt ? new Date(data.expiresAt).toLocaleString() : '未知';
    setStatus(tokenStatus, `成功：Access Token 预计在 ${expiryText} 过期`);
    updateOauthIndicator('success', `Access Token 约在 ${expiryText} 过期`);
    hideOauthModal();
    validateAuthorization({ silent: true });
  } catch (error) {
    setStatus(tokenStatus, error.message, true);
  } finally {
    submitBtn.disabled = false;
  }
}

async function handleCreateTasks(event) {
  event.preventDefault();
  const activeTasks = tasksState.filter((task) => task.enabled !== false);
  if (!activeTasks.length) {
    const message = '至少选择一个任务';
    setStatus(createStatus, '', false);
    pushTaskToast({ success: false, title: '提交失败', error: message });
    return;
  }

  // 验证每个任务的标题和清单
  for (let i = 0; i < activeTasks.length; i++) {
    const task = activeTasks[i];
    const taskNum = i + 1;

    // 检查标题
    if (!task.title || !task.title.trim()) {
      const message = `任务 ${taskNum} 的标题不能为空`;
      setStatus(createStatus, '', false);
      pushTaskToast({ success: false, title: `任务 ${taskNum}`, error: message });
      return;
    }

    // 检查清单
    if (!task.projectId || !task.projectId.trim()) {
      const message = `任务 ${taskNum} 的所属清单不能为空`;
      setStatus(createStatus, '', false);
      pushTaskToast({ success: false, title: `任务 ${taskNum}`, error: message });
      return;
    }
  }

  const accessToken = readAccessToken();
  if (!accessToken && !currentOauthState) {
    const message = 'Access Token 或 OAuth 授权会话必须至少提供一个';
    setStatus(createStatus, '', false);
    pushTaskToast({ success: false, title: '提交失败', error: message });
    return;
  }
  const chosenProject = activeTasks.find((task) => task.projectId)?.projectId || '';
  if (!chosenProject) {
    const message = '请选择所属清单';
    setStatus(createStatus, '', false);
    pushTaskToast({ success: false, title: '提交失败', error: message });
    return;
  }

  const indices = [];
  tasksState.forEach((task, index) => {
    if (task.enabled !== false) {
      indices.push(index);
    }
  });

  const payload = {
    projectId: chosenProject,
    projectName: getProjectNameById(chosenProject),
    timeZone: readTimeZone() || defaultTimeZone,
    reminders: [],
    tasks: activeTasks.map((task) => ({
      title: task.title,
      description: task.description,
      completed: Boolean(task.completed),
      projectId: task.projectId,
      priority: task.priority,
      dueDate: task.dueDate,
      startDate: task.startDate,
      suggestedDueDate: task.suggestedDueDate,
      reminders: task.reminders,
      subTasks: task.subTasks,
      scheduleMode: task.scheduleMode || 'point',
      isAllDay: task.isAllDay ?? allDayToggle.checked,
    })),
  };
  if (currentOauthState) {
    payload.oauthState = currentOauthState;
  } else {
    payload.accessToken = accessToken;
  }

  pendingSubmission = { payload, indices };
  await submitPendingTasks(event.submitter);
}

function openConfirmModal() {
  if (!pendingSubmission) return;
  renderModalTasks();
  confirmModal.classList.remove('hidden');
  confirmModalVisible = true;
  syncModalLock();
}

function closeConfirmModal() {
  confirmModal.classList.add('hidden');
  confirmModalVisible = false;
  syncModalLock();
  pendingSubmission = null;
}

function syncFieldValue(taskIndex, key, value) {
  if (!pendingSubmission) return;
  pendingSubmission.payload.tasks[taskIndex][key] = value;
  const originalIndex = pendingSubmission.indices[taskIndex];
  if (typeof originalIndex === 'number') {
    tasksState[originalIndex][key] = value;
  }
}

function renderModalTasks() {
  modalTaskList.innerHTML = '';
  if (!pendingSubmission) return;
  pendingSubmission.payload.tasks.forEach((task, idx) => {
    const block = document.createElement('div');
    block.className = 'modal-task';

    const header = document.createElement('header');
    const title = document.createElement('h4');
    const updateHeader = () => {
      title.textContent = `任务 ${idx + 1} · ${task.title || '未命名'}`;
    };
    updateHeader();
    header.appendChild(title);
    block.appendChild(header);

    const titleField = document.createElement('input');
    titleField.value = task.title || '';
    titleField.placeholder = '任务标题';
    titleField.addEventListener('input', (event) => {
      syncFieldValue(idx, 'title', event.target.value);
      updateHeader();
    });
    titleField.classList.add('flex-input');

    const completedLabel = document.createElement('label');
    completedLabel.className = 'inline checkbox-inline';
    const completedCheckbox = document.createElement('input');
    completedCheckbox.type = 'checkbox';
    completedCheckbox.checked = Boolean(task.completed);
    completedCheckbox.addEventListener('change', (event) => {
      syncFieldValue(idx, 'completed', event.target.checked);
    });
    completedLabel.append(completedCheckbox, document.createTextNode('标记已完成'));

    const primaryRow = document.createElement('div');
    primaryRow.className = 'field-row';
    primaryRow.append(titleField, completedLabel);
    block.appendChild(primaryRow);

    const descLabel = document.createElement('label');
    descLabel.textContent = '详细说明';
    const descArea = document.createElement('textarea');
    descArea.rows = 3;
    descArea.value = task.description || '';
    descArea.addEventListener('input', (event) => {
      syncFieldValue(idx, 'description', event.target.value);
    });
    descLabel.appendChild(descArea);
    block.appendChild(descLabel);

    const row = document.createElement('div');
    row.className = 'meta-row task-meta-row';

    const projectLabel = document.createElement('label');
    projectLabel.className = 'project-field inline';
    projectLabel.textContent = '所属清单';
    const projectPicker = createProjectPicker(task, (value) => {
      syncFieldValue(idx, 'projectId', value);
    });
    projectLabel.appendChild(projectPicker);

    const priorityLabel = document.createElement('label');
    priorityLabel.className = 'inline priority-field';
    priorityLabel.textContent = '优先级';
    const priorityPicker = createPriorityPicker(
      task.priority,
      null,
      (value) => {
        syncFieldValue(idx, 'priority', value);
      }
    );
    priorityLabel.appendChild(priorityPicker);

    const scheduleLabel = document.createElement('label');
    scheduleLabel.className = 'inline schedule-field';
    scheduleLabel.textContent = '计划时间';
    const schedulePicker = createSchedulePicker(task, (updates) => {
      Object.assign(task, updates);
      Object.assign(pendingSubmission.payload.tasks[idx], updates);
    });
    scheduleLabel.appendChild(schedulePicker);

    row.append(projectLabel, priorityLabel, scheduleLabel);
    block.appendChild(row);

    modalTaskList.appendChild(block);
  });
}

async function submitPendingTasks(triggerBtn) {
  if (!pendingSubmission) return;
  const submitBtn = triggerBtn || modalConfirmBtn || (createForm ? createForm.querySelector('button[type=\"submit\"]') : null);
  if (submitBtn) {
    submitBtn.disabled = true;
  }
  setStatus(createStatus, '', false);
  showCreateProgress('正在提交到滴答清单...');
  try {
    const { response, data, rawText } = await requestJson('/api/dida/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pendingSubmission.payload),
    });
    if (!response.ok) {
      throw new Error(data?.error || stripHtmlSnippet(rawText) || '创建失败');
    }
    if (!data) {
      throw new Error(stripHtmlSnippet(rawText) || '创建接口返回为空，请重试');
    }
    setStatus(createStatus, '', false);
    (data.results || []).forEach((entry) => pushTaskToast(entry));
    if (data.auth?.sessionState === currentOauthState) {
      fetchOauthSession(currentOauthState, { silent: true });
      if (data.auth.refreshCount > 0) {
        setOauthStatus('检测到 401，已自动刷新 Access Token 并重试成功');
      }
    }
    closeConfirmModal();
  } catch (error) {
    setStatus(createStatus, '', false);
    pushTaskToast({ success: false, title: '提交失败', error: error.message });
  } finally {
    hideCreateProgress();
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
}

addTaskBtn.addEventListener('click', addEmptyTask);
generateBtn.addEventListener('click', handleAiGenerate);
tokenForm.addEventListener('submit', handleTokenExchange);
if (createForm) {
  createForm.addEventListener('submit', handleCreateTasks);
}
loadTimeConfig();
modalConfirmBtn.addEventListener('click', () => submitPendingTasks(modalConfirmBtn));
modalCancelBtn.addEventListener('click', closeConfirmModal);
modalCloseBtn.addEventListener('click', closeConfirmModal);
if (projectListBtn) {
  projectListBtn.addEventListener('click', showProjectsModal);
}
if (projectsModalClose) {
  projectsModalClose.addEventListener('click', hideProjectsModal);
}
if (projectsRefreshBtn) {
  projectsRefreshBtn.addEventListener('click', loadProjectsList);
}
if (submissionsBtn) {
  submissionsBtn.addEventListener('click', showSubmissionsModal);
}
if (submissionsModalClose) {
  submissionsModalClose.addEventListener('click', hideSubmissionsModal);
}
if (clearTasksBtn) {
  clearTasksBtn.addEventListener('click', clearAllTasks);
}

function syncModalLock() {
  if (confirmModalVisible || oauthModalVisible || aiModalVisible || projectsModalVisible) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }
}

function closeOauthPopup() {
  if (oauthPopup && !oauthPopup.closed) {
    oauthPopup.close();
  }
}

function showOauthModal(forceFocus = false) {
  if (!oauthModal) return;
  oauthModal.classList.remove('hidden');
  oauthModalVisible = true;
  syncModalLock();
  if (forceFocus && startOauthBtn) {
    startOauthBtn.focus();
  }
}

function hideOauthModal() {
  if (!oauthModal) return;
  oauthModal.classList.add('hidden');
  oauthModalVisible = false;
  syncModalLock();
}

function showAiModal() {
  if (!aiSettingsModal) return;
  aiSettingsModal.classList.remove('hidden');
  aiModalVisible = true;
  syncModalLock();
  if (openaiBaseUrlInput) {
    openaiBaseUrlInput.focus();
  }
}

function hideAiModal() {
  if (!aiSettingsModal) return;
  aiSettingsModal.classList.add('hidden');
  aiModalVisible = false;
  syncModalLock();
}

function showProjectsModal() {
  if (!projectsModal) return;
  projectsModal.classList.remove('hidden');
  projectsModalVisible = true;
  syncModalLock();
  loadProjectsList();
}

function hideProjectsModal() {
  if (!projectsModal) return;
  projectsModal.classList.add('hidden');
  projectsModalVisible = false;
  syncModalLock();
}

function renderSubmissions(entries = []) {
  if (!submissionsList) return 0;
  if (!entries.length) {
    submissionsList.innerHTML = '<p class="muted tiny">暂无提交记录。</p>';
    return 0;
  }
  submissionsList.innerHTML = '';
  entries
    .slice()
    .reverse()
    .forEach((item) => {
      const card = document.createElement('div');
      card.className = 'project-card';
      const title = document.createElement('h4');
      title.textContent = item.title || '未命名任务';
      const meta = document.createElement('div');
      meta.className = 'project-meta';
      const projectLabel = item.projectName || item.projectId || '未知';
      meta.textContent = `项目: ${projectLabel}`;
      const idRow = document.createElement('div');
      idRow.className = 'project-id';
      idRow.textContent = item.id || '无 ID';
      const timeRow = document.createElement('div');
      timeRow.className = 'project-meta';
      timeRow.textContent = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
      card.append(title, meta, idRow, timeRow);
      submissionsList.appendChild(card);
    });
  return entries.length;
}

async function loadSubmissions() {
  if (!submissionsStatus) return;
  submissionsStatus.textContent = '正在读取提交记录...';
  submissionsStatus.classList.remove('error');
  try {
    const { response, data, rawText } = await requestJson('/api/submissions');
    if (!response.ok) {
      throw new Error(data?.error || stripHtmlSnippet(rawText) || '无法获取提交记录');
    }
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const count = renderSubmissions(entries);
    submissionsStatus.textContent = count ? `共 ${count} 条记录` : '暂无提交记录。';
    submissionsStatus.classList.remove('error');
  } catch (error) {
    submissionsStatus.textContent = error.message;
    submissionsStatus.classList.add('error');
    submissionsList.innerHTML = '<p class="muted tiny">无法加载提交记录。</p>';
  }
}

function showSubmissionsModal() {
  if (!submissionsModal) return;
  submissionsModal.classList.remove('hidden');
  syncModalLock();
  loadSubmissions();
}

function hideSubmissionsModal() {
  if (!submissionsModal) return;
  submissionsModal.classList.add('hidden');
  syncModalLock();
}

async function loadProjectsList() {
  if (!projectsStatus) return;
  projectsStatus.textContent = '正在获取清单列表...';
  projectsStatus.classList.remove('error');
  const payload = buildTokenPayload();
  if (!payload) {
    projectsStatus.textContent = '请先完成授权或填写 Access Token';
    projectsStatus.classList.add('error');
    projectsList.innerHTML = '<p class="muted tiny">暂无可展示的清单。</p>';
    return;
  }
    try {
      const { response, data, rawText } = await requestJson('/api/dida/projects/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(data?.error || stripHtmlSnippet(rawText) || '获取清单失败');
    }
    const projects = Array.isArray(data.projects) ? data.projects : [];
    setAvailableProjects(projects);
    const visibleCount = renderProjectsList(projects);
    projectsStatus.textContent = visibleCount > 0 ? `共 ${visibleCount} 个清单` : '暂无清单';
    projectsStatus.classList.remove('error');
  } catch (error) {
    projectsStatus.textContent = error.message;
    projectsStatus.classList.add('error');
    projectsList.innerHTML = '<p class="muted tiny">无法加载清单列表。</p>';
  }
}

function buildTokenPayload() {
  const payload = {};
  const directToken = readAccessToken();
  if (currentOauthState) {
    payload.oauthState = currentOauthState;
  } else if (directToken) {
    payload.accessToken = directToken;
  } else {
    return null;
  }
  return payload;
}

function renderProjectsList(projects = []) {
  if (!projectsList) return;
  const visibleProjects = filterOpenProjects(projects);
  if (!visibleProjects.length) {
    projectsList.innerHTML = '<p class="muted tiny">暂无清单，请确认授权是否有效。</p>';
    return 0;
  }
  projectsList.innerHTML = '';
  visibleProjects.forEach((project) => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.addEventListener('click', () => copyProjectId(project.id));

    const titleRow = document.createElement('div');
    titleRow.className = 'project-title-row';

    const title = document.createElement('h4');
    title.textContent = project.name || '未命名清单';
    titleRow.appendChild(title);

    // 只有当 groupId 存在且不是 "NONE" 时才显示
    if (project.groupId && project.groupId.toUpperCase() !== 'NONE') {
      const group = document.createElement('span');
      group.className = 'project-group-inline';
      group.textContent = project.groupId;
      titleRow.appendChild(group);
    }

    card.appendChild(titleRow);

    const idRow = document.createElement('div');
    idRow.className = 'project-id';
    idRow.textContent = project.id || '未知 ID';
    card.appendChild(idRow);

    applyProjectColor(card, project.color);

    projectsList.appendChild(card);
  });
  return visibleProjects.length;
}

async function copyProjectId(projectId) {
  if (!projectId) return;
  try {
    await navigator.clipboard.writeText(projectId);
    projectsStatus.textContent = `已复制 ProjectId: ${projectId}`;
    projectsStatus.classList.remove('error');
  } catch (error) {
    projectsStatus.textContent = '复制失败，请手动选中复制';
    projectsStatus.classList.add('error');
  }
}

async function fetchProjectsForAi() {
  const payload = buildTokenPayload();
  if (!payload) {
    return [];
  }
  try {
    const { response, data, rawText } = await requestJson('/api/dida/projects/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(data?.error || stripHtmlSnippet(rawText) || '获取清单列表失败');
    }
    const projects = Array.isArray(data.projects) ? data.projects : [];
    setAvailableProjects(projects);
    return availableProjects;
  } catch (error) {
    console.warn('Fetch projects for AI failed:', error.message);
    return [];
  }
}

function normalizeProjectColor(color) {
  if (typeof color !== 'string') return null;
  let value = color.trim();
  if (/^[0-9a-f]{6}$/i.test(value)) {
    value = `#${value}`;
  }
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return value.toUpperCase();
  }
  return null;
}

function hexToRgb(hex) {
  const normalized = normalizeProjectColor(hex);
  if (!normalized) return null;
  const intVal = parseInt(normalized.slice(1), 16);
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
}

function applyProjectColor(card, color) {
  const normalized = normalizeProjectColor(color);
  if (!normalized) return;
  const rgb = hexToRgb(normalized);
  card.style.borderColor = normalized;
  if (rgb) {
    card.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
    card.style.boxShadow = `0 8px 20px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`;
  }
  const idRow = card.querySelector('.project-id');
  if (idRow && rgb) {
    idRow.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
    idRow.style.color = normalized;
  }
  const title = card.querySelector('h4');
  if (title) {
    title.style.color = normalized;
  }
}

async function ensureInitialOauthPrompt() {
  if (oauthInitialized) return;
  oauthInitialized = true;
  if (currentOauthState || readAccessToken()) {
    const ok = await validateAuthorization({ silent: true, showModalOnFail: true });
    if (ok) {
      return;
    }
  }
  updateOauthIndicator('error', '尚未授权');
  showOauthModal(true);
}

if (startOauthBtn) {
  startOauthBtn.addEventListener('click', () => startOauthFlow(false));
}
if (checkOauthBtn) {
  checkOauthBtn.addEventListener('click', checkOauthSession);
}
if (oauthStatusBtn) {
  oauthStatusBtn.addEventListener('click', () => {
    showOauthModal();
  });
}
if (oauthModalClose) {
  oauthModalClose.addEventListener('click', hideOauthModal);
}
if (aiStatusBtn) {
  aiStatusBtn.addEventListener('click', () => {
    showAiModal();
  });
}
if (aiModalClose) {
  aiModalClose.addEventListener('click', hideAiModal);
}
window.addEventListener('message', handleOauthMessage);

updateAiIndicator('success', '默认使用服务端配置');
updateOauthIndicator(currentOauthState ? 'pending' : 'error', currentOauthState ? '正在检测授权状态' : '尚未授权');
ensureInitialOauthPrompt();
renderTasks();

// Initialize locale picker
if (localePicker) {
  const trigger = localePicker.querySelector('.locale-picker-trigger');
  const menu = localePicker.querySelector('.locale-picker-menu');
  const text = localePicker.querySelector('.locale-picker-text');
  const options = localePicker.querySelectorAll('.locale-option');

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    localePicker.classList.toggle('open');
  });

  options.forEach((option) => {
    option.addEventListener('click', (event) => {
      event.stopPropagation();
      const value = option.getAttribute('data-value');
      const label = option.textContent;
      currentLocale = value;
      text.textContent = label;
      localePicker.classList.remove('open');
    });
  });
}
