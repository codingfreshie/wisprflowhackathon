import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, ArrowRight, CheckCircle2, XCircle, Flag, History } from 'lucide-react';

export default function ConflictBanner({ conflicts, onResolveConflict }) {
  const [resolvingId, setResolvingId] = useState(null);

  if (!conflicts || conflicts.length === 0) return null;

  const activeConflicts = conflicts.filter(c => !c.status || c.status === 'Active');
  if (activeConflicts.length === 0) return null;

  const handleAction = async (conflictId, strategy) => {
    setResolvingId(conflictId);
    try {
      await onResolveConflict(conflictId, strategy);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border-2 border-red-500/70 bg-gradient-to-r from-red-950/80 via-red-900/40 to-slate-900 p-5 shadow-2xl shadow-red-950/60 glow-red animate-pulse-fast">
      {/* Header bar */}
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-red-500/30">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-red-600/30 border border-red-500/50 text-red-300">
            <AlertTriangle className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-500 text-white">
                CRITICAL WARNING
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {activeConflicts.length} Cross-Meeting Contradiction{activeConflicts.length > 1 ? 's' : ''} Detected!
              </h2>
            </div>
            <p className="text-xs text-red-200/90 mt-0.5">
              This spoken transcript directly contradicts locked decisions from persistent meeting memory.
            </p>
          </div>
        </div>
        <span className="text-xs text-red-300/80 bg-red-950/60 px-3 py-1 rounded-full border border-red-700/50 hidden sm:inline-block">
          Memory Safety Guard Active
        </span>
      </div>

      {/* Conflict list */}
      <div className="mt-4 space-y-4">
        {activeConflicts.map((c, idx) => (
          <div 
            key={c.id || idx}
            className="rounded-xl bg-slate-900/90 border border-red-500/30 p-4 transition-all hover:border-red-400"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                <span className="text-sm font-semibold text-red-300">{c.topic}</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                  {c.severity || 'High'} Severity
                </span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                <History className="w-3 h-3 text-red-400" />
                <span>Memory Source: {c.previousMeetingTitle || 'Sprint Kickoff'}</span>
              </div>
            </div>

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-3">
              {/* Previous Decision */}
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-700/80">
                <div className="flex items-center justify-between text-slate-400 mb-1.5 font-medium">
                  <span className="flex items-center space-x-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Locked Historical Decision</span>
                  </span>
                  <span className="text-[10px] text-slate-500">From Memory</span>
                </div>
                <p className="text-slate-200 font-medium leading-relaxed">
                  "{c.previousDecision}"
                </p>
              </div>

              {/* New Contradiction */}
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40">
                <div className="flex items-center justify-between text-red-300 mb-1.5 font-medium">
                  <span className="flex items-center space-x-1 text-red-400">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>New Spoken Contradiction</span>
                  </span>
                  <span className="text-[10px] text-red-400/80">Current Sync</span>
                </div>
                <p className="text-red-100 font-medium leading-relaxed">
                  "{c.contradiction}"
                </p>
              </div>
            </div>

            {/* Impact & Reason */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-800">
              <div className="text-slate-300">
                <span className="text-slate-500 font-semibold">Impacted Stakeholders: </span>
                <span className="text-amber-300 font-medium">{(c.impactedOwners || ['Marcus', 'Lena']).join(', ')}</span>
                {c.reason && (
                  <span className="text-slate-400 block sm:inline sm:ml-2">
                    • <span className="italic">{c.reason}</span>
                  </span>
                )}
              </div>

              {/* Action Resolution Buttons */}
              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end mt-2 sm:mt-0">
                <button
                  disabled={resolvingId === c.id}
                  onClick={() => handleAction(c.id, 'overwrite')}
                  className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition-colors shadow-sm disabled:opacity-50"
                  title="Accept this new change and update the historical record"
                >
                  Overwrite Memory
                </button>
                <button
                  disabled={resolvingId === c.id}
                  onClick={() => handleAction(c.id, 'keep_original')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-medium text-xs transition-colors disabled:opacity-50"
                  title="Reject this new proposal and enforce the original decision"
                >
                  Retain Original
                </button>
                <button
                  disabled={resolvingId === c.id}
                  onClick={() => handleAction(c.id, 'manual_flag')}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-medium text-xs transition-colors flex items-center space-x-1 disabled:opacity-50"
                  title="Flag for team review in Slack before committing"
                >
                  <Flag className="w-3 h-3" />
                  <span>Flag for Review</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
