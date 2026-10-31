# Pass 2: Weekly Digest, Conflict Management, Efficiency Report

## Efficiency report
| Problem | Fix |
|---|---|
| Action-to-Talk Ratio was **92% for every transcript** (capped formula) | Real ratio: share of speaker turns that produced a decision or task |
| Score / grade / critique could disagree (81 = "High Velocity" but critique said "Moderate") | One deterministic scorer; critique is generated from the same numbers |
| Score was a black box | Every point is shown ("How the score was built"); also exported to Markdown |
| Filler count differed between the transcript box (4) and the report (5) | Same regex on both sides |
| Tab showed a hard-coded "86 sample" and lost everything on refresh | Efficiency is saved with each meeting; tab reads the vault |
| Only the current meeting could be viewed | New cross-meeting scoreboard (avg, trend, per-meeting breakdown) |
| Export lost resolved conflicts | Export includes all conflicts + how each was resolved; new one-click **Weekly Report** |

## Conflict management
| Problem | Fix |
|---|---|
| "Flag for Review" was a dead end (never resolvable) | Flagged queue on the Conflicts tab: Accept new / Keep original any time |
| No overview | Open / Flagged / Resolved tiles + audit trail with timestamps; nav badge shows flagged count |
| "New date" in a contradiction could be the old locked date | Picks the first date that differs from the locked decision |
| Conflicts had no effect elsewhere | Digest + Weekly Report flag tasks from meetings with unresolved conflicts |
| Efficiency critique stayed "reconcile before pushing" after resolving | Card updates the critique once all conflicts are resolved |

## Weekly digest
Headline summary, overall completion bar, **Needs attention** list (open conflicts, overdue, due soon, high-priority unpushed), per-owner overdue counts, *Conflict pending* tags, relative due dates, **Copy digest** and **Export weekly report**.

## Demo robustness
- Seed data is generated relative to today (no stale "overdue" on demo day) and has a second meeting so the digest and efficiency report have real content.
- Spoken dates that already passed ("Nov 10th" said in December) roll to next year.
- `start-demo.bat` / `start-demo.sh` start everything in one process; see `DEMO.md`.
- `node scripts/test-demo-flow.cjs` now runs 39 checks.

---

# What was fixed (demo-readiness pass)

## Bugs fixed
| Area | Problem | Fix |
|---|---|---|
| Wispr "Desktop History" | `GET /api/wispr/desktop-history` crashed (500) - `getDesktopHistory` didn't exist | Implemented in `wisprDesktopSync.js` |
| Re-extracting a meeting | New meeting's own saved decisions counted as "locked memory" -> it contradicted itself (4 conflicts instead of 2) | Re-run replaces the meeting; own earlier version is excluded from memory |
| Conflict buttons | "Retain Original" left the contradicting decision **Active** in the vault | Real semantics: **Overwrite** = old Superseded + new Active, **Retain Original** = new Rejected, **Flag** = new Flagged. Unresolved new decisions sit as *Pending Review* |
| Conflict UI | Red banner rendered twice on the Conflicts tab; stale/ghost conflicts after vault reset/delete | One banner, vault is source of truth, audit trail of resolutions added |
| Review & Push | Inline edits (title/owner/deadline) never reached the vault, so Digest/Reminders were stale | Edits persisted (`PUT /api/meetings/:id/tasks` + merge on push) |
| Simulated tracker keys | Random `JIRA-###` could collide (two tasks, same key) | Sequential unique keys (LIN-103, JIRA-410 ...) |
| 24h Reminders | No real send time, `[T-PENDING]` text, dead Slack buttons, raw `*asterisks*`, unescaped HTML | Real `sendAt` = deadline-24h, status (Scheduled / Due within 24h / Overdue), working buttons, Slack formatting rendered, HTML escaped, "Schedule All" |
| Weekly Digest | Plain list | Summary tiles, due-this-week / overdue flags, sorted by deadline, refresh + error state |
| Wispr sync on a machine without Wispr | Blocking `alert()` dead-end | Falls back to the latest Notetaker session with an inline notice |
| API client | Errors from the server were swallowed | One `request()` helper with real error messages + localhost:5000 fallback |
| Gemini | Invalid `GEMINI_MODEL` (your `.env` has `gemini-3.8-flash`) -> silent fallback to offline engine | Tries configured model, then `gemini-2.5-flash`, `gemini-2.0-flash`; tolerant JSON parsing |
| Extension | `client/dist` was older than `client/src` | Rebuilt |

## Verify before you present
```
cd server && npm install && npm start        # terminal 1
node scripts/test-demo-flow.cjs              # terminal 2  (24 checks)
```
Note: the tests call "reset demo", so run them *before* your demo, not after.
For a clean demo state click **Memory Vault -> Reset Demo Seed**.

## Rebuild the extension after any client edit
`cd client && npm install && npm run build`, then reload it at `chrome://extensions`.
