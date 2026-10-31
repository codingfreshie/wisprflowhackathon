/**
 * End-to-end demo check. Run with the backend already started (npm start in server/):
 *
 *     node scripts/test-demo-flow.cjs
 *
 * WARNING: it calls /api/meetings/reset-demo first, so the vault is reset to the demo seed.
 */
const BASE = process.env.API_BASE || 'http://localhost:5000/api';

const PIVOT = `Priya: Hey everyone, umm, thanks for jumping on so quickly. So, wait... hold on, basically forget what we said on Monday's sync!
Marcus: Wait, what happened with the payments gateway?
Priya: Yeah, umm, stripe onboarding is totally delayed. So we decided to delay the release to Dec 1. We just cannot hit the Nov 15th date safely.
Priya: I know, I know, but we have to push back. Also, another tough call: we decided to drop Apple Pay for v1 and just launch with standard credit cards.
Marcus: Okay, if that's the final call, then I will audit the auth service and update the API endpoints by Nov 10th.
Lena: Got it. And I will redesign the checkout modal to remove the Apple Pay sheet by Nov 8th.
Priya: Perfect. Marcus, make sure you coordinate with the DevOps cluster team before Friday.`;

let passed = 0;
let failed = 0;
function check(name, condition, extra = '') {
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}

async function api(path, method = 'GET', body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* ignore */ }
  return { status: res.status, data };
}

