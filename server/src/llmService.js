const db = require('./db');
const { heuristicExtract, scoreEfficiency, FILLER_RE } = require('./extractionEngine');
const { detectConflicts, mergeConflicts } = require('./conflictEngine');

function cleanWisprFlowTranscript(text) {
  if (!text) return { cleanedText: '', fillersFound: 0, originalLength: 0 };
  const fillersFound = (text.match(FILLER_RE) || []).length;
  return {
    cleanedText: text.trim(),
    fillersFound,
    originalLength: text.length
  };
}

function ensureShape(result, transcript, title, pastDecisions) {
  const decisions = Array.isArray(result?.decisions) ? result.decisions : [];
  const actionItems = Array.isArray(result?.actionItems) ? result.actionItems : [];
  const heuristicConflicts = detectConflicts(transcript, decisions, pastDecisions);
  const conflicts = mergeConflicts(result?.conflicts || [], heuristicConflicts);

  const wordCount = String(transcript).split(/\s+/).filter(Boolean).length;
  const detectedFillers = (String(transcript).match(FILLER_RE) || []).length;
  const speakers = [...new Set(actionItems.map(t => t.owner).filter(Boolean))];

  const efficiency = result?.efficiency && typeof result.efficiency.score === 'number'
    ? result.efficiency
    : scoreEfficiency({
        decisions,
        actionItems,
        conflicts,
        detectedFillers,
        wordCount,
        lineCount: String(transcript).split('\n').filter(Boolean).length,
        speakers
      });

  return {
    decisions: decisions.map((d, i) => ({
      id: d.id || `dec-${Date.now()}-${i + 1}`,
      decision: d.decision,
      context: d.context || `Extracted from ${title}`,
      category: d.category || 'Strategy',
      impactedComponents: d.impactedComponents || ['Core Service'],
      status: d.status || 'Active'
    })),
    actionItems: actionItems.map((t, i) => ({
      id: t.id || `task-${Date.now()}-${i + 1}`,
      title: t.title,
      owner: t.owner || 'Unassigned',
      deadline: t.deadline || '2026-11-07',
      priority: t.priority || 'Medium',
      status: t.status || 'Pending',
      tracker: t.tracker || 'Linear'
    })),
    conflicts,
    efficiency
  };
}

function runHeuristic(transcript, title, pastDecisions) {
  const extracted = heuristicExtract(transcript, title);
  const conflicts = detectConflicts(transcript, extracted.decisions, pastDecisions);
  const efficiency = scoreEfficiency({
    decisions: extracted.decisions,
    actionItems: extracted.actionItems,
    conflicts,
    detectedFillers: extracted.detectedFillers,
    wordCount: extracted.wordCount,
    lineCount: extracted.lineCount,
    speakers: extracted.speakers
  });
  return {
    decisions: extracted.decisions,
    actionItems: extracted.actionItems,
    conflicts,
    efficiency
  };
}

async function extractMeetingIntelligence(transcript, title = 'Spoken Sync') {
  const pastDecisions = db.getActiveDecisions();
  const cleaned = cleanWisprFlowTranscript(transcript);

  const geminiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '' ? process.env.GEMINI_API_KEY.trim() : null;
  const openAiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '' ? process.env.OPENAI_API_KEY.trim() : null;

  if (geminiKey) {
    try {
      console.log('[llmService] Calling Gemini API securely with environment variable...');
      const geminiResult = await callGeminiAPI(transcript, title, pastDecisions, geminiKey);
      if (geminiResult && geminiResult.decisions) {
        return {
          ...ensureShape(geminiResult, transcript, title, pastDecisions),
          provider: 'Google Gemini 1.5/2.0 (Secure Backend Proxy)',
          fillerWordCount: cleaned.fillersFound
        };
      }
    } catch (err) {
      console.error('[llmService] Gemini API call failed, switching to resilient voice NLP engine:', err.message);
    }
  } else if (openAiKey) {
    try {
      console.log('[llmService] Calling OpenAI API securely with environment variable...');
      const openAiResult = await callOpenAiAPI(transcript, title, pastDecisions, openAiKey);
      if (openAiResult && openAiResult.decisions) {
        return {
          ...ensureShape(openAiResult, transcript, title, pastDecisions),
          provider: 'OpenAI GPT-4o (Secure Backend Proxy)',
          fillerWordCount: cleaned.fillersFound
        };
      }
    } catch (err) {
      console.error('[llmService] OpenAI API call failed, switching to resilient voice NLP engine:', err.message);
    }
  }

  console.log('[llmService] Utilizing Heuristic Voice NLP & Cross-Meeting Conflict Engine');
  const result = runHeuristic(transcript, title, pastDecisions);
  return {
    ...result,
    provider: 'Wispr Flow Heuristic Engine (Local Fallback - configure GEMINI_API_KEY in server/.env for live LLM)',
    fillerWordCount: cleaned.fillersFound
  };
}

