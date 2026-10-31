const FILLER_RE = /\b(uh|um|umm|uhh|er|ah|like|you know|sort of|kind of|i mean|basically|actually|right|so yeah|yeah)\b/gi;

// Used ONLY for counting. Identical to the live counter in the transcript box so the numbers always match.
const COUNT_FILLER_RE = /\b(uh|um|umm|uhh|like|you know|basically|so yeah|wait no|scratch that)\b/gi;
const countFillers = (text) => (String(text || '').match(COUNT_FILLER_RE) || []).length;

const KNOWN_OWNERS = ['Marcus', 'Lena', 'Priya', 'Sarah', 'David'];

const CHATTER_RE = /\b(champions league|espresso|coffee machine|caffeine|just kidding|haha|lol|mic check|let'?s wrap up|who is getting coffee)\b/i;

const DECISION_RE = /\b(we decided|we have decided|decided to|agreed|locked in|final call|moving forward with|resolution:|we will (delay|drop|adopt|migrate|include|ship|cut|postpone))\b/i;

const ACTION_RE = /\b(i will|i'll|i am going to|take ownership|assigned to|action items?:|make sure you|needs? to|should complete|will (complete|deliver|update|audit|redesign|finalize|conduct|coordinate|test))\b/i;

function isoDate(year, monthIndex, day) {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toIso(date) {
  return isoDate(date.getFullYear(), date.getMonth(), date.getDate());
}

function nextWeekday(referenceDate, weekday) {
  const d = new Date(referenceDate);
  const delta = (weekday + 7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return toIso(d);
}

function parseDeadline(text, referenceDate = new Date()) {
  const l = text.toLowerCase();
  const monthMap = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
    nov: 10, november: 10, dec: 11, december: 11
  };

  const named = l.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/);
  if (named) {
    const key = named[1].replace('.', '').toLowerCase();
    const month = monthMap[key] ?? monthMap[key.slice(0, 3)];
    const day = parseInt(named[2], 10);
    const year = named[3] ? parseInt(named[3], 10) : referenceDate.getFullYear();
    if (month !== undefined) {
      let y = year;
      if (!named[3]) {
        const startToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
        if (new Date(y, month, day) < addDays(startToday, -1)) y += 1; // already passed -> means next year
      }
      return isoDate(y, month, day);
    }
  }

  if (/\btomorrow\b/.test(l)) return toIso(addDays(referenceDate, 1));
  if (/\bfriday\b/.test(l)) return nextWeekday(referenceDate, 5);
  if (/\bmonday\b/.test(l)) return nextWeekday(referenceDate, 1);
  if (/\bnext week\b/.test(l)) return toIso(addDays(referenceDate, 7));
  return toIso(addDays(referenceDate, 7));
}

function stripSpeaker(line) {
  const match = String(line || '').match(/^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?):\s*(.*)$/);
  if (match) return { speaker: match[1].trim(), text: match[2].trim() };
  return { speaker: null, text: String(line || '').trim() };
}

function applySelfCorrections(text) {
  let t = text;
  t = t.replace(/instead of [^,]+,\s*/i, '');
  const correction = t.search(/\b(wait,?\s*actually\s+no|scratch that|wait,?\s*no|forget (?:what|that) (?:we|i) said)\b/i);
  if (correction >= 0) {
    t = t.slice(correction).replace(/^(wait,?\s*actually\s+no|scratch that|wait,?\s*no|forget (?:what|that) (?:we|i) said)[,.\s]*/i, '');
  }
  return t.replace(/^\.+/, '').trim();
}

function stripFillers(text) {
  return text
    .replace(FILLER_RE, ' ')
    .replace(/^(wait|so|well|okay|ok|hold on)[,.]?\s+/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferOwner(text, speaker) {
  const lower = text.toLowerCase();
  for (const name of KNOWN_OWNERS) {
    if (lower.includes(name.toLowerCase())) return name;
  }
  if (/\b(i will|i'll|i am going to|action item for me)\b/i.test(text) && speaker) {
    return speaker.split(' ')[0];
  }
  if (speaker && /\b(i will|i'll|make sure you)\b/i.test(text)) {
    return speaker.split(' ')[0];
  }
  return speaker ? speaker.split(' ')[0] : 'Unassigned';
}

function inferPriority(text) {
  const l = text.toLowerCase();
  if (/\b(urgent|security|critical|asap|blocker|audit|emergency)\b/.test(l)) return 'High';
  if (/\b(nice to have|whenever|later|low priority)\b/.test(l)) return 'Low';
  return 'Medium';
}

function categorizeDecision(text) {
  const l = text.toLowerCase();
  if (/\b(apple pay|google pay|checkout|feature|modal|tailwind|navbar|dropdown|scope)\b/.test(l)) return 'Feature Scope';
  if (/\b(api|security|database|infra|aws|replica|cluster|auth|devops)\b/.test(l)) return 'Infrastructure';
  if (/\b(date|launch|release|december|november|timeline|deadline|postpone|delay)\b/.test(l)) return 'Timeline';
  return 'Strategy';
}

function impactedFor(category) {
  if (category === 'Timeline') return ['Release Schedule', 'Marketing'];
  if (category === 'Feature Scope') return ['Web Client', 'Checkout'];
  if (category === 'Infrastructure') return ['Backend', 'Platform'];
  return ['Core Service'];
}

function toDecisionText(text) {
  let t = stripFillers(applySelfCorrections(text));
  t = t.replace(/^(so|yeah|well|okay|also|right)[,.]?\s+/i, '');
  t = t.replace(/^another tough call:\s*/i, '');
  t = t.replace(/^regarding [^,]+,\s*/i, '');
  t = t.replace(/\bwe (?:have )?decided to\s+/i, '');
  t = t.replace(/^we decided\s+/i, '');
  t = t.replace(/^agreed\.?\s*/i, '');
  t = t.replace(/^locked in\s+/i, '');
  t = t.replace(/^and\s+/i, '');
  if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
  t = t.replace(/[.?!]+$/, '');
  if (t.length > 180) t = t.slice(0, 177) + '...';
  return t;
}

function toTaskTitle(text, owner) {
  let t = applySelfCorrections(text);
  t = t.replace(/^[.\s]+/, '');
  t = stripFillers(t);
  t = t.replace(/action items?:\s*/i, '');
  t = t.replace(/action item for me:\s*/i, '');
  t = t.replace(/^if that'?s the (final )?call,?\s*(then\s+)?/i, '');
  t = t.replace(/^got it\.?\s*(and\s+)?/i, '');
  t = t.replace(/^(perfect|okay|great|cool|yeah)[,.]?\s*/i, '');
  t = t.replace(/^(and|also|then|so)\s+/i, '');
  if (owner) t = t.replace(new RegExp(`^(?:and\\s+)?${owner}\\s*,?\\s*`, 'i'), '');
  t = t.replace(/^(make sure you|you will|you should)\s+/i, '');
  t = t.replace(/\b(i will|i'll|i am going to|i'll take ownership of)\s+/i, '');
  t = t.replace(/^(will|should|needs? to)\s+/i, '');
  KNOWN_OWNERS.forEach(name => {
    t = t.replace(new RegExp(`^(?:and\\s+)?${name}\\s+will\\s+`, 'i'), '');
  });
  t = t.replace(/\s+by\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?\.?$/i, '');
  t = t.replace(/\s+before\s+(friday|monday|tomorrow)\.?$/i, '');
  t = t.replace(/^[,\s.]+/, '');
  if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
  t = t.replace(/[.?!]+$/, '');
  if (t.length > 90) t = t.slice(0, 87) + '...';
  return t || text.slice(0, 90);
}

function isChatter(text) {
  return CHATTER_RE.test(text);
}

function isDecisionLine(text) {
  if (isChatter(text)) return false;
  if (/\b(i will|i'll)\b/i.test(text) && !/\b(we decided|decided to)\b/i.test(text)) return false;
  return DECISION_RE.test(text);
}

function isActionLine(text) {
  if (isChatter(text)) return false;
  const l = text.toLowerCase();
  if (/^we will\b/.test(l) && !/\b(i will|i'll|marcus|lena|priya|sarah|david)\b/.test(l)) return false;
  if (/\bthat will\b/.test(l) && !ACTION_RE.test(text)) return false;
  return ACTION_RE.test(text) ||
    (/\b(i will|i'll)\b/.test(l)) ||
    (/\b(marcus|lena|priya|sarah|david)\b/.test(l) && /\b(will|should|make sure|needs to)\b/.test(l));
}

function explodeUtterances(transcript) {
  const lines = String(transcript || '').split('\n').map(l => l.trim()).filter(Boolean);
  const utterances = [];
  for (const line of lines) {
    const { speaker, text } = stripSpeaker(line);
    const chunks = text
      .split(/(?=\bAction items?:)/i)
      .flatMap(part => part.split(/(?<=[.!?])\s+(?=[A-Z])/))
      .map(c => c.trim())
      .filter(Boolean);
    for (const chunk of chunks) {
      utterances.push({ speaker, text: chunk, raw: line });
    }
  }
  return utterances;
}

function collectSpeakers(transcript) {
  const speakers = new Set();
  for (const line of String(transcript || '').split('\n')) {
    const { speaker } = stripSpeaker(line);
    if (speaker) speakers.add(speaker.split(' ')[0]);
  }
  return speakers;
}

function heuristicExtract(transcript, title = 'Spoken Sync') {
  const utterances = explodeUtterances(transcript);
  const speakersFound = collectSpeakers(transcript);
  const decisions = [];
  const actionItems = [];
  const seenDecisions = new Set();
  const seenTasks = new Set();
  let decCounter = 1;
  let taskCounter = 1;
  // Counted per speaker TURN (a line of the transcript), not per sentence
  const substantiveTurns = new Set();
  const actionableTurns = new Set();

  for (const utt of utterances) {
    const corrected = applySelfCorrections(utt.text);
    if (!corrected || isChatter(corrected)) continue;
    substantiveTurns.add(utt.raw);
    const beforeCount = decisions.length + actionItems.length;

    if (isDecisionLine(corrected)) {
      const decisionText = toDecisionText(corrected);
      const key = decisionText.toLowerCase();
      if (decisionText && !seenDecisions.has(key)) {
        seenDecisions.add(key);
        const category = categorizeDecision(decisionText);
        decisions.push({
          id: `dec-${Date.now()}-${decCounter++}`,
          decision: decisionText,
          context: `Spoken by ${utt.speaker || 'team'} in "${title}"`,
          category,
          impactedComponents: impactedFor(category),
          status: 'Active'
        });
      }
    }

    if (isActionLine(corrected)) {
      const owner = inferOwner(corrected, utt.speaker);
      const titleText = toTaskTitle(corrected, owner);
      const key = `${owner}:${titleText.toLowerCase()}`;
      const tooGeneric = /ownership of that|^that$|sounds solid/i.test(titleText);
      if (titleText && !tooGeneric && !seenTasks.has(key) && titleText.length > 12) {
        seenTasks.add(key);
        actionItems.push({
          id: `task-${Date.now()}-${taskCounter++}`,
          title: titleText,
          owner,
          deadline: parseDeadline(corrected),
          priority: inferPriority(corrected),
          status: 'Pending',
          tracker: 'Linear'
        });
      }
    }
    if (decisions.length + actionItems.length > beforeCount) actionableTurns.add(utt.raw);
  }

  if (decisions.length === 0 && String(transcript).length > 20) {
    decisions.push({
      id: `dec-${Date.now()}-1`,
      decision: `Capture follow-ups from ${title}`,
      context: 'No explicit decision verb found; logged alignment from spoken sync',
      category: 'Strategy',
      impactedComponents: ['Core Service'],
      status: 'Active'
    });
  }

  if (actionItems.length === 0 && String(transcript).length > 20) {
    actionItems.push({
      id: `task-${Date.now()}-1`,
      title: 'Document and circulate meeting execution roadmap to all attendees',
      owner: speakersFound.size > 0 ? Array.from(speakersFound)[0] : 'Priya',
      deadline: parseDeadline('next week'),
      priority: 'Medium',
      status: 'Pending',
      tracker: 'Linear'
    });
  }

  const wordCount = String(transcript).split(/\s+/).filter(Boolean).length;
  const detectedFillers = countFillers(transcript);

  return {
    decisions,
    actionItems,
    speakers: Array.from(speakersFound),
    wordCount,
    detectedFillers,
    lineCount: utterances.length,
    substantiveCount: substantiveTurns.size,
    actionableCount: actionableTurns.size
  };
}

function scoreEfficiency({
  decisions = [], actionItems = [], conflicts = [], detectedFillers = 0,
  wordCount = 0, lineCount = 0, speakers = [], substantiveCount, actionableCount
}) {
  // Action-to-talk: what share of the meaningful spoken turns produced a decision or an owned action item.
  const substantive = Math.max(1, substantiveCount ?? lineCount ?? 1);
  const actionable = actionableCount ?? Math.min(substantive, decisions.length + actionItems.length);
  const ratioPct = Math.max(0, Math.min(100, Math.round((actionable / substantive) * 100)));

  const owned = actionItems.filter(t => t.owner && t.owner !== 'Unassigned').length;
  const allOwned = actionItems.length > 0 && owned === actionItems.length;
  const openConflicts = (conflicts || []).filter(c => !c.status || c.status === 'Active' || c.status === 'Flagged').length;

  const fillerRatio = detectedFillers / Math.max(wordCount, 1);

  // Every point in the score is explainable - the UI shows this breakdown.
  const breakdown = [
    { label: 'Baseline', points: 50 },
    { label: `${decisions.length} decision${decisions.length === 1 ? '' : 's'}`, points: Math.min(decisions.length * 6, 18) },
    { label: `${actionItems.length} action item${actionItems.length === 1 ? '' : 's'}`, points: Math.min(actionItems.length * 5, 25) },
    { label: 'Action-to-talk', points: Math.round((ratioPct / 100) * 15) },
    { label: 'Every task has an owner', points: allOwned ? 8 : 0 },
    { label: 'Filler noise', points: -Math.min(Math.round(fillerRatio * 100), 8) },
    { label: `${openConflicts} contradiction${openConflicts === 1 ? '' : 's'}`, points: -Math.min(openConflicts * 12, 36) }
  ].filter(b => b.points !== 0 || b.label === 'Baseline');

  const rawScore = breakdown.reduce((sum, b) => sum + b.points, 0);
  const score = Math.max(30, Math.min(98, rawScore));
  const grade = score >= 80 ? 'High Execution Velocity' : score >= 60 ? 'Moderate Output' : 'Action Friction';

  const people = (speakers && speakers.length ? speakers : [...new Set(actionItems.map(t => t.owner).filter(Boolean))]).join(', ') || 'the team';
  let critique;
  if (openConflicts > 0) {
    critique = `The meeting produced ${actionItems.length} action item${actionItems.length === 1 ? '' : 's'} and ${decisions.length} decision${decisions.length === 1 ? '' : 's'}, but ${openConflicts} contradict locked decisions from earlier meetings. Reconcile the date and scope changes before pushing anything to the tracker.`;
  } else if (score >= 80) {
    critique = `Strong execution: ${actionItems.length} action item${actionItems.length === 1 ? '' : 's'} with clear owners (${people}) and ${decisions.length} decision${decisions.length === 1 ? '' : 's'}, with ${ratioPct}% of meaningful turns turning into commitments. Wispr Flow filtered ${detectedFillers} filler words.`;
  } else if (actionItems.length < 3) {
    critique = `Only ${actionItems.length} action item${actionItems.length === 1 ? '' : 's'} came out of this meeting (${ratioPct}% action-to-talk). Add explicit owners and hard deadlines before closing the call to lift velocity.`;
  } else {
    critique = `Decent output (${actionItems.length} action items) but only ${ratioPct}% of the conversation turned into commitments. Cut digressions and confirm owners out loud to raise the score.`;
  }

  return {
    score,
    grade,
    actionToTalkRatio: `${ratioPct}%`,
    actionToTalkPct: ratioPct,
    fillerWordCount: detectedFillers,
    talkTimeEstimatedMin: Math.max(1, Math.round(wordCount / 130)),
    breakdown,
    critique
  };
}

module.exports = {
  heuristicExtract,
  scoreEfficiency,
  parseDeadline,
  stripFillers,
  countFillers,
  FILLER_RE
};
