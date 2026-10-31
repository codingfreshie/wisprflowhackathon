import React, { useState, useEffect } from 'react';
import { Users, CheckCircle2, AlertTriangle, Calendar, RefreshCw, Download, Copy, Check, ShieldAlert } from 'lucide-react';
import { getWeeklyDigest, getWeeklyReport } from '../services/api';
import { downloadMarkdown } from './downloadMarkdown';

export default function WeeklyDigestTab() {
  const [digest, setDigest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOwner, setSelectedOwner] = useState('ALL');
  const [reportState, setReportState] = useState(null); // 'downloaded' | 'copied' | null

  useEffect(() => {
    loadDigest();
  }, []);

  const flash = (kind) => {
    setReportState(kind);
    setTimeout(() => setReportState(null), 2500);
  };

  const handleDownloadReport = async () => {
    try {
      const res = await getWeeklyReport();
      downloadMarkdown(res.markdown, res.filename);
      flash('downloaded');
    } catch (err) {
      setError(err.message || 'Could not build report');
    }
  };

  const handleCopyReport = async () => {
    try {
      const res = await getWeeklyReport();
      await navigator.clipboard.writeText(res.markdown);
      flash('copied');
    } catch (err) {
      // Clipboard can be blocked in some contexts - fall back to a download so the demo never dead-ends
      handleDownloadReport();
    }
  };

  const loadDigest = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getWeeklyDigest();
      setDigest(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not load digest');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Aggregating weekly deliverables across stored meetings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-xs text-amber-300 rounded-2xl border border-slate-800 bg-slate-900/90">
        <AlertTriangle className="w-5 h-5 mx-auto mb-2" />
        {error}
        <div>
          <button onClick={loadDigest} className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700">Retry</button>
        </div>
      </div>
    );
  }

  const ownersList = digest?.owners || [];
  const filteredOwners = selectedOwner === 'ALL'
    ? ownersList
    : ownersList.filter(o => o.owner === selectedOwner);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-slate-100">
                  Cross-Meeting Weekly Execution Digest
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {digest?.totalActionItems || 0} Total Deliverables
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Aggregated view grouping all assigned action items by owner across all past meeting transcripts.
              </p>
            </div>
          </div>

          {/* Owner Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedOwner('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedOwner === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              All Owners ({ownersList.length})
            </button>
            {ownersList.map(o => (
              <button
                key={o.owner}
                onClick={() => setSelectedOwner(o.owner)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedOwner === o.owner
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {o.owner} ({o.totalTasks})
              </button>
            ))}
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mt-4">
          {[
            { label: 'Meetings', value: digest?.meetingCount ?? 0, color: 'text-slate-100' },
            { label: 'Deliverables', value: digest?.totalActionItems ?? 0, color: 'text-indigo-300' },
            { label: 'Synced to tracker', value: digest?.totalSynced ?? 0, color: 'text-emerald-400' },
            { label: 'Pending push', value: digest?.totalPending ?? 0, color: 'text-amber-300' },
            { label: `Due ${digest?.digestDateRange || 'this week'}`, value: digest?.dueThisWeek ?? 0, color: 'text-purple-300' }
          ].map(tile => (
            <div key={tile.label} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
              <div className={`text-xl font-extrabold ${tile.color}`}>{tile.value}</div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{tile.label}</div>
            </div>
          ))}
        </div>
        {/* Headline + actions */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
          <div className="text-xs text-indigo-200 font-medium">
            <span className="text-indigo-400 font-bold uppercase tracking-wider text-[10px] mr-2">This week</span>
            {digest?.headline}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReport}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold"
            >
              {reportState === 'copied' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-300" />}
              <span>{reportState === 'copied' ? 'Copied!' : 'Copy digest'}</span>
            </button>
            <button
              onClick={handleDownloadReport}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold"
            >
              {reportState === 'downloaded' ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              <span>{reportState === 'downloaded' ? 'Downloaded!' : 'Export weekly report'}</span>
            </button>
            <button onClick={loadDigest} className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-200 px-2">
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Overall completion */}
        <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
          <span className="shrink-0">Overall pushed to trackers</span>
          <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
            <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${digest?.completionPct ?? 0}%` }} />
          </div>
          <span className="font-semibold text-emerald-400">{digest?.completionPct ?? 0}%</span>
          <span className="text-slate-500">• {digest?.activeDecisionsCount ?? 0} active decisions in memory</span>
        </div>

        {/* Needs attention */}
        {(digest?.needsAttention || []).length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-amber-300 mb-2">
              <ShieldAlert className="w-4 h-4" />
              <span>Needs attention ({digest.needsAttention.length})</span>
            </div>
            <ul className="space-y-1.5">
              {digest.needsAttention.map((a, i) => (
                <li key={`${a.type}-${a.taskId || a.conflictId || i}`} className="flex items-start space-x-2 text-xs text-slate-300">
                  <span className={`mt-0.5 shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                    a.type === 'conflict' ? 'bg-red-500/15 text-red-300 border-red-500/40'
                    : a.type === 'overdue' ? 'bg-orange-500/15 text-orange-300 border-orange-500/40'
                    : a.type === 'due_soon' ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40'
                    : 'bg-slate-700/40 text-slate-300 border-slate-600'
                  }`}>
                    {a.type === 'conflict' ? 'Conflict' : a.type === 'overdue' ? 'Overdue' : a.type === 'due_soon' ? 'Due soon' : 'High prio'}
                  </span>
                  <span>{a.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Grouped Owners Grid */}
        <div className="mt-5 space-y-5">
          {filteredOwners.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              No tasks currently registered for this owner.
            </div>
          ) : (
            filteredOwners.map(ownerGroup => (
              <div
                key={ownerGroup.owner}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 transition-all"
              >
                {/* Owner Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80 mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-md">
                      {ownerGroup.owner.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">{ownerGroup.owner}</h4>
                      <p className="text-[11px] text-slate-400">
                        {ownerGroup.totalTasks} task{ownerGroup.totalTasks > 1 ? 's' : ''} assigned • {ownerGroup.highPriority} High Priority
                        {ownerGroup.overdue > 0 && <span className="text-red-400 font-semibold"> • {ownerGroup.overdue} overdue</span>}
                      </p>
                    </div>
                  </div>

                  {/* Sync Progress Bar */}
                  <div className="flex items-center space-x-3">
                    <div className="w-28 bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.round((ownerGroup.synced / Math.max(1, ownerGroup.totalTasks)) * 100)}%`
                        }}
                      ></div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400">
                      {ownerGroup.synced}/{ownerGroup.totalTasks} Synced
                    </span>
                  </div>
                </div>

                {/* Owner Tasks List */}
                <div className="space-y-2">
                  {ownerGroup.tasks.map((task, tIdx) => (
                    <div
                      key={task.id || tIdx}
                      className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                            task.priority === 'High'
                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                              : task.priority === 'Low'
                              ? 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {task.priority || 'Medium'}
                          </span>
                          <span className="font-medium text-slate-200">{task.title}</span>
                          {task.blockedByConflict && (
                            <span
                              title={`Unresolved conflict: ${(task.conflictTopics || []).join(', ')}`}
                              className="flex items-center space-x-1 text-[10px] font-bold px-1.5 py-0.5 rounded border bg-red-500/10 text-red-300 border-red-500/40"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>Conflict pending</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                          <span>Source: {task.meetingTitle || 'Sprint Sync'}</span>
                          <span>•</span>
                          <span className={`flex items-center space-x-1 ${task.isOverdue ? 'text-red-400 font-semibold' : task.isThisWeek ? 'text-purple-300' : 'text-slate-400'}`}>
                            <Calendar className="w-3 h-3" />
                            <span>Due: {task.deadline || 'TBD'}{task.isOverdue ? ` (${Math.abs(task.daysLeft)}d overdue)` : task.daysLeft === 0 ? ' (today)' : task.daysLeft === 1 ? ' (tomorrow)' : task.isThisWeek ? ` (in ${task.daysLeft}d)` : ''}</span>
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center space-x-2">
                        {task.status === 'Synced' ? (
                          <span className="flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{task.externalId || 'Synced'}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            Pending Push
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
