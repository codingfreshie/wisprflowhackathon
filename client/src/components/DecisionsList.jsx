import React from 'react';
import { CheckCircle, Layers, Calendar, Cpu, Tag } from 'lucide-react';

export default function DecisionsList({ decisions }) {
  if (!decisions || decisions.length === 0) return null;

  const getCategoryBadge = (category) => {
    switch (category) {
      case 'Timeline':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Feature Scope':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'Infrastructure':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Timeline':
        return <Calendar className="w-3.5 h-3.5" />;
      case 'Feature Scope':
        return <Layers className="w-3.5 h-3.5" />;
      case 'Infrastructure':
        return <Cpu className="w-3.5 h-3.5" />;
      default:
        return <Tag className="w-3.5 h-3.5" />;
    }
  };

  const statusBadge = (status) => {
    if (!status || status === 'Active') return null;
    const styles = {
      'Pending Review': 'bg-amber-500/15 text-amber-300 border-amber-500/40',
      Flagged: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
      Rejected: 'bg-slate-700/50 text-slate-300 border-slate-600',
      Superseded: 'bg-red-500/15 text-red-300 border-red-500/40'
    };
    return (
      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${styles[status] || styles.Rejected}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl p-5">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm sm:text-base text-slate-100">
            Key Decisions Extracted ({decisions.length})
          </h3>
        </div>
        <span className="text-xs text-slate-400">
          Saved to Persistent Memory
        </span>
      </div>

      <div className="space-y-3">
        {decisions.map((d, idx) => (
          <div
            key={d.id || idx}
            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-slate-700 transition-all"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className={`inline-flex items-center space-x-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getCategoryBadge(d.category)}`}>
                {getCategoryIcon(d.category)}
                <span>{d.category || 'Strategy'}</span>
              </span>

              {d.impactedComponents && d.impactedComponents.length > 0 && (
                <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                  <span className="text-slate-500">Impacted:</span>
                  {d.impactedComponents.map((comp, cIdx) => (
                    <span key={cIdx} className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                      {comp}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-semibold leading-snug ${d.status === 'Rejected' ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                {d.decision}
              </p>
              {statusBadge(d.status)}
            </div>

            {d.context && (
              <p className="text-xs text-slate-400 mt-1.5 italic">
                {d.context}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
