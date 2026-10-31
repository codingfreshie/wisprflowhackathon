import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Sparkles,
  Volume2,
  Play,
  Clipboard,
  ArrowRight,
  Check,
  RefreshCw,
  Upload,
  Radio,
  CheckCircle2,
  Headphones,
  History,
  Monitor,
  Laptop
} from 'lucide-react';
import { SAMPLE_TRANSCRIPTS } from '../data/sampleTranscripts';
import { fetchDirectDesktopSync, fetchDesktopHistory, fetchLatestWisprNotetaker } from '../services/api';

export default function VoiceIngestionTab({
  transcript,
  setTranscript,
  meetingTitle,
  setMeetingTitle,
  onExtract,
  isExtracting
}) {
  const [isSyncingDesktop, setIsSyncingDesktop] = useState(false);
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(false);
  const [desktopNotice, setDesktopNotice] = useState(null);
  const [desktopHistoryList, setDesktopHistoryList] = useState([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [bridgeStatus, setBridgeStatus] = useState('unknown'); // 'unknown' | 'connected' | 'offline'
  const [lastSyncedId, setLastSyncedId] = useState(null);
  const [pastedNotice, setPastedNotice] = useState(false);
  const [isStreamingSimulation, setIsStreamingSimulation] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-sync polling: when enabled, periodically checks for newly finished Wispr Flow desktop dictations
  useEffect(() => {
    let interval = null;
    if (isAutoSyncEnabled) {
      interval = setInterval(async () => {
        try {
          const res = await fetchDirectDesktopSync();
          if (res && res.connected && res.transcript && res.id !== lastSyncedId) {
            setLastSyncedId(res.id);
            setTranscript(res.transcript);
            setMeetingTitle(prev => prev || res.title);
            setDesktopNotice({
              title: res.title,
              source: res.source,
              numWords: res.numWords,
              timestamp: res.timestamp,
              type: res.type
            });
          }
        } catch (e) {
          // ignore auto-sync errors
        }
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutoSyncEnabled, lastSyncedId, setTranscript, setMeetingTitle]);

  // Sync directly from the Wispr Flow Desktop SQLite database.
  // If the desktop DB isn't available (different machine / Wispr not installed), fall back to the
  // latest Wispr Notetaker session held by the backend so the demo never dead-ends.
  const handleDirectDesktopSync = async () => {
    setIsSyncingDesktop(true);
    setDesktopNotice(null);
    setSyncError(null);
    try {
      const res = await fetchDirectDesktopSync();
      if (res && res.connected && res.transcript) {
        setBridgeStatus('connected');
        setTranscript(res.transcript);
        setLastSyncedId(res.id);
        setMeetingTitle(res.title || "Wispr Desktop Meeting");
        setDesktopNotice({
          title: res.title,
          source: res.source,
          numWords: res.numWords || res.transcript.split(/\s+/).filter(Boolean).length,
          timestamp: res.timestamp,
          type: res.type
        });
        loadDesktopHistory();
        return;
      }

      // Desktop DB reachable but empty, or not found -> try the Notetaker session
      setBridgeStatus(res && res.connected ? 'connected' : 'offline');
      const fallback = await fetchLatestWisprNotetaker();
      const session = fallback?.session;
      if (session?.rawTranscript) {
        setTranscript(session.rawTranscript);
        setMeetingTitle(session.title || 'Wispr Notetaker Session');
        setDesktopNotice({
          title: session.title,
          source: session.source || 'Wispr Notetaker',
          numWords: session.rawTranscript.split(/\s+/).filter(Boolean).length,
          timestamp: session.date,
          type: 'Wispr Notetaker Session',
          fallback: true
        });
        setSyncError(
          res && res.connected
            ? 'Wispr desktop has no meeting recordings yet - loaded the latest Notetaker session instead.'
            : 'Wispr desktop database not found on this machine - loaded the latest Notetaker session instead.'
        );
      } else {
        setSyncError('No Wispr meeting notes found yet. Record one with the Wispr Note-taker, or load a scenario below.');
      }
    } catch (err) {
      setBridgeStatus('offline');
      setSyncError("Could not reach the backend: " + err.message);
    } finally {
      setIsSyncingDesktop(false);
    }
  };

  const loadDesktopHistory = async () => {
    try {
      const data = await fetchDesktopHistory(8);
      setDesktopHistoryList(data && data.history ? data.history : []);
    } catch (e) {
      console.warn('Failed to load desktop history:', e);
      setDesktopHistoryList([]);
    } finally {
      setHistoryLoaded(true);
    }
  };

  const handleSelectHistoryItem = (item) => {
    setTranscript(item.transcript);
    setMeetingTitle(item.title);
    setLastSyncedId(item.id);
    setDesktopNotice({
      title: item.title,
      source: `Wispr Desktop App (${item.app})`,
      numWords: item.numWords,
      timestamp: item.timestamp,
      type: "Wispr History Item"
    });
    setShowHistoryDrawer(false);
  };

  // Upload exported file
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        let textToUse = content;
        try {
          const parsed = JSON.parse(content);
          if (parsed.transcript || parsed.text) {
            textToUse = parsed.transcript || parsed.text;
          }
          if (parsed.title) {
            setMeetingTitle(parsed.title);
          }
        } catch (e) {}

        setTranscript(textToUse);
        setMeetingTitle(prev => prev || `Imported: ${file.name.replace(/\.[^/.]+$/, '')}`);
        setDesktopNotice({
          title: file.name,
          source: "File Upload",
          numWords: textToUse.split(/\s+/).length,
          type: "Imported File"
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // One-click paste
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTranscript(prev => (prev ? prev + '\n' + text : text));
        setPastedNotice(true);
        setTimeout(() => setPastedNotice(false), 2000);
      }
    } catch (err) {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  // Simulation
  const handleSimulateVoiceStream = (sampleText, sampleTitle) => {
    if (isStreamingSimulation) return;
    setIsStreamingSimulation(true);
    setDesktopNotice(null);
    setMeetingTitle(sampleTitle);
    setTranscript("");

    const tokens = sampleText.split(" ");
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < tokens.length) {
        const nextWord = tokens[idx];
        setTranscript(prev => (prev ? prev + " " + nextWord : nextWord));
        idx++;
      } else {
        clearInterval(interval);
        setIsStreamingSimulation(false);
      }
    }, 45);
  };

  const loadScenario = (sc) => {
    setMeetingTitle(sc.title.split(':')[1]?.trim() || sc.title);
    setTranscript(sc.text);
    setDesktopNotice(null);
  };

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const fillerCount = (transcript.match(/\b(uh|um|umm|uhh|like|you know|basically|so yeah|wait no|scratch that)\b/gi) || []).length;

  return (
    <div className="space-y-4">
      {/* Real-time Desktop Sync Banner */}
      <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-purple-950/30 to-slate-900 p-3.5 text-xs shadow-lg">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 shrink-0">
              <Laptop className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="font-bold text-emerald-200">Live Wispr Flow Desktop Connection</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center space-x-1 ${
                  bridgeStatus === 'offline'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${bridgeStatus === 'offline' ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'}`}></span>
                  <span>{bridgeStatus === 'offline' ? 'Desktop DB not found - Notetaker fallback ready' : 'Direct SQLite Bridge Ready'}</span>
                </span>
              </div>
              <p className="text-slate-300 mt-1 leading-relaxed text-[11px] sm:text-xs">
                Directly connected to your Windows Wispr Flow app (<code className="text-emerald-400 font-mono text-[10px]">flow.sqlite</code>). Click <strong>"Sync from Desktop App"</strong> below to pull whatever you just spoke!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation of Live Desktop Sync */}
      {desktopNotice && (
        <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/60 text-emerald-200 text-xs flex items-start justify-between gap-2 animate-fade-in glow-green">
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center space-x-2">
                <p className="font-bold text-emerald-100">
                  {desktopNotice.fallback ? '⚡ Loaded latest Wispr Notetaker session:' : '⚡ Synced directly from your Wispr Desktop App:'}
                </p>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 font-mono">
                  {desktopNotice.type}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-emerald-300/80 mt-1">
                <span>"{desktopNotice.title}"</span>
                <span>•</span>
                <span>{desktopNotice.numWords || 0} words</span>
                <span>•</span>
                <span className="text-slate-400">{desktopNotice.source}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setDesktopNotice(null)}
            className="text-emerald-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {syncError && (
        <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-950/40 text-amber-200 text-xs flex items-start justify-between gap-2">
          <span>{syncError}</span>
          <button onClick={() => setSyncError(null)} className="text-amber-300 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* Main Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* THE HERO BUTTON: SYNC DIRECTLY FROM DESKTOP APP */}
          <button
            type="button"
            disabled={isSyncingDesktop}
            onClick={handleDirectDesktopSync}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50 transition-all cursor-pointer glow-green"
            title="Read directly from your running Wispr Flow desktop app"
          >
            <Zap className={`w-4 h-4 ${isSyncingDesktop ? 'animate-spin text-amber-300' : 'text-emerald-200 fill-emerald-200'}`} />
            <span>{isSyncingDesktop ? 'Reading Desktop App...' : 'Sync from Desktop App'}</span>
          </button>

          {/* Auto-Sync Live Toggle */}
          <label className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-300 cursor-pointer hover:border-slate-600">
            <input
              type="checkbox"
              checked={isAutoSyncEnabled}
              onChange={(e) => {
                setIsAutoSyncEnabled(e.target.checked);
                if (e.target.checked) handleDirectDesktopSync();
              }}
              className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 w-3.5 h-3.5"
            />
            <span className={isAutoSyncEnabled ? 'text-emerald-400 font-bold' : ''}>
              {isAutoSyncEnabled ? 'Auto-Sync ON' : 'Auto-Sync Live'}
            </span>
          </label>

          {/* Browse Desktop History */}
          <button
            type="button"
            onClick={() => {
              setHistoryLoaded(false);
              loadDesktopHistory();
              setShowHistoryDrawer(!showHistoryDrawer);
            }}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-850 hover:bg-slate-800 text-purple-300 border border-purple-500/40 transition-all cursor-pointer"
            title="View recent recordings from your desktop"
          >
            <History className="w-3.5 h-3.5" />
            <span>Desktop History</span>
          </button>

          {/* Paste Button */}
          <button
            type="button"
            onClick={handlePasteClipboard}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all cursor-pointer"
            title="Paste text from clipboard"
          >
            {pastedNotice ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5 text-slate-400" />}
            <span>{pastedNotice ? 'Pasted!' : 'Paste'}</span>
          </button>

          {/* Upload file */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".txt,.json,.md,.vtt"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-850 hover:bg-slate-800 text-slate-400 border border-slate-700 transition-all cursor-pointer"
            title="Upload exported file"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>File</span>
          </button>
        </div>

        {/* Demo Simulator button */}
        <button
          type="button"
          disabled={isStreamingSimulation}
          onClick={() => handleSimulateVoiceStream(SAMPLE_TRANSCRIPTS[0].text, "Emergency Scope Pivot Sync")}
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 border border-purple-500/30 transition-all disabled:opacity-50 cursor-pointer"
        >
          <Play className={`w-3 h-3 ${isStreamingSimulation ? 'animate-spin' : ''}`} />
          <span>Simulate</span>
        </button>
      </div>

      {/* Desktop History Drawer (Shows REAL recordings from user's machine) */}
      {showHistoryDrawer && (
        <div className="p-3.5 rounded-xl border border-purple-500/40 bg-slate-900 shadow-2xl animate-fade-in space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-purple-300 flex items-center space-x-1">
              <History className="w-3.5 h-3.5" />
              <span>Recent Dictations from your Wispr Desktop App:</span>
            </span>
            <button
              onClick={() => setShowHistoryDrawer(false)}
              className="text-slate-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>

          {desktopHistoryList.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">
              {historyLoaded
                ? 'No dictations found. Wispr Flow desktop data is only available on the machine running the backend where Wispr is installed.'
                : 'Loading recordings from flow.sqlite...'}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {desktopHistoryList.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectHistoryItem(item)}
                  className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/40 transition-all flex items-start justify-between gap-2 group cursor-pointer"
                >
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-200 line-clamp-1 group-hover:text-purple-300">
                      "{item.transcript}"
                    </p>
                    <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-0.5">
                      <span className="text-emerald-400">{item.app}</span>
                      <span>•</span>
                      <span>{item.numWords} words</span>
                      <span>•</span>
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-purple-400 bg-purple-950 px-2 py-0.5 rounded border border-purple-500/30 shrink-0">
                    Use This
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Transcript Input Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Meeting Title / Voice Session
            </label>
            <input
              type="text"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="e.g. Wispr Desktop Spoken Meeting"
              className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Text Area */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={7}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Click 'Sync from Desktop App' above to pull what you just spoke into Wispr Flow, or type/dictate directly..."
            className="w-full p-3 text-xs sm:text-sm rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 font-mono leading-relaxed"
          />

          {isStreamingSimulation && (
            <div className="absolute bottom-3 right-3 flex items-center space-x-1.5 bg-purple-950/90 border border-purple-500/40 px-2.5 py-1 rounded-full text-[10px] text-purple-300 backdrop-blur-sm animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
              <span>Wispr Flow Dictating Live...</span>
            </div>
          )}
        </div>

        {/* Ingestion Footer Stats */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mt-3 text-xs text-slate-400">
          <div className="flex items-center space-x-3 text-[11px]">
            <span>{wordCount} words</span>
            {fillerCount > 0 && (
              <span className="text-amber-400/90 font-medium">
                {fillerCount} filler words detected
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => {
                setTranscript("");
                setDesktopNotice(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              Clear
            </button>

            <button
              disabled={isExtracting || !transcript.trim()}
              onClick={onExtract}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin' : ''}`} />
              <span>{isExtracting ? 'Extracting...' : 'Extract Decisions & Action Items'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Demo Scenarios Selector */}
      <div>
        <div className="flex items-center justify-between mb-1.5 text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-400 text-[11px]">
            Or Test Preloaded Hackathon Scenarios:
          </span>
          <span className="text-[10px] text-slate-500">Instant Demo</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {SAMPLE_TRANSCRIPTS.map((sc) => (
            <button
              key={sc.id}
              onClick={() => loadScenario(sc)}
              className="text-left p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-850 transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${sc.badgeColor}`}>
                  {sc.badge}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h4 className="text-xs font-semibold text-slate-200 line-clamp-1">{sc.title}</h4>
              <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{sc.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
