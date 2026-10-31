const db = require('../server/src/db');
const { extractMeetingIntelligence, cleanWisprFlowTranscript } = require('../server/src/llmService');

async function testLogic() {
  db.resetToSeed();
  console.log('=== TEST 1: DB & Persistent Memory Seed ===');
  const meetings = db.getAllMeetings();
  console.log('Stored meetings count:', meetings.length);
  console.log('Initial meeting title:', meetings[0].title);
  const decisions = db.getAllDecisions();
  console.log('Active decisions count:', decisions.length);

  console.log('\n=== TEST 2: Wispr Flow Transcript Cleaner ===');
  const rawSpoken = "Priya: Umm, yeah, so basically we decided to like change the plan, you know?";
  const cleaned = cleanWisprFlowTranscript(rawSpoken);
  console.log('Fillers detected:', cleaned.fillersFound);

  console.log('\n=== TEST 3: Voice NLP & Contradiction Detection Engine ===');
  const contradictionTranscript = `Priya: Hey everyone, umm, thanks for jumping on. So, wait... basically forget what we said on Monday!
Marcus: Wait, what happened with the payments gateway?
Priya: Yeah, umm, stripe onboarding is delayed. So we decided to delay the release to Dec 1. We cannot hit Nov 15th.
Lena: Uh, but wait Priya, didn't marketing lock the launch for Nov 15th?
Priya: I know, but we have to push back. Also, we decided to drop Apple Pay for v1.
Marcus: Okay, if that's the call, I will audit the auth service and update the API endpoints by Nov 10th.
Lena: Got it. I will deliver the updated checkout modal without Apple Pay by Nov 8th.`;

  const extracted = await extractMeetingIntelligence(contradictionTranscript, "Emergency Pivot Sync");
  console.log('Provider active:', extracted.provider);
  console.log('Decisions found:', extracted.decisions.length);
  extracted.decisions.forEach(d => console.log(`  - [${d.category}] ${d.decision}`));

  console.log('\nAction items found:', extracted.actionItems.length);
  extracted.actionItems.forEach(t => console.log(`  - Task: "${t.title}" | Owner: @${t.owner} | Due: ${t.deadline} | Priority: ${t.priority}`));

  console.log('\nConflicts detected:', extracted.conflicts.length);
  extracted.conflicts.forEach(c => {
    console.log(`  - ⚠️ CONFLICT: "${c.topic}" (${c.severity} Severity)`);
    console.log(`    Previous Decision: "${c.previousDecision}"`);
    console.log(`    Contradiction: "${c.contradiction}"`);
    console.log(`    Impacted: ${c.impactedOwners.join(', ')}`);
  });

  console.log('\nEfficiency Score:', extracted.efficiency.score, '/ 100');
  console.log('Critique:', extracted.efficiency.critique);

  console.log('\n=== TEST 4: Conflict Resolution ===');
  if (extracted.conflicts.length > 0) {
    const savedConflict = db.addConflict(extracted.conflicts[0]);
    console.log('Added conflict:', savedConflict.id, savedConflict.status);
    const resolved = db.resolveConflict(savedConflict.id, 'overwrite', 'Approved by team lead');
    console.log('Resolved conflict status:', resolved.status, 'strategy:', resolved.resolutionStrategy);
  }

  console.log('\n=== TEST 5: Synced Stats Counter ===');
  const initialStats = db.getSyncedStats();
  console.log('Current stats:', initialStats);
  const updated = db.updateSyncedStats('Linear', 2);
  console.log('Updated stats after 2 Linear tasks:', updated);

  const marcus = extracted.actionItems.find(t => t.owner === 'Marcus');
  const lena = extracted.actionItems.find(t => t.owner === 'Lena');
  if (extracted.decisions.length < 2) throw new Error('Expected at least 2 decisions from pivot transcript');
  if (extracted.actionItems.length < 2) throw new Error('Expected at least 2 action items with owners');
  if (!marcus || !lena) throw new Error('Expected Marcus and Lena action items');
  if (extracted.conflicts.length < 2) throw new Error('Expected launch-date and Apple Pay conflicts against memory');

  db.resetToSeed();
  console.log('\n✅ ALL IN-MEMORY INTEGRATION LOGIC PASSED VERIFICATION!');
}

testLogic().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
