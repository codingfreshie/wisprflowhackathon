/**
 * Report builders shared by the API endpoints:
 *   buildDigest()            -> Weekly Digest (grouped by owner + "needs attention")
 *   buildEfficiencyReport()  -> Cross-meeting efficiency scoreboard
 *   buildWeeklyMarkdown()    -> One-click exportable weekly report (digest + efficiency + conflicts)
 */
const db = require('./db');

const DAY = 24 * 60 * 60 * 1000;
const isOpenConflict = (c) => !c.status || c.status === 'Active' || c.status === 'Flagged';

function parseDay(deadline) {
  const m = String(deadline || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

const fmtDay = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function buildDigest() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAhead = new Date(startOfToday.getTime() + 7 * DAY);
  const allTasks = db.getAllTasks();
  const meetings = db.getAllMeetings();
  const openConflicts = db.getConflicts().filter(isOpenConflict);

  // Which meetings are sitting on an unresolved contradiction?
  const conflictsByMeeting = new Map();
  for (const c of openConflicts) {
    if (!c.meetingId) continue;
    if (!conflictsByMeeting.has(c.meetingId)) conflictsByMeeting.set(c.meetingId, []);
    conflictsByMeeting.get(c.meetingId).push(c);
  }

  const byOwner = {};
  let dueThisWeek = 0;
  let overdue = 0;
  let blocked = 0;
  const attention = [];

  for (const task of allTasks) {
    const owner = task.owner || 'Unassigned';
    if (!byOwner[owner]) {
      byOwner[owner] = { owner, totalTasks: 0, pending: 0, synced: 0, highPriority: 0, overdue: 0, dueThisWeek: 0, blocked: 0, tasks: [] };
    }
    const g = byOwner[owner];
    g.totalTasks++;
    if (task.status === 'Synced') g.synced++; else g.pending++;
    if (task.priority === 'High') g.highPriority++;

    const due = parseDay(task.deadline);
    const isOverdue = Boolean(due && due < startOfToday);
    const isThisWeek = Boolean(due && due >= startOfToday && due <= weekAhead);
    const daysLeft = due ? Math.round((due - startOfToday) / DAY) : null;
    const conflictList = conflictsByMeeting.get(task.meetingId) || [];
    const blockedByConflict = conflictList.length > 0;

    if (isOverdue) { overdue++; g.overdue++; }
    if (isThisWeek) { dueThisWeek++; g.dueThisWeek++; }
    if (blockedByConflict) { blocked++; g.blocked++; }

    g.tasks.push({
      ...task,
      isOverdue,
      isThisWeek,
      daysLeft,
      blockedByConflict,
      conflictTopics: conflictList.map(c => c.topic)
    });

    if (isOverdue) {
      attention.push({ severity: 3, type: 'overdue', owner, taskId: task.id, text: `${owner}: "${task.title}" is ${Math.abs(daysLeft)} day(s) overdue` });
    } else if (task.status !== 'Synced' && daysLeft !== null && daysLeft <= 2) {
      attention.push({ severity: 2, type: 'due_soon', owner, taskId: task.id, text: `${owner}: "${task.title}" is due ${daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`} and not pushed yet` });
    } else if (task.status !== 'Synced' && task.priority === 'High') {
      attention.push({ severity: 1, type: 'high_unsynced', owner, taskId: task.id, text: `${owner}: high-priority "${task.title}" is not pushed to a tracker` });
    }
  }

  // One attention row per open conflict (not per task)
  for (const c of openConflicts) {
    attention.push({
      severity: 4,
      type: 'conflict',
      owner: (c.impactedOwners || []).join(', '),
      conflictId: c.id,
      text: `${c.status === 'Flagged' ? 'Flagged' : 'Unresolved'} conflict: ${c.topic} - tasks from "${c.meetingTitle || c.previousMeetingTitle || 'a recent meeting'}" may be based on a decision that contradicts memory`
    });
  }
  attention.sort((a, b) => b.severity - a.severity);

  const owners = Object.values(byOwner)
    .map(o => ({ ...o, tasks: o.tasks.sort((a, b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999'))) }))
    .sort((a, b) => b.totalTasks - a.totalTasks);

  const totalSynced = allTasks.filter(t => t.status === 'Synced').length;
  const parts = [`${meetings.length} meeting${meetings.length === 1 ? '' : 's'}`, `${allTasks.length} deliverables`, `${dueThisWeek} due this week`];
  if (overdue) parts.push(`${overdue} overdue`);
  if (openConflicts.length) parts.push(`${openConflicts.length} open conflict${openConflicts.length === 1 ? '' : 's'}`);

  return {
    generatedAt: now.toISOString(),
    digestDateRange: `${fmtDay(now)} - ${fmtDay(weekAhead)}`,
    headline: parts.join('  •  '),
    totalActionItems: allTasks.length,
    totalSynced,
    totalPending: allTasks.length - totalSynced,
    completionPct: allTasks.length ? Math.round((totalSynced / allTasks.length) * 100) : 0,
    dueThisWeek,
    overdue,
    blockedTasks: blocked,
    openConflicts: openConflicts.length,
    meetingCount: meetings.length,
    owners,
    needsAttention: attention.slice(0, 8),
    activeDecisionsCount: db.getAllDecisions().filter(d => !d.status || d.status === 'Active').length
  };
}

function meetingEfficiency(m) {
  const e = m.efficiency || {};
  const stats = m.stats || {};
  const score = typeof e.score === 'number' ? e.score : (typeof m.efficiencyScore === 'number' ? m.efficiencyScore : null);
  const conflicts = db.getConflicts().filter(c => c.meetingId === m.id);
  return {
    id: m.id,
    title: m.title,
    date: m.date,
    score,
    grade: e.grade || (score === null ? 'n/a' : score >= 80 ? 'High Execution Velocity' : score >= 60 ? 'Moderate Output' : 'Action Friction'),
    actionToTalkRatio: e.actionToTalkRatio || stats.actionToTalkRatio || 'n/a',
    fillerWordCount: e.fillerWordCount ?? stats.fillerWordCount ?? 0,
    breakdown: e.breakdown || [],
    critique: e.critique || '',
    decisions: (m.decisions || []).length,
    tasks: (m.actionItems || []).length,
    conflictsTotal: conflicts.length,
    conflictsOpen: conflicts.filter(isOpenConflict).length
  };
}

function buildEfficiencyReport() {
  const rows = db.getAllMeetings().map(meetingEfficiency)
    .sort((a, b) => new Date(a.date) - new Date(b.date)); // oldest -> newest
  const scored = rows.filter(r => typeof r.score === 'number');
  const avg = scored.length ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length) : null;
  const best = scored.length ? scored.reduce((a, b) => (b.score > a.score ? b : a)) : null;
  const worst = scored.length ? scored.reduce((a, b) => (b.score < a.score ? b : a)) : null;
  const latest = rows[rows.length - 1] || null;
  const previous = rows.length > 1 ? rows[rows.length - 2] : null;
  const trend = latest && previous && typeof latest.score === 'number' && typeof previous.score === 'number'
    ? latest.score - previous.score : null;

  return {
    generatedAt: new Date().toISOString(),
    meetingCount: rows.length,
    averageScore: avg,
    best: best && { title: best.title, score: best.score },
    worst: worst && { title: worst.title, score: worst.score },
    trend,
    totalDecisions: rows.reduce((s, r) => s + r.decisions, 0),
    totalTasks: rows.reduce((s, r) => s + r.tasks, 0),
    totalFillers: rows.reduce((s, r) => s + (Number(r.fillerWordCount) || 0), 0),
    meetings: rows,
    latest
  };
}

function buildWeeklyMarkdown() {
  const digest = buildDigest();
  const eff = buildEfficiencyReport();
  const conflicts = db.getConflicts();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  let md = `# Weekly Execution Report\n`;
  md += `**Generated:** ${today} | **Window:** ${digest.digestDateRange} | **Source:** Meeting Sync Agent + Wispr Flow\n\n`;
  md += `> ${digest.headline.replace(/  •  /g, ' · ')}\n\n`;

  md += `## Needs attention\n`;
  if (digest.needsAttention.length) digest.needsAttention.forEach(a => { md += `- ${a.type === 'conflict' ? '🔴' : a.type === 'overdue' ? '🟠' : '🟡'} ${a.text}\n`; });
  else md += `- Nothing needs attention. 🎉\n`;
  md += `\n`;

  md += `## Deliverables by owner (${digest.totalSynced}/${digest.totalActionItems} synced, ${digest.completionPct}%)\n`;
  digest.owners.forEach(o => {
    md += `\n### ${o.owner} - ${o.totalTasks} task(s), ${o.synced} synced${o.overdue ? `, ${o.overdue} overdue` : ''}\n`;
    o.tasks.forEach(t => {
      const flag = t.isOverdue ? ' **(OVERDUE)**' : t.isThisWeek ? ' (this week)' : '';
      const block = t.blockedByConflict ? ' ⚠ conflict pending' : '';
      md += `- [${t.status === 'Synced' ? 'x' : ' '}] ${t.title} - due ${t.deadline || 'TBD'}${flag}${block} ${t.externalId ? `[${t.externalId}]` : ''}\n`;
    });
  });
  md += `\n`;

  md += `## Meeting efficiency\n`;
  md += `Average score **${eff.averageScore ?? 'n/a'}/100** across ${eff.meetingCount} meeting(s)${eff.trend === null ? '' : ` (latest ${eff.trend >= 0 ? '+' : ''}${eff.trend} vs previous)`}.\n\n`;
  md += `| Meeting | Date | Score | Action-to-talk | Fillers | Decisions | Tasks | Open conflicts |\n|---|---|---|---|---|---|---|---|\n`;
  eff.meetings.slice().reverse().forEach(m => {
    md += `| ${m.title} | ${new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} | ${m.score ?? 'n/a'} | ${m.actionToTalkRatio} | ${m.fillerWordCount} | ${m.decisions} | ${m.tasks} | ${m.conflictsOpen} |\n`;
  });
  md += `\n`;

  md += `## Conflict log\n`;
  if (conflicts.length === 0) md += `No contradictions detected.\n`;
  conflicts.forEach(c => {
    const outcome = c.resolutionStrategy === 'overwrite' ? 'memory overwritten with the new decision'
      : c.resolutionStrategy === 'keep_original' ? 'original decision retained'
      : c.status === 'Flagged' ? 'flagged for team review'
      : c.status === 'Resolved' ? (c.resolution || 'resolved') : 'OPEN - needs a decision';
    md += `- **${c.topic}** (${c.severity || 'High'}): "${c.previousDecision}" vs "${c.contradiction}" -> **${outcome}**\n`;
  });

  md += `\n---\n*Generated automatically by Meeting Sync Agent & Wispr Flow*\n`;
  return { filename: `weekly-report-${new Date().toISOString().slice(0, 10)}.md`, markdown: md };
}

module.exports = { buildDigest, buildEfficiencyReport, buildWeeklyMarkdown, isOpenConflict };
