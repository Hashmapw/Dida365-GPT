const axios = require('axios');
const { getAllTrackableSubmissions, updateSyncedContent, updateSyncState, upsertProjectTask } = require('./db');

let isSyncing = false;
let periodicTimer = null;

const SYNC_DELAY_MS = 500;
const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function performSync(getTokenForSession) {
  if (isSyncing) {
    console.log('[sync] Sync already in progress, skipping');
    return { skipped: true };
  }
  isSyncing = true;

  const submissions = getAllTrackableSubmissions();
  if (!submissions.length) {
    isSyncing = false;
    updateSyncState({
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: 'ok',
      tasksSynced: 0,
      tasksFailed: 0,
    });
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;
  let rateLimited = false;

  try {
    for (const entry of submissions) {
      if (rateLimited) break;
      if (!entry.projectId || !entry.id) {
        failed++;
        continue;
      }

      let token;
      try {
        token = await getTokenForSession();
      } catch (err) {
        console.error('[sync] Failed to get token:', err.message);
        failed++;
        break;
      }

      try {
        const response = await axios.get(
          `https://api.dida365.com/open/v1/project/${encodeURIComponent(entry.projectId)}/task/${encodeURIComponent(entry.id)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        const task = response.data;
        updateSyncedContent(entry.id, {
          latestSyncedContent: JSON.stringify(task),
          priority: task.priority ?? 0,
          status: task.status ?? 0,
          completedTime: task.completedTime || null,
          dueDate: task.dueDate || null,
          startDate: task.startDate || null,
          isAllDay: task.isAllDay ?? false,
          syncError: null,
        });
        // Also update project_tasks for project list display
        upsertProjectTask({
          id: task.id || entry.id,
          projectId: task.projectId || entry.projectId,
          title: task.title || entry.title,
          content: task.content || '',
          desc: task.desc || task.description || '',
          startDate: task.startDate || null,
          dueDate: task.dueDate || null,
          isAllDay: task.isAllDay ?? false,
          priority: task.priority ?? 0,
          status: task.status ?? 0,
          completedTime: task.completedTime || null,
          items: task.items || null,
        });
        synced++;
      } catch (err) {
        const status = err.response?.status;
        const errMsg = err.response?.data?.errorMessage || err.response?.data || err.message;
        if (status === 429 || (typeof errMsg === 'string' && errMsg.includes('exceed_query_limit'))) {
          console.warn('[sync] Rate limited, stopping sync early');
          rateLimited = true;
          updateSyncedContent(entry.id, {
            latestSyncedContent: entry.latestSyncedContent,
            priority: entry.priority,
            status: entry.status,
            completedTime: entry.completedTime,
            dueDate: entry.dueDate,
            startDate: entry.startDate,
            isAllDay: entry.isAllDay,
            syncError: 'Rate limited',
          });
          failed++;
        } else if (status === 404) {
          // Task may have been deleted
          updateSyncedContent(entry.id, {
            latestSyncedContent: entry.latestSyncedContent,
            priority: entry.priority,
            status: entry.status,
            completedTime: entry.completedTime,
            dueDate: entry.dueDate,
            startDate: entry.startDate,
            isAllDay: entry.isAllDay,
            syncError: 'Task not found (404)',
          });
          failed++;
        } else {
          updateSyncedContent(entry.id, {
            latestSyncedContent: entry.latestSyncedContent,
            priority: entry.priority,
            status: entry.status,
            completedTime: entry.completedTime,
            dueDate: entry.dueDate,
            startDate: entry.startDate,
            isAllDay: entry.isAllDay,
            syncError: String(errMsg).slice(0, 200),
          });
          failed++;
        }
      }

      // Delay between API calls
      if (!rateLimited) {
        await new Promise((resolve) => setTimeout(resolve, SYNC_DELAY_MS));
      }
    }
  } finally {
    isSyncing = false;
  }

  const syncStatus = rateLimited ? 'rate_limited' : failed > 0 ? 'partial' : 'ok';
  updateSyncState({
    lastSyncAt: new Date().toISOString(),
    lastSyncStatus: syncStatus,
    tasksSynced: synced,
    tasksFailed: failed,
  });

  console.log(`[sync] Completed: ${synced} synced, ${failed} failed${rateLimited ? ' (rate limited)' : ''}`);
  return { synced, failed, rateLimited };
}

function startPeriodicSync(getTokenForSession) {
  if (periodicTimer) return;
  periodicTimer = setInterval(() => {
    performSync(getTokenForSession).catch((err) => {
      console.error('[sync] Periodic sync error:', err.message);
    });
  }, SYNC_INTERVAL_MS);
  console.log(`[sync] Periodic sync started (every ${SYNC_INTERVAL_MS / 60000} minutes)`);
}

function stopPeriodicSync() {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
}

function getSyncingStatus() {
  return isSyncing;
}

module.exports = {
  performSync,
  startPeriodicSync,
  stopPeriodicSync,
  getSyncingStatus,
};
