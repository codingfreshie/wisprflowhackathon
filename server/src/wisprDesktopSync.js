const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getWisprDbPath() {
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'AppData', 'Roaming');
  const candidate = path.join(appData, 'Wispr Flow', 'flow.sqlite');
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  return null;
}

function runSqliteQuery(dbPath, sql) {
  try {
    const escapedSql = sql.replace(/"/g, '""');
    const cmd = `sqlite3 "${dbPath}" ".mode json" "${escapedSql}"`;
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 3000 });
    if (!output || !output.trim()) return [];
    return JSON.parse(output.trim());
  } catch (err) {
    console.error('[WisprDesktopSync] SQLite query error:', err.message);
    return [];
  }
}

/**
 * STRICTLY extracts ONLY meeting notes collected from the Wispr Note-Taker (Meetings and Notes tables).
 * Ignores the 'History' table (which only contains casual search/typing dictation).
 */
function getLatestDesktopSync(mode = 'notetaker_only') {
  const dbPath = getWisprDbPath();
  if (!dbPath) {
    return {
      connected: false,
      error: "Wispr Flow desktop database (flow.sqlite) not found in AppData."
    };
  }

  // 1. Query the 'Meetings' table (Primary table for Wispr Note-Taker meeting recordings)
  const meetings = runSqliteQuery(
    dbPath,
    "SELECT id, title, notes, summary, participantNames, speakerMap, createdAt, recordedMs FROM Meetings WHERE isDeleted=0 ORDER BY createdAt DESC LIMIT 1;"
  );

  if (meetings && meetings.length > 0 && (meetings[0].notes || meetings[0].summary)) {
    const m = meetings[0];
    let attendees = [];
    try {
      attendees = m.participantNames ? (Array.isArray(m.participantNames) ? m.participantNames : JSON.parse(m.participantNames)) : ["Meeting Attendees"];
    } catch (e) {
      attendees = [m.participantNames || "Meeting Attendees"];
    }

    return {
      connected: true,
      hasMeetingNotes: true,
      type: "Wispr Note-Taker Meeting",
      id: m.id,
      title: m.title || "Wispr Meeting Note",
      transcript: m.notes || m.summary,
      summary: m.summary || null,
      rawVoice: m.summary || m.notes,
      timestamp: m.createdAt,
      participants: attendees,
      durationSec: m.recordedMs ? Math.round(m.recordedMs / 1000) : 0,
      source: "Wispr Desktop Note-Taker (Meetings Table)"
    };
  }

  // 2. Query the 'Notes' table (For saved meeting notes and action documents in Wispr)
  const notes = runSqliteQuery(
    dbPath,
    "SELECT id, title, content, contentPreview, createdAt, modifiedAt FROM Notes WHERE isDeleted=0 ORDER BY modifiedAt DESC LIMIT 1;"
  );

  if (notes && notes.length > 0 && notes[0].content) {
    const n = notes[0];
    return {
      connected: true,
      hasMeetingNotes: true,
      type: "Wispr Note-Taker Note",
      id: n.id,
      title: n.title || "Wispr Meeting Note",
      transcript: n.content,
      rawVoice: n.contentPreview || n.content,
      timestamp: n.modifiedAt || n.createdAt,
      participants: ["Meeting Attendees"],
      source: "Wispr Desktop Note-Taker (Notes Table)"
    };
  }

  // 3. If mode is strictly notetaker_only, do NOT fall back to search dictation in History!
  if (mode === 'notetaker_only') {
    return {
      connected: true,
      hasMeetingNotes: false,
      meetingCount: 0,
      type: "No Meeting Recorded",
      message: "Connected to Wispr Flow, but 0 meeting sessions were found in the Wispr Note-Taker ('Meetings' table).",
      guide: "To collect meeting notes: Start or join a meeting (Google Meet, Zoom) with the Wispr Note-taker active. Once the meeting ends, Wispr saves the structured meeting notes directly into 'Meetings'!",
      source: "Wispr Note-Taker (0 Meetings in DB)"
    };
  }

  // Optional fallback if user explicitly requests any dictation
  const history = runSqliteQuery(
    dbPath,
    "SELECT transcriptEntityId as id, formattedText as text, asrText as rawVoice, timestamp, numWords, duration, app FROM History WHERE status!='no_audio' ORDER BY timestamp DESC LIMIT 1;"
  );

  if (history && history.length > 0) {
    const h = history[0];
    return {
      connected: true,
      hasMeetingNotes: false,
      type: "Wispr Dictation (History)",
      id: h.id,
      title: `Wispr Dictation (${h.app || 'Search/App'})`,
      transcript: h.text || h.rawVoice || "",
      timestamp: h.timestamp,
      numWords: h.numWords,
      source: `Wispr History (${h.app})`
    };
  }

  return {
    connected: true,
    hasMeetingNotes: false,
    message: "Wispr Flow database is connected, but no meeting records exist."
  };
}

/**
 * Returns meeting sessions collected from Wispr Note-Taker
 */
function getDesktopMeetingsList() {
  const dbPath = getWisprDbPath();
  if (!dbPath) return [];

  const meetings = runSqliteQuery(
    dbPath,
    "SELECT id, title, notes, summary, participantNames, createdAt, recordedMs FROM Meetings WHERE isDeleted=0 ORDER BY createdAt DESC LIMIT 10;"
  );

  return (meetings || []).map(m => ({
    id: m.id,
    title: m.title || "Wispr Meeting",
    transcript: m.notes || m.summary || "",
    timestamp: m.createdAt,
    durationSec: m.recordedMs ? Math.round(m.recordedMs / 1000) : 0,
    source: "Wispr Note-Taker"
  }));
}

/**
 * Recent Wispr dictations (History table) so the UI "Desktop History" drawer works.
 */
function getDesktopHistory(limit = 10) {
  const dbPath = getWisprDbPath();
  if (!dbPath) return [];
  const n = Math.max(1, Math.min(parseInt(limit, 10) || 10, 50));

  const rows = runSqliteQuery(
    dbPath,
    `SELECT transcriptEntityId as id, formattedText as text, asrText as rawVoice, timestamp, numWords, duration, app FROM History WHERE status!='no_audio' ORDER BY timestamp DESC LIMIT ${n};`
  );

  return (rows || [])
    .map(h => ({
      id: h.id,
      title: `Wispr Dictation (${h.app || 'App'})`,
      transcript: h.text || h.rawVoice || '',
      timestamp: h.timestamp,
      numWords: h.numWords || String(h.text || h.rawVoice || '').split(/\s+/).filter(Boolean).length,
      duration: h.duration,
      app: h.app || 'Unknown app'
    }))
    .filter(h => h.transcript && h.transcript.trim().length > 0);
}

module.exports = {
  getWisprDbPath,
  getLatestDesktopSync,
  getDesktopMeetingsList,
  getDesktopHistory
};
