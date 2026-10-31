function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractFeaturePhrases(text) {
  const phrases = [];
  const proper = text.match(/\b(?:Apple Pay|Google Pay|PCI-DSS|Tailwind CSS(?: v\d+)?|AWS region|Auth Service|checkout modal|zero-downtime(?: database migration)?)\b/gi);
  if (proper) phrases.push(...proper);
  return [...new Set(phrases.map(p => p.trim()))];
}

function extractDateHints(text) {
  const l = String(text).toLowerCase();
  const hints = [];
  const named = l.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?/g);
  if (named) hints.push(...named);
  const iso = l.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  if (iso) hints.push(...iso);
  return hints;
}

function datesConflict(pastText, currentText) {
  const pastDates = extractDateHints(pastText);
  const newDates = extractDateHints(currentText);
  if (pastDates.length === 0 || newDates.length === 0) return false;
  const normalize = (d) => d.replace(/(st|nd|rd|th)/g, '').replace(/\s+/g, ' ').trim();
  return normalize(pastDates[0]) !== normalize(newDates[0]);
}

function isActiveDecision(decision) {
  return !decision.status || decision.status === 'Active';
}

function buildConflict({ past, topic, contradiction, severity, reason, transcript }) {
  const owners = [];
  const haystack = `${past.decision} ${contradiction} ${transcript}`.toLowerCase();
  ['Marcus', 'Lena', 'Priya', 'Sarah', 'David'].forEach(name => {
    if (haystack.includes(name.toLowerCase())) owners.push(name);
  });
  return {
    id: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    topic,
    previousDecision: past.decision,
    previousDecisionId: past.id,
    previousMeetingTitle: past.meetingTitle || 'Prior stored meeting',
    contradiction,
    severity,
    reason,
    impactedOwners: owners.length ? owners : ['Marcus', 'Lena', 'Priya'],
    status: 'Active'
  };
}

function detectConflicts(transcript, newDecisions = [], pastDecisions = []) {
  const activePast = (pastDecisions || []).filter(isActiveDecision);
  const combinedNew = [
    transcript,
    ...(newDecisions || []).map(d => d.decision)
  ].join('\n');
  const combinedLower = combinedNew.toLowerCase();
  const conflicts = [];

  const delayLanguage = /\b(delay|postpone|push back|slip|cannot hit|can't hit|won't make|forget what we said|push the (launch|release))\b/i.test(combinedNew);

  for (const past of activePast) {
    const pastLower = String(past.decision || '').toLowerCase();
    const isTimeline = past.category === 'Timeline' || /\b(launch date|release date|target q4|lock target)\b/.test(pastLower);

    if (isTimeline && delayLanguage) {
      const newDateHint = extractDateHints(combinedNew)[0];
      conflicts.push(buildConflict({
        past,
        topic: 'Launch Date Contradiction',
        contradiction: newDateHint
          ? `New meeting proposes moving the launch/release to ${newDateHint}`
          : 'New meeting proposes delaying or postponing the locked launch timeline',
        severity: 'High',
        reason: `Direct contradiction with locked timeline: "${past.decision}"`,
        transcript
      }));
    }

    const features = extractFeaturePhrases(past.decision);
    for (const feature of features) {
      const dropRe = new RegExp(`\\b(drop|cut|skip|remove|omit|without|de-scope)\\b[^\\n]{0,40}\\b${escapeRegExp(feature)}\\b|\\b${escapeRegExp(feature)}\\b[^\\n]{0,40}\\b(drop|cut|skip|remove|out of v1)\\b`, 'i');
      const wasCommitted = /\b(must|include|mandatory|lock|required|need to)\b/i.test(past.decision) || past.category === 'Feature Scope';
      if (wasCommitted && dropRe.test(combinedNew)) {
        conflicts.push(buildConflict({
          past,
          topic: `Scope Reduction: ${feature}`,
          contradiction: `Proposing dropping ${feature} from the current release`,
          severity: 'Critical',
          reason: `Violates prior commitment: "${past.decision}"`,
          transcript
        }));
      }
    }

    if (past.category === 'Infrastructure' && /\b(zero-downtime|database migration)\b/.test(pastLower)) {
      if (/\b(skip migration|accept downtime|no migration)\b/.test(combinedLower)) {
        conflicts.push(buildConflict({
          past,
          topic: 'Infrastructure Strategy Contradiction',
          contradiction: 'New meeting proposes abandoning the zero-downtime migration plan',
          severity: 'High',
          reason: 'Breaks the previously locked operational SLA strategy',
          transcript
        }));
      }
    }
  }

  const seen = new Set();
  return conflicts.filter(c => {
    const key = `${c.previousDecisionId}|${c.topic}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeConflicts(primary = [], secondary = []) {
  const merged = [];
  const seen = new Set();
  for (const c of [...primary, ...secondary]) {
    if (!c) continue;
    const key = `${c.previousDecisionId || ''}|${(c.topic || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(c);
  }
  return merged;
}

module.exports = {
  detectConflicts,
  mergeConflicts,
  extractFeaturePhrases
};
