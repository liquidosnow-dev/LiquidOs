import React, { useState } from 'react';
import {
  FolderKanban,
  Plus,
  CheckCircle2,
  Clock,
  FileCode2,
  ArrowRight,
  FileText,
  Sparkles,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  ProjectBriefStatus,
  WorkspaceProjectRecord,
  validateProjectBriefInput,
} from '../../utils/spatialNavigation';
import { WorkspaceTabType } from '../PreviewCanvas';
import { StatusIndicator } from '../ui/StatusIndicator';

interface ProjectWorkspaceProps {
  projects: WorkspaceProjectRecord[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (input: { name: string; description: string; stack: string }) => void;
  onSubmitBrief: (
    projectId: string,
    brief: { title: string; objectives: string; constraints: string; targetStack: string }
  ) => void;
  onReviewBrief: (projectId: string, status: ProjectBriefStatus, reviewNotes: string) => void;
  onOpenWorkbench: (tab?: WorkspaceTabType) => void;
  compact?: boolean;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onSubmitBrief,
  onReviewBrief,
  onOpenWorkbench,
  compact = false,
}) => {
  const active = projects.find((p) => p.id === activeProjectId) || projects[0];
  const [subTab, setSubTab] = useState<'overview' | 'create' | 'brief'>('overview');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStack, setNewStack] = useState('React 19 · Hono · Cloudflare D1');

  const [briefTitle, setBriefTitle] = useState(active?.brief?.title || '');
  const [briefObjectives, setBriefObjectives] = useState(active?.brief?.objectives || '');
  const [briefConstraints, setBriefConstraints] = useState(
    active?.brief?.constraints || 'Ed25519 attested builds · zero exposed secrets'
  );
  const [briefStack, setBriefStack] = useState(
    active?.brief?.targetStack || 'React 19 · TypeScript · Tailwind CSS'
  );
  const [reviewNotes, setReviewNotes] = useState(active?.brief?.reviewNotes || '');
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim().length < 2) {
      setFormError('Project name must be at least 2 characters.');
      return;
    }
    setFormError(null);
    onCreateProject({
      name: newName.trim(),
      description: newDesc.trim() || 'Sovereign workspace project under Liquid OS governance.',
      stack: newStack.trim(),
    });
    setNewName('');
    setNewDesc('');
    setSubTab('overview');
  };

  const handleBriefFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateProjectBriefInput({ title: briefTitle, objectives: briefObjectives });
    if (!check.ok) {
      setFormError(check.error || 'Invalid project brief.');
      return;
    }
    setFormError(null);
    if (!active) return;
    onSubmitBrief(active.id, {
      title: briefTitle.trim(),
      objectives: briefObjectives.trim(),
      constraints: briefConstraints.trim(),
      targetStack: briefStack.trim(),
    });
    setSubTab('overview');
  };

  // Custom Architectural Skyline SVG Artwork (zero external asset fragility)
  const SkylineSvg = (
    <svg viewBox="0 0 220 120" className="w-full h-full object-cover" aria-hidden="true">
      <defs>
        <linearGradient id="los-sky-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#082f49" />
          <stop offset="55%" stopColor="#0c1931" />
          <stop offset="100%" stopColor="#030712" />
        </linearGradient>
        <linearGradient id="los-tower" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="220" height="120" fill="url(#los-sky-bg)" />
      <circle cx="174" cy="28" r="14" fill="#bae6fd" fillOpacity="0.16" stroke="#7dd3fc" strokeOpacity="0.35" strokeWidth="0.7" />
      <circle cx="195" cy="40" r="6" fill="#38bdf8" fillOpacity="0.14" />
      {/* Towers */}
      <path d="M22 100 L22 52 L34 46 L46 52 L46 100 Z" fill="#0b1529" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="0.8" />
      <path d="M52 100 L52 38 L64 26 L76 38 L76 100 Z" fill="#0e1b33" stroke="#7dd3fc" strokeOpacity="0.45" strokeWidth="0.9" />
      <path d="M84 100 L84 22 L95 8 L106 22 L106 100 Z" fill="url(#los-tower)" stroke="#e0f2fe" strokeOpacity="0.6" strokeWidth="1" />
      <path d="M112 100 L112 34 L124 20 L136 34 L136 100 Z" fill="#0f213d" stroke="#38bdf8" strokeOpacity="0.5" strokeWidth="0.9" />
      <path d="M144 100 L144 48 L156 40 L168 48 L168 100 Z" fill="#0b1529" stroke="#38bdf8" strokeOpacity="0.3" strokeWidth="0.8" />
      {/* Conduit horizon & bridge */}
      <line x1="0" y1="98" x2="220" y2="98" stroke="#22d3ee" strokeOpacity="0.65" strokeWidth="1.2" />
      <path d="M0 112 Q110 92 220 110" fill="none" stroke="#38bdf8" strokeOpacity="0.4" strokeWidth="1.5" />
    </svg>
  );

  if (compact && active) {
    return (
      <div className="flex flex-col h-full justify-between gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-cyan-300" />
            <span className="text-xs sm:text-sm font-semibold text-slate-100">
              Project Workspace
            </span>
          </div>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-400/35 text-cyan-200">
            {active.watermark}
          </span>
        </div>

        <div className="grid grid-cols-12 gap-3 items-center flex-1">
          <div className="col-span-5 h-24 rounded-xl overflow-hidden border border-cyan-300/25 shadow-inner">
            {SkylineSvg}
          </div>
          <div className="col-span-7 space-y-1.5 min-w-0">
            <div>
              <div className="text-xs font-semibold text-slate-100 truncate">
                {active.name}
              </div>
              <div className="mt-1">
                <StatusIndicator tone="nominal" label={active.status} />
              </div>
            </div>
            <ul className="space-y-1">
              {active.milestones.slice(0, 3).map((ms) => (
                <li
                  key={ms.id}
                  className="flex items-center gap-1.5 text-[11px] text-slate-300 truncate"
                >
                  {ms.done ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                  )}
                  <span className="truncate">{ms.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onOpenWorkbench('preview')}
            className="mercury-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-300/25 bg-slate-900/75 hover:border-cyan-400/50 text-xs font-medium text-slate-100 cursor-pointer"
          >
            <span>Open Project</span>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-300" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSubTab('overview')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer ${
              subTab === 'overview'
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-100'
                : 'bg-slate-900/60 border-slate-300/15 text-slate-300 hover:text-white'
            }`}
          >
            Projects ({projects.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('brief')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer flex items-center gap-1 ${
              subTab === 'brief'
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-100'
                : 'bg-slate-900/60 border-slate-300/15 text-slate-300 hover:text-white'
            }`}
          >
            <FileText className="w-3 h-3" />
            Brief & Review
          </button>
        </div>
        <button
          type="button"
          onClick={() => setSubTab(subTab === 'create' ? 'overview' : 'create')}
          className="mercury-press px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-[11px] font-medium text-cyan-100 hover:bg-cyan-500/25 flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>{subTab === 'create' ? 'Cancel' : 'New Project'}</span>
        </button>
      </div>

      {formError && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-950/50 border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-200">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {subTab === 'create' && (
        <form
          onSubmit={handleCreateSubmit}
          className="rounded-xl bg-slate-950/75 border border-cyan-400/30 p-3 space-y-2.5"
        >
          <div className="text-xs font-semibold text-cyan-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Create Sovereign Workspace Project
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Project Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Sovereign Telemetry Mesh"
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-300/20 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Description</label>
            <textarea
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Objectives and operational boundary..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-300/20 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Target Runtime Stack</label>
            <input
              type="text"
              value={newStack}
              onChange={(e) => setNewStack(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-300/20 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="mercury-press px-3 py-1.5 rounded-lg bg-cyan-500/25 border border-cyan-400/50 text-xs font-semibold text-cyan-100 cursor-pointer"
            >
              Initialize Project & Watermark
            </button>
          </div>
        </form>
      )}

      {subTab === 'brief' && active && (
        <div className="space-y-3">
          <form
            onSubmit={handleBriefFormSubmit}
            className="rounded-xl bg-slate-950/75 border border-slate-300/20 p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-100">
                Brief · {active.name}
              </span>
              <span className="font-mono text-[10px] text-cyan-300">{active.watermark}</span>
            </div>
            <input
              type="text"
              value={briefTitle}
              onChange={(e) => setBriefTitle(e.target.value)}
              placeholder="Project brief title..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-300/20 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
            <textarea
              rows={3}
              value={briefObjectives}
              onChange={(e) => setBriefObjectives(e.target.value)}
              placeholder="Core objectives and deliverables..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-300/20 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={briefConstraints}
                onChange={(e) => setBriefConstraints(e.target.value)}
                placeholder="Security / operational constraints"
                className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-300/20 text-xs text-slate-100 focus:outline-none"
              />
              <input
                type="text"
                value={briefStack}
                onChange={(e) => setBriefStack(e.target.value)}
                placeholder="Runtime stack"
                className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-300/20 text-xs text-slate-100 focus:outline-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="mercury-press px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/45 text-xs font-medium text-cyan-100 cursor-pointer"
              >
                Submit Brief for Review
              </button>
            </div>
          </form>

          {active.brief && (
            <div className="rounded-xl bg-slate-950/70 border border-slate-300/15 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-100">Review Workflow</span>
                <StatusIndicator
                  tone={
                    active.brief.status === 'approved'
                      ? 'nominal'
                      : active.brief.status === 'changes_requested'
                      ? 'warning'
                      : 'active'
                  }
                  label={active.brief.status.replace('_', ' ').toUpperCase()}
                />
              </div>
              <input
                type="text"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Reviewer decision note..."
                className="w-full px-2.5 py-1 rounded-lg bg-slate-900/85 border border-slate-300/15 text-xs text-slate-200 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onReviewBrief(active.id, 'in_review', reviewNotes)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-200 hover:border-cyan-400/40 cursor-pointer"
                >
                  Mark In Review
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onReviewBrief(
                      active.id,
                      'approved',
                      reviewNotes || 'Verified against LOS-CORE-001 sovereign policy.'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/45 text-[11px] text-emerald-200 flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3 h-3" /> Approve Brief
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onReviewBrief(
                      active.id,
                      'changes_requested',
                      reviewNotes || 'Clarify verification criteria.'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-amber-950/50 border border-amber-500/40 text-[11px] text-amber-200 cursor-pointer"
                >
                  Request Changes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'overview' && active && (
        <div className="space-y-3">
          {/* Active Project Hero Card */}
          <div className="rounded-xl bg-slate-950/75 border border-slate-300/20 p-3 space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="w-24 h-20 rounded-lg overflow-hidden border border-cyan-400/30 shrink-0">
                {SkylineSvg}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-400/35 text-cyan-200">
                    {active.watermark}
                  </span>
                  <StatusIndicator tone="nominal" label={active.status} />
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-slate-100 mt-1 truncate">
                  {active.name}
                </h3>
                <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                  {active.description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {active.milestones.map((ms) => (
                <div
                  key={ms.id}
                  className="rounded-lg bg-slate-900/70 border border-slate-300/10 px-2 py-1.5 flex items-center gap-1.5 text-[10px] text-slate-200"
                >
                  {ms.done ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                  )}
                  <span className="truncate">{ms.label}</span>
                </div>
              ))}
            </div>

            {/* Direct Workspace Actions */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => onOpenWorkbench('preview')}
                className="mercury-press px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/45 text-[11px] font-medium text-cyan-100 cursor-pointer"
              >
                Open Live Preview
              </button>
              <button
                type="button"
                onClick={() => onOpenWorkbench('code')}
                className="mercury-press px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-300/20 text-[11px] text-slate-200 hover:border-cyan-400/40 flex items-center gap-1 cursor-pointer"
              >
                <FileCode2 className="w-3 h-3 text-cyan-300" /> Code ({active.files.length})
              </button>
              <button
                type="button"
                onClick={() => onOpenWorkbench('files')}
                className="mercury-press px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-300/20 text-[11px] text-slate-200 hover:border-cyan-400/40 cursor-pointer"
              >
                On-Device FS
              </button>
              <button
                type="button"
                onClick={() => onOpenWorkbench('publish')}
                className="mercury-press px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-300/20 text-[11px] text-slate-200 hover:border-cyan-400/40 cursor-pointer"
              >
                Publish
              </button>
            </div>
          </div>

          {/* All Registered Workspace Projects */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              All Registered Projects & Blueprints
            </div>
            <div className="space-y-1.5">
              {projects.map((p) => {
                const isSelected = p.id === active.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectProject(p.id)}
                    className={`w-full text-left rounded-xl p-2.5 border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-400/45'
                        : 'bg-slate-950/60 border-slate-300/15 hover:border-slate-300/35'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-cyan-300">{p.watermark}</span>
                        <span className="text-xs font-medium text-slate-100 truncate">
                          {p.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {p.files.length} files · {p.brief ? `Brief: ${p.brief.status}` : 'No brief submitted'}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 shrink-0">
                      {isSelected ? 'Active' : 'Switch'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
