const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'meetings-store.json');

// Seed data is built relative to "today" so the demo never shows stale / wrongly-overdue items.
const isoDay = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const isoAgo = (days, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

function buildSeed() {
  return {
    meetings: [
      {
        id: "meet-002",
        title: "Design Critique & Accessibility Sync",
        date: isoAgo(2, 15),
        source: "Wispr Flow Voice Ingestion",
        efficiencyScore: 74,
        efficiency: {
          score: 74,
          grade: "Moderate Output",
          actionToTalkRatio: "58%",
          actionToTalkPct: 58,
          fillerWordCount: 9,
          talkTimeEstimatedMin: 21,
          breakdown: [
            { label: "Baseline", points: 50 },
            { label: "1 decision", points: 6 },
            { label: "3 action items", points: 15 },
            { label: "Action-to-talk", points: 9 },
            { label: "Every task has an owner", points: 8 },
            { label: "Filler noise", points: -4 }
          ],
          critique: "Decent output (3 action items) but only 58% of the conversation turned into commitments. Cut digressions and confirm owners out loud to raise the score."
        },
        decisions: [
          {
            id: "dec-004",
            decision: "Run a design critique every Thursday before sprint planning",
            context: "Reviews were happening ad hoc and blocking engineering handoff.",
            category: "Strategy",
            impactedComponents: ["Design System", "Sprint Planning"],
            status: "Active"
          }
        ],
        actionItems: [
          {
            id: "task-004",
            title: "Publish accessibility guidelines for the shared component library",
            owner: "Sarah",
            deadline: isoDay(3),
            priority: "Medium",
            status: "Pending",
            tracker: "Linear"
          },
          {
            id: "task-005",
            title: "Prepare usability test script for the new onboarding flow",
            owner: "Lena",
            deadline: isoDay(1),
            priority: "High",
            status: "Pending",
            tracker: "Linear"
          },
          {
            id: "task-006",
            title: "Set up error-monitoring dashboards for the payments service",
            owner: "Marcus",
            deadline: isoDay(-2),
            priority: "High",
            status: "Pending",
            tracker: "Linear"
          }
        ],
        stats: { actionToTalkRatio: "58%", fillerWordCount: 9, durationMinutes: 21 }
      },
      {
        id: "meet-001",
        title: "Q4 Product Launch & Scope Alignment",
        date: isoAgo(7),
        source: "Wispr Flow Voice Ingestion",
        efficiencyScore: 88,
        efficiency: {
          score: 88,
          grade: "High Execution Velocity",
          actionToTalkRatio: "74%",
          actionToTalkPct: 74,
          fillerWordCount: 14,
          talkTimeEstimatedMin: 32,
          breakdown: [
            { label: "Baseline", points: 50 },
            { label: "3 decisions", points: 18 },
            { label: "3 action items", points: 15 },
            { label: "Action-to-talk", points: 11 },
            { label: "Every task has an owner", points: 8 },
            { label: "Filler noise", points: -4 }
          ],
          critique: "Strong execution: 3 action items with clear owners (Marcus, Lena, Priya) and 3 decisions, with 74% of meaningful turns turning into commitments. Wispr Flow filtered 14 filler words."
        },
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
            deadline: isoDay(5),
            priority: "High",
            status: "Synced",
            tracker: "Linear",
            externalId: "LIN-102"
          },
          {
            id: "task-002",
            title: "Deliver final high-fidelity Figma components for checkout modal",
            owner: "Lena",
            deadline: isoDay(8),
            priority: "High",
            status: "Synced",
            tracker: "Jira",
            externalId: "JIRA-409"
          },
          {
            id: "task-003",
            title: "Coordinate launch press release drafts with PR agency",
            owner: "Priya",
            deadline: isoDay(10),
            priority: "Medium",
            status: "Synced",
            tracker: "Asana",
            externalId: "ASN-771"
          }
        ],
        stats: { actionToTalkRatio: "74%", fillerWordCount: 14, durationMinutes: 32 }
      }
    ],
    conflicts: [
      {
        id: "conf-sample-1",
        meetingId: "meet-001",
        meetingTitle: "Q4 Product Launch & Scope Alignment",
        detectedAt: isoAgo(7, 11),
        topic: "Launch Date Timeline",
        previousDecision: "Lock target Q4 launch date strictly for November 15, 2026 (from Sprint Kickoff)",
        contradiction: "Tentative discussion about delaying to December 5th",
        severity: "High",
        status: "Resolved",
        resolutionStrategy: "keep_original",
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
}

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
    const seed = buildSeed();
    this.saveData(seed);
    return seed;
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

  // Only decisions that are truly "locked" count as memory. Pending / Rejected / Flagged / Superseded do not.
  // excludeMeetingId lets us re-run a meeting without it contradicting its own earlier version.
  getActiveDecisions({ excludeMeetingId } = {}) {
    return this.getAllDecisions().filter(d =>
      (!d.status || d.status === 'Active') &&
      (!excludeMeetingId || d.meetingId !== excludeMeetingId)
    );
  }

  findMeetingIdByTitle(title) {
    const existing = (this.data.meetings || []).find(m => m.title === title && m.id !== 'meet-001');
    return existing ? existing.id : undefined;
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
    this.data.conflicts = (this.data.conflicts || []).filter(c => c.meetingId !== id);
    this.saveData();
    return true;
  }

  updateMeetingTasks(meetingId, tasks) {
    const meeting = this.getMeeting(meetingId);
    if (!meeting) return null;
    meeting.actionItems = Array.isArray(tasks) ? tasks : meeting.actionItems;
    this.saveData();
    return meeting;
  }

  resetToSeed() {
    this.data = buildSeed();
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
    const byId = (this.data.conflicts || []).find(c => c.id === conflict.id);
    if (byId) return byId;
    conflict.detectedAt = conflict.detectedAt || new Date().toISOString();
    conflict.status = conflict.status || 'Active';
    const existing = (this.data.conflicts || []).find(c =>
      c.status === 'Active' &&
      c.meetingId && c.meetingId === conflict.meetingId &&
      c.previousDecisionId && c.previousDecisionId === conflict.previousDecisionId &&
      (c.topic || '') === (conflict.topic || '')
    );
    if (existing) return existing;
    this.data.conflicts = [conflict, ...(this.data.conflicts || [])];
    this.saveData();
    return conflict;
  }

  // Re-running a meeting replaces its still-open conflicts instead of piling up duplicates.
  replaceMeetingConflicts(meetingId, meetingTitle, conflicts = []) {
    this.data.conflicts = (this.data.conflicts || []).filter(
      c => !(c.meetingId === meetingId && c.status === 'Active')
    );
    return (conflicts || []).map(c => this.addConflict({ ...c, meetingId, meetingTitle }));
  }

  resolveConflict(conflictId, resolutionStrategy, notes = '') {
    const conflict = (this.data.conflicts || []).find(c => c.id === conflictId);
    if (!conflict) return null;
    const now = new Date().toISOString();
    const newIds = new Set(conflict.newDecisionIds || []);

    const setNewDecisionStatus = (status) => {
      for (const m of this.data.meetings || []) {
        for (const d of m.decisions || []) {
          if (newIds.has(d.id)) {
            d.status = status;
            d.statusUpdatedAt = now;
          }
        }
      }
    };

    if (resolutionStrategy === 'overwrite') {
      // Accept the new direction: old locked decision is superseded, new decision(s) become the locked truth.
      for (const m of this.data.meetings || []) {
        for (const d of m.decisions || []) {
          if (d.id === conflict.previousDecisionId) {
            d.status = 'Superseded';
            d.supersededBy = conflict.contradiction;
            d.supersededAt = now;
          }
        }
      }
      setNewDecisionStatus('Active');
      conflict.status = 'Resolved';
    } else if (resolutionStrategy === 'keep_original') {
      // Reject the new proposal: original stays locked, new decision(s) are marked Rejected.
      setNewDecisionStatus('Rejected');
      conflict.status = 'Resolved';
    } else {
      // manual_flag: neither side wins yet; new decision(s) stay out of memory until a human decides.
      setNewDecisionStatus('Flagged');
      conflict.status = 'Flagged';
    }

    conflict.resolutionStrategy = resolutionStrategy; // 'overwrite', 'keep_original', 'manual_flag'
    conflict.resolutionNotes = notes;
    conflict.resolvedAt = now;
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

  markTasksSynced(pushedTasks) {
    const byId = new Map((pushedTasks || []).map(t => [t.id, t]));
    for (const m of this.data.meetings || []) {
      m.actionItems = (m.actionItems || []).map(task => {
        const match = byId.get(task.id);
        if (!match) return task;
        // Keep any inline edits the person made in Review & Push (title/owner/deadline/priority)
        return { ...task, ...match, status: 'Synced' };
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
