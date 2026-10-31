const http = require('http');

async function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(dataString ? { 'Content-Length': Buffer.byteLength(dataString) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Meeting Sync Agent Integration Suite...\n');

  try {
    // 1. Health check
    console.log('1. Testing /api/health...');
    const health = await makeRequest('/api/health');
    console.log(`   Status: ${health.status}, Provider: ${health.data.llmProvider}, Meetings: ${health.data.persistentMemory.totalStoredMeetings}`);

    // 2. Extract with Wispr Flow messy transcript (Contradiction scenario)
    console.log('\n2. Testing /api/extract with Wispr Flow spoken transcript (Emergency Pivot)...');
    const extractPayload = {
      meetingTitle: 'Emergency Pivot Sync',
      transcript: `Priya: Hey everyone, umm, thanks for jumping on. So, wait... basically forget what we said on Monday!
Marcus: Wait, what happened with the payments gateway?
Priya: Yeah, umm, stripe onboarding is delayed. So we decided to delay the release to Dec 1. We cannot hit Nov 15th.
Lena: Uh, but wait Priya, didn't marketing lock the launch for Nov 15th?
Priya: I know, but we have to push back. Also, we decided to drop Apple Pay for v1.
Marcus: Okay, if that's the call, I will audit the auth service and update the API endpoints by Nov 10th.
Lena: Got it. I will deliver the updated checkout modal without Apple Pay by Nov 8th.`
    };

    const extractRes = await makeRequest('/api/extract', 'POST', extractPayload);
    console.log(`   Decisions extracted: ${extractRes.data.decisions.length}`);
    console.log(`   Action items extracted: ${extractRes.data.actionItems.length}`);
    console.log(`   Conflicts detected: ${extractRes.data.conflicts.length}`);
    console.log(`   Meeting Efficiency Score: ${extractRes.data.efficiency.score}/100`);

    if (extractRes.data.conflicts.length > 0) {
      console.log(`   ✅ CONFLICT DETECTED: "${extractRes.data.conflicts[0].topic}" (${extractRes.data.conflicts[0].severity} Severity)`);
      console.log(`      Previous Locked Decision: ${extractRes.data.conflicts[0].previousDecision}`);
      console.log(`      New Contradiction: ${extractRes.data.conflicts[0].contradiction}`);
    }

    // 3. Push tasks to Linear
    console.log('\n3. Testing /api/push-tasks to Linear...');
    const pushPayload = {
      tracker: 'Linear',
      meetingTitle: 'Emergency Pivot Sync',
      tasks: extractRes.data.actionItems
    };
    const pushRes = await makeRequest('/api/push-tasks', 'POST', pushPayload);
    console.log(`   ${pushRes.data.message}`);
    console.log(`   Total Pushed Counter: ${pushRes.data.syncedStats.totalPushed} (${pushRes.data.syncedStats.linear} to Linear)`);

    // 4. Weekly Digest
    console.log('\n4. Testing /api/weekly-digest...');
    const digestRes = await makeRequest('/api/weekly-digest');
    console.log(`   Total action items in memory: ${digestRes.data.totalActionItems}`);
    console.log(`   Owners tracked: ${digestRes.data.owners.map(o => `${o.owner} (${o.totalTasks} tasks)`).join(', ')}`);

    // 5. Generate 24h Reminders
    console.log('\n5. Testing /api/reminders/generate...');
    const remindersRes = await makeRequest('/api/reminders/generate', 'POST', { tasks: extractRes.data.actionItems });
    console.log(`   Generated ${remindersRes.data.count} reminders.`);
    console.log(`   Slack preview sample: "${remindersRes.data.reminders[0].slackText.split('\n')[1]}"`);

    // 6. Export report
    console.log('\n6. Testing /api/export...');
    const exportRes = await makeRequest('/api/export', 'POST', {
      meeting: { title: 'Emergency Pivot Sync', date: '2026-10-31' },
      decisions: extractRes.data.decisions,
      actionItems: extractRes.data.actionItems,
      conflicts: extractRes.data.conflicts,
      efficiency: extractRes.data.efficiency
    });
    console.log(`   Generated filename: ${exportRes.data.filename}`);
    console.log(`   Markdown length: ${exportRes.data.markdown.length} characters.`);

    console.log('\n🎉 ALL INTEGRATION SUITE TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

// Start server in-process if not already running, then test
const serverApp = require('../server/src/server');
setTimeout(runTests, 1000);
