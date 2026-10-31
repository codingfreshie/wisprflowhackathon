import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import VoiceIngestionTab from './components/VoiceIngestionTab';
import ConflictBanner from './components/ConflictBanner';
import DecisionsList from './components/DecisionsList';
import ReviewPushModal from './components/ReviewPushModal';
import RemindersTab from './components/RemindersTab';
import WeeklyDigestTab from './components/WeeklyDigestTab';
import EfficiencyScoreCard from './components/EfficiencyScoreCard';
import MemoryVaultTab from './components/MemoryVaultTab';
import { SAMPLE_TRANSCRIPTS } from './data/sampleTranscripts';
import {
  checkServerHealth,
  extractMeetingIntelligence,
  saveMeetingToMemory,
  resolveConflict,
  pushTasksToTracker,
  getConflicts
} from './services/api';
import {
  Mic,
  AlertTriangle,
  CheckSquare,
  Bell,
  Users,
  Gauge,
  Database,
  Save,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('ingestion');
  const [serverHealth, setServerHealth] = useState(null);
  const [syncedStats, setSyncedStats] = useState({ totalPushed: 3 });

  // Ingestion & Extraction State
  const [meetingTitle, setMeetingTitle] = useState('Wispr Flow Sprint & Scope Pivot');
  const [transcript, setTranscript] = useState(SAMPLE_TRANSCRIPTS[0].text);
  const [isExtracting, setIsExtracting] = useState(false);

  // Extracted Intelligence State
  const [decisions, setDecisions] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [efficiency, setEfficiency] = useState(null);

  // Status & Notifications
  const [toast, setToast] = useState(null);
  const [isPushing, setIsPushing] = useState(false);
  const [isSavingMeeting, setIsSavingMeeting] = useState(false);

  useEffect(() => {
    refreshHealth();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const refreshHealth = async () => {
    const health = await checkServerHealth();
    setServerHealth(health);
    if (health?.persistentMemory?.syncedStats) {
      setSyncedStats(health.persistentMemory.syncedStats);
    }
    try {
      const vaultConflicts = await getConflicts();
      if (Array.isArray(vaultConflicts) && vaultConflicts.length > 0) {
        setConflicts(prev => {
          const byId = new Map(prev.map(c => [c.id, c]));
          vaultConflicts.forEach(c => {
            const existing = byId.get(c.id);
            byId.set(c.id, existing ? { ...c, ...existing, status: existing.status || c.status } : c);
          });
          return Array.from(byId.values());
        });
      }
    } catch (e) {
      // vault conflicts are optional when backend is offline
    }
  };

  // Extract decisions, action items, conflicts & efficiency score
  const handleExtract = async () => {
    if (!transcript.trim()) return;
    setIsExtracting(true);
    try {
      const data = await extractMeetingIntelligence(transcript, meetingTitle);
      setDecisions(data.decisions || []);
      setActionItems(data.actionItems || []);
      setConflicts(data.conflicts || []);
      setEfficiency(data.efficiency || null);

      const conflictsCount = (data.conflicts || []).filter(c => c.status !== 'Resolved').length;
      if (conflictsCount > 0) {
        showToast(`🚨 ${conflictsCount} Cross-Meeting Contradiction(s) Detected!`, 'error');
        setActiveTab('conflicts');
      } else {
        showToast(`Extracted ${data.decisions?.length || 0} decisions & ${data.actionItems?.length || 0} action items — saved to memory.`, 'success');
      }

      // If there are conflicts, stay on tab or highlight; scroll smoothly
      refreshHealth();
    } catch (err) {
      showToast('Extraction failed: ' + err.message, 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  // Resolve a conflict
  const handleResolveConflict = async (conflictId, strategy) => {
    try {
      await resolveConflict(conflictId, strategy);
      // Mark conflict as resolved locally
      setConflicts(prev => prev.map(c => c.id === conflictId ? { ...c, status: 'Resolved' } : c));
      showToast(`Conflict marked as resolved (${strategy})`, 'success');
      refreshHealth();
    } catch (err) {
      showToast('Resolution error: ' + err.message, 'error');
    }
  };

  // Push tasks to external tracker (Linear / Jira / Asana / Notion)
  const handlePushTasks = async (tasksToPush, tracker, title) => {
    setIsPushing(true);
    try {
      const res = await pushTasksToTracker(tasksToPush, tracker, title);
      // Update local action items status to Synced
      const pushedIds = new Set(tasksToPush.map(t => t.id));
      setActionItems(prev =>
        prev.map(t => {
          if (pushedIds.has(t.id)) {
            const match = res.pushedTasks?.find(p => p.id === t.id);
            return {
              ...t,
              status: 'Synced',
              tracker,
              externalId: match?.externalId || `${tracker.substring(0, 3).toUpperCase()}-101`,
              externalUrl: match?.externalUrl
            };
          }
          return t;
        })
      );

      if (res.syncedStats) {
        setSyncedStats(res.syncedStats);
      }

      showToast(res.live
        ? `🚀 Created ${tasksToPush.length} live ${tracker} issues`
        : `Synced ${tasksToPush.length} items to ${tracker}`, 'success');
      refreshHealth();
      return res;
    } catch (err) {
      showToast('Failed to push: ' + err.message, 'error');
      throw err;
    } finally {
      setIsPushing(false);
    }
  };

  // Save current meeting and its decisions to persistent memory
  const handleSaveToMemory = async () => {
    if (decisions.length === 0 && actionItems.length === 0) {
      showToast('Please extract meeting items first before saving to memory', 'warning');
      return;
    }
    setIsSavingMeeting(true);
    try {
      await saveMeetingToMemory({
        title: meetingTitle,
        date: new Date().toISOString(),
        source: 'Wispr Flow Voice Ingestion',
        efficiencyScore: efficiency?.score || 85,
        decisions,
        actionItems,
        conflicts
      });
      showToast(`Saved "${meetingTitle}" to Persistent Memory Vault!`, 'success');
      refreshHealth();
    } catch (err) {
      showToast('Failed to save to memory: ' + err.message, 'error');
    } finally {
      setIsSavingMeeting(false);
    }
  };

  const activeConflictCount = (conflicts || []).filter(c => c.status !== 'Resolved').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-xl border shadow-2xl text-xs font-semibold flex items-center space-x-2 animate-bounce-subtle ${
          toast.type === 'error'
            ? 'bg-red-950/90 border-red-500 text-red-200'
            : toast.type === 'warning'
            ? 'bg-amber-950/90 border-amber-500 text-amber-200'
            : 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main App Header */}
      <Header
        serverHealth={serverHealth}
        onRefreshHealth={refreshHealth}
        syncedStats={syncedStats}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Navigation Tabs Bar */}
      <nav className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-sm sticky top-[65px] z-40 px-4">
        <div className="max-w-7xl mx-auto flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2 no-scrollbar">
          <button
            onClick={() => setActiveTab('ingestion')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'ingestion'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Wispr Flow Voice Ingestion</span>
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'tasks'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Review & Push</span>
            {actionItems.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                {actionItems.length}
              </span>
            )}
          </button>

          {/* Eye-catching Conflict Tab with Alert Indicator */}
          <button
            onClick={() => setActiveTab('conflicts')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeConflictCount > 0
                ? 'bg-red-600 text-white animate-pulse glow-red shadow-lg shadow-red-600/40'
                : activeTab === 'conflicts'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${activeConflictCount > 0 ? 'text-white' : 'text-slate-400'}`} />
            <span>Cross-Meeting Conflicts</span>
            {activeConflictCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white text-red-600 font-extrabold">
                {activeConflictCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('reminders')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'reminders'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>24h Reminders</span>
          </button>

          <button
            onClick={() => setActiveTab('digest')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'digest'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Weekly Digest</span>
          </button>

          <button
            onClick={() => setActiveTab('efficiency')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'efficiency'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Efficiency & Export</span>
            {efficiency?.score && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-emerald-400 font-bold">
                {efficiency.score}%
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('memory')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'memory'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Memory Vault</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Prominent Eye-Catching Red Conflict Banner (Always visible at top when contradictions are active!) */}
        <ConflictBanner
          conflicts={conflicts}
          onResolveConflict={handleResolveConflict}
        />

        {/* Tab 1: Voice Ingestion */}
        {activeTab === 'ingestion' && (
          <div className="space-y-6">
            <VoiceIngestionTab
              transcript={transcript}
              setTranscript={setTranscript}
              meetingTitle={meetingTitle}
              setMeetingTitle={setMeetingTitle}
              onExtract={handleExtract}
              isExtracting={isExtracting}
            />

            {/* Extracted Results Section */}
            {(decisions.length > 0 || actionItems.length > 0) && (
              <div className="space-y-6 pt-4 border-t border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-base text-slate-100">
                      Extraction Intelligence Results
                    </h3>
                  </div>

                  <button
                    disabled={isSavingMeeting}
                    onClick={handleSaveToMemory}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 text-xs font-semibold transition-all shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingMeeting ? 'Saving to Memory...' : 'Re-commit to Persistent Memory Vault'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DecisionsList decisions={decisions} />
                  <ReviewPushModal
                    actionItems={actionItems}
                    onUpdateActionItems={setActionItems}
                    onPushTasks={handlePushTasks}
                    isPushing={isPushing}
                    meetingTitle={meetingTitle}
                    linearConfigured={Boolean(serverHealth?.linearConfigured)}
                  />
                </div>

                <EfficiencyScoreCard
                  efficiency={efficiency}
                  decisions={decisions}
                  actionItems={actionItems}
                  conflicts={conflicts}
                  meetingTitle={meetingTitle}
                />
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Review & Push Tasks */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            {actionItems.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 text-center">
                <CheckSquare className="w-8 h-8 text-indigo-400 mx-auto mb-3" />
                <h3 className="font-bold text-slate-100 mb-1">No action items to review yet</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Ingest a Wispr Flow transcript and extract decisions to populate this checklist. Confirmed items push to Linear.
                </p>
                <button
                  onClick={() => setActiveTab('ingestion')}
                  className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
                >
                  Go to Voice Ingestion
                </button>
              </div>
            ) : (
              <ReviewPushModal
                actionItems={actionItems}
                onUpdateActionItems={setActionItems}
                onPushTasks={handlePushTasks}
                isPushing={isPushing}
                meetingTitle={meetingTitle}
                linearConfigured={Boolean(serverHealth?.linearConfigured)}
              />
            )}

            {decisions.length > 0 && <DecisionsList decisions={decisions} />}
          </div>
        )}

        {/* Tab 3: Conflicts Management */}
        {activeTab === 'conflicts' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900 text-xs">
              <h4 className="font-bold text-slate-200 text-sm mb-1">Cross-Meeting Contradiction Engine</h4>
              <p className="text-slate-400">
                When new voice transcripts are ingested, the AI proxy compares proposed deadlines, architecture decisions, and feature scopes against all historical commitments stored in memory.
              </p>
            </div>

            {activeConflictCount === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 text-xs text-slate-400">
                No active contradictions against locked memory. Load Scenario 1 (Emergency Pivot) and extract to trigger the launch-date and Apple Pay warnings.
              </div>
            ) : (
              <ConflictBanner
                conflicts={conflicts}
                onResolveConflict={handleResolveConflict}
              />
            )}
          </div>
        )}

        {/* Tab 4: 24h Reminders */}
        {activeTab === 'reminders' && (
          <RemindersTab actionItems={actionItems} />
        )}

        {/* Tab 5: Weekly Digest */}
        {activeTab === 'digest' && (
          <WeeklyDigestTab />
        )}

        {/* Tab 6: Efficiency Score & Export */}
        {activeTab === 'efficiency' && (
          <EfficiencyScoreCard
            efficiency={efficiency || {
              score: 86,
              actionToTalkRatio: "78%",
              fillerWordCount: 14,
              talkTimeEstimatedMin: 28,
              critique: "Excellent action-oriented meeting! 3 high-priority commitments assigned to Marcus, Lena, and Priya with concrete deadlines. Wispr Flow voice cleaned 14 conversational filler words effortlessly."
            }}
            decisions={decisions}
            actionItems={actionItems}
            conflicts={conflicts}
            meetingTitle={meetingTitle}
          />
        )}

        {/* Tab 7: Memory Vault */}
        {activeTab === 'memory' && (
          <MemoryVaultTab onMemoryChange={refreshHealth} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 px-4 py-3 text-center text-xs text-slate-500">
        <p>Meeting Sync Agent • Wispr Flow Voice Ingestion & Cross-Meeting Execution Engine • Problem Statement 03</p>
      </footer>
    </div>
  );
}
