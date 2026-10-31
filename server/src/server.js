require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { extractMeetingIntelligence } = require('./llmService');
const wisprDesktopSync = require('./wisprDesktopSync');
const linearService = require('./linearService');

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
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY');
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'YOUR_OPENAI_API_KEY');
  
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
    const intelligence = await extractMeetingIntelligence(transcript, meetingTitle);

    const saved = db.saveMeeting({
      title: meetingTitle,
      date,
      source: 'Wispr Flow Voice Ingestion',
      efficiencyScore: intelligence.efficiency?.score,
      decisions: intelligence.decisions,
      actionItems: intelligence.actionItems,
      conflicts: intelligence.conflicts || []
    });

    const persistedConflicts = [];
    if (intelligence.conflicts && Array.isArray(intelligence.conflicts)) {
      intelligence.conflicts.forEach(c => {
        persistedConflicts.push(db.addConflict({
          ...c,
          meetingId: saved.id,
          meetingTitle: saved.title
        }));
      });
    }

    res.json({
      success: true,
      meetingTitle,
      date,
      meetingId: saved.id,
      savedToMemory: true,
      ...intelligence,
      conflicts: persistedConflicts.length ? persistedConflicts : intelligence.conflicts
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

    const saved = db.saveMeeting(meetingData);

    // Save any detected conflicts to the conflict store
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
  if (!conflictId || !strategy) {
    return res.status(400).json({ error: "conflictId and strategy ('overwrite', 'keep_original', 'manual_flag') are required" });
  }

  const resolved = db.resolveConflict(conflictId, strategy, notes);
  if (!resolved) {
    return res.status(404).json({ error: "Conflict not found" });
  }

  res.json({ success: true, conflict: resolved });
});

// Review & Push to Task Trackers (Linear live API, plus simulated Jira/Asana/Notion)
app.post('/api/push-tasks', async (req, res) => {
  try {
    const { tasks, tracker = "Linear", meetingTitle = "Meeting Sync" } = req.body;
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: "No tasks provided to push" });
    }

    const result = await linearService.pushTasks({ tasks, tracker, meetingTitle });
    const stats = db.updateSyncedStats(tracker, result.pushedTasks.length);
    db.markTasksSynced(result.pushedTasks, meetingTitle);

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
app.post('/api/reminders/generate', (req, res) => {
  const { tasks } = req.body;
  const taskList = tasks || db.getAllTasks();

  const simulatedReminders = taskList.map(task => {
    const ownerName = task.owner || "Team Member";
    const deadline = task.deadline || "Tomorrow";
    const trackerId = task.externalId || "T-PENDING";

    const slackText = `*Automated 24h Reminder from Meeting Sync Agent*\nHey @${ownerName.toLowerCase().replace(/\s+/g, '')}! Friendly heads-up: your action item *"${task.title}"* [${trackerId}] is scheduled for deadline *${deadline}*.\n_Need blocker escalation? Reply to this thread or click to update status._`;

    const emailHtml = `
      <div style="font-family: sans-serif; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h3 style="color: #0f172a; margin-top: 0;">24-Hour Task Reminder: ${task.title}</h3>
        <p>Hi ${ownerName},</p>
        <p>This is an automated sync reminder from <strong>Meeting Sync Agent</strong> for your assigned deliverable:</p>
        <ul>
          <li><strong>Task:</strong> ${task.title}</li>
          <li><strong>Deadline:</strong> ${deadline}</li>
          <li><strong>Tracker ID:</strong> ${trackerId}</li>
          <li><strong>Priority:</strong> ${task.priority || 'Medium'}</li>
        </ul>
        <p><a href="#" style="background: #2563eb; color: #ffffff; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block;">Update Progress in ${task.tracker || 'Tracker'}</a></p>
      </div>
    `;

    return {
      taskId: task.id,
      owner: ownerName,
      title: task.title,
      deadline,
      slackText,
      emailHtml,
      sendWindow: "24 hours before deadline"
    };
  });

  res.json({
    success: true,
    count: simulatedReminders.length,
    reminders: simulatedReminders
  });
});

// Weekly Digest: Group action items by owner across all stored meetings
app.get('/api/weekly-digest', (req, res) => {
  const allTasks = db.getAllTasks();
  const byOwner = {};

  allTasks.forEach(task => {
    const owner = task.owner || "Unassigned";
    if (!byOwner[owner]) {
      byOwner[owner] = {
        owner,
        totalTasks: 0,
        pending: 0,
        synced: 0,
        highPriority: 0,
        tasks: []
      };
    }
    byOwner[owner].totalTasks++;
    if (task.status === 'Synced') byOwner[owner].synced++;
    else byOwner[owner].pending++;
    if (task.priority === 'High') byOwner[owner].highPriority++;
    byOwner[owner].tasks.push(task);
  });

  res.json({
    digestDateRange: "Current Sprint / Week",
    totalActionItems: allTasks.length,
    owners: Object.values(byOwner),
    activeDecisionsCount: db.getAllDecisions().filter(d => d.status === 'Active').length
  });
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

// Export Clean Markdown Summary
app.post('/api/export', (req, res) => {
  const { meeting, decisions, actionItems, conflicts, efficiency } = req.body;

  let markdown = `# Meeting Sync Execution Report: ${meeting?.title || 'Team Spoken Sync'}\n`;
  markdown += `**Date:** ${meeting?.date || new Date().toLocaleDateString()} | **Source:** Wispr Flow Voice Ingestion\n`;
  markdown += `**Efficiency Score:** ${efficiency?.score || 85}/100 | **Action-to-Talk Ratio:** ${efficiency?.actionToTalkRatio || '76%'}\n\n`;

  markdown += `## 💡 Executive Efficiency Critique\n> ${efficiency?.critique || 'Solid alignment on action items and team ownership.'}\n\n`;

  markdown += `## 🎯 Key Decisions\n`;
  if (decisions && decisions.length > 0) {
    decisions.forEach((d, idx) => {
      markdown += `${idx + 1}. **${d.decision}**\n`;
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
      markdown += `  - **Owner:** @${t.owner} | **Deadline:** ${t.deadline} | **Priority:** ${t.priority || 'Medium'} | **Tracker:** ${t.tracker || 'Linear'}\n`;
    });
  } else {
    markdown += `*No action items logged.*\n`;
  }
  markdown += `\n`;

  if (conflicts && conflicts.length > 0) {
    markdown += `## ⚠️ Cross-Meeting Conflicts Flagged\n`;
    conflicts.forEach(c => {
      markdown += `### 🔴 Conflict: ${c.topic} (${c.severity} Severity)\n`;
      markdown += `- **Past Stored Decision:** ${c.previousDecision} *(from ${c.previousMeetingTitle || 'Prior Meeting'})*\n`;
      markdown += `- **New Contradiction:** ${c.contradiction}\n`;
      markdown += `- **Root Cause:** ${c.reason}\n`;
      markdown += `- **Impacted Stakeholders:** ${(c.impactedOwners || []).join(', ')}\n\n`;
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
  console.log(`🔒 Secure LLM Proxy: GEMINI_API_KEY=${process.env.GEMINI_API_KEY ? 'Configured' : 'Unset (Using Voice NLP Fallback)'}`);
  console.log(`🎙️ Wispr Flow Voice Workflow: Ready`);
  console.log(`====================================================`);
});
