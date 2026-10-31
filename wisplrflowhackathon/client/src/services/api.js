// Dynamic API Base URL resolution:
//  - Chrome extension popup / full tab -> talk straight to the local backend
//  - Served by the backend (localhost:5000) or Vite dev proxy (5173) -> relative /api
const IS_EXTENSION = window.location.protocol === 'chrome-extension:';
const DIRECT_BASE = 'http://localhost:5000/api';

const getApiBase = () => {
  try {
    const saved = localStorage.getItem('meeting_sync_api_url');
    if (saved) return saved;
  } catch (e) {
    // localStorage can be unavailable in some extension contexts
  }
  return IS_EXTENSION ? DIRECT_BASE : '/api';
};

export const API_BASE = getApiBase();

// One place for all HTTP calls: JSON in/out, real error messages, and an automatic
// fallback to http://localhost:5000/api when the relative /api path is unreachable
// (e.g. dist/index.html opened from disk).
async function request(path, { method = 'GET', body } = {}) {
  const init = {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  };

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch (networkErr) {
    if (API_BASE !== DIRECT_BASE) {
      res = await fetch(`${DIRECT_BASE}${path}`, init);
    } else {
      throw new Error('Backend unreachable. Start it with "npm start" in the server/ folder.');
    }
  }

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // non-JSON body
  }

  if (!res.ok) {
    throw new Error(data?.details || data?.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function checkServerHealth() {
  try {
    return await request('/health');
  } catch (err) {
    return {
      status: 'offline',
      service: 'Backend Offline (Start node server/src/server.js)',
      llmProvider: 'Unavailable',
      persistentMemory: { totalStoredMeetings: 0, activeDecisions: 0, activeConflicts: 0, syncedStats: { totalPushed: 0 } }
    };
  }
}

// ---- Extraction & memory vault ----
export const extractMeetingIntelligence = (transcript, meetingTitle) =>
  request('/extract', { method: 'POST', body: { transcript, meetingTitle } });

export const saveMeetingToMemory = (meetingData) =>
  request('/meetings/save', { method: 'POST', body: meetingData });

export const saveMeetingTasks = (meetingId, tasks) =>
  request(`/meetings/${encodeURIComponent(meetingId)}/tasks`, { method: 'PUT', body: { tasks } });

export const getMeetingsMemory = () => request('/meetings');

export const getMeetingById = (id) => request(`/meetings/${encodeURIComponent(id)}`);

export const deleteMeetingFromMemory = (id) =>
  request(`/meetings/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const resetMemoryDemo = () => request('/meetings/reset-demo', { method: 'POST' });

// ---- Conflicts ----
export const getConflicts = () => request('/conflicts');

export const resolveConflict = (conflictId, strategy, notes = '') =>
  request('/conflicts/resolve', { method: 'POST', body: { conflictId, strategy, notes } });

// ---- Review & push ----
export const pushTasksToTracker = (tasks, tracker, meetingTitle) =>
  request('/push-tasks', { method: 'POST', body: { tasks, tracker, meetingTitle } });

// ---- Digest, reminders, export ----
export const getWeeklyDigest = () => request('/weekly-digest');

export const getEfficiencyReport = () => request('/efficiency-report');

export const getWeeklyReport = () => request('/weekly-report');

export const generateReminders = (tasks) =>
  request('/reminders/generate', { method: 'POST', body: { tasks } });

export const exportReport = (exportPayload) =>
  request('/export', { method: 'POST', body: exportPayload });

// ---- Wispr ----
export const fetchLatestWisprNotetaker = () => request('/wispr/latest');

export const importWisprNotetakerFile = (rawText, filename) =>
  request('/wispr/import', { method: 'POST', body: { rawText, filename } });

export const fetchDirectDesktopSync = (mode = 'notetaker_only') =>
  request(`/wispr/desktop-sync?mode=${encodeURIComponent(mode)}`);

export const fetchDesktopHistory = (limit = 10) =>
  request(`/wispr/desktop-history?limit=${encodeURIComponent(limit)}`);
