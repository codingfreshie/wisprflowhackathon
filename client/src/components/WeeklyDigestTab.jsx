import React, { useState, useEffect } from 'react';
import { Users, CheckCircle2, Clock, AlertTriangle, Layers, Calendar, ExternalLink } from 'lucide-react';
import { getWeeklyDigest } from '../services/api';

export default function WeeklyDigestTab() {
  const [digest, setDigest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOwner, setSelectedOwner] = useState('ALL');

  useEffect(() => {
    loadDigest();
  }, []);

  const loadDigest = async () => {
    setIsLoading(true);
    try {
      const data = await getWeeklyDigest();
      setDigest(data);
    } catch (err) {
      console.error(err);
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
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {task.priority || 'Medium'}
                          </span>
                          <span className="font-medium text-slate-200">{task.title}</span>
                        </div>

                        <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                          <span>Source: {task.meetingTitle || 'Sprint Sync'}</span>
                          <span>•</span>
                          <span className="flex items-center space-x-1 text-slate-400">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>Due: {task.deadline || '2026-11-10'}</span>
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
