# 🎙️ Meeting Sync Agent (Wispr Flow Voice-to-Execution)

> **Problem Statement 03 — Meeting-to-Execution Agent**  
> An autonomous, secure AI agent that ingests spoken meeting transcripts, captures lost decisions, resolves cross-meeting contradictions, generates 24-hour reminder previews, and pushes confirmed deliverables into Linear, Jira, and Asana.

---

## 🌟 Key Highlights & Hackathon Alignment

| Requirement | Implementation in Meeting Sync Agent | Hackathon Focus |
| :--- | :--- | :--- |
| **1. Core Architecture & Security** | Chrome Extension (Manifest V3) + React/Tailwind Web Dashboard + Secure Node.js Backend Proxy using `process.env.GEMINI_API_KEY` or `OPENAI_API_KEY`. **Zero API keys exposed in frontend code.** | Strict Security & Multi-platform |
| **2. Wispr Flow Voice Workflow** | Built specifically for messy, natural spoken voice: conversational filler words (`"uh"`, `"um"`, `"basically"`), self-corrections (`"Wait, actually no..."`), and speaker turns (`Priya:`, `Marcus:`). Live mic dictation + Wispr Flow streaming simulator. | **Crucial 20% Score Weight** |
| **3. Cross-Meeting Memory & Conflicts** | Persistent historical knowledge vault. If a new transcript contradicts a past locked decision (e.g., slipping launch dates or dropping committed scope), an **eye-catching RED Conflict Warning Banner** is triggered with side-by-side reconciliation! | Problem Statement 03 Core |
| **4. Review & Push Gate** | Interactive confirmation checklist. Edit titles, reassign owners, pick deadlines, select target tracker (**Linear, Jira, Asana, Notion**), and click **"Confirm & Push"** to sync deliverables with live counters. | Safe Execution |
| **5. Automated 24h Reminders** | Generates simulated Slack (with `@mentions` and interactive action buttons) and Email HTML previews scheduled 24 hours prior to deliverable deadlines. | Proactive Follow-up |
| **6. Weekly Digest** | Aggregated view grouping all deliverables by owner (`Marcus`, `Lena`, `Priya`, `Sarah`) across all meetings with progress bars. | Cross-Meeting Visibility |
| **7. Efficiency Score & Export** | Quantified 0-100 Meeting Efficiency Score, Action-to-Talk ratio, Wispr Flow noise cleanliness metric, diagnostic critique, and **one-click Markdown report export**. | Execution Analytics |

---

## 🏗️ Project Architecture

```text
wisplrflowhackathon/
├── server/                          # Secure Backend Proxy & Persistent Memory Engine
│   ├── src/
│   │   ├── server.js                # Express REST API (CORS, health, extraction, push)
│   │   ├── llmService.js            # Secure LLM proxy (Gemini/OpenAI) + Voice NLP engine
│   │   └── db.js                    # Persistent JSON store for meetings, decisions & conflicts
│   ├── data/
│   │   └── meetings-store.json      # File-backed database pre-seeded with demo history
│   ├── .env.example                 # Config template for GEMINI_API_KEY
│   └── package.json
│
├── client/                          # Full-Stack Chrome Extension & Web Application
│   ├── public/
│   │   ├── manifest.json            # Chrome Extension Manifest V3
│   │   └── icons/                   # High-DPI extension icons (16, 48, 128, SVG)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx           # Live proxy status, synced counters & navigation
│   │   │   ├── VoiceIngestionTab.jsx # Wispr Flow voice input, mic dictate & scenario loader
│   │   │   ├── ConflictBanner.jsx   # Eye-catching Red Contradiction Banner & reconciliation
│   │   │   ├── DecisionsList.jsx    # Key decisions categorized with component impact
│   │   │   ├── ReviewPushModal.jsx  # Interactive checklist & Linear/Jira/Asana push
│   │   │   ├── RemindersTab.jsx     # 24-hour Slack and Email simulated previews
│   │   │   ├── WeeklyDigestTab.jsx  # Aggregated deliverables grouped by owner
│   │   │   ├── EfficiencyScoreCard.jsx # 0-100 Efficiency Score & Markdown exporter
│   │   │   └── MemoryVaultTab.jsx   # Historical meetings & decision memory browser
│   │   ├── data/sampleTranscripts.js# Realistic Wispr Flow scenarios for instant testing
│   │   ├── services/api.js          # API client (auto-detects extension or localhost)
│   │   ├── App.jsx                  # Main orchestrator application
│   │   └── main.jsx
│   ├── dist/                        # Pre-built, production-ready loadable Chrome Extension
│   ├── index.html                   # Web application entry point
│   ├── popup.html                   # Chrome Extension popup entry point
│   ├── vite.config.js               # Multi-target build configuration
│   └── tailwind.config.js
│
├── scripts/                         # Automated test & verification suite
│   ├── test-unit.cjs                # Verification of NLP engine, seed DB & conflict detection
│   └── generate-icons.cjs
├── start-backend.bat                # One-click Windows runner for Backend
└── start-web.bat                    # One-click Windows runner for Web Dashboard
```

