import React, { useState } from 'react';
import { Gauge, Download, CheckCircle2, TrendingUp, AlertTriangle, FileText, Check } from 'lucide-react';
import { exportReport } from '../services/api';

export default function EfficiencyScoreCard({
  efficiency,
  decisions,
  actionItems,
  conflicts,
  meetingTitle
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const score = efficiency?.score || 85;
  const actionToTalkRatio = efficiency?.actionToTalkRatio || '74%';
  const fillerCount = efficiency?.fillerWordCount || 0;
  const critique = efficiency?.critique || "Solid alignment on action items. Good owner distribution across engineering and product.";

  const getScoreColor = (val) => {
    if (val >= 80) return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40';
    if (val >= 60) return 'text-amber-400 border-amber-500/40 bg-amber-950/40';
    return 'text-red-400 border-red-500/40 bg-red-950/40';
  };

  const handleExportMarkdown = async () => {
    setIsExporting(true);
    try {
      const payload = {
        meeting: { title: meetingTitle, date: new Date().toLocaleDateString() },
        decisions,
        actionItems,
        conflicts,
        efficiency
      };

      const res = await exportReport(payload);
      if (res && res.markdown) {
        // Trigger browser file download
        const blob = new Blob([res.markdown], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = res.filename || `meeting-sync-${Date.now()}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setExported(true);
        setTimeout(() => setExported(false), 3000);
      }
    } catch (err) {
      alert("Export failed: " + err.message);
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
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-base text-slate-100">
                Action-Oriented Meeting Efficiency Score
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                AI Diagnostic
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Quantifies decision velocity, action-to-talk ratio, and speech cleanliness.
            </p>
          </div>
        </div>

        {/* Export Button */}
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
              <span>Export Markdown Report</span>
            </>
          )}
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
        {/* Overall Score Badge */}
        <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${getScoreColor(score)}`}>
          <span className="text-[11px] font-bold uppercase tracking-wider mb-1">Efficiency Score</span>
          <div className="text-3xl font-extrabold tracking-tight">
            {score}<span className="text-sm font-normal text-slate-400">/100</span>
          </div>
          <span className="text-[10px] mt-1 font-semibold">
            {score >= 80 ? 'High Execution Velocity' : score >= 60 ? 'Moderate Output' : 'Action Friction'}
          </span>
        </div>

        {/* Action to Talk Ratio */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-center">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Action-to-Talk Ratio</span>
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-slate-100">{actionToTalkRatio}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Ratio of actionable commitments to conversational fluff</p>
        </div>

        {/* Wispr Flow Noise Neutralizer */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-center">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Wispr Flow Fillers Neutralized</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-purple-300">{fillerCount} Fillers</div>
          <p className="text-[10px] text-slate-500 mt-0.5">'Umms', 'uhs', and false starts safely filtered</p>
        </div>

        {/* Conflict Penalty Index */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-center">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Contradiction Index</span>
            <AlertTriangle className={`w-3.5 h-3.5 ${(conflicts || []).length > 0 ? 'text-red-400' : 'text-emerald-400'}`} />
          </div>
          <div className={`text-xl font-bold ${(conflicts || []).length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {(conflicts || []).length} Flagged
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Contradictions against past meeting memory</p>
        </div>
      </div>

      {/* Action-Oriented AI Critique Box */}
      <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
        <div className="flex items-center space-x-2 text-xs font-semibold text-purple-300 mb-1.5">
          <FileText className="w-3.5 h-3.5" />
          <span>Action-Oriented Diagnostic Critique:</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed italic">
          "{critique}"
        </p>
      </div>
    </div>
  );
}
