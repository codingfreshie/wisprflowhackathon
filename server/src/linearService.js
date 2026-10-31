const LINEAR_API = 'https://api.linear.app/graphql';

function simulateLinearPush(tasks, tracker = 'Linear') {
  const prefixes = { Linear: 'LIN', Jira: 'JIRA', Asana: 'ASN', Notion: 'NOT' };
  const prefix = prefixes[tracker] || 'TSK';
  return tasks.map((task) => {
    const externalId = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
    return {
      ...task,
      status: 'Synced',
      tracker,
      externalId,
      syncedAt: new Date().toISOString(),
      externalUrl: tracker === 'Linear'
        ? `https://linear.app/issue/${externalId}`
        : `https://${tracker.toLowerCase()}.app/issue/${externalId}`,
      simulated: true
    };
  });
}

function linearPriority(priority) {
  if (priority === 'High') return 2;
  if (priority === 'Low') return 4;
  return 3;
}

async function linearGraphql(apiKey, query, variables = {}) {
  const response = await fetch(LINEAR_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey
    },
    body: JSON.stringify({ query, variables })
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) {
    const message = payload.errors?.[0]?.message || `Linear HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload.data;
}

async function resolveTeamId(apiKey) {
  if (process.env.LINEAR_TEAM_ID && process.env.LINEAR_TEAM_ID.trim()) {
    return process.env.LINEAR_TEAM_ID.trim();
  }
  const data = await linearGraphql(apiKey, `query { teams { nodes { id name } } }`);
  const team = data?.teams?.nodes?.[0];
  if (!team) throw new Error('No Linear team available. Set LINEAR_TEAM_ID in server/.env');
  return team.id;
}

async function createLinearIssue(apiKey, teamId, task, meetingTitle) {
  const mutation = `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url title }
      }
    }
  `;
  const data = await linearGraphql(apiKey, mutation, {
    input: {
      teamId,
      title: task.title,
      description: [
        `Imported from Meeting Sync Agent`,
        `Meeting: ${meetingTitle}`,
        `Owner: ${task.owner || 'Unassigned'}`,
        `Deadline: ${task.deadline || 'TBD'}`,
        `Priority: ${task.priority || 'Medium'}`
      ].join('\n'),
      dueDate: task.deadline || undefined,
      priority: linearPriority(task.priority)
    }
  });
  const issue = data?.issueCreate?.issue;
  if (!issue) throw new Error('Linear issueCreate returned no issue');
  return issue;
}

async function pushTasks({ tasks, tracker = 'Linear', meetingTitle = 'Meeting Sync' }) {
  const apiKey = process.env.LINEAR_API_KEY && process.env.LINEAR_API_KEY.trim();
  if (tracker !== 'Linear' || !apiKey) {
    return {
      pushedTasks: simulateLinearPush(tasks, tracker),
      live: false,
      reason: tracker !== 'Linear'
        ? `${tracker} uses simulated webhook delivery in this demo`
        : 'LINEAR_API_KEY not set — simulated Linear identifiers generated'
    };
  }

  try {
    const teamId = await resolveTeamId(apiKey);
    const pushedTasks = [];
    for (const task of tasks) {
      const issue = await createLinearIssue(apiKey, teamId, task, meetingTitle);
      pushedTasks.push({
        ...task,
        status: 'Synced',
        tracker: 'Linear',
        externalId: issue.identifier,
        externalUrl: issue.url,
        syncedAt: new Date().toISOString(),
        simulated: false
      });
    }
    return { pushedTasks, live: true, reason: null };
  } catch (err) {
    console.error('[linearService] Live Linear push failed, falling back to simulation:', err.message);
    return {
      pushedTasks: simulateLinearPush(tasks, 'Linear'),
      live: false,
      reason: `Linear API error: ${err.message}. Generated simulated issue keys instead.`
    };
  }
}

function isLinearConfigured() {
  return Boolean(process.env.LINEAR_API_KEY && process.env.LINEAR_API_KEY.trim());
}

module.exports = {
  pushTasks,
  isLinearConfigured
};
