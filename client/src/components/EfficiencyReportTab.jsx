import React, { useEffect, useState } from 'react';
import { BarChart3, Download, Check, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle } from 'lucide-react';
import EfficiencyScoreCard from './EfficiencyScoreCard';
import { getEfficiencyReport, getMeetingById, getConflicts, getWeeklyReport } from '../services/api';
import { downloadMarkdown } from './downloadMarkdown';

const scoreColor = (v) => (v >= 80 ? 'bg-emerald-500' : v >= 60 ? 'bg-amber-500' : 'bg-red-500');
const scoreText = (v) => (v >= 80 ? 'text-emerald-400' : v >= 60 ? 'text-amber-400' : 'text-red-400');

// Cross-meeting efficiency report. Reads everything from the vault, so it always shows REAL data
// (survives refreshes, includes seeded history, no hard-coded sample numbers).
export default function EfficiencyReportTab({ currentMeetingId, refreshKey }) {
  const [report, setReport] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState({ meeting: null, conflicts: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exported, setExported] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await getEfficiencyReport());
    } catch (err) {
      setError(err.message || 'Could not load efficiency report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [refreshKey]);

  // default selection: the meeting just extracted, otherwise the newest one
  useEffect(() => {
    if (!report) return;
    const ids = report.meetings.map(m => m.id);
    if (selectedId && ids.includes(selectedId)) return;
    if (currentMeetingId && ids.includes(currentMeetingId)) setSelectedId(currentMeetingId);
    else setSelectedId(report.latest?.id || null);
  }, [report, currentMeetingId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      try {
        const [meeting, allConflicts] = await Promise.all([getMeetingById(selectedId), getConflicts()]);
        if (!cancelled) setDetail({ meeting, conflicts: (allConflicts || []).filter(c => c.meetingId === selectedId) });
      } catch (e) {
        if (!cancelled) setDetail({ meeting: null, conflicts: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, refreshKey]);

  const handleExportWeekly = async () => {
    try {
      const res = await getWeeklyReport();
      downloadMarkdown(res.markdown, res.filename);
      setExported(true);
      setTimeout(() => setExported(false), 2500);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading && !report) {
    return <div className="p-8 text-center text-xs text-slate-500">Scoring meetings from the memory vault...</div>;
  }
  if (error && !report) {
    return (
      <div className="p-8 text-center text-xs text-amber-300 rounded-2xl border border-slate-800 bg-slate-900/90">
        <AlertTriangle className="w-5 h-5 mx-auto mb-2" />
        {error}
        <div><button onClick={load} className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700">Retry</button></div>
      </div>
    );
  }
  if (!report || report.meetingCount === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 text-center text-xs text-slate-400">
        No meetings in memory yet. Extract a transcript on the Voice Ingestion tab to get your first efficiency score.
      </div>
    );
  }

  const rowsNewestFirst = report.meetings.slice().reverse();
  const meeting = detail.meeting;
  const selectedRow = report.meetings.find(m => m.id === selectedId);
  const efficiencyForCard = meeting?.efficiency || (selectedRow && {
    score: selectedRow.score, grade: selectedRow.grade, actionToTalkRatio: selectedRow.actionToTalkRatio,
    fillerWordCount: selectedRow.fillerWordCount, breakdown: selectedRow.breakdown, critique: selectedRow.critique
  });

  const TrendIcon = report.trend === null ? Minus : report.trend >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="space-y-6">
      {/* Cross-meeting scoreboard */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">Efficiency Report - All Meetings</h3>
              <p className="text-xs text-slate-400 mt-0.5">Scoreboard across every meeting in the memory vault. Click a row for the full breakdown.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-200 px-2">
              <RefreshCw className="w-3 h-3" /><span>Refresh</span>
            </button>
            <button
              onClick={handleExportWeekly}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm"
            >
              {exported ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              <span>{exported ? 'Downloaded!' : 'Export Weekly Report'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
            <div className={`text-xl font-extrabold ${scoreText(report.averageScore ?? 0)}`}>{report.averageScore ?? 'n/a'}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Average score</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
            <div className={`text-xl font-extrabold flex items-center justify-center space-x-1 ${report.trend === null ? 'text-slate-400' : report.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <TrendIcon className="w-4 h-4" />
              <span>{report.trend === null ? '-' : `${report.trend >= 0 ? '+' : ''}${report.trend}`}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Latest vs previous</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
            <div className="text-xl font-extrabold text-indigo-300">{report.totalDecisions} / {report.totalTasks}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Decisions / tasks captured</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
            <div className="text-xl font-extrabold text-purple-300">{report.totalFillers}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Filler words filtered</div>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          {rowsNewestFirst.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                m.id === selectedId ? 'border-purple-500/60 bg-purple-500/10' : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-100 truncate">{m.title}</div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {m.decisions} decisions • {m.tasks} tasks • talk-to-action {m.actionToTalkRatio}
                    {m.conflictsOpen > 0 && <span className="text-red-400 font-semibold"> • {m.conflictsOpen} open conflict{m.conflictsOpen > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <div className="flex items-center space-x-3 w-full sm:w-56">
                  <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className={`${scoreColor(m.score ?? 0)} h-2 rounded-full`} style={{ width: `${m.score ?? 0}%` }} />
                  </div>
                  <span className={`text-sm font-extrabold w-8 text-right ${scoreText(m.score ?? 0)}`}>{m.score ?? '-'}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail for the selected meeting */}
      {selectedRow && efficiencyForCard && (
        <EfficiencyScoreCard
          efficiency={efficiencyForCard}
          decisions={meeting?.decisions || []}
          actionItems={meeting?.actionItems || []}
          conflicts={detail.conflicts}
          meetingTitle={selectedRow.title}
          sourceLabel="From memory vault"
        />
      )}
    </div>
  );
}
