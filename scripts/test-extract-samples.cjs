const { heuristicExtract } = require('../server/src/extractionEngine');
const { detectConflicts } = require('../server/src/conflictEngine');
const db = require('../server/src/db');

const samples = {
  pivot: `Priya: Hey everyone, umm, thanks for jumping on so quickly. So, wait... hold on, basically forget what we said on Monday's sync!
Marcus: Wait, what happened with the payments gateway?
Priya: Yeah, umm, stripe onboarding is totally delayed. So we decided to delay the release to Dec 1. We just cannot hit the Nov 15th date safely.
Lena: Uh, but wait Priya, didn't marketing already lock the press release for mid-November?
Priya: I know, I know, but we have to push back. Also, another tough call: we decided to drop Apple Pay for v1 and just launch with standard credit cards.
Marcus: Okay, if that's the final call, then I will audit the auth service and update the API endpoints by Nov 10th.
Lena: Got it. And I will redesign the checkout modal to remove the Apple Pay sheet by Nov 8th.
Priya: Perfect. Marcus, make sure you coordinate with the DevOps cluster team before Friday.`,
  sprint: `Priya: Okay team, mic check. Wispr Flow is running. Let's, uh, lock down the deliverables for Sprint 43.
Marcus: Cool. So regarding the database connection pooling, we decided to migrate all read replicas to the new AWS region.
Lena: Nice! That should fix our query latency during peak hours.
Priya: Agreed. So action items: Marcus, you will complete the load testing benchmark by Nov 6th.
Marcus: Yeah, I'll take ownership of that. I'll test up to 20,000 concurrent sessions.
Lena: And for my side, umm, wait, actually no... instead of redesigning the whole navbar, I will deliver the updated user profile dropdown component by Nov 9th.
Priya: Great. And I will finalize the sprint budget approval with leadership by Nov 5th.
Marcus: Sounds solid. Let's wrap up.`,
  chat: `Marcus: Hey Sarah! Did you catch that Champions League game last night? Man, that extra time goal was insane!
Sarah: Haha yes! Though honestly I was half-asleep because my espresso machine broke down this morning.
Marcus: Oh no, caffeine emergency! Anyway, so yeah, basically back to business.
Sarah: Right! So we decided to adopt Tailwind CSS v4 across all microfrontends.
Marcus: Awesome, that will cut our build times in half. Action item for me: Marcus will update the shared UI component library by Nov 12th.
Sarah: Perfect. And Sarah will conduct the accessibility audit on the signup funnel by Nov 7th.
Marcus: Cool, so who is getting coffee next? Just kidding, back to coding.`
};

const past = db.getActiveDecisions();
for (const [name, text] of Object.entries(samples)) {
  const extracted = heuristicExtract(text, name);
  const conflicts = detectConflicts(text, extracted.decisions, past);
  console.log('\n==', name, '==');
  console.log('decisions:');
  extracted.decisions.forEach(d => console.log(' -', d.category, '|', d.decision));
  console.log('tasks:');
  extracted.actionItems.forEach(t => console.log(' -', t.owner, '|', t.deadline, '|', t.priority, '|', t.title));
  console.log('conflicts:');
  conflicts.forEach(c => console.log(' -', c.topic));
}
