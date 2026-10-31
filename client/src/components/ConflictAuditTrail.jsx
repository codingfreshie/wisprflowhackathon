import React, { useState } from 'react';
import { Flag, CheckCircle2, AlertTriangle, History, ArrowRight } from 'lucide-react';

const isActive = (c) => !c.status || c.status === 'Active';

const outcomeLabel = (c) => {
  if (c.resolutionStrategy === 'overwrite') return { text: 'Memory overwritten', cls: 'bg-red-500/10 text-red-300 border-red-500/30' };
  if (c.resolutionStrategy === 'keep_original') return { text: 'Original retained', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
  if (c.status === 'Flagged') return { text: 'Flagged for review', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' };
  return { text: c.resolutionNotes || c.resolution || 'Resolved', cls: 'bg-slate-700/30 text-slate-300 border-slate-600' };
};

const when = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

// Conflict dashboard: status tiles, the "Flagged for review" queue (decide later), and the full audit trail.
export default function ConflictAuditTrail({ conflicts = [], onResolveConflict }) {
  const [busyId, setBusyId] = useState(null);

  const active = conflicts.filter(isActive);
  const flagged = conflicts.filter(c => c.status === 'Flagged');
  const resolved = conflicts.filter(c => c.status === 'Resolved');

  const act = async (id, strategy) => {
    setBusyId(id);
    try { await onResolveConflict(id, strategy); } finally { setBusyId(null); }
  };

  if (conflicts.length === 0) return null;

  const tiles = [
    { label: 'Open - needs a decision', value: active.length, cls: active.length ? 'text-red-400' : 'text-slate-300' },
    { label: 'Flagged for team review', value: flagged.length, cls: flagged.length ? 'text-amber-300' : 'text-slate-300' },
    { label: 'Resolved', value: resolved.length, cls: 'text-emerald-400' }
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map(t => (
          <div key={t.label} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <div className={`text-xl font-extrabold ${t.cls}`}>{t.value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{t.label}</div>
          </div>
        ))}
      </div>

      {flagged.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
          <div className="flex items-center space-x-2 mb-1">
            <Flag className="w-4 h-4 text-amber-300" />
            <h4 className="font-bold text-sm text-amber-200">Flagged for review ({flagged.length})</h4>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            These were parked for the team. The new decisions are kept out of memory until someone makes the final call here.
          </p>
          <div className="space-y-3">
            {flagged.map(c => (
              <div key={c.id} className="p-3 rounded-xl bg-slate-950/70 border border-amber-500/20 text-xs">
                <div className="font-semibold text-amber-200 mb-1.5">{c.topic}</div>
                <div className="flex flex-wrap items-center gap-2 text-slate-300">
                  <span className="px-2 py-1 rounded bg-slate-900 border border-slate-700">"{c.previousDecision}"</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="px-2 py-1 rounded bg-red-950/40 border border-red-500/30 text-red-100">"{c.contradiction}"</span>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    disabled={busyId === c.id}
                    onClick={() => act(c.id, 'overwrite')}
                    className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium disabled:opacity-50"
                  >
                    Accept new decision
                  </button>
                  <button
                    disabled={busyId === c.id}
                    onClick={() => act(c.id, 'keep_original')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-medium disabled:opacity-50"
                  >
                    Keep original
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
          <div className="flex items-center space-x-2 mb-3">
            <History className="w-4 h-4 text-slate-400" />
            <h4 className="font-bold text-sm text-slate-200">Resolution Audit Trail ({resolved.length})</h4>
          </div>
          <div className="space-y-2">
            {resolved.map((c, idx) => {
              const o = outcomeLabel(c);
              return (
                <div key={c.id || idx} className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs">
                  <div className="min-w-0">
                    <div>
                      <span className="font-semibold text-slate-200">{c.topic}</span>
                      <span className="text-slate-500"> — {c.meetingTitle || c.previousMeetingTitle || 'Meeting'}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      "{c.previousDecision}" vs "{c.contradiction}"{c.resolvedAt ? ` • ${when(c.resolvedAt)}` : ''}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${o.cls}`}>{o.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
