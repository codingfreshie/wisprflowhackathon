// Dynamic API Base URL resolution:
// If running in Chrome extension popup or standalone, default to http://localhost:5000
const getApiBase = () => {
  const saved = localStorage.getItem('meeting_sync_api_url');
  if (saved) return saved;
  if (window.location.protocol === 'chrome-extension:') {
    return 'http://localhost:5000/api';
  }
  return '/api';
};

export const API_BASE = getApiBase();

export async function checkServerHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // If relative fetch failed, try direct localhost:5000
    try {
      const fallback = await fetch('http://localhost:5000/api/health');
      if (fallback.ok) return await fallback.json();
    } catch (e) {
      // ignore
    }
    return {
      status: 'offline',
      service: 'Backend Offline (Start node server/src/server.js)',
      llmProvider: 'Unavailable',
      persistentMemory: { totalStoredMeetings: 0, activeDecisions: 0, activeConflicts: 0, syncedStats: { totalPushed: 0 } }
    };
  }
}

export async function extractMeetingIntelligence(transcript, meetingTitle) {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/extract` : (window.location.protocol === 'chrome-extension:' ? 'http://localhost:5000/api/extract' : '/api/extract');
  const res = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, meetingTitle })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Extraction failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return await res.json();
}

export async function saveMeetingToMemory(meetingData) {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/meetings/save` : (window.location.protocol === 'chrome-extension:' ? 'http://localhost:5000/api/meetings/save' : '/api/meetings/save');
  const res = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meetingData)
  });
  return await res.json();
}

export async function getMeetingsMemory() {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/meetings` : (window.location.protocol === 'chrome-extension:' ? 'http://localhost:5000/api/meetings' : '/api/meetings');
  const res = await fetch(target);
  return await res.json();
}

export async function deleteMeetingFromMemory(id) {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/meetings/${id}` : (window.location.protocol === 'chrome-extension:' ? `http://localhost:5000/api/meetings/${id}` : `/api/meetings/${id}`);
  const res = await fetch(target, { method: 'DELETE' });
  return await res.json();
}

export async function resetMemoryDemo() {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/meetings/reset-demo` : (window.location.protocol === 'chrome-extension:' ? 'http://localhost:5000/api/meetings/reset-demo' : '/api/meetings/reset-demo');
  const res = await fetch(target, { method: 'POST' });
  return await res.json();
}

export async function getConflicts() {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/conflicts` : (window.location.protocol === 'chrome-extension:' ? 'http://localhost:5000/api/conflicts' : '/api/conflicts');
  const res = await fetch(target);
  return await res.json();
}

export async function resolveConflict(conflictId, strategy, notes = '') {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/conflicts/resolve` : (window.location.protocol === 'chrome-extension:' ? 'http://localhost:5000/api/conflicts/resolve' : '/api/conflicts/resolve');
  const res = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conflictId, strategy, notes })
  });
  return await res.json();
}

export async function pushTasksToTracker(tasks, tracker, meetingTitle) {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/push-tasks` : (window.location.protocol === 'chrome-extension:' ? 'http://localhost:5000/api/push-tasks' : '/api/push-tasks');
  const res = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks, tracker, meetingTitle })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Push failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return await res.json();
}

export async function getWeeklyDigest() {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/weekly-digest` : (window.location.protocol === 'chrome-extension:' ? 'http://localhost:5000/api/weekly-digest' : '/api/weekly-digest');
  const res = await fetch(target);
  return await res.json();
}

export async function generateReminders(tasks) {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/reminders/generate` : (window.location.protocol === 'chrome-extension:' ? 'http://localhost:5000/api/reminders/generate' : '/api/reminders/generate');
  const res = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks })
  });
  return await res.json();
}

export async function exportReport(exportPayload) {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/export` : (window.location.protocol === 'chrome-extension:' ? 'http://localhost:5000/api/export' : '/api/export');
  const res = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(exportPayload)
  });
  return await res.json();
}

export async function fetchLatestWisprNotetaker() {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/wispr/latest` : (window.location.protocol === 'chrome-extension:' ? 'http://localhost:5000/api/wispr/latest' : '/api/wispr/latest');
  const res = await fetch(target);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function importWisprNotetakerFile(rawText, filename) {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/wispr/import` : (window.location.protocol === 'chrome-extension:' ? 'http://localhost:5000/api/wispr/import' : '/api/wispr/import');
  const res = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText, filename })
  });
  return await res.json();
}

export async function fetchDirectDesktopSync(mode = 'notetaker_only') {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/wispr/desktop-sync?mode=${mode}` : (window.location.protocol === 'chrome-extension:' ? `http://localhost:5000/api/wispr/desktop-sync?mode=${mode}` : `/api/wispr/desktop-sync?mode=${mode}`);
  const res = await fetch(target);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function fetchDesktopHistory(limit = 10) {
  const target = API_BASE.startsWith('http') ? `${API_BASE}/wispr/desktop-history?limit=${limit}` : (window.location.protocol === 'chrome-extension:' ? `http://localhost:5000/api/wispr/desktop-history?limit=${limit}` : `/api/wispr/desktop-history?limit=${limit}`);
  const res = await fetch(target);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
