import React, { useState, useEffect } from 'react';
import { Database, RotateCcw, Calendar, CheckCircle2, XCircle, AlertCircle, Trash2 } from 'lucide-react';
import { getMeetingsMemory, resetMemoryDemo, deleteMeetingFromMemory } from '../services/api';

export default function MemoryVaultTab({ onMemoryChange }) {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadMemory();
  }, []);

  const loadMemory = async () => {
    setIsLoading(true);
    try {
      const data = await getMeetingsMemory();
      setMeetings(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset memory store to initial hackathon seed data?")) return;
    setResetting(true);
    try {
      await resetMemoryDemo();
      await loadMemory();
      if (onMemoryChange) onMemoryChange();
    } catch (err) {
      alert("Reset failed: " + err.message);
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this meeting from memory?")) return;
    try {
      await deleteMeetingFromMemory(id);
      await loadMemory();
      if (onMemoryChange) onMemoryChange();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-slate-100">
                  Cross-Meeting Memory Vault
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Persistent Storage
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                The persistent knowledge graph holding historical decisions used to detect cross-meeting contradictions.
              </p>
            </div>
          </div>

          <button
            disabled={resetting}
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all disabled:opacity-50"
            title="Reset memory to initial seed state"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : 'text-purple-400'}`} />
            <span>{resetting ? 'Resetting...' : 'Reset Demo Seed'}</span>
          </button>
        </div>

        {/* List of meetings in memory */}
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Querying persistent memory store...
          </div>
        ) : meetings.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Memory vault is currently empty. Click "Reset Demo Seed" or ingest a new meeting.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {meetings.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80 mb-3">
                  <div>
                    <h4 className="font-bold text-sm text-slate-100">{m.title}</h4>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>{new Date(m.date).toLocaleDateString()}</span>
                      </span>
                      <span>•</span>
                      <span>Source: {m.source || 'Wispr Flow Voice'}</span>
                      {m.efficiencyScore && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">Efficiency: {m.efficiencyScore}/100</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(m.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-850 transition-colors"
                    title="Delete meeting from memory"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Stored Decisions */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Historical Decisions:
                  </span>
                  {(m.decisions || []).map((d, dIdx) => {
                    const isSuperseded = d.status === 'Superseded';
                    return (
                      <div
                        key={d.id || dIdx}
                        className={`p-2.5 rounded-lg border text-xs ${
                          isSuperseded
                            ? 'bg-slate-900/40 border-slate-800 text-slate-500 line-through'
                            : 'bg-slate-900/90 border-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-[11px] text-purple-300">
                            [{d.category || 'Timeline'}]
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                            isSuperseded
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {d.status || 'Active'}
                          </span>
                        </div>
                        <p>{d.decision}</p>
                        {isSuperseded && d.supersededBy && (
                          <p className="text-[10px] text-red-400 mt-1 not-italic no-underline">
                            ↳ Superseded by: "{d.supersededBy}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
