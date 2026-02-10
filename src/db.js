const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'didauto.db');
const SUBMISSION_JSON_PATH = path.join(DATA_DIR, 'submissions.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    project_id TEXT NOT NULL DEFAULT '',
    project_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    original_content TEXT,
    ai_polished_content TEXT,
    latest_synced_content TEXT,
    priority INTEGER DEFAULT 0,
    status INTEGER DEFAULT 0,
    completed_time TEXT,
    due_date TEXT,
    start_date TEXT,
    is_all_day INTEGER DEFAULT 0,
    last_synced_at TEXT,
    sync_error TEXT,
    request_payload TEXT
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_sync_at TEXT,
    last_sync_status TEXT,
    tasks_synced INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0
  );

  INSERT OR IGNORE INTO sync_state (id) VALUES (1);

  CREATE TABLE IF NOT EXISTS project_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    content TEXT,
    description TEXT,
    start_date TEXT,
    due_date TEXT,
    is_all_day INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    status INTEGER DEFAULT 0,
    completed_time TEXT,
    items TEXT,
    raw_json TEXT,
    fetched_at TEXT
  );
`);

// --- CRUD helpers ---

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO submissions
    (id, title, project_id, project_name, created_at, original_content, ai_polished_content,
     latest_synced_content, priority, status, completed_time, due_date, start_date,
     is_all_day, last_synced_at, sync_error, request_payload)
  VALUES
    (@id, @title, @project_id, @project_name, @created_at, @original_content, @ai_polished_content,
     @latest_synced_content, @priority, @status, @completed_time, @due_date, @start_date,
     @is_all_day, @last_synced_at, @sync_error, @request_payload)
`);

function insertSubmission({
  id,
  title = '',
  projectId = '',
  projectName = '',
  createdAt = '',
  originalContent = null,
  aiPolishedContent = null,
  latestSyncedContent = null,
  priority = 0,
  status = 0,
  completedTime = null,
  dueDate = null,
  startDate = null,
  isAllDay = false,
  lastSyncedAt = null,
  syncError = null,
  requestPayload = null,
}) {
  insertStmt.run({
    id,
    title,
    project_id: projectId,
    project_name: projectName,
    created_at: createdAt,
    original_content: originalContent,
    ai_polished_content: aiPolishedContent,
    latest_synced_content: latestSyncedContent,
    priority: typeof priority === 'number' ? priority : 0,
    status: typeof status === 'number' ? status : 0,
    completed_time: completedTime || null,
    due_date: dueDate || null,
    start_date: startDate || null,
    is_all_day: isAllDay ? 1 : 0,
    last_synced_at: lastSyncedAt || null,
    sync_error: syncError || null,
    request_payload: requestPayload || null,
  });
}

function getSubmissions(range) {
  if (!range || range === 'all') {
    return db
      .prepare('SELECT * FROM submissions ORDER BY created_at DESC')
      .all()
      .map(rowToEntry);
  }
  const days = { '1d': 1, '3d': 3, '7d': 7, '30d': 30 }[range];
  if (!days) {
    return db
      .prepare('SELECT * FROM submissions ORDER BY created_at DESC')
      .all()
      .map(rowToEntry);
  }
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  return db
    .prepare('SELECT * FROM submissions WHERE created_at >= ? ORDER BY created_at DESC')
    .all(cutoff)
    .map(rowToEntry);
}

function getAllTrackableSubmissions() {
  return db
    .prepare('SELECT * FROM submissions WHERE id IS NOT NULL AND project_id IS NOT NULL AND project_id != \'\'')
    .all()
    .map(rowToEntry);
}

function updateSyncedContent(id, { latestSyncedContent, priority, status, completedTime, dueDate, startDate, isAllDay, syncError }) {
  db.prepare(`
    UPDATE submissions SET
      latest_synced_content = @latest_synced_content,
      priority = @priority,
      status = @status,
      completed_time = @completed_time,
      due_date = @due_date,
      start_date = @start_date,
      is_all_day = @is_all_day,
      last_synced_at = @last_synced_at,
      sync_error = @sync_error
    WHERE id = @id
  `).run({
    id,
    latest_synced_content: latestSyncedContent || null,
    priority: typeof priority === 'number' ? priority : 0,
    status: typeof status === 'number' ? status : 0,
    completed_time: completedTime || null,
    due_date: dueDate || null,
    start_date: startDate || null,
    is_all_day: isAllDay ? 1 : 0,
    last_synced_at: new Date().toISOString(),
    sync_error: syncError || null,
  });
}

