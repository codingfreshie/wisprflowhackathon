const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'meetings-store.json');

// Initial seed data representing past meetings to demonstrate cross-meeting memory & contradiction detection
const INITIAL_SEED = {
  meetings: [
    {
      id: "meet-001",
      title: "Q4 Product Launch & Scope Alignment",
      date: "2026-10-24T10:00:00.000Z",
      source: "Wispr Flow Voice Ingestion",
      efficiencyScore: 88,
      decisions: [
        {
          id: "dec-001",
          decision: "Lock target Q4 launch date strictly for November 15, 2026",
          context: "Marketing campaigns and press embargoes are booked for mid-November.",
          category: "Timeline",
          impactedComponents: ["Mobile App", "Web Checkout", "Marketing"],
          status: "Active"
        },
        {
          id: "dec-002",
          decision: "Must include Apple Pay and Google Pay integration in v1 checkout",
          context: "User research showed 68% mobile shoppers abandon without one-click checkout.",
          category: "Feature Scope",
          impactedComponents: ["Web Checkout", "Payments Backend"],
          status: "Active"
        },
        {
          id: "dec-003",
          decision: "Mandatory zero-downtime database migration strategy before launch",
          context: "Lena confirmed customer SLA requires 99.99% availability during rollout.",
          category: "Infrastructure",
          impactedComponents: ["PostgreSQL Cluster", "Auth Service"],
          status: "Active"
        }
      ],
      actionItems: [
        {
          id: "task-001",
          title: "Complete PCI-DSS compliance audit for payment gateway",
          owner: "Marcus",
          deadline: "2026-11-05",
          priority: "High",
          status: "Synced",
          tracker: "Linear",
          externalId: "LIN-102"
        },
        {
          id: "task-002",
          title: "Deliver final high-fidelity Figma components for checkout modal",
          owner: "Lena",
          deadline: "2026-11-08",
          priority: "High",
          status: "Synced",
          tracker: "Jira",
          externalId: "JIRA-409"
        },
        {
          id: "task-003",
          title: "Coordinate launch press release drafts with PR agency",
          owner: "Priya",
          deadline: "2026-11-10",
          priority: "Medium",
          status: "Synced",
          tracker: "Asana",
          externalId: "ASN-771"
        }
      ],
      stats: {
        actionToTalkRatio: "74%",
        fillerWordCount: 14,
        durationMinutes: 32
      }
    }
  ],
  conflicts: [
    {
      id: "conf-sample-1",
      meetingId: "meet-001",
      detectedAt: "2026-10-24T10:35:00.000Z",
      topic: "Launch Date Timeline",
      previousDecision: "Lock target Q4 launch date strictly for November 15, 2026 (from Sprint Kickoff)",
      contradiction: "Tentative discussion about delaying to December 5th",
      severity: "High",
      status: "Resolved",
      resolution: "Reaffirmed Nov 15th deadline after Priya confirmed sponsor contract clauses"
    }
  ],
  syncedStats: {
    totalPushed: 3,
    linear: 1,
    jira: 1,
    asana: 1,
    notion: 0
  }
};

