import React from 'react';
import { Mic, ShieldCheck, Zap, Database, ExternalLink, RefreshCw } from 'lucide-react';

export default function Header({ serverHealth, onRefreshHealth, syncedStats, activeTab, setActiveTab }) {
  const isConnected = serverHealth?.status === 'ok';

  const handleOpenFullTab = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      // In Chrome extension, open index.html or localhost:5000 in full tab
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
    } else {
      window.open('http://localhost:5000', '_blank');
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-3 sm:px-4 py-2.5 sm:py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 flex-wrap">
        {/* Brand */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 p-0.5 shadow-lg shadow-purple-500/25 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="font-bold text-sm sm:text-base tracking-tight bg-gradient-to-r from-white via-purple-100 to-purple-300 bg-clip-text text-transparent">
                Meeting Sync Agent
              </h1>
              <span className="text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Wispr Flow
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden md:block">
              Meeting-to-Execution Agent • Cross-Meeting Memory & Contradiction Resolver
            </p>
          </div>
        </div>

        {/* Status Badges & Full Tab Button */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs">
          {/* Open Full Tab Button - ALWAYS VISIBLE */}
          <button
            onClick={handleOpenFullTab}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold shadow-md shadow-purple-600/30 transition-all cursor-pointer"
            title="Open in full browser tab for unrestricted microphone and big screen"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open Tab</span>
          </button>

          {/* Backend Connection Status */}
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full border text-[11px] ${
            isConnected 
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' 
              : 'bg-amber-950/40 text-amber-400 border-amber-500/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span className="font-medium">
              {isConnected ? 'Proxy Ready' : 'Connecting'}
            </span>
          </div>

          {/* Synced Task Counter */}
          <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-indigo-950/40 text-indigo-300 border border-indigo-500/30 text-[11px]">
            <Zap className="w-3 h-3 text-indigo-400" />
            <span className="font-semibold">{syncedStats?.totalPushed || 3} Synced</span>
          </div>

          <button 
            onClick={onRefreshHealth}
            title="Refresh System Status" 
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>
    </header>
  );
}