function getSyncState() {
  const row = db.prepare('SELECT * FROM sync_state WHERE id = 1').get();
  if (!row) return { lastSyncAt: null, lastSyncStatus: null, tasksSynced: 0, tasksFailed: 0 };
  return {
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status,
    tasksSynced: row.tasks_synced,
    tasksFailed: row.tasks_failed,
  };
}

function updateSyncState({ lastSyncAt, lastSyncStatus, tasksSynced, tasksFailed }) {
  db.prepare(`
    UPDATE sync_state SET
      last_sync_at = @last_sync_at,
      last_sync_status = @last_sync_status,
      tasks_synced = @tasks_synced,
      tasks_failed = @tasks_failed
    WHERE id = 1
  `).run({
    last_sync_at: lastSyncAt || new Date().toISOString(),
    last_sync_status: lastSyncStatus || 'unknown',
    tasks_synced: tasksSynced || 0,
    tasks_failed: tasksFailed || 0,
  });
}

// --- row -> API entry ---

function rowToEntry(row) {
  return {
    id: row.id,
    title: row.title,
    projectId: row.project_id,
    projectName: row.project_name,
    createdAt: row.created_at,
    originalContent: row.original_content || null,
    aiPolishedContent: row.ai_polished_content || null,
    latestSyncedContent: row.latest_synced_content || null,
    priority: row.priority,
    status: row.status,
    completedTime: row.completed_time || null,
    dueDate: row.due_date || null,
    startDate: row.start_date || null,
    isAllDay: Boolean(row.is_all_day),
    lastSyncedAt: row.last_synced_at || null,
    syncError: row.sync_error || null,
    requestPayload: row.request_payload || null,
  };
}

// --- Migration from submissions.json ---

function migrateFromJson() {
  if (!fs.existsSync(SUBMISSION_JSON_PATH)) return;
  const existingCount = db.prepare('SELECT COUNT(*) as cnt FROM submissions').get().cnt;
  if (existingCount > 0) {
    // Already have data, skip migration but rename old file
    const migratedPath = SUBMISSION_JSON_PATH + '.migrated';
    if (!fs.existsSync(migratedPath)) {
      fs.renameSync(SUBMISSION_JSON_PATH, migratedPath);
      console.log(`[db] submissions.json already migrated (db has ${existingCount} rows), renamed to .migrated`);
    }
    return;
  }

  let entries;
  try {
    const raw = fs.readFileSync(SUBMISSION_JSON_PATH, 'utf8');
    entries = JSON.parse(raw);
    if (!Array.isArray(entries)) entries = [];
  } catch (err) {
    console.error('[db] Failed to parse submissions.json for migration:', err.message);
    return;
  }

  const insertMany = db.transaction((items) => {
    for (const entry of items) {
      if (!entry.id) continue;
      const response = entry.response || {};
      insertSubmission({
        id: entry.id,
        title: entry.title || response.title || '',
        projectId: entry.projectId || response.projectId || '',
        projectName: entry.projectName || '',
        createdAt: entry.createdAt || '',
        originalContent: null, // not available in old format
        aiPolishedContent: entry.inputTask ? JSON.stringify(entry.inputTask) : null,
        latestSyncedContent: entry.response ? JSON.stringify(entry.response) : null,
        priority: response.priority ?? entry.priority ?? 0,
        status: response.status ?? 0,
        completedTime: response.completedTime || null,
        dueDate: response.dueDate || entry.dueDate || null,
        startDate: response.startDate || entry.startDate || null,
        isAllDay: response.isAllDay ?? entry.isAllDay ?? false,
        requestPayload: entry.request ? JSON.stringify(entry.request) : null,
      });
    }
  });

  insertMany(entries);
  console.log(`[db] Migrated ${entries.length} entries from submissions.json`);

  const migratedPath = SUBMISSION_JSON_PATH + '.migrated';
  fs.renameSync(SUBMISSION_JSON_PATH, migratedPath);
  console.log(`[db] Renamed submissions.json to submissions.json.migrated`);
}