---

## 🚀 Quick Start Guide

**Fastest:** run `start-demo.bat` (Windows) or `./start-demo.sh` and open http://localhost:5000. See `DEMO.md` for the click path and voiceover script.

### Step 1: Start the Secure Backend Proxy
The backend securely manages LLM keys and maintains the cross-meeting persistent memory:

```bash
cd server
npm install
npm start
```
*The server will start on `http://localhost:5000`.*  
*(Optional: Add your `GEMINI_API_KEY` to `server/.env` to unlock live Gemini Flash/Pro LLM calls. If left blank, the server automatically uses the built-in resilient Wispr Flow Voice NLP engine!)*

---

### Step 2: Run the Web Dashboard
For immediate browser demonstration and full-screen testing:

```bash
cd client
npm install
npm run dev
```
*Open `http://localhost:5173` in any browser.*

---

### Step 3: Load the Extension into Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle on **"Developer mode"** in the top-right corner.
3. Click the **"Load unpacked"** button in the top-left.
4. Select the directory:
   ```text
   d:\Neeharika_docs\wisplrflowhackathon\client\dist
   ```
5. Pin **"Meeting Sync Agent"** to your Chrome toolbar. Click the icon to launch the extension popup!

*(To rebuild the extension after edits, simply run `npm run build` in the `client/` folder).*

---

## 🎙️ Demonstrating the Wispr Flow & Voice Workflow

1. Navigate to the **"Wispr Flow Voice Ingestion"** tab.
2. Note the hackathon guidance tip:
   > *"Tip: Use Wispr Flow desktop or mic input to dictate raw meeting notes or capture Google Meet transcripts."*
3. **Test One-Click Scenarios**:
   - **Scenario 1: Emergency Pivot (Triggers Cross-Meeting Contradiction!)**
     - Click to load Priya's emergency sync where she proposes delaying the release to Dec 1st and dropping Apple Pay.
     - Click **"Extract Decisions & Action Items"** (or click **"Simulate Voice Stream"** to watch voice typing cadence).
     - **Result:** An **eye-catching red Conflict Warning Banner** immediately appears!
       - *Locked Historical Decision:* "Lock target Q4 launch date strictly for November 15, 2026 (from Sprint Kickoff)"
       - *New Spoken Contradiction:* "New meeting proposes delaying launch to December 1st"
       - *Actionable Options:* `Overwrite Memory`, `Retain Original`, or `Flag for Review`.
   - **Scenario 2: High-Velocity Sprint Kickoff**
     - Demonstrates Wispr Flow parsing conversational self-corrections (*"Wait, actually no... instead of redesigning the whole navbar, I will deliver the updated user profile dropdown component by Nov 9th"*), correctly attributing tasks to Lena and Marcus.
   - **Scenario 3: Conversational Chit-Chat & Digression Filtering**
     - Demonstrates filtering out water-cooler talk about soccer and broken coffee machines, focusing exclusively on core deliverables.

---

## 📋 The Execution Flow

### 1. Review & Push Checklist
- Extracted deliverables appear in an interactive checklist.
- Select/deselect tasks, edit titles, modify assignees (`Marcus`, `Lena`, `Priya`), change dates, and set priorities (`High`, `Medium`, `Low`).
- Pick your target tracker (**Linear**, **Jira**, **Asana**, **Notion**).
- Click **"Confirm & Push"** to simulate the webhook push. A success toast pops up with generated issue keys (e.g., `LIN-104`, `JIRA-409`), and the synced counter increments!

### 2. Automated 24h Reminder Previews
- Click the **"24h Reminders"** tab.
- View simulated Slack messages formatted with channel `#proj-launch`, `@mention` tags, bold deadlines, and interactive action buttons (`[Mark In Progress]`, `[View in Linear]`).
- Toggle to **"Email HTML"** to inspect responsive notification templates.
- Click **"Copy"** or **"Simulate Ping"** to test delivery.

### 3. Weekly Execution Digest
- Click the **"Weekly Digest"** tab.
- View workload distribution grouped by owner across all past meeting transcripts.
- Filter by specific team members to monitor pending vs. synced deliverables.

### 4. Meeting Efficiency Score & Markdown Export
- Circular diagnostic badge displaying overall score (e.g., `86/100`).
- Detailed breakdown: **Action-to-Talk Ratio**, **Wispr Flow Fillers Neutralized**, and **Contradiction Penalty Index**.
- Action-oriented diagnostic critique providing constructive advice.
- Click **"Export Markdown Report"** to download `meeting-sync-report.md` containing full decisions, action items, and conflict audit history.

---

## 🔒 Security Architecture
- Frontend extension and client communicate with `http://localhost:5000/api`.
- Sensitive API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) reside exclusively in `server/.env` on the backend proxy.
- No secrets are ever packaged into the Chrome Extension manifest or client JavaScript bundles.