async function main() {
  console.log(`Testing ${BASE}\n`);

  console.log('Health & reset');
  const health = await api('/health');
  check('backend is up', health.status === 200 && health.data.status === 'ok');
  await api('/meetings/reset-demo', 'POST');

  console.log('Extraction + cross-meeting conflicts');
  const ex1 = await api('/extract', 'POST', { transcript: PIVOT, meetingTitle: 'Demo Pivot' });
  check('extract succeeds', ex1.status === 200 && ex1.data.success);
  check('2 decisions found', ex1.data.decisions.length === 2);
  check('3 action items found', ex1.data.actionItems.length === 3);
  check('2 conflicts detected', ex1.data.conflicts.length === 2);
  check('conflicting decisions held as Pending Review', ex1.data.decisions.every(d => d.status === 'Pending Review'));

  const ex2 = await api('/extract', 'POST', { transcript: PIVOT, meetingTitle: 'Demo Pivot' });
  check('re-extract same meeting does NOT contradict itself (still 2 conflicts)', ex2.data.conflicts.length === 2);
  const meetingId = ex2.data.meetingId;

  console.log('Efficiency scoring');
  const eff = ex2.data.efficiency;
  check('efficiency has a score, grade and breakdown', typeof eff.score === 'number' && eff.grade && eff.breakdown.length >= 4);
  check('breakdown adds up to the score', Math.max(30, Math.min(98, eff.breakdown.reduce((n, b) => n + b.points, 0))) === eff.score);
  check('contradictions lower the score & appear in critique', /contradict/i.test(eff.critique) && eff.breakdown.some(b => b.points < 0 && /contradiction/.test(b.label)));
  const calm = await api('/extract', 'POST', { transcript: 'Priya: Agreed, we decided to adopt weekly retros.\nMarcus: I will write the retro template by Nov 20th.\nLena: I will book the room by Nov 18th.', meetingTitle: 'Calm Sync' });
  check('action-to-talk ratio is computed per meeting (not a constant)', calm.data.efficiency.actionToTalkRatio !== eff.actionToTalkRatio);
  check('clean meeting scores higher than contradicting one', calm.data.efficiency.score > eff.score);
  const storedMeeting = (await api(`/meetings/${meetingId}`)).data;
  check('efficiency is persisted with the meeting', storedMeeting.efficiency && storedMeeting.efficiency.score === eff.score);
  const effRep = (await api('/efficiency-report')).data;
  check('efficiency report lists every meeting with a score', effRep.meetings.length >= 4 && effRep.meetings.every(m => typeof m.score === 'number') && typeof effRep.averageScore === 'number');

  console.log('Digest sees open conflicts');
  const digOpen = (await api('/weekly-digest')).data;
  check('open conflicts surface in needs-attention', digOpen.needsAttention.some(a => a.type === 'conflict') && digOpen.openConflicts === 2);
  check('tasks from the conflicted meeting are flagged', digOpen.owners.flatMap(o => o.tasks).some(t => t.blockedByConflict));

  console.log('Conflict resolution');
  const [launch, applePay] = [
    ex2.data.conflicts.find(c => /Launch/.test(c.topic)),
    ex2.data.conflicts.find(c => /Apple Pay/.test(c.topic))
  ];
  const r1 = await api('/conflicts/resolve', 'POST', { conflictId: launch.id, strategy: 'keep_original' });
  check('Retain Original -> Resolved', r1.data.conflict.status === 'Resolved');
  const delayDecision = r1.data.meeting.decisions.find(d => /Delay/.test(d.decision));
  check('Retain Original rejects the new decision', delayDecision.status === 'Rejected');
  const r2 = await api('/conflicts/resolve', 'POST', { conflictId: applePay.id, strategy: 'overwrite' });
  const meetings = (await api('/meetings')).data;
  const seed = meetings.find(m => m.id === 'meet-001');
  check('Overwrite supersedes the old Apple Pay decision', seed.decisions.find(d => d.id === 'dec-002').status === 'Superseded');
  check('Overwrite activates the new decision', r2.data.meeting.decisions.find(d => /Apple Pay/.test(d.decision)).status === 'Active');
  const bad = await api('/conflicts/resolve', 'POST', { conflictId: 'x', strategy: 'bogus' });
  check('invalid strategy rejected (400)', bad.status === 400);

  console.log('Flag for review -> decide later');
  const ex3 = await api('/extract', 'POST', { transcript: PIVOT, meetingTitle: 'Flag Test' });
  const flagTarget = ex3.data.conflicts.find(c => /Launch/.test(c.topic));
  const fl = await api('/conflicts/resolve', 'POST', { conflictId: flagTarget.id, strategy: 'manual_flag' });
  check('flagging parks the conflict', fl.data.conflict.status === 'Flagged');
  const stillOpen = (await api('/weekly-digest')).data;
  check('flagged conflicts still show in the digest', stillOpen.needsAttention.some(a => a.conflictId === flagTarget.id));
  const fl2 = await api('/conflicts/resolve', 'POST', { conflictId: flagTarget.id, strategy: 'keep_original' });
  check('a flagged conflict can be resolved later', fl2.data.conflict.status === 'Resolved' && fl2.data.conflict.resolutionStrategy === 'keep_original');

  console.log('Review & push (+ persistence of inline edits)');
  const edited = { ...ex2.data.actionItems[0], title: 'EDITED by reviewer', owner: 'Lena' };
  const push = await api('/push-tasks', 'POST', { tasks: [edited, ex2.data.actionItems[1]], tracker: 'Jira', meetingTitle: 'whatever' });
  check('push succeeds', push.status === 200 && push.data.success);
  const ids = push.data.pushedTasks.map(t => t.externalId);
  check('tracker keys are unique', new Set(ids).size === ids.length, JSON.stringify(ids));
  const afterPush = (await api(`/meetings/${meetingId}`)).data;
  const stored = afterPush.actionItems.find(t => t.id === edited.id);
  check('edited title persisted in vault', stored.title === 'EDITED by reviewer' && stored.status === 'Synced');
  const put = await api(`/meetings/${meetingId}/tasks`, 'PUT', { tasks: afterPush.actionItems.map(t => t.id === ex2.data.actionItems[2].id ? { ...t, owner: 'Priya' } : t) });
  check('unpushed edits can be persisted', put.status === 200);

  console.log('Reminders');
  const rem = await api('/reminders/generate', 'POST', { tasks: null });
  check('reminders generated from vault', rem.data.count > 0);
  check('reminders have a 24h-before send time', rem.data.reminders.every(r => !r.deadline || r.sendAt));
  const xss = await api('/reminders/generate', 'POST', { tasks: [{ id: 'x', title: '<img src=x onerror=alert(1)>', owner: 'A', deadline: '2026-12-01' }] });
  check('email HTML escapes task text', !xss.data.reminders[0].emailHtml.includes('<img'));

  console.log('Weekly digest');
  const dig = await api('/weekly-digest');
  check('digest groups by owner', dig.data.owners.length >= 3);
  check('digest reflects edited owner/title', dig.data.owners.some(o => o.owner === 'Lena' && o.tasks.some(t => t.title === 'EDITED by reviewer')));

  check('digest has a headline and completion %', dig.data.headline && typeof dig.data.completionPct === 'number');
  check('digest reports an overdue seed task', dig.data.overdue >= 1 && dig.data.needsAttention.some(a => a.type === 'overdue'));
  const wk = (await api('/weekly-report')).data;
  check('weekly report markdown includes digest, efficiency and conflict log', wk.markdown.includes('Needs attention') && wk.markdown.includes('Meeting efficiency') && wk.markdown.includes('Conflict log'));

  console.log('Export & Wispr endpoints');
  const exp = await api('/export', 'POST', { meeting: { title: 'x' }, decisions: ex2.data.decisions, actionItems: ex2.data.actionItems, conflicts: [], efficiency: ex2.data.efficiency });
  check('markdown export', exp.data.markdown && exp.data.markdown.includes('Key Decisions'));
  const hist = await api('/wispr/desktop-history');
  check('desktop-history endpoint no longer crashes', hist.status === 200);
  const latest = await api('/wispr/latest');
  check('Wispr notetaker session available', latest.data.session && latest.data.session.rawTranscript);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  console.error('Test run crashed (is the backend running on ' + BASE + '?):', err.message);
  process.exit(1);
});
