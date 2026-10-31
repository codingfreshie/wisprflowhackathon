import React, { useEffect, useState } from 'react';
import { CheckSquare, Square, Send, CheckCircle2, User, Calendar, ExternalLink } from 'lucide-react';

export default function ReviewPushModal({
  actionItems,
  onUpdateActionItems,
  onPushTasks,
  isPushing,
  meetingTitle,
  linearConfigured = false
}) {
  const [selectedTasks, setSelectedTasks] = useState(
    actionItems.reduce((acc, t) => ({ ...acc, [t.id]: true }), {})
  );
  const [targetTracker, setTargetTracker] = useState("Linear");
  const [pushResult, setPushResult] = useState(null);

  useEffect(() => {
    setSelectedTasks(prev => {
      const next = {};
      actionItems.forEach(t => {
        next[t.id] = prev[t.id] !== undefined ? prev[t.id] : t.status !== 'Synced';
      });
      return next;
    });
  }, [actionItems]);

  if (!actionItems || actionItems.length === 0) return null;

  const toggleSelect = (id) => {
    setSelectedTasks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectAll = (checked) => {
    const updated = {};
    actionItems.forEach(t => {
      updated[t.id] = checked;
    });
    setSelectedTasks(updated);
  };

  const handleFieldChange = (id, field, value) => {
    const updated = actionItems.map(t => {
      if (t.id === id) {
        return { ...t, [field]: value };
      }
      return t;
    });
    onUpdateActionItems(updated);
  };

  const handleConfirmPush = async () => {
    const tasksToPush = actionItems.filter(t => selectedTasks[t.id]);
    if (tasksToPush.length === 0) {
      alert("Please select at least one action item to push!");
      return;
    }

    try {
      const res = await onPushTasks(tasksToPush, targetTracker, meetingTitle);
      setPushResult(res);
    } catch (err) {
      alert("Push failed: " + err.message);
    }
  };

  const selectedCount = Object.values(selectedTasks).filter(Boolean).length;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Execution Gate
            </span>
            <h3 className="font-bold text-sm sm:text-base text-slate-100">
              Review & Push Action Items ({actionItems.length})
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Edit owners and deadlines, then confirm to sync selected tasks to Linear.
          </p>
        </div>

        {/* Global Tracker Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">Target Tracker:</span>
          <select
            value={targetTracker}
            onChange={(e) => setTargetTracker(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="Linear">{linearConfigured ? 'Linear (Live API)' : 'Linear (Simulated if no API key)'}</option>
            <option value="Jira">Jira (Sprint Board)</option>
            <option value="Asana">Asana (Operations)</option>
            <option value="Notion">Notion (Product DB)</option>
          </select>
        </div>
      </div>

      {/* Select All Controls */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1">
        <button
          onClick={() => selectAll(selectedCount < actionItems.length)}
          className="flex items-center space-x-1.5 hover:text-slate-200 transition-colors"
        >
          {selectedCount === actionItems.length ? (
            <CheckSquare className="w-4 h-4 text-indigo-400" />
          ) : (
            <Square className="w-4 h-4 text-slate-600" />
          )}
          <span>{selectedCount === actionItems.length ? 'Deselect All' : 'Select All'} ({selectedCount}/{actionItems.length})</span>
        </button>
        <span className="text-[11px] text-slate-500">Edit fields inline before pushing</span>
      </div>

      {/* Action Items Checklist */}
      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
        {actionItems.map((task) => {
          const isSelected = Boolean(selectedTasks[task.id]);
          const isSynced = task.status === 'Synced';

          return (
            <div
              key={task.id}
              className={`p-3.5 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-slate-950/80 border-indigo-500/40 shadow-sm'
                  : 'bg-slate-950/40 border-slate-800 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleSelect(task.id)}
                  className="mt-1 text-slate-400 hover:text-indigo-400 transition-colors shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                </button>

                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) => handleFieldChange(task.id, 'title', e.target.value)}
                    className="w-full text-xs sm:text-sm font-medium bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 text-slate-100 focus:outline-none pb-0.5"
                    placeholder="Task title..."
                  />

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Owner Input */}
                    <div className="flex items-center space-x-1 bg-slate-900 px-2 py-1 rounded-md border border-slate-800">
                      <User className="w-3 h-3 text-slate-400" />
                      <input
                        type="text"
                        value={task.owner}
                        onChange={(e) => handleFieldChange(task.id, 'owner', e.target.value)}
                        className="bg-transparent text-slate-200 text-xs w-20 focus:outline-none"
                        placeholder="Owner"
                      />
                    </div>

                    {/* Deadline Input */}
                    <div className="flex items-center space-x-1 bg-slate-900 px-2 py-1 rounded-md border border-slate-800">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <input
                        type="date"
                        value={task.deadline || '2026-11-10'}
                        onChange={(e) => handleFieldChange(task.id, 'deadline', e.target.value)}
                        className="bg-transparent text-slate-200 text-xs focus:outline-none"
                      />
                    </div>

                    {/* Priority Selector */}
                    <select
                      value={task.priority || 'Medium'}
                      onChange={(e) => handleFieldChange(task.id, 'priority', e.target.value)}
                      className={`text-[11px] font-semibold px-2 py-1 rounded-md border bg-slate-900 ${
                        task.priority === 'High'
                          ? 'text-red-400 border-red-500/30'
                          : task.priority === 'Medium'
                          ? 'text-amber-400 border-amber-500/30'
                          : 'text-slate-400 border-slate-700'
                      }`}
                    >
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>

                    {/* Status Badge */}
                    {isSynced ? (
                      <a
                        href={task.externalUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{task.externalId || 'Synced'}</span>
                        {task.externalUrl && <ExternalLink className="w-3 h-3" />}
                      </a>
                    ) : (
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        Pending Push
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Push Confirmation Button & Toast Notice */}
      <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          Ready to push <strong className="text-slate-200">{selectedCount} tasks</strong> to <strong className="text-indigo-400">{targetTracker}</strong>.
        </div>

        <button
          disabled={isPushing || selectedCount === 0}
          onClick={handleConfirmPush}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all disabled:opacity-50 cursor-pointer"
        >
          <Send className={`w-4 h-4 ${isPushing ? 'animate-spin' : ''}`} />
          <span>{isPushing ? `Pushing to ${targetTracker}...` : `Confirm & Push to ${targetTracker}`}</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {pushResult && (
        <div className="mt-4 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs glow-green flex items-start justify-between gap-3 animate-fade-in">
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-100">{pushResult.message}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {(pushResult.pushedTasks || []).map((p, idx) => (
                  <a
                    key={idx}
                    href={p.externalUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-900/60 px-2 py-0.5 rounded font-mono text-[10px] text-emerald-300 border border-emerald-600/40 inline-flex items-center gap-1"
                  >
                    {p.externalId}: {p.owner}
                    {p.externalUrl && <ExternalLink className="w-3 h-3" />}
                  </a>
                ))}
              </div>
            </div>
          </div>
          <button 
            onClick={() => setPushResult(null)}
            className="text-emerald-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
