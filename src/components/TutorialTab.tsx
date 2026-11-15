import React, { useState } from 'react';
import { WorkspaceTabType } from './PreviewCanvas';
import {
  Eye,
  FolderTree,
  Sliders,
  Globe,
  ShieldCheck,
  Terminal,
  ArrowRight,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';

interface TutorialTabProps {
  onNavigateTab: (tab: WorkspaceTabType) => void;
  onRunSamplePrompt?: (prompt: string) => void;
}

interface HandoffStep {
  id: string;
  number: string;
  title: string;
  targetTab: WorkspaceTabType;
  targetLabel: string;
  summary: string;
  checklist: string[];
  cliHint: string;
}

const STEPS: HandoffStep[] = [
  {
    id: 'preview',
    number: '01',
    title: 'Preview — Interactive Unified Sandbox',
    targetTab: 'preview',
    targetLabel: 'Open Preview',
    summary:
      'Inspect the unified LiquidOS ONE HTML/JS application inside an isolated iframe with responsive breakpoints (1440px, 768px, 375px), DOM inspection, and runtime console logs.',
    checklist: [
      'Append a new SHA-256 chain record directly inside the live preview sandbox.',
      'Toggle Desktop, Tablet, or Mobile viewport frames from the toolbar.',
      'Open Logs to inspect real-time iframe console output.',
    ],
    cliHint: 'pnpm run dev',
  },
  {
    id: 'contract',
    number: '02',
    title: 'Contract Registry — AN-EVC-001 TS vs Python 3',
    targetTab: 'contract',
    targetLabel: 'Open Contract Lab',
    summary:
      'Execute live cross-runtime canonicalization (RFC 8785 JCS) on Express against Node.js TypeScript and Python 3.10.12 subprocesses, verifying all 7 divergence probes and inspecting the explicit NOT_RUN authority boundary.',
    checklist: [
      'Run the live 7-probe Divergence Matrix comparing naive JS vs naive Python vs canonical JCS.',
      'Validate Sample Envelopes (Valid Tested, Agent Missing Auth, Self-Verify Spoof, Feb 30 date).',
      'Review honest Outsider Scorecard and remaining cryptographic release blockers.',
    ],
    cliHint: 'node verification-tools/interop.mjs',
  },
  {
    id: 'files',
    number: '03',
    title: 'File Explorer — Master File Tree Showcase',
    targetTab: 'files',
    targetLabel: 'Open File Explorer',
    summary:
      'Browse the consolidated /home/user/webapp workspace tree grouped cleanly by folder (verification-tools/, schemas/, tests/, src/), inspect source code, copy paths, or export a portable workspace archive.',
    checklist: [
      'Expand verification-tools/, schemas/, tests/, and src/ directories.',
      'Click any file to preview or open directly in the integrated Code Editor.',
      'Use @mention to pull exact source files into the Codex composer prompt.',
    ],
    cliHint: 'ls -la',
  },
  {
    id: 'settings',
    number: '04',
    title: 'Settings — Inference & Edge Hyperparameters',
    targetTab: 'settings',
    targetLabel: 'Open Settings',
    summary:
      'Tune decoding parameters (Temperature, Top P, Min P, Seed, Max Output, Repetition Penalty) plus LiteRT-LM quantization & PEAK RAM ceilings (~2.8 GB iPad A16 budget).',
    checklist: [
      'Configure Q8_0 KV-cache quantization and speculative Multi-Token Prediction (MTP).',
      'Toggle Thorough vs Quick Edits build mode before generating code.',
    ],
    cliHint: 'cat wrangler.jsonc',
  },
  {
    id: 'publish',
    number: '05',
    title: 'Publish — 3-Channel Edge Deployment & GitHub Sync',
    targetTab: 'publish',
    targetLabel: 'Open Publish',
    summary:
      'Ship your verified LiquidOS ONE bundle to Genspark Hosting with managed SSL, deploy to Cloudflare Workers bound to D1/KV/R2 via Wrangler, or sync Git commits to GitHub.',
    checklist: [
      'Publish with 1 click to a permanent *.vip.gensparksite.com endpoint.',
      'Verify Cloudflare D1 SQL (DB_PROD), CACHE_KV, and ASSETS_R2 bindings.',
      'Export reproducible snapshots cleanly from the Backups tab.',
    ],
    cliHint: 'wrangler deploy',
  },
];

export const TutorialTab: React.FC<TutorialTabProps> = ({
  onNavigateTab,
  onRunSamplePrompt,
}) => {
  const [completedIds, setCompletedIds] = useState<string[]>(['preview']);

  const toggleCompleted = (id: string) => {
    setCompletedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-y-auto p-5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-400 uppercase tracking-wide">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Handoff Walkthrough · Project ONE</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
            Preview · File Explorer · Settings · Publish · Tutorial
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Interactive onboarding checklist across the five primary surfaces of LiquidOS ONE.
          </p>
        </div>

        <div className="text-right font-mono text-xs shrink-0">
          <div className="text-slate-400">Progress</div>
          <div className="text-emerald-400 font-bold tabular-nums">
            {completedIds.length} / {STEPS.length} Steps Reviewed
          </div>
        </div>
      </div>

      {/* Walkthrough Cards */}
      <div className="space-y-3">
        {STEPS.map((step) => {
          const isDone = completedIds.includes(step.id);
          return (
            <div
              key={step.id}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleCompleted(step.id)}
                    className={`w-7 h-7 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      isDone
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                        : 'bg-slate-950 text-cyan-400 border border-slate-800'
                    }`}
                    title="Mark step reviewed"
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : step.number}
                  </button>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{step.title}</h3>
                    <div className="text-[11px] font-mono text-slate-500">CLI: {step.cliHint}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateTab(step.targetTab)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition-colors shrink-0 cursor-pointer"
                >
                  {step.id === 'preview' && <Eye className="w-3.5 h-3.5" />}
                  {step.id === 'contract' && <ShieldCheck className="w-3.5 h-3.5" />}
                  {step.id === 'files' && <FolderTree className="w-3.5 h-3.5" />}
                  {step.id === 'settings' && <Sliders className="w-3.5 h-3.5" />}
                  {step.id === 'publish' && <Globe className="w-3.5 h-3.5" />}
                  <span>{step.targetLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{step.summary}</p>

              <ul className="space-y-1 text-xs text-slate-400 pl-1">
                {step.checklist.map((c, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-cyan-400 font-mono mt-0.5">·</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Bottom Quick Prompt Action */}
      {onRunSamplePrompt && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-white">Try Codex Tool-Calling Synthesis</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Populate a verification prompt referencing the AN-EVC-001 contract and Hono API.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('terminal')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Terminal</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onRunSamplePrompt(
                  'Verify @verification-tools/canonical.ts against Python RFC 8785 and add a Hono health route in @src/index.ts.'
                )
              }
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-cyan-300 cursor-pointer"
            >
              Send Sample Prompt to Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
