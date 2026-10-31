import React, { useState, useEffect } from 'react';
import { Bell, MessageSquare, Mail, Copy, Check, Send, Clock, User, Sparkles } from 'lucide-react';
import { generateReminders } from '../services/api';

export default function RemindersTab({ actionItems }) {
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [sentPingId, setSentPingId] = useState(null);
  const [activeFormat, setActiveFormat] = useState('slack'); // 'slack' or 'email'

  useEffect(() => {
    fetchReminders();
  }, [actionItems]);

  const fetchReminders = async () => {
    setIsLoading(true);
    try {
      const res = await generateReminders(actionItems && actionItems.length > 0 ? actionItems : null);
      if (res && res.reminders) {
        setReminders(res.reminders);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const simulateSendPing = (id) => {
    setSentPingId(id);
    setTimeout(() => setSentPingId(null), 3000);
  };

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
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-slate-100">
                  Automated 24h Reminder Dispatcher
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Proactive Follow-Up
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically drafts and schedules targeted reminder notifications 24 hours before deadlines.
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

        {/* Content list */}
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Generating intelligent owner templates...
          </div>
        ) : reminders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No pending action items found. Ingest a transcript or push tasks first!
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {reminders.map((r, idx) => (
              <div
                key={r.taskId || idx}
                className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 hover:border-slate-700 transition-all"
              >
                {/* Meta header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-850 mb-3 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-purple-900/60 text-purple-300 font-bold flex items-center justify-center text-[11px] border border-purple-500/40">
                      {r.owner.charAt(0)}
                    </span>
                    <span className="font-semibold text-slate-200">Owner: {r.owner}</span>
                    <span className="text-slate-500">•</span>
                    <span className="flex items-center space-x-1 text-slate-400">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>Triggers {r.sendWindow}</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyToClipboard(r.slackText, r.taskId)}
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
                      <span>{sentPingId === r.taskId ? 'Ping Sent!' : 'Simulate Ping'}</span>
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
                      <span className="text-[10px] bg-[#2C3136] px-1 py-0.2 rounded text-slate-400">APP</span>
                      <span className="text-[10px] text-slate-500">24 hours prior to deadline</span>
                    </div>

                    <p className="leading-relaxed whitespace-pre-line text-slate-300">
                      {r.slackText}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-[#2C3136] flex items-center space-x-2">
                      <button className="px-2.5 py-1 rounded bg-[#2C3136] hover:bg-[#383F45] text-slate-200 text-[11px] font-medium border border-slate-700">
                        Mark In Progress
                      </button>
                      <button className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[11px] font-medium border border-indigo-500/40">
                        View in Tracker
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Email Preview */
                  <div
                    className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                    dangerouslySetInnerHTML={{ __html: r.emailHtml }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
