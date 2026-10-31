import React, { useState, useEffect } from 'react';
import { Bell, MessageSquare, Mail, Copy, Check, Send, Clock, ExternalLink, CalendarClock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { generateReminders } from '../services/api';

// Renders Slack-style *bold* and _italic_ markers instead of showing raw asterisks
function renderSlackText(text) {
  return String(text || '').split('\n').map((line, i) => {
    const parts = line.split(/(\*[^*]+\*|_[^_]+_)/g).filter(Boolean);
    return (
      <p key={i} className="leading-relaxed text-slate-300">
        {parts.map((part, j) => {
          if (part.startsWith('*') && part.endsWith('*')) {
            return <strong key={j} className="text-slate-100 font-bold">{part.slice(1, -1)}</strong>;
          }
          if (part.startsWith('_') && part.endsWith('_')) {
            return <em key={j} className="text-slate-400">{part.slice(1, -1)}</em>;
          }
          return <span key={j}>{part}</span>;
        })}
      </p>
    );
  });
}

const formatSendAt = (iso) => {
  if (!iso) return 'No deadline set';
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const STATUS_STYLES = {
  Scheduled: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  'Due within 24h': 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  Overdue: 'bg-red-500/15 text-red-300 border-red-500/40',
  'No deadline': 'bg-slate-700/40 text-slate-400 border-slate-600'
};

export default function RemindersTab({ actionItems }) {
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [sentPingId, setSentPingId] = useState(null);
  const [activeFormat, setActiveFormat] = useState('slack'); // 'slack' or 'email'
  const [inProgress, setInProgress] = useState({}); // taskId -> true ("Mark In Progress" clicked)
  const [scheduledAll, setScheduledAll] = useState(false);

  useEffect(() => {
    fetchReminders();
    setScheduledAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionItems]);

  const fetchReminders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await generateReminders(actionItems && actionItems.length > 0 ? actionItems : null);
      setReminders(res?.reminders || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not generate reminders');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (r) => {
    const text = activeFormat === 'email'
      ? r.emailHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : r.slackText;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // clipboard may be blocked inside extension popups; still show feedback
    }
    setCopiedId(r.taskId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const simulateSendPing = (id) => {
    setSentPingId(id);
    setTimeout(() => setSentPingId(null), 3000);
  };

  const dueSoon = reminders.filter(r => r.status === 'Due within 24h').length;
  const overdue = reminders.filter(r => r.status === 'Overdue').length;

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h3 className="font-bold text-base text-slate-100">
                  Automated 24h Reminder Dispatcher
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Proactive Follow-Up
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Drafts a Slack + email reminder for every deliverable, scheduled exactly 24 hours before its deadline.
              </p>
            </div>
          </div>

          {/* Format Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveFormat('slack')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFormat === 'slack'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Slack Previews</span>
            </button>
            <button
              onClick={() => setActiveFormat('email')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFormat === 'email'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email HTML</span>
            </button>
          </div>
        </div>

        {/* Summary + schedule-all */}
        {reminders.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-slate-400">
              <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800">
                <strong className="text-slate-200">{reminders.length}</strong> reminders
              </span>
              <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800">
                <strong className="text-amber-300">{dueSoon}</strong> due within 24h
              </span>
              <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800">
                <strong className={overdue > 0 ? 'text-red-300' : 'text-slate-200'}>{overdue}</strong> overdue
              </span>
            </div>

            <button
              onClick={() => setScheduledAll(true)}
              disabled={scheduledAll}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                scheduledAll
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 cursor-default'
                  : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500 shadow-lg shadow-purple-600/30'
              }`}
            >
              {scheduledAll ? <CheckCircle2 className="w-3.5 h-3.5" /> : <CalendarClock className="w-3.5 h-3.5" />}
              <span>{scheduledAll ? `${reminders.length} reminders scheduled` : 'Schedule All Reminders'}</span>
            </button>
          </div>
        )}

        {/* Content list */}
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Generating reminder drafts...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-amber-300">
            <AlertTriangle className="w-5 h-5 mx-auto mb-2" />
            {error}
            <div>
              <button onClick={fetchReminders} className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
                Retry
              </button>
            </div>
          </div>
        ) : reminders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No action items found. Ingest a transcript and extract it first!
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {reminders.map((r, idx) => {
              const key = r.taskId || idx;
              const started = Boolean(inProgress[key]);
              return (
                <div
                  key={key}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 hover:border-slate-700 transition-all"
                >
                  {/* Meta header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 mb-3 text-xs">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="w-6 h-6 rounded-full bg-purple-900/60 text-purple-300 font-bold flex items-center justify-center text-[11px] border border-purple-500/40">
                        {(r.owner || '?').charAt(0)}
                      </span>
                      <span className="font-semibold text-slate-200">Owner: {r.owner}</span>
                      <span className="text-slate-500">•</span>
                      <span className="flex items-center space-x-1 text-slate-400">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Sends {formatSendAt(r.sendAt)}</span>
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_STYLES[r.status] || STATUS_STYLES.Scheduled}`}>
                        {scheduledAll && r.status === 'Scheduled' ? 'Queued' : r.status}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => copyToClipboard(r)}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors text-[11px]"
                      >
                        {copiedId === r.taskId ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => simulateSendPing(r.taskId)}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 transition-colors text-[11px]"
                      >
                        <Send className="w-3 h-3" />
                        <span>{sentPingId === r.taskId ? `Sent to ${r.channel}!` : 'Simulate Ping'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Slack preview formatting */}
                  {activeFormat === 'slack' ? (
                    <div className="p-3.5 rounded-lg bg-[#1A1D21] border border-[#2c3136] text-xs font-sans text-slate-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-5 h-5 rounded bg-purple-600 flex items-center justify-center text-[10px] text-white font-bold">
                          MS
                        </div>
                        <span className="font-bold text-[#E8E8E8]">Meeting Sync Bot</span>
                        <span className="text-[10px] bg-[#2C3136] px-1 py-0.5 rounded text-slate-400">APP</span>
                        <span className="text-[10px] text-slate-500">{r.channel} • 24 hours prior to deadline</span>
                      </div>

                      <div className="space-y-1">{renderSlackText(r.slackText)}</div>

                      <div className="mt-3 pt-2.5 border-t border-[#2C3136] flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setInProgress(prev => ({ ...prev, [key]: !prev[key] }))}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                            started
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-[#2C3136] hover:bg-[#383F45] text-slate-200 border-slate-700'
                          }`}
                        >
                          {started ? '✓ In Progress' : 'Mark In Progress'}
                        </button>

                        {r.externalUrl ? (
                          <a
                            href={r.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[11px] font-medium border border-indigo-500/40"
                          >
                            <span>View in {r.tracker}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span
                            className="px-2.5 py-1 rounded bg-slate-800/60 text-slate-500 text-[11px] font-medium border border-slate-700"
                            title="Push this task in Review & Push to get a tracker link"
                          >
                            Not pushed to tracker yet
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Email Preview (server escapes all task text before it becomes HTML) */
                    <div
                      className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                      dangerouslySetInnerHTML={{ __html: r.emailHtml }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