class MeetingStore {
  constructor() {
    this.ensureDataDir();
    this.data = this.loadData();
  }

  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  loadData() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[MeetingStore] Error reading store, re-initializing seed:', err.message);
    }
    this.saveData(INITIAL_SEED);
    return JSON.parse(JSON.stringify(INITIAL_SEED));
  }

  saveData(data) {
    try {
      this.ensureDataDir();
      fs.writeFileSync(DB_FILE, JSON.stringify(data || this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[MeetingStore] Error saving store:', err.message);
    }
  }

  getAllMeetings() {
    return this.data.meetings || [];
  }

  getMeeting(id) {
    return (this.data.meetings || []).find(m => m.id === id);
  }

  getAllDecisions() {
    const all = [];
    for (const m of this.data.meetings || []) {
      for (const d of m.decisions || []) {
        all.push({
          ...d,
          meetingId: m.id,
          meetingTitle: m.title,
          meetingDate: m.date
        });
      }
    }
    return all;
  }

  getActiveDecisions() {
    return this.getAllDecisions().filter(d => !d.status || d.status === 'Active');
  }

  saveMeeting(meeting) {
    if (!meeting.id) {
      const existing = (this.data.meetings || []).find(m => m.title === meeting.title && m.id !== 'meet-001');
      meeting.id = existing ? existing.id : `meet-${Date.now()}`;
    }
    if (!meeting.date) {
      meeting.date = new Date().toISOString();
    }
    // Prepend new meeting
    this.data.meetings = [meeting, ...(this.data.meetings || []).filter(m => m.id !== meeting.id)];
    this.saveData();
    return meeting;
  }

  deleteMeeting(id) {
    this.data.meetings = (this.data.meetings || []).filter(m => m.id !== id);
    this.saveData();
    return true;
  }

  resetToSeed() {
    this.data = JSON.parse(JSON.stringify(INITIAL_SEED));
    this.saveData();
    return this.data;
  }

  getConflicts() {
    return this.data.conflicts || [];
  }

  addConflict(conflict) {
    if (!conflict.id) {
      conflict.id = `conf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }
    conflict.detectedAt = conflict.detectedAt || new Date().toISOString();
    conflict.status = conflict.status || 'Active';
    const existing = (this.data.conflicts || []).find(c =>
      c.status === 'Active' &&
      c.previousDecisionId &&
      c.previousDecisionId === conflict.previousDecisionId &&
      (c.topic || '') === (conflict.topic || '')
    );
    if (existing) return existing;
    this.data.conflicts = [conflict, ...(this.data.conflicts || [])];
    this.saveData();
    return conflict;
  }

  resolveConflict(conflictId, resolutionStrategy, notes = '') {
    const conflict = (this.data.conflicts || []).find(c => c.id === conflictId);
    if (!conflict) return null;
    conflict.status = 'Resolved';
    conflict.resolutionStrategy = resolutionStrategy; // 'overwrite', 'keep_original', 'manual_flag'
    conflict.resolutionNotes = notes;
    conflict.resolvedAt = new Date().toISOString();

    // If strategy is 'overwrite', update the historical decision
    if (resolutionStrategy === 'overwrite' && conflict.previousDecisionId) {
      for (const m of this.data.meetings) {
        const d = (m.decisions || []).find(dec => dec.id === conflict.previousDecisionId);
        if (d) {
          d.status = 'Superseded';
          d.supersededBy = conflict.contradiction;
          d.supersededAt = new Date().toISOString();
        }
      }
    }

    this.saveData();
    return conflict;
  }

  updateSyncedStats(tracker, count = 1) {
    if (!this.data.syncedStats) {
      this.data.syncedStats = { totalPushed: 0, linear: 0, jira: 0, asana: 0, notion: 0 };
    }
    const t = tracker.toLowerCase();
    this.data.syncedStats.totalPushed += count;
    if (this.data.syncedStats[t] !== undefined) {
      this.data.syncedStats[t] += count;
    } else {
      this.data.syncedStats[t] = count;
    }
    this.saveData();
    return this.data.syncedStats;
  }

  getSyncedStats() {
    return this.data.syncedStats || { totalPushed: 3, linear: 1, jira: 1, asana: 1, notion: 0 };
  }

  getAllTasks() {
    const tasks = [];
    for (const m of this.data.meetings || []) {
      for (const t of m.actionItems || []) {
        tasks.push({
          ...t,
          meetingId: m.id,
          meetingTitle: m.title,
          meetingDate: m.date
        });
      }
    }
    return tasks;
  }

  markTasksSynced(pushedTasks, meetingTitle) {
    const byId = new Map((pushedTasks || []).map(t => [t.id, t]));
    for (const m of this.data.meetings || []) {
      if (meetingTitle && m.title !== meetingTitle) continue;
      m.actionItems = (m.actionItems || []).map(task => {
        const match = byId.get(task.id);
        if (!match) return task;
        return {
          ...task,
          status: 'Synced',
          tracker: match.tracker || task.tracker,
          externalId: match.externalId,
          externalUrl: match.externalUrl,
          syncedAt: match.syncedAt
        };
      });
    }
    this.saveData();
  }
  getLatestWisprSession() {
    return this.data.latestWisprNotetakerSession || {
      id: "wispr-note-latest",
      title: "Google Meet: Architecture & Scope Pivot (Wispr Notetaker)",
      date: new Date().toISOString(),
      source: "Wispr Notetaker Bot",
      participants: ["Priya Sharma", "Marcus Vance", "Lena Torres"],
      duration: "24 mins",
      rawTranscript: `Priya: Hey everyone, umm, thanks for jumping on so quickly. Wispr Notetaker is recording our sync. So, wait... hold on, basically forget what we said on Monday's sync!
Marcus: Wait, what happened with the payments gateway?
Priya: Yeah, umm, Stripe onboarding is totally delayed. So we decided to delay the release to Dec 1. We just cannot hit the Nov 15th date safely.
Lena: Uh, but wait Priya, didn't marketing already lock the launch date for Nov 15th?
Priya: I know, I know, but we have to push back. Also, another tough call: we decided to drop Apple Pay for v1 and just launch with standard credit cards.
Marcus: Okay, if that's the final call, then I will audit the auth service and update the API endpoints by Nov 10th.
Lena: Got it. And I will redesign the checkout modal to remove the Apple Pay sheet by Nov 8th.
Priya: Perfect. Marcus, make sure you coordinate with the DevOps cluster team before Friday.`
    };
  }

  setLatestWisprSession(session) {
    this.data.latestWisprNotetakerSession = session;
    this.saveData();
    return session;
  }
}

module.exports = new MeetingStore();
