require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { extractMeetingIntelligence, resolveKeys } = require('./llmService');
const wisprDesktopSync = require('./wisprDesktopSync');
const linearService = require('./linearService');
const reports = require('./reports');

const app = express();
const PORT = process.env.PORT || 5000;
const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');

// Enable CORS for Chrome Extension origins (chrome-extension://*) and local dev frontend
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend from client/dist if available
if (fs.existsSync(clientDistPath)) {
  console.log(`[Server] Serving frontend build from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
}

// Health Check & System Status
app.get('/api/health', (req, res) => {
  const keys = resolveKeys();
  const geminiConfigured = Boolean(keys.geminiKey && keys.geminiKey !== 'YOUR_GEMINI_API_KEY');
  const openAiConfigured = Boolean(keys.openAiKey && keys.openAiKey !== 'YOUR_OPENAI_API_KEY');
  
  res.json({
    status: 'ok',
    version: '1.0.0',
    service: 'Meeting Sync Agent Secure Proxy',
    llmProvider: geminiConfigured ? 'Google Gemini (API Key Active)' : (openAiConfigured ? 'OpenAI GPT-4o (API Key Active)' : 'Wispr Flow Heuristic Engine (Ready - Add GEMINI_API_KEY for live LLM)'),
    linearConfigured: linearService.isLinearConfigured(),
    persistentMemory: {
      totalStoredMeetings: db.getAllMeetings().length,
      activeDecisions: db.getActiveDecisions().length,
      activeConflicts: db.getConflicts().filter(c => c.status === 'Active').length,
      syncedStats: db.getSyncedStats()
    }
  });
});

// AI Extraction Endpoint: Accepts transcript and returns decisions, tasks, conflicts, and efficiency score
app.post('/api/extract', async (req, res) => {
  try {
    const { transcript, meetingTitle = "Wispr Flow Spoken Sync", date = new Date().toISOString() } = req.body;

    if (!transcript || transcript.trim().length === 0) {
      return res.status(400).json({ error: "Transcript is required" });
    }

    console.log(`[POST /api/extract] Processing meeting: "${meetingTitle}" (${transcript.length} characters)`);

    // If this title was extracted before, we REPLACE that meeting instead of letting it contradict itself
    const existingId = db.findMeetingIdByTitle(meetingTitle);
    const intelligence = await extractMeetingIntelligence(transcript, meetingTitle, { excludeMeetingId: existingId });

    // Decisions that contradict locked memory are held as "Pending Review" until the conflict is resolved.
    const conflictList = intelligence.conflicts || [];
    const pendingIds = new Set(conflictList.flatMap(c => c.newDecisionIds || []));
    const decisions = (intelligence.decisions || []).map(d =>
      pendingIds.has(d.id) ? { ...d, status: 'Pending Review' } : d
    );

    const saved = db.saveMeeting({
      id: existingId,
      title: meetingTitle,
      date,
      source: 'Wispr Flow Voice Ingestion',
      efficiencyScore: intelligence.efficiency?.score,
      efficiency: intelligence.efficiency,
      decisions,
      actionItems: intelligence.actionItems,
      conflicts: conflictList
    });

    const persistedConflicts = db.replaceMeetingConflicts(saved.id, saved.title, conflictList);

    res.json({
      success: true,
      meetingTitle,
      date,
      meetingId: saved.id,
      savedToMemory: true,
      ...intelligence,
      decisions,
      conflicts: persistedConflicts
    });
  } catch (error) {
    console.error('[POST /api/extract] Error:', error);
    res.status(500).json({
      error: "Failed to extract meeting intelligence",
      details: error.message
    });
  }
});

// Meetings Memory Store Endpoints
app.get('/api/meetings', (req, res) => {
  res.json(db.getAllMeetings());
});

app.get('/api/meetings/:id', (req, res) => {
  const meeting = db.getMeeting(req.params.id);
  if (!meeting) {
    return res.status(404).json({ error: "Meeting not found" });
  }
  res.json(meeting);
});

app.post('/api/meetings/save', (req, res) => {
  try {
    const meetingData = req.body;
    if (!meetingData.title) {
      return res.status(400).json({ error: "Meeting title is required" });
    }

    // Never let a stale client copy overwrite decision statuses decided by conflict resolution
    const existing = meetingData.id ? db.getMeeting(meetingData.id) : null;
    if (existing) {
      const serverById = new Map((existing.decisions || []).map(d => [d.id, d]));
      meetingData.decisions = (meetingData.decisions || []).map(d =>
        serverById.has(d.id) ? { ...d, status: serverById.get(d.id).status } : d
      );
    }

    if (existing && !meetingData.efficiency && existing.efficiency) meetingData.efficiency = existing.efficiency;
    if (existing && !meetingData.stats && existing.stats) meetingData.stats = existing.stats;

    const saved = db.saveMeeting(meetingData);

    // Persist any detected conflicts (idempotent by conflict id)
    if (meetingData.conflicts && Array.isArray(meetingData.conflicts)) {
      meetingData.conflicts.forEach(c => {
        db.addConflict({
          ...c,
          meetingId: saved.id,
          meetingTitle: saved.title
        });
      });
    }

    res.json({ success: true, meeting: saved });
  } catch (error) {
    res.status(500).json({ error: "Failed to save meeting", details: error.message });
  }
});

// Persist inline edits (title / owner / deadline / priority) made in Review & Push
app.put('/api/meetings/:id/tasks', (req, res) => {
  const { tasks } = req.body;
  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: "tasks array is required" });
  }
  const meeting = db.updateMeetingTasks(req.params.id, tasks);
  if (!meeting) {
    return res.status(404).json({ error: "Meeting not found" });
  }
  res.json({ success: true, meeting });
});

app.delete('/api/meetings/:id', (req, res) => {
  db.deleteMeeting(req.params.id);
  res.json({ success: true, message: "Meeting removed from memory" });
});

app.post('/api/meetings/reset-demo', (req, res) => {
  const freshData = db.resetToSeed();
  res.json({ success: true, message: "Meeting memory reset to initial hackathon seed", data: freshData });
});

// Conflict Management Endpoints
app.get('/api/conflicts', (req, res) => {
  res.json(db.getConflicts());
});

app.post('/api/conflicts/resolve', (req, res) => {
  const { conflictId, strategy, notes } = req.body;
  const allowed = ['overwrite', 'keep_original', 'manual_flag'];
  if (!conflictId || !strategy || !allowed.includes(strategy)) {
    return res.status(400).json({ error: "conflictId and strategy ('overwrite', 'keep_original', 'manual_flag') are required" });
  }

  const resolved = db.resolveConflict(conflictId, strategy, notes);
  if (!resolved) {
    return res.status(404).json({ error: "Conflict not found" });
  }

  // Return the updated meeting so the UI can refresh decision statuses immediately
  res.json({ success: true, conflict: resolved, meeting: db.getMeeting(resolved.meetingId) || null });
});

// Review & Push to Task Trackers (Linear live API, plus simulated Jira/Asana/Notion)
app.post('/api/push-tasks', async (req, res) => {
  try {
    const { tasks, tracker = "Linear", meetingTitle = "Meeting Sync" } = req.body;
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: "No tasks provided to push" });
    }

    const alreadyPushed = db.getSyncedStats()[String(tracker).toLowerCase()] || 0;
    const result = await linearService.pushTasks({ tasks, tracker, meetingTitle, alreadyPushed });
    const stats = db.updateSyncedStats(tracker, result.pushedTasks.length);
    db.markTasksSynced(result.pushedTasks);

    const liveNote = result.live
      ? `Created ${result.pushedTasks.length} live Linear issues`
      : (result.reason || `Synced ${result.pushedTasks.length} items to ${tracker}`);

    res.json({
      success: true,
      live: Boolean(result.live),
      message: liveNote,
      tracker,
      pushedTasks: result.pushedTasks,
      syncedStats: stats
    });
  } catch (error) {
    res.status(500).json({ error: "Push execution failed", details: error.message });
  }
});

// Automated 24h Reminder Preview Generator (Slack / Email)
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function deadlineToDate(deadline) {
  // Deadlines are YYYY-MM-DD; reminders and "due" are anchored to 09:00 local time on that day
  const m = String(deadline || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 9, 0, 0);
}

app.post('/api/reminders/generate', (req, res) => {
  const { tasks } = req.body;
  const taskList = Array.isArray(tasks) && tasks.length > 0 ? tasks : db.getAllTasks();
  const now = new Date();
  const DAY = 24 * 60 * 60 * 1000;

  const reminders = taskList
    .filter(task => task && task.title)
    .map(task => {
      const ownerName = task.owner || "Team Member";
      const deadline = task.deadline || "TBD";
      const due = deadlineToDate(task.deadline);
      const sendAt = due ? new Date(due.getTime() - DAY) : null;
      const msUntilDue = due ? due.getTime() - now.getTime() : null;
      const daysUntil = due ? Math.ceil(msUntilDue / DAY) : null;

      let status = 'Scheduled';
      if (!due) status = 'No deadline';
      else if (msUntilDue < 0) status = 'Overdue';
      else if (sendAt <= now) status = 'Due within 24h';

      const trackerName = task.tracker || 'Linear';
      const trackerId = task.externalId || 'not pushed yet';
      const handle = ownerName.toLowerCase().replace(/[^a-z0-9]+/g, '');
      const safe = { title: escapeHtml(task.title), owner: escapeHtml(ownerName), deadline: escapeHtml(deadline), trackerId: escapeHtml(trackerId), priority: escapeHtml(task.priority || 'Medium'), tracker: escapeHtml(trackerName) };

      const slackText = `*Automated 24h Reminder from Meeting Sync Agent*\nHey @${handle}! Friendly heads-up: your action item *"${task.title}"* [${trackerId}] is due *${deadline}*.\n_Need blocker escalation? Reply to this thread or click to update status._`;

      const emailHtml = `
      <div style="font-family: sans-serif; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background:#ffffff; color:#0f172a;">
        <h3 style="color: #0f172a; margin-top: 0;">24-Hour Task Reminder: ${safe.title}</h3>
        <p>Hi ${safe.owner},</p>
        <p>This is an automated sync reminder from <strong>Meeting Sync Agent</strong> for your assigned deliverable:</p>
        <ul>
          <li><strong>Task:</strong> ${safe.title}</li>
          <li><strong>Deadline:</strong> ${safe.deadline}</li>
          <li><strong>Tracker ID:</strong> ${safe.trackerId}</li>
          <li><strong>Priority:</strong> ${safe.priority}</li>
        </ul>
        <p><span style="background: #2563eb; color: #ffffff; padding: 8px 16px; border-radius: 4px; display: inline-block;">Update Progress in ${safe.tracker}</span></p>
      </div>`;

      return {
        taskId: task.id,
        owner: ownerName,
        title: task.title,
        deadline,
        priority: task.priority || 'Medium',
        tracker: trackerName,
        externalId: task.externalId || null,
        externalUrl: task.externalUrl || null,
        channel: '#proj-launch',
        slackText,
        emailHtml,
        sendWindow: "24 hours before deadline",
        sendAt: sendAt ? sendAt.toISOString() : null,
        daysUntil,
        status
      };
    })
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));

  res.json({
    success: true,
    count: reminders.length,
    dueSoon: reminders.filter(r => r.status === 'Due within 24h').length,
    overdue: reminders.filter(r => r.status === 'Overdue').length,
    reminders
  });
});

// Weekly Digest: group action items by owner across all stored meetings (+ needs-attention list)
app.get('/api/weekly-digest', (req, res) => {
  res.json(reports.buildDigest());
});

// Cross-meeting efficiency scoreboard
app.get('/api/efficiency-report', (req, res) => {
  res.json(reports.buildEfficiencyReport());
});

// One-click weekly report (digest + efficiency + conflict log) as Markdown
app.get('/api/weekly-report', (req, res) => {
  res.json({ success: true, ...reports.buildWeeklyMarkdown() });
});

// Wispr Notetaker Endpoints: Fetch latest notetaker output or receive inbound webhook
app.get('/api/wispr/latest', (req, res) => {
  const session = db.getLatestWisprSession();
  res.json({
    success: true,
    session
  });
});

app.post('/api/wispr-webhook', (req, res) => {
  const { meetingTitle, transcript, participants, source, duration } = req.body;
  if (!transcript) {
    return res.status(400).json({ error: "Transcript is required" });
  }

  const updatedSession = db.setLatestWisprSession({
    id: `wispr-note-${Date.now()}`,
    title: meetingTitle || "Wispr Notetaker Session",
    date: new Date().toISOString(),
    source: source || "Wispr Notetaker Webhook",
    participants: participants || ["Priya", "Marcus", "Lena"],
    duration: duration || "24 mins",
    rawTranscript: transcript
  });

  res.json({
    success: true,
    message: "Wispr Notetaker transcript received successfully",
    session: updatedSession
  });
});

app.post('/api/wispr/import', (req, res) => {
  const { rawText, filename } = req.body;
  if (!rawText) {
    return res.status(400).json({ error: "rawText is required" });
  }

  const session = db.setLatestWisprSession({
    id: `wispr-import-${Date.now()}`,
    title: filename ? `Imported: ${filename.replace(/\.[^/.]+$/, "")}` : "Wispr Notetaker Import",
    date: new Date().toISOString(),
    source: "Wispr Notetaker File Import",
    participants: ["Extracted Attendees"],
    rawTranscript: rawText
  });

  res.json({
    success: true,
    session
  });
});

// Direct Real-Time Desktop Sync Endpoints (reads directly from C:\Users\...\AppData\Roaming\Wispr Flow\flow.sqlite)
app.get('/api/wispr/desktop-sync', (req, res) => {
  const mode = req.query.mode || 'notetaker_only';
  const syncResult = wisprDesktopSync.getLatestDesktopSync(mode);
  res.json({
    success: syncResult.connected,
    ...syncResult
  });
});

app.get('/api/wispr/desktop-meetings', (req, res) => {
  const meetings = wisprDesktopSync.getDesktopMeetingsList();
  res.json({
    success: true,
    count: meetings.length,
    meetings
  });
});

app.get('/api/wispr/desktop-history', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const history = wisprDesktopSync.getDesktopHistory(limit);
  res.json({
    success: true,
    count: history.length,
    history
  });
});

// Export Clean Markdown Summary (single meeting)
app.post('/api/export', (req, res) => {
  const { meeting, decisions, actionItems, conflicts, efficiency } = req.body;
  const score = typeof efficiency?.score === 'number' ? `${efficiency.score}/100` : 'n/a';

  let markdown = `# Meeting Sync Execution Report: ${meeting?.title || 'Team Spoken Sync'}\n`;
  markdown += `**Date:** ${meeting?.date || new Date().toLocaleDateString()} | **Source:** Wispr Flow Voice Ingestion\n`;
  markdown += `**Efficiency Score:** ${score}${efficiency?.grade ? ` (${efficiency.grade})` : ''} | **Action-to-Talk Ratio:** ${efficiency?.actionToTalkRatio || 'n/a'} | **Fillers filtered:** ${efficiency?.fillerWordCount ?? 0}\n\n`;

  markdown += `## 💡 Executive Efficiency Critique\n> ${efficiency?.critique || 'No critique available for this meeting.'}\n\n`;
  if (Array.isArray(efficiency?.breakdown) && efficiency.breakdown.length) {
    markdown += `**Score breakdown:** ${efficiency.breakdown.map(b => `${b.label} (${b.points > 0 ? '+' : ''}${b.points})`).join(' · ')}\n\n`;
  }

  markdown += `## 🎯 Key Decisions\n`;
  if (decisions && decisions.length > 0) {
    decisions.forEach((d, idx) => {
      markdown += `${idx + 1}. **${d.decision}** — _${d.status || 'Active'}_\n`;
      markdown += `   - *Category:* ${d.category || 'General'} | *Impact:* ${(d.impactedComponents || []).join(', ') || 'Core Platform'}\n`;
      if (d.context) markdown += `   - *Context:* ${d.context}\n`;
    });
  } else {
    markdown += `*No formal decisions logged.*\n`;
  }
  markdown += `\n`;

  markdown += `## 📋 Action Items & Ownership\n`;
  if (actionItems && actionItems.length > 0) {
    actionItems.forEach(t => {
      markdown += `- [${t.status === 'Synced' ? 'x' : ' '}] **${t.title}**\n`;
      markdown += `  - **Owner:** @${t.owner} | **Deadline:** ${t.deadline} | **Priority:** ${t.priority || 'Medium'} | **Tracker:** ${t.tracker || 'Linear'}${t.externalId ? ` (${t.externalId})` : ''}\n`;
    });
  } else {
    markdown += `*No action items logged.*\n`;
  }
  markdown += `\n`;

  if (conflicts && conflicts.length > 0) {
    markdown += `## ⚠️ Cross-Meeting Conflicts\n`;
    conflicts.forEach(c => {
      const outcome = c.resolutionStrategy === 'overwrite' ? 'Memory overwritten with the new decision'
        : c.resolutionStrategy === 'keep_original' ? 'Original decision retained'
        : c.status === 'Flagged' ? 'Flagged for team review'
        : c.status === 'Resolved' ? 'Resolved' : 'OPEN - needs a decision';
      markdown += `### 🔴 ${c.topic} (${c.severity || 'High'} Severity) — ${outcome}\n`;
      markdown += `- **Past Stored Decision:** ${c.previousDecision} *(from ${c.previousMeetingTitle || 'Prior Meeting'})*\n`;
      markdown += `- **New Contradiction:** ${c.contradiction}\n`;
      markdown += `- **Root Cause:** ${c.reason || 'n/a'}\n`;
      markdown += `- **Impacted Stakeholders:** ${(c.impactedOwners || []).join(', ') || 'n/a'}\n\n`;
    });
  }

  markdown += `---\n*Generated automatically by Meeting Sync Agent & Wispr Flow*\n`;

  res.json({
    success: true,
    filename: `meeting-sync-${Date.now()}.md`,
    markdown
  });
});

// SPA fallback for frontend routes (or root if static didn't catch it)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: `API route not found: ${req.path}` });
  }
  const indexHtml = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  res.json({
    message: "Meeting Sync Agent Backend Proxy is running",
    status: "ok",
    api: "/api/health",
    frontendHint: "Run 'npm run dev' in client/ or 'npm run build' in client/ to generate dist"
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Meeting Sync Agent Backend Proxy running on http://localhost:${PORT}`);
  const activeKeys = resolveKeys();
  console.log(`🔒 Secure LLM Proxy: ${activeKeys.geminiKey ? 'Google Gemini key detected' : activeKeys.openAiKey ? 'OpenAI key detected' : 'no key (using Voice NLP fallback)'}`);
  console.log(`🎙️ Wispr Flow Voice Workflow: Ready`);
  console.log(`====================================================`);
});