migrateFromJson();

// --- project_tasks CRUD ---

const upsertProjectTaskStmt = db.prepare(`
  INSERT INTO project_tasks
    (id, project_id, title, content, description, start_date, due_date,
     is_all_day, priority, status, completed_time, items, raw_json, fetched_at)
  VALUES
    (@id, @project_id, @title, @content, @description, @start_date, @due_date,
     @is_all_day, @priority, @status, @completed_time, @items, @raw_json, @fetched_at)
  ON CONFLICT(id) DO UPDATE SET
    project_id = excluded.project_id,
    title = excluded.title,
    content = excluded.content,
    description = excluded.description,
    start_date = excluded.start_date,
    due_date = excluded.due_date,
    is_all_day = excluded.is_all_day,
    priority = excluded.priority,
    status = CASE
      WHEN project_tasks.status = 2 AND excluded.status = 0 THEN project_tasks.status
      ELSE excluded.status
    END,
    completed_time = CASE
      WHEN project_tasks.status = 2 AND excluded.status = 0 THEN project_tasks.completed_time
      ELSE excluded.completed_time
    END,
    items = excluded.items,
    raw_json = excluded.raw_json,
    fetched_at = excluded.fetched_at
`);

function upsertProjectTask(task) {
  const now = new Date().toISOString();
  upsertProjectTaskStmt.run({
    id: task.id,
    project_id: task.projectId || '',
    title: task.title || '',
    content: task.content || null,
    description: task.desc || task.description || null,
    start_date: task.startDate || null,
    due_date: task.dueDate || null,
    is_all_day: task.isAllDay ? 1 : 0,
    priority: typeof task.priority === 'number' ? task.priority : 0,
    status: typeof task.status === 'number' ? task.status : 0,
    completed_time: task.completedTime || null,
    items: task.items ? JSON.stringify(task.items) : null,
    raw_json: JSON.stringify(task),
    fetched_at: now,
  });
}

const upsertProjectTasksBatch = db.transaction((projectId, tasks) => {
  for (const task of tasks) {
    upsertProjectTask({ ...task, projectId: task.projectId || projectId });
  }
});

function upsertProjectTasks(projectId, tasks) {
  upsertProjectTasksBatch(projectId, tasks);
}

function getProjectTasks(projectId) {
  return db
    .prepare('SELECT * FROM project_tasks WHERE project_id = ? ORDER BY due_date ASC')
    .all(projectId)
    .map(projectTaskRowToObj);
}

function projectTaskRowToObj(row) {
  let items = null;
  try { items = row.items ? JSON.parse(row.items) : null; } catch (_) { items = null; }
  return {
    id: row.id,
    title: row.title,
    content: row.content || null,
    desc: row.description || null,
    projectId: row.project_id,
    startDate: row.start_date || null,
    dueDate: row.due_date || null,
    isAllDay: Boolean(row.is_all_day),
    priority: row.priority,
    status: row.status,
    completedTime: row.completed_time || null,
    items: items,
  };
}

function getSubmissionsByProject(projectId) {
  return db
    .prepare('SELECT * FROM submissions WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId)
    .map(rowToEntry);
}

function deleteProjectTask(taskId) {
  db.prepare('DELETE FROM project_tasks WHERE id = ?').run(taskId);
}

function updateProjectTaskStatus(taskId, { status, completedTime }) {
  db.prepare('UPDATE project_tasks SET status = ?, completed_time = ? WHERE id = ?')
    .run(status, completedTime || null, taskId);
}

module.exports = {
  db,
  insertSubmission,
  getSubmissions,
  getAllTrackableSubmissions,
  updateSyncedContent,
  getSyncState,
  updateSyncState,
  upsertProjectTask,
  upsertProjectTasks,
  getProjectTasks,
  getSubmissionsByProject,
  deleteProjectTask,
  updateProjectTaskStatus,
};
