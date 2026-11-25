import React from 'react';
import { Settings, Activity, Archive, Star } from 'lucide-react';

interface QuickAccessProps {
  onOpenSettings: () => void;
  onOpenDiagnostics: () => void;
  onOpenArchives: () => void;
}

export const QuickAccess: React.FC<QuickAccessProps> = ({
  onOpenSettings,
  onOpenDiagnostics,
  onOpenArchives,
}) => {
  return (
    <div className="flex flex-col h-full justify-between gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-amber-300" />
          <span className="text-xs font-semibold text-slate-100">Quick Access</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">3 Shortcuts</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="mercury-press flex flex-col items-center justify-center gap-1 rounded-xl bg-slate-950/60 border border-slate-300/15 hover:border-cyan-400/45 py-2 px-1 text-center cursor-pointer"
        >
          <Settings className="w-4 h-4 text-slate-200" />
          <span className="text-[11px] font-medium text-slate-100">Settings</span>
          <span className="text-[9px] text-slate-400">Tune OS</span>
        </button>

        <button
          type="button"
          onClick={onOpenDiagnostics}
          className="mercury-press flex flex-col items-center justify-center gap-1 rounded-xl bg-slate-950/60 border border-slate-300/15 hover:border-cyan-400/45 py-2 px-1 text-center cursor-pointer"
        >
          <Activity className="w-4 h-4 text-cyan-300" />
          <span className="text-[11px] font-medium text-slate-100">Diagnostics</span>
          <span className="text-[9px] text-slate-400">Tests & API</span>
        </button>

        <button
          type="button"
          onClick={onOpenArchives}
          className="mercury-press flex flex-col items-center justify-center gap-1 rounded-xl bg-slate-950/60 border border-slate-300/15 hover:border-cyan-400/45 py-2 px-1 text-center cursor-pointer"
        >
          <Archive className="w-4 h-4 text-slate-200" />
          <span className="text-[11px] font-medium text-slate-100">Archives</span>
          <span className="text-[9px] text-slate-400">Backups</span>
        </button>
      </div>
    </div>
  );
};