async function callGeminiAPI(transcript, title, pastDecisions, apiKey) {
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `You are the core intelligence of "Meeting Sync Agent", an AI meeting-to-execution system.
You receive a raw spoken meeting transcript captured via Wispr Flow voice dictation. The text may have conversational fillers ("um", "like", "you know"), false starts, self-corrections, and speaker labels.

PAST ACTIVE DECISIONS IN MEMORY:
${JSON.stringify(pastDecisions, null, 2)}

CURRENT MEETING TITLE: "${title}"
CURRENT TRANSCRIPT:
"""
${transcript}
"""

YOUR INSTRUCTIONS:
1. Parse and extract all KEY DECISIONS made during the conversation. Ignore water-cooler chatter.
2. Parse and map all ACTION ITEMS to specific owners and realistic deadlines (YYYY-MM-DD). If no exact year is stated, assume 2026. Honor self-corrections ("wait, actually no..."). Write titles as imperative tasks, not full spoken sentences. Prioritize High/Medium/Low.
3. CROSS-MEETING CONFLICT DETECTION: Compare the current transcript against the PAST ACTIVE DECISIONS listed above. If the transcript contradicts an earlier decision (e.g. changing launch dates, dropping features previously promised, switching tech stacks), identify it as a conflict with previousDecision, contradiction, severity ("High"|"Critical"|"Medium"), reason, and impactedOwners.
4. Calculate an action-oriented MEETING EFFICIENCY SCORE (0-100), action-to-talk ratio, filler words detected, and a sharp constructive critique.

Return ONLY a single valid JSON object with this exact shape:
{
  "decisions": [
    {
      "id": "dec-1",
      "decision": "string",
      "context": "string",
      "category": "Timeline|Feature Scope|Infrastructure|Strategy",
      "impactedComponents": ["component1"],
      "status": "Active"
    }
  ],
  "actionItems": [
    {
      "id": "task-1",
      "title": "string",
      "owner": "Person Name",
      "deadline": "YYYY-MM-DD",
      "priority": "High|Medium|Low",
      "status": "Pending",
      "tracker": "Linear|Jira|Asana"
    }
  ],
  "conflicts": [
    {
      "id": "conf-1",
      "topic": "string",
      "previousDecision": "string",
      "previousDecisionId": "string",
      "previousMeetingTitle": "string",
      "contradiction": "string",
      "severity": "High|Critical|Medium",
      "reason": "string",
      "impactedOwners": ["Person"],
      "status": "Active"
    }
  ],
  "efficiency": {
    "score": 85,
    "actionToTalkRatio": "78%",
    "fillerWordCount": 12,
    "talkTimeEstimatedMin": 25,
    "critique": "string"
  }
}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(textOutput);
}

async function callOpenAiAPI(transcript, title, pastDecisions, apiKey) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const systemMessage = `You are Meeting Sync Agent. Analyze the spoken Wispr Flow transcript, compare with past decisions in memory for contradictions, extract decisions and action items with owners and deadlines, and compute an efficiency score. Always return pure JSON. Ignore chatter. Honor self-corrections.`;
  const userMessage = `PAST DECISIONS: ${JSON.stringify(pastDecisions)}\n\nTITLE: ${title}\n\nTRANSCRIPT:\n${transcript}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

module.exports = {
  extractMeetingIntelligence,
  cleanWisprFlowTranscript
};
