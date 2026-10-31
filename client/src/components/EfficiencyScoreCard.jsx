import React, { useState } from 'react';
import { Gauge, Download, CheckCircle2, TrendingUp, AlertTriangle, FileText, Check } from 'lucide-react';
import { exportReport } from '../services/api';
import { downloadMarkdown } from './downloadMarkdown';

const isOpen = (c) => !c.status || c.status === 'Active' || c.status === 'Flagged';

export default function EfficiencyScoreCard({
  efficiency,
  decisions = [],
  actionItems = [],
  conflicts = [],          // ALL conflicts for this meeting (open + resolved)
  meetingTitle,
  sourceLabel = 'Live from transcript'
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [exportError, setExportError] = useState(null);

  const e = efficiency || {};
  const score = typeof e.score === 'number' ? e.score : 0;
  const grade = e.grade || (score >= 80 ? 'High Execution Velocity' : score >= 60 ? 'Moderate Output' : 'Action Friction');
  const actionToTalkRatio = e.actionToTalkRatio || 'n/a';
  const fillerCount = e.fillerWordCount ?? 0;
  const breakdown = Array.isArray(e.breakdown) ? e.breakdown : [];

  const openConflicts = conflicts.filter(isOpen).length;
  const resolvedConflicts = conflicts.length - openConflicts;

  // The critique is written when the meeting is ingested; keep it truthful once conflicts get resolved.
  let critique = e.critique || 'No critique stored for this meeting.';
  if (conflicts.length > 0 && openConflicts === 0 && /contradict/i.test(critique)) {
    critique += ` Update: all ${conflicts.length} contradiction${conflicts.length > 1 ? 's have' : ' has'} since been resolved, so this meeting is safe to push. (Score reflects the meeting as ingested.)`;
  }

  const getScoreColor = (val) => {
    if (val >= 80) return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40';
    if (val >= 60) return 'text-amber-400 border-amber-500/40 bg-amber-950/40';
    return 'text-red-400 border-red-500/40 bg-red-950/40';
  };

  const handleExportMarkdown = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const res = await exportReport({
        meeting: { title: meetingTitle, date: new Date().toLocaleDateString() },
        decisions,
        actionItems,
        conflicts,
        efficiency
      });
      if (res && res.markdown) {
        downloadMarkdown(res.markdown, res.filename);
        setExported(true);
        setTimeout(() => setExported(false), 3000);
      }
    } catch (err) {
      setExportError('Export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-base text-slate-100">
                Meeting Efficiency{meetingTitle ? `: ${meetingTitle}` : ''}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                {sourceLabel}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Every point is explainable: decision velocity, action-to-talk ratio, ownership and speech cleanliness.
            </p>
          </div>
        </div>

        <button
          disabled={isExporting}
          onClick={handleExportMarkdown}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all shadow-sm hover:border-slate-600 disabled:opacity-50 cursor-pointer"
        >
          {exported ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">Downloaded .MD!</span>
            </>
          ) : (
            <>
              <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : 'text-purple-400'}`} />
              <span>Export Meeting Report</span>
            </>
          )}
        </button>
      </div>
      {exportError && <div className="mt-2 text-xs text-red-300">{exportError} Is the backend running?</div>}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
        <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${getScoreColor(score)}`}>
          <span className="text-[11px] font-bold uppercase tracking-wider mb-1">Efficiency Score</span>
          <div className="text-3xl font-extrabold tracking-tight">
            {score}<span className="text-sm font-normal text-slate-400">/100</span>
          </div>
          <span className="text-[10px] mt-1 font-semibold">{grade}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-center">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Action-to-Talk Ratio</span>
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-slate-100">{actionToTalkRatio}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Share of speaker turns that produced a decision or task</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-center">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Wispr Flow Fillers Neutralized</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-purple-300">{fillerCount} Fillers</div>
          <p className="text-[10px] text-slate-500 mt-0.5">'Umms', 'uhs', and false starts filtered out</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-center">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Contradictions</span>
            <AlertTriangle className={`w-3.5 h-3.5 ${openConflicts > 0 ? 'text-red-400' : 'text-emerald-400'}`} />
          </div>
          <div className={`text-xl font-bold ${openConflicts > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {openConflicts > 0 ? `${openConflicts} Open` : conflicts.length > 0 ? 'All Resolved' : 'None'}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {conflicts.length} detected against memory{conflicts.length > 0 ? ` • ${resolvedConflicts} resolved` : ''}
          </p>
        </div>
      </div>

      {/* Score breakdown */}
      {breakdown.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mr-1">How the score was built</span>
          {breakdown.map((b, i) => (
            <span
              key={`${b.label}-${i}`}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                b.points < 0
                  ? 'bg-red-500/10 text-red-300 border-red-500/30'
                  : b.label === 'Baseline'
                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {b.label} {b.label === 'Baseline' ? b.points : `${b.points > 0 ? '+' : ''}${b.points}`}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
        <div className="flex items-center space-x-2 text-xs font-semibold text-purple-300 mb-1.5">
          <FileText className="w-3.5 h-3.5" />
          <span>Action-Oriented Diagnostic Critique:</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed italic">"{critique}"</p>
      </div>
    </div>
  );
}
