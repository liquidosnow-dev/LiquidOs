import React, { useMemo, useState } from 'react';
import { History, ArrowRight, ShieldCheck, GitCommit, MessageSquare, X } from 'lucide-react';
import { AuditLedgerEntry, ChatMessage, Commit } from '../../types';

interface RecentActivityProps {
  auditLedger: AuditLedgerEntry[];
  commits: Commit[];
  messages: ChatMessage[];
}

interface ActivityItem {
  id: string;
  title: string;
  timestamp: number;
  kind: 'audit' | 'commit' | 'chat';
  detail?: string;
}

function formatRelativeTime(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  return `${hrs}h ago`;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  auditLedger,
  commits,
  messages,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const items: ActivityItem[] = useMemo(() => {
    const ledgerItems: ActivityItem[] = auditLedger.slice(-8).map((entry) => ({
      id: `aud_${entry.index}_${entry.timestamp}`,
      title: `${entry.action.replace(/_/g, ' ')}`,
      timestamp: entry.timestamp,
      kind: 'audit',
      detail: `${entry.entityId} · ${entry.hash.slice(0, 12)}`,
    }));

    const commitItems: ActivityItem[] = commits.slice(-5).map((c) => ({
      id: `cmt_${c.id}`,
      title: c.message,
      timestamp: c.timestamp,
      kind: 'commit',
      detail: `${c.files.length} files · #${c.hash.slice(0, 7)}`,
    }));

    const chatItems: ActivityItem[] = messages
      .filter((m) => m.sender === 'assistant')
      .slice(-3)
      .map((m) => ({
        id: `msg_${m.id}`,
        title: `Synthesis via ${m.model || 'Liquid AI'}`,
        timestamp: m.timestamp,
        kind: 'chat',
        detail: m.content.slice(0, 65),
      }));

    return [...ledgerItems, ...commitItems, ...chatItems].sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }, [auditLedger, commits, messages]);

  const iconFor = (kind: ActivityItem['kind']) => {
    if (kind === 'audit') return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (kind === 'commit') return <GitCommit className="w-3.5 h-3.5 text-cyan-300 shrink-0" />;
    return <MessageSquare className="w-3.5 h-3.5 text-sky-300 shrink-0" />;
  };

  return (
    <>
      <div className="flex flex-col h-full justify-between gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-cyan-300" />
            <span className="text-xs font-semibold text-slate-100">Recent Activity</span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="text-[11px] text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <ul className="space-y-1.5">
          {items.slice(0, 3).map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 text-[11px] text-slate-200"
            >
              <div className="flex items-center gap-2 min-w-0">
                {iconFor(item.kind)}
                <span className="truncate">{item.title}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                {formatRelativeTime(item.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Audit Ledger & Recent Activity"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-xl max-h-[80vh] rounded-2xl los-glass-elevated flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/15">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-300" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Sovereign Activity & Audit Ledger ({items.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close activity log"
                className="p-1.5 rounded-lg bg-slate-900/70 border border-slate-300/20 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-slate-950/75 border border-slate-300/15 px-3 py-2 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5">{iconFor(item.kind)}</div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-100 break-words">
                        {item.title}
                      </div>
                      {item.detail && (
                        <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                          {item.detail}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
