# Demo cheat-sheet

## Run it (30 seconds)
Windows: double-click `start-demo.bat`  |  Mac/Linux: `./start-demo.sh`
Opens http://localhost:5000 (backend + dashboard in one process; no API key needed).

Before you hit record: **Memory Vault -> Reset Demo Seed**. This rebuilds the demo history relative to today's date.

## Click path (about 90 seconds)
1. **Wispr Flow Voice Ingestion** - Scenario 1 is already loaded. Click **Extract Decisions & Action Items**.
2. Red banner appears. On *Launch Date Contradiction* click **Retain Original**. On *Scope Reduction: Apple Pay* click **Flag for Review**.
3. **Cross-Meeting Conflicts** tab - show the Flagged queue + audit trail (you can still decide later).
4. **Weekly Digest** - headline, "Needs attention", owner groups, red *Conflict pending* tags. Click **Export weekly report**.
5. **Efficiency & Export** - scoreboard across meetings, click the newest row, point at "How the score was built".

## Voiceover script (read it naturally, ~90 sec)
> "Meetings are where decisions get made and then immediately forgotten. Meeting Sync Agent turns spoken meetings, captured with Wispr Flow, into tracked execution.
>
> Here's a raw voice transcript, full of ums, corrections and chit-chat. One click, and it pulls out the decisions and action items with owners and deadlines.
>
> But here's the part I care about: it remembers past meetings. This transcript says delay the launch and drop Apple Pay, and our memory says both were locked last week. So the agent stops me with a contradiction alert, showing the old decision next to the new one. I'll keep the original launch date, and flag Apple Pay for the team. Flagged items aren't lost, they sit in a review queue until someone makes the call, and every decision is logged in an audit trail.
>
> The Weekly Digest groups every deliverable by owner across all meetings, and tells me what needs attention: what's overdue, what's due tomorrow, and which tasks are sitting on an unresolved conflict. One click exports it as a weekly report.
>
> And the Efficiency report scores every meeting, not with a made-up number, but with a breakdown you can see: decisions, action-to-talk ratio, ownership, filler noise, and contradiction penalties.
>
> From voice to decisions to execution, with memory that keeps the team honest. Thanks for watching."

## Honest notes (in case a judge asks)
- Extraction runs on the built-in rule-based engine unless `GEMINI_API_KEY` is set in `server/.env` (then Gemini is used; scoring stays deterministic).
- Linear push is real only if `LINEAR_API_KEY` is set; Jira/Asana/Notion pushes are simulated.
